import { Storage } from "@plasmohq/storage"

import type { ChainActionExecutionResult, PublishExecutionResult, TaskResultReportPayload } from "~types/execution"
import { getPlatformInfos } from "~sync/common"
import { API_BASE_URL } from "~utils/config"

import { waitForRuntimeMessage } from "../messages/wait-for-runtime-message"
import { createSafePopupWindow } from "./popup-window"

const storage = new Storage({ area: "local" })

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
  const { apiKey, extensionClientId, clientId } = await getAuthHeaders()
  if (!apiKey) return null

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

  const response = await fetch(`${API_BASE_URL}/api/extension/ping`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) return null

  const resBody = await response.json()
  if (!resBody.success && resBody.error === "KEY_EXPIRED") {
    await storage.remove("apiKey")
  } else if (!resBody.success && resBody.error === "CLIENT_NOT_FOUND") {
    await storage.remove("extensionClientId")
  } else if (resBody.success && resBody.data.action === "NEW_TASK") {
    chrome.tabs.create({ url: resBody.data.url })
  } else if (resBody.success && resBody.data.action === "NEW_CLIENT") {
    await storage.set("extensionClientId", resBody.data.clientId)
  }

  return null
}

export async function reportTaskResult(
  payload: TaskResultReportPayload & {
    executionResult: PublishExecutionResult | ChainActionExecutionResult
  },
) {
  const { apiKey, clientId, extensionClientId } = await getAuthHeaders()
  if (!apiKey) {
    throw new Error("EXTENSION_NOT_LINKED")
  }

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
      const response = await fetch(`${API_BASE_URL}/api/extension/task-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`TASK_RESULT_PERSIST_FAILED:${response.status}`)
      }

      const resBody = await response.json()
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

export const handleLinkExtensionMessage = async (request: { action?: string; data?: { apiKey?: string } }) => {
  if (request.action !== "MUTLIPOST_EXTENSION_LINK_EXTENSION") return undefined

  const params = {
    action: "MUTLIPOST_EXTENSION_LINK_EXTENSION",
    apiKey: request.data?.apiKey
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
  const res = await handleLinkExtensionMessage(request as { action?: string; data?: { apiKey?: string } })
  if (res !== undefined) sendResponse(res)
  return true
}

export const starter = (interval: number) => {
  void ping(true)
  setInterval(ping, interval)
}
