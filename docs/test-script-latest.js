// MultiPost Extension 文件操作测试脚本 - 最新版本
// 使用方法：将此脚本复制到百度网盘页面的控制台中运行

(function() {
    console.log('🚀 加载 MultiPost Extension 文件操作测试脚本...');
    
    // 测试工具对象
    window.testFileOps = {
        lastResult: null,
        
        // 检查接口状态
        check() {
            console.log('🔍 检查接口状态...');
            const status = {
                createBaiduYunShare: typeof window.createBaiduYunShare === 'function',
                multipostExtension: typeof window.multipostExtension === 'object',
                multipostExtensionDebug: typeof window.multipostExtensionDebug === 'object'
            };
            console.table(status);
            
            if (window.multipostExtensionDebug) {
                console.log('🔧 调试信息:', window.multipostExtensionDebug);
            }
            
            return status;
        },
        
        // 快速分享测试（当前目录）
        async quickShare() {
            console.log('🔄 开始基础分享测试（当前位置）...');
            try {
                const result = await window.createBaiduYunShare();
                this.lastResult = result;
                console.log('✅ 基础分享测试成功!');
                console.log('📄 结果:', result);
                return result;
            } catch (error) {
                console.error('❌ 基础分享测试失败:', error);
                this.lastResult = { success: false, error: error.message };
                return this.lastResult;
            }
        },
        
        // 路径导航测试
        async testPath(paths = ['测试文件夹']) {
            console.log('🔄 开始路径导航测试...');
            console.log('🎯 目标路径:', paths);
            try {
                const result = await window.createBaiduYunShare(paths);
                this.lastResult = result;
                console.log('✅ 路径导航测试成功!');
                console.log('📄 结果:', result);
                return result;
            } catch (error) {
                console.error('❌ 路径导航测试失败:', error);
                this.lastResult = { success: false, error: error.message };
                return this.lastResult;
            }
        },
        
        // 通用接口测试
        async testGeneric() {
            console.log('🔄 开始通用接口测试...');
            try {
                const request = {
                    operation: 'share',
                    platform: 'baiduyun',
                    config: {
                        validDays: 7,
                        extractCodeType: 'random'
                    }
                };
                
                const result = await window.multipostExtension.fileOperation(request);
                this.lastResult = result;
                console.log('✅ 通用接口测试成功!');
                console.log('📄 结果:', result);
                return result;
            } catch (error) {
                console.error('❌ 通用接口测试失败:', error);
                this.lastResult = { success: false, error: error.message };
                return this.lastResult;
            }
        },
        
        // 完整测试套件
        async runAll() {
            console.log('🚀 开始完整测试套件...');
            const results = {
                接口检查: '❌ 失败',
                基础分享: '❌ 失败', 
                路径导航: '❌ 失败',
                通用接口: '❌ 失败'
            };
            
            let successCount = 0;
            const totalTests = Object.keys(results).length;
            
            try {
                // 1. 接口检查
                console.log('\n=== 1. 接口状态检查 ===');
                const status = this.check();
                if (status.createBaiduYunShare && status.multipostExtension) {
                    results.接口检查 = '✅ 通过';
                    successCount++;
                }
                
                // 2. 基础分享测试
                console.log('\n=== 2. 基础分享测试 ===');
                const quickResult = await this.quickShare();
                if (quickResult && quickResult.success) {
                    results.基础分享 = '✅ 通过';
                    successCount++;
                }
                
                // 3. 路径导航测试
                console.log('\n=== 3. 路径导航测试 ===');
                const pathResult = await this.testPath(['我的手抄报']);
                if (pathResult && pathResult.success) {
                    results.路径导航 = '✅ 通过';
                    successCount++;
                }
                
                // 4. 通用接口测试
                console.log('\n=== 4. 通用接口测试 ===');
                const genericResult = await this.testGeneric();
                if (genericResult && genericResult.success) {
                    results.通用接口 = '✅ 通过';
                    successCount++;
                }
                
            } catch (error) {
                console.error('❌ 测试过程中发生错误:', error);
            }
            
            // 显示测试结果
            console.log('\n\n==================================================');
            console.log('📊 测试结果总结');
            console.log('==================================================');
            console.table(results);
            
            if (successCount === totalTests) {
                console.log('🎉 所有测试通过!');
            } else if (successCount > 0) {
                console.log(`⚠️ 部分测试通过 (${successCount}/${totalTests})`);
            } else {
                console.log('❌ 所有测试失败');
            }
            
            return results;
        },
        
        // 查看详细日志
        showLogs() {
            if (this.lastResult && this.lastResult.logs) {
                console.log('📋 详细操作日志:');
                this.lastResult.logs.forEach((log, index) => {
                    console.log(`${index + 1}. [${log.timestamp}] ${log.level}: ${log.message}`);
                    if (log.details) {
                        console.log('   详情:', log.details);
                    }
                });
            } else {
                console.log('❌ 没有可用的日志记录');
            }
        },
        
        // 诊断工具
        diagnose() {
            console.log('🔍 开始系统诊断...');
            
            // 检查页面状态
            console.log('1. 页面信息:');
            console.log('   URL:', location.href);
            console.log('   标题:', document.title);
            console.log('   加载状态:', document.readyState);
            
            // 检查关键元素
            console.log('2. 关键元素检查:');
            const elements = {
                '分享按钮(旧)': document.querySelector('[data-button-id="b5"]'),
                '分享按钮(新)': document.querySelector('button[title*="分享"]'),
                '复制链接按钮': document.querySelector('button.wp-share-file__link-create-ubtn:not(.qrcode)'),
                '文件列表': document.querySelector('.file-list-body'),
                '面包屑导航': document.querySelector('.pan-bread-crumbs-wrapper')
            };
            
            Object.entries(elements).forEach(([name, element]) => {
                console.log(`   ${name}:`, element ? '✅ 存在' : '❌ 不存在');
            });
            
            // 检查扩展接口
            console.log('3. 扩展接口检查:');
            console.log('   createBaiduYunShare:', typeof window.createBaiduYunShare);
            console.log('   multipostExtension:', typeof window.multipostExtension);
            console.log('   multipostExtensionDebug:', typeof window.multipostExtensionDebug);
            
            // 检查网络状态
            console.log('4. 网络状态:');
            console.log('   在线状态:', navigator.onLine);
            console.log('   用户代理:', navigator.userAgent.substring(0, 100) + '...');
        }
    };
    
    // 自动检查当前环境
    if (location.hostname.includes('pan.baidu.com')) {
        console.log('✅ 当前在百度网盘页面，可以开始测试!');
        console.log('🎯 运行 testFileOps.runAll() 开始完整测试');
        
        // 自动检查接口状态
        setTimeout(() => {
            console.log('🔍 自动检查接口状态...');
            window.testFileOps.check();
        }, 1000);
    } else {
        console.log('⚠️ 请在百度网盘页面运行此测试脚本');
    }
    
    // 显示使用说明
    console.log('📝 使用方法:');
    console.log('  运行全部测试: testFileOps.runAll()');
    console.log('  快速检查: testFileOps.check()');
    console.log('  快速分享: testFileOps.quickShare()');
    console.log('  测试路径: testFileOps.testPath(["文件夹1", "文件夹2"])');
    console.log('  查看日志: testFileOps.showLogs()');
    console.log('  系统诊断: testFileOps.diagnose()');
    console.log('');
    
})(); 