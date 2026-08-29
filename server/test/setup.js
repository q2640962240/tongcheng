/**
 * Jest 测试全局设置
 * - 隔离测试数据目录（避免污染开发数据）
 * - 加载环境变量
 */
const path = require('path')
const fs = require('fs')

// 测试专用数据目录
const TEST_DATA_DIR = path.join(__dirname, '..', 'data-test')

// 清空并重建测试数据目录
// 注意：Windows 下并行 worker 会出现 EPERM 竞争，重试最多 5 次
function tryResetTestDir(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
      }
      if (!fs.existsSync(TEST_DATA_DIR)) {
        fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
      }
      return
    } catch (e) {
      if (i === retries - 1) throw e
      const wait = 100 * (2 ** i)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait)
    }
  }
}
tryResetTestDir()

// 设置环境变量（必须在 require app 之前）
process.env.NODE_ENV = 'test'
process.env.DB_DRIVER = 'json'
process.env.DATA_DIR = TEST_DATA_DIR
process.env.PORT = '3010'  // 避免和开发端口冲突
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret'
process.env.RATE_LIMIT_ENABLED = 'false'  // 禁用限流（测试环境）
