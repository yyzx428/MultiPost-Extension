export {};
import type { PlasmoCSConfig } from 'plasmo';
import type { ExtensionExternalRequest, ExtensionExternalResponse } from '~types/external';

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_start',
};

window.addEventListener('message', async (event) => {
  console.debug(event);
  const request: ExtensionExternalRequest<unknown> = event.data;

  if (request.type !== 'request') {
    return;
  }

  defaultHandler(request, event);
});

function defaultHandler<T>(request: ExtensionExternalRequest<T>, event: MessageEvent) {
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
