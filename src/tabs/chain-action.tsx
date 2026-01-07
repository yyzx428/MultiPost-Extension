/**
 * @file chain-action.tsx
 * @description 链式操作弹窗页面组件 - 采用发布弹窗风格，自动执行
 */

import '~style.css';
import React, { useEffect, useState, useRef } from 'react';
import {
    HeroUIProvider,
    Button,
    Progress,
    Switch,
    Tooltip,
    NumberInput,
    Chip
} from '@heroui/react';
import {
    RefreshCw,
    X,
    CheckCircle,
    XCircle,
    Clock
} from 'lucide-react';
import { executeChainActionByName, type ChainActionBase, getAvailableChainActions } from '~chain-actions';
import { Storage } from '@plasmohq/storage';
import cssText from 'data-text:~style.css';
import type { ShangPinData } from '~sync/common';

const storage = new Storage({ area: 'local' });

//===================================
// Plasmo 框架必需的导出函数
//===================================

export function getShadowContainer() {
    return document.querySelector('#test-shadow').shadowRoot.querySelector('#plasmo-shadow-container');
}

export const getShadowHostId = () => 'test-shadow';

export const getStyle = () => {
    const style = document.createElement('style');
    style.textContent = cssText;
    return style;
};

//===================================
// 常量定义
//===================================

const AUTO_CLOSE_KEY = 'chain-action-auto-close';
const AUTO_CLOSE_DELAY_KEY = 'chain-action-auto-close-delay';
const DEFAULT_AUTO_CLOSE_DELAY = 2 * 60; // 2 minutes in seconds

//===================================
// 类型定义
//===================================

interface ChainActionConfig {
    action: string;
    config: Record<string, unknown>;
    traceId?: string;
}

interface StepStatus {
    name: string;
    status: 'waiting' | 'running' | 'success' | 'error';
    message?: string;
    result?: Record<string, unknown>;
    error?: string;
}

interface ChainActionState {
    config: ChainActionConfig | null;
    steps: StepStatus[];
    isExecuting: boolean;
    logs: string[];
    result: Record<string, unknown> | null;
    error: string | null;
}

//===================================
// 工具函数
//===================================

// 聚焦到主窗口的函数
// const focusMainWindow = async () => {
//     const windows = await chrome.windows.getAll();
//     const mainWindow = windows.find((window) => window.type === 'normal');
//     if (mainWindow?.id) {
//         await chrome.windows.update(mainWindow.id, { focused: true });
//     }
// };

const getTitleFromConfig = (config: ChainActionConfig | null, availableActions: ChainActionBase[]) => {
    if (!config) return '链式操作';

    const action = availableActions.find(a => a.name === config.action);
    return action?.name || config.action;
};

//===================================
// 主组件
//===================================

export default function ChainActionModal() {
    const [state, setState] = useState<ChainActionState>({
        config: null,
        steps: [],
        isExecuting: false,
        logs: [],
        result: null,
        error: null
    });

    const [availableActions, setAvailableActions] = useState<ChainActionBase[]>([]);
    const [autoClose, setAutoClose] = useState(true);
    const [countdown, setCountdown] = useState<number>(0);
    const [autoCloseDelay, setAutoCloseDelay] = useState<number>(DEFAULT_AUTO_CLOSE_DELAY);
    const autoCloseTimerRef = useRef<NodeJS.Timeout>();
    const countdownTimerRef = useRef<NodeJS.Timeout>();
    const logsEndRef = useRef<HTMLDivElement>(null);
    const hasExecutedRef = useRef<boolean>(false);

    //===================================
    // 初始化
    //===================================

    useEffect(() => {
        // 重置执行标志
        hasExecutedRef.current = false;

        // 加载自动关闭设置
        loadAutoCloseSettings();

        // 获取可用的链式操作
        loadAvailableActions();

        // 从 background script 获取配置数据并自动执行
        requestChainActionData();
    }, []);

    useEffect(() => {
        // 如果执行完成且启用了自动关闭，开始倒计时
        if (!state.isExecuting && state.result && autoClose) {
            startAutoCloseTimer();
        }

        return () => {
            if (autoCloseTimerRef.current) {
                clearTimeout(autoCloseTimerRef.current);
            }
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
            }
        };
    }, [state.isExecuting, state.result, autoClose]);

    // 监听配置数据变化，自动执行链式操作
    useEffect(() => {
        if (state.config && !state.isExecuting && state.steps.length > 0 && !hasExecutedRef.current) {
            console.log('配置数据已设置，准备自动执行链式操作');
            // 延迟1秒执行，让用户看到界面
            const timer = setTimeout(() => {
                console.log('自动执行链式操作');
                hasExecutedRef.current = true;
                executeChainActionWithTabManagement();
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [state.config, state.isExecuting, state.steps.length]);

    const loadAvailableActions = async () => {
        try {
            const actions = getAvailableChainActions();
            setAvailableActions(actions);
        } catch (error) {
            console.error('加载可用链式操作失败:', error);
            addLog('❌ 加载可用链式操作失败: ' + error.message);
        }
    };

    const requestChainActionData = () => {
        chrome.runtime.sendMessage(
            { action: 'MUTLIPOST_EXTENSION_CHAIN_ACTION_REQUEST_DATA' },
            (response) => {
                console.log('收到链式操作配置:', response);
                console.log('response?.config 存在:', !!response?.config);
                if (response?.config) {
                    console.log('设置配置数据:', response.config);
                    setState(prev => {
                        console.log('setState 回调，prev.config:', prev.config);
                        return {
                            ...prev,
                            config: response.config
                        };
                    });
                    initializeSteps(response.config.action);

                    // 自动开始执行链式操作 - 使用 useEffect 监听状态变化
                    // 移除 setTimeout，改为在 useEffect 中处理
                } else {
                    addLog('❌ 未获取到链式操作配置数据');
                }
            }
        );
    };

    const loadAutoCloseSettings = async () => {
        const savedAutoClose = await storage.get<boolean>(AUTO_CLOSE_KEY);
        const savedDelay = await storage.get<number>(AUTO_CLOSE_DELAY_KEY);

        if (savedAutoClose !== undefined) {
            setAutoClose(savedAutoClose);
        }
        if (savedDelay !== undefined) {
            setAutoCloseDelay(savedDelay);
        }
    };

    //===================================
    // 自动关闭相关
    //===================================

    const startAutoCloseTimer = (delaySeconds?: number) => {
        const delay = delaySeconds || autoCloseDelay;

        if (autoCloseTimerRef.current) {
            clearTimeout(autoCloseTimerRef.current);
        }
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
        }

        setCountdown(delay);

        countdownTimerRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(countdownTimerRef.current);
                    handleCloseWindow();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        autoCloseTimerRef.current = setTimeout(() => {
            handleCloseWindow();
        }, delay * 1000);
    };

    const handleAutoCloseChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const newAutoClose = event.target.checked;
        setAutoClose(newAutoClose);
        await storage.set(AUTO_CLOSE_KEY, newAutoClose);

        if (!newAutoClose) {
            if (autoCloseTimerRef.current) {
                clearTimeout(autoCloseTimerRef.current);
            }
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
            }
            setCountdown(0);
        } else if (!state.isExecuting && state.result) {
            startAutoCloseTimer();
        }
    };

    const handleDelayChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const newDelay = parseInt(event.target.value) * 60; // 转换为秒
        setAutoCloseDelay(newDelay);
        await storage.set(AUTO_CLOSE_DELAY_KEY, newDelay);

        if (autoClose && !state.isExecuting && state.result) {
            startAutoCloseTimer(newDelay);
        }
    };

    //===================================
    // 步骤初始化
    //===================================

    const initializeSteps = (actionName: string) => {
        const steps: StepStatus[] = [];

        switch (actionName) {
            case 'baidu-agiso':
                steps.push(
                    { name: '百度云分享', status: 'waiting' },
                    { name: 'Agiso发布', status: 'waiting' }
                );
                break;
            default:
                steps.push({ name: '执行中', status: 'waiting' });
        }

        setState(prev => ({ ...prev, steps }));
    };

    //===================================
    // 日志管理
    //===================================

    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;

        setState(prev => ({
            ...prev,
            logs: [...prev.logs, logEntry]
        }));

        // 自动滚动到底部
        setTimeout(() => {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    //===================================
    // 执行链式操作
    //===================================

    const executeChainActionWithTabManagement = async () => {
        console.log('executeChainActionWithTabManagement 被调用，当前 state.config:', state.config);
        if (!state.config) {
            addLog('❌ 配置数据为空');
            return;
        }

        setState(prev => ({
            ...prev,
            isExecuting: true,
            error: null
        }));

        addLog('🚀 开始执行链式操作: ' + state.config.action);

        try {
            // 更新步骤状态
            updateStepStatus(0, 'running', '正在执行...');

            // 重新组织配置数据结构以匹配 ChainActionConfig 接口
            const config = state.config.config as {
                baiduShare: {
                    paths: string[];
                    shareConfig: Record<string, unknown>;
                };
                agisoProduct: { title: string; useInfo: string };
                redProduct: ShangPinData;
            };

            const chainActionConfig = {
                baiduShare: {
                    paths: config.baiduShare.paths,
                    shareConfig: config.baiduShare.shareConfig,
                },
                agisoProduct: config.agisoProduct,
                redProduct: config.redProduct
            };

            // 执行链式操作
            const result = await executeChainActionByName(
                state.config.action,
                chainActionConfig
            );

            // 更新步骤状态
            const resultData = result as { success: boolean; error?: string; baiduShareResult?: unknown; agisoPublishResult?: unknown };
            if (resultData.success) {
                updateStepStatus(0, 'success', '百度云分享完成');
                updateStepStatus(1, 'success', '阿奇索发布完成');
                addLog('✅ 链式操作执行成功');

                // 记录详细结果
                if (resultData.baiduShareResult) {
                    addLog('📋 百度云分享结果: ' + JSON.stringify(resultData.baiduShareResult));
                }
                if (resultData.agisoPublishResult) {
                    addLog('📋 阿奇索发布结果: ' + JSON.stringify(resultData.agisoPublishResult));
                }
            } else {
                updateStepStatus(0, 'error', resultData.error || '执行失败');
                updateStepStatus(1, 'error', '发布失败');
                addLog('❌ 链式操作执行失败: ' + (resultData.error || '未知错误'));
            }

            setState(prev => ({
                ...prev,
                result: result as Record<string, unknown>,
                isExecuting: false
            }));

            // 调用回调函数并清空变量
            chrome.runtime.sendMessage(
                { action: 'MUTLIPOST_EXTENSION_CHAIN_ACTION_COMPLETE', data: result },
                () => {
                    console.log('链式操作完成回调已发送');
                }
            );

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            updateStepStatus(0, 'error', errorMessage);
            addLog('❌ 执行过程中出错: ' + errorMessage);

            setState(prev => ({
                ...prev,
                error: errorMessage,
                isExecuting: false
            }));
        }
    };

    //===================================
    // 步骤状态更新
    //===================================

    const updateStepStatus = (stepIndex: number, status: StepStatus['status'], message?: string) => {
        setState(prev => ({
            ...prev,
            steps: prev.steps.map((step, index) =>
                index === stepIndex
                    ? { ...step, status, message }
                    : step
            )
        }));
    };



    //===================================
    // 关闭弹窗
    //===================================

    const handleCloseWindow = () => {
        window.close();
    };

    //===================================
    // 渲染函数
    //===================================

    const renderStepIcon = (status: StepStatus['status']) => {
        switch (status) {
            case 'waiting':
                return <Clock className="w-4 h-4 text-gray-400" />;
            case 'running':
                return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'success':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    const renderStepChip = (status: StepStatus['status']) => {
        const getVariant = (status: StepStatus['status']) => {
            switch (status) {
                case 'waiting': return 'flat';
                case 'running': return 'solid';
                case 'success': return 'solid';
                case 'error': return 'solid';
                default: return 'flat';
            }
        };

        const getColor = (status: StepStatus['status']) => {
            switch (status) {
                case 'waiting': return 'default';
                case 'running': return 'primary';
                case 'success': return 'success';
                case 'error': return 'danger';
                default: return 'default';
            }
        };

        const labels = {
            waiting: '等待中',
            running: '执行中',
            success: '成功',
            error: '失败'
        };

        return (
            <Chip variant={getVariant(status)} color={getColor(status)} size="sm">
                {labels[status]}
            </Chip>
        );
    };

    const getNotice = () => {
        if (state.isExecuting) {
            return '正在执行链式操作...';
        }
        if (state.error) {
            return '执行失败';
        }
        if (state.result) {
            return '执行完成';
        }
        return '准备执行';
    };

    //===================================
    // 主渲染
    //===================================

    return (
        <HeroUIProvider>
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
                <div className="w-full max-w-md space-y-4">
                    <h2 className="text-xl font-semibold text-center text-foreground">
                        链式操作执行器
                    </h2>

                    {state.config && (
                        <p className="text-sm text-center truncate text-muted-foreground">
                            {getTitleFromConfig(state.config, availableActions)}
                        </p>
                    )}

                    <Progress
                        value={state.isExecuting ? undefined : 100}
                        isIndeterminate={state.isExecuting}
                        aria-label={getNotice()}
                        className={`w-full ${state.isExecuting ? 'bg-blue-500' : ''}`}
                        size="sm"
                    />

                    <p className="text-sm text-center text-muted-foreground">
                        {getNotice()}
                    </p>

                    {/* 步骤状态 */}
                    {state.steps.length > 0 && (
                        <div className="space-y-2">
                            {state.steps.map((step, index) => (
                                <div key={index} className="flex items-center gap-3 p-2 border rounded-lg">
                                    {renderStepIcon(step.status)}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{step.name}</span>
                                            {renderStepChip(step.status)}
                                        </div>
                                        {step.message && (
                                            <p className="text-xs text-gray-600 mt-1">{step.message}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 错误信息 */}
                    {state.error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
                            <p className="text-sm font-medium">执行失败</p>
                            <p className="text-xs mt-1">{state.error}</p>
                        </div>
                    )}

                    {/* 执行日志 */}
                    {state.logs.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm text-center text-muted-foreground">执行日志</p>
                            <div className="h-32 overflow-y-auto bg-gray-50 rounded border p-2 font-mono text-xs">
                                {state.logs.map((log, index) => (
                                    <div key={index} className="mb-1">
                                        {log}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    )}

                    {/* 自动关闭设置 */}
                    <div className="px-3 py-2 space-y-3 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Tooltip
                                    content="执行完成后自动关闭窗口"
                                    placement="top"
                                    className="max-w-xs">
                                    <Switch
                                        isSelected={autoClose}
                                        onChange={handleAutoCloseChange}
                                        size="sm"
                                        className="data-[state=checked]:bg-primary-600 cursor-help">
                                        <span className="text-sm text-gray-700">自动关闭</span>
                                    </Switch>
                                </Tooltip>
                                {autoClose && (
                                    <div className="flex items-center gap-1 ml-2">
                                        <NumberInput
                                            hideStepper
                                            size="sm"
                                            variant="underlined"
                                            min="1"
                                            max="10"
                                            value={Math.floor(autoCloseDelay / 60)}
                                            onChange={(e) => handleDelayChange(e)}
                                            className="w-14"
                                            aria-label="自动关闭延迟时间（分钟）"
                                        />
                                        <span className="text-xs text-gray-500">min</span>
                                    </div>
                                )}
                            </div>
                            {autoClose && countdown > 0 && (
                                <div className="flex gap-1.5 items-center">
                                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                                    <span className="text-xs font-medium text-orange-700">
                                        {countdown}秒后自动关闭
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 操作按钮 */}
                    {!state.isExecuting && (
                        <Button
                            color="danger"
                            variant="solid"
                            startContent={<X className="w-4 h-4" />}
                            onClick={handleCloseWindow}
                            className="w-full">
                            关闭
                        </Button>
                    )}
                </div>

                {/* 联系信息 */}
                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-500">
                        如有问题，请
                        <a
                            href="https://docs.multipost.app/docs/user-guide/contact-us"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 underline hover:text-blue-600">
                            联系我们
                        </a>
                    </p>
                </div>
            </div>
        </HeroUIProvider>
    );
} 