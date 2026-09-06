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
- **动画**: GiftAnimation 组件，4级效果 (L0无/L1小飘/L2横幅/L3全屏)；L1-L3 播放 SVGA 矢量动画（`SvgaStage` 用 renderjs），加载失败自动降级为 CSS 特效，小程序端不支持 renderjs 恒走 CSS
- **经济**: 钻石(充值) → 送礼消耗 → 收礼获 giftIncome(分) → 提现（需先绑定收款账号）
- **收款绑定**: 提现前必须绑定支付宝/微信收款账号+二维码，换绑需短信验证（payment_bind）
- **关键文件**: `server/src/routes/gifts.js`, `app/src/components/GiftPanel.vue`, `app/src/components/GiftAnimation.vue`, `app/src/components/SvgaStage.vue`, `app/src/pages/withdraw/payment-bind.vue`

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
14. **礼物特效触发规则（每条只播一次）** — 播放记录持久化在 `app/src/utils/giftAnimPlayed.js`（localStorage，按用户 ID 隔离，上限 200 条），内存 Set 扛不住刷新/切会话/重启。TUIChat 消息列表 watcher 分两类处理：**实时到达**（`msg.time > baselineMsgTime`）逐条播；**历史消息**（`<= 基线`）每次会话打开只补播「最新一条」，其余只登记不播——这样接收方离线期间收到的礼物会在首次打开会话时看到一次、之后不再重复，也不会在首屏炸出整屏历史特效。`flow === 'out'` 只登记不播，自己送出的礼物由送礼面板 `uni.$emit('gift-animation')` 在**扣费成功后立刻**播（别放到 `await sendCustomMessage()` 之后，否则发送方要等好几秒才看到动画）。三个易错点：① 去重键必须用 `msg.ID`（大写），SDK 没有 `msg.id`，用错会让 `undefined` 污染集合从而永久吞掉后续所有礼物消息；② 基线在会话打开时取 `conversation.lastMessage.lastTime`，**缺失时用 `Date.now()/1000` 兜底**——基线为 0 会把整屏历史当成实时消息批量播放；也不能在 watcher 里惰性取「首次非空列表的最新 time」，空会话的首次非空列表就是那条实时消息本身，基线会被设成它自己而把它当历史吞掉；③ 兜底路径 `pages/chat/chat.vue` 用 `db:<消息id>` 做键共享同一份记录，实时走 socket `message`、历史走 `catchupGiftEffects()`，且礼物卡片**已去掉点击重播**（与「只播一次」冲突）。另：`markGiftPlayed` 必须在确认能播出去之后调用，动画层未就绪时先不登记，否则那条特效会被永久吞掉
15. **IM v4 REST 自定义消息 Data 不能 Base64** — `sendIMC2CCustomV4` 的 `MsgContent.Data` 必须传原始 JSON 字符串，REST 会原样投递给接收端 SDK 的 `payload.data`。若做 Base64，接收端 `JSON.parse` 失败，礼物消息会退化成「[自定义消息]」——既不渲染礼物卡片也不触发特效
16. **静态资源只能放 `app/src/static/`，路径用绝对 `/static/...`** — Vite 的 `app/public/`（构建后落到 `/assets/`）是 **H5 专用**，uni-app App 端只打包 `src/static/`。礼物特效图曾长期写成 `/assets/gift-effect-*.png`，而该文件从未存在于 `public/`，线上全部 404，全屏特效背景图**从未真正显示过**（H5 和 App 双端）。种子数据在 `server/src/seed.js` 的 `DEFAULT_GIFTS`，但**生产库改路径不要跑 seed**：`ensureGifts`/`upgradeGifts` 都按 `name` 匹配，改名后会新建重复行（2026-09-07 线上礼物表因此从 16 行涨到 30 行，见坑点 20 与 ADR-0005）。生产改素材路径的正确姿势是按 `id`/`sort` 定向 `UPDATE gifts SET image_url=..., effect_image=...`
17. **App 逻辑层没有 `window`/`document`/`localStorage`** — uni-app App 端 JS 跑在 JSCore(iOS)/V8(Android)，页面才在 WebView 里。任何未加守卫的浏览器全局都是 ReferenceError：`invite.vue` 的「复制邀请链接」和微信分享 `href` 曾直接读 `window.location.origin`，在 App 端点击即静默失效（分享根本调不起来）。站点源要从 `getCurrentBaseURL()` 去掉 `/api` 推导，H5 才用 `window.location.origin`，且必须包在 `typeof window !== 'undefined'` + `#ifdef H5` 里
18. **iOS 的 CSS 能力由系统版本决定，不由 deploymentTarget 决定** — App 端页面渲染在 WKWebView，其内核版本等于设备 iOS 版本；`deploymentTarget` 只是「低于此版本的设备装不上」。业务代码有 224 处 flex `gap`（Safari 14.1+）和 2 处 `aspect-ratio`（Safari 15+），逐处改写不现实，因此 `manifest.json` 的 `deploymentTarget` 已从 13.0 抬到 **15.0**。另：`backdrop-filter` 在 iOS 15.4 前只认 `-webkit-` 前缀；`height:100vh` 配 `overflow:hidden` 在 iOS Safari 会裁掉底部内容，要补 `height:100dvh`（参照 `home.vue` / `chat.vue`）。新增样式若用到更新的 CSS 特性，先确认 iOS 15.0 的 WKWebView 支持
19. **接收 renderjs 回调的组件必须用 Options API** — `ownerInstance.callMethod(name, args)` 的实现是 `this.$vm[name]`（见 `@dcloudio/uni-h5/dist/uni-h5.es.js:1455`），而 Vue 3 `<script setup>` + `defineExpose` 把方法挂在 `instance.exposed` 代理上、**不在 `$vm` 上**，于是视图层回调静默丢失：SVGA 播完了逻辑层收不到，动画层只能靠兜底定时器才消失。`SvgaStage.vue` 因此刻意写成 Options API `methods`，与项目主流的 `<script setup>` 风格不一致，**不要"顺手统一风格"改回去**。另外 renderjs 的 `change:prop` 靠值变化触发，绑定的 prop 要先给空值、`mounted` + `$nextTick` 再填真值，否则首次同步不派发
20. **部署曾经等于改生产数据：boot seed 已默认关闭** — `server/Dockerfile` 的 ENTRYPOINT 原本每次容器启动都跑完整 `node src/seed.js`，而每次部署都会重建 server 容器，等于**每次部署都在直接写生产库**。2026-09-07 礼物改名后部署，`upgradeGifts()` 按 name 匹配不到旧行 → 新建 14 行，线上礼物表从 16 涨到 30 行。现已改为 `SEED_ON_BOOT` 开关控制、compose 里默认 `false`（见 ADR-0005）。建表不依赖 seed —— `app.js:178` 自己会调 `db.bootstrap()`（alter 模式）。新环境首次部署需在 `.env` 显式设 `SEED_ON_BOOT=true` 启动一次。注意「CI 不执行 seed」这个旧认知是错的：seed 不在 workflow 里，藏在 Dockerfile 里
21. **SVGA 播放时特效层里只能有 `<SvgaStage>`** — `GiftAnimation.vue` 的 `.gift-banner`（内含礼物图标 `<image class="gift-banner-img">`）、`.gift-center`（内含 `<image class="gift-center-img">`）、`.gift-bottom-banner` 三个层必须都带 `!current.effectSvga` 条件。它们原先只按 `current.level` 门控，结果两张静态礼物图标（z-index 10）直接压在真实矢量动画（z-index 2）上面——用户在 H5 看到的「图片加粒子」就是这个，不是 SVGA 没生效。注意这些 CSS 层**不能删**：小程序端没有 renderjs（`SVGA_SUPPORTED` 恒 false）、H5/App 端 SVGA 下载或解码失败时 `onSvgaFail` 会把 `effectSvga`/`effectImage` 清空，两条路径都靠它们降级出特效
22. **H5 整页可左右滑动 = `width:100%` + 横向 padding + 没有全局 `box-sizing` 重置** — 项目**从未**做过 `* { box-sizing: border-box }` 全局重置（TUIKit 的 `common.scss` 也没有，只单独给 `.chat-aside` 加过），所以默认是 `content-box`。而 uni-app H5 给两个标签的默认宽度是**不对称**的：`uni-scroll-view` 是 `width: 100%`，`uni-view` 是 `width: auto`。于是只要 `<scroll-view>` 自己带横向 padding，实际渲染宽度就是 `100% + 2×padding` → 溢出；普通 `<view>` 因为是 auto 宽度会自己减掉 padding，反而没事。第二类触发条件是**任何元素显式写了 `width: 100%` 又带横向 padding**（底部弹层、输入框、`position:fixed` 菜单都中招）。
    - **为什么只在电脑浏览器上被注意到**：rpx 按 `viewportWidth/750` 缩放，`$by-page-pad-x: 32rpx` 在 vw 524 时是 22.36px（溢出 45px），在 1920px 宽屏上是 81.9px（溢出 164px）——溢出量随视口线性放大，手机上不易察觉，桌面端一滑就滑出去。
    - **2026-09-07 已修的 9 处**（均为在规则首行补 `box-sizing: border-box`）：`pages/profile/profile.vue .content-scroll`、`pages/transactions/transactions.vue .type-bar`、`components/GiftPanel.vue .gift-panel-body`、`TUIKit/.../message-input-gift.vue .gift-scroll`、`pages/chat/chat.vue .more-menu`、`pages/gift-shop/gift-shop.vue .detail-sheet` 与 `.detail-hint`、`pages/withdraw/payment-bind.vue .field-input`、`TUIKit/.../message-input/index.vue .more-menu`。注意 `pages/chat/chat.vue .msg-scroll` **更早就被手工补过**同一行——说明这是一类反复出现的坑，不是一次性笔误。
    - **已确认安全、不要再改**：`profile-edit.vue .picker-sheet`（横向 padding 是 0）、`TUIContact/contact-search .tui-contact-search-main`（自身无横向 padding，且本项目根本没挂载 TUIContact）、`simple-message-list .header-container`（只在「合并转发记录」抽屉里 `position:absolute` 渲染，冷门路径）、以及 `home.vue .scroll/.online-scroll`、`discover.vue .by-tabs-scroll`、`search.vue .tabs-scroll`、`follow-list.vue .user-list`、`chat-list.vue .session-scroll`（padding 都在内层子元素上）。
    - **根治方案与为什么还没做**：正解是在 `App.vue` 或全局样式里加 `view, scroll-view, text, image, input, textarea, button { box-sizing: border-box }`。没做的原因是它会重排约 40 个页面，而本会话**截图工具不可用**（标签页 `visibilityState=hidden`，`take_screenshot` 报 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`），无法逐页视觉验证，风险大于收益。**若后续有可截图的环境，建议把全局重置作为独立任务推进，然后把这 10 行零散补丁收回去。**
    - **排查方法**（不依赖截图）：在浏览器里比 `document.documentElement.scrollWidth` 与 `clientWidth`，差值 > 0 就是横向溢出；再沿 `elementFromPoint` / 父链逐个比 `getBoundingClientRect().right`，第一个超过 `clientWidth` 的就是元凶。注意要用 `documentElement.clientWidth`（不含滚动条）而不是 `window.innerWidth`——实测两者差 15px 正好是一条纵向滚动条，用它算会把结论带偏。另外 `.uni-tabbar-bottom` 被 uni-app 故意停在屏幕外（`position:fixed; top:618px; bottom:-50px`），真正可见的是 `.uni-tabbar`，**它不是溢出源，别去动它**。
    - **诊断校正：不是每一处溢出都会让「整页可左右滑动」** — 按 CSS Overflow 规范，`position: fixed` 的盒子**不计入**文档的 scrollable overflow region。所以 `.more-menu`（在 `position:fixed; inset:0` 的 mask 里）、`.gift-panel-body`、`.gift-scroll`、`.detail-sheet` 这几处溢出表现为**弹层右侧被视口裁切**（圆角/最后一个按钮切掉），而不会产生横向滚动条。真正造成用户报告的「个人页可以左右滑动」的只有两处：普通文档流里的 `.content-scroll` 和 `position: sticky` 的 `.type-bar`（sticky 计入 overflow）。**别把「页面能左右滑」当成所有 9 处的共同症状，否则会因为「弹层没导致滑动」而误判修复无效。**
    - **线上实测证据（2026-09-07，部署 `8c42a5e` 后，H5 生产站 https://zyb001.cn，视口 524px）** — 9 处全部逐个打开并用 `getBoundingClientRect()` 量过，每页 `scrollWidth - clientWidth` 均为 **0**：
      | 位置 | 修复后宽度 | 右边界 | 修复前推算 |
      |---|---|---|---|
      | `profile .content-scroll` | 508.8px（padding 21.7×2 已内含） | 508.8 ≤ 509 | 553.5 → **溢出 45px**（实测过） |
      | `transactions .type-bar` | 508.8px，computed `border-box` | 508.8 | 552.2 |
      | `chat.vue .more-menu` | 508.8px，3 个菜单项 | 508.8 | 541.4 |
      | `gift-shop .detail-sheet` | 508.8px | 508.8 | 552.2 |
      | `gift-shop .detail-hint` | 465.4px，left 21.7 / right 487.1（正好内嵌父内容区） | — | 503.4（撑破父级） |
      | `payment-bind .field-input` | 422px，left 43.4 / right 465.4（内嵌 `.form-card` 内容区） | — | 460（撑破卡片） |
      | `chat.vue .gift-panel-body` | 508.8px，16 个礼物已渲染 | 508.8 | 540.8 |
      | `TUIKit .gift-scroll` | 524px，16 个礼物格 | 524 | 548 |
      | `TUIKit .more-menu` | 524px，3 个菜单项 | 524 | 556 |

      两个测量细节：① `.form-card` 自身仍是 `content-box` 但**没有**显式 `width:100%`（它是 auto 宽度的 `uni-view`），所以自己算出 465.4 = 508.8 − 2×21.7，正确——这正好反证了「触发条件是 `width:100%` 或 scroll-view，不是 padding 本身」。② TUIChat 页没有纵向滚动条，`clientWidth` 从 509 变回 524，再次印证那 15px 就是滚动条。
      另：**裸改 `location.hash` 跳 TUIChat 会报「会话参数缺失」**（`pages/chat/chat.vue:713` 的 toast，不是 TUIChat 自己的），必须整页重载 `?v=xxx#/TUIKit/components/TUIChat/index?conversationID=C2C25` 让 uni 路由在启动时解析 query；`window.uni.navigateTo` 在已加载文档里也带不进参数。

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
2. **配置中心密钥：短信/OSS/IM 已配好，剩支付与推送** — 2026-09-07 核对生产 `configs` 表：`sms` 5/7 项有值（provider/accessKeyId/accessKeySecret/signName/templateCode，空的 templateLogin/templateRegister 是可选覆盖）、`oss` 5/7、`im` 6/8 均已配置；**未配**的是 `wxpay` 1/8、`alipay` 2/6、`push` 1/6。⚠️ 别再把「短信未配置」当既成事实——这条待办曾长期笼统写着「短信/支付/OSS/推送」都没填，导致误判线上无法登录。判断某模块是否可用要直接查 `configs` 表或调 `getModuleConfig()`，不要照抄本行
3. 钻石充值接入微信/支付宝支付
4. ~~礼物素材正式设计~~ **已完成 (2026-09-07)** — 16 个礼物全部换成 SVGA 矢量动画（L1-L3），图标由同一份 SVGA 抽帧生成，emoji 占位清零，礼物 lineup 已改名（点赞/比心/星际少女/玫瑰/心动/一剑穿心/钻石/天使/花好月圆/福袋/皇冠/水晶球/独角兽/跑车/旋转木马/流星雨），价格阶梯未变。线上 16/16 实测通过。见 ADR-0004。遗留三项：① **素材授权**——13 个 .svga 来自无 LICENSE 的仓库，当前以「非商用」为前提，商用前必须替换或取得授权；② **App(WKWebView) 端未验证**——依赖 `siteOrigin + /static/...` 绝对 URL 与 nginx 新增的 `/static/` CORS 头，需 HBuilderX 打包后实测；③ **`gifts` 表缺稳定业务键**——`seed.js` 按 `name` 匹配，任何改名都会产生重复行，宜加 `code` 列改为按它匹配
5. 会话列表深色主题适配
6. **`diamondAmount` 字段语义不一致** — `gifts.js` 写入消息体的 `giftContent.diamondAmount` 是**单价** (`gift.price`)，而 API 响应 / WS 广播里的 `diamondAmount` 是**总价** (`totalDiamond`)。多件礼物时聊天卡片显示单价且不显示数量（如送 2 个水晶球、实付 4000，卡片显示「水晶球 💎 2000」）。需先决定以哪个为准，再统一两端并让卡片显示数量
7. **会话列表礼物摘要显示「[自定义消息]」** — Lite SDK 的 `conversation.lastMessage.messageForShow` 不取 `TIMCustomElem.Desc`（服务端已传 `送出了N个XX`，无效）。需在会话列表摘要渲染处按 `businessID === 'gift'` 自行映射为「[礼物] XX」
8. **清理礼物特效验证期间的测试数据**（清理前逐项与用户确认，勿自作主张回滚）
   - **2026-09-06 批次**：`gift_records` 43-46（20→23 一条、13→23 三条）及对应 `messages` 245-248；用户 13/20 钱包被充值（现余 500/1500）；用户 23 的 `gift_income`(3783570 分) 与 `charm_value`(54051) 含测试污染
   - **2026-09-07 端到端验证批次**（全部 27→25，流星雨 ×2）：`gift_records` 57、58；`messages` 271、272；`transactions` 114-117。用户 27 钻石 629676→529676（−100000）；用户 25 `gift_income` 23119110→30119110 分（+70000 元）、`charm_value` 330273→430273（+100000）
   - **2026-09-07「只播一次」验证批次**（27→25，点赞 ×1，故意挑最便宜的）：`gift_records` 59；`messages` 276；`transactions` 118、119。用户 27 钻石 529676→529675（−1）；用户 25 `gift_income` +70 分（1 钻 ×100 分 ×70% 分成）。IM 云端另有 1 条点赞自定义消息
   - **归属不明**：`gift_records` 50-56（同日 00:31–05:24，27→25 的棒棒糖/小红花/冰淇淋/钻石戒指/烟花/跑车/水晶球）也疑似同期测试数据，但不是我这两笔，清理前先问
   - IM 云端消息无法通过 REST 删除，会残留在会话里（C2C 25↔27 至少含 2 条流星雨自定义消息）
9. **TUIKit 首屏偶发空白竞态** — 容器重建后首次加载偶发 `Error in event handler for sdkStateReady: e.chat.getConversationList is not a function`，聊天页停在约 75 个 DOM 元素不渲染，再刷新一次即恢复。属引擎内部时序问题，与业务代码无关，尚未修复
10. **微信分享未配置，iOS 上必然失败** — `manifest.json` 有 `modules.Share: {}`，但 `sdkConfigs` 里**没有 `share` 节点**（缺微信 appid / UniversalLinks）。`invite.vue` 的 `uni.share({ provider: 'weixin' })` 在 App 端会走 `fail`，而 fail 回调统一提示「分享取消」，把「未配置」伪装成「用户取消」。上线前需补 `sdkConfigs.share.weixin`（appid + UniversalLinks），或在未配置时隐藏微信分享入口
11. **iOS ATS 与「服务器地址」热切换冲突** — `request.js` 支持在 App 内把 BASE_URL 改成 `http://电脑IP:3000/api` 便于联调，但 iOS App Transport Security 默认禁止明文 HTTP。打包后该调试入口在 iOS 上会静默失败，需确认 HBuilderX 生成的 Info.plist 是否含 `NSAllowsArbitraryLoads`，或联调时改用 HTTPS 隧道
12. **`transactions.balance_after` 把差额算了两次**（2026-09-07 生产端到端实测发现，未修）— `gifts.js:61` 的 `wallet.update({ diamond: wallet.diamond - totalDiamond })` 会**就地修改实例**，返回后 `wallet.diamond` 已是新值；而 `:81` 又写 `balanceAfter: wallet.diamond - totalDiamond`，等于扣了两次。接收方 `:67`/`:90` 同理（加两次）。实测证据：送 1 个流星雨（50000 钻）后，用户 27 真实余额 579676，`transactions#114.balance_after` 却记 529676；用户 25 真实 `gift_income` 26619110 分，`#115.balance_after` 记 30119110。**最小复现**（同日，故意送 1 钻的点赞）：用户 27 真实余额 529675，`#118.balance_after` 记 529674——差额正好等于一个礼物金额，收方 `#119` 的 +70 分同样翻倍，可排除其他干扰因素。**钱包与收入本身是对的，只有审计字段错**，影响管理后台交易明细与对账。修法：在 `update()` 之前把目标值存成局部变量（`const senderBalanceAfter = wallet.diamond - totalDiamond`），`update` 和 `balanceAfter` 都用它
13. **`auth.js getUser()` 在 H5 恒返回 `{}`**（2026-09-07 浏览器实测确认，未修）— `setUser()` 存的是 `JSON.stringify(user)`，而 uni-h5 的 `getStorageSync` 会把「看起来像 JSON」的字符串**自动解析成对象**再返回（实测：存 `'{"a":1}'` → 原样落 localStorage → 取回得到 `{a:1}` 对象）。`getUser()` 于是执行 `JSON.parse(对象)` → `JSON.parse("[object Object]")` → 抛 `SyntaxError` → 被 catch 吞掉返回 `{}`。**后果**：`store/user.js` 的 `restoreSession()` 里 `if (this.token && this.user && this.user.id)` 恒为假，`kickOffTUIInit()` 与 `fetchProfile()` 在「带已有登录态刷新页面」时**根本不会执行**——它们是死代码，IM 登录之所以没出事是因为另有两条独立路径：`App.vue:125` 用 `isLoggedIn`（`!!user.id || !!token`，靠 token 成立）挂载 `msgNotify`，其内部会调幂等的 `ensureTUILogin()`；`entry-chat-only.ts:50` / `entry-conversation.ts:39` / `chat.vue:721` 也各自直接调。`userStore.userId`/`nickname`/`avatar` 刷新后则确实全为空。当前绕行：新增 `getUserId()`（解 JWT payload 取 `id`，纯 JS base64 解码不用 `atob`，App 端也能跑），`giftAnimPlayed.js` 与 `chat.vue isMine()` 已改用它。**没有直接修 `getUser()` 的原因**：修好会一次性激活上面那段死代码（每次启动都登录 IM + 拉资料），有可能加重待办 #9 的首屏竞态，需要单独评估后再改。改法本身是一行：`const raw = uni.getStorageSync(USER_KEY); return typeof raw === 'string' ? JSON.parse(raw) : (raw || {})`

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

*最后更新: 2026-09-07*
