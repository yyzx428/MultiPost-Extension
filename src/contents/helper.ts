/* eslint-disable prefer-const */

export { };
import type { PlasmoCSConfig } from 'plasmo';
import { handleBilibiliImageUpload } from './helper/bilibili';
import { handleBlueskyVideoUpload, handleBlueskyImageUpload } from './helper/bluesky';
import { APP_NAME } from '~utils/config';

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
  }
}

// 添加事件监听器
window.addEventListener('message', handleMessage);

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

  console.log(`[${APP_NAME}] 百度云文件操作功能已就绪`);
}


