import { CollectionService } from './store';

export const collectionMessageHandler = (request, sender, sendResponse) => {
  switch (request.type) {
    case 'MUTLIPOST_EXTENSION_REQUEST_ADD_ITEM_TO_CURRENT_COLLECTION':
      console.log(request);
      CollectionService.getCurrentCollection()
        .then((currentCollection) => {
          if (!currentCollection) {
            setTimeout(() => {
              chrome.runtime.sendMessage({
                type: 'MUTLIPOST_EXTENSION_REQUEST_CHANGE_SIDEPANEL_TAB',
                tab: 'collection',
              });
            }, 1000);
          }

          return CollectionService.addItemToCollection(currentCollection.id, request.item).then(() => {
            chrome.runtime.sendMessage({
              type: 'MUTLIPOST_EXTENSION_COLLECTION_CHANGE',
              collectionId: currentCollection.id,
            });
          });
        })
        .then((newItem) => {
          sendResponse({ success: true, item: newItem });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      break;
    case 'MUTLIPOST_EXTENSION_REQUEST_OPEN_SIDEPANEL_COLLECTION':
      chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
        // 添加1秒延时
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: 'MUTLIPOST_EXTENSION_REQUEST_CHANGE_SIDEPANEL_TAB',
            tab: 'collection',
          });
          sendResponse({ success: true });
        }, 1000);
      });
      break;
  }
};
