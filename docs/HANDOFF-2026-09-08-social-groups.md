# 交接说明 —— 组局体系 + 关注/粉丝/动态体系完善（2026-09-08）

> 给下一位同事。读完这一份就能接手，不需要翻聊天记录。
> **权威规格书**：`C:\Users\chen\.qoder-cn\plans\soft-trail-snipe.md`（用户已批准，不要偏离范围）。
> 本文档负责三件事：① 现在代码处于什么状态；② 已经做完了什么、为什么这么做；③ 剩下怎么做、有哪些坑。

---

## 0. 一句话现状

**第一批（A 组）的服务端部分已全部改完，154 个测试全绿，但代码尚未 commit、尚未部署。**
前端一行没动。第二批（B 组）一行没动。

---

## 1. 你接手时的第一件事

```bash
# 1. 确认工作树状态与本文档一致（应该是 4 个 M + 2 个 ??）
git status --short

# 2. 先跑测试，确认你拿到的是绿的起点
cd server && npx cross-env NODE_ENV=test npx jest --runInBand --forceExit
# 期望：Test Suites: 15 passed, 15 total / Tests: 154 passed, 154 total（约 14s）

# 3. 绿了再 commit（上一位没有提交，是刻意的：commit 需要用户明确要求）
```

工作树改动清单（**全部未提交**）：

| 文件 | 状态 | 内容 |
|---|---|---|
| `server/src/routes/user.js` | M | A2/A2b/A3 + 计划外的城市召回修复 |
| `server/src/routes/posts.js` | M | A13 删评论端点 + 城市别名 prefix 修复 |
| `server/src/routes/admin.js` | M | A5/A6/A7/F4 + A13 admin 侧计数 |
| `server/src/store/index.js` | M | **测试基建修复，见 §4，最重要的一条** |
| `server/test/social.test.js` | 新增 | 30 项回归（A2/A3/A13/城市双向召回） |
| `server/test/admin-groups.test.js` | 新增 | 11 项回归（A5/A6/A7） |

基线 HEAD：`a1c1e01`（坑点 37 的 tryRefresh 死锁修复）。

---

## 2. 用户的原始诉求与已批准的范围（不要偏离）

> 「组局体系，关注粉丝动态体系，你可以在 GitHub 上面寻找成熟的开源代码，
> 不用担心授权问题，不会投入商用，来把这个项目更加完善。」

勘察结论与用户的预期不同：**这两块不缺架构，缺的是接线和真 bug。** 数据模型层设计正确
（`Follow`/`Comment`/`GroupJoin` 都是正规关联表、索引齐全），服务端端点大部分也已实现——
坏在前端没接线、字段名读错、返回体缺字段。共定位 16 项缺陷（A 组），其中 4 项是「整页/整功能废掉」级。

用户通过 4 次选择确定的范围（**都已批准，别再问一遍**）：

| 项 | 用户的决定 |
|---|---|
| 开源怎么用 | **只借鉴设计与算法，代码全部自研，零新增 npm 依赖** |
| 做多少 | **A 组 16 项 bug + B 组核心四项** |
| DDL | 允许新增表/列，但**每条 DDL 执行前必须单独贴给用户确认**；本方案只需 1 条（`posts.tags`），B 组 0 条 |
| 部署节奏 | **分两批**：先 A 组上线并生产实测，确认无回归再做 B 组 |

借鉴到的设计（都已核实 license 与 star，但**技术栈不匹配所以不移植代码**）：

- **关注流 = fan-in on read**（查询时 `WHERE userId IN (关注列表)`）。本项目量级的正确解，
  不需要 Misskey 那套预写 timeline 表。
- **组局过期 = 惰性判定 + 条件 UPDATE 抢占落库**。零 cron、幂等、并发安全。
- **评论删除权限 = Discourse 语义**（评论作者或帖主可删）。
- **审批队列 = NodeBB flag queue 的三态心智**（pending/approved/rejected 分段 + 角标）。

---

## 3. 已完成的工作（G1 = A 组服务端）

### 3.1 `server/src/routes/user.js`

**A2/A2b —— 社交统计恒 0**
新增模块内私有函数 `socialCounts(userId)`，`GET /profile` 与 `GET /:id/public-profile` **两端点共用**
（只修 public-profile 会漏掉「我的」页三格）。三个 count 并发，用 `count` 不用 `include`：

```js
async function socialCounts(userId) {
  const [followingCount, followersCount, postsCount] = await Promise.all([
    Follow.count({ where: { followerId: userId } }),
    Follow.count({ where: { followingId: userId } }),
    Post.count({ where: { userId, auditStatus: { [Op.ne]: 'blocked' } } })
  ])
  return { followingCount, followersCount, postsCount }
}
```

**A3 —— followers/following 的 N+1 + 缺 isFollowed/mutual**
原实现是 `for (const f of rows) { await User.findByPk(...) }` 串行 N+1，且返回项没有
「查看者是否已关注此人」和「是否互关」。改成 `fetchFollowList(targetId, direction, viewerId, page, pageSize)`：
**查询次数固定 4 次，与页大小无关**（1 次 findAndCountAll + 1 次批量 User + 2 次关注关系集合）。
中间件从 `auth` 改为 `optionalAuth`（未登录时两个标记恒 false，列表仍可读）。
路由：`GET /:id/followers` 与 `GET /:id/following`。

两处偏离计划的加固（都有理由，不要改回去）：
- 排序用 `[['id','DESC']]` 而不是计划里的 `createdAt`——同毫秒批量关注会让 createdAt 相同，
  排序不确定会导致翻页出现重复行。
- `public-profile` 改成**显式挑字段**而不是 `user.toJSON()`——见 §4 的 `attributes` 陷阱。

**计划外查出的真 bug —— discover 的城市过滤是精确等值**
`where.city = cityNorm`（纯值精确匹配）导致存量短名行（`'深圳'`）在两个查询方向都被 SQL 排除，
而内存兜底 `matchCity` 永远收不到没进 SQL 的行。这正是坑点 27 的同型 bug，但**位置不在计划说的
`posts.js`**（见 §5 的「F6 是误报」）。修法照抄 `groups.js:20-40` 的对称展开 + `Op.in`。

### 3.2 `server/src/routes/posts.js`

**A13 —— 用户侧删评论端点（新增）**
```js
router.delete('/:id/comments/:commentId', auth, async (req, res, next) => { ... })
```
Discourse 语义：评论作者或帖主可删，其余 403；`postId` 不匹配 404（防跨帖删）；
删成功后 `commentCount` 减 1。

⚠️ **计数用读改写 `Math.max(0, (x||0) - 1)`，不是计划里的 `Post.decrement`** ——
JSON 测试驱动只模拟了 `increment`（三种形态），**没有 `decrement`**，用它会直接炸测试。
顺带消掉了计划风险项 R8（计数减成负数）。

**城市别名 prefix 修复（计划外）**
`city LIKE '${prefix}%'` 的 prefix 原先取 `cityRaw`，导致别名（`'蓉'`→成都市）搜索恒返 0。
改成 `(cityNorm || cityRaw)`，一个 token 的修复。

### 3.3 `server/src/routes/admin.js`

| 项 | 改动 |
|---|---|
| **A5** | `DELETE /groups/:id` 保留物理删除语义（管理员确实需要清脏数据），但补 `GroupJoin.destroy({ where: { groupId } })` 清孤儿报名行，并把删除条数回给前端 |
| **A6** | 删掉 `const joins = (g.memberCount !== undefined) ? ... : 0` 与 `joinCount: joins` 覆盖行——`memberCount` 字段根本不存在（恒 0），且写在 `...g.toJSON()` 之后会把真实值覆盖掉 |
| **A7** | kw 折进 `where[Op.or]`，删掉「分页后内存过滤」与 `kw ? list.length : count` 的伪 total |
| **F4** | `include: [{ model: Post, as:'post', attributes:['id','content'] }]` → `['id','text']`。`Post.js:9` 的字段是 `text`，MySQL 会报 Unknown column → **生产 500** |
| **A13 admin 侧** | `DELETE /comments/:id` 补计数减 1（destroy 前先取 `postId`） |

⚠️ **A7 的实现偏离了计划，是刻意的**：计划说「只搜 title/city/category 并把前端 placeholder
改成『搜索标题/城市/类型』」，但那会**砍掉既有功能**——现状支持按发起人昵称搜。改成用一次
有界查询（`limit: 200`）把昵称命中的 userId 折进 `Op.or`，纯数字 kw 额外匹配组局 id。
结果：**三维搜索保住、total 准确、不引入 JOIN、前端 placeholder 不用改**。

### 3.4 新增的 41 个回归测试

- **`server/test/social.test.js`（30 项，全绿）** —— 7 个测试用户 A–G（`13800007001..7007`）。
  四个 describe：A2 社交统计三项计数 / A3 粉丝关注列表 / A13 删评论权限矩阵 / 城市筛选双向召回。
  值得复用的断言设计：
  - 计数不串号（A 关注 B 后，`followingCount` 只在 A 侧 +1）
  - `mutual` 单向 false、回关后 true
  - 未登录可读且 `isFollowing`/`mutual` 为 false
  - **`public-profile` 与 followers 列表都断言 `not.toHaveProperty('phone'/'password'/'passwordHash')`**
  - `pageSize=1` 两页无重复 id，且并集等于完整粉丝集合
  - A13 完整权限矩阵：401 / 作者可删且计数 -1 / 第三人 403 且评论仍在 / 帖主可删 /
    postId 不匹配 404 / 删不存在的 404 / 计数不减成负数
  - **城市召回带三个反向对照**（查广州不带出深圳、查北京为 0、不带 city 返回全部）。
    文件头写了为什么：「只断言『召回变多』无法区分『修好了』和『筛选被放宽成全都返回』。」

- **`server/test/admin-groups.test.js`（11 项，全绿）** —— `adminToken(id)` 用
  `signAdminToken(id)`（照抄 `banner.test.js`，**不要伪造 `admin_<id>` 字面量**，那是坑点 32 修掉的漏洞）。
  覆盖 A6 的 joinCount 真实值、A7 的三维搜索与 status 叠加、A5 的软关闭可找回 + 物理删除清孤儿。

**★ 变异测试已做过 ★**：把 `user.js` 的城市修复临时退回去，对应的 3 条 discover 用例如期变红，
证明断言有牙齿，然后还原。**这是本项目的纪律**：新写的断言必须先证明它会变红，
否则无法区分「修好了」和「断言是空的」。你新加断言时请照做。

---

## 4. ★★ 本轮最重大的发现：JSON 测试驱动曾把所有嵌套 Op 条件当恒真放行 ★★

**已修，但下一位必须知道它意味着什么。**（已写入 AGENTS.md 坑点 38）

### 现象

`admin-groups.test.js` 的 4 项 A7 断言失败，`Received` 恒等于全库行数（4）——
`where[Op.or] = [...]` 看起来完全没起作用。

### 根因（已实证，不是推断）

`server/src/store/index.js` 的 `Op` 值是 **真 Symbol**：
```js
const Op = { eq: Symbol.for('eq'), ne: Symbol.for('ne'), like: Symbol.for('like'),
             in: Symbol.for('in'), or: Symbol.for('or'), and: Symbol.for('and'), ... }
```
而 `matchWhere` 用 `for...in` 遍历条件对象——**`for...in` 不枚举 Symbol 键**。于是
`{ [Op.like]: '%x%' }` / `{ [Op.in]: [...] }` / `{ [Op.ne]: 'blocked' }` / `{ [Op.lt]: d }` /
`{ [Op.gte]: d }` 这类嵌套操作符对象，内层循环**一次都不执行**，直接 fall through 到 `return true`。

两处代码证明这是遗漏而不是设计：
- `:381` 已经写了 `String(opKey).replace('Symbol(', '').replace(')', '')`——专为 Symbol 键准备的归一化
- `:374` 已经写了 `key === Symbol.for('or')` 的比较——专为 Symbol 键准备的跳过

两处都是**死代码**，因为 `for...in` 永远拿不到 Symbol。`matchOp`（`:394-427`）本身对
eq/ne/gt/gte/lt/lte/in/notin/like/is **实现完整**，只是不可达。

顶层 `Op.or`/`Op.and` 是被 `where[Symbol.for('or')]` 显式捕获的，但因为它们的**子条件全是 no-op**，
实际效果是：`where[Op.or] = [...]` 匹配所有行，`where[Op.and] = [...]` 也匹配所有行。

### 修法（2 行）

```js
for (const key of Reflect.ownKeys(where)) {      // 原：for (const key in where)
  ...
  for (const opKey of Reflect.ownKeys(cond)) {   // 原：for (const opKey in cond)
```

### 为什么这件事比它看起来重要得多

它解释了此前**所有「看起来矛盾」的观测**，也说明**一批既有测试的证明力比想象中弱**：

| 观测 | 真相 |
|---|---|
| `user.js` 城市测试通过 | 靠内存 `matchCity` 兜底，`{[Op.in]}` 是 no-op |
| `posts.js` 城市测试通过 | 同上 |
| 变异测试能让 discover 三条变红 | 因为修复前的 `where.city = cityNorm` 是**纯字符串值**，`for...in` 能枚举、`looseEq` 能求值 |

**推论（重要）**：
1. 计划里「✅ 已核实 `Op.ne`/`Op.lt`/`Op.gte`/`Op.and`/`Op.or` 均已模拟」这个前提是**错的**——
   代码写了，但不可达。计划里「**本轮不修改** `server/src/store/index.js`」这条约束因此作废。
2. 修好之后，A2 的 `auditStatus != 'blocked'`、B1 的 `where.userId = {[Op.in]: ids}`、
   B2 的 `activityAt: {[Op.lt]: now}`、B4 的 `id: {[Op.in]: gids}` **才第一次真的被测试验证**。
   在此之前，B1 的关注流在测试里会返回**全站所有动态**而测试照样绿。
3. **修完后全量 154 项一次通过，零回归**——说明没有既有测试是靠 no-op 才通过的。这是好消息，
   但只在当前这 154 项范围内成立。

### 仍未解决的一个分歧：JSON 驱动与 MySQL 在 NULL 上语义相反

`matchOp` 的 `lt` 实现是 `return a < b`。`activityAt` 为 NULL 时 `val` 是 `undefined`/`null`
→ `null < Date` 把 null 强转成 0 → **恒真**；而 MySQL 里 `NULL < '2026-01-01'` 结果是 NULL，即**不匹配**。

「`activityAt` 为空 = 不限期组局」这个业务含义在两个驱动下会给出**相反答案**。B2 必须遵守三条约束：
1. 条件 UPDATE 前先做内存真值判断（`if (g.activityAt && ...)`），**不要为了「让 SQL 兜住一切」删掉它**
2. 列表过滤必须显式写 `Op.or: [{activityAt: null}, {activityAt: {[Op.gte]: now}}]`，不能只写 `gte`
3. jest 必须有一条「`activityAt` 为 null 的 open 局在列表里可见、join 不被拦」的用例，
   否则这个分歧只会在生产暴露

**另有一个已知的日期比较缺陷，B2 会撞上（尚未修）**：`matchOp` 的 gt/gte/lt/lte 用
`/^-?\d/.test(val)` 判断是否转 Number，而 ISO 日期串 `'2026-01-01T...'` **也匹配这个正则**
（以 `2` 开头）→ `Number('2026-01-01T...')` = NaN → 比较恒 false。
要修的话：把正则收窄成 `/^-?\d+(\.\d+)?$/`，并在任一侧是 Date 时把两侧都转成时间戳。

### 其它三条 JSON 驱动的能力边界（计划里没写全，实测补上）

- **`decrement` 完全没有模拟** → 所以 A13 用读改写。你写新代码时同理。
- **`include` 不被解析** → F4 那类列名错**永远测不出来**，这是计划风险项 R7 的成因。
  凡是用了 `include` 的端点，**必须人工在本地 MySQL 或生产点一遍**。
- **`attributes` 白名单被忽略，且 `wrap().toJSON = () => ({ ...record })` 返回完整 record**
  → 任何 `xxx.toJSON()` 直接进响应体的端点，在 JSON 驱动下都会泄漏 `password`/`phone`。
  **必须显式挑字段**（`public-profile` 与 `fetchFollowList` 已按此改）。

---

## 5. 计划中已被证伪 / 需要修正的条目

| 计划条目 | 真相 | 处置 |
|---|---|---|
| **F6**「`posts.js:20-24` 城市变体仍是不对称写法，坑点 27 同源 bug」 | **误报**。`posts.js` 的 SQL 层是 `LIKE '${prefix}%'`（天生前缀对称），不是 `groups.js` 那种精确 `Op.in`。实测 `深圳`/`深圳市` 两个方向都召回 `['深圳','深圳市']` | 已把 F6 的落点纠正到 `user.js`（那里才是真正的精确等值 bug）。风险项 **R3 随之消失** |
| 「✅ 已核实 `Op.ne`/`Op.lt`/`Op.gte`/`Op.and`/`Op.or` 均已模拟」 | 错，见 §4 | 已修 `store/index.js` |
| 「**本轮不修改** `server/src/store/index.js`」 | 与 §4 冲突，作废 | 已修改（2 行） |
| A13 用 `Post.decrement` | JSON 驱动没有 `decrement` | 改读改写 + floor 0，顺带消掉 R8 |
| A7「只搜 title/city/category 并改 placeholder」 | 会砍掉既有的昵称搜索 | 改成折进 `Op.or`，placeholder 不用改 |

**方法论教训（与本项目待办 13、待办 7 的翻车同源）**：模式匹配到的「同源 bug」**必须逐个核实
SQL 形态**，不能凭代码形状下结论。F6 就是这么误报的。

---

## 6. 剩余工作（按顺序做）

任务表里已有对应条目：**#162 G1（in_progress）→ #163 G2 → #164 G3 → #165 G4 → #166 G5 → #167 G6 → #168 G7**。

### G1 收尾（就差 commit）

- ✅ **`admin/src/views/content/Comments.vue` 已查证，不需要改** —— 它只读 `row.post?.id`（`:21`），
  **不消费 `row.post.content`**。所以 F4 是纯服务端的 500（MySQL Unknown column），前端半边无事可做。
  ⚠️ 但这不改变结论：**F4 仍然无法自动化验证**（`include` 不被 JSON 驱动解析，见坑点 38），
  部署后**必须人工点一遍后台的评论管理页**确认 200。
- ⏳ **commit**（需用户明确要求才 commit；上一位刻意没提交）。

### G2 —— A12 `posts.tags` 列（**本方案唯一的 DDL**）

**★ 必须先把 SQL 单独贴给用户确认，再动手 ★**（用户的硬约束）

```sql
ALTER TABLE `posts` ADD COLUMN `tags` JSON NULL;
```

- 由启动期 `sequelize.sync({alter:true})`（`models/index.js:142`）自动执行，不需要手工跑。
  但**必须先让用户批准**，因为它在生产 MySQL 上执行。
- MySQL 8 对「加可空 JSON 列、无默认值回填」是 INSTANT/INPLACE，风险低。
- 执行前 `SHOW CREATE TABLE posts` 留底。
- 代码侧：`Post.js` 加 `tags: { type: DataTypes.JSON, allowNull: true, defaultValue: null }`；
  `posts.js:133` 的 `Post.create` 加白名单清洗
  `tags: Array.isArray(tags) ? tags.slice(0,5).map(t => String(t).slice(0,20)) : []`。
  （`sensitiveFilter` 的字段列表 `:104` 已含 `'tags'`，不用改。）
- 现状：`posts.js:114` 读了 `body.tags`，`:133` 传进 `create`，但**模型没有这一列 → 静默丢弃**。

### G3 —— A 组前端（不依赖 DDL，可与 G2 并行）

| 项 | 文件 | 要做什么 |
|---|---|---|
| **A8** | `app/src/api/index.js:34-35` | `followers/following` 现在写的是 `get(url, { params })`——**第二参就是 query data**（`request.js:396`），`{params}` 会被序列化成 `params[page]=2`。改成 `get(url, params)`。正确范例见同文件 `:44` `walletApi.transactions`。已 grep 确认唯一调用方是 `follow-list.vue:138`，改 api 层安全 |
| **A9** | `app/src/pages/follow-list/follow-list.vue` | **整页废掉**。`:104-114` 读 `profile.id`（`request.js:366` resolve 的是 `{code,message,data}` 信封 → 恒 undefined → 列表根本不请求）；`:133-161` `res.data` 是对象不是数组 → `items.map` 抛 TypeError。**决定改页面不改 api 层**（`userApi.profile` 另有 3 个调用方各自按信封读）。照 `user-profile.vue:174` 的范式 import `unwrap/unwrapPage/toList/toNum/toBool`，用 `pr.total` 控制 `noMore`，`:143` 补 `isFollowed`/`mutual`，`toggleFollow` 成功后把该项 `mutual` 置真 |
| **A4** | `app/src/pages/group/detail.vue` | **删掉 `:193` 整行 `groupApi.joins(gid)` 调用**（该端点仅发起人可访问，非发起人必 403 且被 `.catch(()=>({data:[]}))` 吞掉）。`GET /groups/:id` **已经返回 `joins` 数组**（每项 `{...join, user:{id,nickname,avatar,isElite}}`），前端完全没用。⚠️ 三处必须一起改：① `:196` 读 `u.nickname` 全 undefined（真实字段在 `u.user.nickname`）；② `:198` `id: u.id \|\| u.userId` 取到的是 **join 行 id**；③ `:206` 拿它比 `myUid` → **即使发起人本人 joined 也恒 false** |
| **A10** | `app/src/pages/user-profile/user-profile.vue:116` | `truncateText(post.content)` → `post.text \|\| post.content \|\| ''`。模型字段是 `text`，其余 5 个页面都用对了 |
| **A11** | 同上 `:301-308` | `onPostTap` 只 toast（且因 A10 内容恒空串）→ 改跳转 `/pages/post/detail?id=`，照抄 `discover.vue:615` |
| **A1** | `app/src/pages/post/publish.vue:70` | **发动态图片从不上传**。`uploadApi.files(filePaths)` 已存在（`api/index.js:102` → `upload.js:89-91`），已处理 token 注入/401 跳登录/错误 toast，**纯接线遗漏**。`onSubmit` 开头插入上传，注意 `uploadFile` resolve 的是 `{url,filename,originalName,size}` **对象**，必须取 `.url`。加在途守卫 `submitting`（坑点 23 的连点纪律） |
| **A5 前端** | `admin/src/api/index.js` + `admin/src/views/discover/Groups.vue` | `groupsApi` 补 `update: (id,data) => http.put(...)`；`onClose`（`:98-104`，现在调 del = **物理删除，不可恢复**）改调 PUT `{status:'closed'}`；`onReopen`（`:105-120`）**手搓了一个 axios 实例**绕过 `http.js`，一并改成用 `groupsApi.update` 并删掉手搓代码（否则坑点 32 的 base-aware 401 跳转不生效）；`onRemove` 保留 del，confirm 文案改成「将**彻底删除**该组局及其报名记录，不可恢复」 |
| **A13/A14 UI** | `post/detail.vue`、`user-profile.vue`、`api/index.js` | postApi 增 `removeComment`；详情页评论项对自己/帖主显示删除入口 + confirm。**A14 只需前端接线**——`posts.js:165-174` 的 DELETE **已经校验了作者**（`if (post.userId !== req.userId && !adminMatch) return fail(res,'无权限删除',403)`），**不是越权漏洞**，服务端不用改。`postApi.remove` 零调用方，在 `detail.vue`（自己的动态）与 `user-profile.vue` 动态卡片加「更多」→ `uni.showActionSheet(['删除'])` |

**A2 的前端零改动** —— 字段到位后 `profile.vue:220-226` 的 `applySocialStats()` 与
`user-profile.vue:218-220` 的三个 computed 自动亮。

### G4 —— 第一批本地验证 + 部署 + 生产实测

计划文件里有逐项量化断言（A1–A13 每条都有可执行的判据），照做。三条最容易踩的：

1. **本地后端必须用 `node src/app.js`，禁用 nodemon** —— `presence.touch()` 每个鉴权请求都写
   `data/*.json` → 触发自激重启循环 → 内存里的 60s 节流表丢失 → 浏览器侧表现为登录后一片 502（坑点 36）。
2. **`npm run dev:h5` 在本项目当前是坏的且零报错** —— 用 `npm run build:h5` + 一个 ~50 行的 node
   静态服务挂 5173 反代 `/api`→3000。本地 `POST /api/auth/sms` 的 `data.code` 恒为 **`888888`**（坑点 36）。
3. **生产实测的入口纪律**：`#/pages/home/home` 整页载入 → 点 tabbar 进入各页。
   **深链直入会让 `onShow` 多触发一次，污染请求计数**（坑点 28 / 待办 17）。
   计数用页面内 `performance.getEntriesByType('resource')` 按路径分组收集 `startTime` 与 **`responseStatus`**。

**F4 是唯一无法自动化验证的项**（`include` 不被 JSON 驱动解析），**必须人工在本地 MySQL 或生产
点一遍后台的评论管理页**。

部署红线：**禁 `set -eu -o pipefail`、禁 `docker compose down`、`SEED_ON_BOOT=false`、生产不跑完整 seed**。
push 前必须先做 20 秒出口诊断（3 条命令），**代理极性会同一天内来回反转，不能照抄上次结论**。

**观察 24h 无回归 → 才启动第二批。**

### G5 —— B 组服务端（DDL 0 条）

- **B1 关注流**：给现有 `GET /posts` 加 `?feed=following`，**不新建端点**（`posts.js:11-98` 已有
  optionalAuth、城市 where、分页、liked 计算、auditStatus 过滤全套管线，新端点要复制 ~90 行）。
  fan-in：先查 `Follow`（`limit: 500` 上限保护）拿 ids，再 `where.userId = { [Op.in]: ids }`，
  `order = [['id','DESC']]`（关注流不叠 top 置顶，那是全站运营位）。
  成本 2 条 SQL，`posts.user_id` 索引已存在。
  **空关注降级：服务端返回空列表，不回落全站流**（回落会让用户以为关注流坏了）。
- **B2 组局状态机 + 惰性过期**（零 cron、零依赖）：
  - **读路径不落库**，只对 `status IN ('open','full') && activityAt < now` 的行附加计算字段
    `expired: true`（热门组局 N 人同时看详情会产生 N 次 UPDATE 竞争行锁 + binlog 噪音，
    且读路径写库会让 jest 出现顺序依赖）
  - **写路径用条件 UPDATE 抢占**，加在 `POST /:id/join` 入口（天然幂等，MySQL 行锁保证只有一个生效）
  - **修审批拒绝路径的复活 bug**（`groups.js:209-212`）：现状无条件 `status:'open'`
    → **会把已过期/未满的局重新打开**。改成重新读一次再条件恢复
  - **列表过滤**（`groups.js:42`）：追加过期条件时**必须用 `Op.and` 把两组条件并列**，
    直接把 `Op.or` 塞进同一个 where 对象会覆盖既有的 status 键
  - ⚠️ **NULL 语义分歧**，见 §4 末，三条约束必须遵守
  - 本轮**不扩 `canceled` 语义**，过期统一归 `closed`
- **B3 暗坑①（必须先修，否则审批 UI 一上线就暴露）**：**被拒用户永远无法重新报名**。
  `GroupJoin` 有唯一索引 `(group_id,user_id)`，而 `groups.js:166` 的 exists 检查只排除
  `status != 'canceled'` → rejected 行仍在，重报命中「您已报名」。
  修法：exists 命中时按 status 分流——`pending/approved` → 「您已报名」；
  `rejected/canceled` → **复用该行 `update({ status:'pending', appliedAt: now, remark })`**（零 DDL）。
  jest 要覆盖「拒绝→重报→再拒绝」三连（风险项 R4）。
- **B4「我的组局」后端**：复用 `GET /groups`，加 `?mine=1` / `?joined=1`（auth），**不新建端点**。
  两个分支都要**放开 `status IN ('open','full')` 过滤**（要能看到 closed 历史）、
  **跳过 B2 新增的过期过滤**、排序 `[['id','DESC']]`。`joined=1` 用两步手动 join（JSON 驱动兼容）。

### G6 —— B 组前端

- **B1**：工作量极小。`discover.vue:115` 的 picker **已有「关注」**，`:618-622` `onRangeChange`
  已会 reload，**只缺 `:387` 的一个分支**。未登录用 `requireLogin()` 前置拦截（`fallback.js` 已有）
  + 服务端 401 兜底。空关注要展示引导空态 + 按钮把 picker 拨回「全国」。
- **B3**：放在 `group/detail.vue` 内 `v-if="isOwner"` 条件渲染，**不建独立页**（审批是低频操作，
  独立页要新增路由+入口+空态，成本高一档）。**发起人时才调 `groupApi.joins(gid)`**，
  非发起人不发这个请求（A4 已删）。手机号脱敏显示 `138****1234`，完整号只在点「联系」时走
  `contactHost()`。`groupApi.handleJoin(gid, joinId, status)` **已存在且签名正确**
  （`api/index.js:143`），全项目零调用方，直接启用。成功后本地更新该行 + 重算角标，**不整页刷新**。
- **B4**：新建 `app/src/pages/group/mine.vue` 并注册进 `app/src/pages.json`（非 tabbar）。
  **用 z-paging**，照抄试点页 `pages/transactions/transactions.vue` 的范式，
  四条硬规则见坑点 36（easycom 3 条规则 / `completeByTotal` / **自定义 `#empty` 必须接住
  `isLoadFailed`** / `onShow`+`auto` 双触发需 `firstShow` 守卫）。
  **入口只放一处**：`discover.vue` 组局 tab 顶部右侧「我的组局」文字按钮。
  **不动 `profile.vue` 的 8 宫格**（已满 8 格，加格会引发布局回归）。

### G7 —— 第二批验证 + 部署 + 生产实测 + 文档收尾

文档收尾包含：AGENTS.md 坑点与待办更新、必要时新增 ADR、`CONTEXT.md` 术语核对。

---

## 7. 明确不做（累积清单，别范围蔓延）

通知中心（归 D10）、组局评论点赞、热度排序公式、SQL 级真分页重构
（`posts.js:58-65` / `groups.js:58-64` 的全量 findAll + 内存切片**保持原样**）、
`posts.likes` JSON 迁独立表、`posts.js:169` 的 `req._adminAuth` 死分支（归 D12）、
`discover.vue` 传 `autoJoin=1` 但 detail.vue 不读的死参数、
**F6 原样（已证伪，`posts.js` 城市变体不动，只改了 prefix）**、
历史 `commentCount` 对账 SQL、礼物音效（用户明确要求回退，**任何未来会话都不要加回来**）、
修正历史 `balance_after`（待办 12 只修代码不动历史数据）、
在别的任务里顺手改 `App.vue` 的 `uni-page-body{min-height:100vh}`（待办 19，影响全部 33 个页面，
需单独一轮逐页验证）。

---

## 8. 硬约束红线（违反会造成生产事故）

**必读 `AGENTS.md` 的「已知坑点」全 38 条与「服务器信息」节。** 这里只列本轮最容易撞的：

- 部署脚本**禁止** `set -eu -o pipefail` 和 `docker compose down`
- **生产库禁止跑完整 `npm run seed`**；`SEED_ON_BOOT` 保持 false
- **每条 DDL / 生产 SQL 执行前必须把完整语句单独贴给用户确认**；金额字段改动需用户批准
- 生产凭证**只存在** `C:\Users\chen\.qoder-cn\projects\D--tongcheng-companion-play-app\memory\reference-server-access.md`
  （不在 git 仓库内）。查询口令时**只打印字段名 / `CHAR_LENGTH` / sha256 前若干位，绝不打印明文**
- 远程 MySQL：SQL 文件必须 `docker cp` 进容器再 `< /tmp/x.sql`；必须带
  `--default-character-set=utf8mb4`；文件内必须自带 `SET NAMES utf8mb4;` 和 `USE companion_play;`
  （坑点 29 的两个致命陷阱）
- **改服务端鉴权/中间件后，push 前必须本地跑全量 jest**
- 环境无 `python`、**无本地 `docker`**（只有 `node`）；Bash 里 `//` 开头的参数会被当 UNC 路径拒绝
  （绕行 `MSYS_NO_PATHCONV=1`）；**Git Bash 会把 `/api` 形式的环境变量值转换成 Windows 路径**
  （坑点 36，改用 `.env.production.local`）
- 容器内验证脚本必须放 `/app` 而不是 `/tmp`
- **截图工具不可用**；验证必须量化；computed style 不算验证
- 用户偏好中文沟通

---

## 9. 顺带需要知道的两件遗留事项（不属于本轮范围，但用户会问）

1. **S4（任务 #160）管理员口令 `admin`/`admin123` 仍是活的**（坑点 35）。用户选择「我会自己登录
   管理后台将密码更改掉」，但**后台根本没有改密功能**（已穷尽验证：路由/端点/前端 21 条路由全查过）。
   已把「事务 + rollback 零残留预演」证明过的 stdin 命令交给用户，等其选择：
   (a) 自己跑；(b) 建 `PUT /api/admin/me/password` + UI；(c) 由 AI 改且新值只写记忆文件。
   **不要单方面改口令。**
2. **GitHub 仓库截至 2026-09-08 深夜复查仍是 `"private": false`**（坑点 33）。用户说过要改 private，
   但那一步是控制台操作、尚未执行，**泄露窗口仍开着**。下次会话开头应重新用
   `curl https://api.github.com/repos/q2640962240/tongcheng` 复查一次（未鉴权返回 200 + `private:false`
   = 仍公开；private 仓库未鉴权会 404）。**别假设它已经 private 了。**
