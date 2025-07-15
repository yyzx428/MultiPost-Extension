/* eslint-disable prefer-const */

export { };
import type { PlasmoCSConfig } from 'plasmo';
import { handleBilibiliImageUpload } from './helper/bilibili';
import { handleBlueskyVideoUpload, handleBlueskyImageUpload } from './helper/bluesky';

export const config: PlasmoCSConfig = {
  matches: ['https://t.bilibili.com/*', 'https://bsky.app/*', 'https://www.v2ex.com/write*', 'https://v2ex.com/write*', 'https://pan.baidu.com/*'],
  world: 'MAIN',
  run_at: 'document_start',
};

interface CodeMirrorElement extends HTMLDivElement {
  CodeMirror: {
    setValue: (content: string) => void;
  };
}

let originalCreateElement = document.createElement.bind(document);
export let createdInputs: HTMLInputElement[] = [];

document.createElement = function (tagName, options) {
  let element = originalCreateElement(tagName, options);
  if (tagName.toLowerCase() === 'input') {
    createdInputs.push(element);
  }
  return element;
};

function handleMessage(event: MessageEvent) {
  const data = event.data;

  if (data.type === 'BILIBILI_DYNAMIC_UPLOAD_IMAGES') {
    handleBilibiliImageUpload(event);
  } else if (data.type === 'BLUESKY_VIDEO_UPLOAD') {
    handleBlueskyVideoUpload(event);
  } else if (data.type === 'BLUESKY_IMAGE_UPLOAD') {
    handleBlueskyImageUpload(event);
  } else if (data.type === 'V2EX_DYNAMIC_UPLOAD') {
    const editor = document.querySelector('.CodeMirror') as CodeMirrorElement;
    if (editor) {
      editor.CodeMirror.setValue(data.content);
    }
  } else if (data.type === 'request' && data.action === 'MUTLIPOST_EXTENSION_FILE_OPERATION') {
    // 处理文件操作请求
    handleFileOperationRequest(data);
  }
}

// 添加事件监听器
window.addEventListener('message', handleMessage);

/**
 * 执行百度云分享操作
 * @param paths 路径数组
 * @param shareConfig 分享配置
 * @returns 分享结果
 */
async function performBaiduYunShare(
  paths: string[],
  shareConfig: { validPeriod: string; extractCodeType: string; customCode?: string }
): Promise<unknown> {
  try {
    console.log('[Helper] 执行百度云分享操作:', { paths, shareConfig });

    // 调用 file-ops 模块的百度云分享功能
    const result = await callFileOpsShare(paths, shareConfig);

    console.log('[Helper] 百度云分享操作完成:', result);
    return result;
  } catch (error) {
    console.error('[Helper] 百度云分享操作失败:', error);
    throw error;
  }
}

/**
 * 调用 file-ops 模块的分享功能
 * @param paths 路径数组
 * @param shareConfig 分享配置
 * @returns 分享结果
 */
async function callFileOpsShare(
  paths: string[],
  shareConfig: { validPeriod: string; extractCodeType: string; customCode?: string }
): Promise<unknown> {
  try {
    console.log('[Helper] 开始调用 file-ops 分享功能');

    // 直接调用 file-ops 模块的分享功能
    // 由于 helper.ts 在页面上下文中运行，我们需要通过 chrome.runtime.sendMessage 调用 background script

    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'MUTLIPOST_EXTENSION_EXECUTE_FILE_OPS',
        data: {
          platform: 'baiduyun',
          operation: 'share',
          params: {
            paths,
            shareConfig
          }
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`发送消息失败: ${chrome.runtime.lastError.message}`));
          return;
        }

        if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || '分享操作失败'));
        }
      });

      // 设置超时
      setTimeout(() => {
        reject(new Error('file-ops 分享操作超时'));
      }, 120000); // 2分钟超时
    });

    console.log('[Helper] file-ops 分享功能调用成功:', result);
    return result;

  } catch (error) {
    console.error('[Helper] file-ops 分享功能调用失败:', error);
    throw error;
  }
}

/**
 * 处理文件操作请求
 * @param data 请求数据
 */
async function handleFileOperationRequest(data: {
  type: string;
  action: string;
  traceId: string;
  data: {
    platform: string;
    operation: string;
    params: { paths: string[]; shareConfig: { validPeriod: string; extractCodeType: string; customCode?: string } };
  };
}) {
  try {
    console.log('[Helper] 收到文件操作请求:', data);

    // 检查是否在百度网盘页面
    if (!window.location.hostname.includes('pan.baidu.com')) {
      throw new Error('当前页面不支持文件操作');
    }

    // 根据操作类型调用相应的函数
    if (data.data.platform === 'baiduyun' && data.data.operation === 'share') {
      // 直接调用百度云文件操作功能，而不是通过 postMessage 循环调用
      const result = await performBaiduYunShare(
        data.data.params.paths,
        data.data.params.shareConfig
      );

      // 发送成功响应
      window.postMessage({
        type: 'response',
        action: 'MUTLIPOST_EXTENSION_FILE_OPERATION',
        traceId: data.traceId,
        code: 0,
        data: result
      }, '*');
    } else {
      throw new Error(`不支持的操作: ${data.data.platform}.${data.data.operation}`);
    }
  } catch (error) {
    console.error('[Helper] 文件操作失败:', error);

    // 发送错误响应
    let msg = '未知错误';
    if (typeof error === 'object' && error && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
      msg = (error as { message: string }).message;
    } else if (typeof error === 'string') {
      msg = error;
    }
    window.postMessage({
      type: 'response',
      action: 'MUTLIPOST_EXTENSION_FILE_OPERATION',
      traceId: data.traceId,
      code: 1,
      message: msg
    }, '*');
  }
}

//===================================
// 文件操作功能集成
//===================================

// 仅在百度网盘页面加载文件操作功能
if (window.location.hostname.includes('pan.baidu.com')) {

  // 创建百度云分享函数
  (window as unknown as { createBaiduYunShare: (paths: string[], options: { validPeriod: string; extractCodeType: string; customCode?: string }) => Promise<unknown> }).createBaiduYunShare = async function (paths: string[] = [], options: { validPeriod?: string; extractCodeType?: string; customCode?: string } = {}) {
    return new Promise((resolve, reject) => {
      const requestId = `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 监听响应
      const responseHandler = (event: MessageEvent) => {
        if (event.data.type === 'response' &&
          event.data.traceId === requestId &&
          event.data.action === 'MUTLIPOST_EXTENSION_FILE_OPERATION') {

          window.removeEventListener('message', responseHandler);

          if (event.data.code === 0) {
            resolve(event.data.data);
          } else {
            reject(new Error(event.data.message || '操作失败'));
          }
        }
      };

      window.addEventListener('message', responseHandler);

      // 发送请求
      window.postMessage({
        type: 'request',
        action: 'MUTLIPOST_EXTENSION_FILE_OPERATION',
        traceId: requestId,
        data: {
          platform: 'baiduyun',
          operation: 'share',
          params: {
            paths,
            shareConfig: {
              validPeriod: options.validPeriod || '7天',
              extractCodeType: options.extractCodeType || '随机生成',
              customCode: options.customCode
            }
          }
        }
      }, '*');

      // 超时处理
      setTimeout(() => {
        window.removeEventListener('message', responseHandler);
        reject(new Error('操作超时'));
      }, 30000);
    });
  };

  // 通用文件操作接口
  (window as unknown as { multipostExtension: { fileOperation: (request: unknown) => Promise<unknown> } }).multipostExtension = {
    fileOperation: async function (request: unknown) {
      return new Promise((resolve, reject) => {
        const requestId = `file-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // 监听响应
        const responseHandler = (event: MessageEvent) => {
          if (event.data.type === 'response' &&
            event.data.traceId === requestId &&
            event.data.action === 'MUTLIPOST_EXTENSION_FILE_OPERATION') {

            window.removeEventListener('message', responseHandler);

            if (event.data.code === 0) {
              resolve(event.data.data);
            } else {
              reject(new Error(event.data.message || '操作失败'));
            }
          }
        };

        window.addEventListener('message', responseHandler);

        // 发送请求
        window.postMessage({
          type: 'request',
          action: 'MUTLIPOST_EXTENSION_FILE_OPERATION',
          traceId: requestId,
          data: request
        }, '*');

        // 超时处理
        const timeout = (request as { params?: { timeout?: number } }).params?.timeout || 30000;
        setTimeout(() => {
          window.removeEventListener('message', responseHandler);
          reject(new Error(`操作超时 (${timeout}ms)`));
        }, timeout);
      });
    }
  };

  // 调试工具
  (window as unknown as { multipostExtensionDebug: { checkStatus: () => { fileOpsReady: boolean; currentPlatform: string; timestamp: string }; testShare: (paths: string[]) => Promise<unknown> } }).multipostExtensionDebug = {
    checkStatus: () => {
      return {
        fileOpsReady: true,
        currentPlatform: window.location.hostname,
        timestamp: new Date().toISOString()
      };
    },

    testShare: async (paths = ['测试文件夹']) => {
      try {
        const result = await (window as unknown as { createBaiduYunShare: (paths: string[]) => Promise<unknown> }).createBaiduYunShare(paths);
        console.log('测试结果:', result);
        return result;
      } catch (error) {
        console.error('测试失败:', error);
        throw error;
      }
    }
  };

  console.log('[MultiPost Extension] 百度云文件操作功能已就绪');
}
