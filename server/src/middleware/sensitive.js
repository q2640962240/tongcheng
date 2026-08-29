/** 请求级敏感词中间件（对指定 body 字段做校验） */
const { detect } = require('../utils/sensitive')

/**
 * 对指定字段逐一检查。用法：
 *   router.post('/posts', auth, sensitiveFilter(['text', 'remark']), posts.create)
 */
function sensitiveFilter(fields = ['text', 'content', 'title', 'description', 'remark', 'tags']) {
  return (req, res, next) => {
    try {
      for (const f of fields) {
        const v = req.body && req.body[f]
        if (v === undefined || v === null) continue
        const list = Array.isArray(v) ? v : [String(v)]
        for (const item of list) {
          const hit = detect(item)
          if (hit) {
            return res.status(400).json({
              code: 400,
              message: `提交的「${f}」包含违规内容，请修改后重新发布`,
              hit
            })
          }
        }
      }
      next()
    } catch (e) {
      next(e)
    }
  }
}

module.exports = { sensitiveFilter }
