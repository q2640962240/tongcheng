/**
 * 扩展冒烟测试 · 用户全业务链路
 * 覆盖：登录 / 发布动态 / 发布服务 / 服务展示 / 服务者主页 /
 *       下单 / 精英用户聊天 / 修改个人信息 / 管理后台设置 AI 用户密码登录
 */
const axios = require('axios')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const api = (u) => BASE + '/api' + u

const pad = (s, n) => String(s).padEnd(n, ' ')
const results = []
function record(label, ok, extra = '') {
  results.push(`[${ok ? 'PASS' : 'FAIL'}] ${pad(label, 54)} ${extra}`)
}

let userToken = ''
let user2Token = ''
let serviceId = null
let userId = null
let user2Id = null
let orderId = null
let aiUserId = null
let aiUserPhone = ''

const PHONE_A = '13900000001'
const PHONE_B = '13900000002'
const PASSWORD = 'Test123456'

function authHeader(tok) { return { Authorization: 'Bearer ' + tok } }
function strip(str, len = 80) {
  const s = String(str || '')
  return s.length > len ? s.slice(0, len) + '...' : s
}

;(async () => {
  // ======================= 0. 管理员登录 =======================
  const adminLogin = await axios.post(api('/admin/login'), { username: 'admin', password: 'admin123' }).catch(e => e.response || e)
  const adminToken = adminLogin.data?.data?.token || ''
  record('管理员登录', adminLogin.status === 200 && adminToken.length > 0,
    `status=${adminLogin.status} tokenLen=${adminToken.length}`)
  const adminH = { 'x-admin-token': adminToken }

  // ======================= 1. 确保 2 个精英测试用户存在 + 强制设置密码 =======================
  async function ensureElite({ phone, nickname }) {
    const list = await axios.get(api('/admin/users'), { headers: adminH, params: { keyword: phone, pageSize: 5 } }).catch(e => e.response || e)
    const rows = list.data?.data?.list || list.data?.list || []
    let user = rows.find(r => String(r.phone || '') === phone)
    if (!user) {
      const created = await axios.post(api('/admin/users'), {
        userType: 'real', phone, nickname, gender: 2, city: '北京',
        isProvider: true, isElite: true, status: 1,
        password: PASSWORD
      }, { headers: adminH }).catch(e => e.response || e)
      user = created.data?.data || null
    }
    if (user) {
      // 无论是否新创建，管理员都再设置一次密码（兼容 JSON 存储旧数据没有 passwordHash 的情况）
      const up = await axios.put(api(`/admin/users/${user.id}`), {
        password: PASSWORD,
        isProvider: true,
        isElite: true,
        status: 1,
        city: '北京'
      }, { headers: adminH }).catch(e => e.response || e)
      if (up.status === 200) user.hasPassword = true
    }
    return user
  }

  const u1 = await ensureElite({ phone: PHONE_A, nickname: '测试服务者' })
  if (u1) userId = u1.id
  record('创建/确保 用户A(服务者/精英/已设密码)', !!u1, `id=${userId} phone=${PHONE_A}`)

  const u2 = await ensureElite({ phone: PHONE_B, nickname: '测试买家' })
  if (u2) user2Id = u2.id
  record('创建/确保 用户B(买家/精英/已设密码)', !!u2, `id=${user2Id} phone=${PHONE_B}`)

  // 搜索或创建 AI 用户
  const aiList = await axios.get(api('/admin/users'), { headers: adminH, params: { userType: 'ai', pageSize: 5 } }).catch(e => e.response || e)
  const aiRows = aiList.data?.data?.list || aiList.data?.list || []
  let aiUser = aiRows.find(a => !!a.phone && /^1\d{10}$/.test(a.phone))
  if (!aiUser) aiUser = aiRows[0]
  if (!aiUser) {
    const cr = await axios.post(api('/admin/users'), {
      userType: 'ai', nickname: 'AI_小助理_' + Date.now().toString().slice(-4),
      gender: 2, city: '上海', isProvider: true, isElite: true, status: 1,
      aiProvider: 'deepseek', aiConfig: {
        apiUrl: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat', apiKey: '', temperature: 0.8,
        systemPrompt: '你是白夜平台的温柔聊天用户'
      },
      password: PASSWORD
    }, { headers: adminH }).catch(e => e.response || e)
    aiUser = cr.data?.data || null
  }
  // 给 AI 用户再 update 一次 password + 规范 phone（自动填充一个合法手机号）
  if (aiUser) {
    aiUserId = aiUser.id
    const autoPhone = /^1\d{10}$/.test(aiUser.phone || '') ? aiUser.phone : ('1' + String(18000000000 + aiUserId))
    const up = await axios.put(api(`/admin/users/${aiUserId}`), {
      phone: autoPhone,
      password: PASSWORD,
      isElite: true,
      isProvider: true,
      status: 1
    }, { headers: adminH }).catch(e => e.response || e)
    aiUserPhone = autoPhone
    record('确保 AI 用户 可密码登录', up.status === 200,
      `id=${aiUserId} phone=${autoPhone} status=${up.status} msg=${strip(up.data?.message || '')}`)
  } else {
    record('确保 AI 用户 可密码登录', false, 'AI 用户创建失败')
  }

  // ======================= 2. 密码登录 =======================
  const loginA = await axios.post(api('/auth/login-password'), { phone: PHONE_A, password: PASSWORD }).catch(e => e.response || e)
  if (loginA.data?.data?.token) userToken = loginA.data.data.token
  record('用户A 密码登录成功', loginA.status === 200 && !!userToken,
    `status=${loginA.status} hasAccess=${!!userToken} msg=${strip(loginA.data?.message || '')}`)

  const loginB = await axios.post(api('/auth/login-password'), { phone: PHONE_B, password: PASSWORD }).catch(e => e.response || e)
  if (loginB.data?.data?.token) user2Token = loginB.data.data.token
  record('用户B 密码登录成功', loginB.status === 200 && !!user2Token,
    `status=${loginB.status} hasAccess=${!!user2Token} msg=${strip(loginB.data?.message || '')}`)

  // ======================= 3. 个人资料修改 =======================
  const profileUpdate = await axios.put(api('/user/profile'), {
    nickname: '测试服务者_' + Date.now().toString().slice(-4),
    bio: '新手上路，请多关照',
    gender: 2,
    city: '北京'
  }, { headers: authHeader(userToken) }).catch(e => e.response || e)
  record('用户A 修改个人资料', profileUpdate.status === 200,
    `status=${profileUpdate.status} msg=${strip(profileUpdate.data?.message || '')}`)

  // ======================= 4. 发布动态 =======================
  const post = await axios.post(api('/posts'), {
    text: `今天阳光真好，想一起打游戏！ #${Date.now()}`,
    category: 'dynamic',
    images: [],
    city: '北京'
  }, { headers: authHeader(userToken) }).catch(e => e.response || e)
  const postId = post.data?.data?.id || post.data?.data?.postId || null
  record('用户A(精英) 发布动态', post.status === 200 && !!postId,
    `status=${post.status} postId=${postId} msg=${strip(post.data?.message || '')}`)

  // ======================= 5. 发布服务 =======================
  const svc = await axios.post(api('/services'), {
    title: `温柔陪玩_${Date.now().toString().slice(-4)}`,
    category: 'warm',
    subCategory: 'virtual-lover',
    description: '温柔声音，陪你聊天解闷，支持连麦哦～',
    price: 99,
    priceUnit: '20分钟',
    duration: 20,
    tags: ['温柔', '连麦', '树洞'],
    coverImage: ''
  }, { headers: authHeader(userToken) }).catch(e => e.response || e)
  if (svc.data?.data?.id) serviceId = svc.data.data.id
  const svcStatus = svc.data?.data?.status || ''
  const svcOk = svc.status === 200 && !!serviceId && ['online', 'pending'].includes(svcStatus)
  record('用户A 发布服务', svcOk,
    `status=${svc.status} serviceId=${serviceId} dbStatus=${svcStatus} msg=${strip(svc.data?.message || '')}`)

  if (svcStatus === 'pending' && serviceId) {
    const audit = await axios.put(api(`/admin/services/${serviceId}/audit`), { status: 'online' }, { headers: adminH }).catch(e => e.response || e)
    record('管理员通过服务审核', audit.status === 200,
      `status=${audit.status} msg=${strip(audit.data?.message || '')}`)
  }

  // ======================= 6. 服务列表可见 =======================
  await new Promise(r => setTimeout(r, 150))
  const serviceList = await axios.get(api('/services'), { params: { pageSize: 50 } }).catch(e => e.response || e)
  const list = serviceList.data?.data?.list || []
  const found = list.find(s => Number(s.id) === Number(serviceId))
  record('匿名服务列表可见新服务', !!found,
    `listLen=${list.length} foundId=${found?.id || 0} status=${serviceList.status}`)

  // 按城市过滤也能命中（city=北京）
  const list2 = await axios.get(api('/services'), { params: { city: '北京', pageSize: 50 } }).catch(e => e.response || e)
  const rows = list2.data?.data?.list || []
  const hitCity = rows.find(s => Number(s.id) === Number(serviceId))
  record('按城市过滤「北京」命中新服务', !!hitCity || !found,
    `listLen=${rows.length} cityHitId=${hitCity?.id || 0} srvCity=${found?.city || ''}`)

  // ======================= 7. 服务详情 + 服务者主页（防 500） =======================
  const svcDetail = await axios.get(api(`/services/${serviceId}`)).catch(e => e.response || e)
  record(`服务详情 GET /services/${serviceId}`, svcDetail.status < 500 && !!svcDetail.data?.data,
    `status=${svcDetail.status} title=${strip(svcDetail.data?.data?.title || '')}`)

  const provider = await axios.get(api(`/user/provider/${userId}`)).catch(e => e.response || e)
  record(`服务者主页 GET /user/provider/${userId}`, provider.status < 500 && provider.data?.data,
    `status=${provider.status} nickname=${strip(provider.data?.data?.nickname || '')} onlineSvc=${provider.data?.data?.services?.length || 0}`)

  // ======================= 8. 买家下单 + 双方订单列表 =======================
  const order = await axios.post(api('/orders'), {
    serviceId: Number(serviceId),
    providerId: Number(userId),
    remark: '今晚有空吗～',
    price: 99,
    contact: 'wx_' + Date.now().toString().slice(-6)
  }, { headers: authHeader(user2Token) }).catch(e => e.response || e)
  if (order.data?.data?.id) orderId = order.data.data.id
  record('用户B 下单服务', order.status === 200 && !!orderId,
    `status=${order.status} orderId=${orderId} orderStatus=${order.data?.data?.status || ''} msg=${strip(order.data?.message || '')}`)

  if (orderId) {
    const od = await axios.get(api(`/orders/${orderId}`), { headers: authHeader(user2Token) }).catch(e => e.response || e)
    record(`订单详情 GET /orders/${orderId}`, od.status < 500 && !!od.data?.data, `status=${od.status}`)
    const po = await axios.get(api('/orders'), { params: { pageSize: 10 }, headers: authHeader(userToken) }).catch(e => e.response || e)
    record('服务者(A) 查看订单列表', po.status < 500, `status=${po.status} len=${po.data?.data?.list?.length || 0}`)
  }

  // ======================= 9. 精英用户聊天（POST /chat，GET /chat/sessions，GET /chat/history/:id） =======================
  const sendChat = await axios.post(api('/chat'), {
    receiverId: Number(userId),
    type: 'text',
    content: '你好呀，我已经下单了，什么时候可以开始？'
  }, { headers: authHeader(user2Token) }).catch(e => e.response || e)
  record('精英B→A 发送私信（POST /chat）', sendChat.status === 200,
    `status=${sendChat.status} msg=${strip(sendChat.data?.message || '')}`)

  const conv = await axios.get(api('/chat/sessions'), { headers: authHeader(user2Token) }).catch(e => e.response || e)
  record('用户B 会话列表（/chat/sessions）', conv.status < 500,
    `status=${conv.status} count=${conv.data?.data?.length || (conv.data && Array.isArray(conv.data.data) ? conv.data.data.length : 0)}`)

  const hist = await axios.get(api(`/chat/history/${userId}`), { headers: authHeader(user2Token), params: { pageSize: 20 } }).catch(e => e.response || e)
  record(`用户B 与A聊天记录（/chat/history/${userId}）`, hist.status < 500,
    `status=${hist.status} histLen=${hist.data?.data?.list?.length || (Array.isArray(hist.data?.data) ? hist.data.data.length : 0)}`)

  // ======================= 10. AI 用户密码登录 =======================
  if (aiUserId) {
    const aiLogin = await axios.post(api('/auth/login-password'), {
      phone: aiUserPhone, password: PASSWORD
    }).catch(e => e.response || e)
    const aiTok = aiLogin.data?.data?.token || ''
    record('AI 用户(phone+密码) 登录用户端', aiLogin.status === 200 && !!aiTok,
      `status=${aiLogin.status} hasToken=${!!aiTok} phone=${aiUserPhone} msg=${strip(aiLogin.data?.message || '')}`)
  }

  // ======================= 11. 管理员设置过短密码应 400 =======================
  const shortPwd = await axios.put(api(`/admin/users/${userId}`), { password: '12' }, { headers: adminH }).catch(e => e.response || e)
  record('管理员设置<6位密码返回 400', shortPwd.status === 400,
    `status=${shortPwd.status} msg=${strip(shortPwd.data?.message || '')}`)

  // ======================= 12. 最终健康检查 =======================
  const health = await axios.get(api('/health')).catch(e => e.response || e)
  record('最终健康检查 /api/health', health.status === 200, `status=${health.status}`)

  console.log('')
  console.log('━'.repeat(90))
  console.log('                    扩展冒烟测试 · 用户全业务链路报告')
  console.log('━'.repeat(90))
  for (const r of results) console.log(r)
  console.log('━'.repeat(90))
  const passN = results.filter(r => r.startsWith('[PASS]')).length
  const totalN = results.length
  console.log(`总览: ${passN}/${totalN} 通过  ${passN === totalN ? '✅ 全绿' : '❌ 存在失败，请查看上方 FAIL 条目'}`)
  console.log('━'.repeat(90))
  if (passN !== totalN) process.exit(1)
})().catch(err => {
  console.error('[FATAL] 扩展冒烟测试脚本运行异常:', err && err.message ? err.message : err)
  process.exit(2)
})
