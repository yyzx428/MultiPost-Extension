/* eslint-disable @typescript-eslint/no-explicit-any */
export {}

import { Storage } from "@plasmohq/storage"

import { fileOperationManager } from "../file-ops"
import type { FileOperation, FileOperationResult } from "../file-ops/types"
import QuantumEntanglementKeepAlive from "../utils/keep-alive"

import { createMessageRouter } from "./messages/router"
import {
  getExtensionLinkState,
  handleLinkExtensionMessage,
  reportTaskResult,
  starter
} from "./services/api"
import { createSafePopupWindow } from "./services/popup-window"
import {
  addTabsManagerMessages,
  handleTabsManagerMessage,
  tabsManagerHandleTabRemoved,
  tabsManagerHandleTabUpdated
} from "./services/tabs"
import { handleTrustDomainMessage } from "./services/trust-domain"

import {
  createTabsForPlatforms,
  getPlatformInfos,
  type SyncData
} from "~sync/common"
import { getPublishFailureForUrl } from "../sync/publish-post-condition"
import type {
  ChainActionExecutionResult,
  ChainActionStageResult,
  ExecutionItemStatus,
  ExecutionTaskStatus,
  PublishExecutionItem,
  PublishExecutionResult,
  PublishPlatformRuntimeStatus
} from "~types/execution"

const storage = new Storage({ area: "local" })

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
}

type PublishPlatformState = {
  platformName: string
  status: PublishPlatformRuntimeStatus
  startedAt: string
  finishedAt?: string
  publishUrl?: string
  errorCode?: string
  errorMessage?: string
  tabId?: number
  timeoutId?: number
}

type PublishSession = {
  traceId: string
  taskId?: string
  syncData: SyncData
  createdAt: number
  platformOrder: string[]
  platforms: Map<string, PublishPlatformState>
  deferred: Deferred<PublishExecutionResult>
  sourceWebTabId?: number
  popupWindowId?: number
  popupTabId?: number
  popupReady: boolean
  popupInitTimeoutId?: number
  finalized: boolean
}

type ChainActionSession = {
  action: string
  config: Record<string, unknown>
  traceId?: string
  taskId?: string
  deferred: Deferred<ChainActionExecutionResult>
  startedAt: string
  finalized: boolean
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

function nowIso() {
  return new Date().toISOString()
}

function isBoundsWindowCreateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("Bounds must be at least 50% within visible screen space")
}

function isTerminalStatus(status: PublishPlatformRuntimeStatus) {
  return status === "success" || status === "failed" || status === "timeout"
}

function toExecutionStatus(status: PublishPlatformRuntimeStatus): ExecutionItemStatus {
  if (status === "success") return "SUCCESS"
  if (status === "timeout") return "TIMEOUT"
  return "FAILED"
}

function buildPublishExecutionItem(state: PublishPlatformState): PublishExecutionItem {
  return {
    platformName: state.platformName,
    status: toExecutionStatus(state.status),
    publishUrl: state.publishUrl,
    errorCode: state.errorCode,
    errorMessage: state.errorMessage,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt || nowIso(),
    tabId: state.tabId
  }
}

function buildPublishExecutionResult(
  session: PublishSession,
  overrides?: { errorCode?: string; errorMessage?: string },
): PublishExecutionResult {
  const results = session.platformOrder.map((platformName) => {
    const state = session.platforms.get(platformName)
    if (!state) {
      const fallbackTime = nowIso()
      return {
        platformName,
        status: "FAILED",
        errorCode: overrides?.errorCode || "BACKGROUND_REJECTED",
        errorMessage: overrides?.errorMessage || "Platform state missing",
        startedAt: fallbackTime,
        finishedAt: fallbackTime
      } satisfies PublishExecutionItem
    }
    return buildPublishExecutionItem(state)
  })

  const successCount = results.filter((item) => item.status === "SUCCESS").length
  const failureCount = results.length - successCount
  const status: ExecutionTaskStatus = failureCount === 0 ? "COMPLETED" : "FAILED"

  return {
    kind: "publish",
    traceId: session.traceId,
    status,
    totalPlatforms: results.length,
    successCount,
    failureCount,
    results,
    errorCode: overrides?.errorCode,
    errorMessage: overrides?.errorMessage
  }
}

function attachPersistFailureToPublish(
  result: PublishExecutionResult,
  message: string,
): PublishExecutionResult {
  return {
    ...result,
    status: "FAILED",
    errorCode: "TASK_RESULT_PERSIST_FAILED",
    errorMessage: message
  }
}

function buildChainActionResult(
  rawResult: Record<string, unknown>,
  action: string,
  startedAt: string,
  overrides?: { errorCode?: string; errorMessage?: string },
): ChainActionExecutionResult {
  const stagesFromPayload = Array.isArray(rawResult.stages) ? (rawResult.stages as ChainActionStageResult[]) : undefined
  const finishedAt = nowIso()

  let stages = stagesFromPayload
  if (!stages) {
    const firstStageName = "baiduShare"
    const secondStageName = action === "baidu-red" ? "redPublish" : "agisoPublish"
    const baiduShareResult = rawResult.baiduShareResult
    const downstreamResult = rawResult.redPublishResult || rawResult.agisoPublishResult
    const success = rawResult.success === true
    const errorMessage =
      overrides?.errorMessage ||
      (typeof rawResult.error === "string" ? rawResult.error : undefined) ||
      "CHAIN_ACTION_FAILED"

    stages = [
      {
        stageName: firstStageName,
        status: baiduShareResult ? "SUCCESS" : "FAILED",
        startedAt,
        finishedAt,
        errorCode: !baiduShareResult && !success ? overrides?.errorCode || "BACKGROUND_REJECTED" : undefined,
        errorMessage: !baiduShareResult && !success ? errorMessage : undefined,
        details: baiduShareResult && typeof baiduShareResult === "object" ? (baiduShareResult as Record<string, unknown>) : undefined
      },
      {
        stageName: secondStageName,
        status: downstreamResult && success ? "SUCCESS" : "FAILED",
        startedAt,
        finishedAt,
        errorCode: !success ? overrides?.errorCode || "BACKGROUND_REJECTED" : undefined,
        errorMessage: !success ? errorMessage : undefined,
        details: downstreamResult && typeof downstreamResult === "object" ? (downstreamResult as Record<string, unknown>) : undefined
      }
    ]
  }

  const results = Array.isArray(rawResult.results) ? (rawResult.results as PublishExecutionItem[]) : []
  const successCount = stages.filter((stage) => stage.status === "SUCCESS").length
  const explicitFailure =
    rawResult.status === "FAILED" ||
    rawResult.success === false ||
    typeof rawResult.errorMessage === "string" ||
    typeof rawResult.error === "string" ||
    !!overrides?.errorCode ||
    !!overrides?.errorMessage
  const failureCount = stages.length - successCount || (explicitFailure ? 1 : 0)

  return {
    kind: "chain-action",
    status: failureCount === 0 ? "COMPLETED" : "FAILED",
    totalPlatforms: stages.length,
    successCount,
    failureCount,
    results,
    stages,
    errorCode:
      overrides?.errorCode || (typeof rawResult.errorCode === "string" ? rawResult.errorCode : undefined),
    errorMessage:
      overrides?.errorMessage || (typeof rawResult.errorMessage === "string" ? rawResult.errorMessage : undefined)
  }
}

function attachPersistFailureToChain(
  result: ChainActionExecutionResult,
  message: string,
): ChainActionExecutionResult {
  return {
    ...result,
    status: "FAILED",
    errorCode: "TASK_RESULT_PERSIST_FAILED",
    errorMessage: message
  }
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
        await new Promise<void>((resolve) => {
          if (document.readyState === "complete") resolve()
          else window.addEventListener("load", () => resolve(), { once: true })
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

function emitRuntimeMessage(action: string, data: unknown) {
  const sendMessage = chrome.runtime.sendMessage
  if (typeof sendMessage !== "function") return
  void sendMessage({ action, data }).catch(() => undefined)
}

const publishPlatformTabs = new Map<number, string>()
let currentChainActionData: ChainActionSession | null = null
let currentPublishRequest: PublishSession | null = null
const publishSessions = new Map<string, PublishSession>()
const PUBLISH_POPUP_INIT_TIMEOUT_MS = 30_000
const STALE_PUBLISH_SESSION_TIMEOUT_MS = 60_000

function getPublishSession(traceId?: string | null) {
  if (!traceId) return null
  return publishSessions.get(traceId) || null
}

function cleanupPublishSession(session: PublishSession) {
  if (session.popupInitTimeoutId) {
    clearTimeout(session.popupInitTimeoutId)
    session.popupInitTimeoutId = undefined
  }
  for (const state of session.platforms.values()) {
    if (typeof state.tabId === "number") {
      publishPlatformTabs.delete(state.tabId)
    }
    if (state.timeoutId) {
      clearTimeout(state.timeoutId)
      state.timeoutId = undefined
    }
  }
}

function getPublishPlatformTabIds(session: PublishSession) {
  return [...new Set(
    [...session.platforms.values()]
      .map((state) => state.tabId)
      .filter((tabId): tabId is number => typeof tabId === "number"),
  )]
}

function detachPublishSession(session: PublishSession) {
  if (currentPublishRequest?.traceId === session.traceId) {
    currentPublishRequest = null
  }
  publishSessions.delete(session.traceId)
}

async function closeTabIfExists(tabId?: number) {
  if (typeof tabId !== "number") return

  try {
    await chrome.tabs.get(tabId)
  } catch {
    return
  }

  try {
    await chrome.tabs.remove(tabId)
  } catch {
    // ignore already-closed tabs
  }
}

async function closeWindowIfExists(windowId?: number) {
  if (typeof windowId !== "number") return

  try {
    await chrome.windows.get(windowId)
  } catch {
    return
  }

  try {
    await chrome.windows.remove(windowId)
  } catch {
    // ignore already-closed windows
  }
}

async function closePublishSessionResources(
  session: PublishSession,
  options?: { closePlatforms?: boolean },
) {
  const closePlatforms = options?.closePlatforms === true
  const tabIdsToClose = new Set<number>()

  if (typeof session.popupTabId === "number") {
    tabIdsToClose.add(session.popupTabId)
  }

  if (typeof session.sourceWebTabId === "number") {
    tabIdsToClose.add(session.sourceWebTabId)
  }

  if (closePlatforms) {
    for (const tabId of getPublishPlatformTabIds(session)) {
      tabIdsToClose.add(tabId)
    }
  }

  await closeWindowIfExists(session.popupWindowId)

  for (const tabId of tabIdsToClose) {
    await closeTabIfExists(tabId)
  }

  cleanupPublishSession(session)
  detachPublishSession(session)
}

function emitPublishProgress(session: PublishSession) {
  const states = session.platformOrder
    .map((platformName) => session.platforms.get(platformName))
    .filter(Boolean) as PublishPlatformState[]
  emitRuntimeMessage("MUTLIPOST_EXTENSION_PUBLISH_PROGRESS", {
    traceId: session.traceId,
    status: session.finalized ? buildPublishExecutionResult(session).status : "RUNNING",
    totalPlatforms: states.length,
    successCount: states.filter((item) => item.status === "success").length,
    failureCount: states.filter((item) => item.status === "failed" || item.status === "timeout").length,
    results: states.map((item) => ({
      platformName: item.platformName,
      status: item.status,
      publishUrl: item.publishUrl,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
      tabId: item.tabId
    }))
  })
}

function setPlatformTimeout(session: PublishSession, platformName: string, timeoutMs: number) {
  const state = session.platforms.get(platformName)
  if (!state) return

  if (state.timeoutId) clearTimeout(state.timeoutId)
  state.timeoutId = setTimeout(() => {
    void markPublishPlatformResult({
      traceId: session.traceId,
      platformName,
      success: false,
      errorCode: "PLATFORM_TIMEOUT",
      errorMessage: `Platform timed out after ${timeoutMs}ms`,
      tabId: state.tabId,
      timestamp: Date.now(),
      isTimeout: true
    })
  }, timeoutMs) as unknown as number
}

function markPublishPlatformRunning(session: PublishSession, platformName: string, tabId?: number) {
  const state = session.platforms.get(platformName)
  if (!state || isTerminalStatus(state.status)) return

  state.status = "running"
  state.startedAt = state.startedAt || nowIso()
  state.tabId = tabId
  if (typeof tabId === "number") {
    publishPlatformTabs.set(tabId, platformName)
  }
  const timeoutMs = platformName.includes("YUNPAN") ? 300_000 : 180_000
  setPlatformTimeout(session, platformName, timeoutMs)
  emitPublishProgress(session)
}

function getTrackedPublishPlatformState(tabId: number) {
  if (!currentPublishRequest) return null
  const platformName = publishPlatformTabs.get(tabId)
  if (!platformName) return null

  const state = currentPublishRequest.platforms.get(platformName)
  if (!state || isTerminalStatus(state.status)) {
    publishPlatformTabs.delete(tabId)
    return null
  }

  const platformInfo = currentPublishRequest.syncData.platforms.find((item) => item.name === state.platformName)
  return { session: currentPublishRequest, state, platformInfo }
}

async function maybeMarkPublishFailureFromUrl(tabId: number, currentUrl?: string) {
  if (!currentUrl) return

  const tracked = getTrackedPublishPlatformState(tabId)
  if (!tracked) return

  const failure = getPublishFailureForUrl(
    tracked.platformInfo
      ? {
          name: tracked.platformInfo.name,
          injectUrl: tracked.platformInfo.injectUrl || currentUrl
        }
      : { injectUrl: currentUrl },
    currentUrl,
  )

  if (!failure) return

  await markPublishPlatformResult({
    traceId: tracked.session.traceId,
    platformName: tracked.state.platformName,
    success: false,
    publishUrl: currentUrl,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
    tabId,
    timestamp: Date.now()
  })
}

async function finalizePublishSession(
  session: PublishSession,
  overrides?: { errorCode?: string; errorMessage?: string },
) {
  if (session.finalized) return session
  session.finalized = true

  const finalTime = nowIso()
  for (const state of session.platforms.values()) {
    if (!isTerminalStatus(state.status)) {
      state.status = overrides?.errorCode ? "failed" : "timeout"
      state.errorCode = overrides?.errorCode || "PLATFORM_TIMEOUT"
      state.errorMessage = overrides?.errorMessage || "Platform did not report a terminal result"
      state.finishedAt = finalTime
    }
  }

  let result = buildPublishExecutionResult(session, overrides)

  if (currentPublishRequest?.traceId === session.traceId) {
    currentPublishRequest = null
  }

  cleanupPublishSession(session)

  if (session.taskId) {
    const { extensionClientId } = await getExtensionLinkState()
    try {
      await reportTaskResult({
        taskId: session.taskId,
        extensionClientId,
        status: result.status,
        errorMessage: result.errorMessage,
        executionResult: result
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result = attachPersistFailureToPublish(result, message)
    }
  }

  emitRuntimeMessage("MUTLIPOST_EXTENSION_PUBLISH_COMPLETE", result)
  try {
    session.deferred.resolve(result)
  } catch {
    // ignore multiple resolve or detached caller
  }
  return session
}

async function markPublishPlatformResult(result: {
  traceId?: string
  platformName: string
  success: boolean
  publishUrl?: string
  errorCode?: string
  errorMessage?: string
  tabId?: number
  timestamp?: number
  isTimeout?: boolean
}) {
  const trackedByTab = typeof result.tabId === "number" ? getTrackedPublishPlatformState(result.tabId) : null
  const session = getPublishSession(result.traceId) || trackedByTab?.session
  if (!session) return { success: false, error: "NO_PUBLISH_IN_PROGRESS" }

  if (result.traceId && result.traceId !== session.traceId) {
    return { success: false, error: "NO_PUBLISH_IN_PROGRESS" }
  }

  const state = session.platforms.get(result.platformName || trackedByTab?.state.platformName || "")
  if (!state) return { success: false, error: "UNKNOWN_PLATFORM" }
  if (isTerminalStatus(state.status)) return { success: true, ignored: true }

  if (state.timeoutId) {
    clearTimeout(state.timeoutId)
    state.timeoutId = undefined
  }

  state.status = result.success ? "success" : result.isTimeout ? "timeout" : "failed"
  state.publishUrl = result.publishUrl
  state.errorCode = result.success ? undefined : result.errorCode || "BACKGROUND_REJECTED"
  state.errorMessage = result.success ? undefined : result.errorMessage || "Publish failed"
  state.tabId = result.tabId ?? state.tabId
  if (typeof state.tabId === "number") {
    publishPlatformTabs.delete(state.tabId)
  }
  state.finishedAt = nowIso()
  if (!state.startedAt) state.startedAt = state.finishedAt

  emitPublishProgress(session)

  const allTerminal = [...session.platforms.values()].every((item) => isTerminalStatus(item.status))
  if (allTerminal) {
    await finalizePublishSession(session)
  }

  return { success: true }
}

async function abortPublish(traceId: string | undefined, errorCode: string, errorMessage: string) {
  const session = getPublishSession(traceId)
  if (!session) return { success: false, error: "NO_PUBLISH_IN_PROGRESS" }
  await finalizePublishSession(session, { errorCode, errorMessage })
  return { success: true }
}

async function popupWindowExists(windowId?: number) {
  if (!windowId) return false
  try {
    await chrome.windows.get(windowId)
    return true
  } catch {
    return false
  }
}

async function tabExists(tabId?: number) {
  if (!tabId) return false
  try {
    await chrome.tabs.get(tabId)
    return true
  } catch {
    return false
  }
}

async function recoverStalePublishSessions() {
  if (!currentPublishRequest || currentPublishRequest.finalized) return

  const session = currentPublishRequest
  const ageMs = Date.now() - session.createdAt
  const hasStartedPlatform = [...session.platforms.values()].some((item) => item.status !== "pending")
  const hasLivePlatformTab = (
    await Promise.all(
      [...session.platforms.values()]
        .map((item) => item.tabId)
        .filter((id): id is number => typeof id === "number")
        .map((tabId) => tabExists(tabId)),
    )
  ).some(Boolean)
  const [hasLivePopupWindow, hasLivePopupTab] = await Promise.all([
    popupWindowExists(session.popupWindowId),
    tabExists(session.popupTabId),
  ])
  const hasLivePopup = hasLivePopupWindow || hasLivePopupTab

  const shouldRecover =
    (!hasStartedPlatform && !hasLivePopup) ||
    (!hasStartedPlatform && ageMs > STALE_PUBLISH_SESSION_TIMEOUT_MS) ||
    (!hasLivePopup && !hasLivePlatformTab && ageMs > STALE_PUBLISH_SESSION_TIMEOUT_MS)

  if (shouldRecover) {
    await finalizePublishSession(session, {
      errorCode: "STALE_PUBLISH_SESSION",
      errorMessage: "Recovered stale publish session",
    })
  }
}

async function ensureLinkedIfTask(taskId?: string) {
  if (!taskId) return null
  const { isLinked } = await getExtensionLinkState()
  if (isLinked) return null

  return {
    success: false,
    error: "EXTENSION_NOT_LINKED",
    errorCode: "EXTENSION_NOT_LINKED"
  }
}

async function finalizeChainActionResult(rawResult: Record<string, unknown>) {
  if (!currentChainActionData || currentChainActionData.finalized) return null
  const session = currentChainActionData
  session.finalized = true

  let result = buildChainActionResult(rawResult, session.action, session.startedAt)
  if (session.taskId) {
    const { extensionClientId } = await getExtensionLinkState()
    try {
      await reportTaskResult({
        taskId: session.taskId,
        extensionClientId,
        status: result.status,
        errorMessage: result.errorMessage,
        executionResult: result
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result = attachPersistFailureToChain(result, message)
    }
  }

  session.deferred.resolve(result)
  currentChainActionData = null
  return result
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: "https://multipost.app/on-install" })
  }
  void initDefaultTrustedDomains()
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  tabsManagerHandleTabUpdated(tabId, changeInfo, tab)
  if (changeInfo.status === "complete") {
    void maybeMarkPublishFailureFromUrl(tabId, changeInfo.url || tab.url)
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  tabsManagerHandleTabRemoved(tabId)

  const publishPopupSession = currentPublishRequest?.popupTabId === tabId ? currentPublishRequest : null
  if (publishPopupSession && !publishPopupSession.finalized) {
    const hasStartedPlatform = [...publishPopupSession.platforms.values()].some((item) => item.status !== "pending")
    if (!hasStartedPlatform) {
      void abortPublish(
        publishPopupSession.traceId,
        "PUBLISH_WINDOW_CLOSED",
        "Publish window closed before execution started",
      )
      return
    }
  }

  const tracked = getTrackedPublishPlatformState(tabId)
  if (!tracked) return

  void markPublishPlatformResult({
    traceId: tracked.session.traceId,
    platformName: tracked.state.platformName,
    success: false,
    errorCode: "TAB_CLOSED",
    errorMessage: "Platform tab was closed before a terminal result was reported",
    tabId,
    timestamp: Date.now()
  })
})

chrome.windows.onRemoved.addListener((windowId) => {
  const session = currentPublishRequest?.popupWindowId === windowId ? currentPublishRequest : null
  if (!session || session.finalized) return

  const hasStartedPlatform = [...session.platforms.values()].some((item) => item.status !== "pending")
  if (!hasStartedPlatform) {
    void abortPublish(session.traceId, "PUBLISH_WINDOW_CLOSED", "Publish window closed before execution started")
  }
})

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

router.register("MUTLIPOST_EXTENSION_CHECK_SERVICE_STATUS", async () => ({
  extensionId: chrome.runtime.id
}))

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

router.register("MUTLIPOST_EXTENSION_REQUEST_PUBLISH_RELOAD", (req) => handleTabsManagerMessage(req as any))
router.register("MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_TABS", (req) => handleTabsManagerMessage(req as any))
router.register("MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_ADD_TABS", (req) => handleTabsManagerMessage(req as any))

router.register("MUTLIPOST_EXTENSION_GET_TRUSTED_DOMAINS", (req, sender) => handleTrustDomainMessage(req as any, sender))
router.register("MUTLIPOST_EXTENSION_DELETE_TRUSTED_DOMAIN", (req, sender) => handleTrustDomainMessage(req as any, sender))
router.register("MUTLIPOST_EXTENSION_REQUEST_TRUST_DOMAIN", (req, sender) => handleTrustDomainMessage(req as any, sender))
router.register("MUTLIPOST_EXTENSION_LINK_EXTENSION", (req) => handleLinkExtensionMessage(req as any))

router.register("MUTLIPOST_EXTENSION_CLOSE_SOURCE_TAB", async (_request: any, sender) => {
  const senderTabId = sender.tab?.id
  if (typeof senderTabId !== "number") {
    return { success: false, error: "SOURCE_TAB_NOT_FOUND", errorCode: "SOURCE_TAB_NOT_FOUND" }
  }

  try {
    await chrome.tabs.remove(senderTabId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "SOURCE_TAB_CLOSE_FAILED"
    }
  }
})

router.register("MUTLIPOST_EXTENSION_CLOSE_PUBLISH_SESSION", async (request: any) => {
  const traceId = request.data?.traceId as string | undefined
  const closePlatforms = request.data?.closePlatforms === true
  const session = getPublishSession(traceId)
  if (!session) {
    return { success: true, ignored: true }
  }

  void closePublishSessionResources(session, { closePlatforms })
  return { success: true }
})

router.register("MUTLIPOST_EXTENSION_PUBLISH", async (request: any, sender) => {
  await recoverStalePublishSessions()

  if (currentPublishRequest && !currentPublishRequest.finalized) {
    return {
      success: false,
      error: "PUBLISH_ALREADY_IN_PROGRESS",
      errorCode: "PUBLISH_ALREADY_IN_PROGRESS"
    }
  }

  const traceId = request.traceId || crypto.randomUUID()
  const data = {
    ...(request.data as SyncData),
    traceId
  }
  if (data.taskId) {
    const linkError = await ensureLinkedIfTask(data.taskId)
    if (linkError) return linkError
  }

  const deferred = createDeferred<PublishExecutionResult>()
  const platformOrder = data.platforms.map((platform) => platform.name)
  const startedAt = nowIso()
  const platforms = new Map<string, PublishPlatformState>(
    platformOrder.map((platformName) => [
      platformName,
      {
        platformName,
        status: "pending",
        startedAt
      }
    ]),
  )

  const session: PublishSession = {
    traceId,
    taskId: data.taskId,
    syncData: data,
    createdAt: Date.now(),
    platformOrder,
    platforms,
    deferred,
    sourceWebTabId: sender.tab?.id,
    popupReady: false,
    finalized: false
  }

  currentPublishRequest = session
  publishSessions.set(session.traceId, session)
  session.popupInitTimeoutId = setTimeout(() => {
    void abortPublish(session.traceId, "PUBLISH_WINDOW_TIMEOUT", "Publish window did not initialize in time")
  }, PUBLISH_POPUP_INIT_TIMEOUT_MS) as unknown as number

  try {
    const popupUrl = new URL(chrome.runtime.getURL("tabs/publish.html"))
    popupUrl.searchParams.set("traceId", session.traceId)
    try {
      const popupWindow = await createSafePopupWindow({
        url: popupUrl.toString(),
        width: 800,
        height: 600
      })
      session.popupWindowId = popupWindow.id
    } catch (error) {
      if (!isBoundsWindowCreateError(error)) {
        throw error
      }

      const popupTab = await chrome.tabs.create({
        url: popupUrl.toString(),
        active: true
      })
      session.popupTabId = popupTab.id
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    currentPublishRequest = null
    publishSessions.delete(session.traceId)
    cleanupPublishSession(session)
    return {
      success: false,
      error: message,
      errorCode: "PUBLISH_WINDOW_CREATE_FAILED"
    }
  }

  emitPublishProgress(session)
  return {
    traceId,
    status: "STARTED"
  }
})

router.register("MUTLIPOST_EXTENSION_PUBLISH_RESULT", async (request: any) => {
  const result = request.data || {}
  return markPublishPlatformResult({
    traceId: result.traceId,
    platformName: result.platformName,
    success: result.success === true,
    publishUrl: result.publishUrl,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    tabId: result.tabId,
    timestamp: result.timestamp
  })
})

router.register("MUTLIPOST_EXTENSION_PUBLISH_ABORT", async (request: any) => {
  const result = request.data || {}
  return abortPublish(
    result.traceId,
    result.errorCode || "ASSET_PREFLIGHT_FAILED",
    result.errorMessage || "Asset preflight failed",
  )
})

router.register("MUTLIPOST_EXTENSION_PUBLISH_REQUEST_SYNC_DATA", async (request: any) => {
  const traceId = request.data?.traceId
  const session = getPublishSession(traceId)
  if (!session) {
    return { syncData: null }
  }

  if (session.popupInitTimeoutId) {
    clearTimeout(session.popupInitTimeoutId)
    session.popupInitTimeoutId = undefined
  }
  session.popupReady = true

  return { syncData: session.syncData }
})

router.register("MUTLIPOST_EXTENSION_PUBLISH_NOW", async (request: any) => {
  const traceId = request.data?.traceId as string | undefined
  const session = getPublishSession(traceId)
  if (!session) {
    return { success: false, error: "NO_PUBLISH_IN_PROGRESS", errorCode: "BACKGROUND_REJECTED" }
  }

  const data = (request.data?.syncData || request.data) as SyncData
  if (!Array.isArray(data.platforms) || data.platforms.length === 0) {
    return { success: false, error: "NO_PLATFORMS", errorCode: "BACKGROUND_REJECTED" }
  }

  try {
    session.syncData = data
    const tabs = await createTabsForPlatforms(data)
    addTabsManagerMessages({
      syncData: data,
      tabs: tabs.map((item) => ({ tab: item.tab, platformInfo: item.platformInfo }))
    })

    for (const item of tabs) {
      markPublishPlatformRunning(session, item.platformInfo.name, item.tab.id)
      if (item.tab.id) {
        const latestTab = await chrome.tabs.get(item.tab.id).catch(() => item.tab)
        await maybeMarkPublishFailureFromUrl(item.tab.id, latestTab?.url || item.tab.url)
      }
    }

    return {
      tabs: tabs.map((item) => ({ tab: item.tab, platformInfo: item.platformInfo }))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await abortPublish(traceId, "SCRIPT_INJECTION_FAILED", message)
    return {
      success: false,
      error: message,
      errorCode: "SCRIPT_INJECTION_FAILED"
    }
  }
})

router.register("MUTLIPOST_EXTENSION_CHAIN_ACTION", async (request: any) => {
  if (currentChainActionData) {
    return {
      success: false,
      error: "CHAIN_ACTION_ALREADY_IN_PROGRESS",
      errorCode: "CHAIN_ACTION_ALREADY_IN_PROGRESS"
    }
  }

  const taskId = request.data?.taskId as string | undefined
  if (taskId) {
    const linkError = await ensureLinkedIfTask(taskId)
    if (linkError) return linkError
  }

  const deferred = createDeferred<ChainActionExecutionResult>()
  currentChainActionData = {
    action: request.data?.action,
    config: request.data?.config,
    traceId: request.traceId,
    taskId,
    deferred,
    startedAt: nowIso(),
    finalized: false
  }

  void createSafePopupWindow({
    url: chrome.runtime.getURL("tabs/chain-action.html"),
    width: 800,
    height: 600
  })

  return deferred.promise
})

router.register("MUTLIPOST_EXTENSION_CHAIN_ACTION_REQUEST_DATA", async () => ({
  config: currentChainActionData
}))

router.register("MUTLIPOST_EXTENSION_CHAIN_ACTION_COMPLETE", async (request: any) => {
  if (!currentChainActionData) {
    return { success: false, error: "NO_CHAIN_ACTION_IN_PROGRESS", errorCode: "BACKGROUND_REJECTED" }
  }

  const result = await finalizeChainActionResult((request.data || {}) as Record<string, unknown>)
  if (!result) {
    return { success: false, error: "NO_CHAIN_ACTION_IN_PROGRESS", errorCode: "BACKGROUND_REJECTED" }
  }

  return { success: true, data: result }
})

router.register("MUTLIPOST_EXTENSION_PLATFORMS", async () => {
  const platforms = await getPlatformInfos()
  return { platforms }
})

router.register("MUTLIPOST_EXTENSION_GET_ACCOUNT_INFOS", async () => {
  const { getAllAccountInfo } = await import("~sync/account")
  const accountInfo = await getAllAccountInfo()
  return { accountInfo }
})

router.register("MUTLIPOST_EXTENSION_OPEN_OPTIONS", async () => {
  await chrome.runtime.openOptionsPage()
  return { extensionId: chrome.runtime.id }
})

router.register("MUTLIPOST_EXTENSION_REFRESH_ACCOUNT_INFOS", async (request: any) => {
  await createSafePopupWindow({
    url: chrome.runtime.getURL("tabs/refresh-accounts.html"),
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
