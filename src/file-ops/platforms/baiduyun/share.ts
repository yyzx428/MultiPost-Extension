/**
 * @file 百度云分享操作模块
 * @description 负责在百度网盘中创建分享链接
 */

import type { ShareConfig, ShareResult, FileItem, FileSelectionConfig } from '../../types';
import { Waiter } from '../../common/waiter';

//===================================
// 百度云分享处理器
//===================================

export class BaiduYunShareHandler {
    private waiter: Waiter;

    constructor() {
        this.waiter = new Waiter();
    }

    /**
     * 创建分享链接
     * @param config 分享配置
     * @param currentFiles 当前文件列表
     * @returns 分享结果
     */
    async createShare(config: ShareConfig, currentFiles: FileItem[] = []): Promise<ShareResult> {
        try {
            // 第1步：选择要分享的文件
            const selectedFiles = await this.selectTargetFiles(config.selection, currentFiles);

            // 第2步：点击分享按钮
            await this.clickShareButton();

            // 第3步：等待分享弹窗出现
            await this.waitForShareDialog();

            // 第4步：配置分享参数
            await this.configureShareSettings(config);

            // 第5步：创建分享链接
            const shareResult = await this.createShareLink();

            // 第6步：获取分享结果
            return {
                ...shareResult,
                sharedFiles: selectedFiles
            };

        } catch (error) {
            throw new Error(`创建分享失败: ${error.message}`);
        }
    }

    /**
     * 选择要分享的文件
     * @param selection 选择配置
     * @param currentFiles 当前文件列表
     * @returns 选择的文件列表
     */
    private async selectTargetFiles(
        selection: FileSelectionConfig = { selectAll: true },
        currentFiles: FileItem[]
    ): Promise<FileItem[]> {
        const selectedFiles: FileItem[] = [];

        if (selection.selectAll) {
            // 选择全部文件
            await this.selectAllFiles();
            return currentFiles;
        }

        if (selection.selectByName && selection.selectByName.length > 0) {
            // 按名称选择
            for (const fileName of selection.selectByName) {
                const success = await this.selectFileByName(fileName);
                if (success) {
                    const file = currentFiles.find(f => f.name === fileName);
                    if (file) {
                        selectedFiles.push(file);
                    }
                }
            }
        }

        if (selection.selectByType) {
            // 按类型选择
            const typeFiles = currentFiles.filter(file => {
                switch (selection.selectByType) {
                    case 'files':
                        return file.type === 'file';
                    case 'folders':
                        return file.type === 'folder';
                    case 'all':
                    default:
                        return true;
                }
            });

            for (const file of typeFiles) {
                await this.selectFileByName(file.name);
                selectedFiles.push(file);
            }
        }

        if (selection.selectByPattern) {
            // 按模式匹配选择
            const regex = new RegExp(selection.selectByPattern);
            const matchedFiles = currentFiles.filter(file => regex.test(file.name));

            for (const file of matchedFiles) {
                await this.selectFileByName(file.name);
                selectedFiles.push(file);
            }
        }

        return selectedFiles;
    }

    /**
     * 选择全部文件
     */
    private async selectAllFiles(): Promise<void> {
        // 查找全选复选框
        const selectAllCheckbox = await this.findSelectAllCheckbox();

        if (selectAllCheckbox) {
            selectAllCheckbox.click();
            selectAllCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
            await this.waiter.sleep(500);
            return;
        }

        // 如果没有全选框，逐个选择所有文件
        const fileCheckboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const checkbox of fileCheckboxes) {
            const input = checkbox as HTMLInputElement;
            if (!input.checked) {
                input.click();
                input.dispatchEvent(new Event('change', { bubbles: true }));
                await this.waiter.sleep(100);
            }
        }
    }

    /**
     * 按名称选择文件
     * @param fileName 文件名
     * @returns 是否成功选择
     */
    private async selectFileByName(fileName: string): Promise<boolean> {
        // 查找文件行
        const fileRow = await this.findFileRowByName(fileName);
        if (!fileRow) {
            return false;
        }

        // 查找复选框
        const checkbox = fileRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (checkbox && !checkbox.checked) {
            checkbox.click();
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            await this.waiter.sleep(100);
            return true;
        }

        return false;
    }

    /**
     * 查找全选复选框
     * @returns 全选复选框元素或null
     */
    private async findSelectAllCheckbox(): Promise<HTMLInputElement | null> {
        const strategies = [
            () => document.querySelector('input[type="checkbox"][data-select="all"]'),
            () => document.querySelector('.select-all input[type="checkbox"]'),
            () => document.querySelector('thead input[type="checkbox"]'),
            () => {
                // 查找第一个复选框，通常是全选
                const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                return checkboxes.length > 0 ? checkboxes[0] : null;
            }
        ];

        for (const strategy of strategies) {
            const element = strategy() as HTMLInputElement;
            if (element) {
                return element;
            }
        }

        return null;
    }

    /**
     * 按名称查找文件行
     * @param fileName 文件名
     * @returns 文件行元素或null
     */
    private async findFileRowByName(fileName: string): Promise<Element | null> {
        // 查找包含指定文件名的行
        const rows = document.querySelectorAll('tr, .file-item, .list-item');

        for (const row of rows) {
            const nameElement = row.querySelector('a[title], .file-name, .name');
            const name = nameElement?.getAttribute('title') || nameElement?.textContent?.trim();

            if (name === fileName) {
                return row;
            }
        }

        return null;
    }

    /**
     * 点击分享按钮
     */
    private async clickShareButton(): Promise<void> {
        const shareButton = await this.findShareButton();

        if (!shareButton) {
            throw new Error('找不到分享按钮');
        }

        shareButton.click();
        shareButton.dispatchEvent(new Event('click', { bubbles: true }));

        await this.waiter.sleep(1000);
    }

    /**
     * 查找分享按钮 - 更新为最新的百度网盘界面
     */
    private async findShareButton(): Promise<HTMLElement | null> {
        // 新界面的分享按钮选择器
        const selectors = [
            '[data-button-id="b5"]', // 旧版本选择器
            'button[data-type="share"]', // 通用分享按钮
            '.toolbar-button[data-type="share"]', // 工具栏分享按钮
            'button:contains("分享")', // 包含"分享"文字的按钮
            '.nd-file-list-toolbar button[title*="分享"]' // 标题包含分享的按钮
        ];

        for (const selector of selectors) {
            try {
                const button = await this.waiter.waitForElement(selector, 2000) as HTMLElement;
                if (button && button.offsetParent !== null) { // 确保按钮可见
                    return button;
                }
            } catch (error) {
                // 继续尝试下一个选择器
            }
        }

        // 如果都找不到，尝试通过文本查找
        try {
            const buttons = document.querySelectorAll('button, [role="button"]');
            for (const button of buttons) {
                if (button.textContent?.includes('分享') &&
                    (button as HTMLElement).offsetParent !== null) {
                    return button as HTMLElement;
                }
            }
        } catch (error) {
            console.log('文本查找分享按钮失败:', error);
        }

        return null;
    }

    /**
     * 查找复制链接按钮 - 更新为最新界面
     */
    private async findCopyLinkButton(): Promise<HTMLElement | null> {
        const selectors = [
            'button.wp-share-file__link-create-ubtn:not(.qrcode)', // 最新的复制链接按钮
            'button:contains("复制链接")', // 包含"复制链接"文字的按钮
            '.wp-share-file__link-create-btn button:first-child', // 分享按钮区域的第一个按钮
            '[class*="copy"] button', // 包含copy类名的按钮
            'button.u-button--primary:contains("复制")' // 主要按钮且包含复制文字
        ];

        for (const selector of selectors) {
            try {
                const button = await this.waiter.waitForElement(selector, 3000) as HTMLElement;
                if (button && button.offsetParent !== null &&
                    (button.textContent?.includes('复制链接') || button.textContent?.includes('复制'))) {
                    return button;
                }
            } catch (error) {
                // 继续尝试下一个选择器
            }
        }

        return null;
    }

    /**
     * 等待分享弹窗出现
     */
    private async waitForShareDialog(): Promise<void> {
        const dialogSelectors = [
            '.share-dialog',
            '.modal',
            '.popup',
            '[role="dialog"]',
            '.dialog-container'
        ];

        for (const selector of dialogSelectors) {
            const dialog = await this.waiter.waitForElement(selector, 5000);
            if (dialog) {
                await this.waiter.sleep(1000);
                return;
            }
        }

        throw new Error('分享弹窗未出现');
    }

    /**
     * 配置分享设置
     * @param config 分享配置
     */
    private async configureShareSettings(config: ShareConfig): Promise<void> {
        // 选择链接分享方式
        await this.selectLinkShareMode();

        // 设置有效期
        await this.setValidPeriod(config.validPeriod);

        // 设置提取码
        await this.setExtractCode(config.extractCodeType, config.customCode);

        // 设置用户信息隐藏
        if (config.hideUserInfo) {
            await this.setHideUserInfo(true);
        }
    }

    /**
     * 选择链接分享方式
     */
    private async selectLinkShareMode(): Promise<void> {
        const linkShareSelectors = [
            '.link-share-tab',
            'input[value="link"]',
            '[data-share-type="link"]',
            'button:contains("链接分享")'
        ];

        for (const selector of linkShareSelectors) {
            const element = await this.waiter.waitForElement(selector, 2000);
            if (element) {
                (element as HTMLElement).click();
                await this.waiter.sleep(500);
                return;
            }
        }
    }

    /**
     * 设置有效期
     * @param period 有效期
     */
    private async setValidPeriod(period: string): Promise<void> {
        // 查找有效期选择控件
        const periodSelectors = [
            '.valid-period-select',
            '.period-select',
            'select[name*="period"]',
            '[data-field="period"]'
        ];

        for (const selector of periodSelectors) {
            const element = await this.waiter.waitForElement(selector, 2000);
            if (element) {
                await this.selectOptionByText(element as HTMLSelectElement, period);
                return;
            }
        }

        // 尝试通过单选按钮设置
        await this.selectRadioByText(period);
    }

    /**
     * 设置提取码
     * @param codeType 提取码类型
     * @param customCode 自定义提取码
     */
    private async setExtractCode(codeType: string, customCode?: string): Promise<void> {
        // 选择提取码类型
        await this.selectRadioByText(codeType);

        // 如果是自定义提取码，填写自定义码
        if (codeType === '自定义' && customCode) {
            const codeInput = await this.waiter.waitForElement('.custom-code-input, input[name*="code"]');
            if (codeInput) {
                const input = codeInput as HTMLInputElement;
                input.value = customCode;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }

    /**
     * 设置隐藏用户信息
     * @param hide 是否隐藏
     */
    private async setHideUserInfo(hide: boolean): Promise<void> {
        const hideCheckbox = await this.waiter.waitForElement(
            'input[type="checkbox"][name*="hide"], input[type="checkbox"][name*="anonymous"]'
        );

        if (hideCheckbox) {
            const checkbox = hideCheckbox as HTMLInputElement;
            if (checkbox.checked !== hide) {
                checkbox.click();
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    /**
     * 创建分享链接
     * @returns 分享结果
     */
    private async createShareLink(): Promise<Omit<ShareResult, 'sharedFiles'>> {
        // 点击创建链接按钮
        const createButton = await this.findCreateLinkButton();
        if (!createButton) {
            throw new Error('找不到创建链接按钮');
        }

        createButton.click();
        createButton.dispatchEvent(new Event('click', { bubbles: true }));

        // 等待分享结果出现
        await this.waitForShareResult();

        // 提取分享信息
        return await this.extractShareInfo();
    }

    /**
     * 查找创建链接按钮
     * @returns 创建链接按钮或null
     */
    private async findCreateLinkButton(): Promise<HTMLElement | null> {
        const strategies = [
            () => document.querySelector('.create-link-btn'),
            () => document.querySelector('button[type="submit"]'),
            () => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(btn =>
                    btn.textContent?.includes('创建') ||
                    btn.textContent?.includes('确定') ||
                    btn.textContent?.includes('生成')
                );
            }
        ];

        for (const strategy of strategies) {
            const element = strategy();
            if (element) {
                return element as HTMLElement;
            }
        }

        return null;
    }

    /**
     * 等待分享结果出现
     */
    private async waitForShareResult(): Promise<void> {
        const resultSelectors = [
            '.share-result',
            '.share-url',
            '.link-result',
            'input[readonly][value*="pan.baidu.com"]'
        ];

        for (const selector of resultSelectors) {
            const result = await this.waiter.waitForElement(selector, 10000);
            if (result) {
                await this.waiter.sleep(1000);
                return;
            }
        }

        throw new Error('分享结果未出现');
    }

    /**
     * 提取分享信息
     * @returns 分享信息
     */
    private async extractShareInfo(): Promise<Omit<ShareResult, 'sharedFiles'>> {
        // 提取分享链接
        const shareUrl = await this.extractShareUrl();

        // 提取提取码
        const extractCode = await this.extractCode();

        // 提取有效期信息
        const validUntil = await this.extractValidPeriod();

        return {
            shareUrl,
            extractCode,
            validUntil,
            createdAt: new Date().toISOString()
        };
    }

    /**
     * 提取分享链接
     * @returns 分享链接
     */
    private async extractShareUrl(): Promise<string> {
        const urlSelectors = [
            '.share-url-input',
            'input[readonly][value*="pan.baidu.com"]',
            '.share-link',
            '.url-display'
        ];

        for (const selector of urlSelectors) {
            const element = document.querySelector(selector) as HTMLInputElement;
            if (element && element.value) {
                return element.value;
            }
        }

        // 尝试从文本中提取
        const textElements = document.querySelectorAll('.share-result *');
        for (const element of textElements) {
            const text = element.textContent || '';
            const urlMatch = text.match(/https:\/\/pan\.baidu\.com\/s\/\w+/);
            if (urlMatch) {
                return urlMatch[0];
            }
        }

        throw new Error('无法提取分享链接');
    }

    /**
     * 提取提取码
     * @returns 提取码或undefined
     */
    private async extractCode(): Promise<string | undefined> {
        const codeSelectors = [
            '.extract-code-display',
            '.code-display',
            '[data-field="code"]'
        ];

        for (const selector of codeSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
                return element.textContent.trim();
            }
        }

        // 尝试从文本中提取
        const textElements = document.querySelectorAll('.share-result *');
        for (const element of textElements) {
            const text = element.textContent || '';
            const codeMatch = text.match(/提取码[：:]\s*([a-zA-Z0-9]+)/);
            if (codeMatch) {
                return codeMatch[1];
            }
        }

        return undefined;
    }

    /**
     * 提取有效期信息
     * @returns 有效期描述
     */
    private async extractValidPeriod(): Promise<string> {
        const periodSelectors = [
            '.valid-period-display',
            '.period-display',
            '[data-field="period"]'
        ];

        for (const selector of periodSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
                return element.textContent.trim();
            }
        }

        return '未知';
    }

    /**
     * 通过文本选择下拉选项
     * @param select 下拉框元素
     * @param text 选项文本
     */
    private async selectOptionByText(select: HTMLSelectElement, text: string): Promise<void> {
        const options = Array.from(select.options);
        const option = options.find(opt => opt.text.includes(text));

        if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    /**
     * 通过文本选择单选按钮
     * @param text 单选按钮标签文本
     */
    private async selectRadioByText(text: string): Promise<void> {
        const labels = Array.from(document.querySelectorAll('label'));

        for (const label of labels) {
            if (label.textContent?.includes(text)) {
                const radio = label.querySelector('input[type="radio"]') as HTMLInputElement;
                if (radio) {
                    radio.click();
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }
            }
        }

        // 尝试直接查找单选按钮
        const radios = document.querySelectorAll('input[type="radio"]');
        for (const radio of radios) {
            const radioElement = radio as HTMLInputElement;
            const parent = radioElement.closest('label, .radio-item, .option');
            if (parent && parent.textContent?.includes(text)) {
                radioElement.click();
                radioElement.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
        }
    }

    /**
     * 获取操作日志
     * @returns 操作日志数组
     */
    getLogs() {
        return this.waiter.getLogs();
    }

    /**
     * 清理资源
     */
    cleanup(): void {
        this.waiter.clearLogs();
    }
} 