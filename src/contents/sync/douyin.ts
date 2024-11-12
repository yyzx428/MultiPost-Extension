import type { DynamicData, SyncData, VideoData } from './common';

export async function DouyinImage(data: SyncData) {
  const { content, images, title } = data.data as DynamicData;
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

  // 辅助函数：通过文本内容查找元素
  async function findElementByText(
    selector: string,
    text: string,
    maxRetries = 5,
    retryInterval = 1000,
  ): Promise<Element | null> {
    for (let i = 0; i < maxRetries; i++) {
      const elements = document.querySelectorAll(selector);
      const element = Array.from(elements).find((element) => element.textContent?.includes(text));

      if (element) {
        return element;
      }

      console.log(`未找到包含文本 "${text}" 的元素，尝试次数：${i + 1}`);
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }

    console.error(`在 ${maxRetries} 次尝试后未找到包含文本 "${text}" 的元素`);
    return null;
  }

  // 辅助函数：等待多个元素出现
  //   function waitForElements(selector: string, count: number, timeout = 30000): Promise<Element[]> {
  //     return new Promise((resolve, reject) => {
  //       const checkElements = () => {
  //         const elements = document.querySelectorAll(selector);
  //         if (elements.length >= count) {
  //           resolve(Array.from(elements));
  //           return;
  //         }

  //         if (Date.now() - startTime > timeout) {
  //           reject(new Error(`未能在 ${timeout}ms 内找到 ${count} 个 "${selector}" 元素`));
  //           return;
  //         }

  //         setTimeout(checkElements, 100);
  //       };

  //       const startTime = Date.now();
  //       checkElements();
  //     });
  //   }

  async function checkImagesUploaded(expectedCount: number, maxRetries = 10, retryInterval = 3000): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      const viewTexts = document.querySelectorAll('span:contains("查看")');
      const imageCount = viewTexts.length;

      console.log(`当前找到 ${imageCount} 个 "查看" 文本，期望数量：${expectedCount}`);

      if (imageCount === expectedCount) {
        console.log('图片上传完成');
        return true;
      }

      console.log(`图片上传未完成，等待中...（尝试次数：${i + 1}）`);
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }

    console.error(`在 ${maxRetries} 次尝试后，图片上传仍未完成`);
    return true;
  }

  // 辅助函数：上传文件
  async function uploadFiles() {
    const fileInput = (await waitForElement(
      'input[accept="image/png,image/jpeg,image/jpg,image/bmp,image/webp,image/tif"][multiple][type="file"]',
    )) as HTMLInputElement;
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

  // 等待页面加载
  //   await new Promise((resolve) => setTimeout(resolve, 2000));
  //   const imageButton = (await findElementByText('div', '上传图文')) as HTMLElement;
  //   if (imageButton) {
  //     imageButton.click();
  //     await new Promise((resolve) => setTimeout(resolve, 2000));
  //   }

  // 上传图片
  //   const uploadButton = (await findElementByText('span[class="title"]', '上传图文')) as HTMLElement;
  //   if (uploadButton) {
  //     uploadButton.click();
  //     await new Promise((resolve) => setTimeout(resolve, 2000));
  //   }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 上传文件
  await uploadFiles();

  //   填写标题
  const titleInput = (await waitForElement('input[placeholder="添加作品标题"]')) as HTMLInputElement;
  if (titleInput) {
    titleInput.value = title || content.slice(0, 20);
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 填写内容
  const contentEditor = (await waitForElement('div[data-line-wrapper="true"]')) as HTMLDivElement;
  if (contentEditor) {
    // 创建一个新的 ClipboardEvent
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });

    // 设置剪贴板数据
    pasteEvent.clipboardData.setData('text/plain', content);

    // 触发粘贴事件
    contentEditor.dispatchEvent(pasteEvent);
  }

  //   // 等待内容更新
  await new Promise((resolve) => setTimeout(resolve, 3000));

  await checkImagesUploaded(images.length);

  if (data.auto_publish) {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const publishButton = (await findElementByText('button', '发布', 5, 1000)) as HTMLButtonElement;
        if (publishButton) {
          publishButton.click();
          console.log('发布按钮已点击');
          await new Promise((resolve) => setTimeout(resolve, 3000));
          window.location.href = 'https://creator.douyin.com/creator-micro/content/manage';
          break; // 成功点击后退出循环
        } else {
          throw new Error('未找到发布按钮');
        }
      } catch (error) {
        console.warn(`第 ${attempt + 1} 次尝试查找发布按钮失败:`, error);
        if (attempt === maxAttempts - 1) {
          console.error('达到最大尝试次数，无法找到发布按钮');
        }
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待2秒后重试
      }
    }
  }
}

export async function DouyinVideo(data: SyncData) {
  console.log('DouyinVideo 函数被调用');

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

  async function uploadVideo(file: File): Promise<void> {
    const fileInput = (await waitForElement('input[type=file][accept="video/*"]')) as HTMLInputElement;

    // 创建一个新的 File 对象，因为某些浏览器可能不允许直接设置 fileInput.files
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    // 触发 change 事件
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);

    console.log('视频上传事件已触发');
  }

  try {
    const { content, video, title } = data.data as VideoData;
    // 处理视频上传
    if (video) {
      const response = await fetch(video.url);
      const blob = await response.blob();
      const videoFile = new File([blob], video.name, { type: video.type });
      console.log(`视频文件: ${videoFile.name} ${videoFile.type} ${videoFile.size}`);

      await uploadVideo(videoFile);
      console.log('视频上传已初始化');
    }
    //   try {
    //     // await waitForUploadCompletion();
    //     console.log('视频上传已完成，继续后续操作');
    //   } catch (error) {
    //     console.error('等待视频上传完成时出错:', error);
    //     return;
    //   }
    // } else {
    //   console.error('没有视频文件');
    //   return;
    // }

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 处理标题输入
    const titleInput = (await waitForElement('input[placeholder*="作品标题"]')) as HTMLInputElement;
    if (titleInput) {
      titleInput.value = title || content.slice(0, 20);
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 填写内容
    const contentEditor = (await waitForElement('div[data-line-wrapper="true"]')) as HTMLDivElement;
    if (contentEditor) {
      // 创建一个新的 ClipboardEvent
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      });

      // 设置剪贴板数据
      pasteEvent.clipboardData.setData('text/plain', content);

      // 触发粘贴事件
      contentEditor.dispatchEvent(pasteEvent);
    }

    // 如果需要保留换行符，可以使用 innerHTML
    // editor.innerHTML = contentToInsert.replace(/\n/g, '<br>');

    // 如果需要自动发布，可以添加类似的逻辑
    // if (data.auto_publish) {
    //   // 自动发布逻辑
    // }
  } catch (error) {
    console.error('DouyinVideo 发布过程中出错:', error);
  }
}
