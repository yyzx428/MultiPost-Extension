import type { DynamicData, SyncData } from '../common';

// 优先发布图文
export async function DynamicRednote(data: SyncData) {
  const { title, content, images, tags } = data.data as DynamicData;

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
