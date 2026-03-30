import type { SyncData, YunPanData } from "~sync/common"

type PublishResult = {
  success: boolean
  publishUrl?: string
  errorCode?: string
  errorMessage?: string
}

export async function BaiduYunPan(data: SyncData): Promise<PublishResult> {
  const { paths, files } = data.data as YunPanData

  const createPublishError = (code: string, message: string) => {
    const error = new Error(message)
    error.name = code
    return error
  }

  const sendResult = (
    success: boolean,
    publishUrl?: string,
    errorMessage?: string,
    errorCode?: string,
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (typeof win.multipostSendResult === "function") {
      win.multipostSendResult(success, publishUrl, errorMessage, errorCode)
    }
  }

  const waitForAnyElement = async (selectors: string[], timeout = 10000) =>
    new Promise<Element>((resolve, reject) => {
      const find = () => {
        for (const selector of selectors) {
          const element = document.querySelector(selector)
          if (element) return element
        }

        return null
      }

      const current = find()
      if (current) {
        resolve(current)
        return
      }

      const observer = new MutationObserver(() => {
        const next = find()
        if (next) {
          observer.disconnect()
          resolve(next)
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      setTimeout(() => {
        observer.disconnect()
        reject(
          createPublishError(
            "SCRIPT_INJECTION_FAILED",
            `Element not found: ${selectors.join(" | ")}`,
          ),
        )
      }, timeout)
    })

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const findButtonByText = (text: string) =>
    Array.from(document.querySelectorAll("button")).find((element) =>
      (element.textContent || "").includes(text),
    ) as HTMLButtonElement | undefined

  const clickElement = (element: Element | null | undefined) => {
    if (!element) return

    const target = (element.closest("button, a, [role='button']") || element) as HTMLElement
    target.click()
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  }

  const getCurrentPathSegments = () => {
    const hash = window.location.hash || ""
    const match = hash.match(/(?:\?|&)path=([^&]+)/)
    if (!match?.[1]) return [] as string[]

    try {
      return decodeURIComponent(match[1]).split("/").filter(Boolean)
    } catch {
      return []
    }
  }

  const getRemainingPaths = () => {
    const currentSegments = getCurrentPathSegments()
    let prefixLength = 0

    while (prefixLength < currentSegments.length && prefixLength < paths.length) {
      if (currentSegments[prefixLength] !== paths[prefixLength]) break
      prefixLength += 1
    }

    return paths.slice(prefixLength)
  }

  const waitForPageReady = async () => {
    await waitForAnyElement(
      [
        'button[title="新建文件夹"]',
        'input[title="点击选择文件"]',
        'input[placeholder="搜索我的文件"]',
        ".wp-s-main__empty-title",
        ".wp-s-agile-tool-bar__item"
      ],
      15000,
    )
  }

  const dismissBlockingDialogs = () => {
    const bodyText = document.body?.innerText || ""
    if (!bodyText.includes("下载百度网盘客户端")) return

    const rejectButton = findButtonByText("暂时不了")
    if (rejectButton) {
      clickElement(rejectButton)
      return
    }

    const closeButton = Array.from(document.querySelectorAll("i, button")).find((element) => {
      const htmlElement = element as HTMLElement
      return (
        htmlElement.className.includes("u-dialog__close") ||
        htmlElement.className.includes("u-icon-close")
      )
    })

    clickElement(closeButton)
  }

  const findDirectory = (name: string) => {
    const byTitle = document.querySelector(`a[title="${name}"]`)
    if (byTitle) return byTitle as HTMLElement

    const candidates = Array.from(
      document.querySelectorAll(
        "a, span, div, td, tr, li, button",
      ),
    ).filter((element) => (element.textContent || "").trim() === name)

    for (const candidate of candidates) {
      const clickable = candidate.closest("a, button, [role='button'], tr, li")
      if (clickable) return clickable as HTMLElement
      if (candidate instanceof HTMLElement) return candidate
    }

    return null
  }

  const setInputValue = (input: HTMLInputElement, value: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")
    descriptor?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }

  const confirmWithEnter = (input: HTMLInputElement) => {
    const keyboardEventInit: KeyboardEventInit = {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13
    }

    input.dispatchEvent(new KeyboardEvent("keydown", keyboardEventInit))
    input.dispatchEvent(new KeyboardEvent("keypress", keyboardEventInit))
    input.dispatchEvent(new KeyboardEvent("keyup", keyboardEventInit))
  }

  const createFolder = async (name: string) => {
    const createButton =
      (document.querySelector('button[title="新建文件夹"]') as HTMLElement | null) ||
      findButtonByText("新建文件夹")

    if (!createButton) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to find Baidu Yun create folder button")
    }

    clickElement(createButton)
    await sleep(800)

    const folderInput = Array.from(document.querySelectorAll("input.u-input__inner")).find((element) => {
      const input = element as HTMLInputElement
      return input.placeholder !== "搜索我的文件"
    }) as HTMLInputElement | undefined

    if (!folderInput) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to find Baidu Yun folder input")
    }

    folderInput.focus()
    setInputValue(folderInput, name)
    confirmWithEnter(folderInput)
    await sleep(2000)

    if (findDirectory(name)) {
      return
    }

    const confirmIcon = (folderInput.closest("tr, li, div")?.querySelector(
      "i.iconfont.icon-check, i.u-icon-check",
    ) ||
      document.querySelector("i.iconfont.icon-check, i.u-icon-check")) as HTMLElement | null

    if (!confirmIcon) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to confirm Baidu Yun folder name")
    }

    clickElement(confirmIcon)
    await sleep(3000)
  }

  const countUploadedFiles = () => {
    const pageText = document.body?.innerText || ""
    return files.filter((file) => pageText.includes(file.name)).length
  }

  const loadFileBlob = async (fileInfo: YunPanData["files"][number]) => {
    const response = await fetch(fileInfo.contentDataUrl || fileInfo.url)
    if (!response.ok) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", `Failed to fetch file: ${fileInfo.name}`)
    }

    return await response.blob()
  }

  const uploadFiles = async () => {
    const fileInput = (document.querySelector('input[title="点击选择文件"]') ||
      document.querySelector('input[type="file"]')) as HTMLInputElement | null

    if (!fileInput) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to find Baidu Yun upload input")
    }

    const dataTransfer = new DataTransfer()

    for (const fileInfo of files) {
      const blob = await loadFileBlob(fileInfo)
      dataTransfer.items.add(new File([blob], fileInfo.name, { type: fileInfo.type || blob.type }))
    }

    if (dataTransfer.files.length !== files.length) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Cloud file payload is incomplete")
    }

    fileInput.files = dataTransfer.files
    fileInput.dispatchEvent(new Event("change", { bubbles: true }))
    fileInput.dispatchEvent(new Event("input", { bubbles: true }))
  }

  try {
    if (!files?.length) {
      throw createPublishError("BAIDUYUN_UPLOAD_INCOMPLETE", "No files provided for Baidu Yun upload")
    }

    await waitForPageReady()
    dismissBlockingDialogs()
    await sleep(2000)

    for (const path of getRemainingPaths()) {
      await waitForPageReady()
      dismissBlockingDialogs()

      let directory = findDirectory(path)
      if (!directory) {
        await createFolder(path)
        directory = findDirectory(path)
      }

      if (!directory) {
        throw createPublishError("SCRIPT_INJECTION_FAILED", `Unable to find Baidu Yun folder: ${path}`)
      }

      clickElement(directory)
      await sleep(3000)
    }

    await uploadFiles()
    await sleep(60000)

    const uploadedCount = countUploadedFiles()
    if (uploadedCount < files.length) {
      throw createPublishError(
        "BAIDUYUN_UPLOAD_INCOMPLETE",
        `Expected ${files.length} uploaded files, found ${uploadedCount}`,
      )
    }

    sendResult(true, window.location.href)
    return {
      success: true,
      publishUrl: window.location.href
    }
  } catch (error) {
    const errorCode =
      error instanceof Error && error.name && error.name !== "Error"
        ? error.name
        : "SCRIPT_INJECTION_FAILED"
    const errorMessage = error instanceof Error ? error.message : String(error)
    sendResult(false, window.location.href, errorMessage, errorCode)
    return {
      success: false,
      publishUrl: window.location.href,
      errorCode,
      errorMessage
    }
  }
}
