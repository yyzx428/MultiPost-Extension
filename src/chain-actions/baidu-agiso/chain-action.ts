/**
 * @file 链式操作模块
 * @description 实现百度云分享链接获取 + Agiso商品发布的完整流程
 */

import type { ShareConfig, ShareResult, FileOperation } from "../../file-ops/types";

//===================================
// 链式操作配置接口
//===================================

export interface ChainActionConfig {
    // 百度云分享配置
    baiduShare: {
        paths: string[];           // 目标路径，如 ["我的手抄报", "054"]
        shareConfig: ShareConfig;  // 分享配置
    };
    // Agiso商品配置
    agisoProduct: {
        title: string;             // 商品标题
        useInfo: string;           // 使用说明
    };
}

//===================================
// 链式操作结果接口
//===================================

export interface ChainActionResult {
    success: boolean;
    baiduShareResult?: ShareResult;
    agisoPublishResult?: {
        success: boolean;
        message: string;
    };
    error?: string;
    logs: string[];
}

//===================================
// 链式操作执行器
//===================================

export class ChainActionExecutor {
    private logs: string[] = [];

    constructor() {
        // 使用注入脚本的方式执行
    }

    /**
     * 执行完整的链式操作
     * @param config 链式操作配置
     * @returns 执行结果
     */
    async executeChainAction(config: ChainActionConfig): Promise<ChainActionResult> {
        this.addLog('开始执行链式操作');

        try {
            // 第1步：获取百度云分享链接
            this.addLog('第1步：获取百度云分享链接');
            const baiduResult = await this.getBaiduShareLink(config.baiduShare);
            this.addLog(`百度云分享成功，链接: ${baiduResult.shareUrl}`);

            // 第2步：使用分享链接在Agiso平台发布商品
            this.addLog('第2步：在Agiso平台发布商品');
            const agisoResult = await this.publishToAgiso(config.agisoProduct, baiduResult);

            this.addLog('链式操作执行完成');

            return {
                success: true,
                baiduShareResult: baiduResult,
                agisoPublishResult: agisoResult,
                logs: this.logs
            };

        } catch (error) {
            this.addLog(`链式操作失败: ${typeof error === 'object' && error && 'message' in error && typeof (error as { message: unknown }).message === 'string' ? (error as { message: string }).message : String(error)}`);
            return {
                success: false,
                error: typeof error === 'object' && error && 'message' in error && typeof (error as { message: unknown }).message === 'string' ? (error as { message: string }).message : String(error),
                logs: this.logs
            };
        } finally {
            // 清理资源
            await this.cleanup();
        }
    }

    /**
     * 获取百度云分享链接
     * @param baiduConfig 百度云配置
     * @returns 分享结果
     */
    private async getBaiduShareLink(baiduConfig: {
        paths: string[];
        shareConfig: ShareConfig;
    }): Promise<ShareResult> {
        this.addLog(`准备导航到路径: ${baiduConfig.paths.join(' -> ')}`);

        // 创建百度网盘标签页
        const baiduTab = await this.createBaiduYunTab();
        this.addLog('百度网盘标签页已创建');

        try {
            // 等待页面加载完成
            await this.waitForTabLoad(baiduTab.id!);
            this.addLog('百度网盘页面加载完成');

            // 在标签页中注入并执行 file-ops 接口
            this.addLog('开始执行百度云分享操作...');
            const result = await this.executeFileOpsInTab(baiduTab.id!, {
                platform: 'baiduyun',
                operation: 'share',
                params: {
                    paths: baiduConfig.paths,
                    shareConfig: baiduConfig.shareConfig
                }
            });
            this.addLog('百度云分享操作执行完成');

            if (result.success && result.data) {
                const shareResult = result.data as ShareResult;
                this.addLog(`分享创建成功，链接: ${shareResult.shareUrl}`);
                return shareResult;
            } else {
                throw new Error(result.error || '分享操作失败');
            }
        } catch (error) {
            throw new Error(`百度云分享失败: ${typeof error === 'object' && error && 'message' in error && typeof (error as { message: unknown }).message === 'string' ? (error as { message: string }).message : String(error)}`);
        }
    }

    /**
     * 在Agiso平台发布商品
     * @param agisoConfig Agiso配置
     * @param baiduResult 百度云分享结果
     * @returns 发布结果
     */
    private async publishToAgiso(
        agisoConfig: { title: string; useInfo: string },
        baiduResult: ShareResult
    ): Promise<{ success: boolean; message: string }> {
        this.addLog('准备在Agiso平台发布商品');

        // 构建包含分享链接的使用说明
        const enhancedUseInfo = this.buildEnhancedUseInfo(agisoConfig.useInfo, baiduResult);
        this.addLog('使用说明已增强，包含分享链接');

        try {
            // 使用动态发布能力，直接发送发布消息到background script
            this.addLog('发送Agiso商品发布请求...');

            const result = await this.sendAgisoPublishRequest({
                title: agisoConfig.title,
                useInfo: enhancedUseInfo
            });

            this.addLog('Agiso商品发布成功');
            return result;
        } catch (error) {
            throw new Error(`Agiso发布失败: ${typeof error === 'object' && error && 'message' in error && typeof (error as { message: unknown }).message === 'string' ? (error as { message: string }).message : String(error)}`);
        }
    }

    /**
     * 发送Agiso发布请求
     * @param productData 商品数据
     * @returns 发布结果
     */
    private async sendAgisoPublishRequest(productData: {
        title: string;
        useInfo: string;
    }): Promise<{ success: boolean; message: string }> {
        return new Promise((resolve, reject) => {
            // 构建商品数据
            const shangpinData = {
                title: productData.title,
                useInfo: productData.useInfo
            };

            // 构建同步数据
            const syncData = {
                platforms: [{ name: 'SHANGPIN_AGISO' }],
                data: shangpinData,
                isAutoPublish: true
            };

            // 发送发布消息
            chrome.runtime.sendMessage({
                action: 'MUTLIPOST_EXTENSION_PUBLISH',
                data: syncData,
                traceId: `chain-action-agiso-${Date.now()}`
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(`发送消息失败: ${chrome.runtime.lastError.message}`));
                    return;
                }

                if (response && response.success) {
                    resolve({
                        success: true,
                        message: response.message || '商品发布成功'
                    });
                } else {
                    reject(new Error(response?.error || '商品发布失败'));
                }
            });

            // 设置超时
            setTimeout(() => {
                reject(new Error('Agiso发布请求超时'));
            }, 60000); // 60秒超时
        });
    }

    /**
     * 构建增强的使用说明（包含分享链接）
     * @param originalUseInfo 原始使用说明
     * @param baiduResult 百度云分享结果
     * @returns 增强的使用说明
     */
    private buildEnhancedUseInfo(originalUseInfo: string, baiduResult: ShareResult): string {
        const shareInfo = [
            '',
            '=== 下载链接 ===',
            `链接: ${baiduResult.shareUrl}`,
            baiduResult.extractCode ? `提取码: ${baiduResult.extractCode}` : '',
            `有效期: ${baiduResult.validUntil || '永久有效'}`,
            ''
        ].filter(line => line !== '').join('\n');

        return `${originalUseInfo}\n${shareInfo}`;
    }

    /**
     * 创建百度网盘标签页
     * @returns 创建的标签页
     */
    private async createBaiduYunTab(): Promise<chrome.tabs.Tab> {
        const tab = await chrome.tabs.create({
            url: 'https://pan.baidu.com/disk/home',
            active: false
        });

        // 添加到标签页管理器
        await this.addTabToManager(tab, '百度网盘');

        return tab;
    }



    /**
     * 等待标签页加载完成
     * @param tabId 标签页ID
     */
    private async waitForTabLoad(tabId: number): Promise<void> {
        return new Promise((resolve) => {
            const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    }

    /**
 * 在标签页中执行file-ops操作
 * @param tabId 标签页ID
 * @param fileOperation 文件操作
 * @returns 操作结果
 */
    private async executeFileOpsInTab(tabId: number, fileOperation: FileOperation) {
        return new Promise<{ success: boolean; data?: unknown; error?: string; timestamp: number; logs?: string[] }>((resolve, reject) => {
            chrome.scripting.executeScript({
                target: { tabId },
                func: function (operation: FileOperation) {
                    /**
                     * 在页面上下文中调用helper.ts提供的接口
                     * @description 直接使用helper.ts中已加载的百度云操作功能
                     */
                    console.log('[ChainAction] 开始执行file-ops操作:', operation);

                    // 使用简单的方式扩展 window 对象
                    window['multipostSendFileOpsResult'] = function (success: boolean, data?: unknown, error?: string) {
                        const result = {
                            success,
                            data,
                            error,
                            timestamp: Date.now()
                        };
                        try {
                            (chrome as unknown as { runtime: { sendMessage: (message: { action: string; data: unknown }) => void } }).runtime.sendMessage({
                                action: 'MUTLIPOST_EXTENSION_FILE_OPS_RESULT',
                                data: result
                            });
                            console.log('[ChainAction] file-ops结果已发送:', result);
                        } catch (err) {
                            console.error('[ChainAction] 发送file-ops结果失败:', err);
                        }
                    };
                    function executeBaiduYunShare(params: { paths: string[]; shareConfig: { validPeriod: string; extractCodeType: string; customCode?: string } }) {
                        console.log('[ChainAction] 执行百度云分享操作:', params);

                        // 立即执行，不使用setTimeout
                        (async () => {
                            try {
                                console.log('[ChainAction] 开始调用helper接口...');
                                const result = await callHelperInterface(params);
                                console.log('[ChainAction] helper接口调用成功:', result);
                                window['multipostSendFileOpsResult'](true, result);
                            } catch (error: unknown) {
                                console.error('[ChainAction] 百度云分享失败:', error);
                                let msg = '未知错误';
                                if (typeof error === 'object' && error && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
                                    msg = (error as { message: string }).message;
                                } else if (typeof error === 'string') {
                                    msg = error;
                                }
                                window['multipostSendFileOpsResult'](false, null, msg);
                            }
                        })();
                    }
                    function callHelperInterface(params: { paths: string[]; shareConfig: { validPeriod: string; extractCodeType: string; customCode?: string } }): Promise<unknown> {
                        return new Promise((resolve, reject) => {
                            const requestId = `chain-action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            const responseHandler = (event: MessageEvent) => {
                                if (event.data.type === 'response' &&
                                    event.data.traceId === requestId &&
                                    event.data.action === 'MUTLIPOST_EXTENSION_FILE_OPERATION') {
                                    window.removeEventListener('message', responseHandler);
                                    if (event.data.code === 0) {
                                        resolve(event.data.data);
                                    } else {
                                        reject(event.data.message || '操作失败');
                                    }
                                }
                            };
                            window.addEventListener('message', responseHandler);
                            window.postMessage({
                                type: 'request',
                                action: 'MUTLIPOST_EXTENSION_FILE_OPERATION',
                                traceId: requestId,
                                data: {
                                    platform: 'baiduyun',
                                    operation: 'share',
                                    params: {
                                        paths: params.paths,
                                        shareConfig: params.shareConfig
                                    }
                                }
                            }, '*');
                            setTimeout(() => {
                                window.removeEventListener('message', responseHandler);
                                reject('helper.ts接口调用超时');
                            }, 30000);
                        });
                    }
                    if (operation.platform === 'baiduyun' && operation.operation === 'share') {
                        executeBaiduYunShare(operation.params as { paths: string[]; shareConfig: { validPeriod: string; extractCodeType: string; customCode?: string } });
                    }
                },
                args: [fileOperation]
            }).then(() => {
                const messageListener = (message: unknown, sender: { tab?: { id?: number } }) => {
                    if ((message as { action?: string }).action === 'MUTLIPOST_EXTENSION_FILE_OPS_RESULT' && sender.tab?.id === tabId) {
                        chrome.runtime.onMessage.removeListener(messageListener);
                        resolve((message as { data: unknown }).data as { success: boolean; data?: unknown; error?: string; timestamp: number; logs?: string[] });
                    }
                };
                chrome.runtime.onMessage.addListener(messageListener);
                setTimeout(() => {
                    chrome.runtime.onMessage.removeListener(messageListener);
                    reject(new Error('file-ops操作超时 (60秒)'));
                }, 120000); // 增加到120秒超时
            }).catch(reject);
        });
    }



    /**
     * 添加标签页到管理器
     * @param tab 标签页
     * @param platformName 平台名称
     */
    private async addTabToManager(tab: chrome.tabs.Tab, platformName: string): Promise<void> {
        try {
            await chrome.runtime.sendMessage({
                type: 'MUTLIPOST_EXTENSION_TABS_MANAGER_REQUEST_ADD_TABS',
                data: {
                    platforms: [{
                        name: platformName,
                        injectUrl: tab.url || '',
                        extraConfig: {}
                    }]
                },
                tabs: [{
                    tab,
                    platformInfo: {
                        name: platformName,
                        injectUrl: tab.url || '',
                        extraConfig: {}
                    }
                }]
            });
        } catch (error) {
            console.warn('添加标签页到管理器失败:', error);
        }
    }

    /**
     * 清理资源
     */
    private async cleanup(): Promise<void> {
        // 可以在这里添加清理逻辑
        this.addLog('链式操作清理完成');
    }

    /**
     * 添加日志
     * @param message 日志消息
     */
    private addLog(message: string): void {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}`;
        this.logs.push(logEntry);
        console.log(logEntry);
    }

    /**
     * 获取日志
     * @returns 日志数组
     */
    getLogs(): string[] {
        return [...this.logs];
    }
}

//===================================
// 导出函数
//===================================

/**
 * 执行链式操作
 * @param config 链式操作配置
 * @returns 执行结果
 */
export async function executeChainAction(config: ChainActionConfig): Promise<ChainActionResult> {
    const executor = new ChainActionExecutor();
    return await executor.executeChainAction(config);
}

/**
 * 创建默认分享配置
 * @returns 默认配置
 */
export function createDefaultShareConfig(): ShareConfig {
    return {
        validPeriod: '7天',
        extractCodeType: '随机生成'
    };
}

/**
 * 创建链式操作配置
 * @param paths 百度云路径
 * @param title 商品标题
 * @param useInfo 使用说明
 * @returns 链式操作配置
 */
export function createChainActionConfig(
    paths: string[],
    title: string,
    useInfo: string
): ChainActionConfig {
    return {
        baiduShare: {
            paths,
            shareConfig: createDefaultShareConfig()
        },
        agisoProduct: {
            title,
            useInfo
        }
    };
} 