declare global {
  interface Window {
    __multipostInputTrackerInstalled?: boolean
  }
}

export const createdInputs: HTMLInputElement[] = []

export function installInputTracker() {
  if (window.__multipostInputTrackerInstalled) return

  const originalCreateElement = document.createElement.bind(document)
  document.createElement = function (
    tagName: string,
    options?: ElementCreationOptions,
  ): HTMLElement {
    const element = originalCreateElement(tagName, options) as HTMLElement

    if (tagName.toLowerCase() === "input" && element instanceof HTMLInputElement) {
      createdInputs.push(element)
    }

    return element
  } as Document["createElement"]

  window.__multipostInputTrackerInstalled = true
}
