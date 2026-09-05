const express = require('express')
const router = express.Router()
const { Wallet, Transaction, Order, SignIn } = require('../models')
const { auth } = require('../middleware/auth')
const { success, paginate, fail } = require('../utils/response')
const wxpay = require('../utils/wxpay')
const alipay = require('../utils/alipay')
const { getModuleConfig, get } = require('../utils/config')

// 简单进程内锁，防止并发签到双写（Node.js 单线程事件循环内即可安全）
const _signInLock = new Map()
function _dateStr(d = new Date()) {
  const pad = (n, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function _prevDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  return _dateStr(dt)
}

/**
 * 查询签到状态（是否已签 + 连续签到天数 + 当日奖励默认值）
 */
router.get('/sign-in/status', auth, async (req, res, next) => {
  try {
    const today = _dateStr()
    const rewardDefault = Number(await get('app', 'signInRewardDiamond', 10))
    const todayRow = await SignIn.findOne({ where: { userId: req.userId, date: today } })
    const todaySigned = !!todayRow
    // 统计最近连续签到天数（从今天往前数，如果今天没签则从昨天开始数）
    let streak = 0
    let cursor = todaySigned ? today : _prevDateStr(today)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const row = await SignIn.findOne({ where: { userId: req.userId, date: cursor } })
      if (!row) break
      streak += 1
      cursor = _prevDateStr(cursor)
    }
    success(res, { todaySigned, streakDays: streak, rewardDefault, date: today })
  } catch (err) { next(err) }
})

/**
 * 执行每日签到（幂等）
 * - 奖励钻石写入 wallet.diamond
 * - 产生一条 Transaction(type=reward, kind=signIn)
 */
router.post('/sign-in', auth, async (req, res, next) => {
  try {
    const userId = req.userId
    // 进程内锁：防止同一微秒级并发重复签到
    if (_signInLock.get(userId)) return fail(res, '请勿重复签到')
    _signInLock.set(userId, true)
    try {
      const today = _dateStr()
      const exist = await SignIn.findOne({ where: { userId, date: today } })
      if (exist) {
        return success(res, {
          todaySigned: true,
          streakDays: exist.streakDays || 1,
          rewardDiamond: exist.rewardDiamond || 0,
          duplicated: true
        }, '今日已签到')
      }
      const rewardDiamond = Number(await get('app', 'signInRewardDiamond', 10))
      // 连续天数：如果昨天有记录则 streak+1，否则重置为 1
      let streakDays = 1
      const yest = await SignIn.findOne({ where: { userId, date: _prevDateStr(today) } })
      if (yest) streakDays = Number(yest.streakDays || 1) + 1

      let wallet = await Wallet.findOne({ where: { userId } })
      if (!wallet) wallet = await Wallet.create({ userId })
      await wallet.update({ diamond: wallet.diamond + rewardDiamond })
      await SignIn.create({
        userId, date: today, rewardDiamond, streakDays, createdAt: Date.now()
      })
      try {
        await Transaction.create({
          userId,
          type: 'reward',
          kind: 'signIn',
          amount: rewardDiamond,
          currency: 'diamond',
          balanceAfter: wallet.diamond,
          remark: `每日签到奖励（第 ${streakDays} 天连续）`,
          extra: { date: today, streakDays, channel: 'daily_sign_in' }
        })
      } catch (_) {}
      return success(res, {
        todaySigned: true,
        streakDays,
        rewardDiamond,
        balance: wallet.diamond
      }, `签到成功，获得 ${rewardDiamond} 钻石`)
    } finally {
      _signInLock.delete(userId)
    }
  } catch (err) { next(err) }
})

/** 获取钱包余额 */
router.get('/balance', auth, async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ where: { userId: req.userId } })
    if (!wallet) wallet = await Wallet.create({ userId: req.userId })
    const { User } = require('../models')
    const user = await User.findByPk(req.userId, { attributes: ['id', 'giftIncome'] })
    success(res, {
      diamond: wallet.diamond,
      starCoin: wallet.starCoin,
      income: wallet.income,
      withdrawable: wallet.income,
      giftIncome: user ? (user.giftIncome || 0) : 0
    })
  } catch (err) { next(err) }
})

/**
 * 充值钻石（生产级：仅接受真实微信/支付宝，永不直接入账）
 *
 * 真实支付走 wxpay/alipay 官方下单 → 异步回调到账；
 * 未启用对应支付渠道 → 返回明确错误，引导在管理后台配置。
 *
 * body: { amount: 元, channel: 'wxpay'|'alipay', tradeType: 'NATIVE'|'JSAPI'|'wap'|'web' }
 */
router.post('/recharge', auth, async (req, res, next) => {
  try {
    const { amount, channel = 'wxpay', tradeType = 'NATIVE' } = req.body
    if (!amount || Number(amount) <= 0) return fail(res, '充值金额不正确')
    if (!['wxpay', 'alipay'].includes(channel)) return fail(res, '不支持的支付渠道，请选择 wxpay 或 alipay')

    const fenAmount = Math.floor(Number(amount) * 100)
    const diamondAmount = Math.floor(Number(amount) * 10) // 1 元 = 10 钻石
    const outTradeNo = `RC${Date.now()}${Math.floor(Math.random() * 1000)}`

    const wxpayEnabled = await wxpay.isEnabled()
    const alipayEnabled = await alipay.isEnabled()

    if (!wxpayEnabled && !alipayEnabled) {
      return fail(res, '支付服务尚未启用，请联系管理员在管理后台「配置中心」填写微信支付或支付宝参数')
    }

    if (channel === 'wxpay') {
      if (!wxpayEnabled) {
        return fail(res, '微信支付未启用，请在管理后台「配置中心 → 微信支付」打开 enabled 开关并填写完整参数')
      }
      const result = await wxpay.createOrder({
        outTradeNo,
        description: `充值 ${amount} 元获得 ${diamondAmount} 钻石`,
        amountFen: fenAmount,
        tradeType
      })
      if (!result.success) return fail(res, result.message || '微信支付下单失败')
      await Transaction.create({
        userId: req.userId,
        type: 'recharge',
        amount: fenAmount,
        currency: 'fen',
        balanceAfter: 0,
        remark: `微信充值 ${amount} 元（待支付）订单号 ${outTradeNo}`,
        extra: { outTradeNo, channel: 'wxpay', status: 'pending', diamondAmount, tradeType }
      })
      const resp = { payType: 'wxpay', outTradeNo }
      if (result.codeUrl) resp.codeUrl = result.codeUrl
      if (result.prepayId) resp.prepayId = result.prepayId
      if (result.payParams) resp.payParams = result.payParams
      return success(res, resp, '支付订单已创建，请完成支付')
    }

    if (channel === 'alipay') {
      if (!alipayEnabled) {
        return fail(res, '支付宝未启用，请在管理后台「配置中心 → 支付宝」打开 enabled 开关并填写完整参数')
      }
      const appCfg = await getModuleConfig('app')
      const alipayTradeType = tradeType === 'NATIVE' || tradeType === 'JSAPI' ? 'wap' : tradeType
      const result = await alipay.createOrder({
        outTradeNo,
        subject: `充值 ${amount} 元获得 ${diamondAmount} 钻石`,
        amountFen: fenAmount,
        tradeType: alipayTradeType,
        returnUrl: `${appCfg.domain || ''}/pages/recharge/result`
      })
      if (!result.success) return fail(res, result.message || '支付宝下单失败')
      await Transaction.create({
        userId: req.userId,
        type: 'recharge',
        amount: fenAmount,
        currency: 'fen',
        balanceAfter: 0,
        remark: `支付宝充值 ${amount} 元（待支付）订单号 ${outTradeNo}`,
        extra: { outTradeNo, channel: 'alipay', status: 'pending', diamondAmount, tradeType: alipayTradeType }
      })
      const resp = { payType: 'alipay', outTradeNo }
      if (result.payUrl) resp.payUrl = result.payUrl
      if (result.payStr) resp.payStr = result.payStr
      if (result.form) resp.form = result.form
      return success(res, resp, '支付订单已创建，请完成支付')
    }

    return fail(res, '不支持的支付渠道')
  } catch (err) { next(err) }
})

/**
 * 微信支付回调
 * 注意：生产环境必须真实验签，且 req.rawBody 需为原始字符串
 */
router.post('/wx-notify', express.raw({ type: '*/*' }), async (req, res, next) => {
  try {
    const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}))
    req.rawBody = bodyStr
    const result = await wxpay.verifyNotify(req)
    if (!result.verified) {
      return res.status(400).json({ code: 'FAIL', message: '验签失败' })
    }
    const data = result.data || {}
    const outTradeNo = data.out_trade_no
    const transactionId = data.transaction_id
    const amountFen = data.amount?.total

    // 幂等处理：找到对应 pending 的 Transaction
    const tx = await Transaction.findOne({
      where: { type: 'recharge', currency: 'fen', remark: { like: `%${outTradeNo}%` } }
    })
    if (!tx) {
      // 订单不存在，仍返回成功避免微信重试轰炸
      return res.json({ code: 'SUCCESS', message: '成功' })
    }
    // 已处理过：幂等返回
    if (tx.extra && tx.extra.status === 'paid') {
      return res.json({ code: 'SUCCESS', message: '成功' })
    }

    // 入账
    const extra = tx.extra || {}
    const diamondAmount = extra.diamondAmount || Math.floor((amountFen || tx.amount) / 10)
    let wallet = await Wallet.findOne({ where: { userId: tx.userId } })
    if (!wallet) wallet = await Wallet.create({ userId: tx.userId })
    await wallet.update({
      diamond: wallet.diamond + diamondAmount,
      totalRecharge: wallet.totalRecharge + Number(tx.amount)
    })
    await tx.update({
      balanceAfter: wallet.diamond,
      remark: `微信充值已支付（${transactionId || ''}）`,
      extra: { ...extra, status: 'paid', transactionId, paidAt: new Date().toISOString() }
    })

    res.json({ code: 'SUCCESS', message: '成功' })
  } catch (err) {
    console.error('[wxpay-notify]', err)
    res.status(500).json({ code: 'FAIL', message: '服务器错误' })
  }
})

/**
 * 支付宝异步回调
 * 注意：支付宝是表单提交，需要 express.urlencoded
 */
router.post('/alipay-notify', express.urlencoded({ extended: true }), async (req, res, next) => {
  try {
    const params = req.body || {}
    const result = await alipay.verifyNotify(params)
    if (!result.verified) {
      return res.send('fail')
    }
    const outTradeNo = params.out_trade_no
    const tradeStatus = params.trade_status
    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      return res.send('success') // 非成功状态直接应答
    }

    const tx = await Transaction.findOne({
      where: { type: 'recharge', currency: 'fen', remark: { like: `%${outTradeNo}%` } }
    })
    if (!tx) return res.send('success')
    if (tx.extra && tx.extra.status === 'paid') return res.send('success')

    const extra = tx.extra || {}
    const diamondAmount = extra.diamondAmount || Math.floor(Number(tx.amount) / 10)
    let wallet = await Wallet.findOne({ where: { userId: tx.userId } })
    if (!wallet) wallet = await Wallet.create({ userId: tx.userId })
    await wallet.update({
      diamond: wallet.diamond + diamondAmount,
      totalRecharge: wallet.totalRecharge + Number(tx.amount)
    })
    await tx.update({
      balanceAfter: wallet.diamond,
      remark: `支付宝充值已支付（${params.trade_no || ''}）`,
      extra: { ...extra, status: 'paid', tradeNo: params.trade_no, paidAt: new Date().toISOString() }
    })

    res.send('success')
  } catch (err) {
    console.error('[alipay-notify]', err)
    res.send('fail')
  }
})

/** 钻石兑换星币（1 钻石 = 1 星币） */
router.post('/exchange', auth, async (req, res, next) => {
  try {
    const { count } = req.body
    if (!count || count <= 0) return fail(res, '兑换数量不正确')
    let wallet = await Wallet.findOne({ where: { userId: req.userId } })
    if (!wallet) wallet = await Wallet.create({ userId: req.userId })
    if (wallet.diamond < count) return fail(res, '钻石余额不足')

    await wallet.update({
      diamond: wallet.diamond - count,
      starCoin: wallet.starCoin + count
    })
    await Transaction.create({
      userId: req.userId,
      type: 'exchange',
      amount: count,
      currency: 'star',
      balanceAfter: wallet.starCoin,
      remark: `兑换 ${count} 星币`
    })
    success(res, { diamond: wallet.diamond, starCoin: wallet.starCoin }, '兑换成功')
  } catch (err) { next(err) }
})

/**
 * 提现申请 — 生产级：
 *   - 严格校验配置的最低提现额 + 手续费率
 *   - 仅创建待审核申请，后续由管理后台线下打款并标记成功
 *   - 不再自动扣 income 后直接标记成功
 */
router.post('/withdraw', auth, async (req, res, next) => {
  try {
    const { amount, channel = 'wechat', account = '', accountName = '' } = req.body
    if (!amount || Number(amount) < 1) return fail(res, '提现金额不正确')
    if (!['wechat', 'alipay', 'bank'].includes(channel)) return fail(res, '不支持的提现渠道')
    if (!account) return fail(res, '请填写收款账号')

    const appCfg = await getModuleConfig('app')
    const minFen = Number(appCfg.withdraw_min_amount_fen || 1000) // 默认 10 元
    const feeRate = Number(appCfg.withdraw_fee_rate || 0)
    const commissionRate = Number(appCfg.platform_commission_rate || 0)

    const requestFen = Math.floor(Number(amount) * 100)
    if (requestFen < minFen) {
      return fail(res, `最低提现金额为 ${(minFen / 100).toFixed(2)} 元`)
    }

    let wallet = await Wallet.findOne({ where: { userId: req.userId } })
    if (!wallet) wallet = await Wallet.create({ userId: req.userId })

    // 收入扣除平台抽成后的可提现部分（这里按 income 总额 = 已经扣过抽成的，所以直接用）
    if (wallet.income < requestFen) return fail(res, '可提现收入不足')

    const feeFen = Math.floor(requestFen * feeRate)
    const actualArrivalFen = requestFen - feeFen
    if (actualArrivalFen <= 0) return fail(res, '提现金额扣除手续费后为 0，请增加提现金额')

    // 扣减 income，创建待审核流水；审核通过后管理员在后台调用标记接口（此处保持幂等）
    await wallet.update({
      income: wallet.income - requestFen,
      totalWithdraw: wallet.totalWithdraw + requestFen
    })
    await Transaction.create({
      userId: req.userId,
      type: 'withdraw',
      amount: requestFen,
      currency: 'fen',
      balanceAfter: wallet.income,
      remark: `提现 ${(requestFen / 100).toFixed(2)} 元到${channel === 'wechat' ? '微信零钱' : (channel === 'alipay' ? '支付宝' : '银行卡')}（待审核）`,
      extra: {
        status: 'pending',
        channel,
        account,
        accountName: accountName || '',
        applyAmount: requestFen,
        fee: feeFen,
        actualArrival: actualArrivalFen,
        commissionRate
      }
    })

    success(res, {
      applyAmount: requestFen,
      fee: feeFen,
      actualArrival: actualArrivalFen,
      status: 'pending'
    }, `提现申请已提交（扣手续费 ${(feeFen / 100).toFixed(2)} 元），等待审核`)
  } catch (err) { next(err) }
})

/** 交易记录 */
router.get('/transactions', auth, async (req, res, next) => {
  try {
    const { type, page = 1, pageSize = 20 } = req.query
    const where = { userId: req.userId }
    if (type) where.type = type
    const { rows, count } = await Transaction.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    paginate(res, rows, count, page, pageSize)
  } catch (err) { next(err) }
})

module.exports = router
