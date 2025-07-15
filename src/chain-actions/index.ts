/**
 * @file 链式操作统一入口
 * @description 管理所有链式操作的导出和注册
 */

// 百度云 + Agiso 链式操作
export * from './baidu-agiso/chain-action';

// 链式操作类型定义
export interface ChainActionBase {
    /** 操作名称 */
    name: string;
    /** 操作描述 */
    description: string;
    /** 执行函数 */
    execute: (config: unknown) => Promise<unknown>;
}

// 链式操作注册表
export const chainActions: Record<string, ChainActionBase> = {
    'baidu-agiso': {
        name: '百度云分享 + Agiso发布',
        description: '获取百度云分享链接并在Agiso平台发布商品',
        execute: async (config) => {
            const { executeChainAction } = await import('./baidu-agiso/chain-action');
            return executeChainAction(config as import('./baidu-agiso/chain-action').ChainActionConfig);
        }
    }
};

/**
 * 获取所有可用的链式操作
 * @returns 链式操作列表
 */
export function getAvailableChainActions(): ChainActionBase[] {
    return Object.values(chainActions);
}

/**
 * 执行指定的链式操作
 * @param actionName 操作名称
 * @param config 操作配置
 * @returns 执行结果
 */
export async function executeChainActionByName(actionName: string, config: unknown) {
    const action = chainActions[actionName];
    if (!action) {
        throw new Error(`未找到链式操作: ${actionName}`);
    }
    return action.execute(config);
} 