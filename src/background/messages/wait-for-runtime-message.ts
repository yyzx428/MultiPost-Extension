export type WaitForRuntimeMessageOptions = {
  timeoutMs: number
}

export function waitForRuntimeMessage<TMessage = unknown>(
  predicate: (message: unknown, sender: chrome.runtime.MessageSender) => boolean,
  opts: WaitForRuntimeMessageOptions,
): Promise<TMessage> {
  return new Promise<TMessage>((resolve, reject) => {
    let finished = false

    const timeoutId = setTimeout(() => {
      if (finished) return
      finished = true
      chrome.runtime.onMessage.removeListener(listener)
      reject(new Error("WAIT_FOR_MESSAGE_TIMEOUT"))
    }, opts.timeoutMs)

    const listener = (message: unknown, sender: chrome.runtime.MessageSender) => {
      if (finished) return
      let matched = false
      try {
        matched = predicate(message, sender)
      } catch {
        matched = false
      }
      if (!matched) return

      finished = true
      clearTimeout(timeoutId)
      chrome.runtime.onMessage.removeListener(listener)
      resolve(message as TMessage)
    }

    chrome.runtime.onMessage.addListener(listener)
  })
}

