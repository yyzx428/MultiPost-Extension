import "~style.css"

import { Storage } from "@plasmohq/storage"
import { Button, HeroUIProvider, NumberInput, Progress, Switch, Tooltip } from "@heroui/react"
import { RefreshCw, X } from "lucide-react"
import React, { useEffect, useMemo, useRef, useState } from "react"

import cssText from "data-text:~style.css"

import type { PublishExecutionResult } from "~types/execution"
import {
  type ArticleData,
  type DynamicData,
  type FileData,
  injectScriptsToTabs,
  type PodcastData,
  type ShangPinData,
  type SyncData,
  type SyncDataPlatform,
  type VideoData,
  type YunPanData
} from "~sync/common"
import { prepareFileStrict, prepareFilesStrict } from "./publish-assets"

const storage = new Storage({ area: "local" })

const AUTO_CLOSE_KEY = "publish-auto-close"
const AUTO_CLOSE_DELAY_KEY = "publish-auto-close-delay"
const SYNC_CLOSE_TABS_KEY = "publish-sync-close-tabs"
const DEFAULT_AUTO_CLOSE_DELAY = 120
const MIN_AUTO_CLOSE_DELAY = 5

const PLATFORM_MESSAGE_KEY_MAP: Record<string, string> = {
  AGISO: "platformAgiso",
  BAIDUYUN: "platformBaiduYun",
  BAIJIAHAO: "platformBaijiahao",
  BILIBILI: "platformBilibili",
  BLUESKY: "platformBluesky",
  DOUYIN: "platformDouyin",
  EASTMONEY: "platformEastmoney",
  REDNOTE: "platformRednote",
  TOUTIAO: "platformToutiao",
  WEIBO: "platformWeibo",
  WEIXIN: "platformWeixin",
  X: "platformX"
}

function t(key: string, fallback: string, substitutions?: string | number | Array<string | number>) {
  const payload =
    substitutions === undefined
      ? undefined
      : Array.isArray(substitutions)
        ? substitutions.map((item) => String(item))
        : String(substitutions)

  const message = chrome.i18n.getMessage(key, payload as string | string[] | undefined)
  return message || fallback
}

function formatPlatformName(platformName: string) {
  const tokens = platformName
    .split("_")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .reverse()

  const localeKey = tokens.map((token) => PLATFORM_MESSAGE_KEY_MAP[token]).find(Boolean)
  return localeKey ? t(localeKey, platformName) : platformName
}

function formatStatusLabel(status: PlatformProgressItem["status"] | PublishProgressPayload["status"]) {
  switch (status) {
    case "pending":
      return t("publishStatusPending", "等待中")
    case "running":
    case "RUNNING":
      return t("publishStatusRunning", "执行中")
    case "success":
    case "SUCCESS":
    case "COMPLETED":
      return t("publishStatusSuccess", "成功")
    case "failed":
    case "FAILED":
      return t("publishStatusFailed", "失败")
    case "timeout":
    case "TIMEOUT":
      return t("publishStatusTimeout", "超时")
    default:
      return status
  }
}

function formatErrorMessage(item: Pick<PlatformProgressItem, "platformName" | "errorCode" | "errorMessage">) {
  const platformLabel = formatPlatformName(item.platformName)
  switch (item.errorCode) {
    case "LOGIN_REQUIRED":
      return t("publishErrorLoginRequired", "$1 需要先登录", platformLabel)
    case "ASSET_PREFLIGHT_FAILED":
      return t("publishErrorAssetPreflightFailed", "资源预处理失败")
    case "SCRIPT_INJECTION_FAILED":
      return t("publishErrorScriptInjectionFailed", "脚本注入失败")
    case "PLATFORM_TIMEOUT":
      return t("publishErrorPlatformTimeout", "平台执行超时")
    case "TAB_CLOSED":
      return t("publishErrorTabClosed", "平台标签页已关闭")
    case "REDNOTE_NO_SUCCESS_SIGNAL":
      return t("publishErrorNoSuccessSignal", "未检测到平台成功信号")
    case "BAIDUYUN_SHARE_RESULT_INVALID":
      return t("publishErrorBaiduShareInvalid", "百度云分享结果无效")
    case "TASK_RESULT_PERSIST_FAILED":
      return t("publishErrorPersistFailed", "结果回写失败")
    default:
      return item.errorMessage
  }
}

function createPublishStartError(message: string, code?: string) {
  const error = new Error(message)
  if (code) error.name = code
  return error
}

function normalizeAutoCloseDelay(value: unknown) {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? parseInt(value, 10) : Number.NaN

  if (!Number.isFinite(parsed) || parsed < MIN_AUTO_CLOSE_DELAY) {
    return DEFAULT_AUTO_CLOSE_DELAY
  }

  return parsed
}

type PlatformProgressItem = {
  platformName: string
  status: "pending" | "running" | "success" | "failed" | "timeout" | "SUCCESS" | "FAILED" | "TIMEOUT"
  publishUrl?: string
  errorCode?: string
  errorMessage?: string
  startedAt?: string
  finishedAt?: string
  tabId?: number
}

type PublishProgressPayload = {
  traceId?: string
  status: "RUNNING" | "COMPLETED" | "FAILED"
  totalPlatforms: number
  successCount: number
  failureCount: number
  results: PlatformProgressItem[]
}

export function getShadowContainer() {
  return document.querySelector("#test-shadow")?.shadowRoot?.querySelector("#plasmo-shadow-container")
}

export const getShadowHostId = () => "test-shadow"

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

function getTitleFromData(data: SyncData) {
  const contentData = data.data
  if ("content" in contentData) return contentData.title || contentData.content
  return contentData.title
}

async function processArticle(data: SyncData): Promise<SyncData> {
  const content = data.data as ArticleData
  const parser = new DOMParser()
  const doc = parser.parseFromString(content.htmlContent, "text/html")
  const imgElements = Array.from(doc.getElementsByTagName("img"))
  const processedImages: FileData[] = []
  let processedMarkdownContent = content.markdownContent

  for (const img of imgElements) {
    const originalUrl = img.src
    if (!originalUrl || originalUrl.startsWith("blob:")) continue

    const sourceFile =
      content.images?.find((item) => item.url === originalUrl) ||
      ({ name: originalUrl.split("/").pop() || "image", url: originalUrl } satisfies FileData)
    const processed = await prepareFileStrict(sourceFile, { inlineMode: "always" })
    img.src = processed.url
    processedImages.push(processed)

    const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    processedMarkdownContent = processedMarkdownContent.replace(new RegExp(escapedUrl, "g"), processed.url)
  }

  return {
    ...data,
    data: {
      ...content,
      htmlContent: doc.documentElement.outerHTML,
      markdownContent: processedMarkdownContent,
      images: processedImages,
      cover: await prepareFileStrict(content.cover, { inlineMode: "always" })
    }
  }
}

async function processDynamic(data: SyncData): Promise<SyncData> {
  const content = data.data as DynamicData
  const images = await prepareFilesStrict(content.images || [], { inlineMode: "always" })
  const videos = await prepareFilesStrict(content.videos || [], { inlineMode: "unsafe-only" })
  return {
    ...data,
    data: {
      ...content,
      images,
      videos
    }
  }
}

async function processPodcast(data: SyncData): Promise<SyncData> {
  const content = data.data as PodcastData
  return {
    ...data,
    data: {
      ...content,
      audio: await prepareFileStrict(content.audio, { inlineMode: "unsafe-only" })
    }
  }
}

async function processVideo(data: SyncData): Promise<SyncData> {
  const content = data.data as VideoData
  return {
    ...data,
    data: {
      ...content,
      video: await prepareFileStrict(content.video, { inlineMode: "unsafe-only" })
    }
  }
}

async function processYunPan(data: SyncData): Promise<SyncData> {
  const content = data.data as YunPanData
  const files = await prepareFilesStrict(content.files || [], { inlineMode: "always" })

  return {
    ...data,
    data: {
      ...content,
      files
    }
  }
}

async function processShangPin(data: SyncData): Promise<SyncData> {
  const content = data.data as ShangPinData
  return {
    ...data,
    data: {
      ...content,
      files: await prepareFilesStrict(content.files || [], { inlineMode: "always" })
    }
  }
}

export default function Publish() {
  const popupTraceId = useMemo(() => {
    const traceId = new URLSearchParams(window.location.search).get("traceId")
    return traceId || undefined
  }, [])
  const [title, setTitle] = useState<string | null>(null)
  const [notice, setNotice] = useState<string>(() => t("publishPreparingTask", "正在准备发布任务"))
  const [isProcessing, setIsProcessing] = useState(true)
  const [syncData, setSyncData] = useState<SyncData | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [progress, setProgress] = useState<PublishProgressPayload | null>(null)
  const [result, setResult] = useState<PublishExecutionResult | null>(null)
  const [publishedTabs, setPublishedTabs] = useState<Array<{ tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }>>([])
  const [autoClose, setAutoClose] = useState(true)
  const [syncCloseTabs, setSyncCloseTabs] = useState(true)
  const [countdown, setCountdown] = useState(0)
  const [autoCloseDelay, setAutoCloseDelay] = useState(DEFAULT_AUTO_CLOSE_DELAY)
  const autoCloseTimerRef = useRef<number>()
  const countdownTimerRef = useRef<number>()
  const autoCloseDelayRef = useRef(DEFAULT_AUTO_CLOSE_DELAY)
  const syncCloseTabsRef = useRef(false)
  const publishedTabsRef = useRef<Array<{ tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }>>([])
  const syncDataRef = useRef<SyncData | null>(null)

  const platformResults = useMemo(() => {
    if (result?.results?.length) return result.results
    return progress?.results || []
  }, [progress, result])

  function addError(message: string) {
    setErrors((prev) => [...prev, message])
  }

  function clearAutoCloseTimers() {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
  }

  function shouldHandleTrace(traceId?: string) {
    const currentTraceId = syncDataRef.current?.traceId || popupTraceId
    if (!currentTraceId) return true
    return !!traceId && traceId === currentTraceId
  }

  async function startAutoCloseTimer(delaySeconds = autoCloseDelayRef.current) {
    clearAutoCloseTimers()
    setCountdown(delaySeconds)

    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearAutoCloseTimers()
          void handleCloseWindow(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    autoCloseTimerRef.current = window.setTimeout(() => {
      void handleCloseWindow(true)
    }, delaySeconds * 1000)
  }

  async function processContentStrict(data: SyncData) {
    let processed: SyncData = { ...data, origin: data.data }

    if (data.platforms.some((platform) => platform.name.includes("ARTICLE"))) {
      setNotice(t("publishPrefetchArticleAssets", "正在预取文章资源"))
      processed = await processArticle(processed)
    }
    if (data.platforms.some((platform) => platform.name.includes("DYNAMIC"))) {
      setNotice(t("publishPrefetchDynamicAssets", "正在预取图文资源"))
      processed = await processDynamic(processed)
    }
    if (data.platforms.some((platform) => platform.name.includes("VIDEO"))) {
      setNotice(t("publishPrefetchVideoAssets", "正在预取视频资源"))
      processed = await processVideo(processed)
    }
    if (data.platforms.some((platform) => platform.name.includes("PODCAST"))) {
      setNotice(t("publishPrefetchPodcastAssets", "正在预取播客资源"))
      processed = await processPodcast(processed)
    }
    if (data.platforms.some((platform) => platform.name.includes("YUNPAN"))) {
      setNotice(t("publishPrefetchCloudFiles", "正在预取云盘文件"))
      processed = await processYunPan(processed)
    }
    if (data.platforms.some((platform) => platform.name.includes("SHANGPIN"))) {
      setNotice(t("publishPrefetchProductFiles", "正在预取商品资源"))
      processed = await processShangPin(processed)
    }

    return processed
  }

  async function handleReloadTab(tabId?: number) {
    if (!tabId || !syncData) return

    const tabInfo = publishedTabsRef.current.find((item) => item.tab.id === tabId)
    if (!tabInfo) {
      addError(t("publishReloadTabInfoMissing", "找不到要重载的标签页信息"))
      return
    }

    try {
      const updatedTab = await chrome.tabs.update(tabId, {
        url: tabInfo.platformInfo.injectUrl,
        active: true
      })

      await injectScriptsToTabs(
        [{ tab: updatedTab, platformInfo: tabInfo.platformInfo }],
        syncData,
      )

      setPublishedTabs((prev) =>
        prev.map((item) => (item.tab.id === tabId ? { ...item, tab: updatedTab } : item)),
      )
      publishedTabsRef.current = publishedTabsRef.current.map((item) =>
        item.tab.id === tabId ? { ...item, tab: updatedTab } : item,
      )
    } catch (error) {
      addError(error instanceof Error ? error.message : String(error))
    }
  }

  function handleTabClick(tabId?: number) {
    if (!tabId) return
    void chrome.tabs.update(tabId, { active: true })
  }

  async function handleCloseTab(tabId?: number) {
    if (!tabId) return

    try {
      await chrome.tabs.remove(tabId)
      setPublishedTabs((prev) => prev.filter((item) => item.tab.id !== tabId))
      publishedTabsRef.current = publishedTabsRef.current.filter((item) => item.tab.id !== tabId)
    } catch (error) {
      addError(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleCloseAllTabs() {
    const tabIds = publishedTabsRef.current.map((item) => item.tab.id).filter((id): id is number => typeof id === "number")
    if (tabIds.length === 0) return
    await chrome.tabs.remove(tabIds)
    setPublishedTabs([])
    publishedTabsRef.current = []
  }

  async function handleCloseWindow(shouldCloseTabs = false) {
    if (shouldCloseTabs || syncCloseTabsRef.current) {
      await handleCloseAllTabs()
    }
    window.close()
  }

  async function requestPublishNow(processedData: SyncData) {
    setNotice(t("publishOpeningPlatformTabs", "正在打开平台标签页"))
    const response = await chrome.runtime.sendMessage({
      action: "MUTLIPOST_EXTENSION_PUBLISH_NOW",
      data: {
        traceId: popupTraceId || processedData.traceId,
        syncData: processedData
      }
    })

    if (response?.success === false) {
      throw createPublishStartError(
        response.error || "PUBLISH_START_FAILED",
        response.errorCode || "PUBLISH_START_FAILED",
      )
    }

    const tabs = (response?.tabs || []) as Array<{ tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }>
    setPublishedTabs(tabs)
    publishedTabsRef.current = tabs
    setNotice(t("publishingInProgress", "正在发布..."))
  }

  useEffect(() => {
    return () => clearAutoCloseTimers()
  }, [])

  useEffect(() => {
    Promise.all([
      storage.get(AUTO_CLOSE_KEY),
      storage.get(AUTO_CLOSE_DELAY_KEY),
      storage.get(SYNC_CLOSE_TABS_KEY)
    ]).then(async ([storedAutoClose, storedDelay, storedSyncCloseTabs]) => {
      const nextAutoClose = storedAutoClose === undefined ? true : storedAutoClose === "true"
      const nextDelay = normalizeAutoCloseDelay(storedDelay)
      const nextSyncCloseTabs = storedSyncCloseTabs === undefined ? true : storedSyncCloseTabs === "true"

      setAutoClose(nextAutoClose)
      setAutoCloseDelay(nextDelay)
      autoCloseDelayRef.current = nextDelay
      setSyncCloseTabs(nextSyncCloseTabs)
      syncCloseTabsRef.current = nextSyncCloseTabs

      if (storedDelay === undefined || String(storedDelay) !== String(nextDelay)) {
        await storage.set(AUTO_CLOSE_DELAY_KEY, String(nextDelay))
      }
    })
  }, [])

  useEffect(() => {
    syncDataRef.current = syncData
  }, [syncData])

  useEffect(() => {
    const handleTabUpdated = (tabId: number, _changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      setPublishedTabs((prev) => prev.map((item) => (item.tab.id === tabId ? { ...item, tab } : item)))
      publishedTabsRef.current = publishedTabsRef.current.map((item) =>
        item.tab.id === tabId ? { ...item, tab } : item,
      )
    }

    const handleTabRemoved = (tabId: number) => {
      setPublishedTabs((prev) => prev.filter((item) => item.tab.id !== tabId))
      publishedTabsRef.current = publishedTabsRef.current.filter((item) => item.tab.id !== tabId)
    }

    const handleRuntimeMessage = (message: { action?: string; data?: unknown }) => {
      if (message.action === "MUTLIPOST_EXTENSION_PUBLISH_PROGRESS") {
        const nextProgress = message.data as PublishProgressPayload
        if (!shouldHandleTrace(nextProgress.traceId)) return
        setProgress(nextProgress)
        setNotice(
          nextProgress.failureCount > 0
            ? t("publishExecutionInProgressFailed", "执行中，已有 $1 个失败", nextProgress.failureCount)
            : t(
                "publishExecutionInProgressSucceeded",
                "执行中，已成功 $1 / $2",
                [nextProgress.successCount, nextProgress.totalPlatforms],
              ),
        )
      }

      if (message.action === "MUTLIPOST_EXTENSION_PUBLISH_COMPLETE") {
        const publishResult = message.data as PublishExecutionResult
        if (!shouldHandleTrace(publishResult.traceId)) return
        setResult(publishResult)
        setIsProcessing(false)
        setNotice(
          publishResult.status === "COMPLETED"
            ? t("publishExecutionCompleted", "执行完成")
            : t("publishExecutionFailed", "执行失败"),
        )

        if (publishResult.status === "FAILED") {
          clearAutoCloseTimers()
          setCountdown(0)
          if (publishResult.errorMessage) addError(publishResult.errorMessage)
        } else if (autoClose) {
          void startAutoCloseTimer()
        }
      }
    }

    chrome.tabs.onUpdated.addListener(handleTabUpdated)
    chrome.tabs.onRemoved.addListener(handleTabRemoved)
    chrome.runtime.onMessage.addListener(handleRuntimeMessage)

    if (!popupTraceId) {
      setNotice(t("publishReadTaskFailed", "鏃犳硶璇诲彇鍙戝竷浠诲姟"))
      setIsProcessing(false)
      return () => {
        chrome.tabs.onUpdated.removeListener(handleTabUpdated)
        chrome.tabs.onRemoved.removeListener(handleTabRemoved)
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
      }
    }

    chrome.runtime.sendMessage({
      action: "MUTLIPOST_EXTENSION_PUBLISH_REQUEST_SYNC_DATA",
      data: { traceId: popupTraceId }
    }, async (response) => {
      const data = response?.syncData as SyncData | undefined
      if (!data) {
        setNotice(t("publishReadTaskFailed", "无法读取发布任务"))
        setIsProcessing(false)
        return
      }

      syncDataRef.current = data
      setSyncData(data)
      setTitle(getTitleFromData(data))

      try {
        const processed = await processContentStrict(data)
        syncDataRef.current = processed
        setSyncData(processed)
        await requestPublishNow(processed)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        addError(message)
        setNotice(
          error instanceof Error && error.name === "SCRIPT_INJECTION_FAILED"
            ? t("publishErrorScriptInjectionFailed", "脚本注入失败")
            : t("publishAssetPreflightFailed", "资源预处理失败"),
        )
        setIsProcessing(false)
        await chrome.runtime.sendMessage({
          action: "MUTLIPOST_EXTENSION_PUBLISH_ABORT",
          data: {
            traceId: popupTraceId,
            errorCode:
              error instanceof Error && error.name === "SCRIPT_INJECTION_FAILED"
                ? "SCRIPT_INJECTION_FAILED"
                : "ASSET_PREFLIGHT_FAILED",
            errorMessage: message
          }
        })
      }
    })

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdated)
      chrome.tabs.onRemoved.removeListener(handleTabRemoved)
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
    }
  }, [autoClose, popupTraceId])

  const progressValue = result
    ? 100
    : progress && progress.totalPlatforms > 0
      ? Math.round(((progress.successCount + progress.failureCount) / progress.totalPlatforms) * 100)
      : undefined

  return (
    <HeroUIProvider>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <h2 className="text-center text-xl font-semibold text-foreground">{t("publishing", "正在发布内容")}</h2>
          {title && <p className="truncate text-center text-sm text-muted-foreground">{title}</p>}

          <Progress
            value={progressValue}
            isIndeterminate={isProcessing && progressValue === undefined}
            aria-label={notice}
            size="sm"
            className="w-full"
          />
          <p className="text-center text-sm text-muted-foreground">{notice}</p>

          {errors.length > 0 && (
            <div className="space-y-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errors.map((error, index) => (
                <p key={`${error}-${index}`}>{error}</p>
              ))}
            </div>
          )}

          {platformResults.length > 0 && (
            <div className="space-y-2">
              {platformResults.map((item) => (
                <div key={`${item.platformName}-${item.tabId || "na"}`} className="rounded border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{formatPlatformName(item.platformName)}</span>
                    <span className="text-xs text-muted-foreground">{formatStatusLabel(item.status)}</span>
                  </div>
                  {formatErrorMessage(item) && (
                    <p className="mt-1 text-xs text-red-600">{formatErrorMessage(item)}</p>
                  )}
                  {item.publishUrl && <p className="mt-1 truncate text-xs text-muted-foreground">{item.publishUrl}</p>}
                </div>
              ))}
            </div>
          )}

          {publishedTabs.length > 0 && (
            <div className="space-y-2">
              {publishedTabs.map((item) => (
                <div key={item.tab.id} className="relative flex items-center rounded border p-2">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="mr-2"
                    onPress={() => handleReloadTab(item.tab.id)}
                    aria-label={t("sidepanelReloadTab", "重新加载标签页")}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    className="grow justify-start pl-2 pr-10 text-left"
                    onPress={() => handleTabClick(item.tab.id)}>
                    <span className="truncate">{item.tab.title || item.tab.url || item.platformInfo.name}</span>
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    color="danger"
                    variant="light"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onPress={() => handleCloseTab(item.tab.id)}
                    aria-label={t("sidepanelCloseTab", "关闭标签页")}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tooltip
                  content={t("publishAutoCloseTooltip", "仅在发布成功后才会自动关闭。")}
                  placement="top"
                  className="max-w-xs">
                  <Switch
                    isSelected={autoClose}
                    onChange={async (event) => {
                      const checked = event.target.checked
                      setAutoClose(checked)
                      await storage.set(AUTO_CLOSE_KEY, String(checked))
                      if (!checked) {
                        clearAutoCloseTimers()
                        setCountdown(0)
                      } else if (result?.status === "COMPLETED") {
                        void startAutoCloseTimer()
                      }
                    }}
                    size="sm">
                    <span className="text-sm text-gray-700">{t("publishAutoClose", "自动关闭")}</span>
                  </Switch>
                </Tooltip>

                {autoClose && (
                  <div className="ml-2 flex items-center gap-1">
                    <NumberInput
                      hideStepper
                      size="sm"
                      variant="underlined"
                      min={5}
                      value={autoCloseDelay}
                      onChange={async (value) => {
                        const next = normalizeAutoCloseDelay(value)
                        setAutoCloseDelay(next)
                        autoCloseDelayRef.current = next
                        await storage.set(AUTO_CLOSE_DELAY_KEY, String(next))
                        if (autoClose && result?.status === "COMPLETED") {
                          void startAutoCloseTimer(next)
                        }
                      }}
                      className="w-16"
                    />
                    <span className="text-xs text-gray-500">{t("publishSecondsUnit", "秒")}</span>
                  </div>
                )}
              </div>

              {autoClose && countdown > 0 && (
                <span className="text-xs font-medium text-orange-700">
                  {t("publishAutoCloseCountdown", "$1 秒后自动关闭", countdown)}
                </span>
              )}
            </div>

            {autoClose && (
              <div className="mt-2 flex items-center">
                <Tooltip
                  content={t("publishCloseTabsTogetherTooltip", "关闭当前窗口时，一并关闭已打开的平台标签页。")}
                  placement="top"
                  className="max-w-xs">
                  <Switch
                    isSelected={syncCloseTabs}
                    onChange={async (event) => {
                      const checked = event.target.checked
                      setSyncCloseTabs(checked)
                      syncCloseTabsRef.current = checked
                      await storage.set(SYNC_CLOSE_TABS_KEY, String(checked))
                    }}
                    size="sm">
                    <span className="text-sm text-gray-700">{t("publishCloseTabsTogether", "同时关闭标签页")}</span>
                  </Switch>
                </Tooltip>
              </div>
            )}
          </div>

          {!isProcessing && (
            <div className="flex gap-2">
              <Button color="primary" className="flex-1" onPress={() => void handleCloseWindow(false)}>
                {t("finishPublishing", "完成发布")}
              </Button>
              <Button color="danger" className="flex-1" onPress={() => void handleCloseWindow(true)}>
                {t("finishAndCloseTabs", "完成并关闭所有标签页")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </HeroUIProvider>
  )
}
