const request = require('supertest')
const app = require('../src/app')
const { login, authHeader } = require('./helpers')

describe('邀请模块', () => {
  let token

  beforeAll(async () => {
    ({ token } = await login('13800007777'))
  })

  describe('GET /api/invite/stats', () => {
    it('应返回邀请统计', async () => {
      const res = await request(app)
        .get('/api/invite/stats')
        .set(authHeader(token))
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('totalInvitees')
      expect(res.body.data).toHaveProperty('totalReward')
      expect(res.body.data).toHaveProperty('monthlyReward')
    })
  })

  describe('GET /api/invite/leaderboard', () => {
    it('应返回邀请排行榜', async () => {
      const res = await request(app)
        .get('/api/invite/leaderboard')
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('GET /api/invite/share-info', () => {
    it('应返回分享信息', async () => {
      const res = await request(app)
        .get('/api/invite/share-info')
        .set(authHeader(token))
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('inviteCode')
      expect(res.body.data).toHaveProperty('shareTitle')
    })
  })

  describe('POST /api/invite/bind', () => {
    it('应拒绝无效邀请码', async () => {
      const res = await request(app)
        .post('/api/invite/bind')
        .set(authHeader(token))
        .send({ inviteCode: 'INVALID_CODE' })
        .expect(400)

      expect(res.body.code).not.toBe(0)
    })
  })
})
