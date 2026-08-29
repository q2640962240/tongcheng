# 「白夜」品牌升级 + 功能补强 — 实施任务队列（tasks.md）

> 规格：`.trae/specs/spec-20260828-baiye-rebrand-feature-boost/spec.md`
> 实施原则：串行化执行，所有旧测试必须保持通过。每完成一个任务后回归 `npm test` 和关键 E2E。

---

## 任务优先级与依赖

```
(品牌/主题/TabBar)    T1 → T2 → T3
(后端新增业务)        T4 → T5 → T6
(前端补齐 3 大页面)   T7 → T8 → T9 → T10
(管理后台)            T11
(文档+素材)           T12 → T13
(测试+回归)           T14
```

---

## T1. 产品名重命名（全局替换）

- **状态**: pending
- **优先级**: high
- **依赖**: 无
- **覆盖 AC**: AC1, AC11（部分）

### 实施内容
1. 创建一个幂等脚本 `scripts/rebrand-baiye.js`：
   - 读取 14 个目标文件列表（见 scan 结果 29 处命中），安全执行替换：
     - `同城陪伴玩 APP` → `白夜 App`
     - `同城陪伴玩` → `白夜`
     - `同城陪伴` → `白夜`
     - `伴玩` → `白夜`
   - 例外：`server/src/seed.js`、`scripts/*.js`、`.git/`、`unpackage/`、`node_modules/`、`dist/` 不做替换（避免把示例注释也改出歧义）。
2. `app/src/manifest.json`：
   - `name`、`versionName` 保留 1.0.0，但 `app_name`、`distribute.ios.bundleDevName`、`distribute.ios.bundleDisplayName`、`distribute.android.appname`、`splashscreen.static.iOS*.storyboard.titleText.color` 等所有应用名 → "白夜"。
3. `app/src/pages.json`：
   - `globalStyle.navigationBarTitleText` = "白夜"。
   - tabBar 两项的文本先保留（等 T3 扩到四项再更新）。
4. `server/data/configs.json`：`appName` → "白夜"，`companyName` → "白夜科技"（占位，可后续由运营改）。
5. `server/src/routes/config.js`：默认 appName 兜底改为 "白夜"。
6. `admin/src/views/login/Login.vue`、`admin/src/components/Layout.vue`：品牌标题替换。

### 本地验证规则（TR）
- **rule**: `scripts/rebrand-baiye.js --check` 扫描命中必须为 0。
- **rule**: `node -e "JSON.parse(require('fs').readFileSync('app/src/manifest.json','utf8'))"` 合法；pages.json 同理。
- **rule**: `app/src/manifest.json` 的 `appid === "__UNI__B38A42D"` 未被误改。

### 完成证据
- 执行 `node scripts/rebrand-baiye.js --check` 输出 "Brand scan clean: 0 occurrences"。
- manifest.json appid 输出校验一行 OK。

---

## T2. 主题体系（午夜蓝 + 金色 + 极光渐变）

- **状态**: pending
- **优先级**: high
- **依赖**: T1
- **覆盖 AC**: AC2, AR4

### 实施内容
1. `app/src/uni.scss`：
   - 重命名前缀 `companion-*` → `by-*`（baiye 缩写）。
   - 色板：
     - 主背景午夜蓝：`$by-bg = #0b0f1a`（夜间）、`$by-bg-soft = #141a2d`、`$by-surface = #1a2238`
     - 金色高亮：`$by-gold = #d4af37` / 软金 `#f5d583`
     - 紫极光渐变起点 `#7b61ff` / 终点 `#b57bff`（用于 Banner / 按钮渐变）
     - 语义色：success/warning/info 保持低饱和，error 保持 `#ef4444`
   - 圆角：小 8 / 中 16 / 大 24 / 药丸 9999 rpx
   - 阴影：暗色系阴影（`0 4rpx 32rpx rgba(0,0,0,.4)`）
2. `admin/src/styles/main.scss` 同步：`--by-bg`、`--by-gold` CSS 变量，覆盖 Element Plus `--el-color-primary` = `$by-gold`；登录/布局全用午夜蓝底。
3. 全局 App.vue 中 body / .page 背景改午夜色；`.btn-primary` 默认 `linear-gradient(135deg,#f5d583 0%,#d4af37 100%)` 金色渐变按钮。
4. 新建 `app/src/theme-baiye.scss` 并在 App.vue `@import`；所有旧 `.bg-primary-*` / `.text-primary-*` class 加 alias 兼容。

### TR
- **rule**: `uni.scss` 全局无 `companion-primary-*` 残留（grep 计数 = 0）。
- **rubric**: 主题渗透度 0-3：低=只改变量未改页面；中=关键页面对；高=首页/登录/个人中心/精英页 4 张关键页截图全是白夜主题。阈值 ≥ 2。

### 完成证据
- grep `$companion-primary` app/src = 0。
- 4 页面截图附在 Review。

---

## T3. TabBar 升级为 4 项 + 页面文件骨架

- **状态**: pending
- **优先级**: high
- **依赖**: T1, T2
- **覆盖 AC**: AC3, AC4

### 实施内容
1. `app/src/pages.json`：
   - tabBar.list 重写为：首页(`pages/home/home`)、发现(`pages/discover/discover`)、消息(`pages/chat-list/chat-list`)、我的(`pages/profile/profile`)。
   - iconPath：`static/tab/home.png / discover.png / message.png / profile.png`；selected `-active.png`。
2. `scripts/generate-icons.js` 扩展：额外生成 4 Tab×2 态 PNG 81×81。
3. 新建 `app/src/pages/discover/discover.vue` 空骨架（已包含 R2 的四 Tab 头部占位，后续 T8 填充）。
4. 新建 `app/src/pages/post/publish.vue`、`pages/group/detail.vue`、`pages/elite-pay/elite-pay.vue` 三个空骨架（后续 T9/T10 填充）。
5. 注册到 pages.json。

### TR
- **rule**: `tabBar.list.length === 4` 且每个 tab 声明的 iconPath 都磁盘存在。
- **rule**: 4 个新页面 Vue 文件存在且 `<template><script>` 结构合法（`node -e "require('fs').readFileSync(..., 'utf8').includes('<template>')"`）。

### 完成证据
- pages.json 校验片段截图/终端输出；icon 文件 glob 4×2 命中。

---

## T4. 后端模型 & 路由 & 中间件（动态/组局/Banner/精英付费）

- **状态**: pending
- **优先级**: high
- **依赖**: T1
- **覆盖 AC**: AC5, AC10, AC6（部分）, AC9（API 侧）

### 实施内容
1. **模型**（`server/src/models/`）新建：
   - `Post.js`：`{ id, userId, text, images[], location{province,city,lat,lng}, distanceUnit, auditStatus, createdAt, updatedAt, likes:[userId], likeCount, commentCount, online:bool }`
   - `Comment.js`：`{ id, postId, userId, replyToUserId?, text, createdAt, blocked }`
   - `Group.js`：`{ id, userId, title, icon, tags[], category, description, city, expectMin, expectMax, activityAt, status(draft/open/full/closed), joinCount, hot:bool }`
   - `GroupJoin.js`：`{ id, groupId, userId, status(pending/approved/rejected), appliedAt, handledAt }`
   - `Banner.js`：`{ id, title, image, link, position, sort, enabled, createdAt }`
   - `EliteOrder.js`：`{ id, userId, amount, channel, outTradeNo, transactionId?, status, paidAt, plan(lifetime), snapshot{price, rights[]} }`
2. `models/index.js` 导出上述 6 个；`store/` 会自动创建 JSON 文件。
3. **路由**：
   - `routes/posts.js`：`GET /posts`（分类/城市/附近/分页）、`POST /posts`（登录+敏感词过滤）、`GET /posts/:id`、`DELETE /posts/:id`（作者/管理员）、`POST /posts/:id/like`（toggle）、`POST /posts/:id/comments`、`GET /posts/:id/comments`
   - `routes/groups.js`：`GET /groups`（人数/时间/城市筛选/分页）、`POST /groups`、`GET /groups/:id`、`PUT /groups/:id`（发起人）、`DELETE`、`POST /groups/:id/join`、`GET /groups/:id/joins`（发起人可见）、`PUT /groups/:id/joins/:joinId`（通过/拒绝）
   - `routes/banners.js`（挂 admin 下）：`GET /banners`、`POST`、`PUT`、`DELETE`（管理员）
   - `routes/elite.js`（重构旧精英）：
     - `POST /elite/pay/order` 下单精英终身（走 `wxpay/alipay/utils/push` dev 回退）
     - `POST /elite/pay/notify/:channel` 异步回调验签+幂等+设置 isElite=true
     - `POST /elite/dev/pay`（dev 直接开通，用于 E2E 测试）
     - 保留 `POST /user/elite/apply` 老接口，但 app 不再调用；后台自动重定向
     - `POST /user/unlock-wechat`：扣减钻石 → 返回微信号完整文本；余额/非精英返回错误码
4. 敏感词中间件 `middleware/sensitive.js`（30+ 常见敏感词正则黑名单），在 posts/comments 发布时挂载。
5. `app.js` 挂载新路由：`app.use('/api/posts', posts)`、`/api/groups`、`/api/elite`、`/api/admin/banners`（新）；保留所有原路由。
6. `utils/sensitive.js` 简单实现 + 白名单（避免误杀"白夜"）。
7. `seed.js` 追加：30 条动态（覆盖 3 个城市、18 张 sucai 图片）、8 个组局（看电影/三亚旅行/密室/桌游/KTV/美食探店/徒步/剧本杀）、2 个 Banner（净化网络环境 + 组局新玩法）。

### TR
- **rule**: `GET /api/posts?pageSize=1&page=1` total ≥ 30。
- **rule**: `POST /api/posts {text:"违禁词测试...暴力毒品..."}` → 400 敏感词。
- **rule**: `POST /api/elite/dev/pay` 后对应用户 `isElite=true`。
- **rule**: `POST /api/user/unlock-wechat {userId}` → 用户钻石余额-99 且返回真实微信字段。

### 完成证据
- 4 条 rule 全部用 curl 或 e2e 片段执行通过。

---

## T5. 后端新增测试套件（post/group/banner/elite-pay）

- **状态**: pending
- **优先级**: high
- **依赖**: T4
- **覆盖 AC**: AC6

### 实施内容
1. `test/post.test.js`：
   - 未登录发动态 401、登录后正常发 200、敏感词 400、点赞 toggle 数字正确、评论 CRUD、列表分页。(至少 6 用例)
2. `test/group.test.js`：
   - 发起组局、报名、发起人通过、重复报名被拒、报名上限校验。(至少 4 用例)
3. `test/banner.test.js`：
   - 管理员登录后 CRUD 四步；非管理员 403；前端列表接口可用。(至少 4 用例)
4. `test/elite-pay.test.js`：
   - dev 支付 → 立即生效、老申请接口兼容、微信解锁扣钻、余额不足失败。(至少 4 用例)
5. 合计 ≥ 18 用例。

### TR
- **rule**: `npx jest post group banner elite-pay` 100% 通过，用例数 ≥ 18。

### 完成证据
- jest 终端输出截图或文字。

---

## T6. 旧测试 100% 通过（首轮回归）

- **状态**: pending
- **优先级**: high
- **依赖**: T4, T5
- **覆盖 AC**: AC7

### 实施内容
1. 执行 `cd server && npx jest --testPathIgnorePatterns=e2e` → 旧 34 用例必过。
2. 执行 `node test/e2e.test.js` → 旧 71 用例必过。
3. 若失败，定位根因，在 T1~T5 基础上做最小修补，不准回滚新功能。

### TR
- **rule**: Jest 输出 `Tests: 34 passed, 34 total`。
- **rule**: E2E 输出 `Passed: 71 / 71 (100%)`。

### 完成证据
- 终端日志副本粘贴。

---

## T7. 首页改版（白夜版 + 新人秀 + 资料卡瀑布流）

- **状态**: pending
- **优先级**: high
- **依赖**: T3, T4
- **覆盖 AC**: AR1

### 实施内容
1. `pages/home/home.vue` 完全重写（保留旧文件备份注释或 git diff 安全）：
   - 顶部导航品牌：`logo` 改为 `B` 圆形极光渐变 + 文本「白夜」。
   - Banner：`static/sucai/banner-purify.png`（从 sucai 选一张裁切后改名）、点击跳举报反馈页。
   - 快捷 Tab：暖心服务 / 兴趣约玩 / 同城 → 切换 `listMode`（分别筛服务分类、推荐动态、附近组局）。
   - 新人秀横滚：`/api/users?freshCert=1`（新接口，`server/src/routes/user.js` 加个 small 查询参数）；卡片右上角关闭按钮。
   - 瀑布流资料卡（使用 `components/UserProfileCard.vue` 新建组件）：对应 R3 中的 9 项要素。
     - 点击「查看」微信号 → 扣钻解锁接口。
     - 语音条 5 秒播放：`innerAudioContext.src = /uploads/sucai/sample-voice.mp3`（用一个短 mp3 放到 server/uploads 下作为种子示例即可；若不需要真 mp3，点击语音条显示 toast「语音已过期，联系 TA 可听实时语音」亦可接受，**先按后者实现**更稳）。
     - 点击「联系 TA」 → 如非精英 → 弹「立即加入/再逛逛」组件 `components/EliteGateModal.vue`。已精英 → 直接跳聊天页 `/pages/chat/chat?userId=xx`。
     - 「温馨提示」协议卡片：纯文本。
2. 新建 `components/UserProfileCard.vue`、`components/EliteGateModal.vue`、`components/NewComersRow.vue`。

### TR
- **rubric**: AR1 0-5 高还原度。阈值 ≥ 4。
- **rule**: 三个组件文件存在且被 home.vue 正确 import。

### 完成证据
- 首页 H5 运行截图一张。

---

## T8. 发现页（4 Tab：寻人大厅 / 动态 / 同城组局 / 红包专区）

- **状态**: pending
- **优先级**: high
- **依赖**: T3, T4, T7
- **覆盖 AC**: AC4, AR2

### 实施内容
1. 「寻人大厅」：用 `GET /user/provider?pageSize=10` 服务者列表，支持按最新/匹配度/距离（若未授权定位默认按注册时间排序）。
2. 「动态」Tab：
   - 顶部全国/附近下拉 + 城市显示 + `发布动态`按钮 → 跳 `/pages/post/publish`。
   - 列表复用 `components/PostCard.vue` 新建：头像+昵称+审核徽章+职业+城市+在线+时间+文本+图片(最多9)+「联系TA」+ ❤ 点赞 + 💬评论数 + 更多。
3. 「同城组局」Tab：
   - Banner（组局新玩法）+ 顶部筛选 + 发起组局按钮 + 组局卡片 `components/GroupCard.vue`。
   - 报名进群 → 若未精英弹 EliteGateModal；已精英 → POST `/groups/:id/join` → 弹出"报名成功，等待发起人确认"。
4. 「红包专区」Tab：静态卡 + 「每日签到领 10 💎」按钮（点了调 `wallet/reward` 新增接口或复用兑换，每天限一次即可；**若实现成本高，先做模拟签到 + 本地存储计数**，AC 不要求强接口）。

### TR
- **rubric**: AR2 0-5。阈值 ≥ 4。
- **rule**: 4 Tab 切换不崩溃；每页滚动加载至少能拉 1 页。

### 完成证据
- 4 张 Tab 截图拼 1 张或各自保存。

---

## T9. 子页补齐：发布动态 + 组局详情 + 精英付费下单

- **状态**: pending
- **优先级**: medium
- **依赖**: T7, T8
- **覆盖 AC**: AC4, AC9（前端侧）, AR3

### 实施内容
1. **发布动态** `pages/post/publish.vue`：文本输入（字数 500 限制）+ 9 图上传（复用 `utils/upload.js`）+ 城市选择 + 发表按钮。
2. **组局详情** `pages/group/detail.vue`：头部大图 + 详情卡片（标签、描述、时间、人数、期望）+ 报名列表（只显示报名人数列表头像）+ "报名进群"按钮（同 T8 组局卡片按钮）+ 底部"发起人联系TA"。
3. **精英付费** `pages/elite-pay/elite-pay.vue`：
   - 顶部用户卡（参考图 4）+ 累计加入人数。
   - 6 项权益 2×3 栅格。
   - 「平台保证」3 项（即时生效/100% 真人保障/机器冒充退款）。
   - 「为什么付费？一定要看！」折叠说明。
   - 底部：合计 30 元/终身 + 「再逛逛」（返回首页）+ 「点击加入」（调 `/elite/pay/order` → dev 环境会直接成功；成功后 toast「已成功开通精英！」并跳回上一页或刷新 isElite）。

### TR
- **rule**: 3 页面单独打开不会 404；页面内所有按钮点击可响应。
- **rubric**: AR3 0-5。阈值 ≥ 4。

### 完成证据
- 精英付费开通成功 + 个人中心徽章显示「E」截图一张。

---

## T10. 个人中心 + 设置 + 反馈 + 聊天入口收尾

- **状态**: pending
- **优先级**: medium
- **依赖**: T7, T8, T9
- **覆盖 AC**: AC9（聊天侧）

### 实施内容
1. 个人中心页顶部：显示精英徽章 / 未开通时"开通精英"入口。
2. 聊天页：语音条已存在，确保"非精英不能首次发起私聊"（对方不是我的关注且我非精英 → 弹 EliteGateModal）。
3. 设置页：新增"动态免打扰/组局通知"两个开关，与 settings 路由 `meta.notification.post/group` 对接。
4. 反馈页：增加"举报动态/组局"下拉选项与对应 ID 输入字段（可选）。

### TR
- **rule**: 新设置项切换后刷新仍保持状态（接口侧持久化后对比）。

### 完成证据
- 设置 2 个开关切换后刷新前后对比截图。

---

## T11. 管理后台新增 4 个 Tab

- **状态**: pending
- **优先级**: medium
- **依赖**: T4
- **覆盖 AC**: AC8, AC10

### 实施内容
1. `admin/src/router/index.js` 新增路由：
   - `/discover/posts`（Posts 视图）
   - `/discover/groups`（Groups 视图）
   - `/operations/banners`（Banners 视图）
   - `/finance/elite-orders`（EliteOrders 视图，并入 Finance 子路由）
2. `admin/src/components/Layout.vue` 侧栏扩展 4 项，图标使用 Element Plus 自带。
3. 视图：
   - Posts：表格列（作者/内容预览/图片数/点赞/评论/状态/操作：审核/删除/置顶）。
   - Groups：表格（发起人/标题/标签/人数/状态/操作：通过/关闭/删除）。
   - Banners：增删改查表单（位置/权重/启用），表格 + 预览图。
   - EliteOrders：表格（用户/金额/渠道/状态/支付时间）；支持搜索、导出 CSV（可选，最低要求表格筛选）。
4. `admin/src/views/discover/Posts.vue`、`Groups.vue`；`operations/Banners.vue`；`finance/EliteOrders.vue` 四个新文件。
5. 仪表盘 `Dashboard.vue`：新增"动态数 / 组局数 / 精英订单金额" 3 个指标卡片（后端 dashboard 接口加对应字段）。

### TR
- **rule**: 4 路由 `/admin/discover/posts` 等登录后访问 200 且页面标题正确。
- **rule**: 仪表盘 3 个新指标值 ≥ 0（API 返回非空且 number 类型）。

### 完成证据
- 4 页面各 1 张截图 + 仪表盘截图。

---

## T12. Sucai 素材落地 & 种子数据扩展

- **状态**: pending
- **优先级**: medium
- **依赖**: T4
- **覆盖 AC**: R7（文档里 7 条要求）, AC10

### 实施内容
1. 复制素材：挑选 10 张中 7 张 → 拷贝到 `app/src/static/sucai/` 命名规范（banner-purify.jpg / banner-join.jpg / post-game1.jpg / post-travel1.jpg / profile-ziqing.jpg / group-movie.jpg / group-travel.jpg）。
2. 同 7 张同步复制到 `server/uploads/sucai/`（对外 `/uploads/sucai/xxx.jpg` 可访问）。
3. `seed.js` 插入：
   - 30 条动态（5 个用户 × 6 条，各配 1~9 图）
   - 8 个组局（看电影/三亚7日游/密室逃脱/桌游/K歌/美食探店/夜爬梧桐山/剧本杀）
   - 2 个 Banner（净化网络 / 组局新玩法）
4. `npm run seed` 幂等：第二次执行不重复插入（使用 `upsertBy` unique key 或 title+userId 组合去重）。

### TR
- **rule**: `npm run seed` 连跑 2 次后，posts 总数保持 `>= 30` 且不 > 40。
- **rule**: `app/src/static/sucai/` 7 文件全部存在；同时 `server/uploads/sucai/` 亦存在。

### 完成证据
- 双 run seed 终端日志 + ls 结果。

---

## T13. 文档 & 项目说明同步更新

- **状态**: pending
- **优先级**: medium
- **依赖**: T1, T4, T12
- **覆盖 AC**: AC11, AR5

### 实施内容
1. **README.md** 重写：
   - 标题：`# 白夜 App · 高效陪伴与邀约平台`
   - 简介：含"高效邀约 / 动态广场 / 同城组局 / 精英会员 / 游戏陪玩"。
   - 新增目录说明：`app/static/sucai/`、`scripts/rebrand-baiye.js`、`server/src/models/Post.js` 等新文件。
   - 测试账号列表（来自 setup-test-accounts 产物）。
2. **docs/PROJECT.md**：
   - 标题与简介替换为"白夜"。
   - 功能清单扩展 14 行（新增：动态/评论/点赞、组局/报名/审核、Banner 管理、精英付费订单、微信解锁、新人秀、红包签到、发现四 Tab、午夜主题、TabBar 四 Tab、素材管理、敏感词过滤、仪表盘新增指标、联系TA 弹层），总数 ≥ 55 行。
   - 里程碑：在 Phase 5 后新增 **Phase 6 — 白夜 v2 品牌升级 & 广场化**（对应 T1~T13），原有 Phase 6 上线发布改为 **Phase 7 — 生产环境上线**。
   - 设计规范 3. 一节改为"午夜蓝 + 金色 + 极光渐变"，说明参考 `sucai/` 图 1-5。
3. **docs/PRIVACY-POLICY.md**：产品名替换；新增"动态内容发布""组局位置信息""地理位置仅用于附近匹配&可在设置关闭"3 段。
4. **docs/APP-STORE-CHECKLIST.md**：新增 6 条自检（动态/组局举报入口、敏感词过滤日志、精英非应用内购说明、用户协议/Privacy 链接、真人保障声明机制、支付回调测试报告）。
5. **docs/BRAND-REFERENCE.md**（新建）：10 张 sucai 参考图对应实现了什么功能点逐一列出，附本实现对应的文件路径（图 1 → home.vue + UserProfileCard.vue + banners seed；图 2 → discover.vue 组局 Tab + GroupCard.vue；…）。

### TR
- **rule**: grep "伴玩" 所有文档文件结果 = 0（必要时允许 BRAND-REFERENCE 出现"原品牌曾用名：伴玩"仅 1 处说明）。
- **rubric**: AR5 0-3。阈值 ≥ 2。

### 完成证据
- `find docs README.md -type f | xargs grep "伴玩"` 输出行数 ≤ 1。
- PROJECT.md 功能清单表格行数 ≥ 55。

---

## T14. 终局回归测试

- **状态**: pending
- **优先级**: high
- **依赖**: T1~T13
- **覆盖 AC**: AC7, AC6, AC12, AC1（最终）, AR1-5（最终打分）

### 实施内容
1. Jest 全量：`cd server && npx jest` → (34旧 + 18新) = 52 ≥ 52 用例全通过。
2. E2E：`node test/e2e.test.js` → 追加 12 条新用例（posts CRUD/like/comment; groups join; elite pay + unlock wechat; banners admin CRUD）；总计 ≥ 83 条。
3. 图标完整性：`node scripts/generate-icons.js --check` 输出 manifest 43 条路径全存在。
4. 代码反扫：`伴玩/同城陪伴/#ffd60a` 出现 ≤ 1 处（仅允许 changelog）。
5. 根据 AC / AR 逐项打勾，给出最终评分。

### TR
- **rule**: Jest 用例 ≥ 52 全通过。
- **rule**: E2E 通过率 ≥ 95%（≥ 79 / ≥ 83）。
- **rule**: icon-check 通过；品牌反扫 ≤ 1。

### 完成证据
- 输出本次变更最终汇总表（类似 README 的"测试报告"一节），包含 AC / AR 证据链接。
