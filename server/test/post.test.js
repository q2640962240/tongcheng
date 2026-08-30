/**
 * 动态/评论 模块 Jest 测试
 * 覆盖：发布动态（合法/敏感词拦截）、列表、详情、点赞 toggle、评论（敏感词拦截）、删除
 */
const { login, authHeader, getApp, request } = require('./helpers')
const app = getApp()

let token, userId

beforeAll(async () => {
  const res = await login('13800002222')
  token = res.token
  userId = res.userId
})

describe('POST /api/posts — 发布动态', () => {
  test('正常动态可发布成功', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set(authHeader(token))
      .send({ text: '白夜一起打王者！坐标上海，求带飞～', images: ['/a.jpg'], city: '上海', category: 'dynamic' })
      .expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.userId).toBe(userId)
    // 城市经过 normalizeCityName 归一化：'上海' 可能变成 '上海市'，前缀匹配即可
    expect(res.body.data.city && String(res.body.data.city).startsWith('上海')).toBe(true)
  })

  test('空内容被拒绝', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set(authHeader(token))
      .send({ text: '   ', images: [] })
    expect(res.body.code).not.toBe(0)
  })

  test('超 500 字被拒绝', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set(authHeader(token))
      .send({ text: 'a'.repeat(501) })
    expect(res.body.code).not.toBe(0)
  })

  test('敏感词内容返回 400 被拦截', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set(authHeader(token))
      .send({ text: '暴力毒品 法轮功 约炮 傻逼' })
      .expect(400)
    expect(res.body.hit).toBeDefined()
    expect(res.body.message).toMatch(/违规内容/)
  })

  test('图片超过 9 张被拒绝', async () => {
    const images = Array.from({ length: 10 }, (_, i) => `/img/${i}.jpg`)
    const res = await request(app)
      .post('/api/posts')
      .set(authHeader(token))
      .send({ text: '测试', images })
    expect(res.body.code).not.toBe(0)
  })
})

describe('GET /api/posts — 动态列表', () => {
  test('未登录可访问分页列表', async () => {
    const res = await request(app)
      .get('/api/posts?page=1&pageSize=5')
      .expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.list).toBeInstanceOf(Array)
    expect(res.body.data.page).toBe(1)
    expect(res.body.data.pageSize).toBe(5)
    expect(typeof res.body.data.total).toBe('number')
  })

  test('按城市过滤', async () => {
    // 再发一条北京的
    await request(app)
      .post('/api/posts')
      .set(authHeader(token))
      .send({ text: '北京玩家', city: '北京' })
    const res = await request(app)
      .get('/api/posts?city=北京&pageSize=20')
      .expect(200)
    // 城市经过 normalizeCityName 归一化：'北京' → '北京市'；另外空城市全国可展示
    expect(res.body.data.list.every(p => !p.city || String(p.city).startsWith('北京'))).toBe(true)
  })

  test('返回列表含用户信息且不含 likes 明细', async () => {
    const res = await request(app).get('/api/posts?pageSize=1')
    const first = res.body.data.list[0]
    if (first) {
      expect(first.user).toBeDefined()
      expect(first.likes).toBeUndefined()
      expect(typeof first.liked).toBe('boolean')
    }
  })
})

describe('GET /api/posts/:id — 动态详情', () => {
  test('有效 id 返回详情 + user', async () => {
    const list = await request(app).get('/api/posts?pageSize=1')
    const id = list.body.data.list[0].id
    const res = await request(app).get(`/api/posts/${id}`).expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.user).toBeDefined()
  })

  test('无效 id 返回 404', async () => {
    const res = await request(app).get('/api/posts/99999999')
    expect(res.body.code).toBe(404)
  })
})

describe('POST /api/posts/:id/like — 点赞', () => {
  test('点赞 toggle 正常切换', async () => {
    const list = await request(app).get('/api/posts?pageSize=1')
    const id = list.body.data.list[0].id
    const r1 = await request(app).post(`/api/posts/${id}/like`).set(authHeader(token)).expect(200)
    expect(r1.body.data.liked).toBe(true)
    const r2 = await request(app).post(`/api/posts/${id}/like`).set(authHeader(token)).expect(200)
    expect(r2.body.data.liked).toBe(false)
  })
})

describe('评论接口', () => {
  test('正常评论创建成功', async () => {
    const list = await request(app).get('/api/posts?pageSize=1')
    const id = list.body.data.list[0].id
    const res = await request(app)
      .post(`/api/posts/${id}/comments`)
      .set(authHeader(token))
      .send({ text: '楼主说得对！我也想去' })
      .expect(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.user).toBeDefined()
  })

  test('评论敏感词返回 400', async () => {
    const list = await request(app).get('/api/posts?pageSize=1')
    const id = list.body.data.list[0].id
    const res = await request(app)
      .post(`/api/posts/${id}/comments`)
      .set(authHeader(token))
      .send({ text: '傻逼智障内容' })
      .expect(400)
    expect(res.body.message).toMatch(/违规内容/)
  })

  test('空评论被拒绝', async () => {
    const list = await request(app).get('/api/posts?pageSize=1')
    const id = list.body.data.list[0].id
    const res = await request(app)
      .post(`/api/posts/${id}/comments`)
      .set(authHeader(token))
      .send({ text: '   ' })
    expect(res.body.code).not.toBe(0)
  })
})

describe('DELETE /api/posts/:id — 删除动态', () => {
  test('作者可删除', async () => {
    const created = await request(app)
      .post('/api/posts')
      .set(authHeader(token))
      .send({ text: '待删除的动态' })
    const id = created.body.data.id
    const res = await request(app)
      .delete(`/api/posts/${id}`)
      .set(authHeader(token))
      .expect(200)
    expect(res.body.code).toBe(0)
  })

  test('非作者 / 非管理员返回 403', async () => {
    // 创建一个属于别人的动态（用另一个账号）
    const other = await login('13800003333')
    const created = await request(app)
      .post('/api/posts')
      .set(authHeader(other.token))
      .send({ text: '别人的动态' })
    const id = created.body.data.id
    const res = await request(app)
      .delete(`/api/posts/${id}`)
      .set(authHeader(token))
      .expect(403)
    expect(res.body.code).toBe(403)
  })
})
