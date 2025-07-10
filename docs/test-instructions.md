# 文件操作功能测试说明

## 🚀 测试步骤

### 第一步：加载扩展
1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启 "开发者模式"
4. 点击 "加载已解压的扩展程序"
5. 选择项目目录下的 `build/chrome-mv3-dev` 文件夹
6. 确认扩展已成功加载（应该显示绿色的开启状态）

### 第二步：准备测试环境
1. 登录百度网盘：https://pan.baidu.com/
2. 准备测试文件夹结构，例如：
   ```
   我的文档/
   ├── 测试文件夹/
   │   ├── 文档1.txt
   │   └── 文档2.pdf
   └── 项目资料/
       └── 重要文件.docx
   ```

### 第三步：基础功能测试

#### 方法1：使用测试页面（推荐）
1. 在百度网盘页面打开浏览器控制台（F12）
2. 将测试页面HTML代码复制到控制台并执行：
   ```javascript
   // 复制 docs/file-operation-test.html 的内容
   // 或者直接在页面创建书签运行测试页面
   ```

#### 方法2：直接在控制台测试
1. 在百度网盘页面打开控制台（F12）
2. 检查扩展是否正确加载：
   ```javascript
   // 检查扩展接口
   console.log('扩展接口:', window.multipostExtension);
   console.log('便捷方法:', window.createBaiduYunShare);
   
   // 检查调试工具（开发环境）
   if (window.multipostExtensionDebug) {
     console.log('调试工具:', window.multipostExtensionDebug.checkStatus());
   }
   ```

3. 测试基础分享功能：
   ```javascript
   // 基础测试 - 分享当前文件夹
   const testBasicShare = async () => {
     try {
       const result = await window.multipostExtension.fileOperation({
         platform: 'baiduyun',
         operation: 'share',
         params: {
           paths: [], // 空路径表示分享当前位置
           shareConfig: {
             validPeriod: '7天',
             extractCodeType: '随机生成'
           }
         }
       });
       console.log('✅ 基础分享测试成功:', result);
       return result;
     } catch (error) {
       console.error('❌ 基础分享测试失败:', error);
       throw error;
     }
   };
   
   // 执行测试
   testBasicShare();
   ```

4. 测试路径导航功能：
   ```javascript
   // 路径导航测试
   const testNavigationShare = async () => {
     try {
       const result = await window.createBaiduYunShare(
         ['我的文档', '测试文件夹'], // 根据实际文件夹调整
         {
           validPeriod: '7天',
           extractCodeType: '随机生成'
         }
       );
       console.log('✅ 导航分享测试成功:', result);
       return result;
     } catch (error) {
       console.error('❌ 导航分享测试失败:', error);
       throw error;
     }
   };
   
   // 执行测试
   testNavigationShare();
   ```

### 第四步：高级功能测试

#### 测试不同配置选项
```javascript
// 测试自定义提取码
const testCustomCode = async () => {
  const result = await window.multipostExtension.fileOperation({
    platform: 'baiduyun',
    operation: 'share',
    params: {
      paths: ['我的文档'],
      shareConfig: {
        validPeriod: '30天',
        extractCodeType: '自定义',
        customCode: 'test'
      }
    }
  });
  console.log('自定义提取码测试:', result);
};

// 测试文件选择
const testFileSelection = async () => {
  const result = await window.multipostExtension.fileOperation({
    platform: 'baiduyun',
    operation: 'share',
    params: {
      paths: ['我的文档'],
      shareConfig: {
        validPeriod: '7天',
        extractCodeType: '随机生成',
        selection: {
          selectByType: 'files' // 只选择文件，不选择文件夹
        }
      }
    }
  });
  console.log('文件选择测试:', result);
};

// 执行高级测试
testCustomCode();
testFileSelection();
```

## 📊 预期结果

### 成功的测试结果应该包含：

1. **操作成功标识**：`result.success === true`
2. **分享链接**：`result.data.shareUrl` - 类似 `https://pan.baidu.com/s/xxxxxxx`
3. **提取码**：`result.data.extractCode` - 4位字符（如果设置了）
4. **操作日志**：`result.logs` - 详细的操作步骤记录
5. **执行时间**：`result.executionTime` - 操作耗时（毫秒）

### 示例成功结果：
```json
{
  "success": true,
  "operation": "share",
  "platform": "baiduyun",
  "executionTime": 8450,
  "data": {
    "shareUrl": "https://pan.baidu.com/s/1abc123def456",
    "extractCode": "x8y2",
    "validUntil": "7天",
    "createdAt": "2025-01-11T08:30:00.000Z",
    "sharedFiles": [
      {
        "name": "文档1.txt",
        "type": "file",
        "size": 1024,
        "path": "我的文档/测试文件夹/文档1.txt"
      }
    ]
  },
  "logs": [
    {
      "timestamp": 1641891000000,
      "level": "info",
      "message": "开始导航到路径: 我的文档 -> 测试文件夹"
    },
    {
      "timestamp": 1641891005000,
      "level": "info",
      "message": "导航成功，耗时: 3200ms，找到 2 个文件"
    },
    {
      "timestamp": 1641891008000,
      "level": "info",
      "message": "分享创建成功，链接: https://pan.baidu.com/s/1abc123def456"
    }
  ]
}
```

## 🐛 故障排除

### 常见问题及解决方案：

#### 1. 扩展接口不可用
- **现象**：`window.multipostExtension` 为 `undefined`
- **解决**：
  - 确认扩展已正确加载
  - 刷新百度网盘页面
  - 检查控制台是否有错误信息

#### 2. 路径导航失败
- **现象**：返回 `success: false` 且日志显示找不到文件夹
- **解决**：
  - 检查文件夹名称是否正确（注意大小写和空格）
  - 确认文件夹确实存在
  - 尝试手动点击文件夹确认可访问

#### 3. 分享按钮找不到
- **现象**：日志显示"找不到分享按钮"
- **解决**：
  - 确认至少选择了一个文件或文件夹
  - 检查页面是否完全加载
  - 尝试手动点击分享按钮确认页面状态

#### 4. 操作超时
- **现象**：操作时间过长导致超时
- **解决**：
  - 增加超时时间：`timeout: 30000`
  - 检查网络连接
  - 简化操作路径

## 🔧 调试技巧

### 开发环境调试工具：
```javascript
// 检查扩展状态
window.multipostExtensionDebug.checkStatus();

// 检测当前平台
window.multipostExtensionDebug.detectPlatform();

// 快速测试分享
window.multipostExtensionDebug.testShare(['测试文件夹']);
```

### 详细日志查看：
```javascript
// 执行操作后查看详细日志
const result = await window.createBaiduYunShare(['测试路径']);
result.logs.forEach(log => {
  console.log(`[${new Date(log.timestamp).toLocaleTimeString()}] ${log.level.toUpperCase()}: ${log.message}`);
});
```

## ✅ 测试清单

- [ ] 扩展成功加载到浏览器
- [ ] 百度网盘页面正常登录
- [ ] 扩展接口可用（`window.multipostExtension` 存在）
- [ ] 基础分享功能正常（当前位置分享）
- [ ] 路径导航功能正常（指定路径分享）
- [ ] 不同配置选项测试通过
- [ ] 错误处理机制正常工作
- [ ] 操作日志记录完整
- [ ] 性能表现符合预期（操作时间 < 30秒）

完成以上测试后，文件操作系统就可以正式使用了！🎉 