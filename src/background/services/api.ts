import { Storage } from "@plasmohq/storage"
import { getPlatformInfos } from "~sync/common"
import { API_BASE_URL } from "~utils/config"
import { waitForRuntimeMessage } from "../messages/wait-for-runtime-message"

const storage = new Storage({ area: "local" })

type MutablePlatformInfo = Record<string, unknown> & {
  injectFunction?: unknown
  accountInfo?: Record<string, unknown> & { extraData?: unknown }
}

export const ping = async (withPlatforms: boolean = false) => {
  const apiKey = await storage.get("apiKey")
  if (!apiKey) return

  const extensionClientId = (await storage.get("extensionClientId")) || ""
  const body: {
    extensionVersion: string
    extensionClientId: string
    platformInfos?: unknown
  } = {
    extensionVersion: chrome.runtime.getManifest().version,
    extensionClientId,
    platformInfos: undefined
  }

  if (withPlatforms) {
    let platformInfos = await getPlatformInfos()
    platformInfos = platformInfos.map((platform) => {
      const platformCopy: MutablePlatformInfo = { ...(platform as unknown as MutablePlatformInfo) }
      delete platformCopy.injectFunction
      if (platformCopy.accountInfo) {
        const accountInfo: MutablePlatformInfo["accountInfo"] = { ...platformCopy.accountInfo }
        delete accountInfo.extraData
        platformCopy.accountInfo = accountInfo
      }
      return platformCopy
    })
    body.platformInfos = platformInfos
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

  // Open popup after listener is attached (avoids race in tests/fast confirmations).
  void chrome.windows.create({
    url: chrome.runtime.getURL(`tabs/link-extension.html#${encodedParams}`),
    type: "popup",
    width: 800,
    height: 600
  })

  const confirmMsg = await confirmPromise
  return { confirm: confirmMsg.confirm }
}

// Backward-compatible wrapper (kept to avoid touching unrelated callers).
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
