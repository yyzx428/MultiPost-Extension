import { injectScriptsToTabs, type SyncData, type SyncDataPlatform } from "~sync/common"

// Tab Manager || 标签页管理 || START
export interface TabManagerMessage {
  syncData: SyncData
  tabs: {
    tab: chrome.tabs.Tab
    platformInfo: SyncDataPlatform
  }[]
}

const tabsManagerMessages: TabManagerMessage[] = []

const handleTabUpdated = (tabId: number, _changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
  tabsManagerMessages.forEach((group, index) => {
    const updatedTabs = group.tabs.map((item) => (item.tab.id === tabId ? { ...item, tab } : item))
    tabsManagerMessages[index] = { ...group, tabs: updatedTabs }
  })
}

const handleTabRemoved = (tabId: number) => {
  tabsManagerMessages.forEach((group, index) => {
    const filteredTabs = group.tabs.filter((item) => item.tab.id !== tabId)
    tabsManagerMessages[index] = { ...group, tabs: filteredTabs }
  })
}

export const getTabsManagerMessages = () => tabsManagerMessages

export const addTabsManagerMessages = (data: TabManagerMessage) => {
  tabsManagerMessages.push(data)
}

export const tabsManagerHandleTabUpdated = handleTabUpdated
export const tabsManagerHandleTabRemoved = handleTabRemoved

/**
 * New-style handler used by the background router.
 * Returns a value/Promise, router will call sendResponse.
 */
type TabsManagerRequest =
  | { type: "MUTLIPOST_EXTENSION_REQUEST_PUBLISH_RELOAD"; data: { tabId: number } }
  | { type: "MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_TABS" }
  | {
      type: "MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_ADD_TABS"
      data: SyncData
      tabs: Array<{ tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }>
    }

export const handleTabsManagerMessage = async (request: unknown) => {
  const req = request as Partial<TabsManagerRequest>

  if (req.type === "MUTLIPOST_EXTENSION_REQUEST_PUBLISH_RELOAD") {
    const { tabId } = (req as Extract<TabsManagerRequest, { type: "MUTLIPOST_EXTENSION_REQUEST_PUBLISH_RELOAD" }>).data
    const info = tabsManagerMessages.find((group) => group.tabs.some((t) => t.tab.id === tabId))
    const tabInfo = info?.tabs.find((t) => t.tab.id === tabId)

    if (!info || !tabInfo) {
      console.error(`Unable to find tab info for tabId ${tabId}`)
      return "error"
    }

    await chrome.tabs.update(tabId, { url: tabInfo.platformInfo.injectUrl, active: true })
    await injectScriptsToTabs([{ tab: tabInfo.tab, platformInfo: tabInfo.platformInfo }], info.syncData)
    return "success"
  }

  if (req.type === "MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_TABS") {
    return getTabsManagerMessages()
  }

  if (req.type === "MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_ADD_TABS") {
    const { data, tabs } = req as Extract<TabsManagerRequest, { type: "MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_ADD_TABS" }>
    addTabsManagerMessages({
      syncData: data,
      tabs: tabs.map((t) => ({ tab: t.tab, platformInfo: t.platformInfo }))
    })
    return "success"
  }

  return undefined
}

// Backward-compatible wrapper (kept to avoid touching unrelated callers).
export const tabsManagerMessageHandler = (
  request: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => {
  void handleTabsManagerMessage(request).then((res) => sendResponse(res))
  return true
}

// Tab Manager || 标签页管理 || END
