import type { ShangPinData, SyncData } from "~sync/common";

/**
 * 阿奇索平台商品发布函数
 * @param data 同步数据，包含商品信息和发布配置
 */
export async function ShangpinAgiso(data: SyncData) {
    const { title, useInfo } = data.data as ShangPinData;

    console.log('=== 开始阿奇索平台商品发布流程 ===');
    console.log('商品标题:', title);
    console.log('使用说明:', useInfo);



    /**
     * 等待元素出现的辅助函数
     * @param selector CSS选择器
     * @param timeout 超时时间（毫秒）
     * @returns Promise<Element> 找到的元素
     */
    function waitForElement(selector: string, timeout = 10000): Promise<Element> {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`等待元素 ${selector} 超时`));
            }, timeout);
        });
    }

    /**
     * 等待页面完全加载
     */
    async function waitForPageLoad(): Promise<void> {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                console.log('页面已加载完成');
                resolve();
            } else {
                console.log('等待页面加载...');
                window.addEventListener('load', () => {
                    console.log('页面加载事件触发');
                    resolve();
                });
            }
        });
    }

    /**
     * 等待 React 完全初始化
     */
    async function waitForReactReady(): Promise<void> {
        return new Promise((resolve) => {
            const checkReact = () => {
                const hasAntDesign = document.querySelector('.ant-form, .ant-input, .ant-btn');

                if (hasAntDesign) {
                    console.log('Ant Design 组件已加载');
                    resolve();
                } else {
                    setTimeout(checkReact, 100);
                }
            };
            checkReact();
        });
    }

    /**
     * 等待 DOM 稳定
     */
    async function waitForDOMStable(): Promise<void> {
        return new Promise((resolve) => {
            let stableCount = 0;
            const requiredStableCount = 3;

            const checkStability = () => {
                const hasPendingMutations = document.querySelectorAll('[data-loading], .loading, .ant-spin').length > 0;

                if (!hasPendingMutations) {
                    stableCount++;
                    if (stableCount >= requiredStableCount) {
                        console.log('DOM 已稳定');
                        resolve();
                        return;
                    }
                } else {
                    stableCount = 0;
                }

                setTimeout(checkStability, 200);
            };

            checkStability();
        });
    }



    /**
     * 设置输入框值 - 简化版本
     */
    async function setInputValue(selector: string, value: string): Promise<boolean> {
        console.log(`设置输入框值: ${selector} = ${value}`);

        try {
            // 等待元素出现
            const element = await waitForElement(selector, 10000);

            // 等待一下让元素稳定
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 检查元素类型
            if (element.tagName === 'INPUT') {
                const input = element as HTMLInputElement;
                console.log('设置前值:', input.value);

                // 直接设置值
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));

                console.log('设置后值:', input.value);
                return input.value === value;

            } else if (element.tagName === 'TEXTAREA') {
                const textarea = element as HTMLTextAreaElement;
                console.log('设置前值:', textarea.value);

                // 直接设置值
                textarea.value = value;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));

                console.log('设置后值:', textarea.value);
                return textarea.value === value;
            }

            return false;

        } catch (error) {
            console.error('设置输入框值失败:', error);
            return false;
        }
    }

    /**
     * 查找并点击按钮
     */
    async function findAndClickButton(selectors: string[], textFilter?: string): Promise<HTMLElement | null> {
        for (const selector of selectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    if (textFilter) {
                        if (element.textContent?.includes(textFilter)) {
                            console.log(`找到按钮: ${selector} (${textFilter})`);
                            (element as HTMLElement).click();
                            return element as HTMLElement;
                        }
                    } else {
                        console.log(`找到按钮: ${selector}`);
                        (element as HTMLElement).click();
                        return element as HTMLElement;
                    }
                }
            } catch (error) {
                console.log(`选择器 ${selector} 无效:`, error);
            }
        }

        console.error('未找到按钮');
        return null;
    }

    /**
     * 第一阶段：添加商品信息
     */
    async function addProductInfo(): Promise<boolean> {
        console.log('=== 第一阶段：添加商品信息 ===');

        try {
            // 1. 查找并点击添加按钮
            console.log('1. 查找添加按钮...');
            const addButton = await findAndClickButton(
                ['button[type="button"]', 'button.ant-btn', 'button'],
                '添 加'
            );

            if (!addButton) {
                console.error('未找到添加按钮');
                return false;
            }

            console.log('已点击添加按钮');

            // 2. 等待弹窗出现
            console.log('2. 等待弹窗出现...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 3. 检查弹窗
            const modal = document.querySelector('div[class="ant-modal-content"]');
            if (!modal) {
                console.error('弹窗未出现');
                return false;
            }

            console.log('弹窗已出现');

            // 4. 设置商品名称
            console.log('3. 设置商品名称...');
            const titleResult = await setInputValue('div[class="ant-modal-content"] input[id="goodsName"]', title);
            if (!titleResult) {
                console.error('设置商品名称失败');
                return false;
            }

            console.log('商品名称设置成功');

            // 5. 点击查询按钮
            console.log('4. 点击查询按钮...');
            const searchButton = await waitForElement('div[class="ant-modal-content"] button[type="submit"]', 10000) as HTMLElement;

            if (!searchButton) {
                console.error('未找到查询按钮');
                return false;
            }
            searchButton.click();
            console.log('已点击查询按钮');

            // 6. 等待搜索结果
            console.log('5. 等待搜索结果...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 7. 处理搜索结果
            console.log('6. 处理搜索结果...');
            const tableRows = document.querySelectorAll('div[class="ant-modal-content"] tbody tr');
            console.log('找到表格行数:', tableRows.length);

            if (tableRows.length > 0) {
                // 查找匹配的商品
                const targetRow = Array.from(tableRows).find(row => {
                    return row.textContent?.includes(title);
                });

                if (targetRow) {
                    console.log('找到匹配的商品');
                    const checkbox = targetRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
                    if (checkbox) {
                        checkbox.click();
                        console.log('已选择商品');
                    }

                    // 点击弹窗添加按钮
                    const modalAddButton = await findAndClickButton(
                        ['div[class="ant-modal-content"] div[class="ant-modal-footer"] button[type="button"]'],
                        '添 加'
                    );

                    if (modalAddButton) {
                        console.log('已点击弹窗添加按钮');
                        return true;
                    }
                } else {
                    console.log('未找到匹配的商品');
                }
            } else {
                console.log('没有搜索结果');
            }

            // 如果没有找到匹配的商品，点击取消
            const cancelButton = await findAndClickButton(
                ['div[class="ant-modal-content"] div[class="ant-modal-footer"] button[type="button"]'],
                '取 消'
            );

            if (cancelButton) {
                console.log('已点击取消按钮');
            }

            return true;

        } catch (error) {
            console.error('添加商品信息失败:', error);
            return false;
        }
    }

    /**
     * 第二阶段：填写商品信息
     */
    async function fillProductInfo(): Promise<boolean> {
        console.log('=== 第二阶段：填写商品信息 ===');

        try {
            // 1. 设置商品名称
            console.log('1. 设置商品名称...');
            const titleResult = await setInputValue('div[class="agiso-input-container"] input[id="goodsName"]', title);
            if (!titleResult) {
                console.error('设置商品名称失败');
                return false;
            }

            console.log('商品名称设置成功');

            // 2. 点击查询按钮
            console.log('2. 点击查询按钮...');
            const searchButton = await waitForElement('div[class="ant-space-item"] button[type="submit"]', 10000) as HTMLElement;
            if (!searchButton) {
                console.error('未找到查询按钮');
                return false;
            }

            searchButton.click();
            console.log('已点击查询按钮');

            // 3. 等待查询结果
            console.log('3. 等待查询结果...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 4. 查找并点击商品行
            console.log('4. 查找商品行...');
            const tableRows = document.querySelectorAll('div[class="ant-table-body"] tbody tr');
            const targetRow = Array.from(tableRows).find(row => {
                return row && row.textContent?.includes(title);
            });

            if (!targetRow) {
                console.error('未找到目标商品行');
                return false;
            }

            const link = targetRow.querySelector('a') as HTMLElement;
            if (!link) {
                console.error('未找到商品链接');
                return false;
            }

            console.log('找到商品行，准备点击');
            link.click();
            console.log('已点击商品行');

            // 5. 等待设置弹窗出现
            console.log('5. 等待设置弹窗...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 6. 设置使用说明
            console.log('6. 设置使用说明...');
            const useInfoResult = await setInputValue('div[class="ant-modal-content"] textarea', useInfo);
            if (!useInfoResult) {
                console.error('设置使用说明失败');
                return false;
            }

            console.log('使用说明设置成功');

            // 7. 点击保存按钮
            console.log('7. 点击保存按钮...');
            const saveButton = await findAndClickButton(
                ['div[class="ant-modal-content"] div[class="ant-modal-footer"] button[type="button"]'],
                '保 存'
            );

            if (!saveButton) {
                console.error('未找到保存按钮');
                return false;
            }

            console.log('已点击保存按钮');
            return true;

        } catch (error) {
            console.error('填写商品信息失败:', error);
            return false;
        }
    }

    // 主执行流程
    try {
        // 1. 等待页面加载
        await waitForPageLoad();

        // 2. 等待 React 初始化
        await waitForReactReady();

        // 3. 等待 DOM 稳定
        await waitForDOMStable();

        // 4. 执行第一阶段：添加商品信息
        const addResult = await addProductInfo();
        if (!addResult) {
            console.error('第一阶段失败');
            return;
        }

        // 5. 等待页面跳转
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 6. 执行第二阶段：填写商品信息
        const fillResult = await fillProductInfo();
        if (!fillResult) {
            console.error('第二阶段失败');
            return;
        }

        console.log('=== 阿奇索平台商品发布流程完成 ===');

    } catch (error) {
        console.error('阿奇索平台商品发布过程中发生错误:', error);
    }
}

