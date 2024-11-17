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

  switch (request.action) {
    case 'MUTLIPOST_EXTENSION_REQUEST_CHECK_SERVICE_STATUS':
      chrome.runtime.sendMessage({ type: 'MUTLIPOST_EXTENSION_CHECK_SERVICE_STATUS' }).then((response) => {
        event.source.postMessage(successResponse(request, { extensionId: response.extensionId }));
      });
      break;
    
    case 'MUTLIPOST_EXTENSION_REQUEST_POST_DYNAMIC':
      chrome.runtime.sendMessage({
        type: 'MUTLIPOST_EXTENSION_POST_DYNAMIC',
        data: request.data,
      }).then((response) => {
        event.source.postMessage(successResponse(request, response));
      });
      break;

    case 'MULTIPOST_EXTENSION_REQUEST_OPEN_OPTIONS':
      chrome.runtime.sendMessage({
        type: 'MULTIPOST_EXTENSION_OPEN_OPTIONS',
      }).then((response) => {
        event.source.postMessage(successResponse(request, response));
      });
      break;
  }
});

function successResponse<T>(request: ExtensionExternalRequest<T>, data: T) {
  return {
    traceId: request.traceId,
    action: request.action,
    code: 0,
    message: 'success',
    data,
  } as ExtensionExternalResponse<T>;
}
