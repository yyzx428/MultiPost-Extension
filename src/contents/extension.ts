export {}

import type { PlasmoCSConfig } from "plasmo"
import { Storage } from "@plasmohq/storage"

import { executeFileOperation } from "~file-ops"
import type { FileOperation } from "~file-ops/types"
import type { ExtensionExternalRequest, ExtensionExternalResponse } from "~types/external"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

const storage = new Storage({ area: "local" })

const ACTIONS_NOT_NEED_TRUST_DOMAIN = [
  "MUTLIPOST_EXTENSION_REQUEST_TRUST_DOMAIN",
  "MUTLIPOST_EXTENSION_FILE_OPERATION"
]

let publishRequestSource: MessageEventSource | null = null
let publishRequestTraceId: string | null = null

async function isOriginTrusted(origin: string, action: string): Promise<boolean> {
  if (ACTIONS_NOT_NEED_TRUST_DOMAIN.includes(action)) return true

  const trustedDomains = (await storage.get<Array<{ domain: string }>>("trustedDomains")) || []
  return trustedDomains.some(({ domain }) => {
    if (domain.startsWith("*.")) return origin.endsWith(domain.slice(2))
    return origin === domain
  })
}

function successResponse<T>(request: ExtensionExternalRequest<T>, data: T) {
  return {
    type: "response",
    traceId: request.traceId,
    action: request.action,
    code: 0,
    message: "success",
    data
  } as ExtensionExternalResponse<T>
}

function failureResponse<T>(
  request: ExtensionExternalRequest<T>,
  code: number,
  message: string,
  data: unknown = null,
) {
  return {
    type: "response",
    traceId: request.traceId,
    action: request.action,
    code,
    message,
    data
  } as ExtensionExternalResponse<unknown>
}

function isFailurePayload(value: unknown): value is { success: false; error?: string; errorCode?: string } {
  return (
    !!value &&
    typeof value === "object" &&
    "success" in (value as Record<string, unknown>) &&
    (value as { success?: unknown }).success === false
  )
}

window.addEventListener("message", async (event) => {
  const request: ExtensionExternalRequest<unknown> = event.data
  if (request?.type !== "request") return

  const isTrusted = await isOriginTrusted(new URL(event.origin).hostname, request.action)
  if (!isTrusted) {
    event.source?.postMessage(failureResponse(request, 403, "UNTRUSTED_ORIGIN"))
    return
  }

  if (request.action === "MUTLIPOST_EXTENSION_PUBLISH") {
    publishRequestSource = event.source
    publishRequestTraceId = request.traceId
  }

  await defaultHandler(request, event)
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.action !== "MUTLIPOST_EXTENSION_PUBLISH_COMPLETE") return
  if (!publishRequestSource || !publishRequestTraceId) return

  publishRequestSource.postMessage({
    type: "response",
    traceId: publishRequestTraceId,
    action: "MUTLIPOST_EXTENSION_PUBLISH_COMPLETE",
    code: 0,
    message: "success",
    data: message.data
  })

  publishRequestSource = null
  publishRequestTraceId = null
})

async function defaultHandler<T>(request: ExtensionExternalRequest<T>, event: MessageEvent) {
  if (request.action === "MUTLIPOST_EXTENSION_FILE_OPERATION") {
    try {
      const result = await executeFileOperation(request.data as FileOperation)
      event.source?.postMessage(successResponse(request, result as T))
    } catch (error) {
      event.source?.postMessage(
        failureResponse(request, 500, error instanceof Error ? error.message : String(error)),
      )
    }
    return
  }

  try {
    const response = await chrome.runtime.sendMessage(request)
    if (isFailurePayload(response)) {
      event.source?.postMessage(
        failureResponse(
          request,
          500,
          response.errorCode || response.error || "BACKGROUND_REJECTED",
          response,
        ),
      )
      return
    }

    event.source?.postMessage(successResponse(request, response))
  } catch (error) {
    event.source?.postMessage(
      failureResponse(request, 500, error instanceof Error ? error.message : String(error)),
    )
  }
}
