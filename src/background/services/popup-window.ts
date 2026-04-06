type PopupWindowOptions = {
  url: string
  width?: number
  height?: number
  focused?: boolean
  anchorWindowId?: number
}

const DEFAULT_POPUP_WIDTH = 800
const DEFAULT_POPUP_HEIGHT = 600
const MIN_POPUP_WIDTH = 360
const MIN_POPUP_HEIGHT = 420
const WINDOW_MARGIN = 40

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isBoundsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes("bounds")
}

async function getAnchorWindow(anchorWindowId?: number) {
  if (typeof anchorWindowId === "number") {
    try {
      const anchorWindow = await chrome.windows.get(anchorWindowId)
      if (anchorWindow.type === "normal") {
        return anchorWindow
      }
    } catch {
      // ignore
    }
  }

  const windows = await chrome.windows.getAll()
  return (
    windows.find((windowInfo) => windowInfo.type === "normal" && windowInfo.focused) ||
    windows.find((windowInfo) => windowInfo.type === "normal")
  )
}

function buildAnchoredCreateData(options: PopupWindowOptions, anchorWindow?: chrome.windows.Window) {
  const desiredWidth = options.width ?? DEFAULT_POPUP_WIDTH
  const desiredHeight = options.height ?? DEFAULT_POPUP_HEIGHT

  if (!anchorWindow) {
    return {
      url: options.url,
      type: "popup" as const,
      width: desiredWidth,
      height: desiredHeight,
      focused: options.focused ?? true
    }
  }

  const anchorLeft = anchorWindow.left ?? 0
  const anchorTop = anchorWindow.top ?? 0
  const anchorWidth = Math.max(anchorWindow.width ?? desiredWidth, MIN_POPUP_WIDTH)
  const anchorHeight = Math.max(anchorWindow.height ?? desiredHeight, MIN_POPUP_HEIGHT)
  const maxWidth = Math.max(MIN_POPUP_WIDTH, anchorWidth - WINDOW_MARGIN)
  const maxHeight = Math.max(MIN_POPUP_HEIGHT, anchorHeight - WINDOW_MARGIN)
  const width = Math.min(desiredWidth, maxWidth)
  const height = Math.min(desiredHeight, maxHeight)
  const left = anchorLeft + Math.max(0, Math.floor((anchorWidth - width) / 2))
  const top = anchorTop + Math.max(0, Math.floor((anchorHeight - height) / 2))

  return {
    url: options.url,
    type: "popup" as const,
    width,
    height,
    left,
    top,
    focused: options.focused ?? true
  }
}

export async function createSafePopupWindow(options: PopupWindowOptions) {
  const anchorWindow = await getAnchorWindow(options.anchorWindowId)
  const fallbackCreateData = {
    url: options.url,
    type: "popup" as const,
    width: options.width ?? DEFAULT_POPUP_WIDTH,
    height: options.height ?? DEFAULT_POPUP_HEIGHT,
    focused: options.focused ?? true
  }

  try {
    return await chrome.windows.create(buildAnchoredCreateData(options, anchorWindow))
  } catch (error) {
    if (!isBoundsError(error)) {
      throw error
    }
  }

  await sleep(800)

  try {
    return await chrome.windows.create(fallbackCreateData)
  } catch (error) {
    if (!isBoundsError(error)) {
      throw error
    }
  }

  await sleep(1500)

  return await chrome.windows.create(fallbackCreateData)
}
