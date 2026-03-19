export interface MultipostInfo {
  traceId: string
  platformName: string
  startTime: number
  tabId?: number
}

export interface MultipostSendResult {
  (success: boolean, publishUrl?: string, errorMessage?: string, errorCode?: string): void
}

export type FileOperationPlatform = "baiduyun" | "aliyun" | "onedrive"
export type FileOperationType = "share" | "download" | "organize" | "search"
export type FileOperationValidPeriod = "1天" | "7天" | "30天" | "365天" | "永久有效"
export type FileOperationExtractCodeType = "不设置" | "随机生成" | "自定义"

export interface FileOperationRequest {
  platform: FileOperationPlatform
  operation: FileOperationType
  params: {
    paths: string[]
    timeout?: number
    shareConfig?: {
      validPeriod: FileOperationValidPeriod
      extractCodeType: FileOperationExtractCodeType
      customCode?: string
      hideUserInfo?: boolean
    }
    downloadConfig?: Record<string, unknown>
    organizeConfig?: Record<string, unknown>
  }
}

export interface FileOperationLog {
  timestamp: number
  level: "info" | "warn" | "error" | "debug"
  message: string
  details?: Record<string, unknown> | string | number | boolean | null
}

export interface FileOperationResponse {
  success: boolean
  operation: string
  platform: string
  executionTime: number
  data: unknown
  logs: FileOperationLog[]
}

export interface MultipostExtension {
  fileOperation(request: FileOperationRequest): Promise<FileOperationResponse>
}

declare global {
  interface Window {
    multipostSendResult?: MultipostSendResult
    multipostInfo?: MultipostInfo
    multipostExtension?: MultipostExtension
  }
}

export {}
