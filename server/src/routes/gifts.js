const express = require('express')
const router = express.Router()
const { Op } = require('sequelize')
const { Gift, GiftRecord, User, Wallet, Transaction, Message, sequelize } = require('../models')
const { auth } = require('../middleware/auth')
const { success, fail } = require('../utils/response')
const { get, getModuleConfig } = require('../utils/config')

/** 获取上架礼物列表（按 sort 排序） */
router.get('/', async (req, res, next) => {
  try {
    const gifts = await Gift.findAll({
      where: { active: true },
      order: [['sort', 'ASC']],
      attributes: ['id', 'name', 'imageUrl', 'price', 'sort', 'animationLevel']
    })
    success(res, gifts)
  } catch (err) { next(err) }
})

/** 发送礼物（需鉴权）— 服务端权威：扣钻 + 加收入 + 建消息 + WS推送 + IM转发 */
router.post('/send', auth, async (req, res, next) => {
  const t = await sequelize.transaction()
  try {
    const { receiverId, giftId, viaIM, quantity = 1 } = req.body
    const qty = Math.max(1, Math.min(520, Number(quantity) || 1))
    if (!receiverId || !giftId) return fail(res, '参数不完整')

    if (Number(receiverId) === Number(req.userId)) return fail(res, '不能给自己送礼物')

    const gift = await Gift.findByPk(giftId)
    if (!gift || !gift.active) return fail(res, '礼物不存在或已下架', 404)

    const receiver = await User.findByPk(receiverId, { transaction: t })
    if (!receiver) return fail(res, '接收者不存在', 404)

    const totalDiamond = gift.price * qty

    // 行锁防超扣
    const wallet = await Wallet.findOne({
      where: { userId: req.userId },
      transaction: t,
      lock: t.LOCK.UPDATE
    })
    if (!wallet) return fail(res, '钱包不存在，请先充值')
    if (wallet.diamond < totalDiamond) return fail(res, '钻石余额不足')

    let withdrawRatio = 0.7
    try {
      const ratioVal = await get('gift', 'withdrawRatio')
      if (ratioVal !== undefined && ratioVal !== '' && !isNaN(Number(ratioVal))) {
        withdrawRatio = Number(ratioVal)
      }
    } catch (_) {}

    const receiverIncome = Math.floor(totalDiamond * withdrawRatio * 100)

    // a. 扣减发送者 diamond
    await wallet.update(
      { diamond: wallet.diamond - totalDiamond },
      { transaction: t }
    )

    // b. 加到接收者 giftIncome + charmValue
    await receiver.update(
      {
        giftIncome: (receiver.giftIncome || 0) + receiverIncome,
        charmValue: (receiver.charmValue || 0) + totalDiamond
      },
      { transaction: t }
    )

    // c. 创建聊天消息（type='gift'）
    const sortedIds = [Number(req.userId), Number(receiverId)].sort((a, b) => a - b)
    const giftContent = JSON.stringify({
      giftId: gift.id,
      giftName: gift.name,
      giftImage: gift.imageUrl,
      diamondAmount: gift.price,
      quantity: qty,
      totalDiamond,
      animationLevel: gift.animationLevel || 1
    })
    const message = await Message.create({
      sessionId: sortedIds.join('-'),
      senderId: req.userId,
      receiverId: Number(receiverId),
      type: 'gift',
      content: giftContent,
      isRead: false
    }, { transaction: t })

    // d. 创建 GiftRecord
    await GiftRecord.create({
      senderId: req.userId,
      receiverId: Number(receiverId),
      giftId: gift.id,
      giftName: gift.name,
      diamondAmount: totalDiamond,
      quantity: qty,
      messageId: message.id
    }, { transaction: t })

    await t.commit()

    // 每日任务：标记送礼
    try { const { markGiftSent } = require('./tasks'); markGiftSent(req.userId) } catch (_) {}

    // 事务后：WS 推送给双方
    try {
      const io = req.app.get('io')
      if (io) {
        const msgJSON = message.toJSON()
        io.to(`user_${req.userId}`).emit('message', msgJSON)
        io.to(`user_${receiverId}`).emit('message', msgJSON)
      }
    } catch (_) {}

    // 事务后：IM REST 转发（viaIM=false 时由服务端代发到腾讯IM）
    if (!viaIM) {
      setImmediate(async () => {
        try {
          const cfg = await getModuleConfig('im')
          if (cfg && cfg.enabled) {
            const { sendIMC2CCustomV4 } = require('../utils/im')
            await sendIMC2CCustomV4({
              cfg,
              fromUserId: req.userId,
              toUserId: Number(receiverId),
              data: JSON.parse(giftContent),
              desc: `送出了${qty}个${gift.name}`
            })
          }
        } catch (_) {}
      })
    }

    success(res, {
      giftName: gift.name,
      giftImage: gift.imageUrl,
      diamondAmount: totalDiamond,
      quantity: qty,
      animationLevel: gift.animationLevel || 1,
      receiverId: Number(receiverId),
      messageId: message.id
    }, '礼物发送成功')
  } catch (err) {
    await t.rollback()
    next(err)
  }
})

/** 查询我的礼物收入（需鉴权） */
router.get('/income', auth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: ['id', 'giftIncome']
    })
    if (!user) return fail(res, '用户不存在', 404)
    success(res, { giftIncome: user.giftIncome || 0 })
  } catch (err) { next(err) }
})

/** 礼物排行榜 */
router.get('/rank', async (req, res, next) => {
  try {
    const { side = 'received', period = 'all', limit = 50, type } = req.query
    const lim = Math.min(50, Math.max(1, Number(limit) || 50))

    if (type === 'charm') {
      const users = await User.findAll({
        attributes: ['id', 'nickname', 'avatar', 'charmValue'],
        where: { status: 1 },
        order: [['charmValue', 'DESC']],
        limit: lim
      })
      const rank = users.map((u, i) => ({
        rank: i + 1,
        user: { id: u.id, nickname: u.nickname, avatar: u.avatar },
        totalDiamond: Number(u.charmValue) || 0,
        totalCount: 0
      }))
      return success(res, rank)
    }

    let whereClause = {}
    if (period === 'day') {
      whereClause.createdAt = { [Op.gte]: new Date(Date.now() - 86400000) }
    } else if (period === 'week') {
      whereClause.createdAt = { [Op.gte]: new Date(Date.now() - 7 * 86400000) }
    }

    const groupField = side === 'sent' ? 'senderId' : 'receiverId'
    const idField = side === 'sent' ? 'sender_id' : 'receiver_id'

    const results = await GiftRecord.findAll({
      where: whereClause,
      attributes: [
        [groupField, 'userId'],
        [sequelize.fn('SUM', sequelize.col('diamond_amount')), 'totalDiamond'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalCount']
      ],
      group: [idField],
      order: [[sequelize.literal('totalDiamond'), 'DESC']],
      limit: lim,
      raw: true
    })

    const userIds = results.map(r => r.userId)
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ['id', 'nickname', 'avatar']
    })
    const userMap = {}
    for (const u of users) userMap[u.id] = { id: u.id, nickname: u.nickname, avatar: u.avatar }

    const rank = results.map((r, i) => ({
      rank: i + 1,
      user: userMap[r.userId] || { id: r.userId, nickname: '未知用户', avatar: null },
      totalDiamond: Number(r.totalDiamond) || 0,
      totalCount: Number(r.totalCount) || 0
    }))

    success(res, rank)
  } catch (err) { next(err) }
})

/** 送礼记录 */
router.get('/records', auth, async (req, res, next) => {
  try {
    const { side = 'received', page = 1, pageSize = 20 } = req.query
    const pg = Math.max(1, Number(page) || 1)
    const ps = Math.min(50, Math.max(1, Number(pageSize) || 20))

    const where = side === 'sent'
      ? { senderId: req.userId }
      : { receiverId: req.userId }

    const { count, rows } = await GiftRecord.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: ps,
      offset: (pg - 1) * ps
    })

    success(res, { list: rows, total: count, page: pg, pageSize: ps })
  } catch (err) { next(err) }
})

/** 申请提现（需鉴权） */
router.post('/withdraw', auth, async (req, res, next) => {
  const transaction = await sequelize.transaction()
  try {
    const { amount, channel } = req.body
    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) return fail(res, '提现金额无效')

    const user = await User.findByPk(req.userId, { transaction })
    if (!user) return fail(res, '用户不存在', 404)

    if ((user.giftIncome || 0) < amountNum) return fail(res, '可提现余额不足')

    const newBalance = (user.giftIncome || 0) - amountNum
    await user.update(
      { giftIncome: newBalance },
      { transaction }
    )

    await Transaction.create({
      userId: req.userId,
      type: 'gift_withdraw',
      amount: amountNum,
      currency: 'fen',
      balanceAfter: newBalance,
      remark: '礼物收入提现申请',
      extra: { channel: channel || 'wechat', status: 'pending' }
    }, { transaction })

    await transaction.commit()

    success(res, {
      amount: amountNum,
      status: 'pending',
      message: '提现申请已提交，待审核'
    }, '提现申请成功')
  } catch (err) {
    await transaction.rollback()
    next(err)
  }
})

module.exports = router
