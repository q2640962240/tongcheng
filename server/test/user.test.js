const request = require('supertest')
const app = require('../src/app')
const { login, authHeader } = require('./helpers')

describe('用户模块', () => {
  let token

  beforeAll(async () => {
    ({ token } = await login('13800004444'))
  })

  describe('GET /api/user/profile', () => {
    it('应返回当前用户信息', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set(authHeader(token))
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data).toHaveProperty('phone', '13800004444')
      expect(res.body.data).toHaveProperty('nickname')
    })
  })

  describe('PUT /api/user/profile', () => {
    it('应更新用户资料', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set(authHeader(token))
        .send({ nickname: '测试用户', gender: 1, city: '北京', bio: '测试简介' })
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.message).toContain('成功')
    })

    it('更新后应返回新资料', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set(authHeader(token))
        .expect(200)

      expect(res.body.data.nickname).toBe('测试用户')
      expect(res.body.data.gender).toBe(1)
      expect(res.body.data.city).toBe('北京')
    })
  })

  describe('GET /api/user/certifications', () => {
    it('应返回认证状态', async () => {
      const res = await request(app)
        .get('/api/user/certifications')
        .set(authHeader(token))
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('realPerson')
      expect(res.body.data).toHaveProperty('identity')
    })
  })

  describe('GET /api/user/kefu', () => {
    it('应返回客服信息（公开接口）', async () => {
      const res = await request(app)
        .get('/api/user/kefu')
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('wechat')
    })
  })
})
