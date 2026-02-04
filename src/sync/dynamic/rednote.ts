import type { DynamicData, SyncData } from '../common';

// 优先发布图文
export async function DynamicRednote(data: SyncData) {
  const { title, content, images, tags, originalFlag, publishTime, shangpin } = data.data as DynamicData;

  //===================================
  // 1. 基础工具函数
  //===================================

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  /**
   * 等待元素出现
   */
  async function waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        // 超时虽然 reject，但在业务逻辑里通常 catch 或通过 null 判断
        resolve(null);
      }, timeout);
    });
  }

  /**
   * 模拟 React/Vue 的输入事件 (核心修复：解决 input.value 赋值后页面不更新的问题)
   */
  function simulateInput(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const lastValue = element.value;
    element.value = value;

    // 触发 React/Vue 的内部状态追踪器
    const tracker = (element)._valueTracker;
    if (tracker) {
      tracker.setValue(lastValue);
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 向编辑器插入文本 (核心修复：替代 document.execCommand)
   */
  function insertTextToEditor(editor: HTMLElement, text: string) {
    editor.focus();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);

    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer,
    });

    editor.dispatchEvent(pasteEvent);
  }

  //===================================
  // 2. 业务逻辑函数
  //===================================

  /**
   * 添加标签 (修复 execCommand 报错)
   */
  async function addTags(editor: HTMLElement) {
    if (!tags || tags.length === 0) return;

    const limitedTags = tags.slice(0, 10);
    console.log('开始添加标签:', limitedTags);

    for (const tag of limitedTags) {
      editor.focus();

      // 1. 输入 "#" 触发标签联想菜单
      insertTextToEditor(editor, '#');
      await sleep(1000);

      // 2. 输入标签文本
      insertTextToEditor(editor, tag);
      await sleep(3000); // 等待联想结果浮层出现

      // 3. 模拟回车确认 (选中第一个联想结果或创建新标签)
      editor.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));

      await sleep(500);
    }
    console.log('标签添加完成');
  }

  /**
   * 上传图片 (保持原有逻辑)
   */
  async function uploadImages() {
    // 尝试寻找 multiple 的 input，如果没有则找第一个
    const inputs = document.querySelectorAll('input[type="file"]');
    let fileInput: HTMLInputElement | null = null;
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i].hasAttribute('multiple')) {
        fileInput = inputs[i] as HTMLInputElement;
        break;
      }
    }
    if (!fileInput && inputs.length > 0) fileInput = inputs[0] as HTMLInputElement;

    if (!fileInput) {
      console.error('未找到文件输入元素');
      return;
    }

    const dataTransfer = new DataTransfer();

    for (const fileInfo of images) {
      try {
        const response = await fetch(fileInfo.url);
        if (!response.ok) {
          throw new Error(`HTTP 错误! 状态: ${response.status}`);
        }
        const blob = await response.blob();
        const file = new File([blob], fileInfo.name || `image-${Date.now()}.jpg`, { type: fileInfo.type || 'image/jpeg' });
        dataTransfer.items.add(file);
      } catch (error) {
        console.error(`上传图片 ${fileInfo.url} 失败:`, error);
      }
    }

    if (dataTransfer.files.length > 0) {
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(20000);
      console.log('文件上传事件已触发');
    } else {
      console.error('没有成功添加任何文件');
    }
  }

  /**
   * 填写内容 (标题 + 正文)
   */
  async function fillContent() {
    console.log('开始填写内容...');

    // 1. 填写标题 (适配新版 d-input)
    const titleInput = document.querySelector('input[type="text"][placeholder*="标题"]') as HTMLInputElement;
    if (titleInput) {
      const titleText = title || content?.slice(0, 20) || '';
      simulateInput(titleInput, titleText);
      console.log('标题已填写');
    } else {
      console.warn('❌ 未找到标题输入框');
    }

    await sleep(5000);

    // 2. 填写正文 (适配新版 TipTap 编辑器)
    // 查找包含 ProseMirror 类的 div
    const contentEditor = document.querySelector('.ProseMirror') as HTMLElement;

    if (contentEditor) {
      // 先填写主要内容
      insertTextToEditor(contentEditor, content || '');
      console.log('正文内容已设置');
      await sleep(5000);

      // 添加标签
      await addTags(contentEditor);
    } else {
      console.warn('❌ 未找到正文编辑器 (.ProseMirror)');
    }
  }

  /**
   * 选择商品 (适配 DevUI 弹窗)
   */
  async function selelctProduct() {
    console.log('开始添加商品流程...');

    // 1. 点击添加入口
    const addBtnCandidates = [
      document.querySelector('.multi-good-select-empty-btn button'), // 空状态按钮
      document.querySelector('.button-group-content button') // 已有商品时的按钮
    ];
    const addButton = addBtnCandidates.find(btn => btn !== null) as HTMLElement;

    if (!addButton) {
      // 兜底：通过文本查找
      const allBtns = Array.from(document.querySelectorAll('button'));
      const textBtn = allBtns.find(b => b.textContent?.includes('添加商品') || b.textContent?.includes('关联商品'));
      if (!textBtn) {
        console.log('未找到添加商品入口');
        return;
      }
      textBtn.click();
    } else {
      addButton.click();
    }

    console.log('点击添加商品按钮');
    await sleep(2000); // 等待弹窗加载

    // 2. 搜索商品 (适配 d-modal 内的 input)
    const searchInput = document.querySelector('.d-modal-content input[placeholder*="搜索商品"]') as HTMLInputElement;
    if (!searchInput) {
      console.log('❌ 搜索商品框没找到');
      return;
    }

    simulateInput(searchInput, shangpin);
    // 回车搜索
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    await sleep(2500); // 等待搜索结果

    // 3. 选中商品 (.good-card-container)
    const goodsItems = Array.from(document.querySelectorAll('.good-card-container'));
    const targetItem = goodsItems.find(item => {
      const text = item.textContent || '';
      return text.includes(shangpin);
    });

    if (!targetItem) {
      console.log('⚠️ 没找到对应关键词的商品');
      // 关闭弹窗
      (document.querySelector('.d-modal-close') as HTMLElement)?.click();
      return;
    }

    const checkbox = targetItem.querySelector('.d-checkbox') as HTMLElement;
    if (!checkbox) {
      console.log('❌ 商品复选框没找到');
      return;
    }

    // 检查是否已选中
    const simulator = checkbox.querySelector('.d-checkbox-simulator');
    if (simulator && !simulator.classList.contains('checked') && simulator.classList.contains('unchecked')) {
      checkbox.click();
      await sleep(500);
    }

    // 4. 保存 (.d-modal-footer)
    const saveButtons = Array.from(document.querySelectorAll('.d-modal-footer button'));
    const saveButton = saveButtons.find(b => b.textContent?.includes('保存') || b.textContent?.includes('确定')) as HTMLElement;

    if (!saveButton) {
      console.log('❌ 商品选择保存按钮没找到');
      return;
    }

    saveButton.click();
    console.log('✅ 笔记添加商品完成', { shangpin });
    await sleep(1000);
  }

  /**
   * 原创声明 (适配 DevUI Switch)
   */
  async function handleOriginalDeclaration() {
    console.log('检查原创声明...');

    // 1. 确保"更多设置"已展开
    const collapseToggle = document.querySelector('.collapse-toggle');
    if (collapseToggle && collapseToggle.textContent?.includes('展开')) {
      (collapseToggle as HTMLElement).click();
      await sleep(5000);
    }

    // 2. 查找原创开关
    const switchTexts = Array.from(document.querySelectorAll('.custom-switch-text-content span'));
    const originalLabel = switchTexts.find(el => el.textContent?.includes('原创') || el.textContent?.includes('声明原创'));

    if (originalLabel) {
      const wrapper = originalLabel.closest('.custom-switch-wrapper');
      // HTML结构中 input 的 value 始终是 true，状态由 checked 属性决定
      const checkbox = wrapper?.querySelector('input[type="checkbox"]') as HTMLInputElement;

      // 如果开关未开启
      if (checkbox && !checkbox.checked) {
        const clickTarget = wrapper?.querySelector('.d-switch-box') as HTMLElement || wrapper as HTMLElement;
        clickTarget.click();
        console.log('点击开启原创开关');

        // 3. 处理权益告知弹窗 (根据最新HTML结构适配)
        await sleep(15000); // 等待弹窗动画
        const modal = document.querySelector('.originalContainer');

        if (modal) {
          console.log('检测到原创权益弹窗');

          // 3.1 勾选“我已阅读并同意” (位于 footerLeft 内)
          // 查找 footerLeft 下的 d-checkbox
          const agreementCheckboxDiv = modal.querySelector('.footerLeft .d-checkbox');
          const agreementInput = agreementCheckboxDiv?.querySelector('input[type="checkbox"]') as HTMLInputElement;

          // 检查 input.checked 属性
          if (agreementCheckboxDiv && agreementInput && !agreementInput.checked) {
            (agreementCheckboxDiv as HTMLElement).click();
            console.log('勾选原创协议');
            await sleep(5000);
          }

          // 3.2 点击“声明原创”按钮
          // 按钮位于 .originalContainer .footer 下
          const confirmBtn = modal.querySelector('button.custom-button.bg-red') as HTMLElement;
          if (confirmBtn) {
            confirmBtn.click();
            console.log('点击确认声明原创');
            await sleep(10000); // 等待弹窗关闭
          } else {
            console.warn('未找到弹窗内的声明按钮');
          }
        }
      } else {
        console.log('原创声明开关已处于开启状态');
      }
    } else {
      console.warn('未找到原创声明选项');
    }
  }

  /**
   * 定时发布 (适配 DevUI Datepicker)
   */
  async function handleScheduledPublish(timeStr: string) {
    console.log('配置定时发布...');

    // 1. 开启定时发布开关
    const switchTexts = Array.from(document.querySelectorAll('.custom-switch-text-content span'));
    const timerLabel = switchTexts.find(el => el.textContent?.includes('定时发布'));

    if (!timerLabel) {
      console.error('❌ 未找到定时发布选项');
      return false;
    }

    const wrapper = timerLabel.closest('.custom-switch-wrapper');
    const checkbox = wrapper?.querySelector('input[type="checkbox"]') as HTMLInputElement;

    if (wrapper && checkbox && !checkbox.checked) {
      const clickTarget = wrapper.querySelector('.d-switch-box') as HTMLElement || wrapper;
      (clickTarget as HTMLInputElement).click();
      console.log('定时发布开关已开启');
      await sleep(500);
    }

    // 2. 填写时间
    const dateInput = document.querySelector('.date-picker-container input.d-text') as HTMLInputElement;
    if (dateInput) {
      // 格式化时间: "2026/02/04 15:23:00" -> "2026-02-04 15:23"
      const formattedTime = timeStr.replace(/\//g, '-').slice(0, 16);
      console.log(`写入定时时间: ${formattedTime}`);

      dateInput.click(); // 激活
      await sleep(200);
      simulateInput(dateInput, formattedTime); // 写入
      await sleep(200);

      // 确认
      dateInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      document.body.click(); // 关闭弹窗
      return true;
    } else {
      console.error('❌ 未找到时间输入框');
      return false;
    }
  }

  /**
   * 执行发布
   */
  async function publish() {
    console.log('准备发布...');
    await sleep(2000);

    // 查找红色发布按钮 (HTML: button.custom-button.bg-red)
    const publishBtns = Array.from(document.querySelectorAll('button.custom-button.bg-red'));
    // 过滤掉不可见的或者禁用的
    const validBtn = publishBtns.find(btn => {
      const style = window.getComputedStyle(btn);
      return style.display !== 'none' && !btn.hasAttribute('disabled');
    }) as HTMLElement;

    if (validBtn) {
      // 简单防抖检查，等待按钮变为可用状态（有些上传需要时间）
      let checkCount = 0;
      while (validBtn.classList.contains('disabled') || validBtn.getAttribute('aria-disabled') === 'true') {
        if (checkCount > 10) break;
        console.log('发布按钮禁用中，等待...');
        await sleep(1000);
        checkCount++;
      }

      validBtn.click();
      console.log('🚀 已点击发布按钮');
      await sleep(5000);
    } else {
      console.error('❌ 未找到有效的发布按钮');
    }
  }

  //===================================
  // 3. 主流程执行
  //===================================

  if (images && images.length > 0) {
    // 1. 等待页面加载并找到上传入口
    // 尝试寻找 "发布笔记" 按钮 (适配新版侧边栏/顶部栏)
    const publishEntry = (await waitForElement('.btn-text')) || (await waitForElement('.i-icon-note-b'));

    // 如果已经在发布页 (有 img-list)，则不需要点击入口
    const isPublishPage = document.querySelector('.img-list');

    if (!isPublishPage && publishEntry) {
      // 如果按钮文本是 "发布笔记"，点击它
      const btnText = document.querySelector('.d-topbar .btn-text');
      if (btnText && btnText.textContent?.includes('发布笔记')) {
        (btnText as HTMLElement).click();
      }
      await sleep(2000);
    }

    // 2. 点击 "上传图文" (如果存在这个切换选项)
    // 新版可能默认就是图文，或者 tab 切换
    const tabs = Array.from(document.querySelectorAll('.tab-item, .title'));
    const imgTab = tabs.find(t => t.textContent?.includes('上传图文'));
    if (imgTab) {
      (imgTab as HTMLElement).click();
      await sleep(1000);
    }

    // 步骤 1: 上传图片
    await uploadImages();

    // 步骤 2: 等待图片渲染 (轮询检测)
    console.log('等待图片渲染...');
    let uploadedCount = 0;
    for (let i = 0; i < 60; i++) {
      // .img-preview-area 下的 .img-container 数量
      uploadedCount = document.querySelectorAll('.img-preview-area .img-container').length;
      if (uploadedCount >= images.length) break;
      await sleep(1000);
    }
    console.log(`图片上传检测完成: ${uploadedCount} 张`);

    // 缓冲一下，确保DOM稳定
    await sleep(30000);

    // 步骤 3: 填写内容
    await fillContent();

    // 步骤 4: 商品
    if (shangpin) {
      await selelctProduct();
    }

    // 步骤 5: 原创声明
    if (originalFlag) {
      await handleOriginalDeclaration();
    }

    // 步骤 6: 定时发布
    if (publishTime) {
      // 简单校验时间有效性 (假设是未来时间)
      const targetTime = new Date(publishTime).getTime();
      const now = Date.now();
      if (targetTime > now + 5 * 60 * 1000) { // 至少5分钟后
        await handleScheduledPublish(publishTime);
      } else {
        console.warn('定时时间无效或过近，跳过定时设置');
      }
    }

    // 步骤 7: 发布
    if (data.isAutoPublish) {
      await publish();
    }
  }
}