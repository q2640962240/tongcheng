const express = require('express')
const router = express.Router()
const { Service, ServiceCategory, User, Review } = require('../models')
const { optionalAuth, auth } = require('../middleware/auth')
const { success, paginate, fail } = require('../utils/response')
const { expandAlias } = require('../utils/searchAlias')
const { normalizeCityName } = require('../utils/geo')

// 历史内置兜底：当 DB 服务分类未初始化时，返回老版本固定 3 大类
const LEGACY_CATEGORIES = [
  { key: 'warm', name: '暖心服务', children: [
    { key: 'virtual-lover', name: '虚拟恋人', price: 99, priceUnit: '20分钟' },
    { key: 'sing', name: '给你唱歌', price: 6, priceUnit: '首' },
    { key: 'sleep', name: '哄睡电台', price: 0, priceUnit: '按分钟' },
    { key: 'wake', name: '叫醒服务', price: 0, priceUnit: '按次' }
  ]},
  { key: 'game', name: '游戏陪玩', children: [
    { key: 'wzry', name: '王者荣耀', price: 10, priceUnit: '局' },
    { key: 'hpjy', name: '和平精英', price: 10, priceUnit: '局' },
    { key: 'lol', name: '英雄联盟', price: 10, priceUnit: '局' },
    { key: 'other-game', name: '其他游戏', price: 10, priceUnit: '局' }
  ]},
  { key: 'offline', name: '兴趣约玩', children: [
    { key: 'sport', name: '运动健身' },
    { key: 'date', name: '同城约会' },
    { key: 'offline-game', name: '线下开黑' }
  ]}
]

/** 按 ServiceCategory 表组装树；visibleOnly=true 仅返回上架；admin 可见全部 */
async function buildCategoryTree({ visibleOnly = true, includeHiddenChildren = false } = {}) {
  const all = await ServiceCategory.findAll({ order: [['sort', 'DESC'], ['key', 'ASC']] })
  if (!all || all.length === 0) return LEGACY_CATEGORIES
  const top = []
  const parentMap = new Map()
  for (const c of all) {
    const j = typeof c.toJSON === 'function' ? c.toJSON() : c
    if (!j.parentKey) {
      if (!visibleOnly || j.visible !== false) { top.push({ ...j, children: [] }); parentMap.set(j.key, top[top.length - 1]) }
    }
  }
  for (const c of all) {
    const j = typeof c.toJSON === 'function' ? c.toJSON() : c
    if (!j.parentKey) continue
    if (visibleOnly && !includeHiddenChildren && j.visible === false) continue
    const p = parentMap.get(j.parentKey)
    if (!p) continue
    p.children.push({ ...j })
  }
  // 子级再按 sort 倒序
  top.forEach(t => { t.children.sort((a, b) => (b.sort || 0) - (a.sort || 0)) })
  return top
}

/** 用户端服务分类（仅返回可见分类） */
router.get('/categories', async (req, res) => {
  try {
    const tree = await buildCategoryTree({ visibleOnly: true })
    success(res, tree, 'ok')
  } catch (e) {
    // 兜底：任意异常回落到 LEGACY_CATEGORIES
    console.warn('[categories] fallback cause:', e && e.message)
    success(res, LEGACY_CATEGORIES, 'ok（fallback）')
  }
})
/** 保留原路径避免管理后台旧调用失效（返回全部，便于 admin 同步使用） */
router.get('/categories/list', async (req, res) => {
  try {
    const visibleOnly = String(req.query.visible || 'all') === 'visible'
    const tree = await buildCategoryTree({ visibleOnly })
    success(res, tree, 'ok')
  } catch (e) {
    console.warn('[categories/list] fallback cause:', e && e.message)
    success(res, LEGACY_CATEGORIES, 'ok（fallback）')
  }
})

/** 服务列表 */
router.get('/', optionalAuth, async (req, res, next) => {
  const t0 = Date.now()
  try {
    const { category, subCategory, status, page = 1, pageSize = 10, keyword, city } = req.query
    const where = { status: status || 'online' }
    if (category) where.category = category
    if (subCategory) where.subCategory = subCategory
    // 城市规范化：精确匹配失败时允许前缀匹配（兼容"广州/广州市"）
    // 规范化流程：ignored 时 collapse 为 []，否则 expandAlias(...).map(小写)
    const keywordRaw = String(keyword || '').trim()
    const ignoredForExpand = !!keywordRaw && keywordRaw.length < 2
    const rawExpanded = ignoredForExpand ? [keywordRaw] : expandAlias(keywordRaw)
    const keywordList = ignoredForExpand ? [] : Array.from(new Set(rawExpanded)).map(s => String(s).toLowerCase()).filter(Boolean)
    const cityNormalized = city ? normalizeCityName(city) : ''
    const cityVariants = new Set()
    if (city) {
      cityVariants.add(String(city))
      if (cityNormalized && cityNormalized !== String(city)) cityVariants.add(cityNormalized)
      // 去掉"市/州/盟/地区"再试
      const withoutSuffix = String(city).replace(/(市|自治州|地区|盟)$/, '')
      if (withoutSuffix && withoutSuffix !== String(city)) cityVariants.add(withoutSuffix)
    }
    const { Op } = require('../models')
    const matchCity = (rowCity) => {
      if (!cityVariants.size) return true
      if (!rowCity) return false
      const r = String(rowCity)
      for (const v of cityVariants) if (r.startsWith(v) || v.startsWith(r)) return true
      return false
    }
    const keywordStr = String(keyword || '').trim()
    // 关键词 < 2 字符时 ignored，避免单字符/符号产生海量误匹配
    const ignored = !!keywordStr && keywordStr.length < 2
    const keywordEffective = ignored ? '' : keywordStr
    let rows, count
    if (keywordEffective || cityVariants.size) {
      // 关键词匹配同时搜索服务者昵称，走全量 + 同义词 + 城市过滤
      const all = await Service.findAll({ where: Object.keys(where).length ? where : undefined, order: [['sort', 'DESC'], ['createdAt', 'DESC']] })
      const matched = []
      for (const s of all) {
        if (!matchCity(s.city)) continue
        const p = await User.findByPk(s.providerId)
        const providerName = p ? String(p.nickname || '') : ''
        const haystacks = [
          String(s.title || ''),
          String(s.description || ''),
          providerName,
          Array.isArray(s.tags) ? s.tags.join(' ') : String(s.tags || '')
        ].map(s => s.toLowerCase())
        let hit = !keywordEffective
        if (keywordEffective && keywordList.length) {
          // 注意：keywordList 已去重+小写化，这里直接用即可（已经包含了 keywordEffective 自身 normalized）
          for (const k of keywordList) {
            if (!k) continue
            if (haystacks.some(h => h.includes(k))) { hit = true; break }
          }
        }
        if (!hit) continue
        matched.push({ ...s.toJSON(), provider: p ? { id: p.id, nickname: p.nickname, avatar: p.avatar, isElite: p.isElite, gender: p.gender } : null })
      }
      rows = matched.slice((page - 1) * pageSize, page * pageSize)
      count = matched.length
    } else {
      const f = await Service.findAndCountAll({
        where,
        order: [['sort', 'DESC'], ['createdAt', 'DESC']],
        offset: (page - 1) * pageSize,
        limit: Number(pageSize)
      })
      rows = f.rows; count = f.count
      rows = await Promise.all(rows.map(async s => {
        const provider = await User.findByPk(s.providerId)
        return { ...s.toJSON(), provider: provider ? { id: provider.id, nickname: provider.nickname, avatar: provider.avatar, isElite: provider.isElite, gender: provider.gender } : null }
      }))
    }
    const meta = {
      tookMs: Date.now() - t0,
      keyword: String(keyword || ''),
      keywordNormalized: ignored ? '' : keywordList[0] || '',
      city: String(city || ''),
      cityNormalized: cityNormalized || '',
      aliasesExpanded: keywordList,
      ignored,
      total: Number(count || 0),
      reason: ignored ? '关键词过短，请输入至少 2 个字' : ''
    }
    paginate(res, rows, count, page, pageSize, null, meta)
  } catch (err) { next(err) }
})

/** 我发布的服务（服务者管理） */
router.get('/mine/list', auth, async (req, res, next) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query
    const where = { providerId: req.userId }
    if (status) where.status = status
    const { rows, count } = await Service.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    paginate(res, rows, count, page, pageSize)
  } catch (err) { next(err) }
})

/** 服务详情 */
router.get('/:id', async (req, res, next) => {
  try {
    const service = await Service.findByPk(req.params.id)
    if (!service) return fail(res, '服务不存在', 404)
    await Service.increment(service.id, 'viewCount', 1)
    const provider = await User.findByPk(service.providerId)
    success(res, {
      ...service.toJSON(),
      provider: provider ? {
        id: provider.id, nickname: provider.nickname, avatar: provider.avatar,
        isElite: provider.isElite, gender: provider.gender, bio: provider.bio
      } : null
    })
  } catch (err) { next(err) }
})

/** 服务的评价列表 */
router.get('/:id/reviews', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, rating } = req.query
    const service = await Service.findByPk(req.params.id)
    if (!service) return fail(res, '服务不存在', 404)
    const where = { serviceId: service.id }
    if (rating) where.rating = Number(rating)
    const { rows, count } = await Review.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    const result = []
    for (const r of rows) {
      let reviewer = null
      if (!r.isAnonymous) {
        const u = await User.findByPk(r.userId)
        reviewer = u ? { nickname: u.nickname, avatar: u.avatar } : null
      }
      result.push({ ...r.toJSON(), reviewer })
    }
    // 汇总评分分布
    const allReviews = await Review.findAll({ where: { serviceId: service.id } })
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    allReviews.forEach(r => { distribution[r.rating] = (distribution[r.rating] || 0) + 1 })
    success(res, {
      list: result,
      total: count,
      page: Number(page),
      pageSize: Number(pageSize),
      ratingAvg: service.ratingAvg || 0,
      totalReviews: allReviews.length,
      distribution
    })
  } catch (err) { next(err) }
})

/** 上下架服务 */
router.put('/:id/status', auth, async (req, res, next) => {
  try {
    const { status } = req.body
    if (!['online', 'offline'].includes(status)) return fail(res, '状态参数不正确')
    const service = await Service.findByPk(req.params.id)
    if (!service) return fail(res, '服务不存在', 404)
    if (service.providerId !== req.userId) return fail(res, '无权操作', 403)
    if (service.status === 'pending') return fail(res, '审核中的服务不可操作')

    await service.update({ status })
    success(res, null, status === 'online' ? '已上架' : '已下架')
  } catch (err) { next(err) }
})

/** 更新服务 */
router.put('/:id', auth, async (req, res, next) => {
  try {
    const service = await Service.findByPk(req.params.id)
    if (!service) return fail(res, '服务不存在', 404)
    if (service.providerId !== req.userId) return fail(res, '无权操作', 403)

    const { title, description, price, priceUnit, duration, tags } = req.body
    await service.update({ title, description, price, priceUnit, duration, tags })
    success(res, null, '服务已更新')
  } catch (err) { next(err) }
})

/** 发布服务 */
router.post('/', auth, async (req, res, next) => {
  try {
    const { title, description, category, subCategory, coverImage, price, priceUnit, duration, tags } = req.body
    if (!title || !category || price == null) return fail(res, '参数不完整')
    const service = await Service.create({
      providerId: req.userId,
      title, description, category, subCategory, coverImage,
      price, priceUnit, duration, tags
    })
    success(res, service, '服务发布成功，等待审核')
  } catch (err) { next(err) }
})

module.exports = router
