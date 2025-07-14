import type { ShangPinData, SyncData } from "~sync/common";

/**
 * 阿奇索平台商品发布函数
 * @param data 同步数据，包含商品信息和发布配置
 */
export async function ShangpinAgiso(data: SyncData) {
    const { title, useInfo } = data.data as ShangPinData;

    // 重试操作函数
    async function retryOperation(operation: () => boolean | Promise<boolean>, maxRetries = 3, delay = 1000): Promise<boolean> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`第 ${i + 1} 次尝试`);
                const result = await operation();

                if (result) {
                    console.log(`第 ${i + 1} 次尝试成功`);
                    return true;
                }

                console.log(`第 ${i + 1} 次尝试失败，等待 ${delay}ms 后重试`);
                await new Promise(resolve => setTimeout(resolve, delay));

            } catch (error) {
                console.log(`第 ${i + 1} 次尝试出错:`, error);

                if (i === maxRetries - 1) {
                    throw error;
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.log('所有重试都失败了');
        return false;
    }

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

    // 通过 Input 组件的 React 实例设置值
    function setInputValueViaReact(inputElement, value) {
        if (!inputElement) {
            console.error('未找到输入框');
            return false;
        }

        // 查找 Input 组件的 React 实例
        const reactKey = Object.keys(inputElement).find(key => key.startsWith('__reactFiber$'));
        if (reactKey) {
            const fiber = inputElement[reactKey];
            if (fiber && fiber.memoizedProps && fiber.memoizedProps.onChange) {
                console.log('找到 Input React 实例');

                // 创建模拟的 change 事件
                const event = {
                    target: { value: value },
                    currentTarget: { value: value },
                    type: 'change',
                    nativeEvent: { target: { value: value } }
                };

                // 触发 onChange
                fiber.memoizedProps.onChange(event);
                console.log('已触发 Input onChange');
                return true;
            }
        }

        return false;
    }

    // 修复版本：创建真实的 DOM 事件对象
    function setTextareaValueViaReact(textareaElement, value) {
        if (!textareaElement) {
            console.error('未找到 Textarea');
            return false;
        }

        // 查找 Textarea 组件的 React 实例
        const reactKey = Object.keys(textareaElement).find(key => key.startsWith('__reactFiber$'));
        if (reactKey) {
            const fiber = textareaElement[reactKey];
            if (fiber && fiber.memoizedProps && fiber.memoizedProps.onChange) {
                console.log('找到 Textarea React 实例');

                // 创建真实的 DOM 事件对象
                const event = new Event('change', { bubbles: true });

                // 设置事件的目标
                Object.defineProperty(event, 'target', {
                    writable: false,
                    value: textareaElement
                });

                Object.defineProperty(event, 'currentTarget', {
                    writable: false,
                    value: textareaElement
                });

                // 设置值到目标元素
                textareaElement.value = value;

                // 触发 onChange
                fiber.memoizedProps.onChange(event);
                console.log('已触发 Textarea onChange');
                return true;
            }
        }

        return false;
    }

    async function waitForReactReady() {
        return new Promise((resolve) => {
            const checkReact = () => {
                // 检查是否有 Ant Design 相关的元素
                const hasAntDesign = document.querySelector('.ant-form, .ant-input, .ant-btn');

                if (hasAntDesign) {
                    console.log('Ant Design 组件已加载');
                    resolve(true);
                } else {
                    setTimeout(checkReact, 100);
                }
            };
            checkReact();
        });
    }

    async function addProductInfo() {
        const buttons = document.querySelectorAll('button[type="button"]');
        const addButton = Array.from(buttons).find(button => {
            return button.textContent?.includes('添 加');
        }) as HTMLElement;
        if (!addButton) {
            console.error('未找到添加按钮');
            return;
        }
        addButton.click();

        // 等待页面跳转或弹窗关闭
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const titleInput = await waitForElement('div[class="ant-modal-content"] input[id="goodsName"]', 10000) as HTMLInputElement;
        if (!titleInput) {
            console.error('未找到商品名称输入框');
            return;
        }
        const result = await retryOperation(() => setInputValueViaReact(titleInput, title));
        if (!result) {
            console.error('设置商品名称失败');
            return;
        }


        const searchButton = await waitForElement('div[class="ant-modal-content"] button[type="submit"]', 10000) as HTMLElement;
        if (!searchButton) {
            console.error('未找到查询按钮');
            return;
        }
        searchButton.click();

        const modalButtons = document.querySelectorAll('div[class="ant-modal-content"] div[class="ant-modal-footer"] button[type="button"]');
        const modalAddButton = Array.from(modalButtons).find(button => {
            return button.textContent?.includes('添 加');
        }) as HTMLElement;
        if (!modalAddButton) {
            console.error('未找到弹窗添加按钮');
            return;
        }

        const modalCancelButton = Array.from(modalButtons).find(button => {
            return button.textContent?.includes('取 消');
        }) as HTMLElement;
        if (!modalCancelButton) {
            console.error('未找到取消按钮');
            return;
        }

        const trs = document.querySelectorAll('div[class="ant-modal-content"] tbody tr');
        const targetTr = Array.from(trs).find(tr => {
            return tr && tr.textContent?.includes(title);
        });
        if (targetTr) {
            const checkbox = targetTr.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) {
                checkbox.click();
            }
            modalAddButton.click();
        } else {
            modalCancelButton.click();
        }

    }

    async function fillProductInfo() {
        const titleInput = await waitForElement('div[class="agiso-input-container"] input[id="goodsName"]', 10000) as HTMLInputElement;
        if (!titleInput) {
            console.error('未找到商品名称输入框');
            return;
        }
        setInputValueViaReact(titleInput, title);

        const buttons = document.querySelectorAll('div[class="ant-space-item"] button[type="button"]');
        const searchButton = Array.from(buttons).find(button => {
            return button.textContent?.includes('查询');
        }) as HTMLElement;
        if (!searchButton) {
            console.error('未找到查询按钮');
            return;
        }
        searchButton.click();

        const trs = document.querySelectorAll('div[class="ant-table-body"] tbody tr');
        const targetTr = Array.from(trs).find(tr => {
            const td = tr.querySelector('td');
            return td && td.textContent?.includes(title);
        });
        if (!targetTr) {
            console.error('未找到目标商品行');
            return;
        }

        const a = targetTr.querySelector('a') as HTMLElement;
        if (!a) {
            console.error('未找到商品行');
            return;
        }
        a.click();

        const textarea = await waitForElement('div[class="ant-modal-content"] textarea', 10000) as HTMLTextAreaElement;
        if (!textarea) {
            console.error('未找到使用说明输入框');
            return;
        }

        setTextareaValueViaReact(textarea, useInfo);


        const modalButtons = document.querySelectorAll('div[class="ant-modal-content"] div[class="ant-modal-footer"] button[type="button"]');
        const modalAddButton = Array.from(modalButtons).find(button => {
            return button.textContent?.includes('保 存');
        }) as HTMLElement;
        if (!modalAddButton) {
            console.error('未找到保存按钮');
            return;
        }

        modalAddButton.click();
    }

    // 主执行流程
    try {
        console.log('开始阿奇索平台商品发布流程');

        await waitForReactReady();

        await addProductInfo();

        await waitForReactReady();

        await fillProductInfo();


        console.log('阿奇索平台商品发布流程完成');
    } catch (error) {
        console.error('阿奇索平台商品发布过程中发生错误:', error);
    }
}

