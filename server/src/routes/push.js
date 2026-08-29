const express = require('express')
const router = express.Router()
const { User } = require('../models')
const { auth } = require('../middleware/auth')
const { success, fail } = require('../utils/response')
const push = require('../utils/push')

/** 测试推送（管理后台「配置中心 → 推送服务 → 测试连通性」调用） */
router.post('/test', auth, async (req, res, next) => {
  try {
    const result = await push.testConfig()
    if (result.success) {
      success(res, result, result.message || '推送测试成功')
    } else {
      fail(res, result.message || result.error || '推送测试失败')
    }
  } catch (err) { next(err) }
})

/** 叫醒服务（订单关联，服务者向买家发送叫醒语音/推送） */
router.post('/wake-up', auth, async (req, res, next) => {
  try {
    const { orderId, userId } = req.body
    const targetUserId = userId
    if (!targetUserId) return fail(res, '请指定叫醒用户')

    const target = await User.findByPk(targetUserId)
    if (!target) return fail(res, '用户不存在', 404)

    // 发送叫醒推送
    const result = await push.pushToUser(targetUserId, {
      title: '叫醒服务',
      body: '该起床啦！你的专属叫醒服务已到达',
      sound: 'default',
      extras: { type: 'wake_up', orderId, fromUserId: req.userId }
    })

    // 同时通过 Socket.IO 在线推送
    const { emitToUser } = require('../app')
    if (typeof emitToUser === 'function') {
      emitToUser(targetUserId, 'wake_up', { orderId, fromUserId: req.userId })
    }

    success(res, result, result.success ? '叫醒推送已发送' : '叫醒推送失败')
  } catch (err) { next(err) }
})

/** 广播通知（管理员专用，后续接入 admin 鉴权） */
router.post('/broadcast', auth, async (req, res, next) => {
  try {
    const { title, body } = req.body
    if (!title || !body) return fail(res, '请输入标题和内容')
    const result = await push.pushToAll({ title, body })
    success(res, result, result.success ? '广播已发送' : '广播失败')
  } catch (err) { next(err) }
})

module.exports = router
