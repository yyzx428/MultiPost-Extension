/**
 * @file 文件操作管理器
 * @description 统一管理所有平台的文件操作功能
 */

import type {
    FileOperation,
    FileOperationResult,
    FileOperationPlatform,
    BasePlatformOperator
} from './types';
import { BaiduYunOperator } from './platforms/baiduyun/operator';

//===================================
// 文件操作管理器
//===================================

export class FileOperationManager {
    private operators: Map<FileOperationPlatform, BasePlatformOperator> = new Map();

    constructor() {
        this.initializeOperators();
    }

    /**
     * 初始化所有平台操作器
     */
    private initializeOperators(): void {
        // 注册百度云操作器
        this.operators.set('baiduyun', new BaiduYunOperator());

        // 未来可以添加其他平台
        // this.operators.set('aliyun', new AliyunOperator());
        // this.operators.set('onedrive', new OneDriveOperator());
    }

    /**
     * 执行文件操作
     * @param operation 文件操作请求
     * @returns 操作结果
     */
    async executeOperation(operation: FileOperation): Promise<FileOperationResult> {
        const startTime = Date.now();

        try {
            // 获取平台操作器
            const operator = this.getOperator(operation.platform);

            // 验证页面状态（如果操作器支持）
            await this.validatePlatformState(operator, operation.platform);

            // 执行具体操作
            let data: unknown;

            switch (operation.operation) {
                case 'share':
                    if (!operation.params.shareConfig) {
                        throw new Error('分享操作需要提供分享配置');
                    }

                    if (operation.params.paths.length > 0) {
                        // 导航 + 分享
                        data = await (operator as BaiduYunOperator).navigateAndShare(
                            operation.params.paths,
                            operation.params.shareConfig
                        );
                    } else {
                        // 仅分享当前位置
                        data = await operator.share(operation.params.shareConfig);
                    }
                    break;

                case 'download':
                    if (!operation.params.downloadConfig) {
                        throw new Error('下载操作需要提供下载配置');
                    }

                    if (operation.params.paths.length > 0) {
                        await operator.navigate(operation.params.paths);
                    }
                    data = await operator.download(operation.params.downloadConfig);
                    break;

                case 'organize':
                    if (!operation.params.organizeConfig) {
                        throw new Error('整理操作需要提供整理配置');
                    }

                    if (operation.params.paths.length > 0) {
                        await operator.navigate(operation.params.paths);
                    }
                    data = await operator.organize(operation.params.organizeConfig);
                    break;

                case 'search':
                    // 搜索功能暂未实现
                    throw new Error('搜索功能暂未实现');

                default:
                    throw new Error(`不支持的操作类型: ${operation.operation}`);
            }

            // 获取操作日志
            const logs = (operator as any).getLogs ? (operator as any).getLogs() : [];

            return {
                success: true,
                operation: operation.operation,
                platform: operation.platform,
                executionTime: Date.now() - startTime,
                data,
                logs
            };

        } catch (error) {
            return {
                success: false,
                operation: operation.operation,
                platform: operation.platform,
                executionTime: Date.now() - startTime,
                data: null,
                logs: [{
                    timestamp: Date.now(),
                    level: 'error',
                    message: error.message
                }]
            };
        }
    }

    /**
     * 批量执行文件操作
     * @param operations 操作数组
     * @returns 结果数组
     */
    async executeBatchOperations(operations: FileOperation[]): Promise<FileOperationResult[]> {
        const results: FileOperationResult[] = [];

        for (const operation of operations) {
            const result = await this.executeOperation(operation);
            results.push(result);

            // 如果操作失败且是关键操作，可以选择终止后续操作
            if (!result.success && this.isCriticalOperation(operation)) {
                console.warn(`关键操作失败，终止后续操作: ${operation.operation}`);
                break;
            }
        }

        return results;
    }

    /**
     * 获取平台操作器
     * @param platform 平台名称
     * @returns 操作器实例
     */
    private getOperator(platform: FileOperationPlatform): BasePlatformOperator {
        const operator = this.operators.get(platform);

        if (!operator) {
            throw new Error(`不支持的平台: ${platform}`);
        }

        return operator;
    }

    /**
     * 验证平台状态
     * @param operator 操作器
     * @param platform 平台名称
     */
    private async validatePlatformState(
        operator: BasePlatformOperator,
        platform: FileOperationPlatform
    ): Promise<void> {
        // 检查是否为正确的页面
        switch (platform) {
            case 'baiduyun':
                const baiduOperator = operator as BaiduYunOperator;
                const validation = await baiduOperator.validatePageState();
                if (!validation.valid) {
                    throw new Error(validation.message);
                }
                break;

            // 未来可以添加其他平台的验证
            default:
                // 其他平台暂不验证
                break;
        }
    }

    /**
     * 判断是否为关键操作
     * @param operation 操作
     * @returns 是否关键
     */
    private isCriticalOperation(operation: FileOperation): boolean {
        // 可以根据业务需求定义关键操作
        // 例如：分享操作可能比下载操作更关键
        return operation.operation === 'share';
    }

    /**
     * 获取支持的平台列表
     * @returns 平台列表
     */
    getSupportedPlatforms(): FileOperationPlatform[] {
        return Array.from(this.operators.keys());
    }

    /**
     * 检查平台是否支持
     * @param platform 平台名称
     * @returns 是否支持
     */
    isPlatformSupported(platform: FileOperationPlatform): boolean {
        return this.operators.has(platform);
    }

    /**
     * 获取平台状态信息
     * @param platform 平台名称
     * @returns 状态信息
     */
    async getPlatformStatus(platform: FileOperationPlatform): Promise<{
        supported: boolean;
        available: boolean;
        message: string;
    }> {
        if (!this.isPlatformSupported(platform)) {
            return {
                supported: false,
                available: false,
                message: `不支持的平台: ${platform}`
            };
        }

        try {
            const operator = this.getOperator(platform);

            // 尝试验证平台状态
            await this.validatePlatformState(operator, platform);

            return {
                supported: true,
                available: true,
                message: '平台可用'
            };

        } catch (error) {
            return {
                supported: true,
                available: false,
                message: error.message
            };
        }
    }

    /**
     * 清理所有操作器资源
     */
    async cleanup(): Promise<void> {
        const cleanupPromises = Array.from(this.operators.values()).map(
            operator => operator.cleanup()
        );

        await Promise.allSettled(cleanupPromises);
    }
}

//===================================
// 导出类型和实例
//===================================

// 导出所有类型
export * from './types';

// 创建全局实例
const fileOperationManager = new FileOperationManager();

// 导出管理器实例
export { fileOperationManager };

// 导出平台操作器
export { BaiduYunOperator } from './platforms/baiduyun/operator';

//===================================
// 便捷函数
//===================================

/**
 * 快速执行文件操作
 * @param operation 操作请求
 * @returns 操作结果
 */
export const executeFileOperation = (operation: FileOperation): Promise<FileOperationResult> => {
    return fileOperationManager.executeOperation(operation);
};

/**
 * 快速创建百度云分享
 * @param paths 路径数组
 * @param config 分享配置，可选
 * @returns 分享结果
 */
export const createBaiduYunShare = async (
    paths: string[],
    config = {
        validPeriod: '7天' as const,
        extractCodeType: '随机生成' as const
    }
): Promise<FileOperationResult> => {
    return executeFileOperation({
        platform: 'baiduyun',
        operation: 'share',
        params: {
            paths,
            shareConfig: config
        }
    });
};

/**
 * 检查当前页面是否支持文件操作
 * @returns 支持的平台名称或null
 */
export const detectCurrentPlatform = (): FileOperationPlatform | null => {
    const hostname = window.location.hostname;

    if (hostname.includes('pan.baidu.com')) {
        return 'baiduyun';
    }

    // 未来可以添加其他平台检测
    // if (hostname.includes('aliyundrive.com')) {
    //   return 'aliyun';
    // }

    return null;
}; 