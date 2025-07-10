/**
 * @file 百度云平台操作器
 * @description 实现百度网盘的完整文件操作功能
 */

import { BasePlatformOperator } from '../../types';
import type {
    NavigationResult,
    ShareResult,
    DownloadResult,
    OrganizeResult,
    FileItem,
    ShareConfig,
    DownloadConfig,
    OrganizeConfig,
    OperationLog
} from '../../types';
import { BaiduYunNavigator } from './navigator';
import { BaiduYunShareHandler } from './share';

//===================================
// 百度云平台操作器
//===================================

export class BaiduYunOperator extends BasePlatformOperator {
    private navigator: BaiduYunNavigator;
    private shareHandler: BaiduYunShareHandler;
    private logs: OperationLog[] = [];

    constructor() {
        super();
        this.navigator = new BaiduYunNavigator();
        this.shareHandler = new BaiduYunShareHandler();
    }

    /**
     * 导航到指定路径
     * @param paths 路径数组
     * @returns 导航结果
     */
    async navigate(paths: string[]): Promise<NavigationResult> {
        this.addLog('info', `开始导航到路径: ${paths.join(' -> ')}`);

        try {
            const result = await this.navigator.navigateToPath(paths);

            // 合并导航器日志
            this.mergeLogs(this.navigator.getLogs());

            if (result.success) {
                this.addLog('info', `导航成功，耗时: ${result.navigationTime}ms，找到 ${result.currentFiles.length} 个文件`);
            } else {
                this.addLog('error', `导航失败，耗时: ${result.navigationTime}ms`);
            }

            return result;

        } catch (error) {
            this.addLog('error', `导航异常: ${error.message}`);
            throw error;
        }
    }

    /**
     * 创建分享链接
     * @param config 分享配置
     * @returns 分享结果
     */
    async share(config: ShareConfig): Promise<ShareResult> {
        this.addLog('info', `开始创建分享，有效期: ${config.validPeriod}，提取码: ${config.extractCodeType}`);

        try {
            // 获取当前文件列表
            const currentFiles = await this.getCurrentFileList();

            // 创建分享
            const result = await this.shareHandler.createShare(config, currentFiles);

            // 合并分享处理器日志
            this.mergeLogs(this.shareHandler.getLogs());

            this.addLog('info', `分享创建成功，链接: ${result.shareUrl}`);

            return result;

        } catch (error) {
            this.addLog('error', `分享创建失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 下载文件（暂未实现）
     * @param config 下载配置
     * @returns 下载结果
     */
    async download(config: DownloadConfig): Promise<DownloadResult> {
        this.addLog('warn', '下载功能暂未实现');

        // 基础实现，后续可扩展
        return {
            downloadedCount: 0,
            failedCount: 0,
            totalSize: 0,
            downloadedFiles: [],
            failedFiles: []
        };
    }

    /**
     * 整理文件（暂未实现）
     * @param config 整理配置
     * @returns 整理结果
     */
    async organize(config: OrganizeConfig): Promise<OrganizeResult> {
        this.addLog('warn', '文件整理功能暂未实现');

        // 基础实现，后续可扩展
        return {
            processedCount: 0,
            movedCount: 0,
            createdFolders: 0,
            details: []
        };
    }

    /**
     * 获取当前文件列表
     * @returns 文件项数组
     */
    async getCurrentFileList(): Promise<FileItem[]> {
        try {
            const files = await this.navigator.getCurrentFileList();
            this.addLog('info', `获取文件列表成功，共 ${files.length} 个项目`);
            return files;

        } catch (error) {
            this.addLog('error', `获取文件列表失败: ${error.message}`);
            return [];
        }
    }

    /**
     * 清理资源
     */
    async cleanup(): Promise<void> {
        this.addLog('info', '开始清理资源');

        try {
            this.navigator.cleanup();
            this.shareHandler.cleanup();
            this.addLog('info', '资源清理完成');

        } catch (error) {
            this.addLog('error', `资源清理失败: ${error.message}`);
        }
    }

    //===================================
    // 扩展功能方法
    //===================================

    /**
     * 完整的分享流程（导航 + 分享）
     * @param paths 目标路径
     * @param config 分享配置
     * @returns 分享结果
     */
    async navigateAndShare(paths: string[], config: ShareConfig): Promise<ShareResult> {
        this.addLog('info', `开始完整分享流程，路径: ${paths.join(' -> ')}`);

        try {
            // 第1步：导航到目标路径
            const navResult = await this.navigate(paths);
            if (!navResult.success) {
                throw new Error('导航失败，无法继续分享操作');
            }

            // 第2步：创建分享
            const shareResult = await this.share(config);

            this.addLog('info', '完整分享流程执行成功');
            return shareResult;

        } catch (error) {
            this.addLog('error', `完整分享流程失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 批量创建分享（多个路径）
     * @param pathGroups 路径组数组
     * @param config 分享配置
     * @returns 分享结果数组
     */
    async batchShare(pathGroups: string[][], config: ShareConfig): Promise<ShareResult[]> {
        this.addLog('info', `开始批量分享，共 ${pathGroups.length} 个路径组`);

        const results: ShareResult[] = [];
        const errors: string[] = [];

        for (let i = 0; i < pathGroups.length; i++) {
            const paths = pathGroups[i];
            this.addLog('info', `处理第 ${i + 1}/${pathGroups.length} 个路径组: ${paths.join(' -> ')}`);

            try {
                const result = await this.navigateAndShare(paths, config);
                results.push(result);

            } catch (error) {
                const errorMsg = `路径组 ${i + 1} 失败: ${error.message}`;
                errors.push(errorMsg);
                this.addLog('error', errorMsg);
            }
        }

        if (errors.length > 0) {
            this.addLog('warn', `批量分享完成，成功: ${results.length}，失败: ${errors.length}`);
        } else {
            this.addLog('info', `批量分享全部成功，共 ${results.length} 个分享`);
        }

        return results;
    }

    /**
     * 检查当前页面是否为百度网盘
     * @returns 是否为百度网盘页面
     */
    static isValidPage(): boolean {
        return window.location.hostname.includes('pan.baidu.com');
    }

    /**
     * 验证页面状态
     * @returns 验证结果
     */
    async validatePageState(): Promise<{ valid: boolean; message: string }> {
        if (!BaiduYunOperator.isValidPage()) {
            return {
                valid: false,
                message: '当前页面不是百度网盘'
            };
        }

        // 检查是否登录
        const loginStatus = await this.checkLoginStatus();
        if (!loginStatus.isLoggedIn) {
            return {
                valid: false,
                message: loginStatus.message
            };
        }

        // 检查页面是否加载完成
        const pageReady = await this.checkPageReady();
        if (!pageReady) {
            return {
                valid: false,
                message: '页面尚未完全加载'
            };
        }

        return {
            valid: true,
            message: '页面状态正常'
        };
    }

    /**
     * 检查登录状态
     * @returns 登录状态信息
     */
    private async checkLoginStatus(): Promise<{ isLoggedIn: boolean; message: string }> {
        // 检查登录相关元素
        const loginIndicators = [
            '.user-info',
            '.username',
            '.avatar',
            '[data-username]'
        ];

        for (const selector of loginIndicators) {
            const element = document.querySelector(selector);
            if (element) {
                return {
                    isLoggedIn: true,
                    message: '已登录'
                };
            }
        }

        // 检查是否有登录按钮（说明未登录）
        const loginButtons = document.querySelectorAll('.login-btn, .login-button, [href*="login"]');
        if (loginButtons.length > 0) {
            return {
                isLoggedIn: false,
                message: '请先登录百度网盘'
            };
        }

        return {
            isLoggedIn: true,
            message: '登录状态未知，但可能已登录'
        };
    }

    /**
     * 检查页面是否准备就绪
     * @returns 是否准备就绪
     */
    private async checkPageReady(): Promise<boolean> {
        // 检查关键元素是否存在
        const keyElements = [
            'td[class="wp-s-pan-table__td"]', // 文件表格
            '.file-list', // 文件列表
            '.grid-view', // 网格视图
        ];

        for (const selector of keyElements) {
            const element = document.querySelector(selector);
            if (element) {
                return true;
            }
        }

        return false;
    }

    /**
     * 获取操作日志
     * @returns 操作日志数组
     */
    getLogs(): OperationLog[] {
        return [...this.logs];
    }

    /**
     * 清空日志
     */
    clearLogs(): void {
        this.logs = [];
    }

    /**
     * 添加日志
     * @param level 日志级别
     * @param message 日志消息
     * @param details 详细信息
     */
    private addLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, details?: unknown): void {
        this.logs.push({
            timestamp: Date.now(),
            level,
            message,
            details
        });
    }

    /**
     * 合并其他模块的日志
     * @param logs 要合并的日志数组
     */
    private mergeLogs(logs: OperationLog[]): void {
        this.logs.push(...logs);
    }
} 