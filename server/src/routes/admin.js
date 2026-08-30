const express = require('express')
const router = express.Router()
const { User, Service, ServiceCategory, Order, Wallet, Feedback, Admin, Transaction, Invite, Message, Post, Group, Banner, EliteOrder, Op } = require('../models')
const { signToken } = require('../middleware/auth')
const { success, paginate, fail } = require('../utils/response')

/** 管理员鉴权中间件 */
const adminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token']
  if (!token) return fail(res, '请先登录', 401)
  // 简易 token 校验（生产环境用 JWT）
  if (!token.startsWith('admin_')) return fail(res, '管理员令牌无效', 401)
  const adminId = token.replace('admin_', '')
  if (!adminId) return fail(res, '管理员令牌无效', 401)
  req.adminId = adminId
  next()
}

/** 管理员登录 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return fail(res, '请输入账号密码')

    // 初始化默认管理员（首次登录自动创建）
    let admin = await Admin.findOne({ where: { username } })
    if (!admin && username === 'admin' && password === 'admin123') {
      admin = await Admin.create({
        username: 'admin',
        password: 'admin123',
        role: 'superadmin',
        nickname: '超级管理员'
      })
    }
    if (!admin || !admin.verifyPassword(password)) return fail(res, '账号或密码错误')

    await admin.update({ lastLoginAt: new Date().toISOString() })
    const token = `admin_${admin.id}`
    success(res, {
      token,
      admin: { id: admin.id, username: admin.username, nickname: admin.nickname, role: admin.role }
    }, '登录成功')
  } catch (err) { next(err) }
})

router.use(adminAuth)

/** 仪表盘统计 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const userCount = await User.count()
    const orderCount = await Order.count()
    const serviceCount = await Service.count()
    const pendingFeedback = await Feedback.count({ where: { status: 'pending' } })
    const pendingServices = await Service.count({ where: { status: 'pending' } })
    const refundingOrders = await Order.count({ where: { status: 'refunding' } })

    // 收入统计
    const allTx = await Transaction.findAll({ where: { type: 'income' } })
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const todayStart = new Date(new Date().toISOString().slice(0, 10)).toISOString()
    let monthIncome = 0, todayIncome = 0
    for (const t of allTx) {
      const amt = Number(t.amount) || 0
      if (t.createdAt >= monthStart) monthIncome += amt
      if (t.createdAt >= todayStart) todayIncome += amt
    }

    // 平台累计充值/提现
    const rechargeTx = await Transaction.findAll({ where: { type: 'recharge' } })
    const withdrawTx = await Transaction.findAll({ where: { type: 'withdraw' } })
    const totalRecharge = rechargeTx.reduce((s, t) => s + Number(t.amount), 0)
    const totalWithdraw = withdrawTx.reduce((s, t) => s + Number(t.amount), 0)

    success(res, {
      userCount, orderCount, serviceCount,
      pendingFeedback, pendingServices, refundingOrders,
      todayIncome, monthIncome,
      totalRecharge, totalWithdraw,
      platformIncome: Math.floor(totalRecharge * 0.2),  // 平台抽成 20%
      // T11 新增：白夜 v2 广场化指标
      postCount: await Post.count().catch(() => 0),
      groupCount: await Group.count().catch(() => 0),
      bannerCount: await Banner.count().catch(() => 0),
      elitePaidCount: await EliteOrder.count({ where: { status: 'paid' } }).catch(() => 0),
      eliteRevenueFen: (await EliteOrder.findAll({ where: { status: 'paid' } })
        .then(list => list.reduce((s, o) => s + Number(o.amount), 0))
        .catch(() => 0)),
    })
  } catch (err) { next(err) }
})

/** 用户管理列表 */
router.get('/users', async (req, res, next) => {
  try {
    const { keyword, isElite, status, userType, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { nickname: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } }
      ]
    }
    if (isElite !== undefined && isElite !== '') where.isElite = isElite === 'true'
    if (status !== undefined && status !== '') where.status = Number(status)
    if (userType && (userType === 'real' || userType === 'ai')) where.userType = userType

    const { rows, count } = await User.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    const list = rows.map(u => {
      const j = u.toJSON ? u.toJSON() : u
      j.hasPassword = !!j.passwordHash
      delete j.passwordHash
      return j
    })
    paginate(res, list, count, page, pageSize)
  } catch (err) { next(err) }
})

/** 用户详情 */
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id)
    if (!user) return fail(res, '用户不存在', 404)
    const wallet = await Wallet.findOne({ where: { userId: user.id } })
    const invitees = await Invite.findAll({ where: { inviterId: user.id } })
    const orderCount = await Order.count({
      where: { [Op.or]: [{ userId: user.id }, { providerId: user.id }] }
    })
    const json = user.toJSON()
    json.hasPassword = !!json.passwordHash
    delete json.passwordHash
    success(res, { ...json, wallet: wallet ? wallet.toJSON() : null, inviteeCount: invitees.length, orderCount })
  } catch (err) { next(err) }
})

/** 封禁/解封 */
router.put('/users/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body
    const user = await User.findByPk(req.params.id)
    if (!user) return fail(res, '用户不存在', 404)
    await user.update({ status })
    success(res, null, status === 1 ? '已解封' : '已封禁')
  } catch (err) { next(err) }
})

/** 审核精英认证 */
router.put('/users/:id/elite', async (req, res, next) => {
  try {
    const { approved } = req.body
    const user = await User.findByPk(req.params.id)
    if (!user) return fail(res, '用户不存在', 404)
    await user.update({
      isElite: !!approved,
      identityStatus: approved ? 'passed' : 'rejected',
      realPersonStatus: approved ? 'passed' : user.realPersonStatus
    })
    success(res, null, approved ? '精英认证已通过' : '精英认证已拒绝')
  } catch (err) { next(err) }
})

/** 创建用户（支持真人用户 / AI 用户，AI 用户可配置接入 API 自动回复） */
router.post('/users', async (req, res, next) => {
  try {
    const {
      userType = 'real',      // real | ai
      phone,
      nickname,
      avatar,
      gender = 0,
      city,
      bio,
      isProvider = false,
      isElite = false,
      // AI 用户专属
      aiProvider = 'none',    // none | custom | openai | deepseek
      aiConfig = null,        // { apiKey, apiUrl, model, systemPrompt, temperature }
      password
    } = req.body || {}

    if (!nickname || String(nickname).trim().length === 0) {
      return fail(res, '昵称必填')
    }

    // 真人用户必须有真实手机号；AI 用户可自动生成占位手机号（以 AI+时间戳 方式，phone 字段强制唯一，复用 inviteCode 规则）
    let finalPhone = phone ? String(phone).trim() : ''
    if (userType === 'real') {
      if (!/^1\d{10}$/.test(finalPhone)) return fail(res, '真人用户手机号格式不正确')
    } else {
      // AI 用户：若未提供手机号，自动生成一个 11 位"伪手机号"（保证唯一，仍符合正则/存储约束）
      if (!/^1\d{10}$/.test(finalPhone)) {
        finalPhone = '1' + String(Date.now()).slice(-10)
      }
    }

    // 手机号唯一性检查
    const exist = await User.findOne({ where: { phone: finalPhone } })
    if (exist) return fail(res, '该手机号已存在，请更换')

    const data = {
      phone: finalPhone,
      nickname: String(nickname).trim(),
      avatar: avatar || '',
      gender: Number(gender) || 0,
      city: city || '',
      bio: bio || '',
      isProvider: !!isProvider,
      isElite: !!isElite,
      userType: userType === 'ai' ? 'ai' : 'real',
      status: 1,
      inviteCode: 'INV' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5)
    }

    if (userType === 'ai') {
      data.aiProvider = ['openai', 'deepseek', 'custom'].includes(aiProvider) ? aiProvider : 'deepseek'
      // 校验 AI 配置
      const cfg = (aiConfig && typeof aiConfig === 'object') ? aiConfig : {}
      // DeepSeek 默认值兜底（用户优先体验：只填 API Key 即可）
      const isDeepSeek = data.aiProvider === 'deepseek'
      const DEFAULT_URL = isDeepSeek
        ? 'https://api.deepseek.com/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions'
      const DEFAULT_MODEL = isDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini'
      data.aiConfig = {
        apiKey: String(cfg.apiKey || '').trim(),
        apiUrl: String(cfg.apiUrl || DEFAULT_URL).trim(),
        model: String(cfg.model || DEFAULT_MODEL).trim(),
        temperature: Number(cfg.temperature) || 0.8,
        systemPrompt: String(cfg.systemPrompt || '你是"白夜"伴玩平台的一位用户，正在与用户进行自然聊天回复。请保持友善、温柔、有趣的语气，回复控制在 50-200 字之间，不要透露自己是 AI。').trim()
      }
    }

    // 密码（可选）— 真人用户可直接设置密码登录
    const user = await User.create(data)
    if (password && userType === 'real' && typeof user.setPassword === 'function') {
      user.setPassword(password)
      await user.save()
    }

    // AI 用户自动创建钱包
    await Wallet.create({ userId: user.id })

    const plain = user.toJSON()
    delete plain.passwordHash
    success(res, plain, userType === 'ai' ? 'AI 用户已创建' : '真人用户已创建')
  } catch (err) { next(err) }
})

/** 更新用户（AI 配置、精英、类型等） */
router.put('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id)
    if (!user) return fail(res, '用户不存在', 404)
    const body = req.body || {}
    const patch = {}
    const allowPatch = ['nickname', 'avatar', 'gender', 'city', 'bio', 'isProvider', 'isElite', 'status', 'userType', 'aiProvider']
    for (const k of allowPatch) {
      if (body[k] !== undefined) patch[k] = body[k]
    }
    if (body.aiConfig !== undefined) {
      const cfg = (body.aiConfig && typeof body.aiConfig === 'object') ? body.aiConfig : {}
      const prevCfg = (user.aiConfig && typeof user.aiConfig === 'object') ? user.aiConfig : {}
      // 切换 provider 时自动填充默认 url / model（DeepSeek 优先只填 API Key 即可）
      const provider = body.aiProvider || user.aiProvider || 'custom'
      const isDeepSeek = provider === 'deepseek'
      const DEFAULT_URL = isDeepSeek
        ? 'https://api.deepseek.com/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions'
      const DEFAULT_MODEL = isDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini'
      patch.aiConfig = {
        apiKey: cfg.apiKey !== undefined ? String(cfg.apiKey).trim() : (prevCfg.apiKey || ''),
        apiUrl: cfg.apiUrl !== undefined ? String(cfg.apiUrl).trim() : (prevCfg.apiUrl || DEFAULT_URL),
        model: cfg.model !== undefined ? String(cfg.model).trim() : (prevCfg.model || DEFAULT_MODEL),
        temperature: cfg.temperature !== undefined ? Number(cfg.temperature) : (prevCfg.temperature || 0.8),
        systemPrompt: cfg.systemPrompt !== undefined ? String(cfg.systemPrompt).trim() : (prevCfg.systemPrompt || '')
      }
    }
    // 真人用户密码修改：admin 强制设置，无需用户先走过短信验证码
    if (user.userType === 'real' && typeof body.password === 'string' && body.password.length > 0) {
      if (typeof user.setPassword === 'function') user.setPassword(body.password)
      // 显式写入 patch（兼容 JSON 驱动 instance setPassword 后 update 不刷新 dataValues 的情况）
      patch.passwordHash = user.passwordHash
    }
    await user.update(patch)
    const plain = user.toJSON()
    delete plain.passwordHash
    success(res, plain, '用户已更新')
  } catch (err) { next(err) }
})

/** 服务管理列表 */
router.get('/services', async (req, res, next) => {
  try {
    const { status, category, subCategory, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (status) where.status = status
    if (category) where.category = category
    if (subCategory) where.subCategory = subCategory
    const { rows, count } = await Service.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    // 附 provider
    const result = []
    for (const s of rows) {
      const u = await User.findByPk(s.providerId)
      result.push({ ...s.toJSON(), provider: u ? { nickname: u.nickname, phone: u.phone } : null })
    }
    paginate(res, result, count, page, pageSize)
  } catch (err) { next(err) }
})

/** 审核服务 */
router.put('/services/:id/audit', async (req, res, next) => {
  try {
    const { status, rejectReason } = req.body
    const service = await Service.findByPk(req.params.id)
    if (!service) return fail(res, '服务不存在', 404)
    await service.update({ status, rejectReason: rejectReason || null })
    success(res, null, '审核完成')
  } catch (err) { next(err) }
})

/** 订单管理 */
router.get('/orders', async (req, res, next) => {
  try {
    const { status, keyword, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (status) where.status = status
    if (keyword) where.orderNo = { like: `%${keyword}%` }
    const { rows, count } = await Order.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    const result = []
    for (const o of rows) {
      const u = await User.findByPk(o.userId)
      const p = await User.findByPk(o.providerId)
      result.push({
        ...o.toJSON(),
        user: u ? { nickname: u.nickname, phone: u.phone } : null,
        provider: p ? { nickname: p.nickname, phone: p.phone } : null
      })
    }
    paginate(res, result, count, page, pageSize)
  } catch (err) { next(err) }
})

/** 退款处理 */
router.put('/orders/:id/refund', async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    await order.update({ status: 'refunded' })

    // 退还星币给消费者
    const wallet = await Wallet.findOne({ where: { userId: order.userId } })
    if (wallet) {
      await wallet.update({ starCoin: wallet.starCoin + order.amount })
      await Transaction.create({
        userId: order.userId,
        type: 'refund',
        amount: order.amount,
        currency: 'star',
        balanceAfter: wallet.starCoin,
        orderId: order.id,
        remark: `后台退款：${order.orderNo}`
      })
    }
    success(res, null, '退款已完成')
  } catch (err) { next(err) }
})

/** 反馈管理（支持按状态 / refType 筛选）*/
router.get('/feedback', async (req, res, next) => {
  try {
    const { status, refType, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (status) where.status = status
    if (refType) where.refType = refType
    const { rows, count } = await Feedback.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    const result = []
    for (const f of rows) {
      const u = await User.findByPk(f.userId)
      const target = f.targetUserId ? (await User.findByPk(f.targetUserId)) : null
      const fbJson = f.toJSON()
      result.push({
        ...fbJson,
        user: u ? { nickname: u.nickname, phone: u.phone, id: u.id } : null,
        targetUser: target ? { nickname: target.nickname, phone: target.phone, id: target.id } : null,
        // 合并展示"被举报目标 ID"字段，方便管理后台统一列展示
        targetId: fbJson.postId || fbJson.groupId || fbJson.targetUserId || null
      })
    }
    paginate(res, result, count, page, pageSize)
  } catch (err) { next(err) }
})

/** 处理反馈 */
router.put('/feedback/:id', async (req, res, next) => {
  try {
    const { status, reply, reward = 0 } = req.body
    const fb = await Feedback.findByPk(req.params.id)
    if (!fb) return fail(res, '反馈不存在', 404)
    await fb.update({ status, reply, reward: Number(reward), handledBy: req.adminId })

    // 发放钻石奖励
    if (Number(reward) > 0) {
      const wallet = await Wallet.findOne({ where: { userId: fb.userId } })
      if (wallet) {
        await wallet.update({ diamond: wallet.diamond + Number(reward) })
        await Transaction.create({
          userId: fb.userId,
          type: 'reward',
          amount: Number(reward),
          currency: 'fen',
          balanceAfter: wallet.diamond,
          remark: `反馈采纳奖励：${fb.id}`
        })
      }
    }
    success(res, null, '处理完成')
  } catch (err) { next(err) }
})

/** 财务管理 - 交易记录 */
router.get('/finance/transactions', async (req, res, next) => {
  try {
    const { type, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (type) where.type = type
    const { rows, count } = await Transaction.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    const result = []
    for (const t of rows) {
      const u = await User.findByPk(t.userId)
      result.push({ ...t.toJSON(), user: u ? { nickname: u.nickname, phone: u.phone } : null })
    }
    paginate(res, result, count, page, pageSize)
  } catch (err) { next(err) }
})

/** 提现审核 - 待审核列表 */
router.get('/withdrawals', async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, pageSize = 20 } = req.query
    // 通过 extra.status 筛选（pending/approved/rejected/paid）
    const allTx = await Transaction.findAll({ where: { type: 'withdraw' } })
    const filtered = allTx.filter(t => {
      const st = (t.extra && t.extra.status) || 'pending'
      return status === 'all' || st === status
    })
    const sorted = filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const start = (page - 1) * pageSize
    const rows = sorted.slice(start, start + Number(pageSize))
    const result = []
    for (const t of rows) {
      const u = await User.findByPk(t.userId)
      const wallet = await Wallet.findOne({ where: { userId: t.userId } })
      result.push({
        ...t.toJSON(),
        user: u ? { id: u.id, nickname: u.nickname, phone: u.phone, avatar: u.avatar } : null,
        walletBalance: wallet ? wallet.income : 0
      })
    }
    paginate(res, result, filtered.length, page, pageSize)
  } catch (err) { next(err) }
})

/** 提现审核 - 通过/拒绝/标记已打款 */
router.put('/withdrawals/:id', async (req, res, next) => {
  try {
    const { status, note } = req.body  // approved / rejected / paid
    if (!['approved', 'rejected', 'paid'].includes(status)) {
      return fail(res, '状态参数不正确')
    }
    const tx = await Transaction.findByPk(req.params.id)
    if (!tx) return fail(res, '提现记录不存在', 404)
    const curStatus = (tx.extra && tx.extra.status) || 'pending'
    // 状态机：pending → approved/rejected；approved → paid
    if (status === 'paid') {
      if (curStatus !== 'approved') {
        return fail(res, '仅「待打款」状态可标记已打款')
      }
    } else if (curStatus !== 'pending') {
      return fail(res, '当前状态不可操作')
    }

    const extra = { ...tx.extra, status, note: note || '', handledAt: new Date().toISOString(), handledBy: req.adminId }

    // 拒绝：退还 income
    if (status === 'rejected') {
      const wallet = await Wallet.findOne({ where: { userId: tx.userId } })
      if (wallet) {
        await wallet.update({
          income: wallet.income + Number(tx.amount),
          totalWithdraw: wallet.totalWithdraw - Number(tx.amount)
        })
        extra.refundedAt = new Date().toISOString()
      }
    }

    await tx.update({
      remark: status === 'approved' ? `提现审核通过（待打款）` :
             status === 'paid' ? `提现已打款` :
             `提现已拒绝（金额已退还）`,
      extra
    })
    success(res, null, status === 'approved' ? '已通过，待打款' : status === 'paid' ? '已标记打款' : '已拒绝并退款')
  } catch (err) { next(err) }
})

/** 邀请管理 - 排行榜 */
router.get('/invite/leaderboard', async (req, res, next) => {
  try {
    const all = await Invite.findAll()
    const map = new Map()
    for (const i of all) {
      const cur = map.get(i.inviterId) || { inviterId: i.inviterId, reward: 0, count: 0 }
      cur.reward += Number(i.totalReward) || 0
      cur.count += 1
      map.set(i.inviterId, cur)
    }
    const list = [...map.values()].sort((a, b) => b.reward - a.reward)
    const result = []
    for (const item of list) {
      const u = await User.findByPk(item.inviterId)
      result.push({
        ...item,
        nickname: u?.nickname,
        avatar: u?.avatar,
        phone: u?.phone
      })
    }
    success(res, result)
  } catch (err) { next(err) }
})

// ==========================================================
// 路径别名（为保持前端与测试端新旧路径兼容）
// ==========================================================
/** 仪表盘别名：GET /admin/stats/dashboard ⇢ GET /admin/dashboard */
router.get('/stats/dashboard', router.stack.find(l => l.route && l.route.path === '/dashboard' && l.route.methods.get).handle)

/** 服务审核别名：PUT /admin/services/:id/status ⇢ PUT /admin/services/:id/audit */
router.put('/services/:id/status', (req, res, next) => {
  const auditHandler = router.stack.find(l => l.route && l.route.path === '/services/:id/audit' && l.route.methods.put)
  if (!auditHandler) return fail(res, '路由未初始化', 500)
  auditHandler.handle(req, res, next)
})

/** 后台为指定用户上架服务（无需用户自行发布，直接 online） */
router.post('/services/create-for-user', async (req, res, next) => {
  try {
    const {
      userId,
      title,
      description,
      category,
      subCategory,
      coverImage,
      price,
      priceUnit,
      duration,
      tags,
      sort,
      status
    } = req.body
    const providerId = Number(userId)
    if (!providerId || !title || !category || price == null) {
      return fail(res, '参数不完整：userId、title、category、price 为必填', 400)
    }
    const user = await User.findByPk(providerId)
    if (!user) return fail(res, '指定用户不存在', 404)

    const service = await Service.create({
      providerId,
      title,
      description: description || '',
      category,
      subCategory: subCategory || null,
      coverImage: coverImage || null,
      price: Number(price) || 0,
      priceUnit: priceUnit || '次',
      duration: duration ? Number(duration) : null,
      tags: Array.isArray(tags) ? tags : null,
      sort: sort ? Number(sort) : 0,
      status: ['draft', 'pending', 'online', 'offline'].includes(status) ? status : 'online',
      rejectReason: null
    })
    success(res, { id: service.id }, '已为用户上架服务')
  } catch (err) { next(err) }
})

/** 钱包流水别名：GET /admin/wallet/transactions ⇢ GET /admin/finance/transactions */
router.get('/wallet/transactions', (req, res, next) => {
  const h = router.stack.find(l => l.route && l.route.path === '/finance/transactions' && l.route.methods.get)
  if (!h) return fail(res, '路由未初始化', 500)
  h.handle(req, res, next)
})

/** 提现列表别名：GET /admin/withdraws ⇢ GET /admin/withdrawals */
router.get('/withdraws', (req, res, next) => {
  const h = router.stack.find(l => l.route && l.route.path === '/withdrawals' && l.route.methods.get)
  if (!h) return fail(res, '路由未初始化', 500)
  h.handle(req, res, next)
})

/** 处理反馈别名：PUT /admin/feedback/:id/status ⇢ PUT /admin/feedback/:id */
router.put('/feedback/:id/status', (req, res, next) => {
  const h = router.stack.find(l => l.route && l.route.path === '/feedback/:id' && l.route.methods.put)
  if (!h) return fail(res, '路由未初始化', 500)
  h.handle(req, res, next)
})

/** 认证申请列表（从 User 中抽取 pending 认证用户） */
router.get('/certifications', async (req, res, next) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (status === 'pending') {
      where[Op.or] = [
        { identityStatus: 'pending' },
        { realPersonStatus: 'pending' }
      ]
    } else if (status === 'passed') {
      where.identityStatus = 'passed'
    } else if (status === 'rejected') {
      where.identityStatus = 'rejected'
    }
    const { rows, count } = await User.findAndCountAll({
      where,
      order: [['updatedAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    const list = rows.map(u => ({
      id: u.id,
      userId: u.id,
      user: { id: u.id, nickname: u.nickname, phone: u.phone, avatar: u.avatar },
      realName: (u.meta && u.meta.realName) || u.nickname,
      idCard: (u.meta && u.meta.idCard) ? u.meta.idCard.replace(/^(.{4})(.+)(.{4})$/, '$1****$3') : '',
      photo: (u.meta && u.meta.photo) || u.avatar,
      type: 'identity',
      status: u.identityStatus === 'passed' || u.realPersonStatus === 'passed' ? 'passed'
            : u.identityStatus === 'pending' || u.realPersonStatus === 'pending' ? 'pending' : 'none',
      submittedAt: u.updatedAt,
      rejectedReason: (u.meta && u.meta.rejectedReason) || ''
    }))
    paginate(res, list, count, page, pageSize)
  } catch (err) { next(err) }
})

/** 认证审核（通过/拒绝） */
router.put('/certifications/:id/audit', async (req, res, next) => {
  try {
    const { status, rejectReason } = req.body
    if (!['passed', 'rejected'].includes(status)) return fail(res, '审核状态不合法', 400)
    const user = await User.findByPk(req.params.id)
    if (!user) return fail(res, '用户不存在', 404)
    const meta = user.meta && typeof user.meta === 'object' ? { ...user.meta } : {}
    if (status === 'rejected' && rejectReason) meta.rejectedReason = rejectReason
    await user.update({
      identityStatus: status,
      realPersonStatus: status,
      meta
    })
    success(res, null, status === 'passed' ? '认证已通过' : '认证已拒绝')
  } catch (err) { next(err) }
})

/** 配置中心 - 所有配置列表 */
router.get('/configs', async (req, res, next) => {
  try {
    const { Config } = require('../models')
    const list = await Config.findAll()
    const modules = {}
    for (const row of list) {
      if (!modules[row.module]) modules[row.module] = {}
      modules[row.module][row.key] = row.value
    }
    success(res, {
      count: list.length,
      modules,
      keys: list.map(r => ({ id: r.id, module: r.module, key: r.key, value: r.value, updatedAt: r.updatedAt }))
    })
  } catch (err) { next(err) }
})

/** 配置中心 - 获取某模块 */
router.get('/config/modules/:name', async (req, res, next) => {
  try {
    const { getModuleConfig } = require('../utils/config')
    const cfg = await getModuleConfig(req.params.name)
    success(res, { name: req.params.name, values: cfg })
  } catch (err) { next(err) }
})
router.get('/config/module/:name', (req, res, next) => {
  req.params.name = req.params.name
  const h = router.stack.find(l => l.route && l.route.path === '/config/modules/:name' && l.route.methods.get)
  h.handle(req, res, next)
})

/** 配置中心 - 保存某模块 */
router.put('/config/modules/:name', async (req, res, next) => {
  try {
    const { setModule } = require('../utils/config')
    await setModule(req.params.name, req.body || {})
    const { getModuleConfig } = require('../utils/config')
    const cfg = await getModuleConfig(req.params.name)
    success(res, { name: req.params.name, values: cfg }, '已保存')
  } catch (err) { next(err) }
})
router.put('/config/module/:name', (req, res, next) => {
  const h = router.stack.find(l => l.route && l.route.path === '/config/modules/:name' && l.route.methods.put)
  h.handle(req, res, next)
})

/** 配置中心元数据 · 面向管理后台（模块名/配置名/字段类型/描述/业务选项）
 *  GET /api/admin/config/modules  返回: [{ name, label, icon, color, description, fields:[{key,label,type,description,placeholder,options?}], values:{...} }]
 */
const MODULE_META = {
  app: {
    label: '应用基础',
    icon: 'Setting',
    color: '#D4AF37',
    description: 'App 名称、域名、客服信息与业务参数（价格/抽成/提现）；修改后即时生效。',
    options: {}
  },
  sms: {
    label: '短信服务',
    icon: 'Message',
    color: '#22C55E',
    description: '用户登录/注册/找回密码需真实短信验证码。未配置时登录接口会提示「短信服务尚未配置」。',
    options: {
      provider: [
        { label: '阿里云短信 (aliyun)', value: 'aliyun' },
        { label: '腾讯云短信 (tencent)', value: 'tencent' }
      ]
    }
  },
  wxpay: {
    label: '微信支付',
    icon: 'Goods',
    color: '#4FB8FF',
    description: '微信 JSAPI / App / H5 下单。enabled 开启且 4 项必填齐全后，钱包充值 & 精英购买才会真实拉起支付。',
    options: {}
  },
  alipay: {
    label: '支付宝',
    icon: 'Wallet',
    color: '#7B61FF',
    description: '支付宝手机网站 / App 支付。生产建议 sandbox=false，用正式 AppID + 公私钥对。',
    options: {}
  },
  push: {
    label: '离线推送',
    icon: 'Bell',
    color: '#F59E0B',
    description: '新消息/订单/组局报名 通知下发。未开启时前端会在 App 内通过 WebSocket 实时推送，但离线收不到。',
    options: {
      provider: [
        { label: '极光推送 (jpush)', value: 'jpush' },
        { label: '个推 (getui)', value: 'getui' }
      ]
    }
  },
  oss: {
    label: '存储 (OSS)',
    icon: 'Picture',
    color: '#EF4444',
    description: '头像、动态图片、服务封面等上传。单机生产可直接用 local（本地 uploads/ 目录），上云切 aliyun。',
    options: {
      provider: [
        { label: '本地 local (uploads/ 目录)', value: 'local' },
        { label: '阿里云 OSS', value: 'aliyun' }
      ]
    }
  }
}
const FIELD_LABELS = {
  name:                       { label: '应用名称',               placeholder: '白夜', required: true },
  domain:                     { label: '应用域名',               placeholder: 'https://baiye.yourdomain.com', required: true },
  kefuWechat:                 { label: '客服微信号',             placeholder: '填写便于用户添加的微信号' },
  kefuQrcode:                 { label: '客服二维码 URL',         placeholder: 'https://.../kefu.png' },
  kefuPhone:                  { label: '客服联系电话',           placeholder: '400 或固定电话/手机号' },
  notice:                     { label: '客服 / 公告说明',        placeholder: '例如：如有问题请联系客服微信' },
  elite_lifetime_price_fen:   { label: '精英终身会员价 (分)',    placeholder: '默认 3000 = 30 元', required: true },
  unlock_wechat_diamond_cost: { label: '解锁微信号 (钻石)',      placeholder: '默认 99 钻石/次', required: true },
  platform_commission_rate:   { label: '平台抽成比例',           placeholder: '0.2 = 20%', required: true },
  withdraw_min_amount_fen:    { label: '最低提现额 (分)',        placeholder: '默认 1000 = 10 元', required: true },
  withdraw_fee_rate:          { label: '提现手续费比例',         placeholder: '0 = 免费', required: true },
  signInRewardDiamond:        { label: '每日签到奖励 (钻石)',     placeholder: '默认 10 钻石/天', required: true },
  geoProvider:                { label: '地理逆解服务提供商',        placeholder: '可选：amap（高德）/ tencent（腾讯）/ 留空或 off',
                                 options: [
                                   { label: '关闭（不请求外部地图接口）', value: '' },
                                   { label: '关闭（off）', value: 'off' },
                                   { label: '高德地图（amap）', value: 'amap' },
                                   { label: '腾讯地图（tencent）', value: 'tencent' }
                                 ] },
  geoKey:                     { label: '地理服务密钥 (Web Service Key)', placeholder: '高德/腾讯对应平台申请的服务端 Key' },

  provider:        { label: '短信服务商',                 required: true },
  accessKeyId:     { label: 'AccessKeyId（AK 账号）',     required: true },
  accessKeySecret: { label: 'AccessKeySecret（AK 密钥）', required: true },
  signName:        { label: '短信签名',                   placeholder: '例：白夜', required: true },
  templateCode:    { label: '通用验证码模板编码',         placeholder: 'SMS_xxxxxx', required: true },
  templateRegister:{ label: '注册场景模板编码',           placeholder: '留空则使用通用模板' },
  templateLogin:   { label: '登录场景模板编码',           placeholder: '留空则使用通用模板' },
  appId:           { label: '应用 AppID / SmsSdkAppId',   required: true },

  enabled:        { label: '模块启用开关', required: true },
  mchId:          { label: '微信支付商户号 (mch_id)',               required: true },
  mchKey:         { label: '商户 API 密钥 (V3 APIv3 Key)',          placeholder: 'v3 请填 apiv3 密钥', required: true },
  notifyUrl:      { label: '支付结果回调 URL',                      placeholder: 'https://你的域名/api/wallet/wx-notify', required: true },
  certPath:       { label: '商户 API 证书路径 (PEM)',               placeholder: '/data/certs/apiclient_cert.pem' },
  certKey:        { label: '商户证书序列号',                        placeholder: 'cert serial no.' },
  certPrivateKey: { label: '商户私钥 (PEM 完整文本)',               placeholder: '推荐：直接粘贴 apiclient_key.pem 内容', required: true },
  platformCert:   { label: '微信平台证书 (PEM)',                    placeholder: '微信 v3 验签回调证书内容' },

  privateKey: { label: '应用私钥 (RSA PEM 完整文本)', required: true },
  publicKey:  { label: '支付宝平台公钥 (验签用)',     placeholder: '用于回调验签', required: true },
  sandbox:    { label: '使用沙箱环境',                required: true },

  appKey:       { label: '推送 AppKey',           required: true },
  masterSecret: { label: '服务端 MasterSecret',   required: true },
  channelId:    { label: 'Android 通知渠道 ID',   placeholder: '可选，用于国内 ROM 分类通知' },

  region:          { label: 'OSS 地域 Region',       placeholder: 'oss-cn-hangzhou', required: true },
  bucket:          { label: 'OSS 存储桶 Bucket',     placeholder: 'baiye-prod', required: true },
  endpoint:        { label: '自定义 Endpoint',       placeholder: 'ECS 内网可加速' },
  cdnDomain:       { label: 'CDN 加速域名',          placeholder: 'https://cdn.example.com' }
}

function collectTemplate() {
  // 与 seed.js 保持语义一致（顺序：app/sms/wxpay/alipay/push/oss + 业务5项）
  return {
    app: [
      { key: 'name',          type: 'string',  description: '应用名称' },
      { key: 'domain',        type: 'string',  description: '含协议的完整域名，例如 https://baiye.example.com' },
      { key: 'kefuWechat',    type: 'string',  description: '用户端展示的客服微信号' },
      { key: 'kefuQrcode',    type: 'string',  description: '客服二维码图片 URL' },
      { key: 'kefuPhone',     type: 'string',  description: '客服联系电话' },
      { key: 'notice',        type: 'string',  description: '客服/公告说明文案，展示于用户端设置页' },
      { key: 'elite_lifetime_price_fen',   type: 'number', description: '精英终身会员价(分), 默认 30 元' },
      { key: 'unlock_wechat_diamond_cost', type: 'number', description: '扣钻解锁查看微信号价格(钻石/次)' },
      { key: 'platform_commission_rate',   type: 'number', description: '平台抽成比例(0~1), 默认 20%' },
      { key: 'withdraw_min_amount_fen',    type: 'number', description: '最低提现额(分), 默认 10 元' },
      { key: 'withdraw_fee_rate',          type: 'number', description: '提现手续费比例(0~1), 默认 0' },
      { key: 'signInRewardDiamond',        type: 'number', description: '每日签到奖励钻石数, 默认 10' },
      { key: 'geoProvider',                type: 'select', description: '地理逆解服务提供商: "" 或 "off" 表示不启用（将自动降级到 IP + 手动选择）, amap = 高德地图, tencent = 腾讯地图' },
      { key: 'geoKey',                     type: 'secret', description: '地理服务 Web Service Key, geoProvider 启用后必须填写, 否则自动降级' }
    ],
    sms: [
      { key: 'provider',         type: 'select', description: 'aliyun / tencent；留空则短信登录会报错提示配置' },
      { key: 'accessKeyId',      type: 'secret', description: '阿里云/腾讯云 AK Id' },
      { key: 'accessKeySecret',  type: 'secret', description: '阿里云/腾讯云 AK Secret' },
      { key: 'signName',         type: 'string', description: '短信签名（运营商后台审核通过的签名）' },
      { key: 'templateCode',     type: 'string', description: '通用验证码模板编码' },
      { key: 'templateRegister', type: 'string', description: '注册场景模板编码（可选，为空回退到通用模板）' },
      { key: 'templateLogin',    type: 'string', description: '登录场景模板编码（可选，为空回退到通用模板）' }
    ],
    wxpay: [
      { key: 'enabled',        type: 'boolean', description: '开启后发起真实微信支付；关闭时充值/购买会报错提示配置' },
      { key: 'appId',          type: 'secret',  description: '微信开放平台/公众平台/小程序 AppID' },
      { key: 'mchId',          type: 'secret',  description: '微信支付商户号' },
      { key: 'mchKey',         type: 'secret',  description: '商户 API 密钥 (v3 请填 apiv3 key)' },
      { key: 'notifyUrl',      type: 'string',  description: '支付结果异步回调：https://域名/api/wallet/wx-notify' },
      { key: 'certPath',       type: 'string',  description: '商户 API 证书 apiclient_cert.pem 本地路径（生产推荐用 certPrivateKey 替代）' },
      { key: 'certKey',        type: 'string',  description: '商户证书序列号' },
      { key: 'certPrivateKey', type: 'secret',  description: '商户私钥 apiclient_key.pem 完整 PEM 文本（推荐）' }
    ],
    alipay: [
      { key: 'enabled',    type: 'boolean', description: '开启后发起真实支付宝支付；关闭时充值/购买会报错提示配置' },
      { key: 'appId',      type: 'secret',  description: '支付宝开放平台应用 AppID' },
      { key: 'privateKey', type: 'secret',  description: '应用私钥（RSA PRIVATE KEY PEM 完整文本）' },
      { key: 'publicKey',  type: 'secret',  description: '支付宝平台公钥（验签用）' },
      { key: 'notifyUrl',  type: 'string',  description: '支付结果异步回调：https://域名/api/wallet/alipay-notify' },
      { key: 'sandbox',    type: 'boolean', description: '是否使用沙箱环境联调' }
    ],
    push: [
      { key: 'enabled',      type: 'boolean', description: '开启后使用真实离线推送通道；关闭则仅 App 在线时 WS 实时可达' },
      { key: 'provider',     type: 'select',  description: 'jpush(极光推送) / getui(个推)' },
      { key: 'appId',        type: 'secret',  description: '应用 AppID（个推必填）' },
      { key: 'appKey',       type: 'secret',  description: '应用 AppKey' },
      { key: 'masterSecret', type: 'secret',  description: '服务端 MasterSecret（调用推送 API 用）' },
      { key: 'channelId',    type: 'string',  description: 'Android 通知渠道 ID（可选）' }
    ],
    oss: [
      { key: 'provider',        type: 'select', description: 'local=本地存储(单机可用) | aliyun=阿里云 OSS' },
      { key: 'region',          type: 'string', description: '阿里云 OSS Region，例 oss-cn-hangzhou' },
      { key: 'bucket',          type: 'string', description: 'Bucket 名称' },
      { key: 'accessKeyId',     type: 'secret', description: 'AccessKey Id' },
      { key: 'accessKeySecret', type: 'secret', description: 'AccessKey Secret' },
      { key: 'endpoint',        type: 'string', description: '自定义 Endpoint（ECS 内网可填，加速回源）' },
      { key: 'cdnDomain',       type: 'string', description: 'CDN 加速域名（可选）' }
    ]
  }
}

router.get('/config/modules', async (req, res, next) => {
  try {
    const { getModuleConfig } = require('../utils/config')
    const tpl = collectTemplate()
    const list = []
    for (const name of Object.keys(MODULE_META)) {
      const meta = MODULE_META[name]
      const fields = (tpl[name] || []).map(f => {
        const labelMap = FIELD_LABELS[f.key] || {}
        const typeFixed = f.type === 'boolean' ? 'boolean' : f.type
        return {
          key: f.key,
          label: labelMap.label || f.key,
          type: typeFixed,
          description: f.description || '',
          placeholder: labelMap.placeholder || '',
          required: !!labelMap.required,
          options: meta.options?.[f.key] || undefined
        }
      })
      const values = await getModuleConfig(name)
      // 敏感字段打码（保留首尾 3 字符）
      const masked = {}
      for (const f of fields) {
        let v = values?.[f.key]
        if (v === undefined || v === null) v = ''
        if (f.type === 'secret' && typeof v === 'string' && v.length > 6) {
          masked[f.key] = `${v.slice(0, 3)}****${v.slice(-3)}`
        } else {
          masked[f.key] = v
        }
      }
      list.push({
        name,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        description: meta.description,
        fields,
        values: masked
      })
    }
    success(res, list)
  } catch (err) { next(err) }
})

/** 配置中心 · 存储/驱动状态（用于后台配置中心健康条：MySQL SELECT 1 探测 / JSON 文件状态） */
router.get('/config/status', async (req, res, next) => {
  try {
    const db = require('../models')
    const driver = db.usingMysql ? 'mysql' : 'json'
    const info = { driver, ok: true }
    if (db.usingMysql) {
      try {
        const [rows] = await db.sequelize.query('SELECT 1 AS n')
        info.dbOk = rows && Array.isArray(rows) && rows.length && rows[0].n === 1
        const cfg = require('../config').db
        info.target = `${cfg.host}:${cfg.port}/${cfg.name}`
        info.pool = `${cfg.poolMin}-${cfg.poolMax}`
      } catch (err) {
        info.ok = false
        info.dbOk = false
        info.error = err && err.message ? String(err.message) : 'mysql probe failed'
      }
    } else {
      const path = require('path')
      info.target = path.join(__dirname, '..', '..', 'data')
    }
    success(res, info)
  } catch (err) { next(err) }
})

/** 配置中心 · 模块测试连通性 */
router.post('/config/modules/:name/test', async (req, res, next) => {
  try {
    const { getModuleConfig, coerceValue } = require('../utils/config')
    const name = req.params.name
    const tpl = collectTemplate()[name] || []
    // 允许草稿：前端表单当前 values 合并（按字段 type 规范化），优先于缓存 DB 值
    const draftRaw = (req.body && req.body.values && typeof req.body.values === 'object') ? req.body.values : {}
    const saved = (await getModuleConfig(name)) || {}
    const draft = {}
    for (const f of tpl) {
      const k = f.key
      if (draftRaw[k] !== undefined && draftRaw[k] !== null && String(draftRaw[k]).trim() !== '') {
        draft[k] = coerceValue(draftRaw[k], f.type || 'string')
      }
    }
    // 草稿空值优先用保存下来的值（secret 字段常见打码后 0 长度）；否则直接用草稿
    const values = { ...saved, ...draft }

    const realTest = async (label, fn) => {
      const t0 = Date.now()
      try {
        const r = await fn()
        const ms = Date.now() - t0
        return { ok: true, ms, info: r && r.info ? r.info : null, label }
      } catch (e) {
        const ms = Date.now() - t0
        return { ok: false, ms, info: (e && e.message ? e.message : String(e)).slice(0, 160), label }
      }
    }
    // 一个通用网络探测：给定 URL 发一次 OPTIONS/GET 简单握手(最多 8s)，仅做端口+TLS+HTTP 状态码可达性
    const probeHttp = async (url, opts = {}) => {
      if (!url) throw new Error('URL 为空')
      const { URL } = require('url')
      const https = require('https')
      const http = require('http')
      const parsed = new URL(url)
      const lib = parsed.protocol === 'https:' ? https : http
      return new Promise((resolve, reject) => {
        const method = opts.method || 'GET'
        const req2 = lib.request({
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method,
          headers: opts.headers || { 'User-Agent': 'baiye-admin-conn-test/1.0' },
          timeout: Math.min(15000, Math.max(2000, opts.timeoutMs || 8000))
        }, (r) => {
          r.resume()
          if (r.statusCode >= 500) return reject(new Error(`HTTP ${r.statusCode} (服务端错误)`))
          resolve({ statusCode: r.statusCode })
        })
        req2.on('error', reject)
        req2.on('timeout', () => req2.destroy(new Error(`连接超时 (${Math.min(15000, Math.max(2000, opts.timeoutMs || 8000))}ms)`)))
        if (opts.body) req2.write(opts.body)
        req2.end()
      })
    }

    switch (name) {
      case 'sms': {
        const sms = require('../utils/sms')
        const r = sms.validateConfig(values)
        if (!r.ok) return fail(res, r.message)
        // 真·连通性：探测阿里云/腾讯云短信 API 端点是否可达
        const endpoint = r.provider === 'aliyun'
          ? 'https://dysmsapi.aliyuncs.com/'
          : 'https://sms.tencentcloudapi.com/'
        const net = await realTest('network', () => probeHttp(endpoint, { method: 'GET', timeoutMs: 8000 }))
        if (!net.ok) return fail(res, `参数齐全但连通失败：${net.info}（${net.ms}ms）`)
        return success(res, { success: true, provider: r.provider, tookMs: net.ms }, `连通通过：${r.provider} SMS 端点可访问（${net.ms}ms）`)
      }
      case 'wxpay': {
        const wxpay = require('../utils/wxpay')
        const r = wxpay.validateConfig(values)
        if (!r.ok) return fail(res, r.message)
        const sandbox = String(values.sandbox) === 'true'
        const endpoint = sandbox
          ? 'https://api.mch.weixin.qq.com/sandboxnew/pay/micropay'
          : 'https://api.mch.weixin.qq.com/pay/unifiedorder'
        const net = await realTest('network', () => probeHttp(endpoint, { method: 'POST', timeoutMs: 8000, body: '' }))
        if (!net.ok) return fail(res, `参数齐全但连通失败：${net.info}（${net.ms}ms）`)
        return success(res, { success: true, tookMs: net.ms }, `连通通过：${sandbox ? '沙箱' : '正式'}微信支付 ${net.ms}ms`)
      }
      case 'alipay': {
        const alipay = require('../utils/alipay')
        const r = alipay.validateConfig(values)
        if (!r.ok) return fail(res, r.message)
        const sandbox = String(values.sandbox) === 'true'
        const endpoint = sandbox
          ? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
          : 'https://openapi.alipay.com/gateway.do'
        const net = await realTest('network', () => probeHttp(endpoint, { method: 'GET', timeoutMs: 8000 }))
        if (!net.ok) return fail(res, `参数齐全但连通失败：${net.info}（${net.ms}ms）`)
        return success(res, { success: true, tookMs: net.ms }, `连通通过：支付宝${sandbox ? '沙箱' : '正式'}网关 ${net.ms}ms`)
      }
      case 'oss': {
        const oss = require('../utils/oss')
        const r = oss.validateConfig(values)
        if (!r.ok) return fail(res, r.message)
        if (r.provider === 'local') {
          const fs = require('fs')
          const path = require('path')
          const uploadDir = path.join(__dirname, '..', '..', 'uploads')
          const ok = fs.existsSync(uploadDir) ? { ok: true, ms: 0 } : { ok: false, ms: 0, info: `uploads 目录不存在: ${uploadDir}` }
          if (!ok.ok) return fail(res, `本地存储不可用：${ok.info}`)
          return success(res, { success: true, provider: 'local' }, `连通通过：本地存储可用（uploads/）`)
        }
        // 阿里云 OSS：请求 bucket 根路径，返回 403=权限正确（至少网络通），5xx/超时=故障
        const endpoint = `https://${String(values.bucket).trim()}.${String(values.region).trim()}.aliyuncs.com/`
        const net = await realTest('network', () => probeHttp(endpoint, { method: 'GET', timeoutMs: 8000 }))
        if (!net.ok) return fail(res, `参数齐全但 OSS 连通失败：${net.info}（${net.ms}ms）`)
        return success(res, { success: true, provider: r.provider, tookMs: net.ms }, `连通通过：OSS 端点可访问（${net.ms}ms，HTTP ${net.info && net.info.statusCode ? net.info.statusCode : 'OK'}）`)
      }
      case 'push': {
        const push = require('../utils/push')
        const r = await push.validateConfig(values)
        if (!r.ok) return fail(res, r.message)
        const endpoint = r.provider === 'jpush'
          ? 'https://api.jpush.cn/v3/push'
          : 'https://restapi.getui.com/v1/push/single_message'
        const net = await realTest('network', () => probeHttp(endpoint, { method: 'GET', timeoutMs: 8000 }))
        if (!net.ok) return fail(res, `参数齐全但推送连通失败：${net.info}（${net.ms}ms）`)
        return success(res, { success: true, provider: r.provider, tookMs: net.ms }, `连通通过：${r.provider} ${net.ms}ms`)
      }
      case 'ai': {
        // 参数齐全校验 + 真实向 DeepSeek/OpenAI/custom 发一次 /chat/completions 探测请求（空 token 会 401）
        const provider = String(values.backupProvider || values.provider || values.aiProvider || 'deepseek').toLowerCase()
        const apiKey = String(values.backupApiKey || values.apiKey || '').trim()
        if (!apiKey) return fail(res, 'AI backupApiKey 未填写：请在配置中心「AI 大模型接入」填入可用 API Key（推荐 sk-xxx）')
        const isDeepSeek = provider === 'deepseek'
        const apiUrl = String(values.backupApiUrl || values.apiUrl || (isDeepSeek
          ? 'https://api.deepseek.com/v1/chat/completions'
          : 'https://api.openai.com/v1/chat/completions')).trim()
        const model = String(values.backupModel || values.model || (isDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini')).trim()
        const body = JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], stream: false, max_tokens: 1 })
        const net = await realTest('network', async () => {
          try {
            const ret = await probeHttp(apiUrl, {
              method: 'POST',
              timeoutMs: 10000,
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body
            })
            return ret
          } catch (e) {
            // 401/403 视为"连通但鉴权失败"，提示更精准
            const m = String(e.message || '')
            if (/401|403/.test(m)) throw new Error(`接口可达但鉴权失败：${m}。请确认 API Key / 服务商匹配`)
            throw e
          }
        })
        if (!net.ok) return fail(res, `AI 连通失败：${net.info}（${net.ms}ms）`)
        return success(res, { success: true, provider, tookMs: net.ms }, `连通通过：${provider}（${model}）${net.ms}ms`)
      }
      case 'app': {
        if (!values?.name) return fail(res, '应用名称必填')
        return success(res, { success: true }, `配置通过：应用名称=${values.name}`)
      }
      default:
        return fail(res, `不支持的模块: ${name}`, 400)
    }
  } catch (err) {
    // 未安装对应 SDK 会抛 "Cannot find module" 之类
    fail(res, `测试失败：${err.message}`)
  }
})

/** 配置中心 · 重置某模块到 seed 模板默认值 */
router.delete('/config/modules/:name', async (req, res, next) => {
  try {
    const name = req.params.name
    const tpl = collectTemplate()
    const { Config } = require('../models')
    const rows = await Config.findAll({ where: { module: name } })
    const template = tpl[name] || []
    for (const t of template) {
      const row = rows.find(r => r.key === t.key)
      if (row) {
        await row.update({ value: String(t.value ?? '') })
      } else {
        await Config.create({ module: name, key: t.key, value: String(t.value ?? '') })
      }
    }
    // 清配置缓存
    const cache = require('../utils/config')._cache
    if (cache && typeof cache.delete === 'function') cache.delete(name)
    success(res, { name }, '已重置为默认模板')
  } catch (err) { next(err) }
})

// ==========================================================
// T11 新增：动态 / 组局 / Banner / 精英订单 管理
// ==========================================================

/** 动态列表（后台）· 支持分页 / auditStatus 筛选 / keyword（匹配 text 或作者昵称/ID）*/
router.get('/posts', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, auditStatus, kw } = req.query
    const where = {}
    if (auditStatus) where.auditStatus = auditStatus
    const { rows, count } = await Post.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    let list = await Promise.all(rows.map(async p => {
      const u = await User.findByPk(p.userId)
      return {
        ...p.toJSON(),
        userName: u ? (u.nickname || ('U' + u.id)) : '',
        nickname: u ? u.nickname : ''
      }
    }))
    if (kw) {
      const kwStr = String(kw).toLowerCase()
      list = list.filter(o =>
        (o.text || '').toLowerCase().includes(kwStr) ||
        (o.userName || '').toLowerCase().includes(kwStr) ||
        String(o.userId).includes(kwStr)
      )
    }
    paginate(res, list, kw ? list.length : count, page, pageSize)
  } catch (err) { next(err) }
})

/** 动态审核（通过/拒绝） */
router.put('/posts/:id/audit', async (req, res, next) => {
  try {
    const { status } = req.body
    if (!['pending', 'approved', 'rejected'].includes(status)) return fail(res, '审核状态不合法')
    const post = await Post.findByPk(req.params.id)
    if (!post) return fail(res, '动态不存在', 404)
    await post.update({ auditStatus: status, online: status === 'approved' })
    success(res, { id: post.id, auditStatus: status }, '已更新')
  } catch (err) { next(err) }
})

/** 组局列表（后台）· 支持分页 / status 筛选 / keyword（匹配标题/发起人昵称/ID）*/
router.get('/groups', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, status, kw } = req.query
    const where = {}
    if (status) where.status = status
    const { rows, count } = await Group.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    let list = await Promise.all(rows.map(async g => {
      const u = await User.findByPk(g.userId)
      const joins = (g.memberCount !== undefined) ? g.memberCount : 0
      return {
        ...g.toJSON(),
        userName: u ? (u.nickname || ('U' + u.id)) : '',
        joinCount: joins
      }
    }))
    if (kw) {
      const kwStr = String(kw).toLowerCase()
      list = list.filter(o =>
        (o.title || '').toLowerCase().includes(kwStr) ||
        (o.userName || '').toLowerCase().includes(kwStr) ||
        String(o.userId).includes(kwStr)
      )
    }
    paginate(res, list, kw ? list.length : count, page, pageSize)
  } catch (err) { next(err) }
})

/** 后台删除组局 */
router.delete('/groups/:id', async (req, res, next) => {
  try {
    const g = await Group.findByPk(req.params.id)
    if (!g) return fail(res, '组局不存在', 404)
    await g.destroy()
    success(res, null, '已删除')
  } catch (err) { next(err) }
})

/** 后台更新组局（状态/标题等） */
router.put('/groups/:id', async (req, res, next) => {
  try {
    const g = await Group.findByPk(req.params.id)
    if (!g) return fail(res, '组局不存在', 404)
    const body = req.body || {}
    const patch = {}
    if (typeof body.status === 'string') {
      const allowed = ['draft', 'open', 'full', 'closed']
      if (!allowed.includes(body.status)) return fail(res, '非法状态', 400)
      patch.status = body.status
    }
    if (typeof body.title === 'string') patch.title = body.title
    if (typeof body.city === 'string') patch.city = body.city
    if (typeof body.description === 'string') patch.description = body.description
    if (Array.isArray(body.tags)) patch.tags = body.tags
    if (typeof body.expectMax === 'number') patch.expectMax = body.expectMax
    if (typeof body.activityAt === 'string') patch.activityAt = body.activityAt
    if (typeof body.location === 'string') patch.location = body.location
    if (Object.keys(patch).length === 0) return success(res, g, '无变更')
    await g.update(patch)
    success(res, g, '已更新')
  } catch (err) { next(err) }
})

/**
 * Banner 写操作已收敛到 banners.js（通过 /api/banners/admin/banners 别名接管）
 * [deprecated] 以下 3 段重复实现已移除，避免字段校验/鉴权两边漂移。
 * 如需兼容旧调用请走 banners.js 的统一 adminAuth 版本：
 *   GET/POST    /api/banners/admin/banners
 *   PUT/DELETE  /api/banners/admin/banners/:id
 */

/** 精英订单列表（带统计） */
router.get('/elite/orders', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, kw, channel, status } = req.query
    const where = {}
    if (channel) where.channel = channel
    if (status) where.status = status
    const { rows, count } = await EliteOrder.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    let list = rows.map(r => r.toJSON())
    if (kw) {
      const kwStr = String(kw).toLowerCase()
      list = list.filter(o =>
        String(o.userId).includes(kwStr) ||
        (o.outTradeNo || '').toLowerCase().includes(kwStr) ||
        (o.transactionId || '').toLowerCase().includes(kwStr)
      )
    }
    // 统计
    const allPaid = await EliteOrder.findAll({ where: { status: 'paid' } })
    const todayStart = new Date(new Date().toISOString().slice(0, 10)).toISOString()
    const stats = {
      total: await EliteOrder.count(),
      paidCount: allPaid.length,
      revenueFen: allPaid.reduce((s, o) => s + Number(o.amount || 0), 0),
      today: allPaid.filter(o => (o.paidAt || '') >= todayStart).length,
    }
    paginate(res, list, kw ? list.length : count, page, pageSize, { stats })
  } catch (err) { next(err) }
})

// ==========================================================
// 服务分类管理（与 /services/categories 用户端接口同源）
// ==========================================================
/** 构造分类树（含全部，管理后台编辑使用） */
async function adminCategoryTree() {
  const all = await ServiceCategory.findAll({ order: [['sort', 'DESC'], ['key', 'ASC']] })
  const tree = []
  const map = new Map()
  for (const c of all) {
    const j = typeof c.toJSON === 'function' ? c.toJSON() : c
    if (!j.parentKey) {
      const node = { ...j, children: [] }
      tree.push(node)
      map.set(j.key, node)
    }
  }
  for (const c of all) {
    const j = typeof c.toJSON === 'function' ? c.toJSON() : c
    if (!j.parentKey) continue
    const p = map.get(j.parentKey)
    if (!p) continue
    p.children.push({ ...j })
  }
  tree.forEach(t => t.children.sort((a, b) => (Number(b.sort) || 0) - (Number(a.sort) || 0)))
  tree.sort((a, b) => (Number(b.sort) || 0) - (Number(a.sort) || 0))
  return { tree, flat: all.map(c => (typeof c.toJSON === 'function' ? c.toJSON() : c)) }
}

/** 获取分类（全部树结构 + 扁平列表） */
router.get('/service-categories', async (req, res, next) => {
  try {
    const { tree, flat } = await adminCategoryTree()
    success(res, { tree, flat }, 'ok')
  } catch (err) { next(err) }
})

/** 创建分类（顶级 / 二级） */
router.post('/service-categories', async (req, res, next) => {
  try {
    const body = req.body || {}
    const key = String(body.key || '').trim()
    const name = String(body.name || '').trim()
    if (!/^[a-zA-Z0-9_-]{2,64}$/.test(key)) return fail(res, '分类 key 不合法（2-64 位英文/数字/短横线/下划线）')
    if (!name) return fail(res, '分类名称必填')

    const exist = await ServiceCategory.findOne({ where: { key } })
    if (exist) return fail(res, `分类 key 已存在: ${key}`)

    // 若指定 parentKey，必须已存在且本身是顶级分类
    const parentKey = body.parentKey ? String(body.parentKey).trim() : null
    if (parentKey) {
      const p = await ServiceCategory.findOne({ where: { key: parentKey } })
      if (!p) return fail(res, `父级分类不存在: ${parentKey}`)
      if (p.parentKey) return fail(res, '父级分类必须是顶级分类（最多支持二级）')
    }

    const payload = {
      key,
      name,
      parentKey,
      icon: body.icon ? String(body.icon).trim() : null,
      description: body.description ? String(body.description).trim() : null,
      price: Number(body.price) || 0,
      priceUnit: body.priceUnit ? String(body.priceUnit).trim() : null,
      allowCustomPrice: body.allowCustomPrice === false ? false : true,
      visible: body.visible === false ? false : true,
      sort: Number(body.sort) || 0,
      requireAudit: body.requireAudit === false ? false : true,
      tags: Array.isArray(body.tags) ? body.tags : null,
      meta: (body.meta && typeof body.meta === 'object') ? body.meta : null
    }
    const created = await ServiceCategory.create(payload)
    success(res, created.toJSON(), '分类已创建')
  } catch (err) { next(err) }
})

/** 更新分类（按 key 定位，可修改 sort/visible/price 等） */
router.put('/service-categories/:key', async (req, res, next) => {
  try {
    const key = req.params.key
    const row = await ServiceCategory.findOne({ where: { key } })
    if (!row) return fail(res, '分类不存在', 404)
    const body = req.body || {}
    const patch = {}
    const allowPatch = ['name', 'parentKey', 'icon', 'description', 'price', 'priceUnit',
      'allowCustomPrice', 'visible', 'sort', 'requireAudit', 'tags', 'meta']
    for (const k of allowPatch) {
      if (body[k] !== undefined) patch[k] = body[k]
    }
    // parentKey 约束：不能把自己设为子分类
    if (patch.parentKey !== undefined) {
      const newParent = patch.parentKey ? String(patch.parentKey).trim() : null
      if (newParent === key) return fail(res, '父级分类不能是自己')
      if (newParent) {
        const p = await ServiceCategory.findOne({ where: { key: newParent } })
        if (!p) return fail(res, `父级分类不存在: ${newParent}`)
        if (p.parentKey) return fail(res, '父级分类必须是顶级分类（最多支持二级）')
      }
      patch.parentKey = newParent
    }
    // 类型规范化
    if (patch.price !== undefined) patch.price = Number(patch.price) || 0
    if (patch.sort !== undefined) patch.sort = Number(patch.sort) || 0
    if (patch.visible !== undefined) patch.visible = !!patch.visible
    if (patch.allowCustomPrice !== undefined) patch.allowCustomPrice = !!patch.allowCustomPrice
    if (patch.requireAudit !== undefined) patch.requireAudit = !!patch.requireAudit
    if (patch.tags !== undefined && !Array.isArray(patch.tags)) patch.tags = null
    if (patch.meta !== undefined && typeof patch.meta !== 'object') patch.meta = null

    await row.update(patch)
    success(res, row.toJSON(), '分类已更新')
  } catch (err) { next(err) }
})

/** 切换上下架 */
router.put('/service-categories/:key/toggle-visible', async (req, res, next) => {
  try {
    const key = req.params.key
    const row = await ServiceCategory.findOne({ where: { key } })
    if (!row) return fail(res, '分类不存在', 404)
    const nextVisible = !(row.visible !== false)
    await row.update({ visible: nextVisible })
    success(res, { key, visible: nextVisible }, nextVisible ? '已上架' : '已下架')
  } catch (err) { next(err) }
})

/** 删除分类（含子分类保护：若为顶级且有子项，需显式 force=1 或先删除子项） */
router.delete('/service-categories/:key', async (req, res, next) => {
  try {
    const key = req.params.key
    const force = String(req.query.force || '') === '1'
    const row = await ServiceCategory.findOne({ where: { key } })
    if (!row) return fail(res, '分类不存在', 404)
    // 若为顶级分类，检查是否有子项
    if (!row.parentKey) {
      const childCount = await ServiceCategory.count({ where: { parentKey: key } })
      if (childCount > 0 && !force) {
        return fail(res, `该顶级分类下仍有 ${childCount} 个子分类，请先删除子项或使用 force=1 同时删除`)
      }
      if (childCount > 0 && force) {
        await ServiceCategory.destroy({ where: { parentKey: key } })
      }
    }
    await row.destroy()
    success(res, { key }, '分类已删除')
  } catch (err) { next(err) }
})

module.exports = router
