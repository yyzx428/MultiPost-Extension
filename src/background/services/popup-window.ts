type PopupWindowOptions = {
  url: string
  width?: number
  height?: number
  focused?: boolean
}

const DEFAULT_POPUP_WIDTH = 800
const DEFAULT_POPUP_HEIGHT = 600

export async function createSafePopupWindow(options: PopupWindowOptions) {
  return await chrome.windows.create({
    url: options.url,
    type: "popup",
    width: options.width ?? DEFAULT_POPUP_WIDTH,
    height: options.height ?? DEFAULT_POPUP_HEIGHT,
    focused: options.focused ?? true
  })
}
