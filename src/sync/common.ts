import { getAccountInfoFromPlatformInfo, getAccountInfoFromPlatformInfos } from './account';
import { ArticleInfoMap } from './article';
import { DynamicInfoMap } from './dynamic';
import { getExtraConfigFromPlatformInfo, getExtraConfigFromPlatformInfos } from './extraconfig';
import { PodcastInfoMap } from './podcast';
import { ShangPinMap } from './shangpin/shangpin';
import { VideoInfoMap } from './video';
import { YunPanMap } from './yunpan/yunpan';

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
  requestId?: string; // 新增：用于跟踪发布请求的唯一标识
}

export interface DynamicData {
  title: string;
  content: string;
  images: FileData[];
  videos: FileData[];
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
          getPlatformInfo(platform.name).then((info) => {
            if (info) {
              // 如果有 requestId，使用包装函数添加监控
              if (data.requestId) {
                chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: function (data, originalFuncStr, requestId, platformName) {
                    /**
                     * 简化包装函数 - 脚本执行完成后发送消息
                     * @description 在原函数外层包装，执行完成后发送完成消息
                     */

                    console.log(`[Wrapper] 开始执行发布: ${platformName}`);

                    /**
                     * 发送完成消息
                     * @param {boolean} success - 是否成功执行
                     * @param {string} errorMessage - 错误信息（可选）
                     */
                    function sendCompletionMessage(success, errorMessage = undefined) {
                      const result = {
                        requestId,
                        platformName,
                        success,
                        publishUrl: window.location.href, // 使用当前页面URL
                        errorMessage,
                        timestamp: Date.now()
                      };

                      const message = {
                        type: 'MULTIPOST_PUBLISH_RESULT',
                        data: result
                      };

                      try {
                        if (window.parent !== window) {
                          window.parent.postMessage(message, '*');
                        }
                        if (window.opener) {
                          window.opener.postMessage(message, '*');
                        }
                        window.postMessage(message, '*');

                        console.log(`[Wrapper] 执行完成消息已发送: ${platformName}`, result);
                      } catch (error) {
                        console.error('[Wrapper] 发送消息失败:', error);
                      }
                    }

                    // 提供手动发送结果的函数（可选使用）
                    (window as Window & { multipostSendResult?: (success: boolean, publishUrl: string, errorMessage?: string) => void }).multipostSendResult = function (success, publishUrl, errorMessage) {
                      console.log(`[Wrapper] 收到手动发送结果调用`);
                      const result = {
                        requestId,
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
                        if (window.parent !== window) {
                          window.parent.postMessage(message, '*');
                        }
                        if (window.opener) {
                          window.opener.postMessage(message, '*');
                        }
                        window.postMessage(message, '*');

                        console.log(`[Wrapper] 手动发送结果已发送: ${platformName}`, result);
                      } catch (error) {
                        console.error('[Wrapper] 发送结果失败:', error);
                      }
                    };

                    try {
                      // 执行原始发布函数
                      console.log(`[Wrapper] 执行原始发布函数...`);
                      const originalFunc = new Function('data', `return (${originalFuncStr})(data);`);
                      const result = originalFunc(data);

                      console.log(`[Wrapper] 原始发布函数执行完成`);

                      // 发送执行完成消息
                      sendCompletionMessage(true);

                      return result;

                    } catch (error) {
                      console.error(`[Wrapper] 原始发布函数执行出错:`, error);

                      // 发送执行失败消息
                      sendCompletionMessage(false, `执行错误: ${error.message}`);

                      throw error;
                    }
                  },
                  args: [data, info.injectFunction.toString(), data.requestId, platform.name]
                });
              } else {
                // 没有 requestId，直接注入原函数
                chrome.scripting.executeScript({
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
