const request = require('supertest')
const app = require('../src/app')
const { login, authHeader } = require('./helpers')

describe('服务模块', () => {
  let token

  beforeAll(async () => {
    ({ token } = await login('13800005555'))
  })

  describe('GET /api/services', () => {
    it('应返回服务列表', async () => {
      const res = await request(app)
        .get('/api/services')
        .query({ page: 1, pageSize: 10 })
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('list')
      expect(res.body.data).toHaveProperty('total')
      expect(Array.isArray(res.body.data.list)).toBe(true)
    })

    it('应支持分类筛选', async () => {
      const res = await request(app)
        .get('/api/services')
        .query({ category: 'warm', page: 1, pageSize: 5 })
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('list')
    })

    it('应支持分页', async () => {
      const res = await request(app)
        .get('/api/services')
        .query({ page: 2, pageSize: 5 })
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('page', 2)
    })
  })

  describe('POST /api/services', () => {
    it('应创建新服务', async () => {
      const res = await request(app)
        .post('/api/services')
        .set(authHeader(token))
        .send({
          title: '测试服务',
          description: '这是一个测试服务',
          price: 50,
          duration: 30,
          category: 'warm',
          tags: ['测试', '陪伴']
        })
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.title).toBe('测试服务')
    })
  })

  describe('GET /api/services/mine', () => {
    it('应返回当前用户的服务列表', async () => {
      const res = await request(app)
        .get('/api/services/mine/list')
        .set(authHeader(token))
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('list')
    })
  })
})
