const { User } = require('../models')

/**
 * 真人认证中间件
 * 使用方式：auth + requireRealPerson 串联使用
 */
module.exports = async (req, res, next) => {
  try {
    // 兼容 auth 中间件仅设置 req.userId 的场景
    if (!req.user && req.userId) {
      req.user = await User.findByPk(req.userId, {
        attributes: ['id', 'isElite', 'realPersonStatus']
      })
    }
    if (!req.user || req.user.realPersonStatus !== 'passed') {
      return res.status(403).json({ code: 403, message: '需要真人认证' })
    }
    next()
  } catch (err) {
    return res.status(500).json({ code: 500, message: '鉴权失败' })
  }
}
