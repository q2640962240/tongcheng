const request = require('supertest')
const app = require('../src/app')

describe('健康检查', () => {
  it('GET /health 应返回服务状态', async () => {
    const res = await request(app).get('/health').expect(200)
    expect(res.body).toHaveProperty('status')
  })

  it('GET /api/health 应返回健康状态', async () => {
    const res = await request(app).get('/api/health').expect(200)
    expect(res.body).toHaveProperty('status')
  })

  it('未知路由应返回 404', async () => {
    const res = await request(app).get('/api/nonexistent').expect(404)
    expect(res.body).toHaveProperty('message')
  })
})
