# AGENTS.md — 白夜项目 AI 交接入口

> 给下一位 AI 同事的快速入口。完整交接文档见 `docs/HANDOVER.md`。

## 项目一句话

白夜 (BaiYe) — 聊天送礼社交平台。uni-app 三端 (H5/小程序/App) + Express 后端 + Vue 3 管理后台 + 腾讯 IM 聊天 + 聊天内送礼系统。线上运行中：https://zyb001.cn

## 技术栈

| 层 | 技术 |
|---|---|
| 移动端 | uni-app (Vue 3 + Vite) + 腾讯 TUIKit (chat-uikit-uniapp 3.2.0) |
| 后端 | Express + Sequelize/MySQL + Redis + WebSocket |
| 管理后台 | Vue 3 + Element Plus |
| 部署 | Docker Compose (6 容器) + GitHub Actions CI/CD |
| 服务器 | 阿里云 ECS 114.55.225.77 / Aliyun Linux 3 |
| 域名 | zyb001.cn (Let's Encrypt SSL) |

## 目录结构

```
companion-play-app/
├── app/           # uni-app 移动端 (Vue 3)
├── server/        # 后端 API (Express)
├── admin/         # 管理后台 (Vue 3 + Element Plus)
├── deploy/        # Nginx + 部署脚本 + 证书
├── docs/          # 项目文档 (HANDOVER.md 在此)
├── scripts/       # 工具脚本
├── sucai/         # 项目素材图片
├── assets/        # 头像/登录页素材
├── docker-compose.yml
└── .trae/rules/deployment.md  # 部署规则 (必读)
```

## 快速启动

```bash
# 后端
cd server && npm install && npm run seed && npm run dev

# 管理后台
cd admin && npm install && npm run dev

# 用户端 H5
cd app && npm install && npm run dev:h5
```

## 关键架构

### 聊天双模

- **主通道**: 官方 TUIKit (TUIChat + TUIConversation)
- **兜底**: 自建 Socket.IO (chatSocket.js)
- **数据流**: DB (/chat/*) 为准 → IM v4 REST 桥接腾讯 IM 云
- **关键文件**: `app/src/utils/tuilogin.js`, `app/src/utils/msgNotify.js`, `app/src/utils/chatSocket.js`

### 礼物系统 (核心业务)

- **送礼**: POST /api/gifts/send → 事务(扣钻→加收入→创建GiftRecord→创建Message) → WS广播 → IM转发
- **动画**: GiftAnimation 组件，4级效果 (L0无/L1小飘/L2横幅/L3全屏)
- **经济**: 钻石(充值) → 送礼消耗 → 收礼获 giftIncome(分) → 提现（需先绑定收款账号）
- **收款绑定**: 提现前必须绑定支付宝/微信收款账号+二维码，换绑需短信验证（payment_bind）
- **关键文件**: `server/src/routes/gifts.js`, `app/src/components/GiftPanel.vue`, `app/src/components/GiftAnimation.vue`, `app/src/pages/withdraw/payment-bind.vue`

详见 `docs/HANDOVER.md` 第三/三½节。

## 已知坑点 (必读)

1. **部署禁止 `set -eu -o pipefail` 和 `docker compose down`** — 见 `.trae/rules/deployment.md`
2. **Lite SDK totalUnreadCount 不可靠** — 用 conversationList 求和代替
3. **H5 端 uni 路由 API 缺失** — 修复在 `app/src/main.js` 的 `_tuiPolyfillUni()`，必须用 `window.uni` 而非 `uni`
4. **v4 REST identifier 必须是管理员账号** — 否则报 60010
5. **cloudSecretId/Key 未配置** — 不要用 TC3 云 API，v4 REST 是可用路径
6. **APK 需 HBuilderX 本地打包** — TUIKit 需本地编译
7. **giftIncome 单位为分** — API/存储用分，UI ÷100 显示元
8. **im-sync 跳过自定义消息** — 防止礼物消息双写入
9. **管理后台数据解包** — `admin/src/api/http.js` 返回 `{ code, message, data }` 信封，页面必须用 `r.data?.list || r.data` 提取数据，不能直接 `r.list || r`
10. **admin vite @ 别名** — `admin/vite.config.js` 已配置 `@` → `src` 别名，新增页面可用 `@/api` 等导入路径
11. **提现需绑定收款账号** — 用户提现前必须绑定支付宝/微信收款账号（含二维码），换绑需短信验证（场景 payment_bind）
12. **Banner 管理 API 路径** — admin 前端调 `/banners/admin/list` 和 `/banners/admin/banners`，走 `/api/banners` 挂载点下的 admin 路由
13. **H5 事件 API polyfill 必须委托原生 Emitter** — `main.js` 补齐 `window.uni.$emit/$on/$off` 时只能赋值 `@dcloudio/uni-h5` 导出的同名函数，禁止自建闭包总线：vite-plugin-uni 会把组件里的 `uni.$on` 编译成原生独立函数，两条总线互不相通，礼物动画等跨组件事件会静默丢失
14. **礼物特效触发规则（TUIChat）** — 消息列表 watcher 只播「进入会话后新到达（`msg.time > baselineMsgTime`）且 `flow === 'in'`」的礼物消息；自己送出的礼物由送礼面板 `uni.$emit('gift-animation')` 直接播。两个易错点：① 去重键必须用 `msg.ID`（大写），SDK 没有 `msg.id`，用错会让 `undefined` 污染 Set 从而永久吞掉后续所有礼物消息；② 基线必须在会话打开时取 `conversation.lastMessage.lastTime`，不能在 watcher 里惰性取「首次非空列表的最新 time」——空会话的首次非空列表就是那条实时消息本身，基线会被设成它自己而把它当历史吞掉。少了基线会重放历史特效，少了 flow 判断发送方会连播两次（GiftAnimation 队列无去重）
15. **IM v4 REST 自定义消息 Data 不能 Base64** — `sendIMC2CCustomV4` 的 `MsgContent.Data` 必须传原始 JSON 字符串，REST 会原样投递给接收端 SDK 的 `payload.data`。若做 Base64，接收端 `JSON.parse` 失败，礼物消息会退化成「[自定义消息]」——既不渲染礼物卡片也不触发特效
16. **静态资源只能放 `app/src/static/`，路径用绝对 `/static/...`** — Vite 的 `app/public/`（构建后落到 `/assets/`）是 **H5 专用**，uni-app App 端只打包 `src/static/`。礼物特效图曾长期写成 `/assets/gift-effect-*.png`，而该文件从未存在于 `public/`，线上全部 404，全屏特效背景图**从未真正显示过**（H5 和 App 双端）。种子数据在 `server/src/seed.js` 的 `DEFAULT_GIFTS`，`upgradeGifts()` 会把 `imageUrl`/`effectImage`/`sort`/`animationLevel` 同步到已有行，改完路径需在服务器跑一次 seed 才生效
17. **App 逻辑层没有 `window`/`document`/`localStorage`** — uni-app App 端 JS 跑在 JSCore(iOS)/V8(Android)，页面才在 WebView 里。任何未加守卫的浏览器全局都是 ReferenceError：`invite.vue` 的「复制邀请链接」和微信分享 `href` 曾直接读 `window.location.origin`，在 App 端点击即静默失效（分享根本调不起来）。站点源要从 `getCurrentBaseURL()` 去掉 `/api` 推导，H5 才用 `window.location.origin`，且必须包在 `typeof window !== 'undefined'` + `#ifdef H5` 里
18. **iOS 的 CSS 能力由系统版本决定，不由 deploymentTarget 决定** — App 端页面渲染在 WKWebView，其内核版本等于设备 iOS 版本；`deploymentTarget` 只是「低于此版本的设备装不上」。业务代码有 224 处 flex `gap`（Safari 14.1+）和 2 处 `aspect-ratio`（Safari 15+），逐处改写不现实，因此 `manifest.json` 的 `deploymentTarget` 已从 13.0 抬到 **15.0**。另：`backdrop-filter` 在 iOS 15.4 前只认 `-webkit-` 前缀；`height:100vh` 配 `overflow:hidden` 在 iOS Safari 会裁掉底部内容，要补 `height:100dvh`（参照 `home.vue` / `chat.vue`）。新增样式若用到更新的 CSS 特性，先确认 iOS 15.0 的 WKWebView 支持

## 服务器信息

| 项 | 值 |
|---|---|
| IP | 114.55.225.77 |
| SSH | root@114.55.225.77 (密钥: `~/.ssh/tongcheng.pem`) |
| 部署目录 | /opt/baiye |
| MySQL | Baiye@2024! (DB: companion_play) |
| Redis | BaiyeRedis2026! |
| 管理员 | admin / admin123 |
| IM sdkAppId | 1600159799 |

## 待办事项

1. Android APK 打包 (HBuilderX 本地)
2. 配置中心填写真实密钥 (短信/支付/OSS/推送)
3. 钻石充值接入微信/支付宝支付
4. 礼物素材正式设计 (当前 emoji 占位)
5. 会话列表深色主题适配
6. **`diamondAmount` 字段语义不一致** — `gifts.js` 写入消息体的 `giftContent.diamondAmount` 是**单价** (`gift.price`)，而 API 响应 / WS 广播里的 `diamondAmount` 是**总价** (`totalDiamond`)。多件礼物时聊天卡片显示单价且不显示数量（如送 2 个游艇、实付 2000，卡片显示「游艇 💎 1000」）。需先决定以哪个为准，再统一两端并让卡片显示数量
7. **会话列表礼物摘要显示「[自定义消息]」** — Lite SDK 的 `conversation.lastMessage.messageForShow` 不取 `TIMCustomElem.Desc`（服务端已传 `送出了N个XX`，无效）。需在会话列表摘要渲染处按 `businessID === 'gift'` 自行映射为「[礼物] XX」
8. **清理礼物特效验证期间的测试数据** — `gift_records` 43-46（20→23 一条、13→23 三条）及对应 `messages` 245-248；用户 13/20 钱包被充值（现余 500/1500）；用户 23 的 `gift_income`(3783570 分) 与 `charm_value`(54051) 含测试污染。IM 云端消息无法通过 REST 删除，会残留在会话里
9. **TUIKit 首屏偶发空白竞态** — 容器重建后首次加载偶发 `Error in event handler for sdkStateReady: e.chat.getConversationList is not a function`，聊天页停在约 75 个 DOM 元素不渲染，再刷新一次即恢复。属引擎内部时序问题，与业务代码无关，尚未修复

## 文档索引

| 文件 | 说明 |
|---|---|
| `CONTEXT.md` | **领域模型术语表 (必读)** — 项目概念定义，零实现细节 |
| `docs/HANDOVER.md` | **完整交接文档 (必读)** |
| `docs/PROJECT.md` | 详细项目文档 |
| `docs/BRAND-REFERENCE.md` | 品牌规范 |
| `docs/adr/` | **架构决策记录** — 重大技术决策的背景、方案、后果 |
| `.trae/rules/deployment.md` | 部署规则 v3.0 |

---

## 工程纪律 (Engineering Discipline)

> 借鉴 mattpocock/skills 的工程实践，适配白夜项目。

### 领域建模

开始任何功能开发前，先读 `CONTEXT.md` 确认术语理解一致。

如果发现代码与术语冲突，或发现新的歧义：
1. 立即指出："代码里 X 做的是 A，但 CONTEXT.md 定义 X 是 B，哪个对？"
2. 解决后更新 `CONTEXT.md`，保持术语与代码一致

### 调试纪律 (Debugging Discipline)

遇到复杂 Bug 时，遵循 6 阶段流程，禁止跳过：

**Phase 1: 建立反馈循环**
- 先建一个能稳定复现 Bug 的 tight loop（测试/curl/浏览器脚本）
- 要求：秒级执行、确定性、能捕捉具体症状
- **禁止**：没有复现命令就开始猜原因

**Phase 2: 复现 + 最小化**
- 运行 loop，确认是用户描述的 Bug（不是附近的另一个问题）
- 逐步裁剪输入/步骤，直到每个元素都不可或缺

**Phase 3: 假设**
- 生成 3-5 个排名假设，每个必须可证伪
- 格式："如果 X 是原因，那么做 Y 会让 Bug 消失/恶化"
- 向用户展示排名，等待确认（除非用户 AFK）

**Phase 4: 探测**
- 每个探测对应一个假设，一次只改一个变量
- 调试日志加唯一前缀 `[DEBUG-a4f2]`，结束时统一清理

**Phase 5: 修复 + 回归测试**
- 在正确的 seam（测试边界）写回归测试
- 先写失败测试 → 修复 → 确认通过 → 重跑原始 loop

**Phase 6: 清理**
- 原始 Bug 不再复现
- 所有 `[DEBUG-...]` 日志已删除
- 正确的假设写入 commit message

### 代码审查清单 (Code Review Checklist)

提交代码前，自检两个维度：

**维度 1: 标准 (Standards)**
- [ ] 符合项目编码规范（Vue 3 Composition API、Express 分层、Sequelize 模型）
- [ ] 无 Fowler 代码异味：神秘命名、重复代码、特性依恋、数据泥团、基本类型偏执
- [ ] 管理后台数据解包正确（`r.data?.list || r.data`）
- [ ] 金额计算用整数（分），无浮点运算
- [ ] H5 端用 `window.uni` 而非 `uni`

**维度 2: 需求 (Spec)**
- [ ] 实现了需求要求的所有功能点
- [ ] 没有实现需求没要求的功能（防止范围蔓延）
- [ ] 边界情况已处理（空数据、网络失败、权限不足）

### 交接协议 (Handoff Protocol)

会话结束前，如果工作未完成或下一个会话需要接续：

1. **更新 AGENTS.md 待办事项**：添加下一步具体任务
2. **更新相关 ADR**：如果做了新的架构决策，写入 `docs/adr/`
3. **更新 CONTEXT.md**：如果引入了新术语或澄清了歧义
4. **提交代码**：确保所有变更已 commit + push
5. **部署验证**：如果是用户端变更，部署后浏览器实测

交接文档应包含：
- 本次做了什么（一句话）
- 下一步是什么（具体任务）
- 需要注意的坑（如果有）

---

*最后更新: 2026-09-06*
