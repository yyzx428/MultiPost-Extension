/**
 * 简化版文件操作测试脚本
 * 在百度网盘页面的浏览器控制台中运行
 */

console.log('🚀 开始测试 MultiPost Extension 文件操作功能...');

// 检查接口是否可用
function checkInterfaces() {
  console.log('📋 检查接口状态:');
  
  const checks = {
    'createBaiduYunShare': !!window.createBaiduYunShare,
    'multipostExtension': !!window.multipostExtension, 
    'multipostExtensionDebug': !!window.multipostExtensionDebug
  };
  
  console.table(checks);
  
  if (window.multipostExtensionDebug) {
    console.log('🔧 调试信息:', window.multipostExtensionDebug.checkStatus());
  }
  
  return Object.values(checks).every(Boolean);
}

// 基础测试 - 分享当前位置
async function testBasicShare() {
  console.log('🔄 开始基础分享测试（当前位置）...');
  
  try {
    const result = await window.createBaiduYunShare([], {
      validPeriod: '7天',
      extractCodeType: '随机生成'
    });
    
    console.log('✅ 基础分享测试成功!');
    console.log('📄 结果:', result);
    return result;
    
  } catch (error) {
    console.error('❌ 基础分享测试失败:', error.message);
    console.error('📄 详细错误:', error);
    return null;
  }
}

// 路径导航测试
async function testPathShare() {
  console.log('🔄 开始路径导航测试...');
  
  // 修改这个路径为你实际的文件夹
  const testPaths = ['我的手抄报', '041'];
  console.log(`📁 测试路径: ${testPaths.join(' -> ')}`);
  
  try {
    const result = await window.createBaiduYunShare(testPaths, {
      validPeriod: '7天',
      extractCodeType: '随机生成'
    });
    
    console.log('✅ 路径导航测试成功!');
    console.log('📄 结果:', result);
    return result;
    
  } catch (error) {
    console.error('❌ 路径导航测试失败:', error.message);
    console.error('📄 详细错误:', error);
    return null;
  }
}

// 通用接口测试
async function testGenericInterface() {
  console.log('🔄 开始通用接口测试...');
  
  try {
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
    
    console.log('✅ 通用接口测试成功!');
    console.log('📄 结果:', result);
    return result;
    
  } catch (error) {
    console.error('❌ 通用接口测试失败:', error.message);
    console.error('📄 详细错误:', error);
    return null;
  }
}

// 主测试函数
async function runTests() {
  console.log('='.repeat(50));
  console.log('🧪 MultiPost Extension 文件操作测试开始');
  console.log('='.repeat(50));
  
  // 1. 检查接口
  const interfacesReady = checkInterfaces();
  if (!interfacesReady) {
    console.error('❌ 接口检查失败，请确保扩展已正确加载');
    return;
  }
  
  console.log('✅ 接口检查通过\n');
  
  // 2. 基础测试
  console.log('-'.repeat(30));
  const basicResult = await testBasicShare();
  console.log('');
  
  // 3. 路径测试  
  console.log('-'.repeat(30));
  const pathResult = await testPathShare();
  console.log('');
  
  // 4. 通用接口测试
  console.log('-'.repeat(30));
  const genericResult = await testGenericInterface();
  console.log('');
  
  // 总结
  console.log('='.repeat(50));
  console.log('📊 测试结果总结');
  console.log('='.repeat(50));
  
  const summary = {
    '接口检查': interfacesReady ? '✅ 通过' : '❌ 失败',
    '基础分享': basicResult ? '✅ 通过' : '❌ 失败', 
    '路径导航': pathResult ? '✅ 通过' : '❌ 失败',
    '通用接口': genericResult ? '✅ 通过' : '❌ 失败'
  };
  
  console.table(summary);
  
  const passCount = Object.values(summary).filter(v => v.includes('✅')).length;
  const totalCount = Object.keys(summary).length;
  
  if (passCount === totalCount) {
    console.log(`🎉 所有测试通过! (${passCount}/${totalCount})`);
  } else {
    console.log(`⚠️ 部分测试通过 (${passCount}/${totalCount})`);
  }
  
  return {
    interfacesReady,
    basicResult,
    pathResult, 
    genericResult,
    summary
  };
}

// 快捷测试方法
window.testFileOps = {
  // 运行全部测试
  runAll: runTests,
  
  // 快速检查
  check: checkInterfaces,
  
  // 快速分享测试
  quickShare: () => testBasicShare(),
  
  // 设置测试路径并测试
  testPath: (paths) => {
    console.log(`🔄 测试路径: ${paths.join(' -> ')}`);
    return window.createBaiduYunShare(paths);
  }
};

console.log('📝 使用方法:');
console.log('  运行全部测试: testFileOps.runAll()');
console.log('  快速检查: testFileOps.check()');
console.log('  快速分享: testFileOps.quickShare()');
console.log('  测试路径: testFileOps.testPath(["文件夹1", "文件夹2"])');
console.log('');

// 检查当前页面
if (location.hostname === 'pan.baidu.com') {
  console.log('✅ 当前在百度网盘页面，可以开始测试!');
  console.log('🎯 运行 testFileOps.runAll() 开始完整测试');
} else {
  console.warn('⚠️ 请在百度网盘页面运行此测试脚本');
}

// 自动运行检查
setTimeout(() => {
  console.log('🔍 自动检查接口状态...');
  checkInterfaces();
}, 1000); 