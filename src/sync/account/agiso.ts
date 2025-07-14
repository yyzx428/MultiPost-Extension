import type { AccountInfo } from "~sync/common";

export const AGISO_ACCOUNT_KEY = 'agiso';

/**
 * 获取阿奇索平台账号信息
 * @returns Promise<AccountInfo | null> 账号信息或null
 */
export async function getAgisoAccountInfo(): Promise<AccountInfo | null> {
    try {
        // 这里可以实现获取阿奇索账号信息的逻辑
        // 目前返回null，表示需要用户手动登录
        return null;
    } catch (error) {
        console.error('获取阿奇索账号信息失败:', error);
        return null;
    }
}

/**
 * 检查阿奇索平台登录状态
 * @returns Promise<boolean> 是否已登录
 */
export async function checkAgisoLoginStatus(): Promise<boolean> {
    try {
        // 检查当前页面是否已登录阿奇索
        // 可以通过检查页面元素或localStorage来判断
        const isLoggedIn = document.querySelector('.user-info, .avatar, [data-user]') !== null;
        return isLoggedIn;
    } catch (error) {
        console.error('检查阿奇索登录状态失败:', error);
        return false;
    }
} 