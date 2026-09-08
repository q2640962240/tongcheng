/**
 * 社交体系回归测试（第一批 A 组）
 *
 * 覆盖四块本轮修好的东西：
 *  - A2  GET /user/profile 与 /user/:id/public-profile 的 followingCount/followersCount/postsCount
 *  - A3  /user/:id/followers|following 的批量 join（isFollowed / mutual）、optionalAuth、真分页
 *  - A13 DELETE /posts/:id/comments/:commentId 的三分支权限矩阵 + commentCount 回退
 *  - 城市召回  /user/discover 短名与规范名双向可见；/posts 城市别名前缀命中
 *
 * 断言里刻意包含「反向对照」项（查广州不应带出深圳、查北京应为 0），
 * 只断言「召回变多」无法区分「修好了」和「筛选被放宽成全都返回」。
 */
const request = require('supertest')
const app = require('../src/app')
const { login, authHeader } = require('./helpers')
const { User, Post, Comment } = require('../src/models')

const ids = (res) => (res.body.data.list || []).map(x => Number(x.id))

describe('社交体系回归', () => {
  let A, B, C, D, E, F, G

  beforeAll(async () => {
    // A 关注 B、B 回关 A（互关）；C 关注 B（让 B 有 2 个粉丝，用来测真分页）
    A = await login('13800007001')
    B = await login('13800007002')
    C = await login('13800007003')
    D = await login('13800007004')   // 帖主，用于 A13 的「帖主可删他人评论」
    E = await login('13800007005')   // city 存短名 '深圳'
    F = await login('13800007006')   // city 存规范名 '深圳市'
    G = await login('13800007007')   // city 存 '广州'，作为反向对照

    await User.update({ city: '深圳' }, { where: { id: E.userId } })
    await User.update({ city: '深圳市' }, { where: { id: F.userId } })
    await User.update({ city: '广州' }, { where: { id: G.userId } })
  })

  describe('A2 社交统计三项计数', () => {
    it('新用户的三个计数都应为 0', async () => {
      const res = await request(app)
        .get('/api/user/profile').set(authHeader(D.token)).expect(200)
      expect(res.body.data.followingCount).toBe(0)
      expect(res.body.data.followersCount).toBe(0)
      expect(res.body.data.postsCount).toBe(0)
    })

    it('A 关注 B 后，A.followingCount 与 B.followersCount 各自 +1（不能串号）', async () => {
      await request(app)
        .post(`/api/user/${B.userId}/follow`).set(authHeader(A.token)).expect(200)

      const a = await request(app)
        .get('/api/user/profile').set(authHeader(A.token)).expect(200)
      expect(a.body.data.followingCount).toBe(1)
      expect(a.body.data.followersCount).toBe(0)

      const b = await request(app)
        .get('/api/user/profile').set(authHeader(B.token)).expect(200)
      expect(b.body.data.followersCount).toBe(1)
      expect(b.body.data.followingCount).toBe(0)
    })

    it('不能关注自己，且失败后计数不变', async () => {
      await request(app)
        .post(`/api/user/${A.userId}/follow`).set(authHeader(A.token)).expect(400)
      const a = await request(app)
        .get('/api/user/profile').set(authHeader(A.token)).expect(200)
      expect(a.body.data.followingCount).toBe(1)
    })

    it('public-profile 应返回计数，且单向关注时 mutual 为 false', async () => {
      const res = await request(app)
        .get(`/api/user/${B.userId}/public-profile`).set(authHeader(A.token)).expect(200)
      expect(res.body.data.followersCount).toBe(1)
      expect(res.body.data.isFollowing).toBe(true)
      expect(res.body.data.mutual).toBe(false)
    })

    it('B 回关 A 后 mutual 变 true', async () => {
      await request(app)
        .post(`/api/user/${A.userId}/follow`).set(authHeader(B.token)).expect(200)
      const res = await request(app)
        .get(`/api/user/${B.userId}/public-profile`).set(authHeader(A.token)).expect(200)
      expect(res.body.data.isFollowing).toBe(true)
      expect(res.body.data.mutual).toBe(true)
    })

    it('未登录访问 public-profile 仍可读，isFollowing/mutual 为 false', async () => {
      const res = await request(app)
        .get(`/api/user/${B.userId}/public-profile`).expect(200)
      expect(res.body.data.id).toBe(B.userId)
      expect(res.body.data.followersCount).toBe(1)
      expect(res.body.data.isFollowing).toBe(false)
      expect(res.body.data.mutual).toBe(false)
    })

    it('public-profile 不得泄漏 phone / password（显式挑字段，不依赖 attributes 白名单）', async () => {
      const res = await request(app)
        .get(`/api/user/${B.userId}/public-profile`).expect(200)
      expect(res.body.data).not.toHaveProperty('phone')
      expect(res.body.data).not.toHaveProperty('password')
      expect(res.body.data).not.toHaveProperty('passwordHash')
    })

    it('发动态后 postsCount +1，两个端点口径一致', async () => {
      await request(app)
        .post('/api/posts').set(authHeader(D.token))
        .send({ text: '第一条动态', city: '深圳' }).expect(200)

      const mine = await request(app)
        .get('/api/user/profile').set(authHeader(D.token)).expect(200)
      expect(mine.body.data.postsCount).toBe(1)

      const pub = await request(app)
        .get(`/api/user/${D.userId}/public-profile`).expect(200)
      expect(pub.body.data.postsCount).toBe(1)
    })
  })

  describe('A3 粉丝/关注列表', () => {
    it('C 关注 B，让 B 拥有 2 个粉丝', async () => {
      await request(app)
        .post(`/api/user/${B.userId}/follow`).set(authHeader(C.token)).expect(200)
      const res = await request(app)
        .get(`/api/user/${B.userId}/followers`).expect(200)
      expect(res.body.data.total).toBe(2)
    })

    it('未登录也能读粉丝列表（optionalAuth），isFollowed/mutual 恒 false', async () => {
      const res = await request(app)
        .get(`/api/user/${B.userId}/followers`).expect(200)
      expect(res.body.data.list).toHaveLength(2)
      for (const item of res.body.data.list) {
        expect(item.isFollowed).toBe(false)
        expect(item.mutual).toBe(false)
      }
    })

    it('B 看自己的粉丝列表：A 是互关(mutual=true)、C 是单向(isFollowed=false)', async () => {
      const res = await request(app)
        .get(`/api/user/${B.userId}/followers`).set(authHeader(B.token)).expect(200)
      const byId = Object.fromEntries(res.body.data.list.map(x => [Number(x.id), x]))
      expect(byId[A.userId].isFollowed).toBe(true)
      expect(byId[A.userId].mutual).toBe(true)
      expect(byId[C.userId].isFollowed).toBe(false)
      expect(byId[C.userId].mutual).toBe(false)
    })

    it('列表项不得泄漏 phone / password', async () => {
      const res = await request(app)
        .get(`/api/user/${B.userId}/followers`).set(authHeader(B.token)).expect(200)
      for (const item of res.body.data.list) {
        expect(item).not.toHaveProperty('phone')
        expect(item).not.toHaveProperty('password')
        expect(item).not.toHaveProperty('passwordHash')
        expect(item).toHaveProperty('nickname')
      }
    })

    it('关注列表是粉丝列表的镜像：B 的 following 只有 A', async () => {
      const res = await request(app)
        .get(`/api/user/${B.userId}/following`).set(authHeader(B.token)).expect(200)
      expect(res.body.data.total).toBe(1)
      expect(res.body.data.list[0].id).toBe(A.userId)
      expect(res.body.data.list[0].mutual).toBe(true)
    })

    it('真分页：pageSize=1 时两页无重复 id，且合计等于 total', async () => {
      const p1 = await request(app)
        .get(`/api/user/${B.userId}/followers?page=1&pageSize=1`).expect(200)
      const p2 = await request(app)
        .get(`/api/user/${B.userId}/followers?page=2&pageSize=1`).expect(200)

      expect(p1.body.data.total).toBe(2)
      expect(p2.body.data.total).toBe(2)
      expect(p1.body.data.list).toHaveLength(1)
      expect(p2.body.data.list).toHaveLength(1)

      const i1 = ids(p1)
      const i2 = ids(p2)
      expect(i1.filter(x => i2.includes(x))).toHaveLength(0)
      expect([...i1, ...i2].sort((a, b) => a - b)).toEqual([A.userId, C.userId].sort((a, b) => a - b))
    })

    it('超出末页返回空列表而不是报错', async () => {
      const res = await request(app)
        .get(`/api/user/${B.userId}/followers?page=9&pageSize=20`).expect(200)
      expect(res.body.data.list).toHaveLength(0)
      expect(res.body.data.total).toBe(2)
    })
  })

  describe('A13 删除评论的权限矩阵', () => {
    let post
    let commentByA
    let commentByC

    beforeAll(async () => {
      const created = await request(app)
        .post('/api/posts').set(authHeader(D.token))
        .send({ text: '用于评论权限测试的动态', city: '深圳' }).expect(200)
      post = created.body.data
    })

    it('未登录删评论应 401', async () => {
      const c = await request(app)
        .post(`/api/posts/${post.id}/comments`).set(authHeader(A.token))
        .send({ text: '临时评论' }).expect(200)
      await request(app)
        .delete(`/api/posts/${post.id}/comments/${c.body.data.id}`).expect(401)
      // 清理，避免影响后面的计数断言
      await request(app)
        .delete(`/api/posts/${post.id}/comments/${c.body.data.id}`).set(authHeader(A.token)).expect(200)
    })

    it('评论作者可以删自己的评论，且 commentCount 同步 -1', async () => {
      const c = await request(app)
        .post(`/api/posts/${post.id}/comments`).set(authHeader(A.token))
        .send({ text: 'A 的评论' }).expect(200)
      commentByA = c.body.data

      const after = await Post.findByPk(post.id)
      expect(after.commentCount).toBe(1)

      await request(app)
        .delete(`/api/posts/${post.id}/comments/${commentByA.id}`).set(authHeader(A.token)).expect(200)

      expect(await Comment.findByPk(commentByA.id)).toBeNull()
      expect((await Post.findByPk(post.id)).commentCount).toBe(0)
    })

    it('无关第三人删别人的评论应 403，且评论仍在', async () => {
      const c = await request(app)
        .post(`/api/posts/${post.id}/comments`).set(authHeader(A.token))
        .send({ text: 'A 的第二条评论' }).expect(200)
      commentByA = c.body.data

      await request(app)
        .delete(`/api/posts/${post.id}/comments/${commentByA.id}`).set(authHeader(C.token)).expect(403)

      expect(await Comment.findByPk(commentByA.id)).not.toBeNull()
    })

    it('帖主可以删他人的评论（Discourse 语义）', async () => {
      await request(app)
        .delete(`/api/posts/${post.id}/comments/${commentByA.id}`).set(authHeader(D.token)).expect(200)
      expect(await Comment.findByPk(commentByA.id)).toBeNull()
    })

    it('评论 id 与路径上的 postId 不匹配时应 404（防止跨帖删除）', async () => {
      const c = await request(app)
        .post(`/api/posts/${post.id}/comments`).set(authHeader(C.token))
        .send({ text: 'C 的评论' }).expect(200)
      commentByC = c.body.data

      await request(app)
        .delete(`/api/posts/${post.id + 9999}/comments/${commentByC.id}`).set(authHeader(C.token)).expect(404)
      expect(await Comment.findByPk(commentByC.id)).not.toBeNull()
    })

    it('删不存在的评论应 404', async () => {
      await request(app)
        .delete(`/api/posts/${post.id}/comments/999999`).set(authHeader(A.token)).expect(404)
    })

    it('commentCount 不会减成负数', async () => {
      await Post.update({ commentCount: 0 }, { where: { id: post.id } })
      await request(app)
        .delete(`/api/posts/${post.id}/comments/${commentByC.id}`).set(authHeader(C.token)).expect(200)
      expect((await Post.findByPk(post.id)).commentCount).toBe(0)
    })
  })

  describe('城市筛选的双向召回', () => {
    it('discover 查短名「深圳」应同时召回存成「深圳」和「深圳市」的用户', async () => {
      const res = await request(app)
        .get('/api/user/discover?city=' + encodeURIComponent('深圳')).expect(200)
      const found = ids(res)
      expect(found).toContain(E.userId)
      expect(found).toContain(F.userId)
      expect(found).not.toContain(G.userId)
    })

    it('discover 查规范名「深圳市」应同样召回两者（这是修复前恒返 0 的方向）', async () => {
      const res = await request(app)
        .get('/api/user/discover?city=' + encodeURIComponent('深圳市')).expect(200)
      const found = ids(res)
      expect(found).toContain(E.userId)
      expect(found).toContain(F.userId)
      expect(found).not.toContain(G.userId)
    })

    it('反向对照：discover 查「广州」只召回广州，没有放宽成全都返回', async () => {
      const res = await request(app)
        .get('/api/user/discover?city=' + encodeURIComponent('广州')).expect(200)
      const found = ids(res)
      expect(found).toContain(G.userId)
      expect(found).not.toContain(E.userId)
      expect(found).not.toContain(F.userId)
    })

    it('反向对照：discover 查「北京」应为 0（本地无北京用户）', async () => {
      const res = await request(app)
        .get('/api/user/discover?city=' + encodeURIComponent('北京')).expect(200)
      expect(res.body.data.total).toBe(0)
    })

    it('discover 不带 city 时应返回全部用户（对照组，证明上面的 0 不是筛选坏了）', async () => {
      const res = await request(app).get('/api/user/discover').expect(200)
      expect(res.body.data.total).toBeGreaterThan(0)
      const found = ids(res)
      expect(found).toContain(E.userId)
      expect(found).toContain(G.userId)
    })

    it('posts 查短名与规范名都应同时召回「深圳」和「深圳市」两种存量形态', async () => {
      // POST /api/posts 写入时会归一化成规范名，短名存量行只能直接改库模拟
      const shortRow = await request(app)
        .post('/api/posts').set(authHeader(D.token))
        .send({ text: '短名城市行的动态', city: '深圳' }).expect(200)
      const normRow = await request(app)
        .post('/api/posts').set(authHeader(D.token))
        .send({ text: '规范名城市行的动态', city: '深圳' }).expect(200)
      await Post.update({ city: '深圳' }, { where: { id: shortRow.body.data.id } })

      for (const q of ['深圳', '深圳市']) {
        const res = await request(app)
          .get('/api/posts?city=' + encodeURIComponent(q)).expect(200)
        const found = ids(res)
        expect(found).toContain(shortRow.body.data.id)
        expect(found).toContain(normRow.body.data.id)
      }
    })

    it('posts 查城市别名「蓉」应召回成都的动态（修复前 LIKE 前缀取原始词，恒返 0）', async () => {
      const created = await request(app)
        .post('/api/posts').set(authHeader(D.token))
        .send({ text: '在成都的动态', city: '成都市' }).expect(200)
      // 再补一条存成短名的行：POST 会归一化写入，短名存量只能直接改库模拟
      await Post.update({ city: '成都' }, { where: { id: created.body.data.id } })

      const byAlias = await request(app)
        .get('/api/posts?city=' + encodeURIComponent('蓉')).expect(200)
      expect(ids(byAlias)).toContain(created.body.data.id)

      const byFull = await request(app)
        .get('/api/posts?city=' + encodeURIComponent('成都')).expect(200)
      expect(ids(byFull)).toContain(created.body.data.id)
    })

    it('反向对照：posts 查「广州」不应召回深圳/成都的动态', async () => {
      const res = await request(app)
        .get('/api/posts?city=' + encodeURIComponent('广州')).expect(200)
      expect(res.body.data.total).toBe(0)
    })
  })
})
