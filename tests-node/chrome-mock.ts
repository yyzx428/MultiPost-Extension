/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
type Listener<TArgs extends any[]> = (...args: TArgs) => any

function createEvent<TArgs extends any[]>() {
  const listeners: Listener<TArgs>[] = []
  return {
    addListener(fn: Listener<TArgs>) {
      listeners.push(fn)
    },
    removeListener(fn: Listener<TArgs>) {
      const idx = listeners.indexOf(fn)
      if (idx >= 0) listeners.splice(idx, 1)
    },
    __listeners() {
      return [...listeners]
    },
    __clear() {
      listeners.length = 0
    }
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: any) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export type ChromeSender = {
  origin?: string
  tab?: { id?: number; windowId?: number }
}

export function createChromeMock() {
  const onMessage = createEvent<[any, ChromeSender, (resp: any) => void]>()
  const onInstalled = createEvent<[any]>()
  const tabsOnUpdated = createEvent<[number, any, any]>()
  const tabsOnRemoved = createEvent<[number]>()

  const windowsCreated: any[] = []
  const tabsSentMessages: Array<{ tabId: number; message: any }> = []

  const chromeMock: any = {
    runtime: {
      id: "test-extension-id",
      lastError: null as null | { message: string },
      OnInstalledReason: { INSTALL: "install" },
      onInstalled,
      onMessage,
      getURL: (path: string) =>
        `chrome-extension://test-extension-id/${String(path).replace(/^\/+/, "")}`,
      getManifest: () => ({ version: "0.0.0-test" }),
      openOptionsPage: async () => null,
      __dispatchMessage: (message: any, sender: ChromeSender = {}) => {
        const d = deferred<any>()
        let resolved = false
        const sendResponse = (resp: any) => {
          if (resolved) return
          resolved = true
          d.resolve(resp)
        }

        for (const listener of onMessage.__listeners()) {
          listener(message, sender, sendResponse)
        }

        return d.promise
      }
    },

    sidePanel: {
      setPanelBehavior: async (_opts: any) => null
    },

    tabs: {
      onUpdated: tabsOnUpdated,
      onRemoved: tabsOnRemoved,
      create: async (_opts: any) => ({ id: 1 }),
      update: async (tabId: number, _opts: any) => ({ id: tabId }),
      get: async (tabId: number) => ({ id: tabId }),
      remove: async (_tabIds: number | number[]) => null,
      sendMessage: async (tabId: number, message: any) => {
        tabsSentMessages.push({ tabId, message })
        return null
      }
    },

    windows: {
      create: async (opts: any) => {
        const w = { id: windowsCreated.length + 1, ...opts }
        windowsCreated.push(w)
        return w
      },
      update: async (_windowId: number, _opts: any) => null,
      getAll: async () => [{ id: 1, type: "normal" }]
    },

    scripting: {
      executeScript: async (_opts: any) => [{ result: null }]
    },

    __records: {
      windowsCreated,
      tabsSentMessages
    },

    __resetAll: () => {
      chromeMock.runtime.lastError = null
      chromeMock.runtime.onMessage.__clear()
      chromeMock.runtime.onInstalled.__clear()
      chromeMock.tabs.onUpdated.__clear()
      chromeMock.tabs.onRemoved.__clear()
      windowsCreated.length = 0
      tabsSentMessages.length = 0
    }
  }

  return chromeMock
}
