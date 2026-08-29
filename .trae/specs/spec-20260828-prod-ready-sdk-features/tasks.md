# 白夜 App — 生产级 SDK 安装 + 功能补全 任务清单（tasks.md）

> 对应规格：`spec.md` · 编号：prod-ready-sdk-features
> 本文件所有 headings "Task N: ..." 固定，状态只写 Status 字段

---

## Task 1: 6 生产 SDK 安装 + server 端 package.json 补全
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 安装 6 个生产 SDK 包到 `server/package.json dependencies` 并锁稳定大版：
    - `axios@^1.7.2`
    - `@alicloud/dysmsapi20170525@^2.0.24`
    - `@alicloud/openapi-client@^0.4.12`
    - `tencentcloud-sdk-nodejs-sms@^4.0.820`
    - `alipay-sdk@^4.11.0`
    - `ali-oss@^6.21.0`
  - `npm install --save` 一次性写入 dependencies 验证存在；
  - 注释 `server/src/config/database.js` 中 `require('sequelize')` 并加 Phase 8 MySQL 迁移说明，不删除该文件。
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `rule` TR-1.1: 在 server 目录运行 `node -e "['axios','@alicloud/dysmsapi20170525','@alicloud/openapi-client','tencentcloud-sdk-nodejs-sms','alipay-sdk','ali-oss'].forEach(m=>{try{require.resolve(m);console.log('OK',m)}catch(e){console.log('MISSING',m,e.code)}})"`，输出 6 条全部 OK。证据：命令 stdout。
  - `rule` TR-1.2: 读取 `server/package.json` 的 dependencies 字段，上述 6 包 key 均存在且版本为 `^`。证据：JSON 片段或 grep 输出。
  - `rule` TR-1.3: `node src/app.js` 启动 10s 内不出现任何 `Cannot find module 'sequelize'` 字样；`GET /api/health` 200。证据：启动日志 tail + health 响应。
- **Notes**: SDK 安装遇到网络错误可切换 npm 镜像到 npmmirror。

## Task 2: 红包签到专区后端闭环（SignIn 模型 + 路由 + 配置中心字段 + API 封装）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1（只依赖 server 环境稳定，非逻辑依赖，可并行）
- **Description**:
  - 新建 `server/src/models/SignIn.js`：字段 `{ userId: Number, date: String(YYYY-MM-DD), rewardDiamond: Number, createdAt: Number }`，使用 JSON Store Collection 模式；
  - 新建 `server/src/routes/signin.js` 或在 `routes/wallet.js` 内新增：
    - `POST /wallet/sign-in`（auth 登录需要）→ 同用户同日幂等；Transaction + wallet.diamond 回写；
    - `GET /wallet/sign-in/status`（登录需要）→ 返回 `{ todaySigned, streakDays, rewardDefault }`；
  - `app/src/store/wallet.js` 如有需要补 signInStatus 字段（可选，不强依赖）；
  - 配置中心 app 模块新增 `signInRewardDiamond`（number，默认 10），后端 FIELD_LABELS + collectTemplate 同步 + 管理后台 Settings 表单默认渲染；
  - `app/src/api/index.js` 的 `walletApi` 新增：
    - `signIn()` → POST /wallet/sign-in
    - `signInStatus()` → GET /wallet/sign-in/status
  - `server/src/app.js` 挂载 signin 路由（或复用 wallet.js 新 handler，保持 URL 语义）。
- **Acceptance Criteria Addressed**: AC-3, AC-9
- **Test Requirements**:
  - `rule` TR-2.1: 登录用户 2 次并发 `POST /api/wallet/sign-in`，只产生 1 条 SignIn + 1 条 Transaction(type=reward, kind=signIn)，余额仅 +10（或配置值）。证据：E2E 脚本执行日志 + JSON data 文件切片。
  - `rule` TR-2.2: `GET /api/wallet/sign-in/status` 在同日前返回 todaySigned=true，连续天数≥1。证据：HTTP 响应 body。
  - `rule` TR-2.3: 配置中心 app 字段 list 中出现 `signInRewardDiamond`，required=true，保存后 `getModuleConfig('app').signInRewardDiamond` 生效。证据：/api/admin/config/modules 的 app.fields 片段。
  - `rule` TR-2.4: `app/src/api/index.js` 导出对象中 walletApi.signIn 和 signInStatus 均为 function，调用走正确 URL（401 说明 token 未传，至少不抛 TypeError）。证据：源码导出 grep。
- **Notes**: 幂等务必用"查询后在同一事件循环内写回 + JSON Store 锁（读-改-写串行）"，避免并发 2 请求双写。

## Task 3: 精英付费 dev 直开路由（修复 POST /elite/dev/pay 404 + 生产禁用）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None（可与 Task 2 并行）
- **Description**:
  - 在 `server/src/routes/elite.js` 新增 `router.post('/dev/pay', auth, handler)`；
  - 仅当 `process.env.NODE_ENV !== 'production'` 时放行；否则 403；
  - channel 可选，默认 'dev'；若请求体带 channel 则必须为 'dev'，否则 400；
  - 逻辑复用下单→入账流程的"开通精英"部分（或直接写 EliteOrder + 用户 isElite=true）。
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `rule` TR-3.1: 开发环境 POST /api/elite/dev/pay 返回 200 `{code:0}`；随后 `GET /api/user/me` 返回 data.isElite===true；EliteOrder 新增 1 条 status=paid, channel=dev。证据：三段响应 + EliteOrder JSON。
  - `rule` TR-3.2: 临时 `NODE_ENV=production` 启动后端再 POST → statusCode=403 且 message 含"已禁用"文案。证据：HTTP status + 响应 message。
  - `rule` TR-3.3: eliteApi.devPay 定义存在于 app/src/api/index.js，URL 方法匹配路由。证据：源码 grep。
- **Notes**: 该路由与真实支付通道是"或"的关系，不影响微信/支付宝真实下单实现。

## Task 4: 举报通道数据模型扩展（动态/组局/用户 3 类）+ 后端 handler + 管理后台显示列
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - `server/src/models/Feedback.js` 新增字段 `postId`, `groupId`, `targetUserId`, `refType`；
  - `server/src/routes/feedback.js` 中 FEEDBACK_TYPES 增加枚举值 `report_post`, `report_group`, `report_user`；
  - `POST /feedback` handler 校验：`refType=report_post` → 要求 postId 非空；`report_group`→groupId；`report_user`→targetUserId；
  - 管理后台 `GET /admin/feedbacks` 支持按 `refType` 筛选；
  - 管理后台 `views/content/Feedbacks.vue`（或对应文件名）列表增加"举报类型 / 目标 ID"两列展示。
- **Acceptance Criteria Addressed**: AC-5, AC-9
- **Test Requirements**:
  - `rule` TR-4.1: 分别提交 refType 三类举报，对应 ID 字段在 Feedback 文件中完整非空。证据：data/feedbacks.json 对应行。
  - `rule` TR-4.2: `GET /api/admin/feedbacks?refType=report_post` 仅返回动态举报。证据：HTTP 响应 list 计数。
  - `rule` TR-4.3: 后台反馈管理模板中出现 `<el-table-column>` 对应 `refType` + `targetId`（或分组）两列。证据：Vue 模板片段 grep。
- **Notes**: 不做"点 ID 跳转到对应管理页"按钮（第一期），仅列展示。

## Task 5: 管理后台 4 新 Tab API 封装 + 列表读接口补齐
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - **admin/src/api/index.js** 新增 4 个模块导出：
    - `postsApi = { list(params), audit(id, patch), del(id) }`
    - `groupsApi = { list(params), del(id) }`
    - `bannersApi = { list(params), create(data), update(id,data), del(id) }`
    - `eliteOrdersApi = { list(params) }`
    - 统一走 `adminRequest`，加 `x-admin-token` 头（如果现有 request 已自动带，不重复加）
  - **server/src/routes/admin.js** 新增：
    - `GET /admin/posts` 分页 + auditStatus 筛选 + keyword
    - `GET /admin/groups` 分页 + status 筛选 + keyword
  - 对应 `views/discover/Posts.vue / Groups.vue / operations/Banners.vue / finance/EliteOrders.vue` 4 个视图文件改为调用封装后的 API（替换现有可能写死 axios URL 的代码）。
- **Acceptance Criteria Addressed**: AC-6, AC-7, AC-9
- **Test Requirements**:
  - `rule` TR-5.1: `admin/src/api/index.js` grep 4 个 Api 对象均存在且 list/create/update/delete 方法存在。证据：代码片段。
  - `rule` TR-5.2: `GET /api/admin/posts` 与 `/api/admin/groups` 各返回 `{code:0,data:{list:[],pagination:{page,pageSize,total}}}` 结构。证据：HTTP 响应。
  - `rule` TR-5.3: 进入 4 个 Tab 视图时不再出现未封装的 URL 报错（浏览器网络面板 200 非 404）。证据：4 个页面网络面板或视图 onMounted 代码。
- **Notes**: 保持现有 admin 模块 auth 逻辑一致。

## Task 6: Banner 写接口 / Config 路由去重
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 5（删除重复前必须确认 banner.js 有 /admin/list 走 banners.js）
- **Description**:
  - **Config 路由收敛**：`routes/config.js` 顶部注释"deprecated：统一使用 routes/admin.js 的 /admin/config/modules 版本"，保留代码不动避免旧调用报错；Settings.vue 已走 admin 版不走 config.js；
  - **Banner 写接口去重**：删除 `routes/admin.js` 中重复的 3 段 `router.[post|put|delete] '/admin/banners...'`；确保 `/api/admin/banners`（读/写）的真实实现由 banners.js 走 `adminAuth` 提供。必要时 banners.js 的前缀挂载从 `/banners` 调整为同时提供 `/admin/banners`。
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TR-6.1: 删除后 Banner 的 list/create/update/delete 4 接口走 banners.js 仍全 200（4 Tab 测试）。证据：4 请求 200。
  - `rule` TR-6.2: Settings.vue 保存配置→ `/api/admin/config/modules` 重读数据一致。证据：保存值与重读值字段匹配。
- **Notes**: 若 banners.js 没有 `/admin/banners` 路由（只有 `/banners/admin/list`），则补齐别名路由或改后端 app.js 挂载别名，不强行改视图层 URL。

## Task 7: 接口索引补齐（settingsApi.notify / userApi.kefu）+ 现有方法校验
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - `app/src/api/index.js`：
    - `settingsApi.notify = patch => request({url:'/settings/notify', method:'POST', data: patch})`
    - `userApi.kefu = () => request({url:'/user/kefu', method:'GET'})`
  - 检查 settings.js 路由是否已经有 `POST /notify` 并处理 meta.notification；没有的话补一个 handler 写进 User.meta。
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `rule` TR-7.1: grep 源码导出中存在上述两个方法。证据：源码 grep。
  - `rule` TR-7.2: 以已登录用户发起调用，/settings/notify 返回 200 并回写 meta；/user/kefu 返回 `{wechat, phone, notice, qrcode}` 客服字段。证据：HTTP 响应。

## Task 8: PROJECT.md / README.md / .env.example 文档校正
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 1~7（功能都落地后校正文档状态）
- **Description**:
  - PROJECT.md 61 条状态重新对齐：
    - #53 红包签到：保持 ✅（或如果第一期仍有 UI 静态就改为 🚧 + 说明）
    - #60 "仪表盘 5 新增指标"文案更新（postCount/groupCount/bannerCount/elitePaidCount/eliteRevenueFen），补充 banner 指标说明。
  - PROJECT.md 新增"生产 SDK 安装清单"小节到"本地开发"或 README 部署段。
  - README.md 生产部署段加 6 SDK 名 + 用途。
  - server/.env.example 补充生产 SDK 安装命令提示（如已存在就更新措辞到 6 个包最新名）。
  - 更新 BRAND-REFERENCE.md（如果新 Tab UI 有新的素材映射则补；不强制）。
- **Acceptance Criteria Addressed**: AC-9, AC-10
- **Test Requirements**:
  - `rule` TR-8.1: 重新跑 gap-audit，`unverifiedFeatures.length === 0`。证据：gap-audit.json。
  - `rubric` TR-8.2: 文档与代码一致性；维度：生产部署文档对 SDK 的描述完整度；Scale 1-5；1=文档没提 SDK；3=只在 1 处提到 SDK；5=README+PROJECT+.env.example 三处都给出了 6 SDK 的清单+用途+安装命令；Threshold ≥4。证据：三处 grep 片段。

## Task 9: 回归测试（Jest 全绿 + E2E 新增用例）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1~8 全部完成
- **Description**:
  - `cd server && npm test` 跑现有 Jest 套件（8 套件 ~34 case）；任何失败的 case 修复；
  - 扩展 `test/e2e/`（或已有 e2e 脚本）至少新增以下 12 case（作为独立脚本或追加）：
    1. 签到首次成功；2. 同日重试幂等；3. 签到状态查询；4. 精英 devPay 成功；5. 精英 devPay production 环境拒绝；6. 举报动态字段落地；7. 举报组局字段落地；8. 举报用户字段落地；9. 后台 GET /admin/posts 分页；10. GET /admin/groups 分页；11. Banner 4 CRUD；12. 管理后台 4 新 Tab 封装方法可调用（status 200）。
  - 输出最终测试报告：Jest + E2E 双份。
- **Acceptance Criteria Addressed**: AC-11, AC-10
- **Test Requirements**:
  - `rule` TR-9.1: `npm test` 最后一行 `Test Suites: X passed, X total` 中 passed=total。证据：测试输出。
  - `rule` TR-9.2: E2E 新增 12 case 全部 pass。证据：脚本输出的 Summary 段。
  - `rubric` TR-9.3: 回归整体稳定性（维度：新增接口是否与现有 JWT/auth/限流无冲突）；Scale 1-5；1=3+case 失败；3=1~2 失败；5=全通过 0 失败；Threshold ≥4。证据：失败案例数。

## Task 10: 独立前复查 Spec-Tasks 覆盖 + 部署状态条
- **Status**: `pending`
- **Priority**: low
- **Depends On**: Task 1-9
- **Description**:
  - 对照 spec.md 的 11 条 AC，逐条标记 covered-by：
    - AC-1,AC-2 → T1；
    - AC-3 → T2；
    - AC-4 → T3；
    - AC-5 → T4；
    - AC-6 → T5；
    - AC-7 → T7 + T5 覆盖；
    - AC-8 → T6；
    - AC-9 → T8 + gap-audit 复核；
    - AC-10 → T8.2 + T9.3（Rubrics 取较高分者或合成证据）；
    - AC-11 → T9.
  - 将 Coverage 矩阵写入 tasks.md 末尾供 Review 引用。
- **Acceptance Criteria Addressed**: 全部 AC 的覆盖完整性
- **Test Requirements**:
  - `rule` TR-10.1: 11 条 AC 每条至少关联 1 个 Task，无缺口。证据：Coverage 表格。
- **Notes**: 仅为 Review 准备，不产生代码变更。
