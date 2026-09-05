const express = require('express')
const router = express.Router()
const { Gift, GiftRecord, User, Wallet, Transaction, sequelize } = require('../models')
const { auth } = require('../middleware/auth')
const { success, fail } = require('../utils/response')
const { get } = require('../utils/config')

/** 获取上架礼物列表（按 sort 排序） */
router.get('/', async (req, res, next) => {
  try {
    const gifts = await Gift.findAll({
      where: { active: true },
      order: [['sort', 'ASC']],
      attributes: ['id', 'name', 'imageUrl', 'price', 'sort']
    })
    success(res, gifts)
  } catch (err) { next(err) }
})

/** 发送礼物（需鉴权） */
router.post('/send', auth, async (req, res, next) => {
  const transaction = await sequelize.transaction()
  try {
    const { receiverId, giftId } = req.body
    if (!receiverId || !giftId) return fail(res, '参数不完整')

    // 不能给自己送礼物
    if (Number(receiverId) === Number(req.userId)) return fail(res, '不能给自己送礼物')

    // 1. 查询礼物信息
    const gift = await Gift.findByPk(giftId)
    if (!gift || !gift.active) return fail(res, '礼物不存在或已下架', 404)

    // 接收者存在性校验
    const receiver = await User.findByPk(receiverId)
    if (!receiver) return fail(res, '接收者不存在', 404)

    // 2. 查询发送者 Wallet，检查 diamond 余额
    let wallet = await Wallet.findOne({ where: { userId: req.userId }, transaction })
    if (!wallet) return fail(res, '钱包不存在，请先充值')
    if (wallet.diamond < gift.price) return fail(res, '钻石余额不足')

    // 3. 读取提现比例（默认 0.7）
    let withdrawRatio = 0.7
    try {
      const ratioVal = await get('gift', 'withdrawRatio')
      if (ratioVal !== undefined && ratioVal !== '' && !isNaN(Number(ratioVal))) {
        withdrawRatio = Number(ratioVal)
      }
    } catch (_) {}

    // 计算接收者收入（分 = 钻石价格 × 提现比例 × 100 分/元，取整）
    const receiverIncome = Math.floor(gift.price * withdrawRatio * 100)

    // 4. 事务操作
    // a. 扣减发送者 diamond
    await wallet.update(
      { diamond: wallet.diamond - gift.price },
      { transaction }
    )

    // b. 加到接收者 User.giftIncome
    await receiver.update(
      { giftIncome: (receiver.giftIncome || 0) + receiverIncome },
      { transaction }
    )

    // c. 创建 GiftRecord 记录
    await GiftRecord.create({
      senderId: req.userId,
      receiverId: Number(receiverId),
      giftId: gift.id,
      giftName: gift.name,
      diamondAmount: gift.price
    }, { transaction })

    await transaction.commit()

    success(res, {
      giftName: gift.name,
      diamondAmount: gift.price,
      receiverId: Number(receiverId)
    }, '礼物发送成功')
  } catch (err) {
    await transaction.rollback()
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

/** 申请提现（需鉴权） */
router.post('/withdraw', auth, async (req, res, next) => {
  const transaction = await sequelize.transaction()
  try {
    const { amount } = req.body
    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) return fail(res, '提现金额无效')

    const user = await User.findByPk(req.userId, { transaction })
    if (!user) return fail(res, '用户不存在', 404)

    // 检查 giftIncome >= amount（amount 单位为分）
    if ((user.giftIncome || 0) < amountNum) return fail(res, '可提现余额不足')

    // 扣减 giftIncome
    await user.update(
      { giftIncome: (user.giftIncome || 0) - amountNum },
      { transaction }
    )

    // 创建 Transaction 记录（type: 'withdraw'）
    await Transaction.create({
      userId: req.userId,
      type: 'withdraw',
      amount: amountNum,
      currency: 'fen',
      balanceAfter: (user.giftIncome || 0) - amountNum,
      remark: `礼物收入提现申请`
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
