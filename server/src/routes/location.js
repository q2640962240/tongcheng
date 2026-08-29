/* 定位相关 HTTP 路由 */
'use strict'
const express = require('express')
const router = express.Router()
const { success, fail } = require('../utils/response')
const { reverseGeocode, guessCityByIp } = require('../utils/geo')

router.post('/reverse', async (req, res) => {
  const t0 = Date.now()
  try {
    const { lat, lng } = req.body || {}
    const result = await reverseGeocode({ lat, lng })
    const tookMs = Date.now() - t0
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.info('[Location] reverse source=%s took=%sms lat=%s lng=%s', result.source, tookMs, lat, lng)
    }
    res.setHeader('X-Response-Time', String(tookMs))
    return success(res, { ...result }, 'ok', { tookMs, source: result.source })
  } catch (e) {
    const tookMs = Date.now() - t0
    if (process.env.NODE_ENV !== 'test') {
      console.error('[Location] reverse error took=%sms err=%s', tookMs, e && e.message)
    }
    res.setHeader('X-Response-Time', String(tookMs))
    // 任何异常均返回空成功对象（not-configured 语义），绝不 hang 或 5xx 抛到前端
    return success(res, { province: '', city: '', district: '', source: 'handler-error' }, 'ok', { tookMs, source: 'handler-error' })
  }
})

router.get('/guess-by-ip', (req, res) => {
  const t0 = Date.now()
  try {
    const info = guessCityByIp(req)
    const tookMs = Date.now() - t0
    if (process.env.NODE_ENV !== 'test') {
      console.info('[Location] guessByIp took=%sms fallback=%s reason=%s', tookMs, !!info.fallback, info.reason)
    }
    res.setHeader('X-Response-Time', String(tookMs))
    return success(res, info, 'ok', { tookMs })
  } catch (e) {
    const tookMs = Date.now() - t0
    if (process.env.NODE_ENV !== 'test') {
      console.error('[Location] guessByIp error took=%sms err=%s', tookMs, e && e.message)
    }
    res.setHeader('X-Response-Time', String(tookMs))
    return success(res, { province: '', city: '北京', fallback: true, reason: 'handler-error' }, 'ok', { tookMs })
  }
})

module.exports = router
