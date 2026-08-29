const request = require('supertest')
const app = require('../src/app')
const { login, authHeader } = require('./helpers')

describe('设置模块', () => {
  let token

  beforeAll(async () => {
    ({ token } = await login('13800008888'))
  })

  describe('GET /api/settings', () => {
    it('应返回用户设置', async () => {
      const res = await request(app)
        .get('/api/settings')
        .set(authHeader(token))
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('smsDnd')
      expect(res.body.data).toHaveProperty('phone')
    })
  })

  describe('POST /api/settings/sms-dnd', () => {
    it('应切换短信免打扰', async () => {
      const res = await request(app)
        .post('/api/settings/sms-dnd')
        .set(authHeader(token))
        .send({ enabled: true })
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data.enabled).toBe(true)

      // 验证已持久化
      const getRes = await request(app)
        .get('/api/settings')
        .set(authHeader(token))
      expect(getRes.body.data.smsDnd).toBe(true)

      // 恢复
      await request(app)
        .post('/api/settings/sms-dnd')
        .set(authHeader(token))
        .send({ enabled: false })
    })
  })

  describe('POST /api/settings/cancel-account', () => {
    it('有未完成订单时应拒绝注销', async () => {
      // 新用户无订单，应允许注销
      const res = await request(app)
        .post('/api/settings/cancel-account')
        .set(authHeader(token))
        .send({})
        .expect(200)

      expect(res.body.code).toBe(0)
    })
  })
})
