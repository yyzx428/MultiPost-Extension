import type { DynamicData, SyncData } from '../common';

// 优先发布图文
export async function DynamicRednote(data: SyncData) {
  const { title, content, images, tags, originalFlag, publishTime } = data.data as DynamicData;

  // 辅助函数：等待元素出现
  function waitForElement(selector: string, timeout = 10000): Promise<Element> {
    return new Promise((resolve, reject) => {
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
        reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms`));
      }, timeout);
    });
  }

  // 辅助函数：等待元素状态变化
  function waitForElementCondition(selector: string, condition: (element: Element) => boolean, timeout = 10000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element && condition(element)) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element && condition(element)) {
          resolve(element);
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled', 'class']
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element condition not met within ${timeout}ms`));
      }, timeout);
    });
  }



  // 辅助函数：处理定时发布
  async function handleScheduledPublish(timeStr: string): Promise<boolean> {
    try {
      console.log('开始设置定时发布:', timeStr);

      const { year, month, day, hour, minute } = parseDateTime(timeStr);
      console.log('解析时间:', { year, month, day, hour, minute });

      // 步骤1: 点击定时发布单选框
      if (!await clickScheduledRadio()) return false;
      await new Promise(resolve => setTimeout(resolve, 500));

      // 步骤2: 点击时间输入框打开选择器
      if (!await clickTimeInput()) return false;
      await new Promise(resolve => setTimeout(resolve, 500));

      // 步骤3: 在日历中选择日期
      if (!await selectDate(day)) return false;
      await new Promise(resolve => setTimeout(resolve, 200));

      // 步骤4: 填写时间
      if (!await fillTimeInputs(hour, minute)) return false;
      await new Promise(resolve => setTimeout(resolve, 200));

      // 步骤5: 确认选择
      if (!await clickConfirmButton()) return false;

      console.log('✅ 定时发布设置完成');
      return true;
    } catch (error) {
      console.error('❌ 定时发布设置失败:', error);
      return false;
    }
  }

  // 解析时间字符串
  function parseDateTime(timeStr: string) {
    const [datePart, timePart] = timeStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    return { year, month, day, hour, minute };
  }

  // 校验定时发布时间范围（1小时~14天内）
  function isValidScheduleTime(timeStr: string): boolean {
    try {
      const now = new Date();
      const target = new Date(timeStr.replace(/-/g, '/').replace(' ', 'T'));
      const diffMs = target.getTime() - now.getTime();
      const diffH = diffMs / (1000 * 60 * 60);

      console.log('时间校验:', {
        当前时间: now.toLocaleString(),
        目标时间: timeStr,
        时间差小时: diffH,
        是否有效: diffH >= 1 && diffH <= 14 * 24
      });

      return diffH >= 1 && diffH <= 14 * 24;
    } catch (error) {
      console.error('时间校验失败:', error);
      return false;
    }
  }

  // 点击定时发布单选框
  async function clickScheduledRadio(): Promise<boolean> {
    console.log('点击定时发布单选框...');

    const labels = document.querySelectorAll('label.el-radio');
    for (const label of labels) {
      const text = label.textContent?.trim();
      if (text && text.includes('定时发布')) {
        const input = label.querySelector('input.el-radio__original');
        if (input) {
          (input as HTMLElement).click();
          console.log('✅ 定时发布单选框已点击');
          return true;
        }
      }
    }
    console.warn('❌ 未找到定时发布单选框');
    return false;
  }

  // 点击时间输入框
  async function clickTimeInput(): Promise<boolean> {
    console.log('点击时间输入框...');

    const timeInput = document.querySelector('input.el-input__inner[placeholder*="日期"], input.el-input__inner[placeholder*="时间"]');
    if (timeInput) {
      (timeInput as HTMLElement).click();
      console.log('✅ 时间输入框已点击');
      return true;
    }
    console.warn('❌ 未找到时间输入框');
    return false;
  }

  // 选择日期
  async function selectDate(day: number): Promise<boolean> {
    console.log(`选择日期 ${day}...`);

    const availableCells = document.querySelectorAll('.el-date-table-cell');
    for (const cell of availableCells) {
      const span = cell.querySelector('.el-date-table-cell__text');
      if (span && span.textContent?.trim() === day.toString()) {
        const td = cell.closest('td');
        if (td && td.classList.contains('available')) {
          (td as HTMLElement).click();
          console.log(`✅ 日期 ${day} 已选择`);
          return true;
        }
      }
    }
    console.warn(`❌ 未找到可用日期 ${day}`);
    return false;
  }

  // 填写时间
  async function fillTimeInputs(hour: number, minute: number): Promise<boolean> {
    console.log(`填写时间 ${hour}:${minute}...`);

    const timeInput = document.querySelector('#el-id-2361-30, input[placeholder="选择时间"]');
    if (timeInput) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      (timeInput as HTMLInputElement).focus();
      (timeInput as HTMLInputElement).value = timeStr;
      timeInput.dispatchEvent(new Event('input', { bubbles: true }));
      timeInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`✅ 时间已填写: ${timeStr}`);
      return true;
    }
    console.warn('❌ 未找到时间输入字段');
    return false;
  }

  // 点击确认按钮
  async function clickConfirmButton(): Promise<boolean> {
    console.log('点击确认按钮...');

    const confirmButtons = document.querySelectorAll('button.el-button');
    for (const button of confirmButtons) {
      const span = button.querySelector('span');
      if (span && span.textContent?.trim() === '确定') {
        (button as HTMLElement).click();
        console.log('✅ 确认按钮已点击');
        return true;
      }
    }
    console.warn('❌ 未找到确认按钮');
    return false;
  }

  // 辅助函数：处理原创声明
  async function handleOriginalDeclaration(): Promise<void> {
    try {
      console.log('开始处理原创声明...');

      // 等待页面完全加载
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 步骤1: 点击呼出原创声明面板
      console.log('步骤1: 呼出原创声明面板...');
      const declareButton = document.querySelector('span[class="btn-text red"]');

      if (declareButton) {
        console.log('找到原创声明按钮，点击呼出面板...');
        (declareButton as HTMLElement).click();
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.error('未找到原创声明按钮');
        return;
      }

      // 步骤2: 等待原创声明容器出现
      console.log('步骤2: 等待原创声明容器出现...');
      let originalContainer: Element;
      try {
        originalContainer = await waitForElement('div[class="originalContainer"]', 5000);
        console.log('原创声明容器已出现');
      } catch {
        console.error('等待原创声明容器超时');
        return;
      }

      // 步骤3: 在容器中查找复选框
      console.log('步骤3: 在原创声明容器中查找复选框...');
      const checkbox = originalContainer.querySelector('input[type="checkbox"]') as HTMLInputElement;

      if (checkbox) {
        console.log('找到原创声明复选框，勾选...');
        console.log('复选框状态:', {
          checked: checkbox.checked,
          className: checkbox.className,
          id: checkbox.id
        });

        checkbox.click();
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log('复选框勾选后的状态:', {
          checked: checkbox.checked
        });
      } else {
        console.error('在原创声明容器中未找到复选框');
        return;
      }

      // 步骤4: 等待"声明原创"按钮变为可用状态
      console.log('步骤4: 等待"声明原创"按钮变为可用状态...');
      let confirmButton: HTMLButtonElement | null = null;
      try {
        confirmButton = await waitForElementCondition(
          'button.d-button.d-button-default.d-button-with-content',
          (element) => {
            const text = element.textContent?.trim();
            const isDisabled = element.hasAttribute('disabled') || element.classList.contains('disabled');
            console.log('检查按钮:', { text, isDisabled });
            return text === '声明原创' && !isDisabled;
          },
          10000
        ) as HTMLButtonElement;
        console.log('"声明原创"按钮已变为可用状态');
      } catch {
        console.log('等待按钮可用状态超时，尝试查找当前按钮...');

        // 查找所有"声明原创"按钮
        const allButtons = document.querySelectorAll('button');
        confirmButton = Array.from(allButtons).find(btn =>
          btn.textContent?.trim() === '声明原创'
        ) as HTMLButtonElement;

        if (confirmButton) {
          console.log('找到"声明原创"按钮，但可能仍为禁用状态');
        } else {
          console.error('未找到"声明原创"按钮');
          return;
        }
      }

      // 步骤5: 点击"声明原创"按钮
      if (confirmButton) {
        console.log('步骤5: 点击"声明原创"按钮...');
        console.log('按钮信息:', {
          text: confirmButton.textContent?.trim(),
          className: confirmButton.className,
          disabled: confirmButton.disabled
        });

        // 如果按钮仍然禁用，尝试强制点击
        if (confirmButton.disabled) {
          console.log('按钮仍为禁用状态，尝试强制点击...');
          // 移除禁用属性并点击
          confirmButton.disabled = false;
          confirmButton.classList.remove('disabled');
          confirmButton.style.pointerEvents = 'auto';
        }

        confirmButton.click();
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // 步骤6: 检查是否成功
      console.log('步骤6: 检查原创声明是否成功...');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 检查原创声明容器是否消失
      const checkContainer = document.querySelector('div[class="originalContainer"]');
      if (checkContainer) {
        console.log('原创声明容器仍然存在，可能需要重新处理');
      } else {
        console.log('原创声明容器已消失，原创声明处理成功');
      }

      console.log('原创声明处理流程完成');

    } catch (error) {
      console.error('处理原创声明时出错:', error);
    }
  }

  // 辅助函数：添加标签
  async function addTags(editor: HTMLElement) {
    if (!tags || tags.length === 0) {
      console.log('没有标签需要添加');
      return;
    }

    // 限制最多10个标签
    const limitedTags = tags.slice(0, 10);
    console.log('开始添加标签:', limitedTags);

    for (let i = 0; i < limitedTags.length; i++) {
      const tag = limitedTags[i];
      console.log(`添加标签 ${i + 1}/${limitedTags.length}: #${tag}`);

      // 确保编辑器有焦点
      editor.focus();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 添加#格式标签
      const tagPasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      });
      tagPasteEvent.clipboardData.setData('text/plain', ` #${tag}`);
      editor.dispatchEvent(tagPasteEvent);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 模拟回车键确认标签
      const enterEvent = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
      });
      editor.dispatchEvent(enterEvent);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('标签添加完成');
  }

  // 辅助函数：上传文件
  async function uploadImages() {
    const fileInput = (await waitForElement('input[type="file"]')) as HTMLInputElement;
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
        const file = new File([blob], fileInfo.name, { type: fileInfo.type });
        dataTransfer.items.add(file);
      } catch (error) {
        console.error(`上传图片 ${fileInfo.url} 失败:`, error);
      }
    }

    if (dataTransfer.files.length > 0) {
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待文件处理
      console.log('文件上传操作完成');
    } else {
      console.error('没有成功添加任何文件');
    }
  }

  if (images && images.length > 0) {
    // 等待页面加载
    await waitForElement('span[class="title"]');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 点击上传图文按钮
    const uploadButtons = document.querySelectorAll('span[class="title"]');
    const uploadButton = Array.from(uploadButtons).find(
      (element) => element.textContent?.includes('上传图文'),
    ) as HTMLElement;

    if (!uploadButton) {
      console.error('未找到上传图文按钮');
      return;
    }

    uploadButton.click();
    uploadButton.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 上传文件
    await uploadImages();
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 等待图片上传完成

    // 填写标题
    const titleInput = (await waitForElement('input[type="text"]')) as HTMLInputElement;
    if (titleInput) {
      const titleText = title || content?.slice(0, 20) || '';
      titleInput.value = titleText;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 填写内容和标签
    const contentEditor = (await waitForElement('div[contenteditable="true"]')) as HTMLDivElement;
    if (contentEditor) {
      // 先填写主要内容
      contentEditor.focus();
      const contentPasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      });
      contentPasteEvent.clipboardData.setData('text/plain', content || '');
      contentEditor.dispatchEvent(contentPasteEvent);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log('设置内容:', content);

      // 添加标签
      await addTags(contentEditor);
    }

    // 处理定时发布
    if (publishTime) {
      console.log('检测到定时发布时间:', publishTime);

      // 校验时间范围
      if (!isValidScheduleTime(publishTime)) {
        console.error('❌ 定时发布时间必须在1小时~14天内，跳过定时发布设置');
        return;
      }

      if (!await handleScheduledPublish(publishTime)) {
        console.error('定时发布设置失败');
        return;
      }
    }

    // 处理原创声明
    if (originalFlag) {
      console.log('检测到原创声明标志，开始处理原创声明...');
      await handleOriginalDeclaration();
    }

    // 自动发布
    if (data.isAutoPublish) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const buttons = document.querySelectorAll('button');
      const publishButton = Array.from(buttons).find(
        (button) => button.textContent?.includes('发布'),
      ) as HTMLButtonElement;

      if (publishButton) {
        // 等待按钮可用
        while (publishButton.getAttribute('aria-disabled') === 'true') {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          console.log('等待发布按钮可用...');
        }

        console.log('点击发布按钮');
        publishButton.click();
        await new Promise((resolve) => setTimeout(resolve, 10000));
        window.location.href = 'https://creator.xiaohongshu.com/new/note-manager';
      }
    }
  }
}
