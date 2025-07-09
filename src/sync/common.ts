import { getAccountInfoFromPlatformInfo, getAccountInfoFromPlatformInfos } from './account';
import { ArticleInfoMap } from './article';
import { DynamicInfoMap } from './dynamic';
import { getExtraConfigFromPlatformInfo, getExtraConfigFromPlatformInfos } from './extraconfig';
import { PodcastInfoMap } from './podcast';
import { ShangPinMap } from './shangpin/shangpin';
import { VideoInfoMap } from './video';
import { YunPanMap } from './yunpan/yunpan';
import '../types/window';

export interface SyncDataPlatform {
  name: string;
  injectUrl?: string;
  extraConfig?:
  | {
    customInjectUrls?: string[]; // Beta 功能，用于自定义注入 URL
  }
  | unknown;
}

export interface SyncData {
  platforms: SyncDataPlatform[];
  isAutoPublish: boolean;
  data: DynamicData | ArticleData | VideoData | PodcastData | YunPanData | ShangPinData;
  origin?: DynamicData | ArticleData | VideoData | PodcastData | YunPanData | ShangPinData; // Beta 功能，用于临时存储，发布时不需要提供该字段
  traceId?: string; // 从 ExtensionExternalRequest.traceId 传递过来的跟踪标识符
}

export interface DynamicData {
  title: string;
  content: string;
  images: FileData[];
  videos: FileData[];
  tags?: string[];
  originalFlag?: boolean; // 原创声明标志
  publishTime?: string; // 定时发布时间，格式：YYYY-MM-DD HH:mm
}

export interface YunPanData {
  title: string;
  paths: string[];
  files: FileData[];
}

export interface PodcastData {
  title: string;
  description: string;
  audio: FileData;
}

export interface FileData {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

export interface ArticleData {
  title: string;
  digest: string;
  cover: FileData;
  htmlContent: string;
  markdownContent: string;
  images?: FileData[]; // 发布时可不提供该字段
}


export interface ShangPinData {
  title: string;
  prize: string;
  num: string;
  files: FileData[];
}

export interface VideoData {
  title: string;
  content: string;
  video: FileData;
  tags?: string[];
}

export interface PlatformInfo {
  type: 'DYNAMIC' | 'VIDEO' | 'ARTICLE' | 'PODCAST' | 'YUNPAN' | 'SHANGPIN';
  name: string;
  homeUrl: string;
  faviconUrl?: string;
  iconifyIcon?: string;
  platformName: string;
  injectUrl: string;
  injectFunction: (data: SyncData) => Promise<void>;
  tags?: string[];
  accountKey: string;
  accountInfo?: AccountInfo;
  extraConfig?: unknown;
}

export interface AccountInfo {
  provider: string;
  accountId: string;
  username: string;
  description?: string;
  profileUrl?: string;
  avatarUrl?: string;
  extraData: unknown;
}

export const infoMap: Record<string, PlatformInfo> = {
  ...DynamicInfoMap,
  ...ArticleInfoMap,
  ...VideoInfoMap,
  ...PodcastInfoMap,
  ...YunPanMap,
  ...ShangPinMap,
};

export async function getPlatformInfo(platform: string): Promise<PlatformInfo | null> {
  const platformInfo = infoMap[platform];
  if (platformInfo) {
    return await getExtraConfigFromPlatformInfo(await getAccountInfoFromPlatformInfo(platformInfo));
  }
  return null;
}

export function getRawPlatformInfo(platform: string): PlatformInfo | null {
  return infoMap[platform];
}

export async function getPlatformInfos(type?: 'DYNAMIC' | 'VIDEO' | 'ARTICLE' | 'PODCAST' | 'YUNPAN'): Promise<PlatformInfo[]> {
  const platformInfos: PlatformInfo[] = [];
  for (const info of Object.values(infoMap)) {
    if (type && info.type !== type) continue;
    platformInfos.push(info);
  }

  return await getExtraConfigFromPlatformInfos(await getAccountInfoFromPlatformInfos(platformInfos));
}

// Inject || 注入 || START
export async function createTabsForPlatforms(data: SyncData) {
  const tabs: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }[] = [];
  let groupId: number | undefined;

  for (const info of data.platforms) {
    let tab: chrome.tabs.Tab | null = null;
    if (info) {
      const extraConfig = info.extraConfig as { customInjectUrls?: string[] };
      if (extraConfig?.customInjectUrls && extraConfig.customInjectUrls.length > 0) {
        for (const url of extraConfig.customInjectUrls) {
          tab = await chrome.tabs.create({ url });
          info.injectUrl = url;
          // 等待标签页加载完成
          await new Promise<void>((resolve) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === tab!.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            });
          });
        }
      } else {
        if (info.injectUrl) {
          tab = await chrome.tabs.create({ url: info.injectUrl });
        } else {
          const platformInfo = infoMap[info.name];
          if (platformInfo) {
            tab = await chrome.tabs.create({ url: platformInfo.injectUrl });
          }
        }
        // 等待标签页加载完成
        if (tab) {
          await injectScriptsToTabs([{ tab, platformInfo: info }], data);
          await chrome.tabs.update(tab.id!, { active: true });
          tabs.push({
            tab,
            platformInfo: info,
          });

          // 如果是第一个标签页，创建一个新组
          if (!groupId) {
            groupId = await chrome.tabs.group({ tabIds: [tab.id!] });
            await chrome.tabGroups.update(groupId, {
              color: 'blue',
              title: `MultiPost-${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
            });
          } else {
            // 将新标签页添加到现有组中
            await chrome.tabs.group({ tabIds: [tab.id!], groupId });
          }
          // 等待3秒再继续
          await new Promise<void>((resolve) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === tab!.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            });
          });
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }
  }

  return tabs;
}

export async function injectScriptsToTabs(
  tabs: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }[],
  data: SyncData,
) {
  for (const t of tabs) {
    const tab = t.tab;
    const platform = t.platformInfo;
    if (tab.id) {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);

          // 注入包装的发布脚本
          getPlatformInfo(platform.name).then(async (info) => {
            if (info) {
              // 如果有 traceId，先注入监控逻辑，然后执行原函数
              if (data.traceId) {
                // 先注入监控逻辑
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: function (traceId: string, platformName: string) {
                    /**
                     * 监控函数 - 符合CSP要求
                     * @description 注入结果发送函数到全局作用域，避免复杂类型断言
                     */
                    console.log(`[Monitor] 初始化监控: ${platformName}`);

                    // 使用简单的方式扩展 window 对象，避免复杂类型断言
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const win = window as any;

                    // 发送发布结果的函数
                    win.multipostSendResult = function (success: boolean, publishUrl?: string, errorMessage?: string) {
                      const result = {
                        traceId,
                        platformName,
                        success,
                        publishUrl: publishUrl || window.location.href,
                        errorMessage,
                        timestamp: Date.now()
                      };

                      const message = {
                        type: 'MULTIPOST_PUBLISH_RESULT',
                        data: result
                      };

                      try {
                        // 发送到窗口
                        if (window.parent !== window) {
                          window.parent.postMessage(message, '*');
                        }
                        if (window.opener) {
                          window.opener.postMessage(message, '*');
                        }
                        window.postMessage(message, '*');

                        // 发送到背景脚本
                        chrome.runtime.sendMessage({
                          action: 'MUTLIPOST_EXTENSION_PUBLISH_RESULT',
                          data: result
                        });

                        console.log(`[Monitor] 结果已发送: ${platformName}`, result);
                      } catch (error) {
                        console.error('[Monitor] 发送结果失败:', error);
                      }
                    };

                    // 保存平台信息供后续使用
                    win.multipostInfo = {
                      traceId,
                      platformName,
                      startTime: Date.now()
                    };
                  },
                  args: [data.traceId, platform.name]
                });

                // 然后执行原函数
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: info.injectFunction,
                  args: [data],
                });

                // 最后发送完成消息（假设执行成功）
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: function () {
                    /**
                     * 自动发送完成消息
                     * @description 使用简单的方式避免 CSP 问题
                     */
                    setTimeout(() => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const win = window as any;
                      if (typeof win.multipostSendResult === 'function') {
                        console.log('[Monitor] 自动发送完成消息');
                        win.multipostSendResult(true, window.location.href);
                      }
                    }, 1000);
                  }
                });
              } else {
                // 没有 traceId，直接注入原函数
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: info.injectFunction,
                  args: [data],
                });
              }
            }
          });
        }
      });
    }
  }
}
// Inject || 注入 || END
