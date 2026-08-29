const express = require('express')
const router = express.Router()
const rateLimit = require('express-rate-limit')
const { User, Wallet } = require('../models')
const jwt = require('jsonwebtoken')
const { signToken, signRefreshToken } = require('../middleware/auth')
const { success, fail } = require('../utils/response')
const sms = require('../utils/sms')
const config = require('../config')

// 短信发送频控：同一 IP 每分钟 1 次，每小时 10 次
const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 9999 : 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '发送过于频繁，请稍后再试' }
})
const smsHourLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 99999 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '本小时发送次数已达上限' }
})

/** 发送短信验证码 */
async function handleSendSms(req, res) {
  const { phone, scene = 'login' } = req.body
  if (!/^1\d{10}$/.test(phone)) return fail(res, '手机号格式不正确')
  const result = await sms.sendCode(phone, scene)
  if (!result.success) return fail(res, result.message)
  if (process.env.NODE_ENV === 'test') {
    success(res, { code: result.code }, '[TEST] 验证码已生成（仅用于自动化测试）')
  } else {
    success(res, {}, '验证码已发送，请留意短信')
  }
}
router.post('/sms', smsLimiter, smsHourLimiter, async (req, res, next) => {
  try { await handleSendSms(req, res) } catch (err) { next(err) }
})
router.post('/send-code', smsLimiter, smsHourLimiter, async (req, res, next) => {
  try { await handleSendSms(req, res) } catch (err) { next(err) }
})

/** 完成登录后公共返回 */
async function doLoginResponse(res, user, extraMeta = {}) {
  const token = signToken(user.id)
  const refreshToken = signRefreshToken(user.id)
  await user.update({ lastLoginAt: new Date().toISOString() })
  success(res, {
    token,
    refreshToken,
    user: {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      isElite: user.isElite,
      hasPassword: !!user.passwordHash,
      userType: user.userType || 'real',
      ...extraMeta
    }
  }, '登录成功')
}

/** 短信验证码登录/注册 */
router.post('/login', async (req, res, next) => {
  try {
    const { phone, code, scene = 'login' } = req.body
    if (!/^1\d{10}$/.test(phone)) return fail(res, '手机号格式不正确')
    if (!code) return fail(res, '请输入验证码')

    const ok = await sms.verifyCode(phone, code, scene)
    if (!ok) return fail(res, '验证码错误或已过期')

    let user = await User.findOne({ where: { phone } })
    let created = false
    if (!user) {
      user = await User.create({
        phone,
        nickname: `用户${phone.slice(-4)}`,
        inviteCode: 'INV' + Date.now().toString(36).toUpperCase()
      })
      await Wallet.create({ userId: user.id })
      created = true
    }
    doLoginResponse(res, user, { isNew: created, needSetPassword: !user.passwordHash })
  } catch (err) { next(err) }
})

/** 手机号 + 密码登录 */
router.post('/login-password', async (req, res, next) => {
  try {
    const { phone, password } = req.body
    if (!/^1\d{10}$/.test(phone)) return fail(res, '手机号格式不正确')
    if (!password) return fail(res, '请输入密码')
    const user = await User.findOne({ where: { phone } })
    if (!user) return fail(res, '手机号未注册')
    if (!user.passwordHash) return fail(res, '您未设置密码，请使用短信验证码登录并设置密码')
    if (user.status !== 1) return fail(res, '账号已被封禁，请联系客服')
    if (!user.verifyPassword(password)) return fail(res, '账号或密码错误')
    doLoginResponse(res, user)
  } catch (err) { next(err) }
})

/** 刷新 token（避免用户重复登录） */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return fail(res, 'refresh token 缺失', 401)
    let decoded
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret)
    } catch (e) {
      return fail(res, '登录已过期，请重新登录', 401)
    }
    if (!decoded || decoded.type !== 'refresh' || !decoded.id) {
      return fail(res, '登录已过期，请重新登录', 401)
    }
    const user = await User.findByPk(decoded.id)
    if (!user) return fail(res, '用户不存在', 401)
    if (user.status !== 1) return fail(res, '账号已被封禁', 401)
    const token = signToken(user.id)
    const newRefreshToken = signRefreshToken(user.id)
    success(res, { token, refreshToken: newRefreshToken }, '已续期')
  } catch (err) { next(err) }
})

/** 设置密码（已登录用户）；若未登录需要配合短信验证码使用 */
router.post('/password', async (req, res, next) => {
  try {
    // 支持两条路径：
    //  a) 已登录：Header 带 Authorization → 直接根据 userId 修改/设置密码
    //  b) 未登录：传 phone + code + newPassword → 找回密码
    const authHeader = req.headers.authorization
    const { phone, code, password, newPassword } = req.body

    let user = null
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), config.jwt.secret)
        user = await User.findByPk(decoded.id)
      } catch (_) {}
      if (!user) return fail(res, '登录已过期，请重新登录', 401)
      if (user.passwordHash && password && !user.verifyPassword(password)) {
        return fail(res, '原密码错误')
      }
    } else {
      if (!/^1\d{10}$/.test(phone || '')) return fail(res, '手机号格式不正确')
      if (!code) return fail(res, '请输入短信验证码')
      const ok = await sms.verifyCode(phone, code, 'reset')
      if (!ok) return fail(res, '验证码错误或已过期')
      user = await User.findOne({ where: { phone } })
      if (!user) return fail(res, '手机号未注册')
    }
    const pwd = newPassword || password || ''
    if (pwd.length < 6 || pwd.length > 32) return fail(res, '密码长度需 6-32 位')
    user.setPassword(pwd)
    await user.save()
    success(res, null, user.passwordHash ? '密码已更新' : '密码已设置成功')
  } catch (err) { next(err) }
})

/** 退出登录 */
router.post('/logout', (req, res) => {
  success(res, null, '已退出')
})

module.exports = router
