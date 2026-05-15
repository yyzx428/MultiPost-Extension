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

  type ClickableElement = Element & { click: () => void }
  type TrackedInputElement = (HTMLInputElement | HTMLTextAreaElement) & {
    _valueTracker?: { setValue: (value: string) => void }
  }
  type RednoteVueInstance = { subTree?: unknown }
  type RednoteVNode = {
    type?: unknown
    children?: unknown
    props?: {
      onClick?: unknown
      onclick?: unknown
    }
    component?: {
      subTree?: unknown
    }
  }
  type RednotePublishElement = HTMLElement & {
    _shadowRoot?: ShadowRoot
    _instance?: RednoteVueInstance
    __vue_app__?: RednoteVueInstance
    __vue__?: RednoteVueInstance
  }

  const hasClick = (element: Element): element is ClickableElement => {
    return typeof (element as { click?: unknown }).click === "function"
  }

  const asRednoteVNode = (value: unknown): RednoteVNode | null => {
    return typeof value === "object" && value !== null ? (value as RednoteVNode) : null
  }

  // 安全点击方法，兼容 SVGElement 等无原生 .click() 的情况
  const safeClick = (element: Element | null | undefined) => {
    if (!element) return

    let current: Element | null = element
    // 向上寻找存在 click 方法的 HTML 元素
    while (current && !hasClick(current)) {
      current = current.parentElement
    }

    if (current && hasClick(current)) {
      current.click()
    } else {
      // 最终兜底：利用原生事件派发
      element.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        })
      )
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
    element.focus()
    const previousValue = element.value
    element.value = value

    // 兼容 React 和 Vue 的底层数据追踪器
    const tracker = (element as TrackedInputElement)._valueTracker
    if (tracker) tracker.setValue(previousValue)
    
    // 兼容 Vue3 原生劫持
    const prototype = element.tagName.toLowerCase() === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
    if (setter) {
      setter.call(element, value)
    }

    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
  }

  function insertTextToEditor(editor: HTMLElement, text: string) {
    editor.focus()
    // 优先尝试标准 execCommand
    const success = document.execCommand("insertText", false, text)
    if (!success) {
      // 降级方案：使用剪贴板事件模拟粘贴
      const dataTransfer = new DataTransfer()
      dataTransfer.setData("text/plain", text)
      editor.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
        })
      )
    }
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
        })
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
        })
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
    const titleInput = document.querySelector('input.d-text[type="text"][placeholder*="标题"], input[type="text"][placeholder*="标题"]') as HTMLInputElement | null
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
      document.querySelector(".multi-good-select-empty-btn button") ||
      document.querySelector(".button-group-content button") ||
      Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("添加商品") || button.textContent?.includes("关联商品")
      )

    if (!addButton) return

    safeClick(addButton)
    await sleep(2000)

    const searchInput = document.querySelector('.d-modal-content input[type="text"]') as HTMLInputElement | null
    if (!searchInput) return

    simulateInput(searchInput, shangpin)
    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }))
    await sleep(2500)

    const targetItem = Array.from(document.querySelectorAll(".good-card-container")).find((item) =>
      item.textContent?.includes(shangpin)
    )

    // 若未搜索到目标商品，必须执行安全退出动作（关闭弹窗）
    if (!targetItem) {
      const closeBtn = document.querySelector('.el-dialog__headerbtn, [aria-label="Close"], [aria-label="关闭"], .d-modal-header svg, [class*="modal"] [class*="close"] svg')
      if (closeBtn) {
        safeClick(closeBtn)
      } else {
        // 兜底退出策略：未选择商品时点保存/取消都能关掉弹层
        const fallbackBtn = Array.from(document.querySelectorAll('button')).find(b => {
          const text = b.textContent?.trim() || ""
          return (text.includes("取消") || text.includes("保存") || text.includes("确定")) && window.getComputedStyle(b).display !== "none"
        })
        safeClick(fallbackBtn)
      }
      await sleep(1000)
      return
    }

    const checkbox = targetItem.querySelector(".d-checkbox")
    if (checkbox) {
      safeClick(checkbox)
      await sleep(500)
    }

    const saveButton = Array.from(document.querySelectorAll(".d-modal-footer button")).find(
      (button) => button.textContent?.includes("保存") || button.textContent?.includes("确定")
    )
    safeClick(saveButton)
    await sleep(1000)
  }

  async function expandMoreSettings() {
    const settingsHeaders = Array.from(document.querySelectorAll('.publish-page-content-settings-header .title'))
    const moreSettingHeader = settingsHeaders.find(el => el.textContent?.includes("更多设置"))
    
    if (moreSettingHeader) {
      const toggle = moreSettingHeader.nextElementSibling
      if (toggle && toggle.textContent?.includes("展开")) {
        safeClick(toggle)
        await sleep(1000)
      }
    }
  }

  async function handleOriginalDeclaration() {
    await expandMoreSettings()

    const originalLabel = Array.from(document.querySelectorAll(".custom-switch-text-content span")).find((element) =>
      element.textContent?.includes("原创") || element.textContent?.includes("声明原创")
    )

    if (!originalLabel) return

    const wrapper = originalLabel.closest(".custom-switch-wrapper")
    const checkbox = wrapper?.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    
    if (checkbox && !checkbox.checked) {
      const switchBox = wrapper?.querySelector(".d-switch")
      safeClick(switchBox)
      await sleep(3000)

      const modal = document.querySelector(".originalContainer")
      if (!modal) return

      const agreementCheckbox = modal.querySelector(".footerLeft .d-checkbox")
      const agreementInput = agreementCheckbox?.querySelector('input[type="checkbox"]') as HTMLInputElement | null
      if (agreementCheckbox && agreementInput && !agreementInput.checked) {
        safeClick(agreementCheckbox)
        await sleep(1000)
      }

      const confirmButton = modal.querySelector("button.custom-button.bg-red")
      safeClick(confirmButton)
      await sleep(5000)
    }
  }

  async function handleScheduledPublish(timeString: string) {
    const timerLabel = Array.from(document.querySelectorAll(".custom-switch-text-content span")).find((element) =>
      element.textContent?.includes("定时发布")
    )
    if (!timerLabel) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to find Rednote scheduled publish switch")
    }

    const wrapper = timerLabel.closest(".custom-switch-wrapper")
    const checkbox = wrapper?.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    
    if (wrapper && checkbox && !checkbox.checked) {
      const switchBox = wrapper.querySelector(".d-switch")
      safeClick(switchBox)
      await sleep(1000)
    }

    const dateInput = document.querySelector(".date-picker-container input.d-text") as HTMLInputElement | null
    if (!dateInput) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to find Rednote scheduled publish input")
    }

    const formattedTime = timeString.replace(/\//g, "-").slice(0, 16)
    safeClick(dateInput)
    await sleep(200)
    simulateInput(dateInput, formattedTime)
    await sleep(200)
    dateInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }))
    safeClick(document.body) // 收起日历面板
  }

  async function clickPublishButton(isScheduled: boolean) {
    for (let attempt = 0; attempt < 15; attempt++) {
      // 目标组件：<xhs-publish-btn>
      const xhsPublishComponent = document.querySelector("xhs-publish-btn") as RednotePublishElement | null
      
      if (xhsPublishComponent) {
        // 判断属性是否被禁用
        if (xhsPublishComponent.getAttribute("submit-disabled") === "true") {
          await sleep(1000)
          continue
        }

        // 突破一：常规 Shadow DOM 穿透检查 (只针对 mode: 'open' 有效)
        const root = xhsPublishComponent.shadowRoot || xhsPublishComponent._shadowRoot
        if (root) {
          const btns = Array.from(root.querySelectorAll("button")) as HTMLButtonElement[]
          const btn = btns.find(b => {
            const text = b.textContent?.trim() || ""
            const isMatch = isScheduled ? text.includes("定时发布") : (text === "发布" || text === "发布笔记" || (text.includes("发布") && !text.includes("定时")))
            return isMatch && !b.disabled && !b.classList.contains("disabled")
          })
          if (btn) {
            safeClick(btn)
            return
          }
        }

        // 突破二：针对 mode: 'closed' 的深层 Vue VNode 递归探测 (防穿透神技)
        try {
          const instance = xhsPublishComponent._instance || xhsPublishComponent.__vue_app__ || xhsPublishComponent.__vue__
          if (instance) {
            let clicked = false
            const traverse = (value: unknown) => {
              const vnode = asRednoteVNode(value)
              if (clicked || !vnode) return
              if (vnode.type === 'button') {
                // 序列化子节点转文本
                const text = JSON.stringify(vnode.children || "")
                const isMatch = isScheduled ? text.includes("定时发布") : (text.includes("发布") && !text.includes("定时"))
                if (isMatch) {
                  const onClick = vnode.props?.onClick || vnode.props?.onclick
                  if (typeof onClick === 'function') {
                    onClick(new MouseEvent('click'))
                    clicked = true
                    return
                  }
                }
              }
              if (Array.isArray(vnode.children)) vnode.children.forEach(traverse)
              if (vnode.component && vnode.component.subTree) traverse(vnode.component.subTree)
            }
            if (instance.subTree) traverse(instance.subTree)
            
            // 成功触达 Vue 底层方法，结束任务，由外层的 URL 跳转去探测最终是否成功
            if (clicked) return
          }
        } catch (e) {
          console.warn("Vue VNode traversal error:", e)
        }

        // 突破三：直接对 CustomElement 派发可能绑定的事件进行欺骗
        xhsPublishComponent.dispatchEvent(new CustomEvent('submit', { bubbles: true, composed: true }))
        xhsPublishComponent.dispatchEvent(new CustomEvent('publish', { bubbles: true, composed: true }))

        // 突破四：强行针对该节点进行坐标物理点击模拟 (可能浏览器会自动将事件分发到内部实际节点)
        const rect = xhsPublishComponent.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          const clickEvent = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: rect.right - 60, // 根据截图通常发布按钮偏右
            clientY: rect.top + rect.height / 2
          })
          xhsPublishComponent.dispatchEvent(clickEvent)
        }
      }

      // 突破五：降级全文档 Button 查找（防它突然又去掉 Web Components 封装）
      const lightElements = Array.from(document.querySelectorAll("button, .btn, .publish-btn, [role='button']")) as HTMLElement[]
      const lightBtn = lightElements.find(el => {
          const text = el.textContent?.trim() || ""
          const isMatch = isScheduled ? text.includes("定时发布") : (text === "发布" || text === "发布笔记" || (text.includes("发布") && !text.includes("定时")))
          return isMatch && window.getComputedStyle(el).display !== "none" && !el.hasAttribute("disabled") && !el.classList.contains("disabled")
      })
      if (lightBtn) {
        safeClick(lightBtn)
        return
      }

      await sleep(1000)
    }

    throw createPublishError("SCRIPT_INJECTION_FAILED", "Unable to find or click Rednote publish button")
  }

  function isRednoteSuccessUrl(url: string) {
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.searchParams.get("published") === "true") {
        return true
      }
    } catch {
      // 非标准 URL 时继续走字符串兜底判断。
    }

    return url.includes("published=true")
  }

  async function waitForSuccessSignal(isScheduled: boolean) {
    const successTexts = isScheduled
      ? ["定时成功", "已定时", "定时发布成功"]
      : ["发布成功", "笔记发布成功", "发布完成"]

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const currentUrl = window.location.href
      const pageText = document.body?.innerText || ""

      // 验证是否跳转到了成功页面
      if (
        isRednoteSuccessUrl(currentUrl) ||
        successTexts.some((text) => pageText.includes(text)) ||
        currentUrl.includes("/creator/manage") || 
        currentUrl.includes("/creator/home") || 
        currentUrl.includes("/publish/success") ||
        currentUrl.match(/\/note\/[a-zA-Z0-9]+/) 
      ) {
        return currentUrl
      }

      // 检测是否有反作弊或风控滑块验证码弹窗
      const captchaEl = document.querySelector('.fe-captcha-app, .captcha-modal, .r-captcha-modal')
      if (captchaEl && window.getComputedStyle(captchaEl).display !== 'none') {
        throw createPublishError("CAPTCHA_REQUIRED", "Detected Rednote Anti-Spam Captcha Modal.")
      }

      // 检测是否触发了红色的错误 Toast
      const errorToast = Array.from(
        document.querySelectorAll('[class*="toast"], [class*="message"], .d-toast, [role="alert"]')
      ).find((element) => {
        const text = element.textContent || ""
        return ["失败", "异常", "网络错误", "频繁"].some(err => text.includes(err))
      })
      
      if (errorToast) {
        throw createPublishError("PUBLISH_FAILED", `Publish failed with message: ${errorToast.textContent}`)
      }

      await sleep(1000)
    }

    throw createPublishError("REDNOTE_NO_SUCCESS_SIGNAL", "No Rednote success signal detected within 60s")
  }

  // ==== 核心执行流程开始 ====

  if (!images?.length) {
    return fail("REDNOTE_NO_SUCCESS_SIGNAL", "Rednote note publish requires at least one image")
  }

  try {
    const publishEntry = (await waitForElement(".btn-text")) || (await waitForElement(".i-icon-note-b"))
    const isPublishPage = document.querySelector(".img-list")
    
    if (!isPublishPage && publishEntry) {
      const button = document.querySelector(".d-topbar .btn-text")
      if (button?.textContent?.includes("发布笔记")) {
        safeClick(button)
      }
      await sleep(2000)
    }

    const imageTab = Array.from(document.querySelectorAll(".tab-item, .title")).find((element) =>
      element.textContent?.includes("上传图文")
    )
    safeClick(imageTab)
    if (imageTab) await sleep(1000)

    await uploadImages()
    const uploadedCount = await waitForUploadedImages(images.length)
    if (uploadedCount < images.length) {
      throw createPublishError("SCRIPT_INJECTION_FAILED", "Rednote image upload did not finish")
    }

    await sleep(30000) // 让上传的图片/DOM完全渲染稳妥
    
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
      let publishClickError: unknown

      try {
        await clickPublishButton(isScheduled)
      } catch (error) {
        publishClickError = error
      }

      try {
        const publishUrl = await waitForSuccessSignal(isScheduled)
        sendResult(true, publishUrl)
        return { success: true, publishUrl }
      } catch (successError) {
        if (publishClickError) {
          throw publishClickError
        }
        throw successError
      }
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
