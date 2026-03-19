/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest"

async function importBackgroundIndexFresh() {
  vi.resetModules()
  await import("../../src/background/index")
}

describe("background message flows (black-box)", () => {
  it("trust-domain confirm flow resolves original sendResponse", async () => {
    await importBackgroundIndexFresh()

    const chromeAny: any = globalThis.chrome

    const pending = chromeAny.runtime.__dispatchMessage(
      { action: "MUTLIPOST_EXTENSION_REQUEST_TRUST_DOMAIN", data: {} },
      { origin: "https://example.com" }
    )

    expect(chromeAny.__records.windowsCreated.length).toBe(1)
    const created = chromeAny.__records.windowsCreated[0]
    expect(String(created.url)).toContain("tabs/trust-domain.html#")

    // Simulate popup confirm message.
    chromeAny.runtime.__dispatchMessage({
      type: "MUTLIPOST_EXTENSION_TRUST_DOMAIN_CONFIRM",
      origin: "example.com",
      trusted: true,
      status: "confirm"
    })

    await expect(pending).resolves.toEqual({ trusted: true, status: "confirm" })
  })

  it("link-extension confirm flow resolves original sendResponse", async () => {
    await importBackgroundIndexFresh()

    const chromeAny: any = globalThis.chrome

    const pending = chromeAny.runtime.__dispatchMessage({
      action: "MUTLIPOST_EXTENSION_LINK_EXTENSION",
      data: { apiKey: "x" }
    })

    expect(chromeAny.__records.windowsCreated.length).toBe(1)
    const created = chromeAny.__records.windowsCreated[0]
    expect(String(created.url)).toContain("tabs/link-extension.html#")

    chromeAny.runtime.__dispatchMessage({
      type: "MUTLIPOST_EXTENSION_LINK_EXTENSION_CONFIRM",
      confirm: true
    })

    await expect(pending).resolves.toEqual({ confirm: true })
  })

  it("publish result aggregation resolves original sendResponse", async () => {
    await importBackgroundIndexFresh()

    const chromeAny: any = globalThis.chrome

    const pending = chromeAny.runtime.__dispatchMessage(
      {
        action: "MUTLIPOST_EXTENSION_PUBLISH",
        traceId: "t1",
        data: {
          platforms: [{ name: "A" }, { name: "B" }],
          data: { title: "x" }
        }
      },
      { tab: { id: 99, windowId: 100 } }
    )

    expect(chromeAny.__records.windowsCreated.length).toBe(1)
    expect(String(chromeAny.__records.windowsCreated[0].url)).toContain("tabs/publish.html")

    // Send 2 results => should aggregate immediately.
    chromeAny.runtime.__dispatchMessage({
      action: "MUTLIPOST_EXTENSION_PUBLISH_RESULT",
      data: {
        traceId: "t1",
        platformName: "A",
        success: true,
        publishUrl: "u1",
        timestamp: Date.now()
      }
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

    const result = await pending
    expect(result.status).toBe("FAILED")
    expect(result.totalPlatforms).toBe(2)
    expect(result.successCount).toBe(1)
    expect(result.failureCount).toBe(1)
    expect(result.results).toHaveLength(2)
  })

  it("execute file ops via action routes to fileOperationManager and responds", async () => {
    await importBackgroundIndexFresh()

    const chromeAny: any = globalThis.chrome

    const res = await chromeAny.runtime.__dispatchMessage({
      action: "MUTLIPOST_EXTENSION_EXECUTE_FILE_OPS",
      data: {
        platform: "baiduyun",
        operation: "share",
        params: { paths: [], shareConfig: { validPeriod: "7天", extractCodeType: "随机生成" } }
      }
    })

    expect(res).toEqual({ success: true, data: { ok: true } })
  })

  it("execute file ops via content-script protocol forwards response to tab", async () => {
    await importBackgroundIndexFresh()

    const chromeAny: any = globalThis.chrome

    const pending = chromeAny.runtime.__dispatchMessage(
      {
        type: "request",
        action: "MUTLIPOST_EXTENSION_EXECUTE_FILE_OPS",
        traceId: "x",
        data: {
          platform: "baiduyun",
          operation: "share",
          params: { paths: [], shareConfig: { validPeriod: "7天", extractCodeType: "随机生成" } }
        }
      },
      { tab: { id: 123 } }
    )

    await expect(pending).resolves.toEqual({ success: true, data: { ok: true } })

    expect(chromeAny.__records.tabsSentMessages.length).toBe(1)
    const sent = chromeAny.__records.tabsSentMessages[0]
    expect(sent.tabId).toBe(123)
    expect(sent.message.type).toBe("response")
    expect(sent.message.action).toBe("MUTLIPOST_EXTENSION_EXECUTE_FILE_OPS")
    expect(sent.message.traceId).toBe("x")
    expect(sent.message.code).toBe(0)
  })

  it("tabs manager add + request tabs", async () => {
    await importBackgroundIndexFresh()

    const chromeAny: any = globalThis.chrome

    const addRes = await chromeAny.runtime.__dispatchMessage({
      type: "MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_ADD_TABS",
      data: { platforms: [], data: {} },
      tabs: [{ tab: { id: 10 }, platformInfo: { injectUrl: "https://x" } }]
    })
    expect(addRes).toBe("success")

    const list = await chromeAny.runtime.__dispatchMessage({
      type: "MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_TABS"
    })
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBe(1)
    expect(list[0].tabs[0].tab.id).toBe(10)
  })
})
