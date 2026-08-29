# 白夜 App — 生产级 SDK 安装 + 功能补全 Spec

> 仓库根：`d:\tongcheng\companion-play-app`
> 文档版本：v3（2026-08-28）
> 前序规格：`.trae/specs/spec-20260828-baiye-rebrand-feature-boost/spec.md`
> 缺口审计报告：`.trae/specs/gap-audit.json`

---

## 一、概述（Overview）

- **Summary（构建内容）**：对白夜 App 三端做一次"生产级收尾"：
  1. 把代码里已通过"动态 try-require 声明依赖"方式引用、但未在 `package.json dependencies` 中真实声明的 6 类生产 SDK，**全部安装到 server 端**，使短信 / 微信支付 / 支付宝 / OSS / 推送 6 条真实通道可直接切换到 provider 生产模式；
  2. 补齐缺口审计（gap-audit.json）中发现的 4 类 12 项"PROJECT.md 标完成但代码实证未完成"的功能点：红包签到、精英 dev 直开 404、举报 3 类关联字段、管理后台 4 新 Tab API 封装 + 列表读接口、签到/客服/通知 API 索引方法、两套 config / banner 写接口去重；
  3. 同步校正 `docs/PROJECT.md` 61 行功能清单状态，使其与代码真实情况一致，并跑通 Jest 单元测试 + 接口 E2E 冒烟。

- **Purpose（为什么做）**：用户要求项目能投入生产环境，不能有"SDK 未装 → 切生产即报错"或"文档写完成实际是壳 → 用户测功能 404"的情况，保证管理后台配置中心填了真实参数后，所有服务通道立即生效。

- **Target Users（目标使用者）**：
  - **运营方**：拿到源码后执行 `server/npm install` 一次性得到所有生产 SDK，不用再手工装包；
  - **App 用户**：红包签到每日领钻、举报动态/组局/用户 等功能真实可用；
  - **开发/测试**：精英付费 dev 直开可以在本地环境免支付快速开通开发态调试。

## 二、目标（Goals）

- **G1**：server/package.json dependencies 覆盖 100% `require('外部包')`（不包 Node 内置包），`npm install --production` 后 sms/wxpay/alipay/push/oss 所有 provider 分支不再因"Cannot find module"失败。
- **G2**：所有 PROJECT.md 中标记为 ✅ 的功能项，至少"接口存在 × 页面按钮调用 × 管理后台菜单入口"三要素实证通过；不得出现文档写完成但路由 404 的空壳。
- **G3**：管理后台所有 13 条菜单路由（含发现/4 新 Tab），都通过 `admin/src/api/index.js` 统一封装调用，不允许页面直接写死 axios URL 绕开鉴权。
- **G4**：功能清单 PROJECT.md 与代码真实状态 1:1 对齐，若确有"第一期静态占位 + 第二期接入"的条目，明确标记为 🚧 并附后续计划。
- **G5**：SDK 升级后不破坏现有 8 套件 Jest 单元测试（34 case 全绿），也不破坏 seed 初始化 + 配置中心接口。

## 三、非目标（Non-Goals）

- **NG1**：不做 HBuilder X / 微信开发者工具 / App Store 线上提审操作本身（只保证三端产物与配置完整，用户后续自行提交）。
- **NG2**：不真实开通阿里云/腾讯云/微信支付/支付宝账户，也不写任何真实密钥到代码或 seed 中；所有密钥入口仍走管理后台配置中心空模板。
- **NG3**：不切换到 MySQL / Redis 等外部存储；沿用 JSON Store 文件存储层，也不改变数据模型序列化格式。
- **NG4**：不升级 uni-app / vue / sass / element-plus 等主依赖大版本，避免连锁编译兼容问题；SDK 安装一律 pin 到稳定大版并锁 `^X.Y.Z`。
- **NG5**：不改变已完成的 UI/主题体系（午夜蓝+金色+紫极光），只做接口/封装/字段模型层面的补齐。

## 四、背景与上下文（Background & Context）

### 4.1 现状与缺口来源

通过只读扫描（`.trae/specs/gap-audit.json`）产出以下与生产上线直接相关的实证缺口：

| # | 类别 | 条目 | 影响 PROJECT.md 编号 | 风险等级 |
|---|---|---|---|---|
| G1 | SDK 缺失 | 6 生产 SDK 未在 dependencies 声明 | #22, #23, #32, #33 | 🔴 阻断生产 |
| G2 | 功能空壳 | 红包签到专区 API 全缺失（路由层 0 + API 层 0） | #46, #53 | 🔴 阻断生产 |
| G3 | 路由 404 | `POST /elite/dev/pay` dev 直开漏实现 | #52 | 🟠 影响联调 |
| G4 | 数据字段 | 举报模型缺 postId/groupId/targetUserId/refType 关联字段 + report_* 类型 | #54 | 🟠 影响闭环 |
| G5 | Admin 封装 | 管理后台 4 新 Tab（动态/组局/Banner/精英订单）的 `admin/src/api/index.js` 封装 100% 缺失；列表读接口缺失 | #59 | 🟠 影响后台 |
| G6 | Admin 读接口 | 动态 / 组局管理缺 GET `/admin/posts`、GET `/admin/groups` 列表 | #47, #49, #59 | 🟠 后台空 |
| G7 | 接口重复 | routes/config.js 和 admin.js 两套 `/admin/config/*` 并存；Banner 写接口两套 | #31, #58 | 🟡 状态漂移 |
| G8 | API 索引缺方法 | settingsApi 无 notify；userApi 无 kefu；eliteApi 有 devPay | G3 延伸 | 🟡 维护性 |
| G9 | 文档与代码不一致 | 仪表盘 5 字段 vs 文档 4 字段；PROJECT.md 61 条有实证不通过 | #60 | 🟡 可信度 |

### 4.2 上一轮生产改造已完成（不可回退约束）

- 种子数据 `server/src/seed.js` 只初始化管理员 + 配置中心空模板，不含测试用户数据；
- 短信/支付/推送/OSS 的 `DEV` 模式回退点均已删除，未配置直接抛业务错提示在后台配置；
- 管理后台 Settings.vue 已升级为"白夜高对比度 + 必填红星 + 色条 + 标签/选填胶囊 + 260px 宽 label"UI；
- 移动端 uni.scss / App.vue / home.vue / discover.vue Sass 编译冲突已解决，H5 0 ERROR 编译通过。

## 五、功能需求（Functional Requirements）

### FR-1 6 类生产 SDK 完整安装
后端 `server/package.json dependencies` 中必须包含以下包并锁稳定版本：
1. `axios`（wxpay/push 通用 HTTP 客户端）
2. `@alicloud/dysmsapi20170525`（阿里云短信 Dysmsapi）
3. `@alicloud/openapi-client`（阿里云 OpenAPI 通用依赖，Dysmsapi 需要）
4. `tencentcloud-sdk-nodejs-sms`（腾讯云短信 SDK）
5. `alipay-sdk`（支付宝开放平台 Node SDK）
6. `ali-oss`（阿里云 OSS 存储 SDK）

> 不引入 sequelize：`config/database.js` 当前仍保留 MySQL 相关配置，但存储层实际走 `src/store/index.js` JSON Store；注释掉 database.js 的 `require('sequelize')`，并在 PROJECT.md 路线图中标明"Phase 8 切换 MySQL 时再启用"。

### FR-2 红包签到专区功能落地（后端闭环）
- 新增签到路由：`POST /wallet/sign-in`，登录需要；
- 幂等规则：同一用户 **自然日（UTC+8）** 最多签到 1 次；
- 奖励额度默认 10 💎（钻石），可在配置中心 app 模块加 `signInRewardDiamond`（默认 10）字段控制；
- 数据落地：
  - `models/SignIn.js`（id, userId, date(YYYY-MM-DD), rewardDiamond, createdAt）
  - 写入 Transaction（`type: reward`, `kind: signIn`, `delta: +钻石`, `balanceAfter`）
  - 回写 Wallet.diamond
- 返回：`{ reward, totalDays, balanceNow, alreadySigned: boolean }`；
- 兼容前端发现页 Tab 4 "红包签到"按钮调用：新增 `walletApi.signIn()` 封装 + `walletApi.signInStatus()`（获取今日是否已签 + 连续签到天数）。

### FR-3 精英付费 dev 直开路由修复
在 `server/src/routes/elite.js` 中新增 **只允许 NODE_ENV!=production** 的开发便捷路由：
- `POST /elite/dev/pay` 登录需要；
- 请求体：`{ channel: 'dev' }`（可选，若传必须等于 dev 才放行，其它抛 400）；
- 语义：模拟微信/支付宝支付成功，直接调用 EliteOrder 创建 + Wallet 扣 0 + 开通 isElite；
- 安全：`if (process.env.NODE_ENV === 'production') return fail(res, 'dev 模式在生产环境已禁用', 403)`；
- 代码兼容：对齐现有 EliteOrder 模型字段写入（priceFen=0, channel=dev, status='paid' 等）。

### FR-4 举报通道 3 类闭环（动态/组局/用户）
- 扩展 Feedback 模型字段：`postId`, `groupId`, `targetUserId`, `refType`（enum: `report_post` / `report_group` / `report_user`）；
- 扩展 Feedback TYPES 常量：兼容旧 bug/suggest/complaint/other，同时新增以上 3 类 report_*；
- 路由层 `POST /feedback` handler 从表单/JSON 接收以上字段；refType 合法时要求对应 ID 非空；
- 管理后台反馈管理 Tab 列表增加"举报目标类型/目标 ID"列；处理完成后可根据举报类型跳转对应动态/组局/用户管理页（后续可做按钮，第一期字段先落地 + 列表显示）。

### FR-5 管理后台 4 新 Tab API 封装 + 读接口补齐
- **admin/src/api/index.js** 增加 4 个模块：
  - `postsApi.list / audit / delete`
  - `groupsApi.list / delete`
  - `bannersApi.list / create / update / delete`
  - `eliteOrdersApi.list`
- **server/src/routes/admin.js** 补齐 GET 列表：
  - `GET /admin/posts`（支持分页、auditStatus 筛选、keyword 搜内容/昵称）
  - `GET /admin/groups`（支持分页、status 筛选、keyword 搜标题）
- 统一 `x-admin-token` 头走既有 adminAuth；路由 URL 前缀与其它 admin 子模块保持一致。

### FR-6 接口索引补齐
- `app/src/api/index.js` 中：
  - `settingsApi.notify(patch: { postNotify?: 0|1; groupNotify?: 0|1 })` → `POST /settings/notify`
  - `userApi.kefu()` → `GET /user/kefu`
- 已有 `eliteApi.devPay` 保持，等待 FR-3 路由真实实现后即不再 404。

### FR-7 重复路由 / 重复写接口收敛
- `routes/config.js`（旧 3 字段简单版）：保持挂载不动，保留旧 API 向后兼容，但配置中心页面（Settings.vue）已走 admin.js modules 版；在 routes/config.js 顶部加 deprecation 注释，指向 admin.js 版本。
- Banner 写接口：**保留 `routes/banners.js` 原生实现（含 adminAuth + 字段校验完整）**，在 admin.js 中把 banners 写接口改为 `require('../routes/banners').router` 复用同一逻辑，或删除 admin.js 中重复的 banners POST/PUT/DELETE 三段，避免两边字段子集不一致。采用"删除重复"策略更干净，若删除则不改变 URL 前缀（`/api/admin/banners` 由 banners.js 通过 `/api/admin` 子挂载实现）。

### FR-8 文档校正
- PROJECT.md 功能清单 #53 如在本次实现后已闭环则保持 ✅；未做部分保留 🚧 + 说明；
- 修正 #60 "仪表盘 4 新增指标"描述 → 改为"**仪表盘 5 新增指标**：动态数、组局数、Banner 数、精英付费人数、精英累计收入"；
- 新增"SDK 安装清单"小节到 PROJECT.md 五/本地开发下或 README 生产部署段，列出 6 SDK 及用途；
- README.md 同步更新安装命令，保证新同学按 README 跑一遍即能拿到完整依赖。

## 六、非功能需求（Non-Functional Requirements）

- **NFR-1 构建稳定性**：SDK 安装完成后 server 端 `npm test`（Jest）仍 100% 通过，不得有 "Cannot find module"。
- **NFR-2 生产可降级**：未配置 provider 时 SDK 包即使已安装也不触发调用；配置中心 enabled=false 时对应模块抛错提示与代码注释一致。
- **NFR-3 安全**：新字段写入一律走 express.json() / multer 已有的校验；不写明文密钥到日志。
- **NFR-4 性能**：红包签到两次调用必须幂等，不得并发产生 2 条签到记录（JSON Store 串行化 + 日期唯一约束）。
- **NFR-5 可维护性**：所有新增路由/API 方法命名与现有约定一致（`{module}Api.{verb}`、`router.METHOD(path, auth?, handler)`）；页面不写死 URL 字符串。
- **NFR-6 可读性**：新增代码在文件顶部注释"用途+对应 FR 编号"便于后续维护。

## 七、约束（Constraints）

- **技术约束**：后端 Node 18+ / npm；存储层 JSON Store（不升级 MySQL/Redis）。SDK 安装必须使用 `--save` 到 dependencies，不放到 devDependencies。不得删除 `server/src/config/database.js` 文件（仅注释 require 并加 Phase 8 说明）。
- **业务约束**：精英 devPay 路由 **NODE_ENV=production 必须禁用**，不能有条件泄露。签到奖励默认 10 钻石 / 日，不能改其它 Transaction 类型逻辑。
- **依赖约束**：SDK 版本使用 `^` 锁定稳定主版本（阿里云 SDK 用官方 ^2.x、腾讯短信用官方最新稳定、ali-oss 用 ^6.x、alipay-sdk 用最新 ^4.x、axios ^1.x 与 admin 端一致），并在安装后跑 `package.json` 验证版本范围。

## 八、假设（Assumptions）

- **A1**：用户网络能访问 npm registry（https://registry.npmjs.org 或国内镜像如 https://registry.npmmirror.com），安装 6 个 SDK 时不会网络失败；失败时可切镜像重试。
- **A2**：管理后台 Settings.vue 已可稳定调用 `/api/admin/config/modules` 接口与相关保存/测试/重置，无需再改 UI 即可对新增的 `signInRewardDiamond` 生效（前提：FIELD_LABELS + collectTemplate 已新增字段）。
- **A3**：JSON Store 的 SignIn 模型不需要复杂索引，以 `userId + date` 数组查询即可满足签到去重（日活 ≤ 10 万时性能可接受）。
- **A4**：举报通道的"处理后跳转目标管理页"属于管理后台视图层交互，第一期只需字段落地 + 列表显示关联 ID 与 refType，按钮跳转留作后续迭代（不影响生产可用判定）。

## 九、开放问题（Open Questions）

- [x] **Q1**：SDK 安装是否允许使用 npm 国内 npmmirror 镜像？→ 是，当默认 registry 安装失败时切换。
- [x] **Q2**：红包签到每日奖励默认值 10 钻石是否合理？→ 是，写进配置中心 app 模块 `signInRewardDiamond` 可改。
- [x] **Q3**：管理后台 Banner 写接口删除重复实现是否可行？→ 可行，保留 banners.js 的完整实现（包含启用状态/时间校验 + adminAuth），移除 admin.js 中 3 段重复的 POST/PUT/DELETE 并在 app.js 挂载 `/api/admin/banners` 指向 banners.js。
- [x] **Q4**：`sequelize` 包要不要装？→ 不装，JSON Store 是真实存储；注释掉 database.js 的 require + 加 Phase 8 说明。

---

## 十、验收标准（Acceptance Criteria）

### AC-1: 6 生产 SDK 已在 server/package.json dependencies 中声明并安装成功
- **Type**: `rule`
- **Given**: 干净环境（或新克隆仓库）下进入 `server/` 目录，执行 `npm install`（无网络错误）
- **When**: 执行 `node -e "['axios','@alicloud/dysmsapi20170525','@alicloud/openapi-client','tencentcloud-sdk-nodejs-sms','alipay-sdk','ali-oss'].forEach(m=>{try{require.resolve(m);console.log('OK',m)}catch(e){console.log('MISSING',m,e.code)}})"`
- **Then**: 6 条全部打印 `OK <包名>`，零 `MISSING`。
- **Pass Condition**: 6/6 OK；并且 `cat server/package.json` 的 dependencies 中 6 个包都存在且版本带 `^`。
- **Evidence**: 命令 stdout + package.json 文件摘录。

### AC-2: database.js 未再 require('sequelize')，server 端启动不报 Cannot find module 'sequelize'
- **Type**: `rule`
- **Given**: 执行 `npm install` 后没有装 sequelize
- **When**: `node src/app.js` 启动 10 秒后请求 `GET /api/health`
- **Then**: 启动日志不出现 sequelize 相关错误；`/api/health` 返回 200 `{status:"ok"}`
- **Pass Condition**: 日志 grep `sequelize` 0 次命中错误 + health 200
- **Evidence**: 启动日志尾部 + curl 响应

### AC-3: 红包签到功能闭环
- **Type**: `rule`
- **Given**: 已有 JWT token 登录用户 13800000001（或 Jest 辅助生成 token），余额清零后
- **When**:
  1) `POST /api/wallet/sign-in` 第 1 次 → 200 + reward=10；
  2) 连续 `POST /api/wallet/sign-in` 第 2 次 → 返回 alreadySigned=true，reward=0，钱包不再加钻；
  3) `GET /api/wallet/sign-in/status` → 今日已签 = true，连续天数 >=1；
  4) 交易记录 `GET /api/wallet/transactions` 列表内含有 1 条 type=reward kind=signIn 的 +10 流水。
- **Then**: 以上 4 步全部满足；并发双次 POST 不会产生两条 Transaction。
- **Pass Condition**: 4 步全通过 + 幂等性实证（并发测试只 1 条 reward 流水）
- **Evidence**: curl/node 脚本命令 + 结果日志

### AC-4: 精英 devPay 404 修复 & 生产禁用
- **Type**: `rule`
- **Given**: 正常 JWT 用户，后端运行 `NODE_ENV=development`
- **When**:
  1) `POST /api/elite/dev/pay` → 200 且用户 isElite=true，EliteOrder 新增 1 条 channel=dev；
  2) 临时以 `NODE_ENV=production` 重启后端，再次 POST → **403** 返回"dev 模式已禁用"类文案；
- **Then**: 两步结果符合；回切 NODE_ENV=development 后不影响其它接口。
- **Pass Condition**: 第 1 步 200 + isElite=true；第 2 步 403
- **Evidence**: 两组请求的 statusCode + 用户 isElite 字段快照 + EliteOrder 记录

### AC-5: 举报通道 3 类关联字段落地并可查询
- **Type**: `rule`
- **Given**: 管理后台登录拿到 x-admin-token；已存在 postId=1 动态 / groupId=1 组局 / targetUserId=5 用户
- **When**: 分别以 report_post/report_group/report_user 为 refType 发 3 条 POST /api/feedback；
- **Then**:
  1) 每条反馈存储里都有对应字段（postId≠空 / groupId≠空 / targetUserId≠空）；
  2) `GET /api/admin/feedbacks?refType=report_post` 只返回举报动态的反馈；
  3) 管理后台反馈管理页列表展示 refType + 目标 ID 两列（由前端模板渲染时新增列）。
- **Pass Condition**: 3 条数据字段全部非空 + 筛选分页正确 + 前端列展示
- **Evidence**: 反馈 JSON 文件内容切片 + 管理后台页面截图或 HTML 字段存在性

### AC-6: 管理后台 4 新 Tab API 封装 + 列表读接口 100% 存在
- **Type**: `rule`
- **Given**: 管理后台已登录；Post/Group/Banner/EliteOrder 各有至少 1 条数据
- **When**: 逐个触发 4 个 Tab 视图页面生命周期发起的请求；以及手动请求 `GET /api/admin/posts?page=1&pageSize=20` / `GET /api/admin/groups?page=1`
- **Then**:
  1) `admin/src/api/index.js` 中 postsApi / groupsApi / bannersApi / eliteOrdersApi 四个对象都存在，方法命名符合 FR-5；
  2) 4 个新 Tab 列表页面加载时 HTTP 200 不再报 404/无封装；
  3) GET /admin/posts / GET /admin/groups 返回分页结构 `{code:0,data:{list:[],pagination:{...}}}`。
- **Pass Condition**: 3 点都通过
- **Evidence**: `admin/src/api/index.js` 源码片段 + 4 个 URL 请求 status 200 + 分页 JSON 截图

### AC-7: 接口索引 settingsApi.notify + userApi.kefu 存在且可调用
- **Type**: `rule`
- **Given**: 已登录移动端用户
- **When**: 代码内调用 `settingsApi.notify({postNotify:1,groupNotify:0})` 和 `userApi.kefu()`
- **Then**:
  1) 两方法均真实存在于 app/src/api/index.js 导出对象，不 throw "is not a function"；
  2) 请求 URL 与后端真实路由匹配（notify → POST settings/notify 200；kefu → GET user/kefu 200 返回客服微信字段）。
- **Pass Condition**: 存在且 200
- **Evidence**: 源码方法定义处行号 + 调用返回体

### AC-8: Banner/Config 重复写接口清理完成无 404/双写竞争
- **Type**: `rule`
- **Given**: 管理后台登录；现有 2 张默认 Banner
- **When**: 通过 Settings.vue 保存配置 → 再到 Banner 管理页执行"新建 Banner → 修改 → 删除"
- **Then**:
  1) 保存配置后 `/api/admin/config/modules` 返回 data 与保存值一致（没有"config.js 版本有/ admin 版本没有"的不一致）；
  2) Banner 的新建 / 修改 / 删除 操作只触发 banners.js 单一逻辑（代码中不存在两份重复的写 handler）；任意写操作后 banners.js 的 GET 列表 /admin/list 能反映最新值。
- **Pass Condition**: 2 点都通过
- **Evidence**: Settings.vue 保存→读取一致性验证；Banners.vue 三操作网络面板截图

### AC-9: PROJECT.md 61 条功能清单与代码实证一致
- **Type**: `rule`
- **Given**: Spec 完成后对照 PROJECT.md "核心功能清单"逐行实证
- **When**: 再次跑缺口审计工具（脚本），对 #53, #52, #46, #54, #59, #60, #31, #58 等项重新验证
- **Then**:
  1) PROJECT.md 中 ✅ 的条目对应代码有接口 / 视图 / 数据模型实证；
  2) 若静态占位则标记为 🚧 + 注释，不出现"文档✅ 代码❌"；
  3) 本地 / 生产部署说明中列出 6 SDK 安装清单。
- **Pass Condition**: 缺口审计报告中 unverifiedFeatures 全部清零（所有条目实证通过）
- **Evidence**: 新版 gap-audit.json（unverifiedFeatures=[]）+ PROJECT.md 变更 diff

### AC-10: 生产功能整体质量（体验一致性/代码可读性/闭环）
- **Type**: `rubric`
- **Dimension**: "三端整体生产就绪度（用户手感/后台可管/接口闭环）"
- **Scale**: 1-5
  - 1 = 大量 404 / 空壳，文档与代码严重不一致；
  - 3 = 核心接口 80% 可用，但管理后台 4 Tab 有缺失；SDK 部分未装；
  - 5 = SDK 6/6 全装；#46, #52, #53, #54, #57, #58, #59 全部接口实证通过 + 文档对得上；用户从首页→发现→签到→举报→后台处理流程一条线 0 阻断。
- **Pass Threshold**: >= 4
- **Evidence**: 端到端人工巡检脚本（或视频/截图）结果

### AC-11: 回归测试（单元 + E2E 冒烟）全绿
- **Type**: `rule`
- **Given**: `cd server && npm install` 已完成；`NODE_ENV=test`
- **When**: `npm test`（Jest 8 套件）+ E2E 冒烟（至少覆盖新增签到 / 精英 devPay / 反馈举报 / 管理后台 4 Tab 列表接口 4 用例）
- **Then**: Jest 套件 100% 通过（不得有 fail）；E2E 至少 12 个新增 case 全通过。
- **Pass Condition**: Jest all passed + E2E added case all passed
- **Evidence**: `npm test` 终端输出 + E2E 报告尾部

---

## 十一、与上一 Spec 的关系

本 Spec 是 `spec-20260828-baiye-rebrand-feature-boost` 的**Phase 7 上线前收尾**，不回退该 Spec 已完成的 61 条功能/文档交付中的任何一条；仅针对缺口审计出的空壳做补强。
