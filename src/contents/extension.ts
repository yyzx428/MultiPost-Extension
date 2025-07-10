export { };
import type { PlasmoCSConfig } from 'plasmo';
import type { ExtensionExternalRequest, ExtensionExternalResponse } from '~types/external';
import { Storage } from '@plasmohq/storage';
import { executeFileOperation, detectCurrentPlatform } from '~file-ops';

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_start',
};

const storage = new Storage({
  area: 'local',
});

const ACTIONS_NOT_NEED_TRUST_DOMAIN = [
  'MUTLIPOST_EXTENSION_REQUEST_TRUST_DOMAIN',
  'MUTLIPOST_EXTENSION_FILE_OPERATION'
];

async function isOriginTrusted(origin: string, action: string): Promise<boolean> {
  if (ACTIONS_NOT_NEED_TRUST_DOMAIN.includes(action)) {
    return true;
  }

  const trustedDomains = (await storage.get<Array<{ domain: string }>>('trustedDomains')) || [];

  return trustedDomains.some(({ domain }) => {
    if (domain.startsWith('*.')) {
      const wildCardDomain = domain.slice(2);
      return origin.endsWith(wildCardDomain);
    }
    return origin === domain;
  });
}

// 存储原始发布请求的source和traceId，用于后续结果回传
let publishRequestSource: MessageEventSource | null = null;
let publishRequestTraceId: string | null = null;

window.addEventListener('message', async (event) => {
  const request: ExtensionExternalRequest<unknown> = event.data;

  if (request.type !== 'request') {
    return;
  }

  // 验证来源是否可信
  const isTrusted = await isOriginTrusted(new URL(event.origin).hostname, request.action);
  if (!isTrusted) {
    event.source.postMessage({
      type: 'response',
      traceId: request.traceId,
      action: request.action,
      code: 403,
      message: 'Untrusted origin',
      data: null,
    } as ExtensionExternalResponse<null>);
    return;
  }

  // 如果是发布请求，保存source和traceId用于后续结果回传
  if (request.action === 'MUTLIPOST_EXTENSION_PUBLISH') {
    publishRequestSource = event.source;
    publishRequestTraceId = request.traceId;
  }

  defaultHandler(request, event);
});

// 监听来自背景脚本的发布完成消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'MUTLIPOST_EXTENSION_PUBLISH_COMPLETE') {
    // 将聚合结果转发给原始发起窗口
    if (publishRequestSource && publishRequestTraceId) {
      publishRequestSource.postMessage({
        type: 'response',
        traceId: publishRequestTraceId,
        action: 'MUTLIPOST_EXTENSION_PUBLISH_COMPLETE',
        code: 0,
        message: 'success',
        data: message.data,
      });

      console.log('已向原始发起窗口发送发布完成结果:', message.data);

      // 清理引用
      publishRequestSource = null;
      publishRequestTraceId = null;
    }
  }
});

async function defaultHandler<T>(request: ExtensionExternalRequest<T>, event: MessageEvent) {
  // 处理文件操作请求
  if (request.action === 'MUTLIPOST_EXTENSION_FILE_OPERATION') {
    try {
      const result = await executeFileOperation(request.data as any);
      event.source.postMessage(successResponse(request, result as T));
    } catch (error) {
      event.source.postMessage({
        type: 'response',
        traceId: request.traceId,
        action: request.action,
        code: 500,
        message: error.message,
        data: null,
      } as ExtensionExternalResponse<null>);
    }
    return;
  }

  // 其他请求通过background script处理
  chrome.runtime.sendMessage(request).then((response) => {
    event.source.postMessage(successResponse(request, response));
  });
}

function successResponse<T>(request: ExtensionExternalRequest<T>, data: T) {
  return {
    type: 'response',
    traceId: request.traceId,
    action: request.action,
    code: 0,
    message: 'success',
    data,
  } as ExtensionExternalResponse<T>;
}
