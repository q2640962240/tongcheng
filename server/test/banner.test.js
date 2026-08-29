/**
 * Banner 模块 Jest 测试
 * 覆盖：公开列表 / 管理端列表 / 管理员增删改
 */
const { authHeader, getApp, request } = require('./helpers')
const app = getApp()

/** 管理员 token 伪造（与 Banner 路由 adminAuth 规则一致：admin_<id>） */
function adminToken(id = 1) { return { 'x-admin-token': `admin_${id}` } }

beforeAll(async () => {
  // 确保至少有一个 admin 记录存在
  const { Admin } = require('../src/models')
  try { await Admin.create({ id: 1, username: 'tester', name: '测试管理员' }) } catch (_) {}
  try { await Admin.create({ id: 2, username: 'tester2', name: '测试管理员 2' }) } catch (_) {}
})

describe('GET /api/banners — 公开列表', () => {
  test('未登录可访问分页，仅返回 enabled=true', async () => {
    const res = await request(app).get('/api/banners?pageSize=10').expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.list).toBeInstanceOf(Array)
    for (const b of res.body.data.list) {
      expect(b.enabled).toBeUndefined()  // 对外不暴露 enabled
      expect(b.id).toBeDefined()
    }
  })

  test('按 position 过滤', async () => {
    // 先造一条 home_top
    await request(app).post('/api/banners').set(adminToken(1)).send({
      title: '活动 Banner', image: '/uploads/a.png', link: '/x', position: 'home_top'
    })
    const res = await request(app).get('/api/banners?position=home_top&pageSize=20')
    expect(res.body.data.list.every(b => b.position === 'home_top')).toBe(true)
  })

  test('排序：sort 升序 + id 降序', async () => {
    // 造几条不同 sort 的
    await request(app).post('/api/banners').set(adminToken(1)).send({
      title: 'SORT_3', image: '/1.png', position: 'home_top', sort: 3
    })
    await request(app).post('/api/banners').set(adminToken(1)).send({
      title: 'SORT_1', image: '/2.png', position: 'home_top', sort: 1
    })
    const res = await request(app).get('/api/banners?position=home_top&pageSize=20')
    const list = res.body.data.list
    // sort 应该升序（小在前）
    let pass = true
    for (let i = 1; i < list.length; i++) {
      if (list[i - 1].sort > list[i].sort) pass = false
    }
    expect(pass).toBe(true)
  })
})

describe('POST /api/banners — 管理员新增', () => {
  test('无 admin token 返回 401', async () => {
    await request(app)
      .post('/api/banners')
      .send({ title: 'x', image: '/y.png' })
      .expect(401)
  })

  test('有 token 且有 image 可创建成功', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set(adminToken(1))
      .send({ title: '新增 Banner', image: '/uploads/new.png', link: '/l', position: 'home_top', sort: 10 })
      .expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.id).toBeDefined()
  })

  test('缺少 image 被拒绝', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set(adminToken(1))
      .send({ title: '没图的 banner' })
    expect(res.body.code).not.toBe(0)
  })
})

describe('PUT /api/banners/:id — 修改', () => {
  test('管理员可修改字段', async () => {
    const created = await request(app)
      .post('/api/banners')
      .set(adminToken(1))
      .send({ title: '旧标题', image: '/old.png' })
    const id = created.body.data.id
    await request(app)
      .put(`/api/banners/${id}`)
      .set(adminToken(1))
      .send({ title: '新标题', sort: 99, enabled: false })
      .expect(200)
    const list = await request(app)
      .get('/api/banners/admin/list')
      .set(adminToken(1))
    const found = list.body.data.list.find(b => b.id === id)
    expect(found.title).toBe('新标题')
    expect(found.sort).toBe(99)
    expect(found.enabled).toBe(false)
  })

  test('不存在 id 返回 404', async () => {
    await request(app).put('/api/banners/9999999').set(adminToken(1)).send({ title: 'x' }).expect(404)
  })

  test('未授权修改返回 401', async () => {
    await request(app).put('/api/banners/1').send({ title: 'x' }).expect(401)
  })
})

describe('DELETE /api/banners/:id — 删除', () => {
  test('管理员可删除，删除后不再出现在列表', async () => {
    const created = await request(app)
      .post('/api/banners')
      .set(adminToken(1))
      .send({ title: '待删除', image: '/del.png' })
    const id = created.body.data.id
    await request(app).delete(`/api/banners/${id}`).set(adminToken(1)).expect(200)
    const list = await request(app).get('/api/banners/admin/list').set(adminToken(1))
    expect(list.body.data.list.find(b => b.id === id)).toBeUndefined()
  })
})

describe('GET /api/banners/admin/list — 管理端列表', () => {
  test('未授权返回 401', async () => {
    await request(app).get('/api/banners/admin/list').expect(401)
  })

  test('可按 enabled 过滤', async () => {
    // 确保至少一个 false 的
    const c = await request(app)
      .post('/api/banners')
      .set(adminToken(1))
      .send({ title: 'disabled', image: '/d.png', enabled: false })
    const disabledOnly = await request(app)
      .get('/api/banners/admin/list?enabled=false')
      .set(adminToken(1))
      .expect(200)
    for (const b of disabledOnly.body.data.list) expect(b.enabled).toBe(false)
  })
})
