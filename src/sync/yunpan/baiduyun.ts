import type { SyncData, YunPanData } from "~sync/common";

export async function BaiduYunPan(data: SyncData) {

    const { paths, files } = data.data as YunPanData;

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

    // 辅助函数：上传文件
    async function uploadImages() {
        const fileInput = (await waitForElement('input[title="点击选择文件"]')) as HTMLInputElement;
        if (!fileInput) {
            console.error('未找到文件输入元素');
            return;
        }

        const dataTransfer = new DataTransfer();

        for (const fileInfo of files) {
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

    if (files && files.length > 0) {
        // 等待页面加载
        await waitForElement('a[title="' + paths[0] + '"]', 2000);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        for (const path of paths) {
            await waitForElement('a[title="' + path + '"]', 2000);
            let dir = document.querySelector('a[title="' + path + '"]') as HTMLElement;
            if (!dir) {
                const newDirButton = document.querySelector('button[title="新建文件夹"]') as HTMLElement;
                if (!newDirButton) {
                    console.error('未找到新建文件夹按钮');
                    return;
                }

                newDirButton.click();
                newDirButton.dispatchEvent(new Event('click', { bubbles: true }));

                const dirNameInputs = document.querySelectorAll('input[class="u-input__inner"]');
                const dirNameInput = Array.from(dirNameInputs).find(
                    (element: HTMLInputElement) => !element.placeholder?.includes('搜索我的文件'),
                ) as HTMLInputElement
                if (!dirNameInput) {
                    console.error('未找到文件名输入框');
                    return;
                }

                dirNameInput.value = path;
                dirNameInput.dispatchEvent(new Event('input', { bubbles: true }));

                const confirDirButton = document.querySelector('i[class="iconfont icon-check"]') as HTMLElement;
                if (!confirDirButton) {
                    console.error('未找到文件名确认按钮');
                    return;
                }

                confirDirButton.click();
                confirDirButton.dispatchEvent(new Event('click', { bubbles: true }));

                dir = document.querySelector('a[title="' + path + '"]') as HTMLElement;
            }

            if (!dir) {
                console.error('未找到' + path + '文件夹');
                return;
            }
            dir.click();
            dir.dispatchEvent(new Event('click', { bubbles: true }));
        }

        await uploadImages();

        console.log("完成百度云文件上传");
    }
}