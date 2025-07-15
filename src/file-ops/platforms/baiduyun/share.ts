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
            const shareDialog = await this.waitForShareDialog();

            // 第4步：配置分享参数
            await this.configureShareSettings(shareDialog, config);

            // 第5步：创建分享链接
            const shareResult = await this.createShareLink(shareDialog);
            console.log('shareResult', shareResult);

            // 检查分享结果是否有效
            if (!shareResult) {
                throw new Error('创建分享链接失败：无法获取分享结果');
            }

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

        if (selection.selectByFolder && selection.selectByFolder.length > 0) {
            for (const folderName of selection.selectByFolder) {
                const folder = currentFiles.find(f => f.name === folderName);
                if (folder) {
                    await this.selectFileByName(folder.name);
                    selectedFiles.push(folder);
                }
            }
        }

        return selectedFiles;
    }

    /**
     * 选择全部文件
     */
    private async selectAllFiles(): Promise<void> {
        // 首先尝试通过点击文件行来选择
        const fileRows = document.querySelectorAll('.wp-s-pan-table__body-row, .wp-s-table-skin-hoc__tr, .mouse-choose-item');

        if (fileRows.length > 0) {
            // 点击第一个文件行来选择
            const firstFile = fileRows[0] as HTMLElement;
            firstFile.click();

            // 触发点击事件
            firstFile.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            }));

            await this.waiter.sleep(1000); // 等待界面更新

            // 检查是否有文件被选中
            const selected = document.querySelectorAll('.selected, [class*="selected"]');
            if (selected.length > 0) {
                return; // 选择成功
            }
        }

        // 如果文件行点击失败，尝试查找全选复选框
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

        // 首先尝试点击文件行本身
        (fileRow as HTMLElement).click();
        (fileRow as HTMLElement).dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        }));

        await this.waiter.sleep(500);

        // 检查是否被选中
        if (fileRow.classList.contains('selected') || fileRow.querySelector('.selected')) {
            return true;
        }

        // 如果点击文件行失败，尝试查找复选框
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
        // 首先查找百度云表格行
        const tableRows = document.querySelectorAll('.wp-s-pan-table__body-row, .wp-s-table-skin-hoc__tr');
        for (const row of tableRows) {
            if (row.textContent?.includes(fileName)) {
                return row;
            }
        }
        // 查找包含指定文件名的行
        const rows = document.querySelectorAll('tr, .file-item, .list-item');
        console.log('查找文件行:', rows);
        for (const row of rows) {
            const nameElement = row.querySelector('a[title], .file-name, .name');
            const name = nameElement?.getAttribute('title') || nameElement?.textContent?.trim();
            console.log('查找文件行:', name);
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
        // 首先尝试查找直接可见的分享按钮
        const shareButton = await this.findShareButton();

        if (!shareButton) {
            throw new Error('找不到分享按钮');
        }

        // 点击分享按钮
        shareButton.click();

        // 触发额外的事件以确保点击生效
        shareButton.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        }));
    }

    /**
 * 通过右键菜单触发分享
 */
    private async triggerShareFromContextMenu(): Promise<HTMLElement | null> {
        try {
            // 查找已选中的文件
            let selectedFiles = document.querySelectorAll('.selected, [class*="selected"]');

            if (selectedFiles.length === 0) {
                // 如果没有选中文件，尝试选中第一个文件
                const fileSelectors = [
                    '.wp-s-pan-table__body-row', // 百度云表格文件行
                    '.wp-s-table-skin-hoc__tr', // 百度云表格行
                    '.mouse-choose-item', // 可选择的项目
                    '.wp-s-file-main-item', // 百度云文件项
                    '.list-item', // 列表项
                    '.grid-item', // 网格项
                    '.file-item', // 文件项
                    'tr[class*="row"]', // 表格行
                    '[class*="file"]', // 包含file的类名
                    '[class*="item"]' // 包含item的类名
                ];

                let firstFile = null;
                for (const selector of fileSelectors) {
                    firstFile = document.querySelector(selector);
                    if (firstFile) break;
                }

                if (firstFile) {
                    (firstFile as HTMLElement).click();
                    await this.waiter.sleep(500);

                    // 重新查找选中的文件
                    selectedFiles = document.querySelectorAll('.selected, [class*="selected"]');
                }
            }

            // 查找可以右键点击的文件元素
            const targetElements = selectedFiles.length > 0 ? selectedFiles :
                document.querySelectorAll('.wp-s-pan-table__body-row, .wp-s-table-skin-hoc__tr, .mouse-choose-item, .wp-s-file-main-item, .list-item, .grid-item, .file-item');

            for (const fileElement of targetElements) {
                // 确保元素可见
                if ((fileElement as HTMLElement).offsetParent === null) {
                    continue;
                }

                // 获取元素的位置信息
                const rect = fileElement.getBoundingClientRect();

                // 触发右键菜单
                const contextMenuEvent = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 2,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });

                fileElement.dispatchEvent(contextMenuEvent);
                await this.waiter.sleep(1500); // 给更多时间让菜单出现

                // 查找右键菜单中的分享选项
                const shareMenuItem = await this.findShareButtonInContextMenu();
                if (shareMenuItem) {
                    return shareMenuItem;
                }

                // 如果没有找到，关闭菜单继续尝试下一个元素
                document.body.click(); // 点击其他地方关闭菜单
                await this.waiter.sleep(300);
            }

            return null;
        } catch {
            console.log('右键菜单触发分享失败:');
            return null;
        }
    }

    /**
     * 查找分享按钮 - 更新为最新的百度网盘界面
     */
    private async findShareButton(): Promise<HTMLElement | null> {
        // 首先尝试查找工具栏中的分享按钮（基于实际HTML结构）
        const toolbarSelectors = [
            '.wp-s-agile-tool-bar__h-action-button[title="分享"]', // 最新的工具栏分享按钮
            'button[title="分享"]', // 通用分享按钮（通过title匹配）
            '.wp-s-agile-tool-bar button:has(.u-icon-share)', // 包含分享图标的工具栏按钮
            '.u-button[title="分享"]', // UI库按钮
            '[data-button-id="b5"]', // 旧版本选择器
            'button[data-type="share"]', // 通用分享按钮
            '.toolbar-button[data-type="share"]', // 工具栏分享按钮
            '.nd-file-list-toolbar button[title*="分享"]', // 标题包含分享的按钮
            '.wp-s-agile-tool-bar button[title*="分享"]', // 新版工具栏分享按钮
            'button[aria-label*="分享"]' // aria-label包含分享的按钮
        ];

        for (const selector of toolbarSelectors) {
            try {
                // 对于 :has 选择器，需要手动处理
                if (selector.includes(':has')) {
                    const buttons = document.querySelectorAll('.wp-s-agile-tool-bar button');
                    for (const button of buttons) {
                        const icon = button.querySelector('.u-icon-share');
                        if (icon && (button as HTMLElement).offsetParent !== null) {
                            return button as HTMLElement;
                        }
                    }
                } else {
                    const button = await this.waiter.waitForElement(selector, 1000) as HTMLElement;
                    if (button && button.offsetParent !== null) { // 确保按钮可见
                        return button;
                    }
                }
            } catch {
                // 继续尝试下一个选择器
            }
        }

        // 如果工具栏没有找到，通过文本查找
        try {
            const allButtons = document.querySelectorAll('.wp-s-agile-tool-bar button, .u-button');
            for (const button of allButtons) {
                const title = button.getAttribute('title');
                const text = button.textContent?.trim();

                if ((title === '分享' || text?.includes('分享')) &&
                    (button as HTMLElement).offsetParent !== null) {
                    return button as HTMLElement;
                }
            }
        } catch {
            console.log('文本查找分享按钮失败:');
        }

        // 如果工具栏没有找到，尝试右键菜单方式
        return await this.findShareButtonInContextMenu();
    }

    /**
     * 在右键菜单中查找分享按钮
     */
    private async findShareButtonInContextMenu(): Promise<HTMLElement | null> {
        try {
            // 查找百度云右键菜单中的分享选项 - 基于实际DOM结构
            const contextMenuSelectors = [
                '.wp-s-ctx-menu__item .wp-s-ctx-menu__item-text:contains("分享")', // 分享文本
                '.wp-s-ctx-menu__item:has(.u-icon-share)', // 包含分享图标的菜单项
                '.wp-s-ctx-menu__item:has(.wp-s-ctx-menu__item-text:contains("分享"))', // 包含分享文本的菜单项
                '.ctx-menu-container .wp-s-ctx-menu__item:contains("分享")', // 完整右键菜单容器
                '.wp-s-ctx-menu .wp-s-ctx-menu__item', // 所有右键菜单项（需要文本匹配）
                '.context-menu .menu-item:contains("分享")', // 通用菜单项
                '.right-menu .menu-item:contains("分享")', // 右键菜单项
                '[role="menuitem"]:contains("分享")' // ARIA菜单项
            ];

            // 首先尝试精确选择器
            for (const selector of contextMenuSelectors.slice(0, 4)) {
                try {
                    // 对于 :contains 和 :has 选择器，需要手动查找
                    if (selector.includes(':contains') || selector.includes(':has')) {
                        const elements = document.querySelectorAll(selector.split(':')[0]);
                        for (const element of elements) {
                            if (element.textContent?.includes('分享') &&
                                (element as HTMLElement).offsetParent !== null) {
                                return element as HTMLElement;
                            }
                        }
                    } else {
                        const menuItem = document.querySelector(selector) as HTMLElement;
                        if (menuItem && menuItem.offsetParent !== null) {
                            return menuItem;
                        }
                    }
                } catch {
                    // 继续尝试下一个选择器
                }
            }

            // 如果精确选择器没找到，遍历所有右键菜单项
            const allMenuItems = document.querySelectorAll('.wp-s-ctx-menu__item, .menu-item, [role="menuitem"]');
            for (const item of allMenuItems) {
                const textElement = item.querySelector('.wp-s-ctx-menu__item-text, .menu-text');
                const text = textElement?.textContent?.trim() || item.textContent?.trim();

                if (text === '分享' && (item as HTMLElement).offsetParent !== null) {
                    return item as HTMLElement;
                }
            }

            // 最后尝试通过图标查找分享按钮
            const shareIconItems = document.querySelectorAll('.u-icon-share');
            for (const icon of shareIconItems) {
                const menuItem = icon.closest('.wp-s-ctx-menu__item, .menu-item');
                if (menuItem && (menuItem as HTMLElement).offsetParent !== null) {
                    return menuItem as HTMLElement;
                }
            }

            return null;
        } catch {
            console.log('右键菜单查找分享按钮失败:');
            return null;
        }
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
            } catch {
                // 继续尝试下一个选择器
            }
        }

        return null;
    }

    /**
     * 等待分享弹窗出现
     */
    private async waitForShareDialog(): Promise<HTMLElement> {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const dialogs = document.querySelectorAll('div[role="dialog"]');
        const dialog = Array.from(dialogs).find(dialog => {
            return dialog.textContent?.includes('分享文件');
        });
        if (dialog) {
            console.log('分享弹窗:', dialog);
            return dialog as HTMLElement;
        }
        console.log('分享弹窗未出现');
        throw new Error('分享弹窗未出现');
    }

    /**
     * 配置分享设置
     * @param config 分享配置
     */
    private async configureShareSettings(shareDialog: HTMLElement,
        config: ShareConfig): Promise<void> {
        // 选择链接分享方式
        await this.selectLinkShareMode(shareDialog, config);

        // 设置有效期
        await this.setValidPeriod(shareDialog, config.validPeriod);


        // 设置用户信息隐藏
        if (config.hideUserInfo) {
            await this.setHideUserInfo(true);
        }
    }

    /**
     * 选择链接分享方式
     */
    private async selectLinkShareMode(shareDialog: HTMLElement, config: ShareConfig): Promise<void> {
        const linkShareSelectors = shareDialog.querySelectorAll('div[class="u-form-item"]');
        const linkShareItem = Array.from(linkShareSelectors).find(item => {
            return item.textContent?.includes('提取码');
        });
        if (!linkShareItem) {
            console.log('找不到提取码');
            return;
        }
        const radioItems = linkShareItem.querySelectorAll('label[role="radio"]');
        const radioItem = Array.from(radioItems).find(item => {
            return item.textContent?.includes(config.extractCodeType);
        }) as HTMLElement;
        if (!radioItem) {
            console.log(config.extractCodeType + '找不到提取码');
            return;
        }
        radioItem.click();
        radioItem.dispatchEvent(new Event('click', { bubbles: true }));
    }

    /**
     * 设置有效期
     * @param period 有效期
     */
    private async setValidPeriod(shareDialog: HTMLElement, period: string): Promise<void> {
        const linkShareSelectors = shareDialog.querySelectorAll('div[class="u-form-item"]');
        const validPeriodItem = Array.from(linkShareSelectors).find(item => {
            return item.textContent?.includes('有效期');
        });
        if (!validPeriodItem) {
            console.log('找不到有效期');
            return;
        }
        const radioItems = validPeriodItem.querySelectorAll('label[role="radio"]');
        const radioItem = Array.from(radioItems).find(item => {
            return item.textContent?.includes(period);
        }) as HTMLElement;
        if (!radioItem) {
            console.log(period + '找不到有效期');
            return;
        }
        radioItem.click();
        radioItem.dispatchEvent(new Event('click', { bubbles: true }));


    }

    /**
     * 设置提取码
     * @param codeType 提取码类型
     * @param customCode 自定义提取码
     */
    private async setExtractCode(codeType: string, customCode?: string): Promise<void> {


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
    private async createShareLink(shareDialog: HTMLElement): Promise<Omit<ShareResult, 'sharedFiles'>> {
        // 点击创建链接按钮
        const createButton = await this.findCreateLinkButton(shareDialog);
        if (!createButton) {
            throw new Error('找不到创建链接按钮');
        }

        createButton.click();

        await new Promise(resolve => setTimeout(resolve, 2000));

        // 提取分享信息
        const shareInfo = await this.extractShareInfo();
        if (!shareInfo) {
            throw new Error('无法提取分享信息');
        }

        return shareInfo;
    }

    /**
     * 查找创建链接按钮
     * @returns 创建链接按钮或null
     */
    private async findCreateLinkButton(shareDialog: HTMLElement): Promise<HTMLElement | null> {
        const createButtons = shareDialog.querySelectorAll('button[type="button"]');
        const createButton = Array.from(createButtons).find(item => {
            return item.textContent?.includes('复制链接');
        }) as HTMLElement;
        if (!createButton) {
            console.log('找不到创建链接按钮');
            return null;
        }
        return createButton;
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

        const shareText = document.querySelector('div[class="copy-link-text"]')?.textContent;
        if (!shareText) {
            console.log('找不到分享链接');
            return null;
        }

        // 提取分享链接
        let shareUrl: string;
        try {
            shareUrl = await this.extractShareUrl(shareText);
        } catch (error) {
            console.error('提取分享链接失败:', error);
            shareUrl = '提取失败';
        }

        // 提取提取码
        let extractCode: string | undefined;
        try {
            extractCode = await this.extractCode(shareText);
        } catch (error) {
            console.error('提取提取码失败:', error);
            extractCode = undefined;
        }

        return {
            shareUrl,
            extractCode,
            shareText, // 添加格式化的分享文本
            createdAt: new Date().toISOString()
        };
    }

    /**
     * 构建分享文本
     * @param shareUrl 分享链接
     * @param extractCode 提取码
     * @returns 格式化的分享文本
     */
    private buildShareText(shareUrl: string, extractCode?: string): string {
        let text = `通过网盘分享的文件：\n链接: ${shareUrl}`;

        if (extractCode) {
            text += `\n提取码: ${extractCode}`;
        }

        text += '\n复制这段内容后打开百度网盘手机App，操作更方便哦';

        return text;
    }

    /**
     * 提取分享链接
     * @returns 分享链接
     */
    private async extractShareUrl(shareText: string): Promise<string> {
        const urlMatch = shareText.match(/https:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9]+(?:\?pwd=[a-zA-Z0-9]+)?/);
        if (urlMatch) {
            return urlMatch[0];
        }
        throw new Error('无法提取分享链接');
    }

    /**
     * 提取提取码
     * @returns 提取码或undefined
     */
    private async extractCode(shareText: string): Promise<string | undefined> {
        const codeMatch = shareText.match(/提取码[：:]\s*([a-zA-Z0-9]{4})/);
        if (codeMatch) {
            return codeMatch[1];
        }
        throw new Error('无法提取提取码');
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