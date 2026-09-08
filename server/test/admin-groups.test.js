/**
 * 后台组局管理回归测试（第一批 A 组）
 *
 * 覆盖：
 *  - A6  列表 joinCount 不再被不存在的 memberCount 覆盖成恒 0
 *  - A7  keyword 搜索折进 SQL（title / 发起人昵称 / 纯数字 id 三维），total 是全库命中数而不是页内命中数
 *  - A5  DELETE 物理删除时顺手清掉孤儿 GroupJoin；PUT status='closed' 是可恢复的软关闭
 *
 * F4（评论列表 include 了不存在的 content 列）无法在此覆盖 —— JSON 测试驱动根本不解析 include，
 * 那类列名错只会在真 MySQL 上炸成 1054。必须在部署后人工点开后台「评论管理」页确认 200。
 */
const { login, authHeader, getApp, request } = require('./helpers')
const { signAdminToken } = require('../src/middleware/adminAuth')
const { Group, GroupJoin } = require('../src/models')
const app = getApp()

function adminToken(id = 1) { return { 'x-admin-token': signAdminToken(id) } }

describe('后台组局管理', () => {
  let owner, joiner
  const created = []

  const makeGroup = async (token, body) => {
    const res = await request(app)
      .post('/api/groups').set(authHeader(token))
      .send(body).expect(200)
    created.push(res.body.data.id)
    return res.body.data
  }

  beforeAll(async () => {
    const { Admin } = require('../src/models')
    try { await Admin.create({ id: 1, username: 'tester', name: '测试管理员' }) } catch (_) {}

    owner = await login('13800008001')
    joiner = await login('13800008002')
  })

  describe('A6 列表 joinCount', () => {
    it('应反映真实报名数（发起人 auto-approved 记 1），不是恒 0', async () => {
      const g = await makeGroup(owner.token, {
        title: '周末羽毛球双打缺一人', category: 'sport', city: '上海', expectMin: 2, expectMax: 4
      })
      expect(g.joinCount).toBe(1)

      const res = await request(app)
        .get('/api/admin/groups').set(adminToken()).expect(200)
      const row = res.body.data.list.find(x => Number(x.id) === Number(g.id))
      expect(row).toBeDefined()
      expect(row.joinCount).toBe(1)
      expect(row.userName).toBeTruthy()
    })

    it('第二人报名后列表里的 joinCount 应跟着变成 2', async () => {
      const g = created.length ? await Group.findByPk(created[0]) : null
      await request(app)
        .post(`/api/groups/${g.id}/join`).set(authHeader(joiner.token)).send({}).expect(200)

      const res = await request(app)
        .get('/api/admin/groups').set(adminToken()).expect(200)
      const row = res.body.data.list.find(x => Number(x.id) === Number(g.id))
      expect(row.joinCount).toBe(2)
    })
  })

  describe('A7 keyword 搜索', () => {
    beforeAll(async () => {
      // 三条同前缀标题，用来验证「total 是全库命中数」而不是「页内命中数」
      await makeGroup(owner.token, { title: '剧本杀硬核本周五夜场', category: 'game', city: '上海', expectMin: 4, expectMax: 6 })
      await makeGroup(owner.token, { title: '剧本杀新手欢乐本', category: 'game', city: '上海', expectMin: 4, expectMax: 6 })
      await makeGroup(joiner.token, { title: '剧本杀拼车欢乐场', category: 'game', city: '上海', expectMin: 4, expectMax: 6 })
    })

    it('按标题搜索应命中，且 total 等于全库命中数（分页不再吃掉结果）', async () => {
      const all = await request(app)
        .get('/api/admin/groups?kw=' + encodeURIComponent('剧本杀')).set(adminToken()).expect(200)
      expect(all.body.data.total).toBe(3)
      expect(all.body.data.list).toHaveLength(3)

      // 关键断言：pageSize=2 时 total 仍应是 3。
      // 修复前是「先分页再页内 filter」，total 会变成 list.length，最多只有 2。
      const paged = await request(app)
        .get('/api/admin/groups?kw=' + encodeURIComponent('剧本杀') + '&pageSize=2').set(adminToken()).expect(200)
      expect(paged.body.data.list).toHaveLength(2)
      expect(paged.body.data.total).toBe(3)
    })

    it('按发起人昵称搜索仍能命中（不能被砍掉）', async () => {
      const nick = (await request(app)
        .get('/api/user/profile').set(authHeader(joiner.token)).expect(200)).body.data.nickname
      const res = await request(app)
        .get('/api/admin/groups?kw=' + encodeURIComponent(nick)).set(adminToken()).expect(200)
      expect(res.body.data.total).toBeGreaterThan(0)
      for (const row of res.body.data.list) expect(row.userName).toBe(nick)
    })

    it('纯数字 keyword 应按组局 id 命中', async () => {
      const target = created[0]
      const res = await request(app)
        .get(`/api/admin/groups?kw=${target}`).set(adminToken()).expect(200)
      expect(res.body.data.list.map(x => Number(x.id))).toContain(Number(target))
    })

    it('无匹配的 keyword 应返回 total 0', async () => {
      const res = await request(app)
        .get('/api/admin/groups?kw=' + encodeURIComponent('完全不存在的关键词zzz')).set(adminToken()).expect(200)
      expect(res.body.data.total).toBe(0)
      expect(res.body.data.list).toHaveLength(0)
    })

    it('status 筛选应与 keyword 叠加而不是互相覆盖', async () => {
      const res = await request(app)
        .get('/api/admin/groups?status=open&kw=' + encodeURIComponent('剧本杀')).set(adminToken()).expect(200)
      expect(res.body.data.total).toBe(3)
      for (const row of res.body.data.list) expect(row.status).toBe('open')
    })
  })

  describe('A5 关闭与删除的语义分离', () => {
    it('PUT status=closed 是可恢复的软关闭：行仍在，且能用状态筛选找回', async () => {
      const g = await makeGroup(owner.token, {
        title: '待关闭的桌游局', category: 'game', city: '上海', expectMin: 2, expectMax: 4
      })
      await request(app)
        .put(`/api/admin/groups/${g.id}`).set(adminToken()).send({ status: 'closed' }).expect(200)

      expect(await Group.findByPk(g.id)).not.toBeNull()

      const res = await request(app)
        .get('/api/admin/groups?status=closed').set(adminToken()).expect(200)
      expect(res.body.data.list.map(x => Number(x.id))).toContain(Number(g.id))
    })

    it('非法 status 应被拒绝', async () => {
      const g = await Group.findByPk(created[0])
      await request(app)
        .put(`/api/admin/groups/${g.id}`).set(adminToken()).send({ status: 'nonsense' }).expect(400)
    })

    it('DELETE 物理删除组局，并清掉孤儿 GroupJoin', async () => {
      const g = await makeGroup(owner.token, {
        title: '待彻底删除的局', category: 'game', city: '上海', expectMin: 2, expectMax: 4
      })
      await request(app)
        .post(`/api/groups/${g.id}/join`).set(authHeader(joiner.token)).send({}).expect(200)
      expect((await GroupJoin.findAll({ where: { groupId: g.id } })).length).toBe(2)

      const res = await request(app)
        .delete(`/api/admin/groups/${g.id}`).set(adminToken()).expect(200)
      expect(res.body.data.joinsRemoved).toBe(2)

      expect(await Group.findByPk(g.id)).toBeNull()
      expect((await GroupJoin.findAll({ where: { groupId: g.id } })).length).toBe(0)
    })

    it('删不存在的组局应 404', async () => {
      await request(app)
        .delete('/api/admin/groups/999999').set(adminToken()).expect(404)
    })
  })
})
