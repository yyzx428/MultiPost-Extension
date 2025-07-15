// 测试链式操作中的文件操作请求功能
console.log('开始测试链式操作中的文件操作请求...');

// 模拟链式操作配置
const chainActionConfig = {
    baiduShare: {
        paths: ["我的手抄报", "054"],
        shareConfig: {
            validPeriod: "永久有效",
            extractCodeType: "随机生成"
        }
    },
    agisoProduct: {
        title: "测试商品标题",
        useInfo: "这是一个测试商品的使用说明"
    }
};

// 测试文件操作请求
async function testFileOperationRequest() {
    console.log('=== 测试文件操作请求 ===');
    
    try {
        // 模拟发送文件操作请求
        const result = await requestFileOperation({
            paths: chainActionConfig.baiduShare.paths,
            shareConfig: chainActionConfig.baiduShare.shareConfig
        });
        
        console.log('✅ 文件操作请求成功:', result);
        return result;
    } catch (error) {
        console.error('❌ 文件操作请求失败:', error);
        throw error;
    }
}

// 模拟文件操作请求函数
function requestFileOperation(params) {
    return new Promise((resolve, reject) => {
        const requestId = `test-chain-action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('发送文件操作请求:', {
            type: 'request',
            action: 'MUTLIPOST_EXTENSION_FILE_OPERATION',
            traceId: requestId,
            data: {
                platform: 'baiduyun',
                operation: 'share',
                params: params
            }
        });

        // 监听响应
        const responseHandler = (event) => {
            console.log('收到消息:', event.data);
            
            if (event.data.type === 'response' &&
                event.data.traceId === requestId &&
                event.data.action === 'MUTLIPOST_EXTENSION_FILE_OPERATION') {
                
                window.removeEventListener('message', responseHandler);
                console.log('收到文件操作响应:', event.data);
                
                if (event.data.code === 0) {
                    console.log('文件操作成功:', event.data.data);
                    resolve(event.data.data);
                } else {
                    console.error('文件操作失败:', event.data.message);
                    reject(new Error(event.data.message || '操作失败'));
                }
            }
        };

        // 添加消息监听器
        window.addEventListener('message', responseHandler);

        // 发送请求
        window.postMessage({
            type: 'request',
            action: 'MUTLIPOST_EXTENSION_FILE_OPERATION',
            traceId: requestId,
            data: {
                platform: 'baiduyun',
                operation: 'share',
                params: {
                    paths: params.paths,
                    shareConfig: params.shareConfig
                }
            }
        }, '*');

        // 设置超时
        setTimeout(() => {
            window.removeEventListener('message', responseHandler);
            console.error('文件操作请求超时');
            reject(new Error('MUTLIPOST_EXTENSION_FILE_OPERATION 请求超时'));
        }, 60000); // 60秒超时
    });
}

// 测试完整的链式操作流程
async function testFullChainAction() {
    console.log('=== 测试完整链式操作流程 ===');
    
    try {
        // 第1步：获取百度云分享链接
        console.log('第1步：获取百度云分享链接');
        const baiduResult = await testFileOperationRequest();
        
        if (baiduResult && baiduResult.success) {
            console.log('✅ 百度云分享成功:', baiduResult);
            
            // 第2步：模拟Agiso发布
            console.log('第2步：模拟Agiso发布');
            const agisoResult = {
                success: true,
                message: 'Agiso商品发布成功',
                productId: 'test-product-123'
            };
            
            console.log('✅ Agiso发布成功:', agisoResult);
            
            // 构建最终结果
            const finalResult = {
                success: true,
                baiduShareResult: baiduResult,
                agisoPublishResult: agisoResult,
                logs: [
                    '链式操作开始',
                    '百度云分享完成',
                    'Agiso发布完成',
                    '链式操作成功'
                ]
            };
            
            console.log('🎉 完整链式操作成功:', finalResult);
            return finalResult;
        } else {
            throw new Error('百度云分享失败');
        }
    } catch (error) {
        console.error('❌ 链式操作失败:', error);
        throw error;
    }
}

// 执行测试
console.log('开始执行测试...');
testFullChainAction()
    .then(result => {
        console.log('测试完成，结果:', result);
    })
    .catch(error => {
        console.error('测试失败:', error);
    });

console.log('测试脚本已启动，请查看控制台输出...'); 