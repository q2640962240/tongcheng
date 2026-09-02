const express = require('express')
const router = express.Router()
const { Order, Service, User, Wallet, Invite, Transaction, Review } = require('../models')
const { auth } = require('../middleware/auth')
const { success, paginate, fail } = require('../utils/response')
const push = require('../utils/push')

/** 在线推送（Socket.IO）+ 离线推送 */
async function notifyUser(userId, event, data, pushNotification) {
  // Socket.IO 在线推送
  const { emitToUser } = require('../app')
  if (typeof emitToUser === 'function') {
    emitToUser(userId, event, data)
  }
  // 离线推送（极光/个推）
  if (pushNotification) {
    push.pushToUser(userId, pushNotification).catch(() => {})
  }
}

/** 生成订单号 */
const genOrderNo = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `CP${ts}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
}

/** 计算会话ID */
const sessionId = (a, b) => [a, b].sort().join('-')

/** 创建订单 */
router.post('/', auth, async (req, res, next) => {
  try {
    const { serviceId, quantity = 1, remark, price, priceUnit } = req.body
    if (!serviceId) return fail(res, '请选择服务')
    const service = await Service.findByPk(serviceId)
    if (!service) return fail(res, '服务不存在', 404)
    if (service.providerId === req.userId) return fail(res, '不能购买自己的服务')

    const finalPrice = Number(price || service.price) || 0
    const amount = finalPrice * (quantity || 1)
    const order = await Order.create({
      orderNo: genOrderNo(),
      userId: req.userId,
      providerId: service.providerId,
      serviceId: service.id,
      serviceTitle: service.title,
      price: finalPrice,
      priceUnit: priceUnit || service.priceUnit || '',
      amount,
      quantity,
      duration: service.duration,
      remark,
      status: 'pending'
    })
    success(res, order, '订单创建成功')
  } catch (err) { next(err) }
})

/** 支付订单（星币） */
router.post('/:id/pay', auth, async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    if (order.userId !== req.userId) return fail(res, '无权操作', 403)
    if (order.status !== 'pending') return fail(res, '订单状态不允许支付')

    const wallet = await Wallet.findOne({ where: { userId: req.userId } })
    if (!wallet || wallet.starCoin < order.amount) {
      return fail(res, '星币不足，请先充值')
    }

    // 扣减星币
    await wallet.update({
      starCoin: wallet.starCoin - order.amount
    })

    // 记录交易
    await Transaction.create({
      userId: req.userId,
      type: 'consume',
      amount: order.amount,
      currency: 'star',
      balanceAfter: wallet.starCoin,
      orderId: order.id,
      remark: `购买服务：${order.serviceTitle}`
    })

    // 更新订单
    await order.update({
      status: 'paid',
      payMethod: 'star_coin',
      paidAt: new Date().toISOString()
    })

    // 通知服务者：新订单已支付
    notifyUser(order.providerId, 'order:paid', {
      orderId: order.id, orderNo: order.orderNo, serviceTitle: order.serviceTitle, amount: order.amount
    }, {
      title: '新订单',
      body: `用户已支付「${order.serviceTitle}」，请及时开始服务`,
      extras: { type: 'order', orderId: order.id, action: 'paid' }
    })

    success(res, order, '支付成功')
  } catch (err) { next(err) }
})

/** 订单列表 */
router.get('/', auth, async (req, res, next) => {
  try {
    const { role = 'user', status, page = 1, pageSize = 10 } = req.query
    const where = {}
    if (role === 'provider') where.providerId = req.userId
    else where.userId = req.userId
    if (status) where.status = status

    const { rows, count } = await Order.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })

    // 附加对方信息
    const result = []
    for (const o of rows) {
      const otherId = role === 'provider' ? o.userId : o.providerId
      const other = await User.findByPk(otherId)
      result.push({ ...o.toJSON(), counterpart: other ? {
        id: other.id, nickname: other.nickname, avatar: other.avatar
      } : null })
    }
    paginate(res, result, count, page, pageSize)
  } catch (err) { next(err) }
})

/** 订单详情 */
router.get('/:id', auth, async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    if (order.userId !== req.userId && order.providerId !== req.userId) {
      return fail(res, '无权查看', 403)
    }
    const service = await Service.findByPk(order.serviceId)
    const user = await User.findByPk(order.userId)
    const provider = await User.findByPk(order.providerId)
    success(res, {
      ...order.toJSON(),
      service: service ? service.toJSON() : null,
      user: user ? { id: user.id, nickname: user.nickname, avatar: user.avatar } : null,
      provider: provider ? { id: provider.id, nickname: provider.nickname, avatar: provider.avatar } : null
    })
  } catch (err) { next(err) }
})

/** 取消订单 */
router.put('/:id/cancel', auth, async (req, res, next) => {
  try {
    const { cancelReason } = req.body
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    if (order.userId !== req.userId) return fail(res, '无权操作', 403)
    if (!['pending', 'paid'].includes(order.status)) {
      return fail(res, '当前状态不可取消')
    }

    // 已支付的退款到星币
    if (order.status === 'paid') {
      const wallet = await Wallet.findOne({ where: { userId: req.userId } })
      if (wallet) {
        await wallet.update({ starCoin: wallet.starCoin + order.amount })
        await Transaction.create({
          userId: req.userId,
          type: 'refund',
          amount: order.amount,
          currency: 'star',
          balanceAfter: wallet.starCoin,
          orderId: order.id,
          remark: `订单取消退款：${order.orderNo}`
        })
      }
    }

    await order.update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelReason
    })

    // 通知服务者：订单已取消
    notifyUser(order.providerId, 'order:cancelled', {
      orderId: order.id, orderNo: order.orderNo, serviceTitle: order.serviceTitle
    }, {
      title: '订单取消',
      body: `订单「${order.serviceTitle}」已被用户取消`,
      extras: { type: 'order', orderId: order.id, action: 'cancelled' }
    })

    success(res, null, '订单已取消')
  } catch (err) { next(err) }
})

/** 用户申请退款 */
router.post('/:id/refund', auth, async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    if (order.userId !== req.userId) return fail(res, '无权操作', 403)
    if (!['paid', 'serving'].includes(order.status)) return fail(res, '当前状态不可退款')
    await order.update({ status: 'refunding' })

    // 通知服务者：用户申请退款
    notifyUser(order.providerId, 'order:refund', {
      orderId: order.id, orderNo: order.orderNo, serviceTitle: order.serviceTitle
    }, {
      title: '退款申请',
      body: `用户申请退款「${order.serviceTitle}」，请及时处理`,
      extras: { type: 'order', orderId: order.id, action: 'refunding' }
    })

    success(res, null, '退款申请已提交')
  } catch (err) { next(err) }
})

/** 服务者确认开始服务 */
router.put('/:id/start', auth, async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    if (order.providerId !== req.userId) return fail(res, '无权操作', 403)
    if (order.status !== 'paid') return fail(res, '订单未支付')

    await order.update({ status: 'serving', startedAt: new Date().toISOString() })

    // 通知买家：服务已开始
    notifyUser(order.userId, 'order:serving', {
      orderId: order.id, orderNo: order.orderNo, serviceTitle: order.serviceTitle
    }, {
      title: '服务已开始',
      body: `服务者已开始「${order.serviceTitle}」`,
      extras: { type: 'order', orderId: order.id, action: 'serving' }
    })

    success(res, null, '服务已开始')
  } catch (err) { next(err) }
})

/** 服务者确认完成 */
router.put('/:id/confirm', auth, async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    if (order.providerId !== req.userId) return fail(res, '无权操作', 403)
    if (order.status !== 'serving') return fail(res, '当前状态不可确认')

    await order.update({ status: 'completed', completedAt: new Date().toISOString() })

    // 结算服务者收入（平台抽成 20%，服务者得 80%）
    // 注意：order.amount 单位是星币（1 星币 = 10 分，充值 1 元 = 10 星币），转分需 ×10 而非 ×100
    const PLATFORM_RATE = 0.2
    const providerIncome = Math.floor(order.amount * 10 * (1 - PLATFORM_RATE))
    const providerWallet = await Wallet.findOne({ where: { userId: order.providerId } })
    if (providerWallet) {
      await providerWallet.update({ income: providerWallet.income + providerIncome })
      await Transaction.create({
        userId: order.providerId,
        type: 'income',
        amount: providerIncome,
        currency: 'fen',
        balanceAfter: providerWallet.income,
        orderId: order.id,
        remark: `服务收入：${order.serviceTitle}`
      })
    }

    // 邀请分红：邀请人获消费金额 10%（用户为消费者）
    const inviteeLink = await Invite.findOne({ where: { inviteeId: order.userId } })
    if (inviteeLink) {
      const reward = Math.floor(order.amount * 10 * 0.1)
      if (reward > 0) {
        await inviteeLink.update({ totalReward: inviteeLink.totalReward + reward })
        const inviterWallet = await Wallet.findOne({ where: { userId: inviteeLink.inviterId } })
        if (inviterWallet) {
          await inviterWallet.update({ income: inviterWallet.income + reward })
          await Transaction.create({
            userId: inviteeLink.inviterId,
            type: 'reward',
            amount: reward,
            currency: 'fen',
            balanceAfter: inviterWallet.income,
            orderId: order.id,
            remark: `邀请分红：${order.serviceTitle}`
          })
        }
      }
    }

    // 服务者的邀请人也分 10%（用户为服务者）
    const providerLink = await Invite.findOne({ where: { inviteeId: order.providerId } })
    if (providerLink) {
      const reward = Math.floor(providerIncome * 0.1)
      if (reward > 0) {
        await providerLink.update({ totalReward: providerLink.totalReward + reward })
        const inviterWallet = await Wallet.findOne({ where: { userId: providerLink.inviterId } })
        if (inviterWallet) {
          await inviterWallet.update({ income: inviterWallet.income + reward })
          await Transaction.create({
            userId: providerLink.inviterId,
            type: 'reward',
            amount: reward,
            currency: 'fen',
            balanceAfter: inviterWallet.income,
            orderId: order.id,
            remark: `邀请分红（服务者）：${order.serviceTitle}`
          })
        }
      }
    }

    // 通知买家：服务已完成，请评价
    notifyUser(order.userId, 'order:completed', {
      orderId: order.id, orderNo: order.orderNo, serviceTitle: order.serviceTitle
    }, {
      title: '服务已完成',
      body: `「${order.serviceTitle}」已完成，请及时评价`,
      extras: { type: 'order', orderId: order.id, action: 'completed' }
    })

    success(res, null, '订单已完成')
  } catch (err) { next(err) }
})

/** 提交评价（买家，订单完成后） */
router.post('/:id/review', auth, async (req, res, next) => {
  try {
    const { rating, content, images, isAnonymous } = req.body
    if (!rating || rating < 1 || rating > 5) return fail(res, '评分需在 1-5 星之间')

    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    if (order.userId !== req.userId) return fail(res, '无权操作', 403)
    if (order.status !== 'completed') return fail(res, '订单完成后才能评价')

    const exist = await Review.findOne({ where: { orderId: order.id } })
    if (exist) return fail(res, '已评价过该订单')

    await Review.create({
      orderId: order.id,
      serviceId: order.serviceId,
      userId: req.userId,
      providerId: order.providerId,
      rating: Math.floor(rating),
      content,
      images: images || [],
      isAnonymous: !!isAnonymous
    })

    // 更新服务评分统计
    const service = await Service.findByPk(order.serviceId)
    if (service) {
      const reviews = await Review.findAll({ where: { serviceId: service.id } })
      const avg = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
      await service.update({ ratingAvg: Math.round(avg * 10) / 10 })
    }

    success(res, null, '评价提交成功')
  } catch (err) { next(err) }
})

/** 查询订单是否已评价 */
router.get('/:id/review', auth, async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    if (order.userId !== req.userId && order.providerId !== req.userId) {
      return fail(res, '无权查看', 403)
    }
    const review = await Review.findOne({ where: { orderId: order.id } })
    if (!review) {
      return success(res, {
        hasReview: false,
        rating: null,
        content: '',
        images: [],
        isAnonymous: false,
        reviewer: null,
        createdAt: null
      })
    }
    let reviewer = null
    if (!review.isAnonymous) {
      const u = await User.findByPk(review.userId)
      reviewer = u ? { nickname: u.nickname, avatar: u.avatar } : null
    }
    success(res, { ...review.toJSON(), reviewer, hasReview: true })
  } catch (err) { next(err) }
})

/** 服务的评价列表 */
router.get('/:id/reviews', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10 } = req.query
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    const { rows, count } = await Review.findAndCountAll({
      where: { serviceId: order.serviceId },
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    const result = []
    for (const r of rows) {
      let reviewer = null
      if (!r.isAnonymous) {
        const u = await User.findByPk(r.userId)
        reviewer = u ? { nickname: u.nickname, avatar: u.avatar } : null
      }
      result.push({ ...r.toJSON(), reviewer })
    }
    paginate(res, result, count, page, pageSize)
  } catch (err) { next(err) }
})

module.exports = router
