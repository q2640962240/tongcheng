const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { User, Wallet, Invite, Service, Review, Order, Follow, Greeting, Op } = require('../models')
const { auth, optionalAuth } = require('../middleware/auth')
const { success, fail, paginate } = require('../utils/response')
const oss = require('../utils/oss')
const { normalizeCityName } = require('../utils/geo')
const { expandAlias } = require('../utils/searchAlias')

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `avatar_${req.userId}_${Date.now()}${ext}`)
  }
})
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\//.test(file.mimetype)) cb(null, true)
    else cb(new Error('只允许上传图片'))
  }
})

/** 获取个人信息 */
router.get('/profile', auth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId)
    if (!user) return fail(res, '用户不存在', 404)
    success(res, {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      gender: user.gender,
      city: user.city,
      bio: user.bio,
      isElite: user.isElite,
      isProvider: user.isProvider,
      realPersonStatus: user.realPersonStatus,
      identityStatus: user.identityStatus,
      inviteCode: user.inviteCode,
      inviterId: user.inviterId
    })
  } catch (err) { next(err) }
})

/** 更新个人信息 */
router.put('/profile', auth, async (req, res, next) => {
  try {
    const { nickname, avatar, gender, city, bio } = req.body
    const user = await User.findByPk(req.userId)
    if (!user) return fail(res, '用户不存在', 404)
    const update = {}
    if (nickname !== undefined) update.nickname = nickname
    if (avatar !== undefined) update.avatar = avatar
    if (gender !== undefined) update.gender = gender
    if (city !== undefined) update.city = city
    if (bio !== undefined) update.bio = bio
    await user.update(update)
    success(res, null, '更新成功')
  } catch (err) { next(err) }
})

/** 用户搜索/筛选（寻人大厅与搜索页用，未登录也可访问） */
router.get('/discover', optionalAuth, async (req, res, next) => {
  const t0 = Date.now()
  try {
    const { page = 1, pageSize = 20, keyword, city, isElite, gender } = req.query
    const cityRaw = String(city || '').trim()
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
    const keywordRaw = String(keyword || '').trim()
    const ignored = !!keywordRaw && keywordRaw.length < 2
    const where = { status: 1 }
    if (cityNorm) where.city = cityNorm
    if (isElite !== undefined && isElite !== '') where.isElite = isElite === 'true'
    if (gender !== undefined && gender !== '') where.gender = Number(gender)
    const serviceTitleByUser = new Map()
    if (!ignored && keywordRaw) {
      try {
        const svcs = await Service.findAll({ where: { status: 'online' } })
        for (const s of svcs) {
          const arr = serviceTitleByUser.get(s.providerId) || []
          arr.push(String(s.title || ''))
          serviceTitleByUser.set(s.providerId, arr)
        }
      } catch (_) { /* ignore */ }
    }
    const userTagsByBio = (bio, nickname, servicesTitles) => {
      const merged = [nickname, bio].concat(servicesTitles || []).filter(Boolean).join(' ')
      return merged
    }
    const kws = (ignored || !keywordRaw)
      ? []
      : Array.from(new Set([keywordRaw].concat(expandAlias(keywordRaw)))).map(k => String(k).toLowerCase()).filter(Boolean)
    const allRows = await User.findAll({ where, order: [['isElite', 'DESC'], ['id', 'DESC']] })
    const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#0b1030"/><stop offset="1" stop-color="#1b2060"/></linearGradient></defs><rect width="128" height="128" rx="64" fill="url(#g)"/><circle cx="64" cy="52" r="22" fill="#d9b26b"/><path d="M22 112c6-24 26-36 42-36s36 12 42 36z" fill="#d9b26b"/></svg>')
    const normalized = allRows.map(u => {
      const avatar = String(u.avatar || '').trim() || DEFAULT_AVATAR
      const nickname = String(u.nickname || `用户#${u.id}`).trim()
      return {
        id: u.id, nickname, avatar,
        gender: u.gender != null ? Number(u.gender) : 0,
        city: String(u.city || ''),
        bio: String(u.bio || ''),
        isElite: !!u.isElite,
        realPersonStatus: u.realPersonStatus || '',
        servicesTitles: serviceTitleByUser.get(u.id) || [],
        tags: (u.bio ? String(u.bio).split(/[,，、\s]+/).filter(Boolean).slice(0, 3) : [])
      }
    })
    const filtered = normalized.filter(u => {
      if (!matchCity(u.city)) return false
      if (!kws.length) return true
      const hay = userTagsByBio(u.bio, u.nickname, u.servicesTitles) + ' ' + (u.tags || []).join(' ') + ' ' + u.city
      const lowerHay = hay.toLowerCase()
      return kws.some(k => lowerHay.includes(k))
    })
    const total = filtered.length
    const start = (page - 1) * pageSize
    const list = filtered.slice(start, start + pageSize).map(row => {
      const { servicesTitles: _st, ...rest } = row // eslint-disable-line no-unused-vars
      return rest
    })
    const meta = {
      tookMs: Date.now() - t0,
      keyword: keywordRaw,
      keywordNormalized: ignored ? '' : (kws[0] || ''),
      aliasesExpanded: kws,
      ignored,
      city: cityRaw,
      cityNormalized: cityNorm || '',
      total,
      reason: ignored ? '关键词过短，请输入至少 2 个字' : ''
    }
    paginate(res, list, total, page, pageSize, null, meta)
  } catch (err) { next(err) }
})

/** 头像上传（专用接口：上传 + 自动写回 user.avatar） */
router.post('/avatar', auth, avatarUpload.single('file'), async (req, res, next) => {
  if (!req.file) return fail(res, '请选择头像图片')
  try {
    const result = await oss.upload(req.file.path, req.file.filename, req.file.mimetype)
    const url = result.success ? result.url : `/uploads/${req.file.filename}`
    const user = await User.findByPk(req.userId)
    if (!user) return fail(res, '用户不存在', 404)
    await user.update({ avatar: url })
    success(res, { url, provider: result.provider || 'local' }, '头像更新成功')
  } catch (e) {
    // 回退本地
    const fallbackUrl = `/uploads/${req.file.filename}`
    try {
      const user = await User.findByPk(req.userId)
      if (user) await user.update({ avatar: fallbackUrl })
    } catch (_) {}
    success(res, { url: fallbackUrl, provider: 'local-fallback' }, '头像已更新（本地回退）')
  }
})

/** 获取认证状态 */
router.get('/certifications', auth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId)
    success(res, {
      realPerson: user.realPersonStatus,
      identity: user.identityStatus,
      isElite: user.isElite
    })
  } catch (err) { next(err) }
})

/** 申请精英认证 */
router.post('/elite/apply', auth, avatarUpload.single('photo'), async (req, res, next) => {
  try {
    const { realName, idCard, city } = req.body
    if (!realName || !idCard) return fail(res, '请填写完整信息')
    let photoUrl = req.body.photo || ''
    if (req.file) {
      try {
        const result = await oss.upload(req.file.path, req.file.filename, req.file.mimetype)
        photoUrl = result.success ? result.url : `/uploads/${req.file.filename}`
      } catch (e) {
        photoUrl = `/uploads/${req.file.filename}`
      }
    }
    const user = await User.findByPk(req.userId)
    await user.update({
      city: city || user.city,
      identityStatus: 'pending',
      realPersonStatus: 'pending'
    })
    success(res, { photo: photoUrl }, '认证申请已提交')
  } catch (err) { next(err) }
})

/** 服务者主页（公开接口：资料 + 在线服务 + 评价汇总） */
router.get('/provider/:id', async (req, res, next) => {
  try {
    const providerId = Number(req.params.id)
    const provider = await User.findByPk(providerId)
    if (!provider) return fail(res, '用户不存在', 404)

    // 在线服务列表
    const services = await Service.findAll({
      where: { providerId, status: 'online' },
      order: [['sort', 'DESC'], ['createdAt', 'DESC']]
    })

    // 统计：订单数
    const orderCount = await Order.count({
      where: { providerId, status: 'completed' }
    })

    // 评价统计：按 serviceId IN (...) 查询，避免全表扫描
    let totalReviews = 0
    let avgRating = 5.0
    if (services.length > 0) {
      const serviceIds = services.map(s => s.id)
      const { Op } = require('../models')
      const providerReviews = await Review.findAll({
        where: { serviceId: { [Op.in]: serviceIds } }
      })
      totalReviews = providerReviews.length
      if (totalReviews > 0) {
        avgRating = Number((providerReviews.reduce((s, r) => s + Number(r.rating), 0) / totalReviews).toFixed(1))
      }
    }

    success(res, {
      id: provider.id,
      nickname: provider.nickname,
      avatar: provider.avatar,
      gender: provider.gender,
      city: provider.city,
      bio: provider.bio,
      isElite: provider.isElite,
      isProvider: provider.isProvider,
      realPersonStatus: provider.realPersonStatus,
      stats: {
        orderCount,
        totalReviews,
        avgRating: Number(avgRating)
      },
      services: services.map(s => s.toJSON())
    })
  } catch (err) { next(err) }
})

/** 客服信息（公开接口，无需鉴权） */
router.get('/kefu', async (req, res, next) => {
  try {
    const { getModuleConfig } = require('../utils/config')
    const cfg = await getModuleConfig('app')
    success(res, {
      wechat: cfg.kefuWechat || '',
      qrcode: cfg.kefuQrcode || '',
      phone: cfg.kefuPhone || '',
      notice: cfg.kefuNotice || '如有问题请联系客服微信'
    })
  } catch (err) { next(err) }
})

// ========== 社交功能端点 ==========

/** 获取用户公开主页 */
router.get('/:id/public-profile', async (req, res, next) => {
  try {
    const userId = Number(req.params.id)
    const user = await User.findByPk(userId, {
      attributes: ['id', 'nickname', 'avatar', 'gender', 'city', 'bio', 'isElite', 'realPersonStatus', 'createdAt']
    })
    if (!user) return fail(res, '用户不存在', 404)
    success(res, user)
  } catch (err) { next(err) }
})

/** 关注用户（需鉴权） */
router.post('/:id/follow', auth, async (req, res, next) => {
  try {
    const targetId = Number(req.params.id)
    if (targetId === req.userId) return fail(res, '不能关注自己')

    const target = await User.findByPk(targetId)
    if (!target) return fail(res, '用户不存在', 404)

    const existing = await Follow.findOne({
      where: { followerId: req.userId, followingId: targetId }
    })
    if (existing) return fail(res, '已关注该用户')

    await Follow.create({ followerId: req.userId, followingId: targetId })
    success(res, null, '关注成功')
  } catch (err) { next(err) }
})

/** 取消关注（需鉴权） */
router.delete('/:id/follow', auth, async (req, res, next) => {
  try {
    const targetId = Number(req.params.id)
    const record = await Follow.findOne({
      where: { followerId: req.userId, followingId: targetId }
    })
    if (!record) return fail(res, '未关注该用户')
    await record.destroy()
    success(res, null, '已取消关注')
  } catch (err) { next(err) }
})

/** 粉丝列表（分页） */
router.get('/:id/followers', async (req, res, next) => {
  try {
    const userId = Number(req.params.id)
    const { page = 1, pageSize = 20 } = req.query
    const { rows, count } = await Follow.findAndCountAll({
      where: { followingId: userId },
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    const list = []
    for (const f of rows) {
      const u = await User.findByPk(f.followerId, {
        attributes: ['id', 'nickname', 'avatar', 'bio', 'isElite']
      })
      if (u) list.push(u)
    }
    paginate(res, list, count, page, pageSize)
  } catch (err) { next(err) }
})

/** 关注列表（分页） */
router.get('/:id/following', async (req, res, next) => {
  try {
    const userId = Number(req.params.id)
    const { page = 1, pageSize = 20 } = req.query
    const { rows, count } = await Follow.findAndCountAll({
      where: { followerId: userId },
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    const list = []
    for (const f of rows) {
      const u = await User.findByPk(f.followingId, {
        attributes: ['id', 'nickname', 'avatar', 'bio', 'isElite']
      })
      if (u) list.push(u)
    }
    paginate(res, list, count, page, pageSize)
  } catch (err) { next(err) }
})

/** 打招呼（需鉴权） */
router.post('/:id/greet', auth, async (req, res, next) => {
  try {
    const receiverId = Number(req.params.id)
    if (receiverId === req.userId) return fail(res, '不能给自己打招呼')

    const receiver = await User.findByPk(receiverId)
    if (!receiver) return fail(res, '用户不存在', 404)

    const { message } = req.body
    await Greeting.create({
      senderId: req.userId,
      receiverId,
      message: message || ''
    })
    success(res, null, '打招呼已发送')
  } catch (err) { next(err) }
})

module.exports = router
