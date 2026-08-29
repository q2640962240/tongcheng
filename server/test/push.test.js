const request = require('supertest')
const app = require('../src/app')
const { login, authHeader } = require('./helpers')

describe('推送模块', () => {
  let token

  beforeAll(async () => {
    ({ token } = await login('13800009999'))
  })

  describe('POST /api/push/test', () => {
    it('dev 模式应返回测试成功', async () => {
      const res = await request(app)
        .post('/api/push/test')
        .set(authHeader(token))
        .send({})
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('provider')
    })
  })

  describe('POST /api/push/broadcast', () => {
    it('应成功发送广播', async () => {
      const res = await request(app)
        .post('/api/push/broadcast')
        .set(authHeader(token))
        .send({ title: '测试广播', body: '这是一条测试消息' })
        .expect(200)

      expect(res.body.code).toBe(0)
    })

    it('应拒绝缺少标题的广播', async () => {
      const res = await request(app)
        .post('/api/push/broadcast')
        .set(authHeader(token))
        .send({ body: '缺少标题' })
        .expect(400)

      expect(res.body.code).not.toBe(0)
    })
  })
})
