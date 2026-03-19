/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
export type SyncDataPlatform = any
export type SyncData = any
export type FileData = {
  name: string
  url: string
  type?: string
  size?: number
  contentDataUrl?: string
}

export async function getPlatformInfos() {
  return []
}

export async function createTabsForPlatforms(_data: any) {
  return []
}

export async function injectScriptsToTabs(_tabs: any, _data: any) {
  return null
}
