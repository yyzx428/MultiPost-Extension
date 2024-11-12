/* eslint-disable @typescript-eslint/no-explicit-any */
export {};

import { tabsManagerHandleTabRemoved, tabsManagerHandleTabUpdated, tabsManagerMessageHandler } from './services/tabs';
import QuantumEntanglementKeepAlive from '../utils/keep-alive';
import { collectionMessageHandler } from './services/collection/collection';

chrome.runtime.onInstalled.addListener((object) => {
  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: 'https://multipost.2some.one/extension' });
  }
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

// Listen Message || 监听消息 || START
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  defaultMessageHandler(request, sender, sendResponse);
  tabsManagerMessageHandler(request, sender, sendResponse);
  collectionMessageHandler(request, sender, sendResponse);
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
const defaultMessageHandler = (request, sender, sendResponse) => {
  if (request.type === 'MUTLIPOST_EXTENSION_CHECK_SERVICE_STATUS') {
    sendResponse('success');
  }
};
// Message Handler || 消息处理器 || END

// Keep Alive || 保活机制 || START
const quantumKeepAlive = new QuantumEntanglementKeepAlive();
quantumKeepAlive.startEntanglementProcess();
// Keep Alive || 保活机制 || END
