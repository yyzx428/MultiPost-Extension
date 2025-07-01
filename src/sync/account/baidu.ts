import type { AccountInfo } from "~sync/common";

export async function getBaiduYunAccountInfo(): Promise<AccountInfo> {
    // 访问baidu API获取用户信息
    const response = await fetch('https://pan.baidu.com/api/loginStatus', {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        credentials: 'include', // 包含cookie以确保认证
    });


    if (!response.ok) {
        throw new Error(`HTTP错误,状态码: ${response.status}`);
    }

    const responseData = await response.json();

    if (responseData.errno) {
        return null;
    }

    const result: AccountInfo = {
        provider: 'baiduyun',
        accountId: responseData.login_info.uk,
        username: responseData.login_info.username,
        description: "",
        profileUrl: "",
        avatarUrl: responseData.login_info.photo_url,
        extraData: responseData,
    }

    return result;
}