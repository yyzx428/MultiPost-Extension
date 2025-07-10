/**
 * @file 等待工具模块
 * @description 提供DOM元素等待、状态变化监听等通用功能
 */

import type { OperationLog } from '../types';

//===================================
// 等待工具类
//===================================

export class Waiter {
    private logs: OperationLog[] = [];

    /**
     * 等待元素出现
     * @param selector CSS选择器
     * @param timeout 超时时间（毫秒）
     * @returns 找到的元素或null
     */
    async waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
        const startTime = Date.now();

        return new Promise((resolve) => {
            // 立即检查元素是否已存在
            const element = document.querySelector(selector);
            if (element) {
                this.addLog('info', `元素立即找到: ${selector}`);
                resolve(element);
                return;
            }

            // 使用MutationObserver监听DOM变化
            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    this.addLog('info', `元素找到: ${selector}, 耗时: ${Date.now() - startTime}ms`);
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });

            // 设置超时
            setTimeout(() => {
                observer.disconnect();
                this.addLog('warn', `等待元素超时: ${selector}, 超时时间: ${timeout}ms`);
                resolve(null);
            }, timeout);
        });
    }

    /**
     * 等待元素出现并自动点击
     * @param selector CSS选择器
     * @param timeout 超时时间（毫秒）
     * @returns 是否成功点击
     */
    async waitAndClick(selector: string, timeout = 10000): Promise<boolean> {
        const element = await this.waitForElement(selector, timeout);
        if (element) {
            const htmlElement = element as HTMLElement;
            htmlElement.click();
            htmlElement.dispatchEvent(new Event('click', { bubbles: true }));
            this.addLog('info', `成功点击元素: ${selector}`);
            return true;
        }

        this.addLog('error', `无法点击元素（未找到）: ${selector}`);
        return false;
    }

    /**
     * 等待状态变化
     * @param validator 状态验证函数
     * @param timeout 超时时间（毫秒）
     * @param checkInterval 检查间隔（毫秒）
     * @returns 是否达到期望状态
     */
    async waitForStateChange(
        validator: () => boolean,
        timeout = 10000,
        checkInterval = 100
    ): Promise<boolean> {
        const startTime = Date.now();

        return new Promise((resolve) => {
            const check = () => {
                if (validator()) {
                    this.addLog('info', `状态变化检测成功, 耗时: ${Date.now() - startTime}ms`);
                    resolve(true);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    this.addLog('warn', `状态变化检测超时: ${timeout}ms`);
                    resolve(false);
                    return;
                }

                setTimeout(check, checkInterval);
            };

            check();
        });
    }

    /**
     * 等待页面URL变化
     * @param expectedPattern URL期望包含的模式
     * @param timeout 超时时间（毫秒）
     * @returns 是否URL已变化
     */
    async waitForUrlChange(expectedPattern: string, timeout = 10000): Promise<boolean> {
        return this.waitForStateChange(
            () => window.location.href.includes(expectedPattern),
            timeout
        );
    }

    /**
     * 等待网络请求完成
     * @param timeout 超时时间（毫秒）
     * @returns 是否完成
     */
    async waitForNetworkIdle(timeout = 5000): Promise<boolean> {
        let lastRequestTime = Date.now();

        // 监听网络活动
        const originalFetch = window.fetch;
        window.fetch = function (...args) {
            lastRequestTime = Date.now();
            return originalFetch.apply(this, args);
        };

        const originalXHR = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (...args) {
            lastRequestTime = Date.now();
            return originalXHR.apply(this, args);
        };

        return new Promise((resolve) => {
            const checkIdle = () => {
                const idleTime = Date.now() - lastRequestTime;
                if (idleTime >= 1000) { // 1秒无网络活动认为空闲
                    // 恢复原始方法
                    window.fetch = originalFetch;
                    XMLHttpRequest.prototype.open = originalXHR;
                    resolve(true);
                    return;
                }

                if (idleTime > timeout) {
                    // 恢复原始方法
                    window.fetch = originalFetch;
                    XMLHttpRequest.prototype.open = originalXHR;
                    resolve(false);
                    return;
                }

                setTimeout(checkIdle, 100);
            };

            checkIdle();
        });
    }

    /**
     * 简单延时等待
     * @param ms 等待时间（毫秒）
     */
    async sleep(ms: number): Promise<void> {
        this.addLog('debug', `延时等待: ${ms}ms`);
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 等待多个条件同时满足
     * @param conditions 条件数组
     * @param timeout 超时时间（毫秒）
     * @returns 是否所有条件都满足
     */
    async waitForAllConditions(
        conditions: (() => boolean)[],
        timeout = 10000
    ): Promise<boolean> {
        return this.waitForStateChange(
            () => conditions.every(condition => condition()),
            timeout
        );
    }

    /**
     * 等待任一条件满足
     * @param conditions 条件数组
     * @param timeout 超时时间（毫秒）
     * @returns 满足的条件索引，-1表示超时
     */
    async waitForAnyCondition(
        conditions: (() => boolean)[],
        timeout = 10000
    ): Promise<number> {
        const startTime = Date.now();

        return new Promise((resolve) => {
            const check = () => {
                for (let i = 0; i < conditions.length; i++) {
                    if (conditions[i]()) {
                        this.addLog('info', `条件${i}满足, 耗时: ${Date.now() - startTime}ms`);
                        resolve(i);
                        return;
                    }
                }

                if (Date.now() - startTime > timeout) {
                    this.addLog('warn', `所有条件检测超时: ${timeout}ms`);
                    resolve(-1);
                    return;
                }

                setTimeout(check, 100);
            };

            check();
        });
    }

    /**
     * 获取操作日志
     * @returns 日志数组
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
} 