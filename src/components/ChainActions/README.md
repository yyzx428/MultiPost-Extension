# 链式操作弹窗组件

## 概述

链式操作弹窗是一个专门用于执行复杂业务流程的UI组件，支持多步骤操作的执行、进度监控和结果展示。

## 文件结构

```
src/tabs/
└── chain-action.tsx          # 链式操作弹窗组件（与publish.tsx同级）

src/components/ChainActions/
├── ChainActionExample.tsx    # 调用示例组件
└── README.md                 # 使用说明
```

## 功能特性

### 🎯 核心功能
- **配置展示**: 显示当前链式操作的配置信息
- **步骤监控**: 实时显示每个步骤的执行状态
- **日志记录**: 详细的执行日志，便于调试
- **结果展示**: 清晰的成功/失败结果展示
- **重试机制**: 支持失败步骤的重试

### 🎨 UI特性
- **响应式设计**: 适配不同屏幕尺寸
- **状态指示**: 直观的图标和颜色状态指示
- **实时更新**: 执行过程中的实时状态更新
- **用户友好**: 清晰的操作按钮和提示信息

## 使用方法

### 1. 基本调用

```typescript
// 发送消息到 background script 打开弹窗
chrome.runtime.sendMessage({
  action: 'MUTLIPOST_EXTENSION_CHAIN_ACTION',
  data: {
    action: 'baidu-agiso',
    config: {
      baiduShare: {
        paths: ['我的手抄报', '054'],
        shareConfig: { /* ... */ }
      },
      agisoProduct: {
        title: '商品标题',
        useInfo: '使用说明'
      }
    }
  },
  traceId: `chain-action-${Date.now()}`
});
```

### 2. 使用示例组件

```typescript
import ChainActionExample from '~components/ChainActions/ChainActionExample';

function MyComponent() {
  const handleExecute = (config) => {
    console.log('执行配置:', config);
  };

  return (
    <ChainActionExample onExecute={handleExecute} />
  );
}
```

### 3. 直接使用弹窗组件

```typescript
import ChainAction from '~tabs/chain-action';

function MyPage() {
  return <ChainAction />;
}
```

## 配置格式

### 百度云 + Agiso 配置

```typescript
interface BaiduAgisoConfig {
  baiduShare: {
    paths: string[];           // 百度云路径数组
    shareConfig: ShareConfig;  // 分享配置
  };
  agisoProduct: {
    title: string;             // 商品标题
    useInfo: string;           // 使用说明
  };
}
```

### 分享配置

```typescript
interface ShareConfig {
  validPeriod: string;         // 有效期
  extractCodeType: string;     // 提取码类型
  hideUserInfo: boolean;       // 是否隐藏用户信息
  selection: {
    selectAll: boolean;        // 是否全选
  };
}
```

## 消息通信

### 发送到 Background Script

```typescript
// 打开链式操作弹窗
chrome.runtime.sendMessage({
  action: 'MUTLIPOST_EXTENSION_CHAIN_ACTION',
  data: config,
  traceId: 'unique-trace-id'
});

// 请求配置数据
chrome.runtime.sendMessage({
  action: 'MUTLIPOST_EXTENSION_CHAIN_ACTION_REQUEST_DATA'
}, (response) => {
  console.log('配置数据:', response.config);
});
```

### Background Script 处理

在 `src/background/index.ts` 中已添加以下消息处理：

- `MUTLIPOST_EXTENSION_CHAIN_ACTION`: 创建链式操作弹窗
- `MUTLIPOST_EXTENSION_CHAIN_ACTION_REQUEST_DATA`: 获取配置数据

## 状态管理

### 执行状态

```typescript
interface StepStatus {
  name: string;                    // 步骤名称
  status: 'waiting' | 'running' | 'success' | 'error';  // 状态
  message?: string;                // 状态消息
  result?: any;                    // 执行结果
  error?: string;                  // 错误信息
}
```

### 组件状态

```typescript
interface ChainActionState {
  config: ChainActionConfig | null;  // 配置信息
  steps: StepStatus[];               // 步骤状态
  isExecuting: boolean;              // 是否正在执行
  logs: string[];                    // 执行日志
  result: any;                       // 最终结果
  error: string | null;              // 错误信息
}
```

## 扩展新的链式操作

### 1. 在 `src/chain-actions/index.ts` 中注册

```typescript
export const chainActions: Record<string, ChainActionBase> = {
  'baidu-agiso': {
    name: '百度云分享 + Agiso发布',
    description: '获取百度云分享链接并在Agiso平台发布商品',
    execute: async (config) => {
      const { executeChainAction } = await import('./baidu-agiso/chain-action');
      return executeChainAction(config);
    }
  },
  // 添加新的链式操作
  'your-new-action': {
    name: '你的新操作',
    description: '操作描述',
    execute: async (config) => {
      // 实现你的逻辑
      return { success: true, data: 'result' };
    }
  }
};
```

### 2. 更新步骤初始化

在 `ChainActionModal.tsx` 的 `initializeSteps` 函数中添加：

```typescript
const initializeSteps = (actionName: string) => {
  const steps: StepStatus[] = [];
  
  switch (actionName) {
    case 'baidu-agiso':
      steps.push(
        { name: '百度云分享', status: 'waiting' },
        { name: 'Agiso发布', status: 'waiting' }
      );
      break;
    case 'your-new-action':
      steps.push(
        { name: '步骤1', status: 'waiting' },
        { name: '步骤2', status: 'waiting' }
      );
      break;
    default:
      steps.push({ name: '执行中', status: 'waiting' });
  }

  setState(prev => ({ ...prev, steps }));
};
```

## 样式定制

组件使用 HeroUI 和 Tailwind CSS，可以通过以下方式定制样式：

### 1. 修改主题颜色

```typescript
// 在组件中使用 HeroUI 的主题变量
<Button color="primary" variant="flat">
  按钮
</Button>
```

### 2. 自定义样式类

```typescript
// 使用 Tailwind CSS 类
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
  自定义样式内容
</div>
```

## 错误处理

### 1. 执行错误

- 自动捕获并显示错误信息
- 支持步骤级别的错误状态
- 提供重试功能

### 2. 配置错误

- 验证配置格式
- 显示配置错误提示
- 阻止无效配置的执行

### 3. 网络错误

- 超时处理
- 重连机制
- 用户友好的错误提示

## 最佳实践

### 1. 配置验证

```typescript
const validateConfig = (config: any) => {
  if (!config.action) {
    throw new Error('缺少操作类型');
  }
  if (!config.config) {
    throw new Error('缺少配置数据');
  }
  // 更多验证...
};
```

### 2. 错误处理

```typescript
try {
  const result = await executeChainAction(config);
  // 处理成功结果
} catch (error) {
  // 记录错误日志
  console.error('链式操作执行失败:', error);
  // 显示用户友好的错误信息
  showErrorMessage(error.message);
}
```

### 3. 性能优化

- 使用 React.memo 优化组件渲染
- 避免不必要的状态更新
- 合理使用 useEffect 依赖

## 注意事项

1. **权限要求**: 确保扩展有足够的权限执行相关操作
2. **网络依赖**: 某些操作需要网络连接，需要处理离线情况
3. **用户交互**: 某些步骤可能需要用户手动操作
4. **数据安全**: 注意敏感数据的处理和传输安全
5. **错误恢复**: 提供合理的错误恢复机制

## 更新日志

- **v1.0.0**: 初始版本，支持百度云 + Agiso 链式操作
- 支持配置展示、步骤监控、日志记录、结果展示 