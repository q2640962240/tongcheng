/**
 * 组局 (Group) / 组局报名 (GroupJoin) 模块 Jest 测试
 */
const { login, authHeader, getApp, request } = require('./helpers')
const app = getApp()

let token, userId, otherToken, otherUid

beforeAll(async () => {
  const r1 = await login('13800004444')
  token = r1.token; userId = r1.userId
  const r2 = await login('13800005555')
  otherToken = r2.token; otherUid = r2.userId
})

describe('POST /api/groups — 发起组局', () => {
  test('正常创建 + 发起人默认加入 approved', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set(authHeader(token))
      .send({
        title: '周六夜剧本杀组队',
        description: '5 人本，硬核推凶，求老玩家带',
        tags: ['剧本杀', '硬核'],
        category: 'game', city: '上海',
        expectMin: 3, expectMax: 5
      })
      .expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.userId).toBe(userId)
    expect(res.body.data.status).toBe('open')
    expect(res.body.data.joinCount).toBe(1)
  })

  test('标题太短被拒绝', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set(authHeader(token))
      .send({ title: 'a' })
    expect(res.body.code).not.toBe(0)
  })

  test('expectMax < expectMin 被拒绝', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set(authHeader(token))
      .send({ title: '标题', expectMin: 6, expectMax: 3 })
    expect(res.body.code).not.toBe(0)
  })

  test('标题敏感词返回 400', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set(authHeader(token))
      .send({ title: '约炮 毒品 线下见面' })
      .expect(400)
    expect(res.body.message).toMatch(/违规内容/)
  })
})

describe('GET /api/groups — 组局列表', () => {
  test('未登录可访问分页', async () => {
    const res = await request(app).get('/api/groups?pageSize=5').expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.list).toBeInstanceOf(Array)
    expect(typeof res.body.data.total).toBe('number')
  })

  test('列表含发起人信息 user', async () => {
    // 先用第一个人发一个再查
    await request(app)
      .post('/api/groups')
      .set(authHeader(token))
      .send({ title: '电影组队', category: 'movie', city: '北京', expectMin: 2, expectMax: 4 })
    const res = await request(app).get('/api/groups?pageSize=1')
    const first = res.body.data.list[0]
    expect(first.user).toBeDefined()
    expect(first.user.id).toBe(first.userId)
  })
})

describe('GET /api/groups/:id — 组局详情', () => {
  test('详情含 joins 数组 + 发起人', async () => {
    const created = await request(app)
      .post('/api/groups')
      .set(authHeader(token))
      .send({ title: '桌游聚会', category: 'boardgame', city: '深圳', expectMin: 2, expectMax: 6 })
    const id = created.body.data.id
    const res = await request(app).get(`/api/groups/${id}`).expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.joins).toBeInstanceOf(Array)
    expect(res.body.data.joins.length).toBeGreaterThanOrEqual(1)  // 发起人自己
    expect(res.body.data.user).toBeDefined()
  })

  test('不存在 id 返回 404', async () => {
    await request(app).get('/api/groups/999999').expect(404)
  })
})

describe('报名流程 — 加入 / 审批', () => {
  let groupId

  beforeAll(async () => {
    const created = await request(app)
      .post('/api/groups')
      .set(authHeader(token))
      .send({ title: '下午茶 Chat', category: 'chat', city: '成都', expectMin: 2, expectMax: 4 })
    groupId = created.body.data.id
  })

  test('另一位用户报名成功', async () => {
    const res = await request(app)
      .post(`/api/groups/${groupId}/join`)
      .set(authHeader(otherToken))
      .send({ remark: '请让我加入～' })
      .expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.status).toBe('pending')
  })

  test('不能重复报名', async () => {
    const res = await request(app)
      .post(`/api/groups/${groupId}/join`)
      .set(authHeader(otherToken))
    expect(res.body.code).not.toBe(0)
  })

  test('发起人可查看报名列表', async () => {
    const res = await request(app)
      .get(`/api/groups/${groupId}/joins`)
      .set(authHeader(token))
      .expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.length).toBeGreaterThanOrEqual(2)  // 发起人 + 申请人
    expect(res.body.data[0].user).toBeDefined()
  })

  test('非发起人查看报名列表返回 403', async () => {
    await request(app)
      .get(`/api/groups/${groupId}/joins`)
      .set(authHeader(otherToken))
      .expect(403)
  })

  test('发起人审批通过', async () => {
    const joins = await request(app)
      .get(`/api/groups/${groupId}/joins`)
      .set(authHeader(token))
    const pending = joins.body.data.find(j => j.userId === otherUid)
    expect(pending).toBeDefined()
    const res = await request(app)
      .put(`/api/groups/${groupId}/joins/${pending.id}`)
      .set(authHeader(token))
      .send({ status: 'approved' })
      .expect(200)
    expect(res.body.code).toBe(0)
  })

  test('发起人审批拒绝 status=rejected 且返还名额', async () => {
    // 先再报名一个第三人
    const third = await login('13800006666')
    const joinRes = await request(app)
      .post(`/api/groups/${groupId}/join`)
      .set(authHeader(third.token))
    const joinId = joinRes.body.data.id
    const before = (await request(app).get(`/api/groups/${groupId}`)).body.data.joinCount
    await request(app)
      .put(`/api/groups/${groupId}/joins/${joinId}`)
      .set(authHeader(token))
      .send({ status: 'rejected' })
      .expect(200)
    const after = (await request(app).get(`/api/groups/${groupId}`)).body.data.joinCount
    expect(after).toBeLessThanOrEqual(before - 1)
  })
})

describe('PUT / DELETE /api/groups/:id', () => {
  test('非发起人修改返回 403', async () => {
    const created = await request(app)
      .post('/api/groups')
      .set(authHeader(token))
      .send({ title: '修改测试', category: 'chat', expectMin: 2, expectMax: 5 })
    const id = created.body.data.id
    await request(app)
      .put(`/api/groups/${id}`)
      .set(authHeader(otherToken))
      .send({ title: '被篡改的标题' })
      .expect(403)
  })

  test('发起人可修改', async () => {
    const created = await request(app)
      .post('/api/groups')
      .set(authHeader(token))
      .send({ title: '原标题', category: 'chat', expectMin: 2, expectMax: 5 })
    const id = created.body.data.id
    const res = await request(app)
      .put(`/api/groups/${id}`)
      .set(authHeader(token))
      .send({ title: '修改后的标题', expectMax: 8 })
      .expect(200)
    expect(res.body.code).toBe(0)
    const detail = await request(app).get(`/api/groups/${id}`)
    expect(detail.body.data.title).toBe('修改后的标题')
    expect(detail.body.data.expectMax).toBe(8)
  })

  test('发起人可关闭组局', async () => {
    const created = await request(app)
      .post('/api/groups')
      .set(authHeader(token))
      .send({ title: '待关闭', category: 'chat', expectMin: 2, expectMax: 5 })
    const id = created.body.data.id
    const res = await request(app)
      .delete(`/api/groups/${id}`)
      .set(authHeader(token))
      .expect(200)
    expect(res.body.code).toBe(0)
    const detail = await request(app).get(`/api/groups/${id}`)
    expect(detail.body.data.status).toBe('closed')
    // 关闭后不能报名
    const joinRes = await request(app)
      .post(`/api/groups/${id}/join`)
      .set(authHeader(otherToken))
    expect(joinRes.body.code).not.toBe(0)
  })
})
