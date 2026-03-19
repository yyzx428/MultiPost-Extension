export type ExecutionItemStatus = "SUCCESS" | "FAILED" | "TIMEOUT"
export type ExecutionTaskStatus = "COMPLETED" | "FAILED"
export type PublishPlatformRuntimeStatus = "pending" | "running" | "success" | "failed" | "timeout"

export interface PublishExecutionItem {
  platformName: string
  status: ExecutionItemStatus
  publishUrl?: string
  errorCode?: string
  errorMessage?: string
  startedAt: string
  finishedAt: string
  tabId?: number
}

export interface PublishExecutionResult {
  kind: "publish"
  traceId?: string
  status: ExecutionTaskStatus
  totalPlatforms: number
  successCount: number
  failureCount: number
  results: PublishExecutionItem[]
  errorCode?: string
  errorMessage?: string
}

export interface ChainActionStageResult {
  stageName: string
  status: ExecutionItemStatus
  startedAt: string
  finishedAt: string
  errorCode?: string
  errorMessage?: string
  details?: Record<string, unknown>
}

export interface ChainActionExecutionResult {
  kind: "chain-action"
  status: ExecutionTaskStatus
  totalPlatforms: number
  successCount: number
  failureCount: number
  results: PublishExecutionItem[]
  stages: ChainActionStageResult[]
  errorCode?: string
  errorMessage?: string
}

export interface PublishProgressPayload {
  traceId?: string
  status: ExecutionTaskStatus | "RUNNING"
  totalPlatforms: number
  successCount: number
  failureCount: number
  results: PublishExecutionItem[]
}

export interface TaskResultReportPayload {
  taskId: string
  extensionClientId: string
  status: ExecutionTaskStatus
  errorMessage?: string
  executionResult: PublishExecutionResult | ChainActionExecutionResult
}
