export {}

import type { PlasmoCSConfig } from "plasmo"

declare global {
  interface Window {
    createBaiduYunShare?: (
      paths?: string[],
      options?: {
        validPeriod?: string
        extractCodeType?: string
        customCode?: string
      },
    ) => Promise<unknown>
  }
}

export const config: PlasmoCSConfig = {
  matches: ["https://pan.baidu.com/*"],
  world: "MAIN",
  run_at: "document_start"
}

window.createBaiduYunShare = async function (
  paths: string[] = [],
  options: {
    validPeriod?: string
    extractCodeType?: string
    customCode?: string
  } = {},
) {
  return new Promise((resolve, reject) => {
    const requestId = `share-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

    const responseHandler = (event: MessageEvent) => {
      if (
        event.data?.type !== "response" ||
        event.data?.traceId !== requestId ||
        event.data?.action !== "MUTLIPOST_EXTENSION_FILE_OPERATION"
      ) {
        return
      }

      window.removeEventListener("message", responseHandler)

      if (event.data.code === 0) {
        resolve(event.data.data)
        return
      }

      reject(new Error(event.data.message || "百度网盘文件操作失败"))
    }

    window.addEventListener("message", responseHandler)

    window.postMessage(
      {
        type: "request",
        action: "MUTLIPOST_EXTENSION_FILE_OPERATION",
        traceId: requestId,
        data: {
          platform: "baiduyun",
          operation: "share",
          params: {
            paths,
            shareConfig: {
              validPeriod: options.validPeriod || "7天",
              extractCodeType: options.extractCodeType || "随机生成",
              customCode: options.customCode
            }
          }
        }
      },
      "*",
    )

    setTimeout(() => {
      window.removeEventListener("message", responseHandler)
      reject(new Error("百度网盘文件操作超时"))
    }, 30000)
  })
}

console.log("[MultiPost Extension] 百度网盘文件操作功能已就绪")
