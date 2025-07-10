/**
 * MultiPost Extension - 文件操作快速测试脚本
 * 在百度网盘页面的浏览器控制台中运行此脚本
 */

(function() {
    'use strict';
    
    console.log('🚀 MultiPost Extension 文件操作测试开始...');
    
    // 测试配置
    const TEST_CONFIG = {
        timeout: 30000, // 30秒超时
        testPaths: ['我的手抄报', '041'], // 根据实际情况修改
        fallbackPaths: ['测试文件夹'], // 备用测试路径
    };
    
    // 工具函数
    const utils = {
        log: (message, type = 'info') => {
            const emoji = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
            console.log(`${emoji[type]} ${message}`);
        },
        
        wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        
        formatTime: (ms) => `${(ms / 1000).toFixed(2)}s`,
        
        formatResult: (result) => {
            if (!result) return 'undefined';
            return JSON.stringify(result, null, 2);
        }
    };
    
    // 检查扩展状态
    async function checkExtensionStatus() {
        utils.log('检查扩展状态...');
        
        // 检查基础接口
        if (!window.multipostExtension) {
            utils.log('❌ multipostExtension 接口不可用', 'error');
            return false;
        }
        
        // 检查便捷方法
        if (!window.createBaiduYunShare) {
            utils.log('⚠️ createBaiduYunShare 便捷方法不可用', 'warning');
        }
        
        // 检查调试工具
        if (window.multipostExtensionDebug) {
            utils.log('🔧 开发调试工具可用');
            const status = window.multipostExtensionDebug.checkStatus();
            console.log('调试状态:', status);
        }
        
        utils.log('扩展接口检查通过', 'success');
        return true;
    }
    
    // 基础分享测试（当前位置）
    async function testBasicShare() {
        utils.log('开始基础分享测试（当前位置）...');
        
        try {
            const startTime = Date.now();
            const result = await window.multipostExtension.fileOperation({
                platform: 'baiduyun',
                operation: 'share',
                params: {
                    paths: [], // 空路径表示当前位置
                    timeout: TEST_CONFIG.timeout,
                    shareConfig: {
                        validPeriod: '7天',
                        extractCodeType: '随机生成'
                    }
                }
            });
            
            const duration = Date.now() - startTime;
            
            if (result.success) {
                utils.log(`基础分享测试成功 (${utils.formatTime(duration)})`, 'success');
                console.log('分享链接:', result.data.shareUrl);
                console.log('提取码:', result.data.extractCode);
                console.log('详细结果:', result);
            } else {
                utils.log('基础分享测试失败', 'error');
                console.log('错误信息:', result);
            }
            
            return result;
            
        } catch (error) {
            utils.log(`基础分享测试异常: ${error.message}`, 'error');
            console.error('详细错误:', error);
            return null;
        }
    }
    
    // 路径导航测试
    async function testNavigationShare() {
        utils.log('开始路径导航分享测试...');
        
        const testPaths = TEST_CONFIG.testPaths;
        utils.log(`测试路径: ${testPaths.join(' -> ')}`);
        
        try {
            const startTime = Date.now();
            const result = await window.createBaiduYunShare(testPaths, {
                validPeriod: '7天',
                extractCodeType: '随机生成'
            });
            
            const duration = Date.now() - startTime;
            
            if (result.success) {
                utils.log(`路径导航测试成功 (${utils.formatTime(duration)})`, 'success');
                console.log('分享链接:', result.data.shareUrl);
                console.log('提取码:', result.data.extractCode);
                console.log('详细结果:', result);
            } else {
                utils.log('路径导航测试失败', 'error');
                console.log('错误信息:', result);
            }
            
            return result;
            
        } catch (error) {
            utils.log(`路径导航测试异常: ${error.message}`, 'error');
            console.error('详细错误:', error);
            
            // 尝试备用路径
            if (TEST_CONFIG.fallbackPaths && TEST_CONFIG.fallbackPaths.length > 0) {
                utils.log('尝试备用路径测试...', 'warning');
                return await testFallbackPaths();
            }
            
            return null;
        }
    }
    
    // 备用路径测试
    async function testFallbackPaths() {
        const fallbackPaths = TEST_CONFIG.fallbackPaths;
        utils.log(`备用路径: ${fallbackPaths.join(' -> ')}`);
        
        try {
            const result = await window.createBaiduYunShare(fallbackPaths, {
                validPeriod: '7天',
                extractCodeType: '随机生成'
            });
            
            if (result.success) {
                utils.log('备用路径测试成功', 'success');
                console.log('详细结果:', result);
            } else {
                utils.log('备用路径测试失败', 'error');
                console.log('错误信息:', result);
            }
            
            return result;
            
        } catch (error) {
            utils.log(`备用路径测试异常: ${error.message}`, 'error');
            return null;
        }
    }
    
    // 高级配置测试
    async function testAdvancedConfig() {
        utils.log('开始高级配置测试...');
        
        try {
            const result = await window.multipostExtension.fileOperation({
                platform: 'baiduyun',
                operation: 'share',
                params: {
                    paths: [],
                    timeout: TEST_CONFIG.timeout,
                    shareConfig: {
                        validPeriod: '30天',
                        extractCodeType: '自定义',
                        customCode: 'test',
                        selection: {
                            selectAll: true
                        }
                    }
                }
            });
            
            if (result.success) {
                utils.log('高级配置测试成功', 'success');
                console.log('自定义提取码:', result.data.extractCode);
                console.log('详细结果:', result);
            } else {
                utils.log('高级配置测试失败', 'error');
                console.log('错误信息:', result);
            }
            
            return result;
            
        } catch (error) {
            utils.log(`高级配置测试异常: ${error.message}`, 'error');
            return null;
        }
    }
    
    // 性能测试
    async function testPerformance() {
        utils.log('开始性能测试...');
        
        const tests = [];
        const testCount = 3;
        
        for (let i = 0; i < testCount; i++) {
            utils.log(`执行第 ${i + 1}/${testCount} 次性能测试...`);
            
            try {
                const startTime = Date.now();
                const result = await window.multipostExtension.fileOperation({
                    platform: 'baiduyun',
                    operation: 'share',
                    params: {
                        paths: [],
                        shareConfig: {
                            validPeriod: '7天',
                            extractCodeType: '随机生成'
                        }
                    }
                });
                
                const duration = Date.now() - startTime;
                tests.push({
                    index: i + 1,
                    duration,
                    success: result.success,
                    executionTime: result.executionTime
                });
                
                utils.log(`第 ${i + 1} 次测试完成: ${utils.formatTime(duration)}`);
                
                // 测试间隔
                if (i < testCount - 1) {
                    await utils.wait(2000);
                }
                
            } catch (error) {
                utils.log(`第 ${i + 1} 次测试失败: ${error.message}`, 'error');
                tests.push({
                    index: i + 1,
                    duration: -1,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // 统计结果
        const successTests = tests.filter(t => t.success);
        if (successTests.length > 0) {
            const avgDuration = successTests.reduce((sum, t) => sum + t.duration, 0) / successTests.length;
            const avgExecutionTime = successTests.reduce((sum, t) => sum + t.executionTime, 0) / successTests.length;
            
            utils.log(`性能测试完成: ${successTests.length}/${testCount} 成功`, 'success');
            console.log(`平均总耗时: ${utils.formatTime(avgDuration)}`);
            console.log(`平均执行时间: ${utils.formatTime(avgExecutionTime)}`);
            console.log('详细结果:', tests);
        } else {
            utils.log('性能测试全部失败', 'error');
        }
        
        return tests;
    }
    
    // 主测试流程
    async function runAllTests() {
        console.log('='.repeat(50));
        console.log('🧪 MultiPost Extension 文件操作全面测试');
        console.log('='.repeat(50));
        
        const results = {
            extensionStatus: false,
            basicShare: null,
            navigationShare: null,
            advancedConfig: null,
            performance: null
        };
        
        try {
            // 1. 检查扩展状态
            results.extensionStatus = await checkExtensionStatus();
            if (!results.extensionStatus) {
                utils.log('扩展状态检查失败，终止测试', 'error');
                return results;
            }
            
            await utils.wait(1000);
            
            // 2. 基础分享测试
            console.log('\n' + '-'.repeat(30));
            results.basicShare = await testBasicShare();
            await utils.wait(2000);
            
            // 3. 路径导航测试
            console.log('\n' + '-'.repeat(30));
            results.navigationShare = await testNavigationShare();
            await utils.wait(2000);
            
            // 4. 高级配置测试
            console.log('\n' + '-'.repeat(30));
            results.advancedConfig = await testAdvancedConfig();
            await utils.wait(2000);
            
            // 5. 性能测试
            console.log('\n' + '-'.repeat(30));
            results.performance = await testPerformance();
            
        } catch (error) {
            utils.log(`测试流程异常: ${error.message}`, 'error');
            console.error('详细错误:', error);
        }
        
        // 总结
        console.log('\n' + '='.repeat(50));
        console.log('📊 测试结果总结');
        console.log('='.repeat(50));
        
        const summary = {
            extensionStatus: results.extensionStatus ? '✅ 通过' : '❌ 失败',
            basicShare: results.basicShare?.success ? '✅ 通过' : '❌ 失败',
            navigationShare: results.navigationShare?.success ? '✅ 通过' : '❌ 失败',
            advancedConfig: results.advancedConfig?.success ? '✅ 通过' : '❌ 失败',
            performance: results.performance ? '✅ 完成' : '❌ 失败'
        };
        
        console.table(summary);
        
        // 总体评估
        const passedTests = Object.values(summary).filter(status => status.includes('✅')).length;
        const totalTests = Object.keys(summary).length;
        
        if (passedTests === totalTests) {
            utils.log(`🎉 所有测试通过！(${passedTests}/${totalTests})`, 'success');
        } else if (passedTests > 0) {
            utils.log(`⚠️ 部分测试通过 (${passedTests}/${totalTests})`, 'warning');
        } else {
            utils.log(`❌ 所有测试失败 (${passedTests}/${totalTests})`, 'error');
        }
        
        return results;
    }
    
    // 导出测试函数到全局
    window.multipostFileOpTest = {
        runAllTests,
        checkExtensionStatus,
        testBasicShare,
        testNavigationShare,
        testAdvancedConfig,
        testPerformance,
        
        // 手动配置测试路径
        setTestPaths: (paths) => {
            TEST_CONFIG.testPaths = paths;
            utils.log(`测试路径已更新为: ${paths.join(' -> ')}`);
        },
        
        // 显示当前配置
        showConfig: () => {
            console.log('当前测试配置:', TEST_CONFIG);
        }
    };
    
    utils.log('测试脚本加载完成！');
    console.log('📝 使用方法:');
    console.log('  运行全部测试: multipostFileOpTest.runAllTests()');
    console.log('  设置测试路径: multipostFileOpTest.setTestPaths(["文件夹1", "文件夹2"])');
    console.log('  查看配置: multipostFileOpTest.showConfig()');
    console.log('  单独测试: multipostFileOpTest.testBasicShare()');
    
    // 自动运行测试（可选）
    const autoRun = confirm('是否立即运行全部测试？');
    if (autoRun) {
        runAllTests();
    }
    
})(); 