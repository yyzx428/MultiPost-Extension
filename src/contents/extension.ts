export {};
import type { PlasmoCSConfig } from 'plasmo';
import type { ExtensionExternalRequest, ExtensionExternalResponse } from '~types/external';

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_start',
};

window.addEventListener('message', async (event) => {
  console.log(event);
  const request: ExtensionExternalRequest<unknown> = event.data;

  switch (request.action) {
    case 'MUTLIPOST_EXTENSION_REQUEST_CHECK_SERVICE_STATUS':
      chrome.runtime.sendMessage({ type: 'MUTLIPOST_EXTENSION_CHECK_SERVICE_STATUS' }).then((response) => {
        event.source.postMessage({
          traceId: request.traceId,
          action: 'MUTLIPOST_EXTENSION_RESPONSE_CHECK_SERVICE_STATUS',
          data: { extensionId: response.extensionId },
        } as ExtensionExternalResponse<{ extensionId: string }>);
      });
      break;
    
    case 'MUTLIPOST_EXTENSION_REQUEST_POST_DYNAMIC':
      chrome.runtime.sendMessage({ 
        type: 'MUTLIPOST_EXTENSION_POST_DYNAMIC',
        data: request.data 
      }).then((response) => {
        event.source.postMessage({
          traceId: request.traceId,
          action: 'MUTLIPOST_EXTENSION_RESPONSE_POST_DYNAMIC',
          data: response,
        } as ExtensionExternalResponse<unknown>);
      });
      break;
  }
});
