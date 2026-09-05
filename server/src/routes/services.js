// @deprecated - 付费陪玩服务已下线，保留文件用于数据兼容
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
      // 服务者未填写城市/城市为空：不强制过滤（全国可展示，避免"选了具体城市 → 空城市服务全被隐藏"的反直觉）
      if (!rowCity) return true
      const r = String(rowCity).trim()
      if (!r) return true
      for (const v of cityVariants) {
        const vv = String(v).trim()
        if (!vv) continue
        if (r.startsWith(vv) || vv.startsWith(r)) return true
      }
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
    await service.increment('viewCount')
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
    const body = req.body || {}
    const { title, description, category, subCategory, coverImage, price, priceUnit, duration, tags } = body
    if (!title || !category || price == null) return fail(res, '参数不完整')
    const user = await User.findByPk(req.userId)
    // 城市优先级：
    //  1) 请求体 body.city / body.location.city（前端 service-publish 可能放在 location）
    //  2) 当前用户 city（已改到深圳）
    //  3) 配置中心 app.defaultCity 兜底
    //  归一化：normalizeCityName(深圳) → 深圳市；matchCity 已用 startsWith 双向兼容深圳/深圳市
    let city = ''
    try {
      const { normalizeCityName } = require('../utils/geo')
      const bodyCityRaw = body.city || (body.location && (body.location.city || body.location.name)) || ''
      const userCityRaw = user ? (user.city || '') : ''
      let raw = String(bodyCityRaw || userCityRaw || '').trim()
      if (!raw) {
        try {
          const { getModuleConfig } = require('../utils/config')
          const appCfg = await getModuleConfig('app')
          raw = String((appCfg && appCfg.defaultCity) || '').trim()
        } catch (_) {}
      }
      if (raw && typeof normalizeCityName === 'function') {
        const n = normalizeCityName(raw)
        if (n) raw = n
      }
      city = raw
    } catch (_) {}
    // 自动过审：配置中心 app.serviceAutoApprove=true 时直接 online，否则 pending
    let status = 'pending'
    let tip = '服务发布成功，等待审核'
    try {
      const { getModuleConfig } = require('../utils/config')
      const cfg = await getModuleConfig('app')
      if (cfg && cfg.serviceAutoApprove === true) {
        status = 'online'
        tip = '服务发布成功，已自动上架'
      }
    } catch (_) {}
    const service = await Service.create({
      providerId: req.userId,
      title, description, category, subCategory, coverImage,
      price, priceUnit, duration, tags, city, status
    })
    // 自动过审且用户未开通服务者身份：自动升级为服务者
    try {
      if (user && !user.isProvider && status === 'online') {
        await user.update({ isProvider: true })
      }
    } catch (_) {}
    success(res, service, tip)
  } catch (err) { next(err) }
})

module.exports = router
