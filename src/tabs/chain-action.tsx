import "~style.css"

import { Storage } from "@plasmohq/storage"
import { Button, HeroUIProvider, NumberInput, Progress, Switch, Tooltip } from "@heroui/react"
import React, { useEffect, useMemo, useRef, useState } from "react"

import cssText from "data-text:~style.css"

import { executeChainActionByName, getAvailableChainActions, type ChainActionBase } from "~chain-actions"
import type { ChainActionExecutionResult, ChainActionStageResult } from "~types/execution"

const storage = new Storage({ area: "local" })

const AUTO_CLOSE_KEY = "chain-action-auto-close"
const AUTO_CLOSE_DELAY_KEY = "chain-action-auto-close-delay"
const DEFAULT_AUTO_CLOSE_DELAY = 120
const MIN_AUTO_CLOSE_DELAY = 5

type ChainActionConfig = {
  action: string
  config: Record<string, unknown>
  traceId?: string
  taskId?: string
}

type ChainActionCompleteAck = {
  success: boolean
  error?: string
  errorCode?: string
  data?: ChainActionExecutionResult
}

function t(key: string, fallback: string, substitutions?: string | number | Array<string | number>) {
  const payload =
    substitutions === undefined
      ? undefined
      : Array.isArray(substitutions)
        ? substitutions.map((item) => String(item))
        : String(substitutions)

  const message = chrome.i18n.getMessage(key, payload as string | string[] | undefined)
  return message || fallback
}

function formatStatusLabel(status: ChainActionStageResult["status"] | ChainActionExecutionResult["status"]) {
  switch (status) {
    case "SUCCESS":
    case "COMPLETED":
      return t("publishStatusSuccess", "Success")
    case "FAILED":
      return t("publishStatusFailed", "Failed")
    case "TIMEOUT":
      return t("publishStatusTimeout", "Timeout")
    default:
      return status
  }
}

function formatStageName(stageName: string) {
  switch (stageName) {
    case "baiduShare":
      return t("chainActionStageBaiduShare", "Baidu Share")
    case "redPublish":
      return t("chainActionStageRedPublish", "Rednote Publish")
    case "agisoPublish":
      return t("chainActionStageAgisoPublish", "Agiso Publish")
    default:
      return stageName
  }
}

function normalizeAutoCloseDelay(value: unknown) {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? parseInt(value, 10) : Number.NaN

  if (!Number.isFinite(parsed) || parsed < MIN_AUTO_CLOSE_DELAY) {
    return DEFAULT_AUTO_CLOSE_DELAY
  }

  return parsed
}

export function getShadowContainer() {
  return document.querySelector("#test-shadow")?.shadowRoot?.querySelector("#plasmo-shadow-container")
}

export const getShadowHostId = () => "test-shadow"

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

export default function ChainActionModal() {
  const [config, setConfig] = useState<ChainActionConfig | null>(null)
  const [availableActions, setAvailableActions] = useState<ChainActionBase[]>([])
  const [isExecuting, setIsExecuting] = useState(true)
  const [notice, setNotice] = useState(() => t("chainActionPreparing", "Preparing chain action"))
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState<ChainActionExecutionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoClose, setAutoClose] = useState(true)
  const [autoCloseDelay, setAutoCloseDelay] = useState(DEFAULT_AUTO_CLOSE_DELAY)
  const [countdown, setCountdown] = useState(0)
  const autoCloseTimerRef = useRef<number>()
  const countdownTimerRef = useRef<number>()
  const autoCloseDelayRef = useRef(DEFAULT_AUTO_CLOSE_DELAY)
  const hasExecutedRef = useRef(false)

  const stages = useMemo(() => result?.stages || [], [result])

  function addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`])
  }

  function clearAutoCloseTimers() {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
  }

  function startAutoCloseTimer(delaySeconds = autoCloseDelayRef.current) {
    clearAutoCloseTimers()
    setCountdown(delaySeconds)

    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearAutoCloseTimers()
          window.close()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    autoCloseTimerRef.current = window.setTimeout(() => {
      window.close()
    }, delaySeconds * 1000)
  }

  function applyFinalResult(nextResult: ChainActionExecutionResult) {
    setResult(nextResult)
    setIsExecuting(false)
    setNotice(
      nextResult.status === "COMPLETED"
        ? t("chainActionCompleted", "Chain action completed")
        : t("chainActionFailed", "Chain action failed"),
    )
    addLog(
      t(
        "chainActionFinishedLog",
        "Chain action finished with status: $1",
        formatStatusLabel(nextResult.status),
      ),
    )

    if (nextResult.status === "COMPLETED") {
      setError(null)
      if (autoClose) startAutoCloseTimer()
      return
    }

    setError(nextResult.errorMessage || t("chainActionFailed", "Chain action failed"))
  }

  function notifyBackgroundComplete(nextResult: ChainActionExecutionResult): Promise<ChainActionExecutionResult> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "MUTLIPOST_EXTENSION_CHAIN_ACTION_COMPLETE", data: nextResult },
        (response?: ChainActionCompleteAck) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          if (!response) {
            resolve(nextResult)
            return
          }

          if (response.success === false) {
            reject(new Error(response.errorCode || response.error || "BACKGROUND_REJECTED"))
            return
          }

          resolve(response.data || nextResult)
        },
      )
    })
  }

  useEffect(() => {
    return () => clearAutoCloseTimers()
  }, [])

  useEffect(() => {
    setAvailableActions(getAvailableChainActions())

    Promise.all([storage.get(AUTO_CLOSE_KEY), storage.get(AUTO_CLOSE_DELAY_KEY)]).then(
      async ([storedAutoClose, storedDelay]) => {
        setAutoClose(storedAutoClose === undefined ? true : storedAutoClose === "true")
        const nextDelay = normalizeAutoCloseDelay(storedDelay)
        setAutoCloseDelay(nextDelay)
        autoCloseDelayRef.current = nextDelay
        if (storedDelay === undefined || String(storedDelay) !== String(nextDelay)) {
          await storage.set(AUTO_CLOSE_DELAY_KEY, String(nextDelay))
        }
      },
    )

    chrome.runtime.sendMessage({ action: "MUTLIPOST_EXTENSION_CHAIN_ACTION_REQUEST_DATA" }, (response) => {
      const nextConfig = response?.config as ChainActionConfig | undefined
      if (!nextConfig) {
        setNotice(t("chainActionLoadFailed", "Unable to load chain action"))
        setError(t("chainActionLoadFailed", "Unable to load chain action"))
        setIsExecuting(false)
        return
      }

      setConfig(nextConfig)
      addLog(t("chainActionLoadedLog", "Loaded chain action: $1", nextConfig.action))
    })
  }, [])

  useEffect(() => {
    if (!config || hasExecutedRef.current) return

    hasExecutedRef.current = true
    setIsExecuting(true)
    setNotice(t("chainActionExecuting", "Executing chain action"))

    ;(async () => {
      try {
        const localResult = (await executeChainActionByName(config.action, config.config)) as ChainActionExecutionResult
        const finalResult = await notifyBackgroundComplete(localResult)
        applyFinalResult(finalResult)
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
        let failedResult: ChainActionExecutionResult = {
          kind: "chain-action",
          status: "FAILED",
          totalPlatforms: 0,
          successCount: 0,
          failureCount: 0,
          results: [],
          stages: [],
          errorCode: "BACKGROUND_REJECTED",
          errorMessage: message
        }

        try {
          failedResult = await notifyBackgroundComplete(failedResult)
        } catch (reportError) {
          failedResult = {
            ...failedResult,
            errorCode: "BACKGROUND_REJECTED",
            errorMessage: reportError instanceof Error ? reportError.message : String(reportError)
          }
        }

        applyFinalResult(failedResult)
      }
    })()
  }, [autoClose, config])

  function getTitle() {
    if (!config) return t("chainActionTitle", "Chain Action")
    return availableActions.find((item) => item.name === config.action)?.name || config.action
  }

  function renderStage(stage: ChainActionStageResult) {
    const color =
      stage.status === "SUCCESS" ? "text-green-600" : stage.status === "FAILED" ? "text-red-600" : "text-orange-600"

    return (
      <div key={stage.stageName} className="rounded border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{formatStageName(stage.stageName)}</span>
          <span className={`text-xs ${color}`}>{formatStatusLabel(stage.status)}</span>
        </div>
        {stage.errorMessage && <p className="mt-1 text-xs text-red-600">{stage.errorMessage}</p>}
      </div>
    )
  }

  return (
    <HeroUIProvider>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <h2 className="text-center text-xl font-semibold text-foreground">{t("chainActionTitle", "Chain Action")}</h2>
          <p className="truncate text-center text-sm text-muted-foreground">{getTitle()}</p>

          <Progress
            value={result ? 100 : undefined}
            isIndeterminate={isExecuting}
            aria-label={notice}
            size="sm"
            className="w-full"
          />
          <p className="text-center text-sm text-muted-foreground">{notice}</p>

          {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {stages.length > 0 && <div className="space-y-2">{stages.map(renderStage)}</div>}

          {logs.length > 0 && (
            <div className="space-y-2">
              <p className="text-center text-sm text-muted-foreground">{t("chainActionLogs", "Logs")}</p>
              <div className="h-32 overflow-y-auto rounded border bg-gray-50 p-2 font-mono text-xs">
                {logs.map((log, index) => (
                  <div key={`${log}-${index}`}>{log}</div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tooltip
                  content={t("chainActionAutoCloseTooltip", "Only auto close after a successful execution.")}
                  placement="top"
                  className="max-w-xs">
                  <Switch
                    isSelected={autoClose}
                    onChange={async (event) => {
                      const checked = event.target.checked
                      setAutoClose(checked)
                      await storage.set(AUTO_CLOSE_KEY, String(checked))
                      if (!checked) {
                        clearAutoCloseTimers()
                        setCountdown(0)
                      } else if (result?.status === "COMPLETED") {
                        startAutoCloseTimer()
                      }
                    }}
                    size="sm">
                    <span className="text-sm text-gray-700">{t("publishAutoClose", "Auto close")}</span>
                  </Switch>
                </Tooltip>

                {autoClose && (
                  <div className="ml-2 flex items-center gap-1">
                    <NumberInput
                      hideStepper
                      size="sm"
                      variant="underlined"
                      min={5}
                      value={autoCloseDelay}
                      onChange={async (value) => {
                        const next = normalizeAutoCloseDelay(value)
                        setAutoCloseDelay(next)
                        autoCloseDelayRef.current = next
                        await storage.set(AUTO_CLOSE_DELAY_KEY, String(next))
                        if (result?.status === "COMPLETED" && autoClose) {
                          startAutoCloseTimer(next)
                        }
                      }}
                      className="w-16"
                    />
                    <span className="text-xs text-gray-500">{t("publishSecondsUnit", "sec")}</span>
                  </div>
                )}
              </div>

              {autoClose && countdown > 0 && (
                <span className="text-xs font-medium text-orange-700">
                  {t("publishAutoCloseCountdown", "Auto close in $1 sec", countdown)}
                </span>
              )}
            </div>
          </div>

          {!isExecuting && (
            <Button color="primary" className="w-full" onPress={() => window.close()}>
              {t("finishPublishing", "Finish")}
            </Button>
          )}
        </div>
      </div>
    </HeroUIProvider>
  )
}
