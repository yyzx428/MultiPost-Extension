/**
 * @file window-bridge.ts
 * @description 通过 window.postMessage 动态调用 executeChainActionByName 的桥接逻辑
 */

import { executeChainActionByName } from './index';

//===================================
// window.postMessage 桥接监听器
//===================================

interface ChainActionRequest {
    type: 'CHAIN_ACTION_REQUEST';
    action: string;
    traceId?: string;
    config: Record<string, unknown>;
}

interface ChainActionResponse {
    type: 'CHAIN_ACTION_RESPONSE';
    action: string;
    traceId?: string;
    result?: Record<string, unknown>;
    error?: string;
    success: boolean;
}

(function registerWindowChainActionBridge() {
    if ((window as unknown as Record<string, unknown>).__CHAIN_ACTION_BRIDGE__) return;
    (window as unknown as Record<string, unknown>).__CHAIN_ACTION_BRIDGE__ = true;

    window.addEventListener('message', async (event: MessageEvent) => {
        const data = event.data;
        if (!data || data.type !== 'CHAIN_ACTION_REQUEST') return;
        const { action, config, traceId } = data as ChainActionRequest;
        try {
            const result = await executeChainActionByName(action, config);
            const response: ChainActionResponse = {
                type: 'CHAIN_ACTION_RESPONSE',
                action,
                traceId,
                result: result as Record<string, unknown>,
                success: true
            };
            window.postMessage(response, '*');
        } catch (error: unknown) {
            const response: ChainActionResponse = {
                type: 'CHAIN_ACTION_RESPONSE',
                action,
                traceId,
                error: error instanceof Error ? error.message : String(error),
                success: false
            };
            window.postMessage(response, '*');
        }
    });
})(); 