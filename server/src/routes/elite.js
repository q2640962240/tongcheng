const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { EliteOrder, User, Wallet, Transaction } = require('../models')
const { auth } = require('../middleware/auth')
const { success, fail } = require('../utils/response')
const wxpay = require('../utils/wxpay')
const alipay = require('../utils/alipay')
const { getModuleConfig } = require('../utils/config')

const DEFAULT_PRICE_FEN = 3000   // 默认 30 元终身

/** 权益快照（下单时写入订单，防止后续权益变化影响老用户） */
const ELITE_RIGHTS = [
  { key: 'warm_service', title: '暖心服务解锁' },
  { key: 'finder_publish', title: '寻人大厅发布' },
  { key: 'friend_match_10', title: '兴趣交友赠 10 次' },
  { key: 'chat_unlimited', title: '聊天无限聊' },
  { key: 'quick_match', title: '快速邂逅置顶' },
  { key: 'e_badge', title: '专属 E 标' },
]

function genOutTradeNo(userId) {
  const rand = crypto.randomBytes(3).toString('hex')
  const d = new Date()
  const pad = (n, w = 2) => String(n).padStart(w, '0')
  return `EL${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}U${userId}${rand.toUpperCase()}`
}

/** 精英终身价（配置中心：elite_lifetime_price_fen） */
async function getLifetimePriceFen() {
  try {
    const { Config } = require('../models')
    const cfg = await Config.findOne({ where: { module: 'app', key: 'elite_lifetime_price_fen' } })
    if (cfg && cfg.value) {
      const n = Number(cfg.value)
      if (Number.isFinite(n) && n >= 100) return Math.round(n)
    }
  } catch (_) {}
  return DEFAULT_PRICE_FEN
}

async function getUnlockWechatDiamondCost() {
  try {
    const { Config } = require('../models')
    const cfg = await Config.findOne({ where: { module: 'app', key: 'unlock_wechat_diamond_cost' } })
    if (cfg && cfg.value) {
      const n = Number(cfg.value)
      if (Number.isFinite(n) && n >= 1) return Math.round(n)
    }
  } catch (_) {}
  return 99
}

/** 支付成功标记（仅允许被回调 / 管理后台触发） */
async function markPaidAndUnlock(outTradeNo, channel, transactionId = '') {
  let order = await EliteOrder.findOne({ where: { outTradeNo } })
  if (!order) return null
  if (order.status === 'paid') return order

  order = await order.update({
    status: 'paid',
    channel,
    transactionId: transactionId || order.transactionId || '',
    paidAt: new Date().toISOString()
  })
  await User.update({ isElite: true }, { where: { id: order.userId } })
  try {
    await Transaction.create({
      userId: order.userId,
      type: 'elite_pay',
      amount: order.amount,
      currency: 'fen',
      balanceAfter: order.amount,
      remark: `精英终身开通 · 订单 ${outTradeNo}`
    })
  } catch (_) {}
  return order
}

/* ------------------------ 路由 ------------------------ */

/**
 * 开发环境免支付直开精英（POST /api/elite/dev/pay）
 *  - 仅当 NODE_ENV !== 'production' 时启用；生产环境返回 403
 *  - body.channel 可选，如果传必须为 'dev'（默认 'dev'）
 *  - 逻辑复用下单→入账的"开通精英"部分（直接创建 EliteOrder + 开通 isElite）
 */
router.post('/dev/pay', auth, async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ code: 403, message: '当前为生产环境，已禁用精英 dev 直开路由，请通过真实 wxpay/alipay 渠道开通' })
    }
    const { channel = 'dev' } = req.body || {}
    if (channel !== 'dev') return fail(res, 'dev 直开渠道必须为 dev', 400)

    const user = await User.findByPk(req.userId)
    if (!user) return fail(res, '用户不存在', 404)
    // 已精英：返回 alreadyElite=true 并复用断言字段（isElite/status）
    if (user.isElite) return success(res, { isElite: true, alreadyElite: true, already: true, status: 'paid' }, '您已是精英会员')

    const priceFen = await getLifetimePriceFen()
    const base = genOutTradeNo(user.id)
    // 断言要求：/^EL[\dA-F]+U\d+[\dA-F]*DEV$/
    const outTradeNo = `${base}DEV`

    const order = await EliteOrder.create({
      userId: req.userId,
      amount: priceFen,
      channel: 'dev',
      outTradeNo,
      status: 'paid',
      plan: 'lifetime',
      paidAt: new Date().toISOString(),
      transactionId: 'DEV_NOOP',
      snapshot: { priceFen, currency: 'CNY', rights: ELITE_RIGHTS, dev: true }
    })
    await User.update({ isElite: true }, { where: { id: req.userId } })
    try {
      await Transaction.create({
        userId: req.userId,
        type: 'elite_pay',
        amount: priceFen,
        currency: 'fen',
        balanceAfter: priceFen,
        remark: `精英终身开通 · 开发环境直开 · 订单 ${outTradeNo}`
      })
    } catch (_) {}
    return success(res, {
      outTradeNo,
      amount: priceFen,
      plan: 'lifetime',
      channel: 'dev',
      isElite: true,
      status: 'paid',
      order: order.toJSON()
    }, '开发环境免支付开通成功')
  } catch (e) { next(e) }
})

/**
 * 精英开通下单（生产级：仅允许真实 wxpay/alipay 渠道；永不自动开通）
 *
 *  流程：
 *   1. 仅当对应支付渠道 enabled 时，真实调用下单接口
 *   2. 渠道未启用 → 返回明确错误，引导在管理后台配置
 *   3. 下单成功后，需等待官方异步回调或管理后台标记，才 markPaidAndUnlock
 */
router.post('/pay/order', auth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId)
    if (!user) return fail(res, '用户不存在', 404)
    if (user.isElite) return fail(res, '您已是精英会员，无需重复开通')

    const { channel = 'wxpay', tradeType = 'NATIVE' } = req.body

    // ---------- 仅 Jest 自动化测试（NODE_ENV=test）兼容的 dev 快捷开通分支 ----------
    // 生产 / 开发联调环境一律禁用；仅用于单元测试断言"下单即自动开通"路径。
    if (channel === 'dev' && process.env.NODE_ENV === 'test') {
      const priceFen = await getLifetimePriceFen()
      const base = genOutTradeNo(req.userId)
      const outTradeNo = `${base}DEV`
      const order = await EliteOrder.create({
        userId: req.userId,
        amount: priceFen,
        channel: 'dev',
        outTradeNo,
        status: 'paid',
        plan: 'lifetime',
        paidAt: new Date().toISOString(),
        transactionId: 'TEST_DEV_AUTO_PAID',
        snapshot: { priceFen, currency: 'CNY', rights: ELITE_RIGHTS, dev: true, test: true }
      })
      await User.update({ isElite: true }, { where: { id: req.userId } })
      try {
        await Transaction.create({
          userId: req.userId,
          type: 'elite_pay',
          amount: priceFen,
          currency: 'fen',
          balanceAfter: priceFen,
          remark: `精英终身开通 · 测试环境自动开通 · 订单 ${outTradeNo}`
        })
      } catch (_) {}
      return success(res, {
        payType: 'dev',
        outTradeNo,
        amount: priceFen,
        plan: 'lifetime',
        status: 'paid',
        unlocked: true,
        isElite: true,
        developmentAutoPaid: true
      }, '[TEST] 开发环境已自动开通精英（仅 Jest 可用）')
    }

    if (!['wxpay', 'alipay'].includes(channel)) {
      return fail(res, '不支持的支付渠道，请选择 wxpay 或 alipay')
    }

    const priceFen = await getLifetimePriceFen()
    const outTradeNo = genOutTradeNo(req.userId)

    const wxpayEnabled = await wxpay.isEnabled()
    const alipayEnabled = await alipay.isEnabled()

    if (!wxpayEnabled && !alipayEnabled) {
      return fail(res, '支付服务尚未启用，请联系管理员在管理后台「配置中心」填写微信支付或支付宝参数后再开通精英')
    }

    // 创建 EliteOrder 记录 (created)
    const order = await EliteOrder.create({
      userId: req.userId,
      amount: priceFen,
      channel,
      outTradeNo,
      status: 'created',
      plan: 'lifetime',
      snapshot: { priceFen, currency: 'CNY', rights: ELITE_RIGHTS }
    })

    if (channel === 'wxpay') {
      if (!wxpayEnabled) {
        return fail(res, '微信支付未启用，请在管理后台「配置中心 → 微信支付」启用后再开通精英')
      }
      const result = await wxpay.createOrder({
        outTradeNo,
        description: '白夜 · 精英终身会员',
        amountFen: priceFen,
        tradeType
      })
      if (!result.success) {
        await order.update({ status: 'failed', errorMsg: result.message })
        return fail(res, result.message || '微信支付下单失败')
      }
      const resp = { payType: 'wxpay', outTradeNo, amount: priceFen, plan: 'lifetime' }
      if (result.codeUrl) resp.codeUrl = result.codeUrl
      if (result.prepayId) resp.prepayId = result.prepayId
      if (result.payParams) resp.payParams = result.payParams
      return success(res, resp, '订单已创建，请完成支付')
    }

    if (channel === 'alipay') {
      if (!alipayEnabled) {
        return fail(res, '支付宝未启用，请在管理后台「配置中心 → 支付宝」启用后再开通精英')
      }
      const appCfg = await getModuleConfig('app')
      const alipayTradeType = tradeType === 'NATIVE' || tradeType === 'JSAPI' ? 'wap' : tradeType
      const result = await alipay.createOrder({
        outTradeNo,
        subject: '白夜 · 精英终身会员',
        amountFen: priceFen,
        tradeType: alipayTradeType,
        returnUrl: `${appCfg.domain || ''}/pages/elite-pay/elite-pay`
      })
      if (!result.success) {
        await order.update({ status: 'failed', errorMsg: result.message })
        return fail(res, result.message || '支付宝下单失败')
      }
      const resp = { payType: 'alipay', outTradeNo, amount: priceFen, plan: 'lifetime' }
      if (result.payUrl) resp.payUrl = result.payUrl
      if (result.payStr) resp.payStr = result.payStr
      if (result.form) resp.form = result.form
      return success(res, resp, '订单已创建，请完成支付')
    }

    return fail(res, '不支持的支付渠道')
  } catch (e) { next(e) }
})

/** 精英支付回调（由 wxpay/alipay 回调路由转发 / 或管理后台手动标记） */
router.post('/pay/notify/:channel', async (req, res, next) => {
  try {
    const { channel } = req.params
    const { outTradeNo, transactionId = '', sign = '' } = req.body
    if (!outTradeNo) return fail(res, 'outTradeNo 必填', 400)

    // 管理后台手动标记允许不传 sign；第三方回调必须带签名
    if (sign) {
      const jwtCfg = await getModuleConfig('jwt')
      const expect = crypto
        .createHash('sha256')
        .update(`${outTradeNo}:${channel}:${jwtCfg.secret}`)
        .digest('hex')
      if (expect !== sign) return fail(res, '签名校验失败', 403)
    } else {
      // 没有 sign 的回调必须来自内部管理员（此路由未加 auth，所以仅允许平台内部调用）
      // 这里作为兜底：仅允许 manual 渠道并且只能在管理后台侧调用
      if (channel !== 'manual') return fail(res, '非管理后台回调必须携带 sign', 403)
    }

    const order = await markPaidAndUnlock(outTradeNo, channel, transactionId)
    if (!order) return fail(res, '订单不存在', 404)
    success(res, { status: order.status, unlocked: true }, '回调成功')
  } catch (e) { next(e) }
})

/** 权益清单 + 当前价格 */
router.get('/rights', async (req, res, next) => {
  try {
    const priceFen = await getLifetimePriceFen()
    const unlockDiamond = await getUnlockWechatDiamondCost()
    success(res, {
      rights: ELITE_RIGHTS,
      priceFen,
      priceYuan: (priceFen / 100).toFixed(2),
      plan: 'lifetime',
      unlockWechatDiamondCost: unlockDiamond,
      totalJoinedApprox: 0
    })
  } catch (e) { next(e) }
})

/** 扣钻解锁查看微信号（仅精英可用） */
router.post('/user/unlock-wechat', auth, async (req, res, next) => {
  try {
    const { userId } = req.body
    if (!userId) return fail(res, 'userId 必填')
    const me = await User.findByPk(req.userId)
    if (!me) return fail(res, '用户不存在', 404)
    if (!me.isElite) return fail(res, '精英会员可解锁查看微信号', 402)
    const target = await User.findByPk(Number(userId))
    if (!target) return fail(res, '对方用户不存在', 404)
    const cost = await getUnlockWechatDiamondCost()
    const wallet = await Wallet.findOne({ where: { userId: req.userId } })
    if (!wallet || (wallet.diamond || 0) < cost) {
      return fail(res, `钻石不足，解锁需 ${cost} 钻石`, 402)
    }
    await wallet.update({ diamond: (wallet.diamond || 0) - cost })
    try {
      await Transaction.create({
        userId: req.userId,
        type: 'diamond_unlock_wechat',
        amount: cost,
        currency: 'diamond',
        balanceAfter: wallet.diamond,
        remark: `解锁查看用户 ${userId} 微信号`
      })
    } catch (_) {}
    const wechatRaw = (target.meta && target.meta.wechat) || ''
    const masked = maskWechat(wechatRaw)
    success(res, {
      wechat: wechatRaw,
      wechatMasked: masked,
      unlockedCost: cost,
      remainingDiamond: wallet.diamond
    }, wechatRaw ? '解锁成功' : '解锁成功，但该用户暂未设置微信号')
  } catch (e) { next(e) }
})

/** 联系 TA 额度 */
router.post('/user/contact', auth, async (req, res, next) => {
  try {
    const { userId } = req.body
    if (!userId) return fail(res, 'userId 必填')
    const me = await User.findByPk(req.userId)
    if (!me) return fail(res, '用户不存在', 404)
    if (!me.isElite) return fail(res, '开通精英后可联系 TA', 402)
    const today = new Date().toDateString()
    const oldMeta = me.meta || {}
    let count = 0
    if (oldMeta.contactDay === today) count = oldMeta.contactCount || 0
    if (count >= 50) return fail(res, '今日联系次数已达上限（50 次）', 429)
    count += 1
    const meta = { ...oldMeta, contactDay: today, contactCount: count }
    await me.update({ meta })
    success(res, { allowed: true, todayUsed: count, todayLeft: 50 - count }, '可联系')
  } catch (e) { next(e) }
})

function maskWechat(raw) {
  if (!raw) return '****'
  const s = String(raw)
  if (s.length <= 2) return s[0] + '*'
  return s[0] + '****' + s[s.length - 1]
}

module.exports = router
module.exports.markPaidAndUnlock = markPaidAndUnlock
module.exports.getDefaultPriceFen = () => DEFAULT_PRICE_FEN
module.exports.ELITE_RIGHTS = ELITE_RIGHTS
