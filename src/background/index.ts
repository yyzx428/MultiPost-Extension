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
import { fileOperationManager } from '../file-ops';
import type { FileOperation, FileOperationResult } from '../file-ops/types';

const storage = new Storage({
  area: 'local',
});

/**
 * 在指定标签页中执行文件操作
 * @param tabId 标签页ID
 * @param operation 文件操作
 * @returns 操作结果
 */
async function executeFileOperationInTab(tabId: number, operation: FileOperation): Promise<FileOperationResult> {
  try {
    // 激活标签页
    await chrome.tabs.update(tabId, { active: true });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 注入并执行文件操作脚本
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (op: any) => {
        console.log('在页面中执行文件操作:', op);

        try {
          // 等待页面加载完成
          await new Promise<void>(resolve => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              window.addEventListener('load', () => resolve());
            }
          });

          // 等待页面稳定
          await new Promise(resolve => setTimeout(resolve, 3000));

          // 调用现有的 file-ops 接口
          if (op.platform === 'baiduyun' && op.operation === 'share') {
            // 通过消息传递调用后台脚本的 file-ops 接口
            return new Promise((resolve, reject) => {
              chrome.runtime.sendMessage({
                type: 'EXECUTE_FILE_OPS_IN_TAB',
                operation: op,
                tabId: op.tabId
              }, (response) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                  resolve(response);
                } else {
                  reject(new Error(response?.error || '文件操作失败'));
                }
              });
            });
          }

          throw new Error(`不支持的操作: ${op.platform}.${op.operation}`);
        } catch (error) {
          console.error('文件操作失败:', error);
          throw error;
        }
      },
      args: [operation]
    });

    if (results && results[0] && results[0].result) {
      return results[0].result as FileOperationResult;
    } else {
      throw new Error('在标签页中执行文件操作失败');
    }
  } catch (error) {
    return {
      success: false,
      operation: operation.operation,
      platform: operation.platform,
      executionTime: 0,
      data: null,
      logs: [{
        timestamp: Date.now(),
        level: 'error',
        message: error.message
      }]
    };
  }
}

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
  responceCallback?: (data: any) => void;
} | null = null;

// 新增：链式操作相关状态
let currentChainActionData: {
  action: string;
  config: Record<string, unknown>;
  traceId?: string;
} | null = null;

const defaultMessageHandler = (request, sender, sendResponse) => {
  if (request.action === 'MUTLIPOST_EXTENSION_CHECK_SERVICE_STATUS') {
    sendResponse({ extensionId: chrome.runtime.id });
  }
  if (request.action === 'MUTLIPOST_EXTENSION_EXECUTE_FILE_OPS') {
    // 处理文件操作请求
    (async () => {
      try {
        console.log('[Background] 收到文件操作请求:', request.data);

        const operation = request.data as FileOperation;
        const result = await fileOperationManager.executeOperation(operation);

        console.log('[Background] 文件操作完成:', result);

        if (result.success) {
          sendResponse({ success: true, data: result.data });
        } else {
          sendResponse({ success: false, error: result.logs?.[0]?.message || '文件操作失败' });
        }
      } catch (error) {
        console.error('[Background] 文件操作失败:', error);
        sendResponse({ success: false, error: error.message || '文件操作失败' });
      }
    })();
    return true; // 保持消息通道开放
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
      }, 5 * 60 * 1000), // 5分钟超时
      responceCallback: sendResponse
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

  // 处理文件操作请求
  if (request.type === 'EXECUTE_FILE_OPERATION') {
    (async () => {
      try {
        // 如果指定了标签页ID，在指定标签页中执行操作
        if (request.tabId) {
          const result = await executeFileOperationInTab(request.tabId, request.operation);
          sendResponse(result);
        } else {
          // 否则在后台脚本中执行操作
          const result = await fileOperationManager.executeOperation(request.operation);
          sendResponse(result);
        }
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message,
          operation: request.operation.operation,
          platform: request.operation.platform,
          executionTime: 0,
          data: null,
          logs: [{
            timestamp: Date.now(),
            level: 'error',
            message: error.message
          }]
        });
      }
    })();
    return true; // 保持消息通道开放
  }

  // 处理在标签页中执行 file-ops 接口的请求
  if (request.type === 'EXECUTE_FILE_OPS_IN_TAB') {
    (async () => {
      try {
        // 直接调用现有的 file-ops 接口
        const result = await fileOperationManager.executeOperation(request.operation);
        sendResponse(result);
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message,
          operation: request.operation.operation,
          platform: request.operation.platform,
          executionTime: 0,
          data: null,
          logs: [{
            timestamp: Date.now(),
            level: 'error',
            message: error.message
          }]
        });
      }
    })();
    return true; // 保持消息通道开放
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

  // 新增：链式操作相关消息处理
  if (request.action === 'MUTLIPOST_EXTENSION_CHAIN_ACTION') {
    const chainActionData = {
      action: request.data.action,
      config: request.data.config,
      traceId: request.traceId
    };
    currentChainActionData = chainActionData;

    (async () => {
      await chrome.windows.create({
        url: chrome.runtime.getURL(`tabs/chain-action.html`),
        type: 'popup',
        width: 800,
        height: 600,
      });
    })();
  }

  if (request.action === 'MUTLIPOST_EXTENSION_CHAIN_ACTION_REQUEST_DATA') {
    sendResponse({ config: currentChainActionData });
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
      currentPublishRequest.responceCallback?.(aggregatedResult);
      console.log('已向原始标签页发送聚合结果');
    }
  } catch (error) {
    console.error('向原始标签页发送结果失败:', error);
  }

  // 清理当前发布请求状态
  currentPublishRequest = null;
}
starter(1000 * 10);
// Message Handler || 消息处理器 || END

// Keep Alive || 保活机制 || START
const quantumKeepAlive = new QuantumEntanglementKeepAlive();
quantumKeepAlive.startEntanglementProcess();
// Keep Alive || 保活机制 || END
