export const API_BASE_URL = process.env.PLASMO_PUBLIC_API_BASE_URL || ""

export const APP_NAME = "MultiPost Extension"

function getManifestVersion() {
  if (typeof chrome === "undefined" || !chrome.runtime?.getManifest) {
    return ""
  }

  return chrome.runtime.getManifest().version
}

export const APP_CONFIG = {
  API: {
    BASE_URL: API_BASE_URL,
    PING_ENDPOINT: `${API_BASE_URL}/api/extension/ping`
  },
  APP: {
    NAME: APP_NAME,
    VERSION: getManifestVersion()
  },
  IS_DEV: process.env.NODE_ENV === "development"
} as const

export type AppConfig = typeof APP_CONFIG
