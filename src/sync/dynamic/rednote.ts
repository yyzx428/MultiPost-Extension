import type { DynamicData, SyncData } from "../common"

type PublishResult = {
  success: boolean
  publishUrl?: string
  errorCode?: string
  errorMessage?: string
}

function createPublishError(code: string, message: string) {
  const error = new Error(message)
  error.name = code
  return error
}

export async function DynamicRednote(data: SyncData): Promise<PublishResult> {
  const { title, content, images, tags, originalFlag, publishTime, shangpin } = data.data as DynamicData

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

  const sendResult = (success: boolean, publishUrl?: string, errorMessage?: string, errorCode?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (typeof win.multipostSendResult === "function") {
      win.multipostSendResult(success, publishUrl, errorMessage, errorCode)
    }
  }

  const fail = (errorCode: string, errorMessage: string): PublishResult => {
    sendResult(false, window.location.href, errorMessage, errorCode)
    return {
      success: false,
      publishUrl: window.location.href,
      errorCode,
      errorMessage
    }
  }

  async function waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
    return new Promise((resolve) => {
      const element = document.querySelector(selector)
      if (element) {
        resolve(element)
        return
      }

      const observer = new MutationObserver(() => {
        const nextElement = document.querySelector(selector)
        if (nextElement) {
          observer.disconnect()
          resolve(nextElement)
        }
      })

      observer.observe(document.body, { childList: true, subtree: true })
      setTimeout(() => {
        observer.disconnect()
        resolve(null)
      }, timeout)
    })
  }

  function simulateInput(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const previousValue = element.value
    element.value = value

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracker = (element as any)._valueTracker
    if (tracker) tracker.setValue(previousValue)

    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
  }

  function insertTextToEditor(editor: HTMLElement, text: string) {
    editor.focus()
    const dataTransfer = new DataTransfer()
    dataTransfer.setData("text/plain", text)

    editor.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      }),
    )
  }

  async function addTags(editor: HTMLElement) {
    if (!tags?.length) return

    for (const tag of tags.slice(0, 10)) {
      editor.focus()
      insertTextToEditor(editor, "#")
      await sleep(1000)
      insertTextToEditor(editor, tag)
      await sleep(3000)
      editor.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }),
      )
      await sleep(500)
    }
  }

  async function uploadImages() {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'))
    const fileInput =
      (inputs.find((input) => input.hasAttribute("multiple")) as HTMLInputElement | undefined) ||
      (inputs[0] as HTMLInputElement | undefined)

    if (!fileInput) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to find Rednote upload input")
    }

    const dataTransfer = new DataTransfer()
    for (const fileInfo of images) {
      const response = await fetch(fileInfo.url)
      if (!response.ok) {
        throw createPublishError("SCRIPT_INJECTION_FAILED", `Failed to fetch image: ${fileInfo.name}`)
      }

      const blob = await response.blob()
      dataTransfer.items.add(
        new File([blob], fileInfo.name || `image-${Date.now()}.jpg`, {
          type: fileInfo.type || blob.type || "image/jpeg"
        }),
      )
    }

    if (dataTransfer.files.length !== images.length) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Image payload is incomplete")
    }

    fileInput.files = dataTransfer.files
    fileInput.dispatchEvent(new Event("change", { bubbles: true }))
  }

  async function waitForUploadedImages(expectedCount: number) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const uploadedCount = document.querySelectorAll(".img-preview-area .img-container").length
      if (uploadedCount >= expectedCount) return uploadedCount
      await sleep(1000)
    }

    return document.querySelectorAll(".img-preview-area .img-container").length
  }

  async function fillContent() {
    const titleInput = document.querySelector('input[type="text"][placeholder*="标题"]') as HTMLInputElement | null
    if (titleInput) {
      simulateInput(titleInput, title || content?.slice(0, 20) || "")
    }

    await sleep(2000)

    const contentEditor = document.querySelector(".ProseMirror") as HTMLElement | null
    if (!contentEditor) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to find Rednote editor")
    }

    insertTextToEditor(contentEditor, content || "")
    await sleep(3000)
    await addTags(contentEditor)
  }

  async function selectProduct() {
    if (!shangpin) return

    const addButton =
      (document.querySelector(".multi-good-select-empty-btn button") as HTMLElement | null) ||
      (document.querySelector(".button-group-content button") as HTMLElement | null) ||
      Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("添加商品") || button.textContent?.includes("关联商品"),
      )

    if (!addButton) return

    addButton.click()
    await sleep(2000)

    const searchInput = document.querySelector('.d-modal-content input[placeholder*="搜索商品"]') as HTMLInputElement | null
    if (!searchInput) return

    simulateInput(searchInput, shangpin)
    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }))
    await sleep(2500)

    const targetItem = Array.from(document.querySelectorAll(".good-card-container")).find((item) =>
      item.textContent?.includes(shangpin),
    )

    if (!targetItem) return

    const checkbox = targetItem.querySelector(".d-checkbox") as HTMLElement | null
    if (checkbox) {
      checkbox.click()
      await sleep(500)
    }

    const saveButton = Array.from(document.querySelectorAll(".d-modal-footer button")).find(
      (button) => button.textContent?.includes("保存") || button.textContent?.includes("确定"),
    ) as HTMLElement | undefined

    saveButton?.click()
    await sleep(1000)
  }

  async function handleOriginalDeclaration() {
    const collapseToggle = document.querySelector(".collapse-toggle") as HTMLElement | null
    if (collapseToggle?.textContent?.includes("展开")) {
      collapseToggle.click()
      await sleep(3000)
    }

    const originalLabel = Array.from(document.querySelectorAll(".custom-switch-text-content span")).find((element) =>
      element.textContent?.includes("原创") || element.textContent?.includes("声明原创"),
    )

    if (!originalLabel) return

    const wrapper = originalLabel.closest(".custom-switch-wrapper")
    const checkbox = wrapper?.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    if (checkbox?.checked) return

      ; ((wrapper?.querySelector(".d-switch-box") as HTMLElement | null) || (wrapper as HTMLElement | null))?.click()
    await sleep(3000)

    const modal = document.querySelector(".originalContainer")
    if (!modal) return

    const agreementCheckbox = modal.querySelector(".footerLeft .d-checkbox") as HTMLElement | null
    const agreementInput = agreementCheckbox?.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    if (agreementCheckbox && agreementInput && !agreementInput.checked) {
      agreementCheckbox.click()
      await sleep(1000)
    }

    const confirmButton = modal.querySelector("button.custom-button.bg-red") as HTMLElement | null
    confirmButton?.click()
    await sleep(5000)
  }

  async function handleScheduledPublish(timeString: string) {
    const timerLabel = Array.from(document.querySelectorAll(".custom-switch-text-content span")).find((element) =>
      element.textContent?.includes("定时发布"),
    )
    if (!timerLabel) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to find Rednote scheduled publish switch")
    }

    const wrapper = timerLabel.closest(".custom-switch-wrapper")
    const checkbox = wrapper?.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    if (wrapper && checkbox && !checkbox.checked) {
      ; ((wrapper.querySelector(".d-switch-box") as HTMLElement | null) || (wrapper as HTMLElement)).click()
      await sleep(1000)
    }

    const dateInput = document.querySelector(".date-picker-container input.d-text") as HTMLInputElement | null
    if (!dateInput) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to find Rednote scheduled publish input")
    }

    const formattedTime = timeString.replace(/\//g, "-").slice(0, 16)
    dateInput.click()
    await sleep(200)
    simulateInput(dateInput, formattedTime)
    await sleep(200)
    dateInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }))
    document.body.click()
  }

  async function clickPublishButton() {
    const publishButton = Array.from(document.querySelectorAll("button.custom-button.bg-red")).find((button) => {
      const style = window.getComputedStyle(button)
      return style.display !== "none" && !button.hasAttribute("disabled")
    }) as HTMLElement | undefined

    if (!publishButton) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to find Rednote publish button")
    }

    let attempt = 0
    while (
      publishButton.classList.contains("disabled") ||
      publishButton.getAttribute("aria-disabled") === "true"
    ) {
      if (attempt >= 10) break
      attempt += 1
      await sleep(1000)
    }

    publishButton.click()
  }

  async function waitForSuccessSignal(isScheduled: boolean) {
    const successTexts = isScheduled
      ? ["定时成功", "已定时", "定时发布成功"]
      : ["发布成功", "笔记发布成功", "发布完成"]

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const currentUrl = window.location.href
      const pageText = document.body?.innerText || ""

      if (
        successTexts.some((text) => pageText.includes(text)) ||
        currentUrl.includes("/creator/") ||
        currentUrl.includes("/publish/success") ||
        currentUrl.includes("/note/")
      ) {
        return currentUrl
      }

      const toast = Array.from(
        document.querySelectorAll('[class*="toast"], [class*="message"], .d-toast, [role="alert"]'),
      ).find((element) => successTexts.some((text) => element.textContent?.includes(text)))

      if (toast) return currentUrl
      await sleep(1000)
    }

    throw createPublishError("REDNOTE_NO_SUCCESS_SIGNAL", "No Rednote success signal detected within 60s")
  }

  if (!images?.length) {
    return fail("REDNOTE_NO_SUCCESS_SIGNAL", "Rednote note publish requires at least one image")
  }

  try {
    const publishEntry = (await waitForElement(".btn-text")) || (await waitForElement(".i-icon-note-b"))
    const isPublishPage = document.querySelector(".img-list")
    if (!isPublishPage && publishEntry) {
      const button = document.querySelector(".d-topbar .btn-text") as HTMLElement | null
      if (button?.textContent?.includes("发布笔记")) {
        button.click()
      }
      await sleep(2000)
    }

    const imageTab = Array.from(document.querySelectorAll(".tab-item, .title")).find((element) =>
      element.textContent?.includes("上传图文"),
    ) as HTMLElement | undefined
    imageTab?.click()
    if (imageTab) await sleep(1000)

    await uploadImages()
    const uploadedCount = await waitForUploadedImages(images.length)
    if (uploadedCount < images.length) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Rednote image upload did not finish")
    }

    await sleep(60000)
    await fillContent()

    if (shangpin) await selectProduct()
    if (originalFlag) await handleOriginalDeclaration()

    let isScheduled = false
    if (publishTime) {
      const targetTime = new Date(publishTime).getTime()
      if (Number.isFinite(targetTime) && targetTime > Date.now() + 5 * 60 * 1000) {
        await handleScheduledPublish(publishTime)
        isScheduled = true
      }
    }

    if (data.isAutoPublish) {
      await clickPublishButton()
      const publishUrl = await waitForSuccessSignal(isScheduled)
      sendResult(true, publishUrl)
      return { success: true, publishUrl }
    }

    return {
      success: true,
      publishUrl: window.location.href
    }
  } catch (error) {
    const errorCode = error instanceof Error && error.name && error.name !== "Error" ? error.name : "SCRIPT_INJECTION_FAILED"
    const errorMessage = error instanceof Error ? error.message : String(error)
    return fail(errorCode, errorMessage)
  }
}
