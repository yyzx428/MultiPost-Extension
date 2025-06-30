import type { SyncData, ShangPinData } from "~sync/common";

export async function ShangpinRednote(data: SyncData) {

    const { isAutoPublish } = data;
    const { title, files, prize, num } = data.data as ShangPinData;

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


    async function choiceClassify() {
        if (!operationChoice('div[class="level-label"]', "个性")) {
            return false;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!operationChoice('li[class="option"]', "数字")) {
            return false;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!operationChoice('li[class="option"]', "电子资料包")) {
            return false;
        }

        return true;
    }

    async function operationChoice(path: string, labelName: string) {
        waitForElement(path);
        const labels = document.querySelectorAll(path);
        const label = Array.from(labels).find(
            (element) => element.children[0].textContent?.includes(labelName),
        ) as HTMLElement;
        if (!label) {
            console.log(labelName + '分类没找到');
            return false;
        }

        label.children[0].dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }))
    }

    async function processImageError() {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const images = document.querySelectorAll('div[class="upload-trigger"]');

        for (const image of images) {
            image.children[0].dispatchEvent(new Event('mouseenter', { bubbles: true }))
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const operations = document.querySelectorAll('span[class="d-text --color-text-paragraph --size-text-small"]')
            const caijian = Array.from(operations).find((element) => element.textContent.includes("裁剪")) as HTMLElement;
            if (!caijian) {
                console.log("裁剪按钮没找到")
                return false;
            }
            caijian.click();
            caijian.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            await new Promise((resolve) => setTimeout(resolve, 3000));
            const confirButtons = document.querySelector('div[class="d-drawer d-drawer-right material-operas-drawer"]')
                .querySelectorAll('span[class="d-text --color-current-typography --size-text-paragraph d-text-nowrap d-text-ellipsis d-text-nowrap"]');
            const confirmButton = Array.from(confirButtons).find((element) => element.textContent.includes('确认')) as HTMLElement;

            if (!confirmButton) {
                console.log('没有找到确认按钮');
                return false;
            }

            confirmButton.click();
            confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
        return true;
    }


    async function processZhuTu() {
        waitForElement('span[class="d-text --color-primary-typography --size-text-small"]');
        const battons = document.querySelectorAll('span[class="d-text --color-primary-typography --size-text-small"]');
        const batton = Array.from(battons).find((element) => element.textContent.includes("从商品主图填入")) as HTMLElement;
        if (!batton) {
            console.error("从商品主图填入按钮没找到")
            return false;
        }
        batton.click();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return true;
    }

    async function prcessPrizeNum() {
        const inputs = document.querySelector('div[class="goods_excel-table-container"]').querySelectorAll('input');

        const prizeInput = inputs[0] as HTMLInputElement;
        if (!prize) {
            console.error("从商品价格输入框没找到")
            return;
        }
        prizeInput.dispatchEvent(new MouseEvent('focus', { bubbles: true }));
        prizeInput.value = prize;
        prizeInput.dispatchEvent(new MouseEvent('input', { bubbles: true }));
        prizeInput.dispatchEvent(new MouseEvent('blur', { bubbles: true }));

        const numsInput = inputs[2]
        if (!numsInput) {
            console.error("从商品数量输入框没找到")
            return;
        }

        numsInput.dispatchEvent(new MouseEvent('focus', { bubbles: true }));
        numsInput.value = num;
        numsInput.dispatchEvent(new MouseEvent('input', { bubbles: true }));
        numsInput.dispatchEvent(new MouseEvent('blur', { bubbles: true }));


        const confirButtons = document.querySelectorAll('span[class="d-text --color-current-typography --size-text-paragraph d-text-nowrap d-text-ellipsis d-text-nowrap"]');
        const confirmButton = Array.from(confirButtons).find((element) => element.textContent.includes("提交商品")) as HTMLElement;
        if (!confirmButton) {
            console.error("提交商品按钮没找到")
            return;
        }

        confirmButton.click();
    }

    // 辅助函数：上传文件
    async function uploadImages() {
        await waitForElement('span[class="d-text --color-text-description-typography --size-text-small"]');
        const uploadBottons = document.querySelectorAll('span[class="d-text --color-text-description-typography --size-text-small"]');
        const uploadBotton = Array.from(uploadBottons).find(
            (element) => element.textContent?.includes('上传主图'),
        ) as HTMLElement
        if (!uploadBotton) {
            console.log('没找到图片上传按钮');
            return false;
        }

        uploadBotton.click();
        uploadBotton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        waitForElement('input[placeholder="输入关键词"]')
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待文件处理
        const localUploadButtons = document.querySelectorAll('span[class="d-text --color-current-typography --size-text-paragraph d-text-nowrap d-text-ellipsis d-text-nowrap"]');
        const localUploadButton = Array.from(localUploadButtons).find(
            (element) => element.textContent?.includes('上传本地图片'),
        ) as HTMLElement
        if (!localUploadButton) {
            console.log('没找到本地图片上传按钮');
            return false;
        }

        localUploadButton.click();
        localUploadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待文件处理

        const fileInput = (await waitForElement('input[type="file"]')) as HTMLInputElement;
        if (!fileInput) {
            console.error('未找到文件输入元素');
            return false;
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
            await new Promise((resolve) => setTimeout(resolve, 3000)); // 等待文件处理
            console.log('文件上传操作完成');
        } else {
            console.error('没有成功添加任何文件');
        }


        let confirButtons = document.querySelector('div[class="d-drawer d-drawer-right material-upload-drawer"]')
            .querySelectorAll('span[class="d-text --color-current-typography --size-text-paragraph d-text-nowrap d-text-ellipsis d-text-nowrap"]');
        let confirmButton = Array.from(confirButtons).find((element) => element.textContent.includes('取消')) as HTMLElement;

        if (!confirmButton) {
            console.error('没有找到上传框取消按钮');
            return false;
        }

        confirmButton.parentElement.parentElement.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

        confirButtons = document.querySelector('div[class="d-drawer d-drawer-right material-space-drawer"]')
            .querySelectorAll('span[class="d-text --color-current-typography --size-text-paragraph d-text-nowrap d-text-ellipsis d-text-nowrap"]');
        confirmButton = Array.from(confirButtons).find((element) => element.textContent.includes('取消')) as HTMLElement;
        confirmButton.parentElement.parentElement.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

        if (!confirmButton) {
            console.error('没有找到素材库取消按钮');
            return false;
        }
        return true;
    }

    if (files && files.length > 0) {
        // 等待页面加载
        await waitForElement('input[class="d-text"]');
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const inputs = document.querySelectorAll('input[class="d-text"]');
        if (!inputs) {
            console.log('没找到输入框');
            return;
        }

        const titleInput = Array.from(inputs).find(
            (element: HTMLInputElement) => element.placeholder?.includes('系统已自动在商品标题前拼接品牌名称'),
        ) as HTMLInputElement
        if (!titleInput) {
            console.log('没找到标题输入框');
            return;
        }

        titleInput.dispatchEvent(new MouseEvent('focus', { bubbles: true }));
        titleInput.value = title;
        titleInput.dispatchEvent(new MouseEvent('input', { bubbles: true }));
        titleInput.dispatchEvent(new MouseEvent('blur', { bubbles: true }));

        if (!await uploadImages()) {
            return;
        }


        if (!await processImageError()) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!await choiceClassify()) {
            console.log("没找到分类选项");
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        const nextButtons = document.querySelectorAll('span[class="d-text --color-current-typography --size-text-paragraph d-text-nowrap d-text-ellipsis d-text-nowrap"]');
        const nextButton = Array.from(nextButtons).find((e) => e.textContent.includes('下一步')) as HTMLElement;
        if (!nextButton) {
            console.log("没找到下一步按钮");
            return;
        }

        nextButton.click();

        await new Promise((resolve) => setTimeout(resolve, 3000));
        await processZhuTu();

        await prcessPrizeNum();

        const publishButtons = document.querySelectorAll('div[class="d-button-content"]');
        const publishText = isAutoPublish ? "提交商品" : "保存草稿"
        const publishButton = Array.from(publishButtons).find((e) => e.children[0].textContent.includes(publishText)) as HTMLElement;
        if (!publishButton) {
            console.log("没找到" + publishText + "按钮");
            return;
        }

        publishButton.parentElement.click();

        console.log("完成小红书商品上传");
    }
}



