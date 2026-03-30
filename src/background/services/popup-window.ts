type PopupWindowOptions = {
  url: string
  width?: number
  height?: number
  focused?: boolean
}

const DEFAULT_POPUP_WIDTH = 800
const DEFAULT_POPUP_HEIGHT = 600
const MIN_POPUP_WIDTH = 360
const MIN_POPUP_HEIGHT = 420
const WINDOW_MARGIN = 40

async function getAnchorWindow() {
  const windows = await chrome.windows.getAll()
  return (
    windows.find((windowInfo) => windowInfo.type === "normal" && windowInfo.focused) ||
    windows.find((windowInfo) => windowInfo.type === "normal")
  )
}

function buildCenteredCreateData(options: PopupWindowOptions, anchorWindow?: chrome.windows.Window) {
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
  const width = Math.min(desiredWidth, Math.max(MIN_POPUP_WIDTH, anchorWidth - WINDOW_MARGIN))
  const height = Math.min(desiredHeight, Math.max(MIN_POPUP_HEIGHT, anchorHeight - WINDOW_MARGIN))
  const left = anchorLeft + Math.max(0, Math.round((anchorWidth - width) / 2))
  const top = anchorTop + Math.max(0, Math.round((anchorHeight - height) / 2))

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
  const anchorWindow = await getAnchorWindow()

  try {
    return await chrome.windows.create(buildCenteredCreateData(options, anchorWindow))
  } catch (error) {
    console.warn("[MultiPost] centered popup create failed, retrying with default popup bounds", error)
  }

  try {
    return await chrome.windows.create({
      url: options.url,
      type: "popup",
      width: options.width ?? DEFAULT_POPUP_WIDTH,
      height: options.height ?? DEFAULT_POPUP_HEIGHT,
      focused: options.focused ?? true
    })
  } catch (error) {
    console.warn("[MultiPost] popup create failed, retrying with normal window", error)
  }

  return await chrome.windows.create({
    url: options.url,
    type: "normal",
    width: options.width ?? DEFAULT_POPUP_WIDTH,
    height: options.height ?? DEFAULT_POPUP_HEIGHT,
    focused: options.focused ?? true
  })
}
