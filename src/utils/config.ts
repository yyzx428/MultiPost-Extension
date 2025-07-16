/**
 * 应用配置
 * 使用 Plasmo/Vite 环境变量来管理不同环境的配置
 */

// API 基础 URL，从环境变量中获取
// 在 Plasmo 中，环境变量通过 process.env 访问
export const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://multipost.app';

// 应用名称常量
export const APP_NAME = 'MultiPost Extension';

// 其他配置常量
export const APP_CONFIG = {
    // API 相关
    API: {
        BASE_URL: API_BASE_URL,
        PING_ENDPOINT: `${API_BASE_URL}/api/extension/ping`,
    },

    // 应用信息
    APP: {
        NAME: APP_NAME,
        VERSION: chrome.runtime.getManifest().version,
    },

    // 开发环境标识
    IS_DEV: process.env.NODE_ENV === 'development',
} as const;

// 类型定义
export type AppConfig = typeof APP_CONFIG; 