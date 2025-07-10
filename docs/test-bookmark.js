javascript:(function(){
    // MultiPost Extension 文件操作测试书签
    const script = document.createElement('script');
    script.src = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`
        console.log('🚀 加载 MultiPost Extension 测试工具...');
        
        // 快速测试函数
        window.testMultipostFileOps = async function(paths = []) {
            // 检查扩展
            if (!window.multipostExtension) {
                console.error('❌ MultiPost Extension 未加载');
                return;
            }
            
            console.log('✅ 扩展已加载，开始测试...');
            
            try {
                const result = await window.multipostExtension.fileOperation({
                    platform: 'baiduyun',
                    operation: 'share',
                    params: {
                        paths: paths,
                        shareConfig: {
                            validPeriod: '7天',
                            extractCodeType: '随机生成'
                        }
                    }
                });
                
                if (result.success) {
                    console.log('✅ 测试成功!');
                    console.log('分享链接:', result.data.shareUrl);
                    console.log('提取码:', result.data.extractCode);
                    console.log('详细结果:', result);
                } else {
                    console.log('❌ 测试失败:', result);
                }
                
                return result;
            } catch (error) {
                console.error('❌ 测试异常:', error);
                return null;
            }
        };
        
        // 显示使用说明
        console.log('📋 使用方法:');
        console.log('  基础测试: testMultipostFileOps()');
        console.log('  路径测试: testMultipostFileOps(["文件夹1", "文件夹2"])');
        console.log('  快捷分享: window.createBaiduYunShare(["路径"])');
        
        // 检查当前页面
        if (location.hostname === 'pan.baidu.com') {
            console.log('✅ 当前在百度网盘页面，可以开始测试');
            console.log('🎯 运行 testMultipostFileOps() 开始快速测试');
        } else {
            console.warn('⚠️ 请在百度网盘页面运行测试');
        }
    `);
    
    document.head.appendChild(script);
    
    // 移除脚本标签避免重复
    setTimeout(() => {
        document.head.removeChild(script);
    }, 1000);
})(); 