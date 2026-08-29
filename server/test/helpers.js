/**
 * 测试辅助：登录并返回 token + userId
 * 所有需要鉴权的测试都通过此模块获取 token
 */
const request = require('supertest')
const app = require('../src/app')

let cachedToken = null
let cachedUserId = null

/** 发送验证码并登录，返回 { token, userId } */
async function login(phone = '13800001111') {
  // 发送验证码
  const smsRes = await request(app)
    .post('/api/auth/sms')
    .send({ phone })
    .expect(200)

  const code = smsRes.body.data.code

  // 登录
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ phone, code })
    .expect(200)

  cachedToken = loginRes.body.data.token
  cachedUserId = loginRes.body.data.user.id
  return { token: cachedToken, userId: cachedUserId }
}

/** 获取鉴权 headers */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

/** 获取 app 实例 */
function getApp() {
  return app
}

module.exports = { login, authHeader, getApp, request }
