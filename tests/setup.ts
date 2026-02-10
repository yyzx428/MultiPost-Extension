/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
import { afterEach, beforeAll, vi } from "vitest"
import { createChromeMock } from "./chrome-mock"

// A minimal in-memory implementation of @plasmohq/storage used by background code.
class InMemoryStorage {
  private store = new Map<string, any>()
  constructor(_opts?: any) {}
  async get<T = any>(key: string): Promise<T | undefined> {
    return this.store.get(key)
  }
  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value)
  }
  async remove(key: string): Promise<void> {
    this.store.delete(key)
  }
}

beforeAll(() => {
  vi.useFakeTimers()

  // Ensure global crypto.randomUUID exists (used by background code).
  if (!globalThis.crypto) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { webcrypto } = require("node:crypto")
    // @ts-expect-error polyfill for test env
    globalThis.crypto = webcrypto
  }

  vi.stubGlobal("chrome", createChromeMock())
})

vi.mock("@plasmohq/storage", () => {
  return { Storage: InMemoryStorage }
})

// Prevent background keep-alive side effects from doing anything meaningful in tests.
vi.mock("../src/utils/keep-alive", () => {
  return {
    default: class QuantumEntanglementKeepAlive {
      startEntanglementProcess() {}
    }
  }
})

// Prevent starter() from pinging/fetching on import. Keep other exports intact.
vi.mock("../src/background/services/api", async () => {
  const actual = await vi.importActual<any>("../src/background/services/api")
  return { ...actual, starter: () => {} }
})

// Provide a mockable fileOperationManager so tests can control the result.
vi.mock("../src/file-ops", async () => {
  const mod: any = await vi.importActual<any>("../src/file-ops")
  return {
    ...mod,
    fileOperationManager: {
      executeOperation: vi.fn(async () => ({
        success: true,
        operation: "share",
        platform: "baiduyun",
        executionTime: 0,
        data: { ok: true },
        logs: []
      }))
    }
  }
})

afterEach(() => {
  // Reset timers + mocks between tests.
  vi.clearAllMocks()
  vi.clearAllTimers()

  const chromeAny: any = globalThis.chrome
  chromeAny?.__resetAll?.()
})
