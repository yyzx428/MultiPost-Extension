import { Storage } from "@plasmohq/storage"

import type { ChainActionExecutionResult, PublishExecutionResult, TaskResultReportPayload } from "~types/execution"
import { getPlatformInfos } from "~sync/common"
import { API_BASE_URL } from "~utils/config"

import { waitForRuntimeMessage } from "../messages/wait-for-runtime-message"
import { createSafePopupWindow } from "./popup-window"

const storage = new Storage({ area: "local" })

const AUTO_RELINK_ENABLED_KEY = "autoRelinkEnabled"
const AUTO_RELINK_EMAIL_KEY = "autoRelinkEmail"
const AUTO_RELINK_PASSWORD_KEY = "autoRelinkPassword"

let autoRelinkPromise: Promise<string> | null = null

type MutablePlatformInfo = Record<string, unknown> & {
  injectFunction?: unknown
  accountInfo?: Record<string, unknown> & { extraData?: unknown }
}

async function getAuthHeaders() {
  const apiKey = await storage.get<string>("apiKey")
  const extensionClientId = (await storage.get<string>("extensionClientId")) || ""
  return {
    apiKey,
    extensionClientId,
    clientId: extensionClientId
  }
}

async function getAutoRelinkConfig() {
  return {
    autoRelinkEnabled: (await storage.get<boolean>(AUTO_RELINK_ENABLED_KEY)) ?? false,
    autoRelinkEmail: (await storage.get<string>(AUTO_RELINK_EMAIL_KEY)) || "",
    autoRelinkPassword: (await storage.get<string>(AUTO_RELINK_PASSWORD_KEY)) || ""
  }
}

type JsonRequestResult<T> = {
  response: Response
  body: T | null
}

type TokenGenerationResponse = {
  success?: boolean
  data?: {
    token?: string
  }
  error?: string
  message?: string
}

type LoginResponse = {
  success?: boolean
  data?: {
    token?: string
  }
  error?: string
  message?: string
}

type TokenAwareResponseBody = {
  success?: boolean
  error?: string
  message?: string
  data?: {
    error?: string
    message?: string
    action?: string
    url?: string
    clientId?: string
  }
}

async function requestJson<T>(
  input: string,
  init: RequestInit,
): Promise<JsonRequestResult<T>> {
  const response = await fetch(input, init)
  let body: T | null = null

  try {
    body = (await response.json()) as T
  } catch {
    body = null
  }

  return {
    response,
    body,
  }
}

function collectErrorMessages(body: TokenAwareResponseBody | null) {
  return [
    body?.error,
    body?.message,
    body?.data?.error,
    body?.data?.message,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.toLowerCase())
}

function isTokenInvalidResponse(status: number, body: TokenAwareResponseBody | null) {
  if (status === 401) {
    return true
  }

  const messages = collectErrorMessages(body)
  return messages.some((message) =>
    message.includes("token not found") ||
    message.includes("token is not active") ||
    message.includes("missing or invalid authorization header") ||
    message.includes("key_expired") ||
    message.includes("expired_token"),
  )
}

function buildAuthErrorMessage(body: { error?: string; message?: string } | null, fallback: string) {
  return body?.message || body?.error || fallback
}

async function loginToWeb(email: string, password: string) {
  const { response, body } = await requestJson<LoginResponse>(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  })

  if (!response.ok || !body?.success || !body.data?.token) {
    throw new Error(buildAuthErrorMessage(body, "AUTO_RELINK_LOGIN_FAILED"))
  }

  return body.data.token
}

async function generateExtensionToken(webToken: string) {
  const { response, body } = await requestJson<TokenGenerationResponse>(`${API_BASE_URL}/api/tokens/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${webToken}`,
    },
    body: JSON.stringify({}),
  })

  if (!response.ok || !body?.success || !body.data?.token) {
    throw new Error(buildAuthErrorMessage(body, "AUTO_RELINK_GENERATE_TOKEN_FAILED"))
  }

  return body.data.token
}

async function refreshExtensionApiKey(reason: string) {
  if (autoRelinkPromise) {
    return autoRelinkPromise
  }

  autoRelinkPromise = (async () => {
    const config = await getAutoRelinkConfig()
    if (!config.autoRelinkEnabled || !config.autoRelinkEmail || !config.autoRelinkPassword) {
      throw new Error("AUTO_RELINK_NOT_CONFIGURED")
    }

    const webToken = await loginToWeb(config.autoRelinkEmail, config.autoRelinkPassword)
    const apiKey = await generateExtensionToken(webToken)
    await storage.set("apiKey", apiKey)
    console.info("[MultiPost Extension] 自动续连成功", { reason })
    return apiKey
  })().finally(() => {
    autoRelinkPromise = null
  })

  return autoRelinkPromise
}

async function tryRefreshExtensionApiKey(reason: string) {
  try {
    return await refreshExtensionApiKey(reason)
  } catch (error) {
    console.error("[MultiPost Extension] 自动续连失败", {
      reason,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

async function requestWithExtensionAuth<T extends TokenAwareResponseBody>(
  path: string,
  body: unknown,
  options?: {
    retryOnAuthError?: boolean
  },
) {
  let apiKey = await storage.get<string>("apiKey")

  if (!apiKey) {
    apiKey = await tryRefreshExtensionApiKey("NO_API_KEY")
  }

  if (!apiKey) {
    return null
  }

  const execute = (bearer: string) =>
    requestJson<T>(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify(body),
    })

  let result = await execute(apiKey)

  if (options?.retryOnAuthError !== false && isTokenInvalidResponse(result.response.status, result.body)) {
    await storage.remove("apiKey")
    const refreshedApiKey = await tryRefreshExtensionApiKey("TOKEN_INVALID")
    if (!refreshedApiKey) {
      return result
    }

    result = await execute(refreshedApiKey)
  }

  return result
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getExtensionLinkState() {
  const { apiKey, extensionClientId } = await getAuthHeaders()
  return {
    apiKey,
    extensionClientId,
    isLinked: !!apiKey && !!extensionClientId
  }
}

export const ping = async (withPlatforms = false) => {
  const { extensionClientId, clientId } = await getAuthHeaders()

  const body: {
    extensionVersion: string
    clientId: string
    extensionClientId: string
    platformInfos?: unknown
  } = {
    extensionVersion: chrome.runtime.getManifest().version,
    clientId,
    extensionClientId,
    platformInfos: undefined
  }

  if (withPlatforms) {
    const platformInfos = await getPlatformInfos()
    const sanitizedPlatformInfos = platformInfos.map((platform) => {
      const platformCopy: MutablePlatformInfo = { ...(platform as unknown as MutablePlatformInfo) }
      delete platformCopy.injectFunction
      if (platformCopy.accountInfo) {
        const accountInfo = { ...platformCopy.accountInfo }
        delete accountInfo.extraData
        platformCopy.accountInfo = accountInfo
      }
      return platformCopy
    })
    body.platformInfos = sanitizedPlatformInfos
  }

  const result = await requestWithExtensionAuth<TokenAwareResponseBody>("/api/extension/ping", body)
  if (!result) {
    return null
  }

  const resBody = result.body
  if (!result.response.ok || !resBody) {
    return null
  }

  if (!resBody.success && (resBody.error === "KEY_EXPIRED" || resBody.data?.error === "KEY_EXPIRED")) {
    await storage.remove("apiKey")
  } else if (!resBody.success && (resBody.error === "CLIENT_NOT_FOUND" || resBody.data?.error === "CLIENT_NOT_FOUND")) {
    await storage.remove("extensionClientId")
  } else if (resBody.success && resBody.data?.action === "NEW_TASK" && resBody.data.url) {
    chrome.tabs.create({ url: resBody.data.url })
  } else if (resBody.success && resBody.data?.action === "NEW_CLIENT" && resBody.data.clientId) {
    await storage.set("extensionClientId", resBody.data.clientId)
  }

  return null
}

export async function reportTaskResult(
  payload: TaskResultReportPayload & {
    executionResult: PublishExecutionResult | ChainActionExecutionResult
  },
) {
  const { clientId, extensionClientId } = await getAuthHeaders()

  const requestBody = {
    ...payload,
    clientId,
    extensionClientId: payload.extensionClientId || extensionClientId
  }

  let lastError: Error | null = null
  const retryDelays = [0, 1000, 2000, 4000]

  for (const delay of retryDelays) {
    if (delay > 0) {
      await sleep(delay)
    }

    try {
      const result = await requestWithExtensionAuth<TokenAwareResponseBody>("/api/extension/task-result", requestBody)
      if (!result) {
        throw new Error("EXTENSION_NOT_LINKED")
      }

      if (!result.response.ok) {
        throw new Error(`TASK_RESULT_PERSIST_FAILED:${result.response.status}`)
      }

      const resBody = result.body
      if (!resBody?.success) {
        throw new Error(resBody?.error || "TASK_RESULT_PERSIST_FAILED")
      }

      return resBody.data
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError || new Error("TASK_RESULT_PERSIST_FAILED")
}

export const handleLinkExtensionMessage = async (request: {
  action?: string
  data?: {
    apiKey?: string
    autoRelinkEnabled?: boolean
    autoRelinkEmail?: string
    autoRelinkPassword?: string
  }
}) => {
  if (request.action !== "MUTLIPOST_EXTENSION_LINK_EXTENSION") return undefined

  const params = {
    action: "MUTLIPOST_EXTENSION_LINK_EXTENSION",
    apiKey: request.data?.apiKey,
    autoRelinkEnabled: request.data?.autoRelinkEnabled,
    autoRelinkEmail: request.data?.autoRelinkEmail,
    autoRelinkPassword: request.data?.autoRelinkPassword,
  }
  const encodedParams = btoa(JSON.stringify(params))

  const confirmPromise = waitForRuntimeMessage<{ confirm: boolean }>(
    (message) => (message as { type?: string })?.type === "MUTLIPOST_EXTENSION_LINK_EXTENSION_CONFIRM",
    { timeoutMs: 60_000 },
  )

  void createSafePopupWindow({
    url: chrome.runtime.getURL(`tabs/link-extension.html#${encodedParams}`),
    width: 800,
    height: 600
  })

  const confirmMsg = await confirmPromise
  return { confirm: confirmMsg.confirm }
}

export const linkExtensionMessageHandler = async (
  request: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => {
  const res = await handleLinkExtensionMessage(request as {
    action?: string
    data?: {
      apiKey?: string
      autoRelinkEnabled?: boolean
      autoRelinkEmail?: string
      autoRelinkPassword?: string
    }
  })
  if (res !== undefined) sendResponse(res)
  return true
}

export const starter = (interval: number) => {
  void ping(true)
  setInterval(ping, interval)
}
