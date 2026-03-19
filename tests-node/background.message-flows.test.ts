/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import assert from "node:assert/strict"
import path from "node:path"

import { createChromeMock } from "./chrome-mock"
import { installBackgroundModuleMocks, distPath } from "./module-mock"

function clearRequireCacheBySuffix(suffixes: string[]) {
  for (const key of Object.keys(require.cache)) {
    const norm = key.replace(/\\/g, "/")
    if (suffixes.some((s) => norm.endsWith(s))) {
      delete require.cache[key]
    }
  }
}

async function loadBackgroundIndex(distRoot: string) {
  const restore = installBackgroundModuleMocks({ projectDistRoot: distRoot })
  try {
    // Ensure a clean import.
    clearRequireCacheBySuffix(["/src/background/index.js"])
    require(distPath(distRoot, "src", "background", "index.js"))
  } finally {
    restore()
  }
}

export type TestCase = { name: string; fn: () => Promise<void> }

function newContext() {
  const distRoot = path.resolve(__dirname, "..")
  const chromeAny: any = createChromeMock()
  ;(globalThis as any).chrome = chromeAny
  delete (globalThis as any).__TEST_API_SERVICE_MOCK__
  return { distRoot, chromeAny }
}

export const tests: TestCase[] = [
  {
    name: "trust-domain confirm flow",
    fn: async () => {
      const { distRoot, chromeAny } = newContext()
      await loadBackgroundIndex(distRoot)

      const pending = chromeAny.runtime.__dispatchMessage(
        { action: "MUTLIPOST_EXTENSION_REQUEST_TRUST_DOMAIN", data: {} },
        { origin: "https://example.com" }
      )

      // trust-domain handler awaits storage.get() before opening the popup.
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))

      assert.equal(chromeAny.__records.windowsCreated.length, 1)
      assert.ok(String(chromeAny.__records.windowsCreated[0].url).includes("tabs/trust-domain.html#"))

      chromeAny.runtime.__dispatchMessage({
        type: "MUTLIPOST_EXTENSION_TRUST_DOMAIN_CONFIRM",
        origin: "example.com",
        trusted: true,
        status: "confirm"
      })

      const res = await pending
      assert.deepEqual(res, { trusted: true, status: "confirm" })
    }
  },
  {
    name: "link-extension confirm flow",
    fn: async () => {
      const { distRoot, chromeAny } = newContext()
      await loadBackgroundIndex(distRoot)

      const pending = chromeAny.runtime.__dispatchMessage({
        action: "MUTLIPOST_EXTENSION_LINK_EXTENSION",
        data: { apiKey: "x" }
      })

      assert.equal(chromeAny.__records.windowsCreated.length, 1)
      assert.ok(String(chromeAny.__records.windowsCreated[0].url).includes("tabs/link-extension.html#"))

      chromeAny.runtime.__dispatchMessage({
        type: "MUTLIPOST_EXTENSION_LINK_EXTENSION_CONFIRM",
        confirm: true
      })

      const res = await pending
      assert.deepEqual(res, { confirm: true })
    }
  },
  {
    name: "publish aggregation flow",
    fn: async () => {
      const { distRoot, chromeAny } = newContext()
      await loadBackgroundIndex(distRoot)

      const pending = chromeAny.runtime.__dispatchMessage(
        {
          action: "MUTLIPOST_EXTENSION_PUBLISH",
          traceId: "t1",
          data: { platforms: [{ name: "A" }, { name: "B" }], data: { title: "x" } }
        },
        { tab: { id: 99, windowId: 100 } }
      )

      assert.equal(chromeAny.__records.windowsCreated.length, 1)
      assert.ok(String(chromeAny.__records.windowsCreated[0].url).includes("tabs/publish.html"))

      chromeAny.runtime.__dispatchMessage({
        action: "MUTLIPOST_EXTENSION_PUBLISH_RESULT",
        data: { traceId: "t1", platformName: "A", success: true, publishUrl: "u1", timestamp: Date.now() }
      })
      chromeAny.runtime.__dispatchMessage({
        action: "MUTLIPOST_EXTENSION_PUBLISH_RESULT",
        data: {
          traceId: "t1",
          platformName: "B",
          success: false,
          publishUrl: "u2",
          errorMessage: "fail",
          timestamp: Date.now()
        }
      })

      const res = await pending
      assert.equal(res.status, "FAILED")
      assert.equal(res.totalPlatforms, 2)
      assert.equal(res.successCount, 1)
      assert.equal(res.failureCount, 1)
      assert.equal(res.results.length, 2)
    }
  },
  {
    name: "execute file ops via action responds",
    fn: async () => {
      const { distRoot, chromeAny } = newContext()
      await loadBackgroundIndex(distRoot)

      const res = await chromeAny.runtime.__dispatchMessage({
        action: "MUTLIPOST_EXTENSION_EXECUTE_FILE_OPS",
        data: { platform: "baiduyun", operation: "share", params: { paths: [] } }
      })

      assert.deepEqual(res, { success: true, data: { ok: true } })
    }
  },
  {
    name: "execute file ops via content-script protocol forwards response to tab",
    fn: async () => {
      const { distRoot, chromeAny } = newContext()
      await loadBackgroundIndex(distRoot)

      const pending = chromeAny.runtime.__dispatchMessage(
        {
          type: "request",
          action: "MUTLIPOST_EXTENSION_EXECUTE_FILE_OPS",
          traceId: "x",
          data: { platform: "baiduyun", operation: "share", params: { paths: [] } }
        },
        { tab: { id: 123 } }
      )

      const res = await pending
      assert.deepEqual(res, { success: true, data: { ok: true } })

      assert.equal(chromeAny.__records.tabsSentMessages.length, 1)
      const sent = chromeAny.__records.tabsSentMessages[0]
      assert.equal(sent.tabId, 123)
      assert.equal(sent.message.type, "response")
      assert.equal(sent.message.action, "MUTLIPOST_EXTENSION_EXECUTE_FILE_OPS")
      assert.equal(sent.message.traceId, "x")
      assert.equal(sent.message.code, 0)
    }
  },
  {
    name: "chain action completion persists task result",
    fn: async () => {
      const { distRoot, chromeAny } = newContext()
      const persistedPayloads: any[] = []
      ;(globalThis as any).__TEST_API_SERVICE_MOCK__ = {
        getExtensionLinkState: async () => ({
          apiKey: "token",
          extensionClientId: "client-1",
          isLinked: true
        }),
        reportTaskResult: async (payload: any) => {
          persistedPayloads.push(payload)
          return { ok: true }
        }
      }

      await loadBackgroundIndex(distRoot)

      const pending = chromeAny.runtime.__dispatchMessage(
        {
          action: "MUTLIPOST_EXTENSION_CHAIN_ACTION",
          traceId: "chain-1",
          data: { action: "baidu-agiso", config: { foo: "bar" }, taskId: "task-1" }
        },
        { tab: { id: 10, windowId: 20 } }
      )

      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))

      assert.equal(chromeAny.__records.windowsCreated.length, 1)
      assert.ok(String(chromeAny.__records.windowsCreated[0].url).includes("tabs/chain-action.html"))

      const completionAck = await chromeAny.runtime.__dispatchMessage({
        action: "MUTLIPOST_EXTENSION_CHAIN_ACTION_COMPLETE",
        data: {
          kind: "chain-action",
          status: "FAILED",
          totalPlatforms: 2,
          successCount: 0,
          failureCount: 2,
          results: [],
          stages: [
            {
              stageName: "baiduShare",
              status: "FAILED",
              startedAt: "2026-03-18T00:00:00.000Z",
              finishedAt: "2026-03-18T00:00:01.000Z",
              errorCode: "BAIDUYUN_SHARE_RESULT_INVALID",
              errorMessage: "BAIDUYUN_SHARE_RESULT_INVALID"
            },
            {
              stageName: "agisoPublish",
              status: "FAILED",
              startedAt: "2026-03-18T00:00:01.000Z",
              finishedAt: "2026-03-18T00:00:02.000Z",
              errorMessage: "agisoPublish stage not started"
            }
          ],
          errorCode: "BAIDUYUN_SHARE_RESULT_INVALID",
          errorMessage: "BAIDUYUN_SHARE_RESULT_INVALID"
        }
      })

      assert.equal(completionAck.success, true)
      assert.equal(completionAck.data.status, "FAILED")
      assert.equal(persistedPayloads.length, 1)
      assert.equal(persistedPayloads[0].taskId, "task-1")
      assert.equal(persistedPayloads[0].extensionClientId, "client-1")

      const res = await pending
      assert.equal(res.status, "FAILED")
      assert.equal(res.errorCode, "BAIDUYUN_SHARE_RESULT_INVALID")
    }
  },
  {
    name: "chain action persist failure surfaces task result persist error",
    fn: async () => {
      const { distRoot, chromeAny } = newContext()
      ;(globalThis as any).__TEST_API_SERVICE_MOCK__ = {
        getExtensionLinkState: async () => ({
          apiKey: "token",
          extensionClientId: "client-1",
          isLinked: true
        }),
        reportTaskResult: async () => {
          throw new Error("TASK_RESULT_PERSIST_FAILED:500")
        }
      }

      await loadBackgroundIndex(distRoot)

      const pending = chromeAny.runtime.__dispatchMessage({
        action: "MUTLIPOST_EXTENSION_CHAIN_ACTION",
        traceId: "chain-2",
        data: { action: "baidu-agiso", config: {}, taskId: "task-2" }
      })

      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))

      const completionAck = await chromeAny.runtime.__dispatchMessage({
        action: "MUTLIPOST_EXTENSION_CHAIN_ACTION_COMPLETE",
        data: {
          kind: "chain-action",
          status: "FAILED",
          totalPlatforms: 2,
          successCount: 0,
          failureCount: 2,
          results: [],
          stages: [],
          errorCode: "BAIDUYUN_SHARE_RESULT_INVALID",
          errorMessage: "BAIDUYUN_SHARE_RESULT_INVALID"
        }
      })

      assert.equal(completionAck.success, true)
      assert.equal(completionAck.data.errorCode, "TASK_RESULT_PERSIST_FAILED")
      assert.equal(completionAck.data.errorMessage, "TASK_RESULT_PERSIST_FAILED:500")

      const res = await pending
      assert.equal(res.status, "FAILED")
      assert.equal(res.errorCode, "TASK_RESULT_PERSIST_FAILED")
    }
  },
  {
    name: "tabs manager add + request tabs",
    fn: async () => {
      const { distRoot, chromeAny } = newContext()
      await loadBackgroundIndex(distRoot)

      const addRes = await chromeAny.runtime.__dispatchMessage({
        type: "MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_ADD_TABS",
        data: { platforms: [], data: {} },
        tabs: [{ tab: { id: 10 }, platformInfo: { injectUrl: "https://x" } }]
      })
      assert.equal(addRes, "success")

      const list = await chromeAny.runtime.__dispatchMessage({ type: "MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_TABS" })
      assert.ok(Array.isArray(list))
      assert.equal(list.length, 1)
      assert.equal(list[0].tabs[0].tab.id, 10)
    }
  }
]
