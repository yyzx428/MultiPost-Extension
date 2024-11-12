import { BilibiliDynamic, BilibiliVideo } from "./bilibili";
import { DouyinImage, DouyinVideo } from "./douyin";
import { InstagramImage } from "./instagram";
import { RednoteImage, RednoteVideo } from "./rednote";
import { WeiboDynamic } from "./weibo";
import { XDynamic } from "./x";
import { XueqiuDynamic } from "./xueqiu";
import { YoutubeVideo } from "./youtube";
import { ZhihuDynamic } from "./zhihu";

export const SUPPORT_PLATFORMS = [
  'BilibiliDynamic',
  'XDynamic',
  'RedNoteImage',
  'WeiboDynamic',
  'XueqiuDynamic',
  'ZhihuDynamic',
  'DouyinImage',
  'BilibiliVideo',
  'DouyinVideo',
  'YoutubeVideo',
  'RedNoteVideo',
  'InstagramImage',
];
export const PLATFORM_NEED_IMAGE = ['RedNoteImage', 'DouyinImage', 'InstagramImage'];

export type Platform =
  | 'BilibiliDynamic'
  | 'XDynamic'
  | 'RedNoteImage'
  | 'WeiboDynamic'
  | 'XueqiuDynamic'
  | 'ZhihuDynamic'
  | 'DouyinImage'
  | 'BilibiliVideo'
  | 'DouyinVideo'
  | 'YoutubeVideo'
  | 'RedNoteVideo'
  | 'InstagramImage';

export function getUrl(platform: string): string | null {
  const urlMap: Record<string, string> = {
    XDynamic: 'https://x.com/home',
    BilibiliDynamic: 'https://t.bilibili.com',
    RedNoteImage: 'https://creator.xiaohongshu.com/publish/publish',
    WeiboDynamic: 'https://weibo.com',
    XueqiuDynamic: 'https://xueqiu.com',
    ZhihuDynamic: 'https://www.zhihu.com',
    DouyinImage: 'https://creator.douyin.com/creator-micro/content/upload?default-tab=3',
    BilibiliVideo: 'https://member.bilibili.com/platform/upload/video/frame',
    DouyinVideo: 'https://creator.douyin.com/creator-micro/content/upload',
    YoutubeVideo: 'https://studio.youtube.com/',
    RedNoteVideo: 'https://creator.xiaohongshu.com/publish/publish',
    InstagramImage: 'https://www.instagram.com/',
  };

  return urlMap[platform] || null;
}

export interface SyncData {
  platforms: string[];
  auto_publish: boolean;
  data: DynamicData | PostData | VideoData;
}

export interface DynamicData {
  title: string;
  content: string;
  images: FileData[];
  videos: FileData[];
}

export interface FileData {
  name: string;
  url: string;
  type: string;
  size: number;
  base64?: string;
}

export interface PostData {
  title: string;
  content: string;
}

export interface VideoData {
  title: string;
  content: string;
  video: FileData;
}

export function waitForElement(selector: string, timeout = 10000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms`));
    }, timeout);
  });
}

export async function findElementByText(
  selector: string,
  text: string,
  maxRetries = 5,
  retryInterval = 1000,
): Promise<Element | null> {
  for (let i = 0; i < maxRetries; i++) {
    const elements = document.querySelectorAll(selector);
    const element = Array.from(elements).find((element) => element.textContent?.includes(text));

    if (element) {
      return element;
    }

    console.log(`未找到包含文本 "${text}" 的元素，尝试次数：${i + 1}`);
    await new Promise((resolve) => setTimeout(resolve, retryInterval));
  }

  console.error(`在 ${maxRetries} 次尝试后未找到包含文本 "${text}" 的元素`);
  return null;
}


// Inject || 注入 || START
export async function createTabsForPlatforms(data: SyncData) {
  const tabs = [];
  console.log(data);
  for (const platform of data.platforms) {
    const url = getUrl(platform);
    if (url) {
      const tab = await chrome.tabs.create({ url });
      tabs.push([tab, platform]);
    }
  }

  const groupId = await chrome.tabs.group({ tabIds: tabs.map((t) => t[0].id!) });
  const group = await chrome.tabGroups.get(groupId);

  await chrome.tabGroups.update(group.id, {
    color: 'blue',
    title: '多平台发布',
  });

  return tabs;
}

export async function injectScriptsToTabs(tabs: [chrome.tabs.Tab, string][], data: SyncData) {
  for (const t of tabs) {
    const tab = t[0];
    const platform = t[1];
    if (tab.id) {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          let func: (data: SyncData) => Promise<void>;
          switch (platform) {
            case 'XDynamic':
              func = XDynamic;
              break;
            case 'BilibiliDynamic':
              func = BilibiliDynamic;
              break;
            case 'RedNoteImage':
              func = RednoteImage;
              break;
            case 'WeiboDynamic':
              func = WeiboDynamic;
              break;
            case 'XueqiuDynamic':
              func = XueqiuDynamic;
              break;
            case 'ZhihuDynamic':
              func = ZhihuDynamic;
              break;
            case 'DouyinImage':
              func = DouyinImage;
              break;
            case 'BilibiliVideo':
              func = BilibiliVideo;
              break;
            case 'DouyinVideo':
              func = DouyinVideo;
              break;
            case 'YoutubeVideo':
              func = YoutubeVideo;
              break;
            case 'RedNoteVideo':
              func = RednoteVideo;
              break;
            case 'InstagramImage':
              func = InstagramImage;
              break;
          }
          if (func) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: func,
              args: [data],
            });
          }
        }
      });
    }
  }
}
// Inject || 注入 || END