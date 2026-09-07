/**
 * 管理 API 鉴权回归测试
 *
 * 背景（AGENTS.md 坑点 32）：管理端鉴权原先有四份互不相同的弱副本，规则是
 * 「`x-admin-token` 以 `admin_` 开头就放行」，既不验签名也不查库。公网实测
 * `admin_1` 与根本不存在的 `admin_99999` 都能拿到 200，可读真实手机号、
 * 明文云 AK/SK、IM secretKey，可写 34 个管理端点。
 *
 * 现已收口成 `middleware/adminAuth.js` 的签名 JWT。本文件锁住这次修复：
 * 任何一处退化回弱校验，这里都会红。
 */
const jwt = require('jsonwebtoken')
const { getApp, request } = require('./helpers')
const config = require('../src/config')
const { signAdminToken } = require('../src/middleware/adminAuth')

const app = getApp()

/**
 * 与 adminAuth.js 的非生产回退保持一致：测试环境（setup.js）不设 ADMIN_JWT_SECRET，
 * 中间件会派生出 `${config.jwt.secret}::baiye-admin`。
 * 这里复刻它是为了签一个「签名合法但 payload 缺 type」的令牌，用来单独验证
 * `payload.type === 'admin'` 这条纵深防御断言 —— 不拿到密钥就无法构造这种令牌。
 * 若将来改了派生规则，下面那条用例会失败并直接指出原因，属于刻意耦合。
 */
const ADMIN_SECRET_IN_TEST = process.env.ADMIN_JWT_SECRET || `${config.jwt.secret}::baiye-admin`

/** 挑两个便宜的受保护端点：一个在 banners（双挂载点），一个是曾经完全裸奔的 im/diag */
const GUARDED = ['/api/banners/admin/list', '/api/im/diag']

beforeAll(async () => {
  // adminAuth 在驱动支持 findByPk 时会校验管理员是否仍存在，先保证行在
  const { Admin } = require('../src/models')
  try { await Admin.create({ id: 1, username: 'authtester', name: '鉴权测试管理员' }) } catch (_) {}
})

describe('signAdminToken — 令牌形态', () => {
  test('产出三段式 JWT，不再是 admin_ 前缀，payload 含 type/id/exp', () => {
    const token = signAdminToken(1)
    expect(String(token).split('.')).toHaveLength(3)
    expect(token.startsWith('admin_')).toBe(false)
    const payload = jwt.decode(token)
    expect(payload.type).toBe('admin')
    expect(payload.id).toBe(1)
    expect(payload.exp).toBeDefined()
  })
})

describe('旧伪造令牌必须被拒绝（修复前这些全返回 200）', () => {
  const forged = ['admin_1', 'admin_99999', 'admin_', 'anything', '']
  for (const t of forged) {
    for (const path of GUARDED) {
      test(`x-admin-token: ${JSON.stringify(t)} 打 ${path} → 401`, async () => {
        const res = await request(app).get(path).set('x-admin-token', t)
        expect(res.status).toBe(401)
        // 必须是应用自己的 JSON 信封，而不是网关/框架的 HTML 错误页
        expect(res.body.code).not.toBe(0)
        expect(typeof res.body.message).toBe('string')
      })
    }
  }

  test('完全不带 header → 401', async () => {
    for (const path of GUARDED) {
      const res = await request(app).get(path)
      expect(res.status).toBe(401)
    }
  })

  test('公开挂载点上的写端点 POST /api/banners 同样拒绝伪造令牌', async () => {
    // banners.js 被同时挂在 /api/banners（公开）与 /api/admin/banners 上，
    // 且 adminAuth 是挂在路由级而非 router.use —— 只测 admin 挂载点会漏掉这一条
    const res = await request(app)
      .post('/api/banners')
      .set('x-admin-token', 'admin_1')
      .send({ title: 'x', image: '/x.png' })
    expect(res.status).toBe(401)
  })
})

describe('密钥隔离与纵深防御', () => {
  test('用 JWT_SECRET 签的用户令牌不能当管理员令牌（两把密钥独立）', async () => {
    const userToken = jwt.sign({ id: 1 }, config.jwt.secret, { expiresIn: '1h' })
    for (const path of GUARDED) {
      const res = await request(app).get(path).set('x-admin-token', userToken)
      expect(res.status).toBe(401)
    }
  })

  test('签名合法但 payload 缺 type:admin → 401', async () => {
    // 这条保证：即使将来两个 secret 被误配成同一个值，用户令牌仍进不了管理端
    const noType = jwt.sign({ id: 1 }, ADMIN_SECRET_IN_TEST, { expiresIn: '1h' })
    expect(jwt.verify(noType, ADMIN_SECRET_IN_TEST)).toBeTruthy()  // 签名确实合法
    for (const path of GUARDED) {
      const res = await request(app).get(path).set('x-admin-token', noType)
      expect(res.status).toBe(401)
    }
  })

  test('签名合法但 type 是别的值 → 401', async () => {
    const wrongType = jwt.sign({ id: 1, type: 'refresh' }, ADMIN_SECRET_IN_TEST, { expiresIn: '1h' })
    const res = await request(app).get(GUARDED[0]).set('x-admin-token', wrongType)
    expect(res.status).toBe(401)
  })
})

describe('真令牌必须仍然可用（别把功能一起锁死）', () => {
  test('signAdminToken 签出的令牌能访问受保护端点', async () => {
    const token = signAdminToken(1)
    for (const path of GUARDED) {
      const res = await request(app).get(path).set('x-admin-token', token)
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
    }
  })

  test('/api/im/diag 只回长度不回 secretKey 明文', async () => {
    const res = await request(app).get('/api/im/diag').set('x-admin-token', signAdminToken(1))
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(typeof d.secretKeyLen).toBe('number')
    expect(d).not.toHaveProperty('secretKey')
    expect(JSON.stringify(d)).not.toMatch(/secretKey"\s*:\s*"[A-Za-z0-9]{20,}/)
  })
})
