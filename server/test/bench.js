/**
 * 压测脚本 — 使用 Node 内置 http 模块，无需额外依赖
 *
 * 用法：
 *   node test/bench.js [duration] [concurrency]
 *   node test/bench.js 10 50  // 10 秒，50 并发
 *
 * 测试场景：
 *   1. 健康检查（GET /api/health）
 *   2. 服务列表（GET /api/services）
 *   3. 发送验证码（POST /api/auth/sms）
 */
const http = require('http')

const BASE = { host: 'localhost', port: 3000 }
const DURATION = Number(process.argv[2]) || 10  // 秒
const CONCURRENCY = Number(process.argv[3]) || 50

function req(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : ''
    const r = http.request({
      ...BASE,
      path: '/api' + path,
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', () => resolve({ status: res.statusCode, ok: res.statusCode < 400 }))
    })
    r.on('error', () => resolve({ status: 0, ok: false }))
    if (data) r.write(data)
    r.end()
  })
}

const scenarios = [
  { name: '健康检查', method: 'GET', path: '/health', body: null },
  { name: '服务列表', method: 'GET', path: '/services?page=1&pageSize=10', body: null },
  { name: '发送验证码', method: 'POST', path: '/auth/sms', body: { phone: '13900001234' } }
]

async function runScenario(scenario) {
  return new Promise((resolve) => {
    let sent = 0
    let done = 0
    let ok = 0
    let fail = 0
    const latencies = []
    const endTime = Date.now() + DURATION * 1000

    function sendOne() {
      if (Date.now() >= endTime) return
      sent++
      const start = Date.now()
      req(scenario.method, scenario.path, scenario.body).then((r) => {
        latencies.push(Date.now() - start)
        done++
        if (r.ok) ok++
        else fail++
        if (Date.now() < endTime) sendOne()
        else if (done >= sent) resolve()
      })
    }

    for (let i = 0; i < CONCURRENCY; i++) sendOne()
    setTimeout(resolve, (DURATION + 5) * 1000)  // 超时兜底
  }).then(() => {
    latencies.sort((a, b) => a - b)
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0
    const rps = (ok + fail) / DURATION
    console.log(`\n[${scenario.name}] ${DURATION}s / ${CONCURRENCY}并发`)
    console.log(`  总请求: ${ok + fail} | 成功: ${ok} | 失败: ${fail}`)
    console.log(`  QPS: ${rps.toFixed(1)} | 错误率: ${((fail / (ok + fail)) * 100).toFixed(1)}%`)
    console.log(`  延迟 P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`)
  })
}

;(async () => {
  console.log('========================================')
  console.log(`  压测开始 | 时长: ${DURATION}s | 并发: ${CONCURRENCY}`)
  console.log('========================================')

  // 健康检查
  const health = await req('GET', '/health')
  if (!health.ok) {
    console.error('服务未启动，请先运行 npm start')
    process.exit(1)
  }

  for (const s of scenarios) {
    await runScenario(s)
  }

  console.log('\n========================================')
  console.log('  压测完成')
  console.log('========================================')
})()
