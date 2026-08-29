/**
 * 精英付费 (Elite) 模块 Jest 测试
 * 覆盖：权益查询、下单开通、dev 快捷开通、扣钻解锁微信号、联系额度
 */
const { login, authHeader, getApp, request } = require('./helpers')
const app = getApp()

let token, userId, token2, uid2

beforeAll(async () => {
  const r1 = await login('13800007777')
  token = r1.token; userId = r1.userId
  const r2 = await login('13800008888')
  token2 = r2.token; uid2 = r2.userId
  // 给用户 1 钱包塞点钻石
  const { Wallet } = require('../src/models')
  const w = await Wallet.findOne({ where: { userId } })
  if (w) await w.update({ diamond: 200 })
  else await Wallet.create({ userId, diamond: 200, balance: 0 })
})

describe('GET /api/elite/rights — 权益公开', () => {
  test('未登录可访问，含 6 项权益 + 价格', async () => {
    const res = await request(app).get('/api/elite/rights').expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.rights).toBeInstanceOf(Array)
    expect(res.body.data.rights.length).toBeGreaterThanOrEqual(5)
    expect(res.body.data.priceYuan).toBeDefined()
    expect(res.body.data.priceFen).toBeGreaterThanOrEqual(100)
    expect(res.body.data.plan).toBe('lifetime')
    expect(typeof res.body.data.unlockWechatDiamondCost).toBe('number')
  })
})

describe('POST /api/elite/dev/pay — Dev 快捷开通', () => {
  test('未鉴权返回 401', async () => {
    await request(app).post('/api/elite/dev/pay').send({}).expect(401)
  })

  test('非精英可直接开通，写入 EliteOrder + User.isElite', async () => {
    // 用户 2 没开通过
    const res = await request(app)
      .post('/api/elite/dev/pay')
      .set(authHeader(token2))
      .send({})
      .expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.isElite).toBe(true)
    expect(res.body.data.status).toBe('paid')
    expect(res.body.data.outTradeNo).toMatch(/^EL[\dA-F]+U\d+[\dA-F]*DEV$/)
    // 再查一次 user 信息
    const { User } = require('../src/models')
    const u = await User.findByPk(uid2)
    expect(u.isElite).toBe(true)
  })

  test('已精英则直接返回 alreadyElite=true，不重复创建订单', async () => {
    const before = await request(app)
      .post('/api/elite/dev/pay')
      .set(authHeader(token2))
      .send({})
      .expect(200)
    expect(before.body.code).toBe(0)
    expect(before.body.data.alreadyElite).toBe(true)
  })
})

describe('POST /api/elite/pay/order — 下单（通用）', () => {
  test('dev 环境下单即自动开通', async () => {
    // 用用户 1（尚未开通）
    const res = await request(app)
      .post('/api/elite/pay/order')
      .set(authHeader(token))
      .send({ channel: 'dev' })
      .expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.developmentAutoPaid).toBe(true)
    expect(res.body.data.status).toBe('paid')
    expect(res.body.data.unlocked).toBe(true)
    expect(res.body.data.amount).toBeDefined()
    // User.isElite 应该 true
    const { User } = require('../src/models')
    const u = await User.findByPk(userId)
    expect(u.isElite).toBe(true)
  })

  test('已精英重复下单被拒绝', async () => {
    const res = await request(app)
      .post('/api/elite/pay/order')
      .set(authHeader(token2))
      .send({ channel: 'dev' })
    expect(res.body.code).not.toBe(0)
    expect(res.body.message).toMatch(/精英/)
  })

  test('非法 channel 被拒绝', async () => {
    // 换一个未开通的账号
    const { login } = require('./helpers')
    const r3 = await login('13800009999')
    const res = await request(app)
      .post('/api/elite/pay/order')
      .set(authHeader(r3.token))
      .send({ channel: 'bad-channel' })
    expect(res.body.code).not.toBe(0)
  })
})

describe('POST /api/elite/user/unlock-wechat — 扣钻解锁', () => {
  test('非精英被拒绝 (402)', async () => {
    const r3 = await login('13800012222')
    const res = await request(app)
      .post('/api/elite/user/unlock-wechat')
      .set(authHeader(r3.token))
      .send({ userId: uid2 })
      .expect(402)
    expect(res.body.code).toBe(402)
  })

  test('钻石不足返回 402', async () => {
    // 用户 2 已经是精英，先把钱包清空
    const { Wallet } = require('../src/models')
    const w = await Wallet.findOne({ where: { userId: uid2 } })
    if (w) await w.update({ diamond: 0 })
    else await Wallet.create({ userId: uid2, diamond: 0 })
    const res = await request(app)
      .post('/api/elite/user/unlock-wechat')
      .set(authHeader(token2))
      .send({ userId })
      .expect(402)
    expect(res.body.message).toMatch(/钻石不足/)
  })

  test('精英 + 有钻石 可解锁，钱包扣减 + 写入交易', async () => {
    const res = await request(app)
      .post('/api/elite/user/unlock-wechat')
      .set(authHeader(token))
      .send({ userId: uid2 })
      .expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.wechat).toBeDefined()
    expect(res.body.data.wechatMasked).toBeDefined()
    expect(typeof res.body.data.remainingDiamond).toBe('number')
    expect(res.body.data.unlockedCost).toBeGreaterThanOrEqual(1)
    // 验证钱包已扣减
    const { Wallet } = require('../src/models')
    const w = await Wallet.findOne({ where: { userId } })
    expect(w.diamond).toBe(res.body.data.remainingDiamond)
  })

  test('目标用户不存在返回 404', async () => {
    const res = await request(app)
      .post('/api/elite/user/unlock-wechat')
      .set(authHeader(token))
      .send({ userId: 999999 })
      .expect(404)
    expect(res.body.code).toBe(404)
  })
})

describe('POST /api/elite/user/contact — 联系 TA 额度', () => {
  test('非精英返回 402', async () => {
    const r3 = await login('13800013333')
    const res = await request(app)
      .post('/api/elite/user/contact')
      .set(authHeader(r3.token))
      .send({ userId: uid2 })
      .expect(402)
    expect(res.body.code).toBe(402)
  })

  test('精英可成功，返回 todayLeft/todayUsed', async () => {
    const res = await request(app)
      .post('/api/elite/user/contact')
      .set(authHeader(token))
      .send({ userId: uid2 })
      .expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.allowed).toBe(true)
    expect(typeof res.body.data.todayUsed).toBe('number')
    expect(typeof res.body.data.todayLeft).toBe('number')
    expect(res.body.data.todayLeft + res.body.data.todayUsed).toBe(50)
  })
})

describe('POST /api/elite/pay/notify/:channel — 回调幂等', () => {
  const crypto = require('crypto')
  const { getModuleConfig } = require('../src/utils/config')

  test('缺少 outTradeNo 返回 400', async () => {
    const res = await request(app)
      .post('/api/elite/pay/notify/wxpay')
      .send({})
      .expect(400)
    expect(res.body.code).toBe(400)
  })

  test('不存在订单返回 404', async () => {
    const out = 'NOTEXIST' + Date.now()
    const jwtCfg = await getModuleConfig('jwt')
    const sign = crypto.createHash('sha256').update(`${out}:wxpay:${jwtCfg.secret}`).digest('hex')
    await request(app)
      .post('/api/elite/pay/notify/wxpay')
      .send({ outTradeNo: out, sign })
      .expect(404)
  })

  test('重复回调幂等，不会重复写入交易/重置开通', async () => {
    // 先下一个 created 状态的订单（用 manual 渠道避免被 dev 自动开通）
    // 用新账号
    const r3 = await login('13800014444')
    const { EliteOrder } = require('../src/models')
    const order = await EliteOrder.create({
      userId: r3.userId, amount: 3000, channel: 'wxpay', outTradeNo: 'TESTNOTIFY' + Date.now(),
      status: 'created', plan: 'lifetime', snapshot: {}
    })
    const out = order.outTradeNo
    const jwtCfg = await getModuleConfig('jwt')
    const sign = crypto.createHash('sha256').update(`${out}:wxpay:${jwtCfg.secret}`).digest('hex')
    const r1 = await request(app)
      .post('/api/elite/pay/notify/wxpay')
      .send({ outTradeNo: out, transactionId: 'T1', sign })
      .expect(200)
    expect(r1.body.code).toBe(0)
    const r2 = await request(app)
      .post('/api/elite/pay/notify/wxpay')
      .send({ outTradeNo: out, transactionId: 'T2', sign })
      .expect(200)
    expect(r2.body.code).toBe(0)
    // 查 order 仍 paid
    const o2 = await EliteOrder.findOne({ where: { outTradeNo: out } })
    expect(o2.status).toBe('paid')
  })
})
