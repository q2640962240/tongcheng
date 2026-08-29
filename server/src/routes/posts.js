const express = require('express')
const router = express.Router()
const { Post, Comment, User, Op } = require('../models')
const { auth, optionalAuth } = require('../middleware/auth')
const { sensitiveFilter } = require('../middleware/sensitive')
const { success, paginate, fail } = require('../utils/response')
const { normalizeCityName } = require('../utils/geo')
const { expandAlias } = require('../utils/searchAlias')

/** 列表（分类/城市/分页/距离/关键词）未登录可看 */
router.get('/', optionalAuth, async (req, res, next) => {
  const t0 = Date.now()
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(50, Number(req.query.pageSize) || 10)
    const offset = (page - 1) * pageSize
    const keywordRaw = String(req.query.keyword || req.query.kw || '').trim()
    const cityRaw = String(req.query.city || '').trim()
    const cityNorm = cityRaw ? normalizeCityName(cityRaw) : ''
    const cityVariants = new Set()
    if (cityRaw) {
      cityVariants.add(cityRaw)
      if (cityNorm && cityNorm !== cityRaw) cityVariants.add(cityNorm)
    }
    const matchCity = rowCity => {
      if (!cityVariants.size) return true
      if (!rowCity) return false
      for (const v of cityVariants) if (String(rowCity).startsWith(v) || String(v).startsWith(String(rowCity))) return true
      return false
    }
    // keyword 长度 <2 时：ignored=true 且空数组，避免误匹配/性能问题
    const ignored = !!keywordRaw && keywordRaw.length < 2
    const where = { auditStatus: { [Op.ne]: 'blocked' } }
    if (req.query.category) where.category = req.query.category
    if (req.query.userId) where.userId = Number(req.query.userId)
    if (!ignored && keywordRaw) {
      const kws = Array.from(new Set([keywordRaw].concat(expandAlias(keywordRaw)))).filter(Boolean)
      const ors = []
      for (const k of kws) {
        const like = `%${k}%`
        ors.push({ text: { [Op.like]: like } })
        ors.push({ tags: { [Op.like]: like } })
      }
      where[Op.or] = ors
    }
    // city 精确 where 只在 norm 可用时优化；否则后续 matchCity 过滤
    if (cityNorm) where.city = cityNorm
    let { count: total, rows } = await Post.findAndCountAll({
      where,
      order: [['top', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset
    })
    // 补充 cityVariants 过滤（兼容历史不带"市"的数据）
    rows = rows.filter(p => matchCity(p.city))
    total = rows.length
    const userIds = [...new Set(rows.map(p => p.userId))]
    const users = await User.findAll({ where: { id: { [Op.in]: userIds } } })
    const userMap = Object.fromEntries(users.map(u => [u.id, {
      id: u.id, nickname: u.nickname, avatar: u.avatar, city: u.city,
      isElite: u.isElite, realPersonStatus: u.realPersonStatus, gender: u.gender
    }]))
    const me = req.userId
    const list = rows.map(p => {
      const obj = p.toJSON()
      obj.user = userMap[p.userId] || null
      obj.liked = me ? obj.likes && obj.likes.includes(me) : false
      delete obj.likes
      return obj
    })
    const aliasArr = ignored || !keywordRaw ? [] : (() => {
      const base = expandAlias(keywordRaw) || []
      const norm = String(keywordRaw || '').trim()
      return Array.from(new Set([norm].concat(Array.isArray(base) ? base : []))).filter(Boolean).map(s => String(s).toLowerCase())
    })()
    const meta = {
      tookMs: Date.now() - t0,
      keyword: keywordRaw,
      keywordNormalized: ignored ? '' : (aliasArr[0] || keywordRaw),
      aliasesExpanded: aliasArr,
      ignored,
      total,
      city: cityRaw,
      cityNormalized: cityNorm || '',
      reason: ignored ? '关键词过短，请输入至少 2 个字' : ''
    }
    paginate(res, list, total, page, pageSize, null, meta)
  } catch (e) { next(e) }
})

/** 发布动态（登录 + 敏感词） */
router.post('/', auth, sensitiveFilter(['text', 'tags']), async (req, res, next) => {
  try {
    const { text, images = [], location = {}, city = '', category = 'dynamic' } = req.body
    if (!text || String(text).trim().length === 0) return fail(res, '动态内容不能为空')
    if (String(text).length > 500) return fail(res, '动态字数超过 500 字上限')
    if (Array.isArray(images) && images.length > 9) return fail(res, '最多上传 9 张图片')
    const post = await Post.create({
      userId: req.userId,
      text: String(text).trim(),
      images: Array.isArray(images) ? images.slice(0, 9) : [],
      location: typeof location === 'object' ? location : {},
      city: city || '',
      category,
      auditStatus: 'approved',
      likes: [],
      likeCount: 0,
      commentCount: 0,
      online: true
    })
    success(res, post.toJSON(), '发布成功')
  } catch (e) { next(e) }
})

/** 详情 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const post = await Post.findByPk(req.params.id)
    if (!post) return fail(res, '动态不存在', 404)
    const user = await User.findByPk(post.userId)
    const me = req.userId
    const obj = post.toJSON()
    obj.user = user ? {
      id: user.id, nickname: user.nickname, avatar: user.avatar, city: user.city,
      isElite: user.isElite, realPersonStatus: user.realPersonStatus, gender: user.gender, bio: user.bio
    } : null
    obj.liked = me ? obj.likes && obj.likes.includes(me) : false
    delete obj.likes
    success(res, obj)
  } catch (e) { next(e) }
})

/** 删除（作者或管理员） */
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const post = await Post.findByPk(req.params.id)
    if (!post) return fail(res, '动态不存在', 404)
    const adminMatch = req._adminAuth
    if (post.userId !== req.userId && !adminMatch) return fail(res, '无权限删除', 403)
    await post.update({ auditStatus: 'blocked' })
    success(res, null, '已删除')
  } catch (e) { next(e) }
})

/** 点赞 / 取消点赞 toggle */
router.post('/:id/like', auth, async (req, res, next) => {
  try {
    const post = await Post.findByPk(req.params.id)
    if (!post) return fail(res, '动态不存在', 404)
    const likes = Array.isArray(post.likes) ? [...post.likes] : []
    const idx = likes.indexOf(req.userId)
    let liked = false
    if (idx >= 0) { likes.splice(idx, 1); liked = false }
    else { likes.push(req.userId); liked = true }
    await post.update({ likes, likeCount: likes.length })
    success(res, { liked, likeCount: likes.length }, liked ? '已点赞' : '已取消点赞')
  } catch (e) { next(e) }
})

/** 评论列表 */
router.get('/:id/comments', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(50, Number(req.query.pageSize) || 20)
    const offset = (page - 1) * pageSize
    const where = { postId: req.params.id, blocked: false, auditStatus: { [Op.ne]: 'blocked' } }
    const { count: total, rows } = await Comment.findAndCountAll({
      where, order: [['id', 'DESC']], limit: pageSize, offset
    })
    const userIds = [...new Set(rows.map(c => c.userId))]
    const users = await User.findAll({ where: { id: { [Op.in]: userIds } } })
    const userMap = Object.fromEntries(users.map(u => [u.id, { id: u.id, nickname: u.nickname, avatar: u.avatar, isElite: u.isElite }]))
    const list = rows.map(c => ({ ...c.toJSON(), user: userMap[c.userId] || null }))
    paginate(res, list, total, page, pageSize)
  } catch (e) { next(e) }
})

/** 发表评论 */
router.post('/:id/comments', auth, sensitiveFilter(['text']), async (req, res, next) => {
  try {
    const { text, replyToUserId } = req.body
    if (!text || String(text).trim().length === 0) return fail(res, '评论内容不能为空')
    if (String(text).length > 500) return fail(res, '评论字数超过 500 字')
    const post = await Post.findByPk(req.params.id)
    if (!post) return fail(res, '动态不存在', 404)
    const c = await Comment.create({
      postId: post.id,
      userId: req.userId,
      replyToUserId: replyToUserId ? Number(replyToUserId) : null,
      text: String(text).trim()
    })
    await post.update({ commentCount: (post.commentCount || 0) + 1 })
    const user = await User.findByPk(req.userId)
    success(res, {
      ...c.toJSON(),
      user: { id: user.id, nickname: user.nickname, avatar: user.avatar, isElite: user.isElite }
    }, '评论成功')
  } catch (e) { next(e) }
})

module.exports = router
