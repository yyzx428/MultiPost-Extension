# MultiPost Extension - 文件操作API文档

## 概述

MultiPost Extension 提供了强大的文件操作功能，支持自动化的文件管理操作，包括路径导航、分享链接创建、文件下载等。目前主要支持百度网盘平台。

## 功能特性

- 🗂️ **智能路径导航** - 自动导航到指定文件夹路径
- 🔗 **分享链接创建** - 自动创建带提取码的分享链接
- 📊 **操作日志记录** - 详细记录操作过程和结果
- 🔧 **灵活配置选项** - 支持有效期、提取码等多种配置
- 🛡️ **错误处理机制** - 完善的异常处理和重试机制

## 支持平台

| 平台 | 状态 | 支持操作 |
|------|------|----------|
| 百度网盘 | ✅ 已支持 | 导航、分享 |
| 阿里云盘 | 🚧 计划中 | - |
| OneDrive | 🚧 计划中 | - |

## API接口

### 主接口

```typescript
interface MultipostExtension {
  fileOperation(request: FileOperationRequest): Promise<FileOperationResponse>;
}
```

### 请求参数

```typescript
interface FileOperationRequest {
  platform: 'baiduyun' | 'aliyun' | 'onedrive';
  operation: 'share' | 'download' | 'organize' | 'search';
  params: {
    paths: string[];                    // 操作路径
    timeout?: number;                   // 超时时间（毫秒）
    shareConfig?: ShareConfig;          // 分享配置
    downloadConfig?: DownloadConfig;    // 下载配置
    organizeConfig?: OrganizeConfig;    // 整理配置
  };
}
```

### 分享配置

```typescript
interface ShareConfig {
  validPeriod: '1天' | '7天' | '30天' | '365天' | '永久有效';
  extractCodeType: '不设置' | '随机生成' | '自定义';
  customCode?: string;                 // 自定义提取码（4位）
  hideUserInfo?: boolean;              // 是否隐藏用户信息
  selection?: {                        // 文件选择配置
    selectAll?: boolean;               // 选择全部
    selectByName?: string[];           // 按名称选择
    selectByType?: 'files' | 'folders' | 'all';
    selectByPattern?: string;          // 正则模式选择
  };
}
```

### 响应结果

```typescript
interface FileOperationResponse {
  success: boolean;                    // 操作是否成功
  operation: string;                   // 操作类型
  platform: string;                   // 平台名称
  executionTime: number;               // 执行耗时（毫秒）
  data: any;                          // 操作结果数据
  logs: OperationLog[];               // 操作日志
}
```

### 分享结果数据

```typescript
interface ShareResult {
  shareUrl: string;                    // 分享链接
  extractCode?: string;                // 提取码
  shortUrl?: string;                   // 短链接
  validUntil: string;                  // 有效期
  createdAt: string;                   // 创建时间
  sharedFiles: FileItem[];             // 分享的文件列表
}
```

## 使用示例

### 基础用法

```javascript
// 创建百度云分享
const result = await window.multipostExtension.fileOperation({
  platform: 'baiduyun',
  operation: 'share',
  params: {
    paths: ['我的手抄报', '041'],      // 导航到: 我的手抄报/041
    shareConfig: {
      validPeriod: '7天',
      extractCodeType: '随机生成'
    }
  }
});

console.log('分享链接:', result.data.shareUrl);
console.log('提取码:', result.data.extractCode);
```

### 便捷方法

```javascript
// 使用便捷方法创建分享
const result = await window.createBaiduYunShare(
  ['我的手抄报', '041'],
  {
    validPeriod: '30天',
    extractCodeType: '自定义',
    customCode: 'abc1'
  }
);
```

### 高级配置

```javascript
// 选择性分享特定文件
const result = await window.multipostExtension.fileOperation({
  platform: 'baiduyun',
  operation: 'share',
  params: {
    paths: ['项目文件'],
    shareConfig: {
      validPeriod: '365天',
      extractCodeType: '不设置',
      hideUserInfo: true,
      selection: {
        selectByName: ['重要文档.pdf', '演示文稿.pptx'],
        selectByType: 'files'
      }
    }
  }
});
```

### 错误处理

```javascript
try {
  const result = await window.multipostExtension.fileOperation({
    platform: 'baiduyun',
    operation: 'share',
    params: {
      paths: ['不存在的文件夹'],
      timeout: 15000,  // 15秒超时
      shareConfig: {
        validPeriod: '7天',
        extractCodeType: '随机生成'
      }
    }
  });
  
  if (result.success) {
    console.log('操作成功:', result.data);
  } else {
    console.error('操作失败:', result.logs);
  }
  
} catch (error) {
  console.error('请求失败:', error.message);
}
```

## 事件监听

### 扩展就绪事件

```javascript
window.addEventListener('multipostExtensionReady', (event) => {
  console.log('扩展版本:', event.detail.version);
  console.log('支持功能:', event.detail.features);
  console.log('支持平台:', event.detail.supportedPlatforms);
});
```

## 开发和调试

### 检查扩展状态

```javascript
// 检查扩展是否可用
if (window.multipostExtension) {
  console.log('扩展已就绪');
} else {
  console.log('扩展未安装或未启用');
}
```

### 开发调试工具

在开发环境下，扩展提供了额外的调试工具：

```javascript
// 检查当前状态
window.multipostExtensionDebug.checkStatus();

// 检测当前平台
window.multipostExtensionDebug.detectPlatform();

// 快速测试分享功能
window.multipostExtensionDebug.testShare(['测试文件夹']);
```

## 最佳实践

### 1. 路径导航

- 使用精确的文件夹名称
- 避免使用特殊字符
- 确保路径存在且可访问

```javascript
// ✅ 推荐：清晰的路径结构
paths: ['工作文档', '2024年', '项目资料']

// ❌ 避免：含特殊字符的路径
paths: ['工作文档@#$', '2024/12', '项目?资料']
```

### 2. 超时设置

根据操作复杂度设置合理的超时时间：

```javascript
// 简单操作：10-15秒
timeout: 15000

// 复杂操作（大量文件）：30-60秒
timeout: 60000
```

### 3. 错误重试

对于网络不稳定的情况，实现重试机制：

```javascript
async function createShareWithRetry(paths, config, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await window.createBaiduYunShare(paths, config);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}
```

### 4. 批量操作

对于大量操作，使用适当的延时避免频繁调用：

```javascript
async function batchCreateShares(pathGroups) {
  const results = [];
  for (const paths of pathGroups) {
    try {
      const result = await window.createBaiduYunShare(paths);
      results.push(result);
      // 操作间隔，避免过于频繁
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`路径 ${paths.join('/')} 分享失败:`, error);
    }
  }
  return results;
}
```

## 常见问题

### Q: 为什么扩展接口不可用？

A: 请检查以下项目：
1. 确保已安装 MultiPost Extension
2. 确保扩展已启用
3. 刷新页面重新加载扩展
4. 检查浏览器控制台是否有错误信息

### Q: 路径导航失败怎么办？

A: 路径导航失败的常见原因：
1. 文件夹名称不匹配（注意大小写和空格）
2. 文件夹不存在或已被移动
3. 网络连接不稳定
4. 页面加载未完成

### Q: 分享创建失败的原因？

A: 可能的原因包括：
1. 未选择任何文件或文件夹
2. 账号权限不足
3. 网络连接问题
4. 百度网盘系统限制

### Q: 如何调试操作过程？

A: 使用以下方法调试：
1. 查看返回结果中的 `logs` 字段
2. 使用浏览器开发者工具查看控制台
3. 使用开发调试工具 `window.multipostExtensionDebug`

## 更新日志

### v1.0.0
- ✨ 新增百度网盘分享功能
- ✨ 新增智能路径导航
- ✨ 新增操作日志记录
- ✨ 新增开发调试工具

## 技术支持

如遇到问题或需要技术支持，请：

1. 查看浏览器控制台错误信息
2. 检查操作日志中的详细信息
3. 确认当前页面是否为支持的平台
4. 联系开发团队获取帮助

---

*本文档会随着功能更新持续完善，建议收藏以便随时查阅。* 