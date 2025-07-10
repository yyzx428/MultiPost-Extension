/**
 * @file 百度云路径导航模块
 * @description 负责在百度网盘中进行路径导航操作
 */

import type { NavigationResult, FileItem } from '../../types';
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

    /**
     * 获取当前文件列表
     * @returns 文件项数组
     */
    async getCurrentFileList(): Promise<FileItem[]> {
        const files: FileItem[] = [];

        try {
            // 等待文件列表加载
            await this.waiter.waitForElement('td[class="wp-s-pan-table__td"]');

            // 查找文件行
            const fileRows = this.findFileRows();

            for (const row of fileRows) {
                const fileItem = this.parseFileRow(row);
                if (fileItem) {
                    files.push(fileItem);
                }
            }

        } catch (error) {
            console.error('获取文件列表失败:', error);
        }

        return files;
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