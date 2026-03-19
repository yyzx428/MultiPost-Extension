import { BaiduYunOperator } from "./platforms/baiduyun/operator"
import type {
  BasePlatformOperator,
  FileOperation,
  FileOperationPlatform,
  FileOperationResult
} from "./types"

export class FileOperationManager {
  private operators = new Map<FileOperationPlatform, BasePlatformOperator>()

  constructor() {
    this.operators.set("baiduyun", new BaiduYunOperator())
  }

  async executeOperation(operation: FileOperation): Promise<FileOperationResult> {
    const startTime = Date.now()

    try {
      const operator = this.getOperator(operation.platform)
      await this.validatePlatformState(operator, operation.platform)

      let data: unknown

      switch (operation.operation) {
        case "share":
          if (!operation.params.shareConfig) {
            throw new Error("Missing shareConfig")
          }

          if (operation.params.paths.length > 0) {
            data = await (operator as BaiduYunOperator).navigateAndShare(
              operation.params.paths,
              operation.params.shareConfig,
            )
          } else {
            data = await operator.share(operation.params.shareConfig)
          }

          if (
            !data ||
            typeof data !== "object" ||
            !("shareUrl" in (data as Record<string, unknown>)) ||
            typeof (data as { shareUrl?: unknown }).shareUrl !== "string" ||
            !(data as { shareUrl: string }).shareUrl.startsWith("http")
          ) {
            throw new Error("BAIDUYUN_SHARE_RESULT_INVALID")
          }
          break

        case "download":
          if (!operation.params.downloadConfig) {
            throw new Error("Missing downloadConfig")
          }

          if (operation.params.paths.length > 0) {
            await operator.navigate(operation.params.paths)
          }
          data = await operator.download(operation.params.downloadConfig)
          break

        case "organize":
          if (!operation.params.organizeConfig) {
            throw new Error("Missing organizeConfig")
          }

          if (operation.params.paths.length > 0) {
            await operator.navigate(operation.params.paths)
          }
          data = await operator.organize(operation.params.organizeConfig)
          break

        case "search":
          throw new Error("SEARCH_NOT_IMPLEMENTED")

        default:
          throw new Error(`Unsupported operation: ${operation.operation}`)
      }

      const logs = typeof (operator as { getLogs?: () => unknown }).getLogs === "function"
        ? (((operator as unknown as { getLogs: () => FileOperationResult["logs"] }).getLogs()) || [])
        : []

      return {
        success: true,
        operation: operation.operation,
        platform: operation.platform,
        executionTime: Date.now() - startTime,
        data,
        logs
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        operation: operation.operation,
        platform: operation.platform,
        executionTime: Date.now() - startTime,
        data: null,
        logs: [{ timestamp: Date.now(), level: "error", message }]
      }
    }
  }

  async executeBatchOperations(operations: FileOperation[]) {
    const results: FileOperationResult[] = []

    for (const operation of operations) {
      const result = await this.executeOperation(operation)
      results.push(result)
      if (!result.success && operation.operation === "share") break
    }

    return results
  }

  getSupportedPlatforms() {
    return Array.from(this.operators.keys())
  }

  isPlatformSupported(platform: FileOperationPlatform) {
    return this.operators.has(platform)
  }

  async getPlatformStatus(platform: FileOperationPlatform) {
    if (!this.isPlatformSupported(platform)) {
      return {
        supported: false,
        available: false,
        message: `Unsupported platform: ${platform}`
      }
    }

    try {
      const operator = this.getOperator(platform)
      await this.validatePlatformState(operator, platform)
      return {
        supported: true,
        available: true,
        message: "Platform available"
      }
    } catch (error) {
      return {
        supported: true,
        available: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async cleanup() {
    await Promise.allSettled(Array.from(this.operators.values()).map((operator) => operator.cleanup()))
  }

  private getOperator(platform: FileOperationPlatform) {
    const operator = this.operators.get(platform)
    if (!operator) {
      throw new Error(`Unsupported platform: ${platform}`)
    }

    return operator
  }

  private async validatePlatformState(operator: BasePlatformOperator, platform: FileOperationPlatform) {
    if (platform !== "baiduyun") return

    const validation = await (operator as BaiduYunOperator).validatePageState()
    if (!validation.valid) {
      throw new Error(validation.message)
    }
  }
}

export * from "./types"

const fileOperationManager = new FileOperationManager()

export { fileOperationManager }
export { BaiduYunOperator } from "./platforms/baiduyun/operator"

export const executeFileOperation = (operation: FileOperation) => fileOperationManager.executeOperation(operation)

export async function createBaiduYunShare(
  paths: string[],
  config = {
    validPeriod: "7天" as const,
    extractCodeType: "随机生成" as const
  },
) {
  return executeFileOperation({
    platform: "baiduyun",
    operation: "share",
    params: {
      paths,
      shareConfig: config
    }
  })
}

export function detectCurrentPlatform(): FileOperationPlatform | null {
  const hostname = window.location.hostname
  if (hostname.includes("pan.baidu.com")) {
    return "baiduyun"
  }

  return null
}
