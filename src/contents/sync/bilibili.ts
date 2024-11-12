import { type DynamicData, type SyncData, type VideoData } from './common';

export async function BilibiliDynamic(data: SyncData) {
  console.log('bilibiliDynamic 函数被调用');

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

  // 新增函数：检查图片上传是否完成
  async function checkImageUploadCompletion(
    expectedNewCount: number,
    initialCount: number,
    maxAttempts = 30,
    interval = 1000,
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const currentSuccessCount = document.querySelectorAll('div.bili-pics-uploader__item.success').length;
      const newlyUploadedCount = currentSuccessCount - initialCount;

      if (newlyUploadedCount === expectedNewCount) {
        console.log(`所有 ${expectedNewCount} 张新图片已成功上传`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    const finalSuccessCount = document.querySelectorAll('div.bili-pics-uploader__item.success').length;
    const actualNewlyUploadedCount = finalSuccessCount - initialCount;
    console.warn(`图片上传检查超时：预期新增 ${expectedNewCount} 张，实际新增 ${actualNewlyUploadedCount} 张`);
  }

  async function cleanUploadedImages(): Promise<void> {
    console.log('开始清理已上传的图片');

    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const removeButton = document.querySelector('div.bili-pics-uploader__item__remove') as HTMLElement;

      if (!removeButton) {
        console.log(`没有找到更多图片，已清理 ${i} 张图片`);
        break;
      }

      removeButton.click();
      console.log(`已清理第 ${i + 1} 张图片`);
    }

    console.log('图片清理完成');
  }

  try {
    const { content, images, title } = data.data as DynamicData;

    // 等待编辑器出现
    const editor = (await waitForElement(
      'div[placeholder="有什么想和大家分享的？"][contenteditable="true"]',
    )) as HTMLDivElement;
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 聚焦编辑器
    editor.focus();

    // 清空编辑器内容
    editor.textContent = '';

    // 插入新内容
    editor.textContent = content || '';

    // 触发 input 事件
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: content || '',
    });
    editor.dispatchEvent(inputEvent);

    console.log('编辑器内容已更新');

    // 处理标题输入
    if (title) {
      const titleInput = (await waitForElement('input.bili-dyn-publishing__title__input')) as HTMLInputElement;
      titleInput.focus();
      titleInput.value = title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('标题已输入:', title);
    }

    // 处理图片上传
    const uploadModule = document.querySelector('div.bili-dyn-publishing__image-upload') as HTMLDivElement;
    if (uploadModule) {
      uploadModule.style.display = 'block';
    }

    // 在上传新图片之前清理已有图片
    await cleanUploadedImages();

    if (images.length > 0) {
      const imageData = [];
      for (const file of images) {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const imageFile = new File([blob], file.name, { type: file.type });
        console.log(`文件: ${imageFile.name} ${imageFile.type} ${imageFile.size}`);
        imageData.push(imageFile);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 获取上传前的成功图片数量
      const initialSuccessCount = document.querySelectorAll('div.bili-pics-uploader__item.success').length;

      window.postMessage({ type: 'BILIBILI_DYNAMIC_UPLOAD_IMAGES', files: imageData }, '*');

      // 添加图片上传完成检查
      await checkImageUploadCompletion(images.length, initialSuccessCount);
    }

    // 发布动态
    // const publishResult = await publishDynamic(content, imageData);
    // if (publishResult) {
    //     console.log('动态发布成功');
    // } else {
    //     console.log('动态发布失败');
    // }
    if (data.auto_publish) {
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const publishButton = document.querySelector('div.bili-dyn-publishing__action.launcher') as HTMLDivElement;
        if (publishButton) {
          publishButton.click();
          console.log('已点击发布按钮');
          await new Promise((resolve) => setTimeout(resolve, 3000));
          window.location.reload();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } else {
      const publishButton = (await waitForElement('div.bili-dyn-publishing__action.launcher')) as HTMLDivElement;

      if (publishButton) {
        // 添加点击事件监听器
        publishButton.addEventListener('click', async () => {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          window.location.reload();
        });
        console.log('已为发布按钮添加点击事件监听器');
      } else {
        console.log('未找到发布按钮');
      }
    }
  } catch (error) {
    console.error('biliDynamic 发布过程中出错:', error);
  }
}

export async function BilibiliVideo(data: SyncData) {
  console.log('BilibiliVideo 函数被调用');

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
    const fileInput = (await waitForElement('input[type=file][multiple="multiple"]')) as HTMLInputElement;

    // 创建一个新的 File 对象，因为某些浏览器可能不允许直接设置 fileInput.files
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    // 触发 change 事件
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);

    console.log('视频上传事件已触发');
  }

  async function waitForUploadCompletion(timeout = 600000): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const spans = document.querySelectorAll('span');
        const uploadCompleteElement = Array.from(spans).find(
          (span) => span.textContent && span.textContent.includes('上传完成'),
        );
        if (uploadCompleteElement) {
          clearInterval(checkInterval);
          console.log('视频上传完成');
          resolve();
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('视频上传超时'));
      }, timeout);
    });
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

      try {
        await waitForUploadCompletion();
        console.log('视频上传已完成，继续后续操作');
      } catch (error) {
        console.error('等待视频上传完成时出错:', error);
        return;
      }
    } else {
      console.error('没有视频文件');
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 处理标题输入
    if (title) {
      const titleInput = (await waitForElement('input.input-val[type="text"][maxlength="80"]')) as HTMLInputElement;
      titleInput.focus();
      titleInput.value = title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('标题已输入:', title);
    }

    // 等待简介编辑器出现并输入内容
    const editor = (await waitForElement('div[data-placeholder*="简介"]')) as HTMLDivElement;
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 直接设置文本内容
    const contentToInsert = content || title || '';
    editor.textContent = contentToInsert;

    // 触发 input 事件
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: contentToInsert,
    });
    editor.dispatchEvent(inputEvent);

    console.log('简介已输入:', contentToInsert);

    const hotTagContainers = document.querySelectorAll('div[class="hot-tag-container"]');
    const topThreeTags = Array.from(hotTagContainers).slice(0, 3);

    for (const tag of topThreeTags) {
      const tagElement = tag as HTMLDivElement;
      tagElement.click();
      await new Promise((resolve) => setTimeout(resolve, 500)); // 添加短暂延迟，确保点击生效
    }

    console.log('已自动选择前三个热门标签');

    // 如果需要保留换行符，可以使用 innerHTML
    // editor.innerHTML = contentToInsert.replace(/\n/g, '<br>');

    // 如果需要自动发布，可以添加类似的逻辑
    // if (data.auto_publish) {
    //   // 自动发布逻辑
    // }
  } catch (error) {
    console.error('BilibiliVideo 发布过程中出错:', error);
  }
}
