const request = require('supertest')
const app = require('../src/app')

describe('认证模块', () => {
  describe('POST /api/auth/sms', () => {
    it('应成功发送验证码', async () => {
      const res = await request(app)
        .post('/api/auth/sms')
        .send({ phone: '13800001111' })
        .expect(200)

      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('code')
      expect(res.body.data.code).toHaveLength(6)
    })

    it('应拒绝无效手机号', async () => {
      const res = await request(app)
        .post('/api/auth/sms')
        .send({ phone: '123' })
        .expect(400)

      expect(res.body.code).not.toBe(0)
    })

    it('应拒绝缺少手机号', async () => {
      const res = await request(app)
        .post('/api/auth/sms')
        .send({})
        .expect(400)

      expect(res.body.code).not.toBe(0)
    })
  })

  describe('POST /api/auth/login', () => {
    it('应成功登录并返回 token', async () => {
      // 先发验证码
      const smsRes = await request(app)
        .post('/api/auth/sms')
        .send({ phone: '13800002222' })

      const code = smsRes.body.data.code

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '13800002222', code })
        .expect(200)

      expect(loginRes.body.code).toBe(0)
      expect(loginRes.body.data).toHaveProperty('token')
      expect(loginRes.body.data).toHaveProperty('user')
      expect(loginRes.body.data.user).toHaveProperty('id')
      expect(loginRes.body.data.user).toHaveProperty('phone', '13800002222')
    })

    it('应拒绝错误的验证码', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '13800003333', code: '000000' })
        .expect(400)

      expect(res.body.code).not.toBe(0)
    })
  })

  describe('鉴权保护', () => {
    it('无 token 访问受保护接口应返回 401', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .expect(401)

      expect(res.body.code).not.toBe(0)
    })

    it('无效 token 应返回 401', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(res.body.code).not.toBe(0)
    })
  })
})
