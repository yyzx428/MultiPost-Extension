import { APP_NAME } from "~utils/config"

import { getAccountInfoFromPlatformInfo, getAccountInfoFromPlatformInfos } from "./account"
import { ArticleInfoMap } from "./article"
import { DynamicInfoMap } from "./dynamic"
import { getExtraConfigFromPlatformInfo, getExtraConfigFromPlatformInfos } from "./extraconfig"
import { PodcastInfoMap } from "./podcast"
import { withPublishPostCondition, withPublishPostConditions } from "./publish-post-condition"
import { ShangPinMap } from "./shangpin/shangpin"
import "../types/window"
import { VideoInfoMap } from "./video"
import { YunPanMap } from "./yunpan/yunpan"

export interface SyncDataPlatform {
  name: string
  injectUrl?: string
  extraConfig?: {
    customInjectUrls?: string[]
  } | unknown
}

export interface SyncData {
  platforms: SyncDataPlatform[]
  isAutoPublish: boolean
  data: DynamicData | ArticleData | VideoData | PodcastData | YunPanData | ShangPinData
  origin?: DynamicData | ArticleData | VideoData | PodcastData | YunPanData | ShangPinData
  traceId?: string
  taskId?: string
}

export interface DynamicData {
  title: string
  content: string
  images: FileData[]
  videos: FileData[]
  tags?: string[]
  originalFlag?: boolean
  publishTime?: string
  shangpin?: string
}

export interface YunPanData {
  title: string
  paths: string[]
  files: FileData[]
}

export interface PodcastData {
  title: string
  description: string
  audio: FileData
}

export interface FileData {
  name: string
  url: string
  type?: string
  size?: number
  contentDataUrl?: string
}

export interface ArticleData {
  title: string
  digest: string
  cover: FileData
  htmlContent: string
  markdownContent: string
  images?: FileData[]
}

export interface ShangPinData {
  title: string
  prize?: string
  num?: string
  files?: FileData[]
  useInfo?: string
  shareUrl?: string
  shareText?: string
}

export interface VideoData {
  title: string
  content: string
  video: FileData
  tags?: string[]
}

export interface PublishSignalMatcher {
  selectors?: string[]
  texts?: string[]
  urlIncludes?: string[]
}

export interface PublishPostCondition {
  timeoutMs?: number
  success: PublishSignalMatcher
  failure?: PublishSignalMatcher
  failureErrorCode?: string
  failureMessage?: string
  timeoutErrorCode?: string
  timeoutMessage?: string
}

export interface PlatformInfo {
  type: "DYNAMIC" | "VIDEO" | "ARTICLE" | "PODCAST" | "YUNPAN" | "SHANGPIN"
  name: string
  homeUrl: string
  faviconUrl?: string
  iconifyIcon?: string
  platformName: string
  injectUrl: string
  injectFunction: (data: SyncData) => Promise<unknown>
  tags?: string[]
  accountKey: string
  accountInfo?: AccountInfo
  extraConfig?: unknown
  publishPostCondition?: PublishPostCondition
}

export interface AccountInfo {
  provider: string
  accountId: string
  username: string
  description?: string
  profileUrl?: string
  avatarUrl?: string
  extraData: unknown
}

export const infoMap: Record<string, PlatformInfo> = {
  ...DynamicInfoMap,
  ...ArticleInfoMap,
  ...VideoInfoMap,
  ...PodcastInfoMap,
  ...YunPanMap,
  ...ShangPinMap
}

export async function getPlatformInfo(platform: string): Promise<PlatformInfo | null> {
  const platformInfo = infoMap[platform]
  if (!platformInfo) return null
  return withPublishPostCondition(
    await getExtraConfigFromPlatformInfo(await getAccountInfoFromPlatformInfo(platformInfo)),
  )
}

export function getRawPlatformInfo(platform: string): PlatformInfo | null {
  const platformInfo = infoMap[platform]
  return platformInfo ? withPublishPostCondition(platformInfo) : null
}

export async function getPlatformInfos(
  type?: "DYNAMIC" | "VIDEO" | "ARTICLE" | "PODCAST" | "YUNPAN",
): Promise<PlatformInfo[]> {
  const platformInfos = Object.values(infoMap).filter((info) => !type || info.type === type)
  return withPublishPostConditions(
    await getExtraConfigFromPlatformInfos(await getAccountInfoFromPlatformInfos(platformInfos)),
  )
}

async function waitForTabComplete(tabId: number) {
  const currentTab = await chrome.tabs.get(tabId).catch(() => null)
  if (currentTab?.status === "complete") return

  return new Promise<void>((resolve) => {
    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }

    chrome.tabs.onUpdated.addListener(listener)
  })
}

export async function createTabsForPlatforms(data: SyncData) {
  const tabs: Array<{ tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }> = []
  const groupIdsByWindow = new Map<number, number>()

  const tryGroupTab = async (tabId: number, tabWindowId?: number) => {
    if (typeof tabWindowId !== "number") return

    try {
      const existingGroupId = groupIdsByWindow.get(tabWindowId)

      if (!existingGroupId) {
        const groupId = await chrome.tabs.group({ tabIds: [tabId] })
        await chrome.tabGroups.update(groupId, {
          color: "blue",
          title: `${APP_NAME}-${new Date().toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit"
          })}`
        })
        groupIdsByWindow.set(tabWindowId, groupId)
        return
      }

      await chrome.tabs.group({ tabIds: [tabId], groupId: existingGroupId })
    } catch (error) {
      console.warn("[MultiPost] ignore tab grouping failure", error)
    }
  }

  for (const basePlatform of data.platforms) {
    const extraConfig = basePlatform.extraConfig as { customInjectUrls?: string[] } | undefined
    const urls =
      extraConfig?.customInjectUrls?.length
        ? extraConfig.customInjectUrls
        : [basePlatform.injectUrl || infoMap[basePlatform.name]?.injectUrl].filter(Boolean) as string[]

    for (const url of urls) {
      const platformInfo: SyncDataPlatform = { ...basePlatform, injectUrl: url }
      const tab = await chrome.tabs.create({ url, active: true })

      if (!tab.id) continue

      await waitForTabComplete(tab.id)
      await injectScriptsToTabs([{ tab, platformInfo }], data)
      await chrome.tabs.update(tab.id, { active: true })

      tabs.push({ tab, platformInfo })
      await tryGroupTab(tab.id, tab.windowId)

      await waitForTabComplete(tab.id)
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }

  return tabs
}

export async function injectScriptsToTabs(
  tabs: Array<{ tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }>,
  data: SyncData,
) {
  for (const item of tabs) {
    const { tab, platformInfo } = item
    if (!tab.id) continue

    const runInjection = async () => {
      const info = await getPlatformInfo(platformInfo.name)
      if (!info) return

      const sendResult = async (
        success: boolean,
        publishUrl?: string,
        errorMessage?: string,
        errorCode?: string,
      ) => {
        if (!data.traceId) return
        const latestTab = await chrome.tabs.get(tab.id!).catch(() => null)
        await chrome.runtime.sendMessage({
          action: "MUTLIPOST_EXTENSION_PUBLISH_RESULT",
          data: {
            traceId: data.traceId,
            platformName: platformInfo.name,
            success,
            publishUrl: publishUrl || latestTab?.url || tab.url,
            errorCode,
            errorMessage,
            tabId: tab.id,
            timestamp: Date.now()
          }
        })
      }

      const sendFailure = async (message: string) => {
        await sendResult(false, undefined, message, "SCRIPT_INJECTION_FAILED")
      }

      try {
        if (!data.traceId) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            func: info.injectFunction,
            args: [data]
          })
          return
        }

        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: (traceId: string, runtimePlatformName: string, runtimeTabId?: number) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const win = window as any

            win.__multipostResultSent = false
            win.multipostSendResult = function (
              success: boolean,
              publishUrl?: string,
              errorMessage?: string,
              errorCode?: string,
            ) {
              if (win.__multipostResultSent) return
              win.__multipostResultSent = true

              const result = {
                traceId,
                platformName: runtimePlatformName,
                success,
                publishUrl: publishUrl || window.location.href,
                errorCode,
                errorMessage,
                tabId: runtimeTabId,
                timestamp: Date.now()
              }

              const bridgeMessage = {
                type: "MULTIPOST_PUBLISH_RESULT",
                data: result
              }

              if (window.parent !== window) window.parent.postMessage(bridgeMessage, "*")
              if (window.opener) window.opener.postMessage(bridgeMessage, "*")
              window.postMessage(bridgeMessage, "*")
              chrome.runtime.sendMessage({
                action: "MUTLIPOST_EXTENSION_PUBLISH_RESULT",
                data: result
              })
            }

            win.multipostInfo = {
              traceId,
              platformName: runtimePlatformName,
              tabId: runtimeTabId,
              startTime: Date.now()
            }
          },
          args: [data.traceId, platformInfo.name, tab.id]
        })

        const execution = await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: info.injectFunction,
          args: [data]
        })

        const [{ result: bridgeState }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const win = window as any
            return {
              resultSent: Boolean(win.__multipostResultSent),
              publishUrl: window.location.href
            }
          }
        })

        if (bridgeState?.resultSent) return

        const rawResult = execution[0]?.result
        if (rawResult && typeof rawResult === "object" && "success" in (rawResult as Record<string, unknown>)) {
          const structured = rawResult as {
            success: boolean
            publishUrl?: string
            errorMessage?: string
            errorCode?: string
          }
          await sendResult(
            structured.success,
            structured.publishUrl,
            structured.errorMessage,
            structured.errorCode,
          )
          return
        }

        if (typeof rawResult === "boolean" && rawResult === false) {
          await sendResult(false, bridgeState?.publishUrl, "Script returned false", "SCRIPT_RETURNED_FALSE")
          return
        }

        if (info.publishPostCondition) {
          const [{ result: observed }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            func: async (condition: PublishPostCondition) => {
              const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
              const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase()
              const getPageText = () =>
                normalizeText(document.body?.innerText || document.documentElement?.innerText || "")

              const matchesSignal = (matcher?: PublishSignalMatcher) => {
                if (!matcher) return false
                let hasConstraint = false
                let matched = true
                let matchedTexts: string[] = []

                if (matcher.selectors?.length) {
                  hasConstraint = true
                  const elements = matcher.selectors.flatMap((selector) => {
                    try {
                      return Array.from(document.querySelectorAll(selector))
                    } catch {
                      return []
                    }
                  })
                  matched &&= elements.length > 0
                  matchedTexts = elements
                    .map((element) => normalizeText(element.textContent || ""))
                    .filter(Boolean)
                }

                if (matcher.urlIncludes?.length) {
                  hasConstraint = true
                  matched &&= matcher.urlIncludes.some((part) => window.location.href.includes(part))
                }

                if (matcher.texts?.length) {
                  hasConstraint = true
                  const textSource = matchedTexts.length ? matchedTexts.join(" ") : getPageText()
                  matched &&= matcher.texts.some((text) => textSource.includes(normalizeText(text)))
                }

                return hasConstraint && matched
              }

              const timeoutMs = condition.timeoutMs || 30000
              const startedAt = Date.now()

              while (Date.now() - startedAt < timeoutMs) {
                if (matchesSignal(condition.failure)) {
                  return {
                    success: false,
                    publishUrl: window.location.href,
                    errorCode: condition.failureErrorCode || "PLATFORM_FAILURE_SIGNAL",
                    errorMessage: condition.failureMessage || "Detected publish failure signal"
                  }
                }

                if (matchesSignal(condition.success)) {
                  return {
                    success: true,
                    publishUrl: window.location.href
                  }
                }

                await wait(500)
              }

              return {
                success: false,
                publishUrl: window.location.href,
                errorCode: condition.timeoutErrorCode || "PLATFORM_NO_SUCCESS_SIGNAL",
                errorMessage: condition.timeoutMessage || "No success signal detected before timeout"
              }
            },
            args: [info.publishPostCondition]
          })

          await sendResult(
            observed?.success === true,
            observed?.publishUrl,
            observed?.errorMessage,
            observed?.errorCode,
          )
          return
        }

        await sendResult(true, bridgeState?.publishUrl)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[Monitor] inject failed for ${platformInfo.name}`, error)
        await sendFailure(message)
      }
    }

    const currentTab = await chrome.tabs.get(tab.id).catch(() => null)
    if (currentTab?.status === "complete") {
      void runInjection()
      continue
    }

    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tab.id || changeInfo.status !== "complete") return
      chrome.tabs.onUpdated.removeListener(listener)
      void runInjection()
    })
  }
}
