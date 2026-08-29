/*
 * 行政区划路由：全国 34 省 + ≥337 地级及以上城市
 *   GET /tree      省→市两级树
 *   GET /search    中文 / 拼音 / 别名模糊检索
 */
'use strict'
const express = require('express')
const router = express.Router()
const { success, fail } = require('../utils/response')
const { getRegionTree, searchRegions, getMeta } = require('../data/china_cities')

router.get('/tree', (req, res) => {
  const t0 = Date.now()
  try {
    const tree = getRegionTree()
    return success(res, tree, 'ok', {
      tookMs: Date.now() - t0,
      provinceCount: tree.provinces.length,
      cityCount: tree.provinces.reduce((s, p) => s + p.cities.length, 0)
    })
  } catch (e) {
    return fail(res, e.message || '行政区划数据加载失败', 500)
  }
})

router.get('/search', (req, res) => {
  const t0 = Date.now()
  const raw = String(req.query.kw || req.query.keyword || '').trim()
  if (!raw) return success(res, [], 'ok', { tookMs: Date.now() - t0, ignored: true, reason: '关键词为空' })
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50))
  let list = searchRegions(raw)
  const total = list.length
  list = list.slice(0, limit)
  return success(res, list, 'ok', {
    tookMs: Date.now() - t0,
    keyword: raw,
    total,
    ignored: false,
    reason: ''
  })
})

router.get('/meta', (_req, res) => {
  success(res, {
    ...getMeta()
  })
})

module.exports = router
