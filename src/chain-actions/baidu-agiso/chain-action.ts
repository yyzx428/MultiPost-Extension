/**
 * @file 链式操作模块
 * @description 实现百度云分享链接获取 + Agiso商品发布的完整流程
 */


import { BaiduYunOperator } from "../../file-ops/platforms/baiduyun/operator";
import type { ShareConfig, ShareResult } from "../../file-ops/types";

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
    private baiduOperator: BaiduYunOperator;

    constructor() {
        this.baiduOperator = new BaiduYunOperator();
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

            // 第2步：在Agiso平台发布商品
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
            this.addLog(`链式操作失败: ${error.message}`);
            return {
                success: false,
                error: error.message,
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
        this.addLog(`导航到路径: ${baiduConfig.paths.join(' -> ')}`);

        // 验证当前页面是否为百度网盘
        if (!BaiduYunOperator.isValidPage()) {
            throw new Error('当前页面不是百度网盘，请先打开百度网盘页面');
        }

        try {
            // 执行导航和分享
            const result = await this.baiduOperator.navigateAndShare(
                baiduConfig.paths,
                baiduConfig.shareConfig
            );

            this.addLog(`分享创建成功，链接: ${result.shareUrl}`);
            return result;
        } catch (error) {
            throw new Error(`百度云分享失败: ${error.message}`);
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

        // 通过消息传递触发内部发布流程
        return await this.triggerInternalPublish({
            title: agisoConfig.title,
            useInfo: enhancedUseInfo
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
     * 触发内部发布流程
     * @param productData 商品数据
     * @returns 发布结果
     */
    private async triggerInternalPublish(productData: {
        title: string;
        useInfo: string;
    }): Promise<{ success: boolean; message: string }> {
        this.addLog('触发内部发布流程');

        return new Promise((resolve) => {
            // 发送消息给background script，触发内部发布流程
            chrome.runtime.sendMessage({
                action: 'MUTLIPOST_EXTENSION_PUBLISH',
                data: {
                    platforms: [{
                        name: 'SHANGPIN_AGISO',
                        injectUrl: 'https://agiso.com/product/create', // 根据实际Agiso平台URL调整
                        extraConfig: {}
                    }],
                    data: {
                        title: productData.title,
                        useInfo: productData.useInfo
                    },
                    isAutoPublish: false
                },
                traceId: `chain-action-${Date.now()}`
            }, () => {
                if (chrome.runtime.lastError) {
                    this.addLog(`内部发布失败: ${chrome.runtime.lastError.message}`);
                    resolve({
                        success: false,
                        message: `内部发布失败: ${chrome.runtime.lastError.message}`
                    });
                } else {
                    this.addLog('内部发布流程已触发');
                    resolve({
                        success: true,
                        message: '内部发布流程已触发，请在新窗口中完成商品发布'
                    });
                }
            });
        });
    }

    /**
     * 清理资源
     */
    private async cleanup(): Promise<void> {
        this.addLog('清理资源');
        try {
            await this.baiduOperator.cleanup();
        } catch (error) {
            this.addLog(`清理资源失败: ${error.message}`);
        }
    }

    /**
     * 添加日志
     * @param message 日志消息
     */
    private addLog(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        this.logs.push(logEntry);
        console.log(logEntry);
    }

    /**
     * 获取执行日志
     * @returns 日志数组
     */
    getLogs(): string[] {
        return [...this.logs];
    }
}

//===================================
// 便捷函数
//===================================

/**
 * 执行链式操作的便捷函数
 * @param config 链式操作配置
 * @returns 执行结果
 */
export async function executeChainAction(config: ChainActionConfig): Promise<ChainActionResult> {
    const executor = new ChainActionExecutor();
    return await executor.executeChainAction(config);
}

/**
 * 创建默认的分享配置
 * @returns 默认分享配置
 */
export function createDefaultShareConfig(): ShareConfig {
    return {
        validPeriod: '永久有效',
        extractCodeType: '随机生成',
        hideUserInfo: false,
        selection: {
            selectAll: true
        }
    };
}

/**
 * 创建链式操作配置的便捷函数
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