/** 冒烟测试脚本（NODE_ENV 任意环境均可运行）
 *  验证：
 *   - 健康检查
 *   - /api/auth/sms + /api/auth/send-code 两个路由都存在
 *   - 短信/支付/OSS/推送 等 6 模块空配置统一 400 中文报错
 *   - 定位 reverse/guess-by-ip 降级不崩溃
 *   - regions tree 34 省 / ≥382 市
 *   - 服务搜索 LOL 同义词扩展生效
 */
const axios = require('axios')
const BASE = 'http://localhost:3000'

function pad(s, n) { return String(s).padEnd(n, ' ') }
const R = []
;(async () => {
  // 1. 健康检查
  const h = await axios.get(BASE + '/api/health').catch(e => e.response || e)
  R.push(`[${h.status === 200 ? 'PASS' : 'FAIL'}] GET /api/health -> ${h.status}`)

  // 2. send-code 新路由 + sms 路由
  for (const path of ['/api/auth/send-code', '/api/auth/sms']) {
    const s = await axios.post(BASE + path, { phone: '13800001111' }).catch(e => e.response || e)
    const not404 = s.status !== 404
    // 生产空短信配置 → 400；否则 2xx/4xx 接受
    R.push(`[${not404 ? 'PASS' : 'FAIL'}] POST ${pad(path, 22)} -> status=${s.status}  msg=${s.data?.message || ''}`)
  }

  // 3. 管理后台登录（管理员鉴权走 x-admin-token 自定义 Header，不是 Authorization: Bearer）
  const l = await axios.post(BASE + '/api/admin/login', { username: 'admin', password: 'admin123' }).catch(e => e.response || e)
  const token = l.data?.data?.token || ''
  R.push(`[${l.status === 200 && token.length > 0 ? 'PASS' : 'FAIL'}] POST /api/admin/login -> ${l.status} tokenLen=${token.length}`)
  const headers = { 'x-admin-token': token }

  // 4. 6 模块配置中心空配置测试连通性
  //    app: name=白夜，应通过 200
  //    sms/wxpay/alipay/push: 空字段 → 400
  //    oss: seed 模板 provider=local，validateConfig 规则：provider 非空 → 200；若为空 → 400
  const expect = { app: 200, sms: 400, wxpay: 400, alipay: 400, oss: 200, push: 400 }
  for (const m of ['app', 'sms', 'wxpay', 'alipay', 'oss', 'push']) {
    const r = await axios.post(BASE + '/api/admin/config/modules/' + m + '/test', {}, { headers }).catch(e => e.response || e)
    const ok = r.status === expect[m]
    const msg = r.data?.message || (r.data?.data && (r.data.data.message || r.data.data.provider)) || ''
    R.push(`[${ok ? 'PASS' : 'FAIL'}] 模块 ${pad(m, 7)} 期望=${expect[m]} 实际=${r.status}  -> ${msg}`)
  }

  // 5. 定位 reverse（未配置 geoProvider → 降级对象 HTTP 200 且包含 fallback）
  const locR = await axios.post(BASE + '/api/location/reverse', { lng: 116.397428, lat: 39.90923 }).catch(e => e.response || e)
  const locOk = locR.status === 200
  R.push(`[${locOk ? 'PASS' : 'FAIL'}] POST /api/location/reverse -> ${locR.status}  body=${JSON.stringify(locR.data || {}).slice(0, 90)}`)

  const ipR = await axios.get(BASE + '/api/location/guess-by-ip').catch(e => e.response || e)
  R.push(`[${ipR.status === 200 ? 'PASS' : 'FAIL'}] GET  /api/location/guess-by-ip -> ${ipR.status}  ${JSON.stringify(ipR.data || {}).slice(0, 80)}`)

  // 6. regions tree
  const tr = await axios.get(BASE + '/api/regions/tree').catch(e => e.response || e)
  const pc = tr.data?.data?.meta?.provinceCount
  const cc = tr.data?.data?.meta?.cityCount
  const trOk = tr.status === 200 && pc === 34 && cc >= 382
  R.push(`[${trOk ? 'PASS' : 'FAIL'}] GET  /api/regions/tree -> pc=${pc}/34  cc=${cc}/382`)

  // 7. 搜索同义词 LOL
  const sv = await axios.get(BASE + '/api/services?keyword=LOL&pageSize=5').catch(e => e.response || e)
  const aliasArr = sv.data?.meta?.aliasesExpanded || []
  const svOk = sv.status === 200 && aliasArr.length > 0
  R.push(`[${svOk ? 'PASS' : 'FAIL'}] GET  /api/services?keyword=LOL 同义词扩展 aliasesExpanded=${JSON.stringify(aliasArr)}`)

  // 8. oss.validateConfig 直接单元级调用：provider='' 时应 ok=false
  const oss = require('../src/utils/oss')
  const v1 = oss.validateConfig({ provider: '' })
  const v2 = oss.validateConfig({ provider: 'local' })
  const v3 = oss.validateConfig({ provider: 'aliyun' })  // 缺字段
  const ok1 = v1.ok === false
  const ok2 = v2.ok === true
  const ok3 = v3.ok === false
  R.push(`[${ok1 ? 'PASS' : 'FAIL'}] oss.validateConfig(provider='')  ok=${v1.ok}  msg=${v1.message || ''}`)
  R.push(`[${ok2 ? 'PASS' : 'FAIL'}] oss.validateConfig(provider='local') ok=${v2.ok}  provider=${v2.provider || ''}`)
  R.push(`[${ok3 ? 'PASS' : 'FAIL'}] oss.validateConfig(provider='aliyun' 缺字段) ok=${v3.ok}  msg=${v3.message || ''}`)

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━  冒烟测试报告  ━━━━━━━━━━━━━━━━━')
  for (const line of R) console.log(line)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const passed = R.filter(r => r.startsWith('[PASS]')).length
  const total = R.length
  console.log(`总览: ${passed}/${total} 通过`)
  process.exit(passed === total ? 0 : 1)
})().catch(e => {
  console.error('脚本崩溃:', e.message)
  process.exit(2)
})
