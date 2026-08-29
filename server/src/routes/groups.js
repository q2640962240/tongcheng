const express = require('express')
const router = express.Router()
const { Group, GroupJoin, User, Op } = require('../models')
const { auth, optionalAuth } = require('../middleware/auth')
const { sensitiveFilter } = require('../middleware/sensitive')
const { success, paginate, fail } = require('../utils/response')
const { normalizeCityName } = require('../utils/geo')
const { expandAlias } = require('../utils/searchAlias')

/** 组局列表（城市/时间/人数/关键词/分页筛选） */
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
    const ignored = !!keywordRaw && keywordRaw.length < 2
    const where = { status: { [Op.in]: ['open', 'full'] } }
    if (cityNorm) where.city = cityNorm
    if (req.query.category) where.category = req.query.category
    if (req.query.expectMax) where.expectMax = { [Op.lte]: Number(req.query.expectMax) }
    if (!ignored && keywordRaw) {
      const kws = Array.from(new Set([keywordRaw].concat(expandAlias(keywordRaw)))).filter(Boolean)
      const ors = []
      for (const k of kws) {
        const like = `%${k}%`
        ors.push({ title: { [Op.like]: like } })
        ors.push({ description: { [Op.like]: like } })
        ors.push({ tags: { [Op.like]: like } })
      }
      where[Op.or] = ors
    }
    let { count: total, rows } = await Group.findAndCountAll({
      where,
      order: [['hot', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset
    })
    rows = rows.filter(g => matchCity(g.city))
    total = rows.length
    const userIds = [...new Set(rows.map(g => g.userId))]
    const users = await User.findAll({ where: { id: { [Op.in]: userIds } } })
    const userMap = Object.fromEntries(users.map(u => [u.id, {
      id: u.id, nickname: u.nickname, avatar: u.avatar, isElite: u.isElite, realPersonStatus: u.realPersonStatus
    }]))
    const list = rows.map(g => ({ ...g.toJSON(), user: userMap[g.userId] || null }))
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

/** 发起组局 */
router.post('/', auth, sensitiveFilter(['title', 'description', 'tags']), async (req, res, next) => {
  try {
    const { title, description, tags = [], category = 'movie', city,
      expectMin = 2, expectMax = 8, activityAt, cover = '', icon = '', location = {} } = req.body
    if (!title || String(title).length < 2) return fail(res, '请填写组局标题')
    if (expectMax < expectMin) return fail(res, '期望人数上限必须 ≥ 下限')
    const g = await Group.create({
      userId: req.userId,
      title: String(title),
      description: description || '',
      tags: Array.isArray(tags) ? tags : [],
      category, city: city || '', expectMin, expectMax,
      activityAt: activityAt || null, cover, icon,
      location: typeof location === 'object' ? location : {},
      status: 'open', joinCount: 1, hot: false
    })
    // 发起人默认报名通过
    await GroupJoin.create({
      groupId: g.id, userId: req.userId, status: 'approved', appliedAt: new Date().toISOString(), handledAt: new Date().toISOString()
    })
    success(res, g.toJSON(), '组局创建成功')
  } catch (e) { next(e) }
})

/** 详情 */
router.get('/:id', async (req, res, next) => {
  try {
    const g = await Group.findByPk(req.params.id)
    if (!g) return fail(res, '组局不存在', 404)
    const user = await User.findByPk(g.userId)
    const joins = await GroupJoin.findAll({ where: { groupId: g.id }, order: [['id', 'ASC']] })
    const joinUserIds = [...new Set(joins.map(j => j.userId))]
    const joinUsers = await User.findAll({ where: { id: { [Op.in]: joinUserIds } } })
    const joinUserMap = Object.fromEntries(joinUsers.map(u => [u.id, { id: u.id, nickname: u.nickname, avatar: u.avatar, isElite: u.isElite }]))
    const joinsWithUser = joins.map(j => ({ ...j.toJSON(), user: joinUserMap[j.userId] || null }))
    success(res, { ...g.toJSON(), user: user ? {
      id: user.id, nickname: user.nickname, avatar: user.avatar, isElite: user.isElite, realPersonStatus: user.realPersonStatus, city: user.city
    } : null, joins: joinsWithUser })
  } catch (e) { next(e) }
})

/** 修改（发起人） */
router.put('/:id', auth, sensitiveFilter(['title', 'description', 'tags']), async (req, res, next) => {
  try {
    const g = await Group.findByPk(req.params.id)
    if (!g) return fail(res, '组局不存在', 404)
    if (g.userId !== req.userId) return fail(res, '只有发起人可以修改', 403)
    const allowed = ['title', 'description', 'tags', 'category', 'city', 'expectMin', 'expectMax', 'activityAt', 'cover', 'icon', 'status']
    const update = {}
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k]
    await g.update(update)
    success(res, null, '已更新')
  } catch (e) { next(e) }
})

/** 删除 / 关闭（发起人） */
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const g = await Group.findByPk(req.params.id)
    if (!g) return fail(res, '组局不存在', 404)
    if (g.userId !== req.userId) return fail(res, '只有发起人可以关闭', 403)
    await g.update({ status: 'closed' })
    success(res, null, '组局已关闭')
  } catch (e) { next(e) }
})

/** 报名进群 */
router.post('/:id/join', auth, async (req, res, next) => {
  try {
    const g = await Group.findByPk(req.params.id)
    if (!g) return fail(res, '组局不存在', 404)
    if (g.status === 'closed' || g.status === 'canceled') return fail(res, '组局已结束')
    // 不可重复报名
    const exists = await GroupJoin.findOne({ where: { groupId: g.id, userId: req.userId, status: { [Op.ne]: 'canceled' } } })
    if (exists) return fail(res, '您已报名，等待发起人确认')
    // 人数上限校验
    if (g.joinCount >= g.expectMax) {
      await g.update({ status: 'full' })
      return fail(res, '报名人数已满')
    }
    const j = await GroupJoin.create({
      groupId: g.id, userId: req.userId, status: 'pending',
      appliedAt: new Date().toISOString(),
      remark: (req.body.remark || '').slice(0, 200)
    })
    await g.update({ joinCount: Math.min(g.expectMax, (g.joinCount || 0) + 1) })
    success(res, j.toJSON(), '报名成功，等待发起人确认')
  } catch (e) { next(e) }
})

/** 报名列表（发起人可见） */
router.get('/:id/joins', auth, async (req, res, next) => {
  try {
    const g = await Group.findByPk(req.params.id)
    if (!g) return fail(res, '组局不存在', 404)
    if (g.userId !== req.userId) return fail(res, '只有发起人可以查看报名列表', 403)
    const joins = await GroupJoin.findAll({ where: { groupId: g.id }, order: [['id', 'DESC']] })
    const userIds = [...new Set(joins.map(j => j.userId))]
    const users = await User.findAll({ where: { id: { [Op.in]: userIds } } })
    const userMap = Object.fromEntries(users.map(u => [u.id, { id: u.id, nickname: u.nickname, avatar: u.avatar, city: u.city, phone: u.phone }]))
    const list = joins.map(j => ({ ...j.toJSON(), user: userMap[j.userId] || null }))
    success(res, list)
  } catch (e) { next(e) }
})

/** 通过/拒绝报名（发起人） */
router.put('/:id/joins/:joinId', auth, async (req, res, next) => {
  try {
    const g = await Group.findByPk(req.params.id)
    if (!g) return fail(res, '组局不存在', 404)
    if (g.userId !== req.userId) return fail(res, '只有发起人可以处理报名', 403)
    const j = await GroupJoin.findByPk(req.params.joinId)
    if (!j || j.groupId !== g.id) return fail(res, '报名记录不存在', 404)
    const { status } = req.body
    if (!['approved', 'rejected'].includes(status)) return fail(res, 'status 仅允许 approved / rejected')
    await j.update({ status, handledAt: new Date().toISOString() })
    if (status === 'rejected') {
      // 拒绝 → 退一个名额
      await g.update({ joinCount: Math.max(1, (g.joinCount || 1) - 1), status: 'open' })
    }
    success(res, null, status === 'approved' ? '已通过报名' : '已拒绝报名')
  } catch (e) { next(e) }
})

module.exports = router
