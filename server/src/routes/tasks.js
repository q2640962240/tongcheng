const express = require('express')
const router = express.Router()
const { DailyTask, Wallet, User, Transaction, Op } = require('../models')
const { auth } = require('../middleware/auth')
const { success, fail } = require('../utils/response')
const sequelize = require('../config/database')

const TASK_REWARDS = {
  login: 2,
  chat: 5,
  gift: 5,
  post: 3,
  share: 2,
  allDone: 10
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function getOrCreateToday(userId) {
  const date = todayStr()
  let task = await DailyTask.findOne({ where: { userId, date } })
  if (!task) {
    task = await DailyTask.create({ userId, date })
  }
  return task
}

router.get('/today', auth, async (req, res, next) => {
  try {
    const task = await getOrCreateToday(req.userId)
    const rewards = TASK_REWARDS
    const allDone = task.loginDone && task.chatDone && task.giftSent && task.postCreated && task.shareDone
    success(res, {
      date: task.date,
      tasks: [
        { id: 'login', title: '每日登录', reward: rewards.login, done: !!task.loginDone, claimed: false },
        { id: 'chat', title: '发 3 条消息', reward: rewards.chat, done: !!task.chatDone, claimed: false, progress: Math.min(task.chatCount || 0, 3), target: 3 },
        { id: 'gift', title: '送 1 个礼物', reward: rewards.gift, done: !!task.giftSent, claimed: false },
        { id: 'post', title: '发 1 条动态', reward: rewards.post, done: !!task.postCreated, claimed: false },
        { id: 'share', title: '分享 1 次', reward: rewards.share, done: !!task.shareDone, claimed: false }
      ],
      allDone,
      allDoneReward: rewards.allDone,
      allDoneClaimed: allDone && task.totalClaimed >= (rewards.login + rewards.chat + rewards.gift + rewards.post + rewards.share + rewards.allDone),
      totalClaimed: task.totalClaimed
    })
  } catch (err) { next(err) }
})

router.post('/:taskId/claim', auth, async (req, res, next) => {
  try {
    const { taskId } = req.params
    const task = await getOrCreateToday(req.userId)
    const reward = TASK_REWARDS[taskId]
    if (!reward) return fail(res, '无效的任务', 400)

    let taskDone = false
    if (taskId === 'login') taskDone = !!task.loginDone
    else if (taskId === 'chat') taskDone = !!task.chatDone
    else if (taskId === 'gift') taskDone = !!task.giftSent
    else if (taskId === 'post') taskDone = !!task.postCreated
    else if (taskId === 'share') taskDone = !!task.shareDone

    if (!taskDone) return fail(res, '任务未完成', 400)

    const expectedClaimed = (() => {
      let sum = 0
      if (taskId === 'login' || task.loginDone) sum += TASK_REWARDS.login
      if (taskId === 'chat' || task.chatDone) sum += TASK_REWARDS.chat
      if (taskId === 'gift' || task.giftSent) sum += TASK_REWARDS.gift
      if (taskId === 'post' || task.postCreated) sum += TASK_REWARDS.post
      if (taskId === 'share' || task.shareDone) sum += TASK_REWARDS.share
      return sum
    })()

    if (task.totalClaimed >= expectedClaimed) return fail(res, '已领取过', 400)

    const wallet = await Wallet.findOne({ where: { userId: req.userId } })
    if (!wallet) return fail(res, '钱包不存在', 404)

    await sequelize.transaction(async (t) => {
      await wallet.increment('diamond', { by: reward, transaction: t })
      await task.update({ totalClaimed: task.totalClaimed + reward }, { transaction: t })
      await Transaction.create({
        userId: req.userId,
        type: 'reward',
        amount: reward,
        currency: 'diamond',
        extra: { source: 'daily_task', taskId }
      }, { transaction: t })
    })

    success(res, { reward, taskId }, `获得 ${reward} 钻石`)
  } catch (err) { next(err) }
})

router.post('/all-done-claim', auth, async (req, res, next) => {
  try {
    const task = await getOrCreateToday(req.userId)
    const allDone = task.loginDone && task.chatDone && task.giftSent && task.postCreated && task.shareDone
    if (!allDone) return fail(res, '还有任务未完成', 400)

    const baseTotal = TASK_REWARDS.login + TASK_REWARDS.chat + TASK_REWARDS.gift + TASK_REWARDS.post + TASK_REWARDS.share
    if (task.totalClaimed < baseTotal) return fail(res, '请先领取单个任务奖励', 400)

    const allDoneClaimed = task.totalClaimed >= baseTotal + TASK_REWARDS.allDone
    if (allDoneClaimed) return fail(res, '已全部领取', 400)

    const reward = TASK_REWARDS.allDone
    const wallet = await Wallet.findOne({ where: { userId: req.userId } })
    if (!wallet) return fail(res, '钱包不存在', 404)

    await sequelize.transaction(async (t) => {
      await wallet.increment('diamond', { by: reward, transaction: t })
      await task.update({ totalClaimed: task.totalClaimed + reward }, { transaction: t })
      await Transaction.create({
        userId: req.userId,
        type: 'reward',
        amount: reward,
        currency: 'diamond',
        extra: { source: 'daily_task_all_done' }
      }, { transaction: t })
    })

    success(res, { reward }, `全部完成！额外获得 ${reward} 钻石`)
  } catch (err) { next(err) }
})

router.post('/share', auth, async (req, res, next) => {
  try {
    await markShare(req.userId)
    success(res, { done: true }, '分享任务已完成')
  } catch (err) { next(err) }
})

// ---- 内部触发接口（供其他路由调用） ----
async function markLogin(userId) {
  try {
    const task = await getOrCreateToday(userId)
    if (!task.loginDone) await task.update({ loginDone: true })
  } catch (_) {}
}

async function markChat(userId) {
  try {
    const task = await getOrCreateToday(userId)
    const count = (task.chatCount || 0) + 1
    const update = { chatCount: count }
    if (count >= 3) update.chatDone = true
    await task.update(update)
  } catch (_) {}
}

async function markGiftSent(userId) {
  try {
    const task = await getOrCreateToday(userId)
    if (!task.giftSent) await task.update({ giftSent: true })
  } catch (_) {}
}

async function markPostCreated(userId) {
  try {
    const task = await getOrCreateToday(userId)
    if (!task.postCreated) await task.update({ postCreated: true })
  } catch (_) {}
}

async function markShare(userId) {
  try {
    const task = await getOrCreateToday(userId)
    if (!task.shareDone) await task.update({ shareDone: true })
  } catch (_) {}
}

module.exports = router
module.exports.markLogin = markLogin
module.exports.markChat = markChat
module.exports.markGiftSent = markGiftSent
module.exports.markPostCreated = markPostCreated
module.exports.markShare = markShare
