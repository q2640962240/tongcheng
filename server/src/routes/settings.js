const express = require('express')
const router = express.Router()
const { User, Wallet, Order } = require('../models')
const { auth } = require('../middleware/auth')
const { success, fail } = require('../utils/response')

// 所有设置接口都需要登录
router.use(auth)

/** 换绑手机号（需短信验证码，验证码由 /auth/sms 发送） */
router.post('/phone', async (req, res, next) => {
  try {
    const { phone, code } = req.body
    if (!phone || !code) return fail(res, '请输入手机号和验证码')
    if (!/^1\d{10}$/.test(phone)) return fail(res, '手机号格式不正确')

    // 校验验证码（通过 sms 工具）
    const sms = require('../utils/sms')
    const verify = await sms.verifyCode(phone, code, 'bindPhone')
    if (!verify.success) return fail(res, verify.message || '验证码错误')

    // 检查手机号是否已被其他账号使用
    const exist = await User.findOne({ where: { phone } })
    if (exist && exist.id !== req.userId) return fail(res, '该手机号已被其他账号绑定')

    const user = await User.findByPk(req.userId)
    if (!user) return fail(res, '用户不存在', 404)
    await user.update({ phone })
    success(res, null, '手机号更新成功')
  } catch (err) { next(err) }
})

/** 短信免打扰（本地存储 + 可选 DB） */
router.post('/sms-dnd', async (req, res, next) => {
  try {
    const { enabled } = req.body
    const user = await User.findByPk(req.userId)
    if (!user) return fail(res, '用户不存在', 404)
    // 存到用户扩展字段（简单实现，可改为独立 Settings 表）
    // 注意：必须传新对象，原地修改同一引用 Sequelize 检测不到变更，meta 已存在时写入会丢失
    const meta = { ...(user.meta || {}), smsDnd: !!enabled }
    await user.update({ meta })
    success(res, { enabled: meta.smsDnd }, '设置已更新')
  } catch (err) { next(err) }
})

/** 获取设置（免打扰状态等） */
router.get('/', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId)
    if (!user) return fail(res, '用户不存在', 404)
    const meta = user.meta || {}
    const notification = (meta.notification && typeof meta.notification === 'object') ? meta.notification : {}
    success(res, {
      smsDnd: !!meta.smsDnd,
      notificationPush: meta.notificationPush === undefined ? true : !!meta.notificationPush,
      voiceCallEnabled: meta.voiceCallEnabled === undefined ? true : !!meta.voiceCallEnabled,
      autoAccept: meta.autoAccept === undefined ? false : !!meta.autoAccept,
      privateAccount: !!meta.privateAccount,
      phone: user.phone,
      version: meta.version || '1.0.0',
      meta: {
        notification: {
          post: notification.post !== false,
          group: notification.group !== false,
        },
      },
    })
  } catch (err) { next(err) }
})

/** 动态/组局通知开关（T10 新增） */
router.post('/notify', async (req, res, next) => {
  try {
    const { type, enabled } = req.body
    if (!['post', 'group'].includes(type)) return fail(res, '通知类型不合法')
    const user = await User.findByPk(req.userId)
    if (!user) return fail(res, '用户不存在', 404)
    const oldMeta = user.meta || {}
    const notification = { ...((oldMeta.notification && typeof oldMeta.notification === 'object') ? oldMeta.notification : {}) }
    notification[type] = !!enabled
    const meta = { ...oldMeta, notification }
    await user.update({ meta })
    success(res, { type, enabled: !!enabled, notification: meta.notification }, '设置已更新')
  } catch (err) { next(err) }
})

/** 账号注销（软删除：标记 status=0，保留数据 30 天） */
router.post('/cancel-account', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId)
    if (!user) return fail(res, '用户不存在', 404)

    // 检查是否有未完成订单
    const pendingOrders = await Order.count({
      where: { userId: req.userId, status: ['pending', 'paid', 'ongoing'] }
    })
    if (pendingOrders > 0) {
      return fail(res, `您有 ${pendingOrders} 个未完成订单，请先处理后再注销`)
    }

    // 软删除：标记为注销状态
    const meta = { ...(user.meta || {}), cancelRequestedAt: new Date().toISOString() }
    await user.update({
      status: 0,
      meta
    })

    success(res, null, '账号注销申请已提交，将在 30 天后永久删除')
  } catch (err) { next(err) }
})

module.exports = router
