import type { FileOperation, ShareConfig, ShareResult } from "../file-ops/types"

import type { SyncData } from "~sync/common"
import type { ChainActionExecutionResult, ChainActionStageResult, PublishExecutionResult } from "~types/execution"

type StageRuntime = {
  stageName: string
  startedAt: string
}

export interface BaiduShareConfig {
  paths: string[]
  shareConfig: ShareConfig
}

export interface ChainPublishOptions {
  traceIdPrefix: string
  stageName: string
  buildSyncData: (shareResult: ShareResult) => SyncData
  publishFailureMessage: string
}

function nowIso() {
  return new Date().toISOString()
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function toErrorCode(message: string, fallback = "BACKGROUND_REJECTED") {
  return /^[A-Z0-9_]+$/.test(message) ? message : fallback
}

function finalizeStage(
  stage: StageRuntime,
  status: ChainActionStageResult["status"],
  details?: Record<string, unknown>,
  errorCode?: string,
  errorMessage?: string,
): ChainActionStageResult {
  return {
    stageName: stage.stageName,
    status,
    startedAt: stage.startedAt,
    finishedAt: nowIso(),
    errorCode,
    errorMessage,
    details
  }
}

async function waitForTabLoad(tabId: number) {
  await new Promise<void>((resolve) => {
    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }

    chrome.tabs.onUpdated.addListener(listener)
  })
}

async function getBaiduShareLink(config: BaiduShareConfig): Promise<ShareResult> {
  const tab = await chrome.tabs.create({
    url: "https://pan.baidu.com/disk/home",
    active: false
  })

  if (!tab.id) {
    throw new Error("BAIDU_TAB_CREATE_FAILED")
  }

  try {
    await waitForTabLoad(tab.id)

    const operation: FileOperation = {
      platform: "baiduyun",
      operation: "share",
      params: {
        paths: config.paths,
        shareConfig: config.shareConfig
      }
    }

    const result = await chrome.runtime.sendMessage({
      action: "EXECUTE_FILE_OPERATION",
      tabId: tab.id,
      operation
    })

    if (!result?.success || !result?.data) {
      throw new Error(result?.error || "BAIDUYUN_SHARE_RESULT_INVALID")
    }

    const shareResult = result.data as ShareResult
    if (!shareResult?.shareUrl || !shareResult.shareUrl.startsWith("http")) {
      throw new Error("BAIDUYUN_SHARE_RESULT_INVALID")
    }

    return shareResult
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => undefined)
  }
}

async function publishToPlatform(options: ChainPublishOptions, shareResult: ShareResult) {
  return chrome.runtime.sendMessage({
    action: "MUTLIPOST_EXTENSION_PUBLISH",
    traceId: `${options.traceIdPrefix}-${Date.now()}`,
    data: options.buildSyncData(shareResult)
  }) as Promise<PublishExecutionResult>
}

export async function executeBaiduSharePublishChain(
  baiduShare: BaiduShareConfig,
  publishOptions: ChainPublishOptions,
): Promise<ChainActionExecutionResult> {
  const baiduStage: StageRuntime = { stageName: "baiduShare", startedAt: nowIso() }
  const publishStage: StageRuntime = { stageName: publishOptions.stageName, startedAt: nowIso() }
  const stages: ChainActionStageResult[] = []
  let publishResult: PublishExecutionResult | undefined

  try {
    const shareResult = await getBaiduShareLink(baiduShare)
    stages.push(finalizeStage(baiduStage, "SUCCESS", shareResult as unknown as Record<string, unknown>))

    publishResult = await publishToPlatform(publishOptions, shareResult)
    if (publishResult.status !== "COMPLETED") {
      stages.push(
        finalizeStage(
          publishStage,
          "FAILED",
          { publishResult },
          publishResult.errorCode,
          publishResult.errorMessage || publishOptions.publishFailureMessage,
        ),
      )

      return {
        kind: "chain-action",
        status: "FAILED",
        totalPlatforms: 2,
        successCount: 1,
        failureCount: 1,
        results: publishResult.results,
        stages,
        errorCode: publishResult.errorCode,
        errorMessage: publishResult.errorMessage || publishOptions.publishFailureMessage
      }
    }

    stages.push(finalizeStage(publishStage, "SUCCESS", { publishResult }))
    return {
      kind: "chain-action",
      status: "COMPLETED",
      totalPlatforms: 2,
      successCount: 2,
      failureCount: 0,
      results: publishResult.results,
      stages
    }
  } catch (error) {
    const message = toErrorMessage(error)
    const errorCode = toErrorCode(message)

    if (stages.length === 0) {
      stages.push(finalizeStage(baiduStage, "FAILED", undefined, errorCode, message))
      stages.push(
        finalizeStage(
          publishStage,
          "FAILED",
          undefined,
          "UPSTREAM_STAGE_FAILED",
          `${publishOptions.stageName} stage not started`,
        ),
      )
    } else if (stages.length === 1) {
      stages.push(finalizeStage(publishStage, "FAILED", { publishResult }, errorCode, message))
    }

    const successCount = stages.filter((stage) => stage.status === "SUCCESS").length

    return {
      kind: "chain-action",
      status: "FAILED",
      totalPlatforms: 2,
      successCount,
      failureCount: 2 - successCount,
      results: publishResult?.results || [],
      stages,
      errorCode,
      errorMessage: message
    }
  }
}

export function createDefaultShareConfig(): ShareConfig {
  return {
    validPeriod: "7天",
    extractCodeType: "随机生成"
  }
}
