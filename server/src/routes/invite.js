const express = require('express')
const router = express.Router()
const { Invite, User, Transaction } = require('../models')
const { auth } = require('../middleware/auth')
const { success, paginate, fail } = require('../utils/response')

/** 邀请统计 */
router.get('/stats', auth, async (req, res, next) => {
  try {
    const invitees = await Invite.findAll({ where: { inviterId: req.userId } })
    const totalInvitees = invitees.length
    const totalReward = invitees.reduce((sum, i) => sum + (i.totalReward || 0), 0)

    // 本月奖励：从 Transaction 查询本月 type=income 且 remark 包含「邀请分红」的记录
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const allTx = await Transaction.findAll({
      where: { userId: req.userId, type: 'income' }
    })
    const monthlyReward = allTx
      .filter(t => {
        const ts = t.createdAt ? new Date(t.createdAt) : null
        return ts && ts >= monthStart && (t.remark || '').includes('邀请分红')
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    success(res, { totalInvitees, totalReward, monthlyReward })
  } catch (err) { next(err) }
})

/** 奖励排行榜 */
router.get('/leaderboard', async (req, res, next) => {
  try {
    const all = await Invite.findAll()
    const map = new Map()
    for (const i of all) {
      const cur = map.get(i.inviterId) || { inviterId: i.inviterId, reward: 0, count: 0 }
      cur.reward += i.totalReward || 0
      cur.count += 1
      map.set(i.inviterId, cur)
    }
    const list = [...map.values()].sort((a, b) => b.reward - a.reward).slice(0, 20)
    const result = []
    for (const item of list) {
      const user = await User.findByPk(item.inviterId)
      result.push({
        inviterId: item.inviterId,
        nickname: user?.nickname,
        avatar: user?.avatar,
        reward: item.reward,
        inviteeCount: item.count
      })
    }
    success(res, result)
  } catch (err) { next(err) }
})

/** 我的邀请列表 */
router.get('/invitees', auth, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20 } = req.query
    const { rows, count } = await Invite.findAndCountAll({
      where: { inviterId: req.userId },
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    const result = []
    for (const i of rows) {
      const u = await User.findByPk(i.inviteeId)
      result.push({ ...i.toJSON(), invitee: u ? {
        nickname: u.nickname, avatar: u.avatar, gender: u.gender
      } : null })
    }
    paginate(res, result, count, page, pageSize)
  } catch (err) { next(err) }
})

/** 通过邀请码绑定邀请关系 */
router.post('/bind', auth, async (req, res, next) => {
  try {
    const { inviteCode } = req.body
    if (!inviteCode) return fail(res, '请输入邀请码')
    const inviter = await User.findOne({ where: { inviteCode } })
    if (!inviter) return fail(res, '邀请码无效')
    if (inviter.id === req.userId) return fail(res, '不能邀请自己')

    const exist = await Invite.findOne({ where: { inviteeId: req.userId } })
    if (exist) return fail(res, '已绑定邀请关系')

    const user = await User.findByPk(req.userId)
    await Invite.create({
      inviterId: inviter.id,
      inviteeId: req.userId,
      inviteeGender: user.gender
    })
    await user.update({ inviterId: inviter.id })
    success(res, null, '邀请绑定成功')
  } catch (err) { next(err) }
})

/** 分享信息 */
router.get('/share-info', auth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId)
    success(res, {
      inviteCode: user.inviteCode,
      shareTitle: '来白夜，找到你的专属陪伴',
      shareDesc: '白夜 + 陪玩陪聊，注册填写邀请码有惊喜'
    })
  } catch (err) { next(err) }
})

module.exports = router
