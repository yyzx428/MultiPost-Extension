/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Module from "node:module"
import path from "node:path"

export type ModuleMockOptions = {
  projectDistRoot: string
}

export function installBackgroundModuleMocks(opts: ModuleMockOptions) {
  const originalLoad: any = (Module as any)._load

  const distRoot = opts.projectDistRoot
  const stub = (p: string) => path.join(distRoot, "tests-node", "stubs", ...p.split("/")) // p uses posix-like separators
  const storageData = new Map<string, any>()

  const isFromBackgroundIndex = (parent: any) => {
    const filename = String(parent?.filename || "")
    return filename.replace(/\\/g, "/").endsWith("/src/background/index.js")
  }

  ;(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
    // A minimal in-memory implementation of @plasmohq/storage.
    if (request === "@plasmohq/storage") {
      return {
        Storage: class Storage {
          constructor(_opts?: any) {}
          async get<T = any>(key: string): Promise<T | undefined> {
            return storageData.get(key)
          }
          async set(key: string, value: any): Promise<void> {
            storageData.set(key, value)
          }
          async remove(key: string): Promise<void> {
            storageData.delete(key)
          }
        }
      }
    }

    // Resolve tsconfig path aliases that TypeScript does not rewrite in emitted CJS.
    if (request === "~sync/common") {
      return originalLoad(stub("sync/common.js"), parent, isMain)
    }
    if (request === "~sync/account") {
      return originalLoad(stub("sync/account.js"), parent, isMain)
    }
    if (request === "~utils/config") {
      return originalLoad(stub("utils/config.js"), parent, isMain)
    }

    // Stub keep-alive to avoid setInterval side effects.
    if (isFromBackgroundIndex(parent) && request === "../utils/keep-alive") {
      return {
        __esModule: true,
        default: class QuantumEntanglementKeepAlive {
          startEntanglementProcess() {}
        }
      }
    }

    // Stub file-ops to control executeOperation behavior.
    if (isFromBackgroundIndex(parent) && request === "../file-ops") {
      return {
        fileOperationManager: {
          executeOperation: async () => ({
            success: true,
            operation: "share",
            platform: "baiduyun",
            executionTime: 0,
            data: { ok: true },
            logs: []
          })
        }
      }
    }

    // Ensure starter() doesn't run network code on import, but preserve other exports.
    if (isFromBackgroundIndex(parent) && request === "./services/api") {
      const actual = originalLoad(request, parent, isMain)
      return { ...actual, starter: () => {} }
    }

    // Fall back to normal loading.
    return originalLoad(request, parent, isMain)
  }

  return () => {
    ;(Module as any)._load = originalLoad
  }
}

export function distPath(distRoot: string, ...parts: string[]) {
  return path.join(distRoot, ...parts)
}
