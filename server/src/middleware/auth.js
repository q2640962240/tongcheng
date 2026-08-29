const jwt = require('jsonwebtoken')
const config = require('../config')

/** 生成访问 token */
const signToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn })
}

/** 生成刷新 token */
const signRefreshToken = (userId) => {
  return jwt.sign({ id: userId, type: 'refresh' }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn
  })
}

/** 验证 token 中间件 */
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录或登录已过期' })
  }
  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    req.userId = decoded.id
    next()
  } catch (err) {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' })
  }
}

/** 可选鉴权（已登录则注入 userId，未登录放行） */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), config.jwt.secret)
      req.userId = decoded.id
    } catch (e) {}
  }
  next()
}

module.exports = { signToken, signRefreshToken, auth, optionalAuth }
