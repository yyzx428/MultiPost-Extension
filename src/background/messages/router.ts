export type BackgroundMessageHandler = (
  request: unknown,
  sender: chrome.runtime.MessageSender,
) => unknown | Promise<unknown>

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return !!value && typeof (value as { then?: unknown }).then === "function"
}

export function createMessageRouter() {
  const handlers = new Map<string, BackgroundMessageHandler>()

  const register = (key: string, handler: BackgroundMessageHandler) => {
    handlers.set(key, handler)
  }

  const onMessage = (
    request: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    const key =
      (request as { action?: string; type?: string } | null)?.action ??
      (request as { action?: string; type?: string } | null)?.type
    const handler = key ? handlers.get(key) : undefined
    if (!handler) return

    try {
      const result = handler(request, sender)

      if (isPromiseLike(result)) {
        result
          .then((value) => sendResponse(value))
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err)
            sendResponse({ success: false, error: message })
          })
        return true
      }

      sendResponse(result)
      return
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      sendResponse({ success: false, error: message })
      return
    }
  }

  return { register, onMessage }
}
