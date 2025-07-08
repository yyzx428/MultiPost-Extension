/* eslint-disable @typescript-eslint/no-explicit-any */
export { };

import {
  addTabsManagerMessages,
  tabsManagerHandleTabRemoved,
  tabsManagerHandleTabUpdated,
  tabsManagerMessageHandler,
} from './services/tabs';
import QuantumEntanglementKeepAlive from '../utils/keep-alive';
import {
  createTabsForPlatforms,
  getPlatformInfos,
  // injectScriptsToTabs,
  type SyncData,
  type SyncDataPlatform,
} from '~sync/common';
import { trustDomainMessageHandler } from './services/trust-domain';
import { Storage } from '@plasmohq/storage';
import { getAllAccountInfo } from '~sync/account';
import { linkExtensionMessageHandler, starter } from './services/api';

const storage = new Storage({
  area: 'local',
});

async function initDefaultTrustedDomains() {
  const trustedDomains = await storage.get<Array<{ id: string; domain: string }>>('trustedDomains');
  if (!trustedDomains) {
    await storage.set('trustedDomains', [
      {
        id: crypto.randomUUID(),
        domain: 'multipost.app',
      },
    ]);
  }
}

chrome.runtime.onInstalled.addListener((object) => {
  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: 'https://multipost.app/on-install' });
  }
  initDefaultTrustedDomains();
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

// Listen Message || 监听消息 || START
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  defaultMessageHandler(request, sender, sendResponse);
  tabsManagerMessageHandler(request, sender, sendResponse);
  trustDomainMessageHandler(request, sender, sendResponse);
  linkExtensionMessageHandler(request, sender, sendResponse);
  return true;
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  tabsManagerHandleTabUpdated(tabId, changeInfo, tab);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  tabsManagerHandleTabRemoved(tabId);
});
// Listen Message || 监听消息 || END

// Message Handler || 消息处理器 || START
let currentSyncData: SyncData | null = null;
let currentPublishPopup: chrome.windows.Window | null = null;
// 新增：跟踪发布请求信息
let currentPublishRequest: {
  traceId?: string;
  originTabId?: number;
  originWindowId?: number;
  expectedResultsCount: number;
  receivedResults: Array<{
    traceId: string;
    platformName: string;
    success: boolean;
    publishUrl: string;
    errorMessage?: string;
    timestamp: number;
  }>;
  timeoutId?: NodeJS.Timeout;
} | null = null;

const defaultMessageHandler = (request, sender, sendResponse) => {
  if (request.action === 'MUTLIPOST_EXTENSION_CHECK_SERVICE_STATUS') {
    sendResponse({ extensionId: chrome.runtime.id });
  }
  if (request.action === 'MUTLIPOST_EXTENSION_PUBLISH') {
    const data = request.data as SyncData;
    // 将 ExtensionExternalRequest 中的 traceId 传递到 SyncData 中
    data.traceId = request.traceId;
    currentSyncData = data;

    // 初始化发布请求跟踪
    currentPublishRequest = {
      traceId: request.traceId, // 直接从 ExtensionExternalRequest 中获取 traceId
      originTabId: sender.tab?.id,
      originWindowId: sender.tab?.windowId,
      expectedResultsCount: data.platforms.length,
      receivedResults: [],
      // 设置5分钟超时
      timeoutId: setTimeout(() => {
        console.log('发布超时，发送已收到的结果');
        sendAggregatedResultsToOrigin();
      }, 5 * 60 * 1000) // 5分钟超时
    };

    (async () => {
      currentPublishPopup = await chrome.windows.create({
        url: chrome.runtime.getURL(`tabs/publish.html`),
        type: 'popup',
        width: 800,
        height: 600,
      });
    })();
  }

  // 新增：处理发布结果消息
  if (request.action === 'MUTLIPOST_EXTENSION_PUBLISH_RESULT') {
    const result = request.data;

    if (currentPublishRequest && result.traceId === currentPublishRequest.traceId) {
      // 添加结果到集合中
      currentPublishRequest.receivedResults.push(result);

      console.log(`收到发布结果: ${result.platformName}，成功: ${result.success}`);
      console.log(`已收到 ${currentPublishRequest.receivedResults.length}/${currentPublishRequest.expectedResultsCount} 个结果`);

      // 检查是否所有平台都已返回结果
      if (currentPublishRequest.receivedResults.length >= currentPublishRequest.expectedResultsCount) {
        // 发送聚合结果回原始窗口
        sendAggregatedResultsToOrigin();
      }
    }
  }

  if (request.action === 'MUTLIPOST_EXTENSION_PLATFORMS') {
    getPlatformInfos().then((platforms) => {
      sendResponse({ platforms });
    });
  }
  if (request.action === 'MUTLIPOST_EXTENSION_GET_ACCOUNT_INFOS') {
    getAllAccountInfo().then((accountInfo) => {
      sendResponse({ accountInfo });
    });
  }
  if (request.action === 'MUTLIPOST_EXTENSION_OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ extensionId: chrome.runtime.id });
  }
  if (request.action === 'MUTLIPOST_EXTENSION_REFRESH_ACCOUNT_INFOS') {
    chrome.windows.create({
      url: chrome.runtime.getURL(`tabs/refresh-accounts.html`),
      type: 'popup',
      width: 800,
      height: 600,
      focused: request.data.isFocused || false,
    });
  }
  if (request.action === 'MUTLIPOST_EXTENSION_PUBLISH_REQUEST_SYNC_DATA') {
    sendResponse({ syncData: currentSyncData });
  }
  if (request.action === 'MUTLIPOST_EXTENSION_PUBLISH_NOW') {
    const data = request.data as SyncData;
    if (Array.isArray(data.platforms) && data.platforms.length > 0) {
      (async () => {
        try {
          const tabs = await createTabsForPlatforms(data);
          // await injectScriptsToTabs(tabs, data);

          addTabsManagerMessages({
            syncData: data,
            tabs: tabs.map((t: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }) => ({
              tab: t.tab,
              platformInfo: t.platformInfo,
            })),
          });

          // for (const t of tabs) {
          //   if (t.tab.id) {
          //     await chrome.tabs.update(t.tab.id, { active: true });
          //     await new Promise((resolve) => setTimeout(resolve, 2000));
          //   }
          // }
          if (currentPublishPopup) {
            await chrome.windows.update(currentPublishPopup.id, { focused: true });
          }

          sendResponse({
            tabs: tabs.map((t: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }) => ({
              tab: t.tab,
              platformInfo: t.platformInfo,
            })),
          });
        } catch (error) {
          console.error('创建标签页或分组时出错:', error);
        }
      })();
    }
  }
};

// 新增：发送聚合结果到原始窗口的函数
async function sendAggregatedResultsToOrigin() {
  if (!currentPublishRequest) return;

  // 清理超时定时器
  if (currentPublishRequest.timeoutId) {
    clearTimeout(currentPublishRequest.timeoutId);
  }

  const aggregatedResult = {
    traceId: currentPublishRequest.traceId,
    totalPlatforms: currentPublishRequest.expectedResultsCount,
    successCount: currentPublishRequest.receivedResults.filter(r => r.success).length,
    failureCount: currentPublishRequest.receivedResults.filter(r => !r.success).length,
    results: currentPublishRequest.receivedResults,
    timestamp: Date.now()
  };

  console.log('发送聚合发布结果:', aggregatedResult);

  try {
    // 尝试向原始标签页发送消息
    if (currentPublishRequest.originTabId) {
      await chrome.tabs.sendMessage(currentPublishRequest.originTabId, {
        action: 'MUTLIPOST_EXTENSION_PUBLISH_COMPLETE',
        data: aggregatedResult
      });
      console.log('已向原始标签页发送聚合结果');
    }
  } catch (error) {
    console.error('向原始标签页发送结果失败:', error);
  }

  // 清理当前发布请求状态
  currentPublishRequest = null;
}
starter(1000);
// Message Handler || 消息处理器 || END

// Keep Alive || 保活机制 || START
const quantumKeepAlive = new QuantumEntanglementKeepAlive();
quantumKeepAlive.startEntanglementProcess();
// Keep Alive || 保活机制 || END
