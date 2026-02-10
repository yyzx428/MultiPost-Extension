/* eslint-disable @typescript-eslint/no-explicit-any */
export {}

import { Storage } from "@plasmohq/storage"
import { getAllAccountInfo } from "~sync/account"
import {
  createTabsForPlatforms,
  getPlatformInfos,
  type SyncData,
  type SyncDataPlatform
} from "~sync/common"

import { fileOperationManager } from "../file-ops"
import type { FileOperation, FileOperationResult } from "../file-ops/types"
import QuantumEntanglementKeepAlive from "../utils/keep-alive"

import { createMessageRouter } from "./messages/router"
import { handleLinkExtensionMessage, starter } from "./services/api"
import { addTabsManagerMessages, handleTabsManagerMessage, tabsManagerHandleTabRemoved, tabsManagerHandleTabUpdated } from "./services/tabs"
import { handleTrustDomainMessage } from "./services/trust-domain"

const storage = new Storage({ area: "local" })

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function initDefaultTrustedDomains() {
  const trustedDomains = await storage.get<Array<{ id: string; domain: string }>>("trustedDomains")
  if (!trustedDomains) {
    await storage.set("trustedDomains", [{ id: crypto.randomUUID(), domain: "multipost.app" }])
  }
}

async function executeFileOperationInTab(tabId: number, operation: FileOperation): Promise<FileOperationResult> {
  try {
    await chrome.tabs.update(tabId, { active: true })
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (op: any) => {
        try {
          await new Promise<void>((resolve) => {
            if (document.readyState === "complete") resolve()
            else window.addEventListener("load", () => resolve())
          })

          await new Promise((resolve) => setTimeout(resolve, 3000))

          if (op.platform === "baiduyun" && op.operation === "share") {
            return new Promise((resolve, reject) => {
              chrome.runtime.sendMessage(
                { type: "EXECUTE_FILE_OPS_IN_TAB", operation: op, tabId: op.tabId },
                (response) => {
                  if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
                  else if (response && response.success) resolve(response)
                  else reject(new Error(response?.error || "FILE_OP_FAILED"))
                },
              )
            })
          }

          throw new Error(`Unsupported operation: ${op.platform}.${op.operation}`)
        } catch (error) {
          console.error("File operation failed in tab:", error)
          throw error
        }
      },
      args: [operation]
    })

    const first = results?.[0]?.result
    if (first) return first as FileOperationResult
    throw new Error("EXECUTE_FILE_OPERATION_IN_TAB_FAILED")
  } catch (error: any) {
    return {
      success: false,
      operation: operation.operation,
      platform: operation.platform,
      executionTime: 0,
      data: null,
      logs: [{ timestamp: Date.now(), level: "error", message: error?.message || String(error) }]
    }
  }
}

chrome.runtime.onInstalled.addListener((object) => {
  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: "https://multipost.app/on-install" })
  }
  void initDefaultTrustedDomains()
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  tabsManagerHandleTabUpdated(tabId, changeInfo, tab)
})
chrome.tabs.onRemoved.addListener((tabId) => {
  tabsManagerHandleTabRemoved(tabId)
})

// Message state (kept as singletons on purpose)
let currentSyncData: SyncData | null = null
let currentPublishPopup: chrome.windows.Window | null = null
let currentPublishRequest: null | {
  traceId?: string
  expectedResultsCount: number
  receivedResults: Array<{
    traceId: string
    platformName: string
    success: boolean
    publishUrl: string
    errorMessage?: string
    timestamp: number
  }>
  timeoutId?: number
  deferred: Deferred<any>
} = null

let currentChainActionData: null | {
  action: string
  config: Record<string, unknown>
  traceId?: string
  deferred: Deferred<any>
} = null

function finalizePublishIfNeeded() {
  if (!currentPublishRequest) return

  if (currentPublishRequest.timeoutId) clearTimeout(currentPublishRequest.timeoutId)

  const aggregatedResult = {
    traceId: currentPublishRequest.traceId,
    totalPlatforms: currentPublishRequest.expectedResultsCount,
    successCount: currentPublishRequest.receivedResults.filter((r) => r.success).length,
    failureCount: currentPublishRequest.receivedResults.filter((r) => !r.success).length,
    results: currentPublishRequest.receivedResults,
    timestamp: Date.now()
  }

  currentPublishRequest.deferred.resolve(aggregatedResult)
  currentPublishRequest = null
}

async function handleExecuteFileOps(request: any, sender: chrome.runtime.MessageSender) {
  const operationData = request.data?.data ?? request.data
  const operation = operationData as FileOperation
  const result = await fileOperationManager.executeOperation(operation)

  if (request.type === "request" && sender.tab?.id) {
    await chrome.tabs.sendMessage(sender.tab.id, {
      type: "response",
      action: "MUTLIPOST_EXTENSION_EXECUTE_FILE_OPS",
      traceId: request.traceId,
      code: result.success ? 0 : 1,
      data: result.success ? result.data : null,
      message: result.success ? null : result.logs?.[0]?.message || "FILE_OP_FAILED"
    })
  }

  if (result.success) return { success: true, data: result.data }
  return { success: false, error: result.logs?.[0]?.message || "FILE_OP_FAILED" }
}

const router = createMessageRouter()

// Simple sync handler
router.register("MUTLIPOST_EXTENSION_CHECK_SERVICE_STATUS", async () => {
  return { extensionId: chrome.runtime.id }
})

// File ops
router.register("MUTLIPOST_EXTENSION_EXECUTE_FILE_OPS", handleExecuteFileOps)
router.register("EXECUTE_FILE_OPERATION", async (request: any) => {
  try {
    if (request.tabId) return await executeFileOperationInTab(request.tabId, request.operation)
    return await fileOperationManager.executeOperation(request.operation)
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || String(error),
      operation: request.operation?.operation,
      platform: request.operation?.platform,
      executionTime: 0,
      data: null,
      logs: [{ timestamp: Date.now(), level: "error", message: error?.message || String(error) }]
    }
  }
})
router.register("EXECUTE_FILE_OPS_IN_TAB", async (request: any) => {
  try {
    return await fileOperationManager.executeOperation(request.operation)
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || String(error),
      operation: request.operation?.operation,
      platform: request.operation?.platform,
      executionTime: 0,
      data: null,
      logs: [{ timestamp: Date.now(), level: "error", message: error?.message || String(error) }]
    }
  }
})

// Tabs manager (type-based)
router.register("MUTLIPOST_EXTENSION_REQUEST_PUBLISH_RELOAD", (req) => handleTabsManagerMessage(req as any))
router.register("MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_TABS", (req) => handleTabsManagerMessage(req as any))
router.register("MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_ADD_TABS", (req) => handleTabsManagerMessage(req as any))

// Trust domain / link extension
router.register("MUTLIPOST_EXTENSION_GET_TRUSTED_DOMAINS", (req, sender) => handleTrustDomainMessage(req as any, sender))
router.register("MUTLIPOST_EXTENSION_DELETE_TRUSTED_DOMAIN", (req, sender) => handleTrustDomainMessage(req as any, sender))
router.register("MUTLIPOST_EXTENSION_REQUEST_TRUST_DOMAIN", (req, sender) => handleTrustDomainMessage(req as any, sender))
router.register("MUTLIPOST_EXTENSION_LINK_EXTENSION", (req) => handleLinkExtensionMessage(req as any))

// Publish flow (single in-flight)
router.register("MUTLIPOST_EXTENSION_PUBLISH", async (request: any) => {
  if (currentPublishRequest) {
    return { success: false, error: "PUBLISH_ALREADY_IN_PROGRESS" }
  }

  const data = request.data as SyncData
  data.traceId = request.traceId
  currentSyncData = data

  const deferred = createDeferred<any>()
  currentPublishRequest = {
    traceId: request.traceId,
    expectedResultsCount: data.platforms.length,
    receivedResults: [],
    timeoutId: setTimeout(() => finalizePublishIfNeeded(), 5 * 60 * 1000) as any,
    deferred
  }

  void chrome.windows
    .create({ url: chrome.runtime.getURL("tabs/publish.html"), type: "popup", width: 800, height: 600 })
    .then((w) => {
      currentPublishPopup = w
    })

  return deferred.promise
})

router.register("MUTLIPOST_EXTENSION_PUBLISH_RESULT", async (request: any) => {
  const result = request.data
  if (currentPublishRequest && result?.traceId === currentPublishRequest.traceId) {
    currentPublishRequest.receivedResults.push(result)
    if (currentPublishRequest.receivedResults.length >= currentPublishRequest.expectedResultsCount) {
      finalizePublishIfNeeded()
    }
  }
  return { success: true }
})

router.register("MUTLIPOST_EXTENSION_PUBLISH_REQUEST_SYNC_DATA", async () => {
  return { syncData: currentSyncData }
})

router.register("MUTLIPOST_EXTENSION_PUBLISH_NOW", async (request: any) => {
  const data = request.data as SyncData
  if (!Array.isArray(data.platforms) || data.platforms.length === 0) return { error: "NO_PLATFORMS" }

  const tabs = await createTabsForPlatforms(data)
  addTabsManagerMessages({
    syncData: data,
    tabs: tabs.map((t: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }) => ({
      tab: t.tab,
      platformInfo: t.platformInfo
    }))
  })

  if (currentPublishPopup?.id) {
    await chrome.windows.update(currentPublishPopup.id, { focused: true })
  }

  return {
    tabs: tabs.map((t: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }) => ({
      tab: t.tab,
      platformInfo: t.platformInfo
    }))
  }
})

// Chain action flow (single in-flight)
router.register("MUTLIPOST_EXTENSION_CHAIN_ACTION", async (request: any) => {
  if (currentChainActionData) {
    return { success: false, error: "CHAIN_ACTION_ALREADY_IN_PROGRESS" }
  }

  const deferred = createDeferred<any>()
  currentChainActionData = {
    action: request.data?.action,
    config: request.data?.config,
    traceId: request.traceId,
    deferred
  }

  void chrome.windows.create({
    url: chrome.runtime.getURL("tabs/chain-action.html"),
    type: "popup",
    width: 800,
    height: 600
  })

  return deferred.promise
})

router.register("MUTLIPOST_EXTENSION_CHAIN_ACTION_REQUEST_DATA", async () => {
  return { config: currentChainActionData }
})

router.register("MUTLIPOST_EXTENSION_CHAIN_ACTION_COMPLETE", async (request: any) => {
  if (currentChainActionData) {
    currentChainActionData.deferred.resolve(request.data)
    currentChainActionData = null
    return { success: true }
  }
  return { success: false, error: "NO_CHAIN_ACTION_IN_PROGRESS" }
})

// Misc
router.register("MUTLIPOST_EXTENSION_PLATFORMS", async () => {
  const platforms = await getPlatformInfos()
  return { platforms }
})

router.register("MUTLIPOST_EXTENSION_GET_ACCOUNT_INFOS", async () => {
  const accountInfo = await getAllAccountInfo()
  return { accountInfo }
})

router.register("MUTLIPOST_EXTENSION_OPEN_OPTIONS", async () => {
  await chrome.runtime.openOptionsPage()
  return { extensionId: chrome.runtime.id }
})

router.register("MUTLIPOST_EXTENSION_REFRESH_ACCOUNT_INFOS", async (request: any) => {
  await chrome.windows.create({
    url: chrome.runtime.getURL("tabs/refresh-accounts.html"),
    type: "popup",
    width: 800,
    height: 600,
    focused: !!request.data?.isFocused
  })
  return { success: true }
})

chrome.runtime.onMessage.addListener(router.onMessage as any)

starter(1000 * 10)

const quantumKeepAlive = new QuantumEntanglementKeepAlive()
quantumKeepAlive.startEntanglementProcess()
