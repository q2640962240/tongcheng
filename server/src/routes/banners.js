const express = require('express')
const router = express.Router()
const { Banner, Op } = require('../models')
const { Admin } = require('../models')
const { success, paginate, fail } = require('../utils/response')

/** 管理鉴权（与 admin.js 保持一致，避免循环引用） */
const adminAuth = async (req, res, next) => {
  const token = req.headers['x-admin-token']
  if (!token) return fail(res, '请先登录管理后台', 401)
  const id = String(token).startsWith('admin_') ? Number(token.slice(6)) : NaN
  if (!id) return fail(res, '无效 token', 401)
  const admin = await Admin.findByPk(id)
  if (!admin) return fail(res, '管理员不存在', 401)
  req.adminId = admin.id
  next()
}

/** 前端公开列表（只返回启用中、可按位置过滤、不暴露内部字段） */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(50, Number(req.query.pageSize) || 10)
    const offset = (page - 1) * pageSize
    const where = { enabled: true }
    if (req.query.position) where.position = req.query.position
    const { count: total, rows } = await Banner.findAndCountAll({
      where, order: [['sort', 'ASC'], ['id', 'DESC']], limit: pageSize, offset
    })
    paginate(res, rows.map(b => {
      const { enabled, startTime, endTime, ...r } = b.toJSON()  // 只对外暴露必要字段
      return r
    }), total, page, pageSize)
  } catch (e) { next(e) }
})

/** 管理端列表（含所有状态） */
router.get('/admin/list', adminAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20)
    const offset = (page - 1) * pageSize
    const where = {}
    if (req.query.position) where.position = req.query.position
    if (req.query.enabled !== undefined) where.enabled = req.query.enabled === 'true'
    const { count: total, rows } = await Banner.findAndCountAll({
      where, order: [['sort', 'ASC'], ['id', 'DESC']], limit: pageSize, offset
    })
    paginate(res, rows, total, page, pageSize)
  } catch (e) { next(e) }
})

/**
 * 后台风格别名：GET/POST/PUT/DELETE /admin/banners([/:id])
 * 与 routes/admin.js 保持一致的路径前缀风格，实际实现仍走 banners.js（单份逻辑）
 */
router.get('/admin/banners', adminAuth, (req, res, next) => {
  // 转发到 /admin/list 处理（复用查询 + 分页 + 鉴权）
  req.url = '/admin/list'
  router.handle(req, res, next)
})
router.post('/admin/banners', adminAuth, (req, res, next) => {
  req.url = '/'
  router.handle(req, res, next)
})
router.put('/admin/banners/:id', adminAuth, (req, res, next) => {
  req.url = `/${req.params.id}`
  router.handle(req, res, next)
})
router.delete('/admin/banners/:id', adminAuth, (req, res, next) => {
  req.url = `/${req.params.id}`
  router.handle(req, res, next)
})

/** 新增 Banner（管理员） */
router.post('/', adminAuth, async (req, res, next) => {
  try {
    const { title, image, link, position = 'home_top', sort = 0, enabled = true, startTime, endTime } = req.body
    if (!image) return fail(res, '请上传 Banner 图片')
    const b = await Banner.create({
      title: title || '', image, link: link || '', position,
      sort: Number(sort) || 0, enabled: !!enabled,
      startTime: startTime || null, endTime: endTime || null
    })
    success(res, b.toJSON(), '创建成功')
  } catch (e) { next(e) }
})

/** 修改 Banner（管理员） */
router.put('/:id', adminAuth, async (req, res, next) => {
  try {
    const b = await Banner.findByPk(req.params.id)
    if (!b) return fail(res, 'Banner 不存在', 404)
    const allowed = ['title', 'image', 'link', 'position', 'sort', 'enabled', 'startTime', 'endTime']
    const update = {}
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k]
    await b.update(update)
    success(res, null, '已更新')
  } catch (e) { next(e) }
})

/** 删除 Banner（管理员） */
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const b = await Banner.findByPk(req.params.id)
    if (!b) return fail(res, 'Banner 不存在', 404)
    await Banner.destroy({ where: { id: b.id } })
    success(res, null, '已删除')
  } catch (e) { next(e) }
})

module.exports = router
