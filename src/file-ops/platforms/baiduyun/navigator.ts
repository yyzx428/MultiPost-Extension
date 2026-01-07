/**
 * @file 百度云路径导航模块
 * @description 负责在百度网盘中进行路径导航操作
 */

import type { NavigationResult, FileItem, GetFileListOptions } from '../../types';
import { Waiter } from '../../common/waiter';

//===================================
// 百度云导航器
//===================================

export class BaiduYunNavigator {
    private waiter: Waiter;

    constructor() {
        this.waiter = new Waiter();
    }

    /**
     * 导航到指定路径
     * @param paths 路径数组，如 ["我的手抄报", "041"]
     * @returns 导航结果
     */
    async navigateToPath(paths: string[]): Promise<NavigationResult> {
        const startTime = Date.now();

        try {
            // 等待页面初始加载
            await this.waitForPageReady();

            // 逐级导航每个路径段
            for (const pathSegment of paths) {
                await this.navigateToFolder(pathSegment);
            }

            // 获取最终的文件列表
            const currentFiles = await this.getCurrentFileList();

            return {
                success: true,
                finalPath: paths,
                currentFiles,
                navigationTime: Date.now() - startTime
            };

        } catch (error) {
            console.error('导航异常:', error);
            return {
                success: false,
                finalPath: [],
                currentFiles: [],
                navigationTime: Date.now() - startTime
            };
        }
    }

    /**
     * 等待页面准备就绪
     */
    private async waitForPageReady(): Promise<void> {
        // 等待文件表格出现（复用现有逻辑）
        await this.waiter.waitForElement('td[class="wp-s-pan-table__td"]', 15000);

        // 额外等待确保页面完全加载
        await this.waiter.sleep(2000);
    }

    /**
     * 导航到指定文件夹
     * @param folderName 文件夹名称
     */
    private async navigateToFolder(folderName: string): Promise<void> {
        // 等待文件表格准备就绪
        await this.waiter.waitForElement('td[class="wp-s-pan-table__td"]');

        // 查找目标文件夹（复用现有选择器逻辑）
        let folderElement = document.querySelector(`a[title="${folderName}"]`) as HTMLElement;


        if (!folderElement) {
            // ✅ 先滚动加载直到目标出现在DOM里
            await this.getCurrentFileList({
                needNames: [folderName],
                autoScroll: true,
                timeoutMs: 30_000,
                throwIfNotFound: false, // 先不抛，后面还有兜底选择器
            });

            folderElement = document.querySelector(`a[title="${folderName}"]`) as HTMLElement;
        }

        if (!folderElement) {
            // 尝试其他选择器策略
            folderElement = await this.findFolderByAlternativeSelectors(folderName);
        }

        if (!folderElement) {
            throw new Error(`文件夹不存在: ${folderName}`);
        }

        // 点击进入文件夹（复用现有点击逻辑）
        folderElement.click();
        folderElement.dispatchEvent(new Event('click', { bubbles: true }));

        // 等待页面跳转和加载
        await this.waitForFolderLoad(folderName);
    }

    /**
     * 使用其他选择器策略查找文件夹
     * @param folderName 文件夹名称
     * @returns 找到的文件夹元素或null
     */
    private async findFolderByAlternativeSelectors(folderName: string): Promise<HTMLElement | null> {
        // 策略1：通过文本内容查找
        const textElements = Array.from(document.querySelectorAll('span, a, div'));
        for (const element of textElements) {
            if (element.textContent?.trim() === folderName) {
                const clickableParent = element.closest('a, button, [role="button"]') as HTMLElement;
                if (clickableParent) {
                    return clickableParent;
                }
            }
        }

        // 策略2：通过data属性查找
        const dataElements = document.querySelectorAll(`[data-name="${folderName}"]`);
        if (dataElements.length > 0) {
            return dataElements[0] as HTMLElement;
        }

        // 策略3：通过文件图标和文本组合查找
        const folderIcons = document.querySelectorAll('.folder-icon, .icon-folder, [class*="folder"]');
        for (const icon of folderIcons) {
            const parent = icon.closest('tr, .file-item, .list-item');
            if (parent && parent.textContent?.includes(folderName)) {
                const clickable = parent.querySelector('a, [role="button"]') as HTMLElement;
                if (clickable) {
                    return clickable;
                }
            }
        }

        return null;
    }

    /**
     * 等待文件夹加载完成
     * @param folderName 文件夹名称
     */
    private async waitForFolderLoad(folderName: string): Promise<void> {
        // 等待URL变化（如果有）
        const urlChanged = await this.waiter.waitForUrlChange(
            encodeURIComponent(folderName),
            5000
        );

        if (!urlChanged) {
            // 如果URL没有变化，等待内容变化
            await this.waiter.waitForStateChange(
                () => {
                    const breadcrumb = document.querySelector('.breadcrumb, .path, .nav-path');
                    return breadcrumb?.textContent?.includes(folderName) || false;
                },
                5000
            );
        }

        // 等待新的文件列表加载
        await this.waiter.waitForElement('td[class="wp-s-pan-table__td"]');

        // 额外等待确保内容稳定
        await this.waiter.sleep(2000);
    }

    private getScrollContainer(): HTMLElement {
        const candidates = [
            ".wp-s-pan-table__body",
            ".wp-s-pan-table__scroll",
            ".wp-s-pan-table",
            ".file-list",
            ".grid-view",
        ];

        for (const sel of candidates) {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (el && el.scrollHeight > el.clientHeight + 5) return el;
        }
        return (document.scrollingElement as HTMLElement) || document.documentElement;
    }

    private isAtBottom(container: HTMLElement): boolean {
        return container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
    }

    private listFingerprint(rows: Element[]): string {
        // 用“行数 + 最后一行文件名”做指纹，判断滚动后列表是否真的变化
        const last = rows[rows.length - 1];
        const lastNameEl = last?.querySelector('a[title]') as HTMLElement | null;
        const lastName = (lastNameEl?.getAttribute("title") || lastNameEl?.textContent || "").trim();
        return `${rows.length}|${lastName}`.slice(0, 120);
    }

    private fileKeyOf(item: FileItem): string {
        return `${item.type}|${item.name}`;
    }


    /**
     * 获取当前文件列表
     * @returns 文件项数组
     */
    async getCurrentFileList(options?: GetFileListOptions): Promise<FileItem[]> {
        const filesMap = new Map<string, FileItem>();

        const needSet = new Set((options?.needNames ?? []).map(s => s.trim()).filter(Boolean));
        const autoScroll = options?.autoScroll ?? (needSet.size > 0);
        const loadAll = options?.loadAll ?? false;

        const timeoutMs = options?.timeoutMs ?? 20_000;
        const step = options?.step ?? 700;
        const settleMs = options?.settleMs ?? 250;
        const throwIfNotFound = options?.throwIfNotFound ?? (needSet.size > 0);

        try {
            await this.waiter.waitForElement('td[class="wp-s-pan-table__td"]');

            // 不需要滚动：直接返回当前可见
            if (!autoScroll && !loadAll) {
                const rows = this.findFileRows();
                for (const row of rows) {
                    const item = this.parseFileRow(row);
                    if (item) filesMap.set(this.fileKeyOf(item), item);
                }
                return Array.from(filesMap.values());
            }

            const container = this.getScrollContainer();
            const endAt = Date.now() + timeoutMs;

            let lastFp = "";
            let lastTop = -1;

            while (Date.now() < endAt) {
                const rows = this.findFileRows();
                // 采集当前可见
                for (const row of rows) {
                    const item = this.parseFileRow(row);
                    if (!item) continue;

                    filesMap.set(this.fileKeyOf(item), item);
                    if (needSet.has(item.name)) needSet.delete(item.name);
                }

                // 目标已找齐
                if (!loadAll && needSet.size === 0) break;

                // 到底了就停止
                if (this.isAtBottom(container)) break;

                const fpBefore = this.listFingerprint(rows);
                const topBefore = container.scrollTop;

                // 触发懒加载
                container.scrollTop = Math.min(topBefore + step, container.scrollHeight);
                container.dispatchEvent(new Event("scroll", { bubbles: true }));

                await this.waiter.sleep(settleMs);

                const rowsAfter = this.findFileRows();
                const fpAfter = this.listFingerprint(rowsAfter);
                const topAfter = container.scrollTop;

                // 如果滚动后既没变化也不再动，认为卡住/到底了
                if (fpAfter === fpBefore && topAfter === topBefore) break;

                // 防卡死：两次指纹都不变 & top 也不变，直接 break
                if (fpAfter === lastFp && topAfter === lastTop) break;

                lastFp = fpAfter;
                lastTop = topAfter;
            }

            if (needSet.size > 0 && throwIfNotFound) {
                throw new Error(`未找到目标：${Array.from(needSet).join(", ")}（已滚动到末尾或超时）`);
            }

        } catch (error) {
            console.error("获取文件列表失败:", error);
            if (options?.throwIfNotFound) throw error;
        }

        return Array.from(filesMap.values());
    }

    /**
     * 查找文件行元素
     * @returns 文件行元素数组
     */
    private findFileRows(): Element[] {
        // 策略1：通过表格行查找
        const tableRows = Array.from(document.querySelectorAll('tr')).filter(row => {
            return row.querySelector('td[class="wp-s-pan-table__td"]');
        });

        if (tableRows.length > 0) {
            return tableRows;
        }

        // 策略2：通过文件项类查找
        const fileItems = Array.from(document.querySelectorAll('.file-item, .list-item, [data-file]'));

        return fileItems;
    }

    /**
     * 解析文件行数据
     * @param row 文件行元素
     * @returns 文件项或null
     */
    private parseFileRow(row: Element): FileItem | null {
        try {
            // 解析文件名
            const nameElement = row.querySelector('a[title], .file-name, .name') as HTMLElement;
            const name = nameElement?.getAttribute('title') ||
                nameElement?.textContent?.trim() ||
                '';

            if (!name) {
                return null;
            }

            // 判断文件类型
            const iconElement = row.querySelector('.icon, [class*="icon"]');
            const iconClass = iconElement?.className || '';
            const type = iconClass.includes('folder') ? 'folder' : 'file';

            // 解析文件大小
            const sizeElement = row.querySelector('.size, .file-size');
            const sizeText = sizeElement?.textContent?.trim() || '';
            const size = this.parseSizeText(sizeText);

            // 解析修改时间
            const timeElement = row.querySelector('.time, .modified, .date');
            const modifiedTime = timeElement?.textContent?.trim() || '';

            // 构建路径（当前路径 + 文件名）
            const currentPath = this.getCurrentPath();
            const path = currentPath ? `${currentPath}/${name}` : name;

            // 获取文件扩展名
            const extension = type === 'file' ? this.getFileExtension(name) : undefined;

            return {
                name,
                type,
                size,
                path,
                modifiedTime,
                extension
            };

        } catch (error) {
            console.error('解析文件行失败:', error);
            return null;
        }
    }

    /**
     * 解析文件大小文本
     * @param sizeText 大小文本，如 "1.2MB"
     * @returns 字节数或undefined
     */
    private parseSizeText(sizeText: string): number | undefined {
        if (!sizeText || sizeText === '-') {
            return undefined;
        }

        const match = sizeText.match(/^([\d.]+)\s*([KMGT]?B)$/i);
        if (!match) {
            return undefined;
        }

        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();

        const multipliers: Record<string, number> = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024,
            'TB': 1024 * 1024 * 1024 * 1024
        };

        return Math.round(value * (multipliers[unit] || 1));
    }

    /**
     * 获取文件扩展名
     * @param filename 文件名
     * @returns 扩展名或undefined
     */
    private getFileExtension(filename: string): string | undefined {
        const lastDot = filename.lastIndexOf('.');
        if (lastDot === -1 || lastDot === filename.length - 1) {
            return undefined;
        }
        return filename.substring(lastDot + 1).toLowerCase();
    }

    /**
     * 获取当前路径
     * @returns 当前路径字符串
     */
    private getCurrentPath(): string {
        // 尝试从面包屑获取路径
        const breadcrumb = document.querySelector('.breadcrumb, .path, .nav-path');
        if (breadcrumb) {
            return breadcrumb.textContent?.trim() || '';
        }

        // 尝试从URL获取路径
        const urlPath = new URLSearchParams(window.location.search).get('path');
        if (urlPath) {
            return decodeURIComponent(urlPath);
        }

        return '';
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