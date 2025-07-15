/**
 * @file ChainActionExample.tsx
 * @description 链式操作调用示例组件
 */

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Textarea } from '@heroui/react';
import { Play, Settings } from 'lucide-react';

interface ChainActionExampleProps {
    onExecute?: (config: Record<string, unknown>) => void;
}

export default function ChainActionExample({ onExecute }: ChainActionExampleProps) {
    const [baiduPaths, setBaiduPaths] = React.useState('我的手抄报,054');
    const [productTitle, setProductTitle] = React.useState('精美手抄报模板');
    const [useInfo, setUseInfo] = React.useState('这是一套精美的手抄报模板，包含多种主题和风格。');

    const handleExecute = () => {
        const config = {
            action: 'baidu-agiso',
            config: {
                baiduShare: {
                    paths: baiduPaths.split(',').map(p => p.trim()),
                    shareConfig: {
                        validPeriod: '永久有效',
                        extractCodeType: '随机生成',
                        hideUserInfo: false,
                        selection: {
                            selectAll: true
                        }
                    }
                },
                agisoProduct: {
                    title: productTitle,
                    useInfo: useInfo
                }
            }
        };

        // 发送消息到 background script
        chrome.runtime.sendMessage({
            action: 'MUTLIPOST_EXTENSION_CHAIN_ACTION',
            data: config,
            traceId: `chain-action-${Date.now()}`
        });

        onExecute?.(config);
    };

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader className="flex gap-2 items-center">
                <Settings className="w-5 h-5" />
                <span>链式操作示例</span>
            </CardHeader>
            <CardBody className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                        百度云路径（用逗号分隔）
                    </label>
                    <Input
                        value={baiduPaths}
                        onChange={(e) => setBaiduPaths(e.target.value)}
                        placeholder="例如：我的手抄报,054"
                        variant="bordered"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                        商品标题
                    </label>
                    <Input
                        value={productTitle}
                        onChange={(e) => setProductTitle(e.target.value)}
                        placeholder="请输入商品标题"
                        variant="bordered"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                        使用说明
                    </label>
                    <Textarea
                        value={useInfo}
                        onChange={(e) => setUseInfo(e.target.value)}
                        placeholder="请输入使用说明"
                        variant="bordered"
                        minRows={3}
                    />
                </div>

                <Button
                    color="primary"
                    size="lg"
                    startContent={<Play className="w-4 h-4" />}
                    onClick={handleExecute}
                    className="w-full"
                >
                    执行链式操作
                </Button>
            </CardBody>
        </Card>
    );
} 