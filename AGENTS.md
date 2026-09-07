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
22. **H5 整页可左右滑动 = `width:100%` + 横向 padding + 没有全局 `box-sizing` 重置**（**2026-09-08 已用全局重置根治，见下文「根治方案已落地」**；下面的成因分析仍要读——存量补丁、`min-width` 语义翻转、以及未覆盖页面都靠它解释）— 项目原先**从未**做过 `* { box-sizing: border-box }` 全局重置（TUIKit 的 `common.scss` 也没有，只单独给 `.chat-aside` 加过），所以默认是 `content-box`。而 uni-app H5 给两个标签的默认宽度是**不对称**的：`uni-scroll-view` 是 `width: 100%`，`uni-view` 是 `width: auto`。于是只要 `<scroll-view>` 自己带横向 padding，实际渲染宽度就是 `100% + 2×padding` → 溢出；普通 `<view>` 因为是 auto 宽度会自己减掉 padding，反而没事。第二类触发条件是**任何元素显式写了 `width: 100%` 又带横向 padding**（底部弹层、输入框、`position:fixed` 菜单都中招）。
    - **为什么只在电脑浏览器上被注意到**：rpx 按 `viewportWidth/750` 缩放，`$by-page-pad-x: 32rpx` 在 vw 524 时是 22.36px（溢出 45px），在 1920px 宽屏上是 81.9px（溢出 164px）——溢出量随视口线性放大，手机上不易察觉，桌面端一滑就滑出去。
    - **2026-09-07 已修的 9 处**（均为在规则首行补 `box-sizing: border-box`）：`pages/profile/profile.vue .content-scroll`、`pages/transactions/transactions.vue .type-bar`、`components/GiftPanel.vue .gift-panel-body`、`TUIKit/.../message-input-gift.vue .gift-scroll`、`pages/chat/chat.vue .more-menu`、`pages/gift-shop/gift-shop.vue .detail-sheet` 与 `.detail-hint`、`pages/withdraw/payment-bind.vue .field-input`、`TUIKit/.../message-input/index.vue .more-menu`。注意 `pages/chat/chat.vue .msg-scroll` **更早就被手工补过**同一行——说明这是一类反复出现的坑，不是一次性笔误。
    - **已确认安全、不要再改**：`profile-edit.vue .picker-sheet`（横向 padding 是 0）、`TUIContact/contact-search .tui-contact-search-main`（自身无横向 padding，且本项目根本没挂载 TUIContact）、`simple-message-list .header-container`（只在「合并转发记录」抽屉里 `position:absolute` 渲染，冷门路径）、以及 `home.vue .scroll/.online-scroll`、`discover.vue .by-tabs-scroll`、`search.vue .tabs-scroll`、`follow-list.vue .user-list`、`chat-list.vue .session-scroll`（padding 都在内层子元素上）。
    - **根治方案已落地（2026-09-08，`c7b0df5`，生产实测通过）**：`App.vue` 全局样式块里加了**标签级枚举**重置。**绝不能用 `*`** —— `*` 会波及伪元素与 TUIKit 三方样式，且 TUIKit 自己有 2 处显式 `content-box`（`TUISearch/search-result/.../web.scss:13,222`）需要保住。写法：
      ```scss
      view, scroll-view, swiper, swiper-item, cover-view, cover-image,
      text, image, icon, button, input, textarea, navigator, label, form,
      picker, slider, switch, progress, checkbox, radio, video, canvas {
        box-sizing: border-box;
      }
      ```
      **源码写标签名即可，vite-plugin-uni 的 postcss 会自动转成 `uni-view`/`uni-scroll-view`/…**（产物实测：`uni-view,uni-scroll-view,uni-swiper,…,uni-canvas{box-sizing:border-box}`），不需要手写 `uni-` 前缀。
    - **为什么特异度能保证 TUIKit 安全**：标签选择器是 `(0,0,1)`，低于任何类选择器 `(0,1,0)`。TUIKit 那约 50 处显式 `border-box` 天然一致、2 处 `content-box` 天然保住，与 CSS 源序无关。**不要加 `.tui-*{revert}` 之类的兜底** —— `revert` 反而会按源序覆盖掉 TUIKit 自己的 `border-box` 声明，是净风险。
    - **门禁踩坑：`[class*="tui-"]` 指纹范围太窄，报了假 PASS** — 只统计带 `tui-` 类名的元素，在 TUIChat 页只覆盖 **11 个**，而礼物卡片、消息气泡这些**我们自己加的**类名不带 `tui-` 前缀，全在盲区里。必须扩成「以 `[class*="tui-"]` 为根的**整棵子树**」，才照出真回归：`message-custom.vue .gift-card-inner{min-width:160px}` 在 `content-box` 下量的是内容盒，切到 `border-box` 后变成量边框盒 → 内容盒缩到 130px、卡片窄了 30px。**修法是 `min-width` 提到 190px**（160 + 2×14 padding + 2×1 border）。教训：`min-width`/`width` 配 padding 时，box-sizing 切换会**翻转语义**，凡是有显式宽度又带 padding/border 的三方或自建卡片都要重新量一遍。
    - **残差 0.4px 的来源（别再当成 bug 追查）**：按 1px 边框补偿了 2px，但**实测边框渲染成 0.8px**（`borderWidth: '0.8px'`），于是内容盒是 160.4px 而不是 160px。亚像素、肉眼不可见。生产实测 `w:190 / bs:'border-box' / mw:'190px' / pad:'10px 14px' / bw:'0.8px'`，页面 `overflow:0`。
    - **14 处零散补丁保留、未回收** — 补丁与全局重置并存是**幂等无害**的，回收只有整洁性收益，不值得为它承担「改错一处就重新溢出」的风险。要回收的话必须逐页重跑溢出断言。
    - **未覆盖项**：`pages/chat/chat.vue` —— IM 就绪时它会 `redirectTo` 官方 TUIChat，自动化到不了那个兜底页面，其布局只做了代码审阅未做生产实测。
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

23. **uni-app H5 的 `<scroll-view>` 想真能滚，容器必须是「确定高度」+ 滚动区必须 `min-height:0`** — 礼物面板「上下滚不动、第 4 行礼物被裁、赠送按钮看不见」是这一对原因叠加，2026-09-07 修（`14ca616` + `bd61894`）。
    - **DOM 结构**：`<scroll-view>` 在 H5 编译成三层——`UNI-SCROLL-VIEW.你的类名`（`overflow:visible`）→ `DIV.uni-scroll-view` → `DIV.uni-scroll-view`（`overflow:auto`，**真正滚动的是这层**）→ `DIV.uni-scroll-view-content`。uni 的默认样式是 `.uni-scroll-view{…width:100%;height:100%…}`、`.uni-scroll-view-content{width:100%;height:100%}`。
    - **坑一：`height:100%` 只在父级高度确定时才解析**。面板容器写 `max-height:68vh` 而 height 是 auto → 高度不确定 → 内层百分比退化成内容高 → 滚动区高度 == 内容高度 → **永远不出滚动条**。改成 `height:68vh`（确定值）后立刻能滚。`.gift-panel`（自建）原先就是 `max-height`，`message-input-gift.vue`（TUIKit）本来就是 `height:60vh` 所以只中坑二。
    - **坑二：flex 项的 `min-height:auto`**。外层 `uni-scroll-view` 是 `overflow:visible`，flex 的自动最小尺寸就等于内容高度，`flex:1` 因此**拒绝收缩**：内部滚不动，多出来的高度把 footer 顶出面板，再被面板的 `overflow:hidden` 裁掉——这就是「看不到赠送按钮」。滚动区必须显式写 `min-height: 0`。
    - **坑三：footer 不要用 `v-if="selectedGift"` 门控**。未选礼物时整条底栏消失，用户看不到任何「送」的入口。改成底栏常显、只把数量选择行 `v-if`，按钮文案在未选时显示「请先选择礼物」、在途显示「正在送出…」并加 `disabled` 样式。
    - **连点重复扣费**：两个面板的 `sendGift` 都加了 `const sending = ref(false)` 在途守卫（`if (!selectedGift.value || sending.value) return`，`finally` 里复位）；成功后 `selectedGift.value = null` 又构成第二道锁。TUIKit 版尤其需要，因为它在扣费成功后还要 `await TUIChatService.sendCustomMessage()`，这段可能长达数秒。
    - **线上实测证据（部署 `bd61894` 后，视口 524×618）**：
      | 面板 | 容器高 | 内层滚动区 | 滚到底 | 赠送行 |
      |---|---|---|---|---|
      | TUIKit `.gift-scroll` | 371（=60vh），bottom 618 贴视口底 | `scrollHeight 501 > clientHeight 236`，maxScroll 265 | `scrollTop 9999 → 266`，第 16 个礼物格 bottom 538 ≤ 滚动区 bottom 550 **完整可见**，16 格分 4 行 | `.gift-actions` 550–618 完整可见 |
      | 自建 `.gift-panel-body` | 421（=68vh） | 未选礼物 `796 > 269`；选中流星雨后 footer 71→122px、滚动区自动压到 218 | `scrollTop 9999 → 578`（=796−218，正好到底） | 赠送按钮 560–606 在视口内 |
      防连点：同一 tick 内 `dispatchEvent` 连点 5 次 → 只发出 **1** 个 `POST /api/gifts/send`；间隔 2/622/1624/2627ms 连点 4 次 → 也只 **1** 个请求。数据库对账：两轮测试 `gift_records` 只新增 60、61 两行，用户 23 钻石 10→9→8，每轮恰好扣 1 钻。
    - **验证陷阱一（本次中招）**：统计请求次数时给 `XMLHttpRequest.prototype.send` 装钩子，**一个 document 只能装一次**。我在同一个页面先后装了两次，第二次包裹了第一次，于是 1 个真实请求被记成 2 条时间戳完全相同的日志，一度误判「守卫放过了 2 次」。**判定有没有重复扣费要以数据库行数/余额为准，不能只看前端日志条数。**
    - **验证陷阱二**：`pages/chat/chat.vue` 的 `onLoad` 只认 `conversationID / userId / peerUserId / to / id / uid / providerId`（`:676`），**不认 `toUserId`**。用错键时 `peerId` 为空 → 弹「会话参数缺失」并 `return`（因此也就**不会**重定向到 TUIChat，页面停在自建兜底聊天），此时礼物面板的 `receiverId` 是空串，送礼必返 `400 参数不完整`。线上入口全部用 `userId=` 或 `to=`，所以这不是生产 bug，但拿它做测试会得出完全错误的结论。反过来说：**IM 就绪时 `chat.vue:726` 会 `redirectTo` 官方 TUIChat，自建 `GiftPanel` 只是兜底路径**，用户实际看到的是 TUIKit 那个面板。

24. **SVGA 播放器必须传「真 DIV」，绝不能传 canvas，更不能按 dpr 放大属性尺寸** — iOS App 上礼物特效缩成左上角一小块（用户 2026-09-07 截图报告）就是这个，桌面 H5 完全看不出来。2026-09-07 修（`SvgaStage.vue`）。
    - **库的容器契约**（读 `app/src/static/lib/svga.min.js` 逆出来的，不是猜的）：`Player._init()` 只在 `container instanceof HTMLDivElement || container === undefined` 时才创建 `_drawingCanvas`；**传 canvas 进去 `_drawingCanvas` 恒为 undefined**。而 `_update()`（`setVideoItem()` 和每一帧都会调）→ `_resize()` 有两段：第一段仅在 `_drawingCanvas` 存在时执行，按「holder 尺寸 vs videoSize」设 `canvas.width/height` 并写 CSS `matrix()` 缩放居中；第二段在 `_drawingCanvas` 不存在时，用 `_container.clientWidth/clientHeight`（**CSS px**）算 `_globalTransform`。`Renderer.drawFrame/clear` 取 `(_drawingCanvas || _container).getContext('2d')` 并按 `.width/.height`（**属性 px / 位图尺寸**）clearRect。
    - **于是传 canvas 时**：变换矩阵按 CSS px 算，内容却画进属性尺寸的位图。旧代码 `cv.width = w * min(dpr,2)`，属性尺寸是 CSS 的 2 倍 → 画面缩到 1/2 并锚在左上角。iOS dpr=3 被截到 2，正好「左上角一小块」；**桌面 dpr=1 时属性==CSS，所以从来没暴露过**。
    - **正确写法**：`document.createElement('div')` 铺满 holder，交给库走 DIV 分支——它会自建 canvas，属性尺寸取 videoSize（750×1334）、CSS 尺寸由 `matrix()` 缩放，既铺满 holder 又是超采样，比按屏幕 dpr 更清晰。**两个反直觉的点**：① 不能直接把 holder 传进去，uni-app 把 `<view>` 编译成 `<uni-view>`，过不了 `instanceof HTMLDivElement`；② 不要给 canvas 写 `style.width/height`（会和库的 transform 叠成双重缩放）。
    - **实测证据**（生产构建，模拟 390×844 holder，流星雨 `videoSize 750×1334`）：修复前内容只占位图 `[0.518, 0.451]` 且锚左上角；修复后 `canvas.parentNode.tagName === 'DIV'`、`attr [750,1334]`、无内联宽高、`transform matrix(0.52, 0, 0, 0.52, -180, -245)`、`getBoundingClientRect()` = `390 × 693.7 @ (0, 75.2)` 对 holder `390 × 844 @ (0,0)` —— 铺满宽度、垂直居中，连续 4 次采样稳定。
    - **验证环境坑**：自动化浏览器标签页 `innerWidth/innerHeight` 恒为 0 且 `visibilityState: 'hidden'`，`requestAnimationFrame` 被挂起 → 播放器永远不推帧，每帧的 `_resize()` 也就不执行，量到的全是 0×0。必须先 `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`（每个 document 只能装一次），再用 MutationObserver 在 `.gift-anim-layer` 出现瞬间给 layer/stage/holder 强制 px 尺寸并带 `flex: 0 0 auto`（`.svga-stage` 是 flex 容器，0 宽父级里 `width:390px` 会被压成 0）。另：`.gift-anim-layer` 带 `v-if="current.id"`，**不播特效时根本不存在**，别拿「查不到 layer」当渲染失败。

25. **`enablePullDownRefresh: true` 必须配 `onPullDownRefresh` + `uni.stopPullDownRefresh()`** — 只开配置不写回调，下拉后加载圈永远不消失，用户看到的就是「一直刷新」（2026-09-07 图三报告的现象之一）。回调里无论成功失败都要在 `finally` 中调 `stopPullDownRefresh()`，否则一次接口报错就把页面卡死在刷新态。`home.vue` 与 `discover.vue` 已按此补齐。

26. **seed 伪造社交计数 = 「没有真实的点赞评论体系」的根因** — `server/src/seed.js` 曾给每条 AI 动态写 `likeCount: 5+random*200`、`commentCount: random*20`，却**不写 `likes` 数组、不建 `comments` 行**。2026-09-07 生产实测：15 条动态里 13 条 `likes` 为 NULL 而 `like_count` 高达 179，`comments` 表 **0 行**而 10 条动态声称有评论。后果有三：① 卡片显示「💬 12」点进详情是「评论 0」；② `POST /posts/:id/like` 写的是 `likes.length`，用户第一次点赞会把 179 **直接重置成 1**；③ 数字不可能通过任何交互变成真的。
    - **已修**：`seed.js` 两个计数改为 0（新环境不再伪造）；`pages/post/detail.vue` 的评论数一律以 `GET /posts/:id/comments` 返回的真实 `total` 覆盖 `post.commentCount`（并因此**不能**在 `loadDetail` 里再写一次 `commentCount`——两个请求并发，详情后到会把真实值盖回伪造值）。
    - **存量已校正**（2026-09-07，经用户批准）：`UPDATE posts SET like_count = COALESCE(JSON_LENGTH(likes),0)` + `UPDATE posts p SET comment_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id)`。校正后全站 `SUM(like_count)=2`（post 1/14 的真实 `[27]`）、`SUM(comment_count)=0`。**发现页从此显示 0 赞 0 评论是正确状态，不是数据丢了。**
    - 顺带一条查询坑：`groups` 是 MySQL 8 保留字，手写 SQL 必须反引号 `` `groups` ``；另外 Windows Git Bash 下 `curl --data-urlencode "city=深圳"` 会按 **GBK** 编码（服务端收到 `%C9%EE%DB%DA`），测中文参数要直接写 UTF-8 转义 `%E6%B7%B1%E5%9C%B3`。

27. **「SQL 精确 IN + 内存模糊兜底」的组合里，变体集合必须对称展开** — `groups.js` 组局列表按城市筛选是「先 `where.city IN (变体)` 收窄，再用 `matchCity()` 双向 `startsWith` 兜住前缀关系」两段式。第二段的兜底**只能作用于第一段已经取出来的行**，所以任何没进 IN 的形态都等于永久不可见。2026-09-07 第一版只写成 `if (cityNorm !== cityRaw) variants.add(cityNorm)`，于是查询 `'深圳'` 能命中（norm=`'深圳市'`≠原值，两个形态都进 IN），查询 `'深圳市'` 却**返回 0 条**（norm 等于原值 → 短名 `'深圳'` 从不进 SQL）。线上实测：修复前 `city=深圳` total 2、`city=深圳市` total 0；修复后两者都是 2（生产 `groups` 仅 2 行，city 均为短名 `'深圳'`）。
    - **改法**：对 `cityRaw` 与 `cityNorm` **各自**补「带市 / 不带市」两种形态（`4c4bc6a`）。前端 picker 给的是规范名、老 App 版本给的是短名，两个方向都必须成立。
    - **只补 `'市'` 后缀，不要顺手剥 `'州'/'盟'/'地区'`**：剥完只剩单字（`'广州'`→`'广'`），`matchCity` 的双向 `startsWith` 拿它去比会误命中 `'广安市'` 这类同前缀城市。剥 `'市'` 时也要要求剩余 ≥ 2 字。
    - 副作用是可接受的：`'湘西'` 会多出一个 `'湘西市'` 这类永不命中的噪声变体。因为 IN 是精确匹配、`matchCity` 又只看 IN 已筛出的行，噪声**不会**造成误命中，只是集合里多几项。
    - 反向验证也要做：改完测 `city=广州`/`广州市`/`深圳南山` 应仍为 0，确认没有把筛选放宽成「全都返回」。

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
6. ~~`diamondAmount` 字段语义不一致~~ **已修 (2026-09-08, `254234c`)** — 决定**以总价为准**。消息体里的 `diamondAmount` 保持「单价」语义不动（改它会让存量消息全部误读），改为**四个渲染点统一走 `totalDiamond ?? diamondAmount × quantity`**。关键的一点：**主通道走 `viaIM:true`，IM 消息体是前端 `message-input-gift.vue` 自己拼的**，服务端那份 `gifts.js:97-108` 只写进 DB Message，所以补齐字段要补在前端 payload（`quantity`/`totalDiamond`），不是补在服务端。已改的四处渲染：`message-custom.vue`(主通道卡片)、`chat.vue`(兜底卡片)、`GiftAnimation.vue`(本就已带 quantity，且不显示金额)、以及会话摘要三处（见待办 7）。**存量消息不会金额翻倍**：IM 云端的历史自定义消息两个字段都没有，但主通道数量恒为 1，`单价 × 1` 就等于实付总价——这也是当初担心的「改语义导致历史卡片翻倍」风险归零的原因
7. ~~会话列表礼物摘要显示「[自定义消息]」~~ **已修 (2026-09-08, `254234c`)** — 根因确认：Lite SDK 的 `getLastMessageText()` 对 `MSG_CUSTOM` 只解析 `payload.data` 判 `businessID === 1`（数字，CallKit），其余一律取 `messageForShow` 再过翻译表，**从不解析我们塞的 gift JSON**，所以服务端在 `Desc` 里传的「送出了N个XX」根本用不上。修法是在 `TUIConversation/conversation-list/index.vue` 加 `lastMessageSummary()`，**只接管 `businessID === 'gift'` 这一类**，其余原样交回 SDK（避免复刻它的草稿/撤回/群提示分支）；SDK 会前缀未读条数（如「[3条]」），接管正文时用正则从 fallback 里把前缀取回来，不自己复刻判定条件。自建通道两处（`server/routes/chat.js`、`chat-list.vue`）文案与之对齐。**顺带修了一个计划外的真 bug**：`chat-list.vue` 的 `lastText()` 对上游已格式化好的「[礼物] XX」做 `JSON.parse` 必失败，于是所有礼物摘要都退化成没有名字的「[礼物]」——现在解析失败就原样透传
   - **后续（同日 `c87e52e`）：早期礼物消息的 IM 载荷缺 `businessID`，判定必须放宽** — 上线后生产实测 C2C27 会话，6 条里仍有 1 条显示「[自定义消息]」。按时间戳对齐查出它对应 DB `messages#130`（giftId 2 / 50 钻 / 03:00:40，IM 里也正是「星期日 03:00」），**确实是一条礼物**。根因是时间差：`gifts.js` 的 `giftContent` 是后来才补上 `businessID:'gift'` 的，在那之前走**兜底通道**（`viaIM:false`）由服务端把这份内容原样转发进 IM 的礼物消息，载荷里永远没有 `businessID`。同一会话的 `#124`/`#125` 能正常渲染成礼物卡，是因为它们走**主通道**（`viaIM:true`）——IM 载荷由前端 `message-input-gift.vue` 拼、一直带着 `businessID`，只有 DB 那份缺字段，**所以光看 DB 查不出这个问题**。IM 云端已投递的消息无法用 REST 编辑，只能在读侧放宽：`businessID === 'gift' || (!businessID && giftName)`。其余自定义消息类型（SERVICE/EVALUATE/ORDER/LINK）都自带 `businessID`，不受影响。**两处判定必须同步改**（`message-custom.vue` 的 `isGiftMessage` 与会话列表的 `lastMessageSummary`），否则同一批消息在聊天里是礼物卡、在会话列表里却仍是「[自定义消息]」
8. **清理礼物特效验证期间的测试数据**（清理前逐项与用户确认，勿自作主张回滚）
   - **2026-09-06 批次**：`gift_records` 43-46（20→23 一条、13→23 三条）及对应 `messages` 245-248；用户 13/20 钱包被充值（现余 500/1500）；用户 23 的 `gift_income`(3783570 分) 与 `charm_value`(54051) 含测试污染
   - **2026-09-07 端到端验证批次**（全部 27→25，流星雨 ×2）：`gift_records` 57、58；`messages` 271、272；`transactions` 114-117。用户 27 钻石 629676→529676（−100000）；用户 25 `gift_income` 23119110→30119110 分（+70000 元）、`charm_value` 330273→430273（+100000）
   - **2026-09-07「只播一次」验证批次**（27→25，点赞 ×1，故意挑最便宜的）：`gift_records` 59；`messages` 276；`transactions` 118、119。用户 27 钻石 529676→529675（−1）；用户 25 `gift_income` +70 分（1 钻 ×100 分 ×70% 分成）。IM 云端另有 1 条点赞自定义消息
   - **2026-09-07「防连点/滚动」验证批次**（23→25，点赞 ×1，两轮连点各只扣一次）：`gift_records` 60、61；`messages` 283、284；`transactions` 120、122（用户 23 `gift_send` −1）与 121、123（用户 25 `gift_income` +70 分）。用户 23 钻石 10→8；用户 25 `gift_income` 30119180→30119320 分、`charm_value` 430274→430276。IM 云端另有 2 条点赞自定义消息（C2C 23↔25）
   - **归属不明**：`gift_records` 50-56（同日 00:31–05:24，27→25 的棒棒糖/小红花/冰淇淋/钻石戒指/烟花/跑车/水晶球）也疑似同期测试数据，但不是我这两笔，清理前先问。另 `messages` 277-279（06:29:46）与 280-282（07:01:55）是两组「27→24 文本 / 27→12 语音 / 27→27 自发自收」的三连发，同一秒内产生，来源未查清，清理前先问
   - **⚠️ 已查明归属，禁止清理**：`gift_records` 62-67 + `transactions` 124-135（2026-09-07 14:47:49 与 15:09:23–15:10:02，全部 27→25：旋转木马 20000 / 点赞 1 / 流星雨 50000 / 旋转木马 20000 / 跑车 10000 / 花好月圆 500，合计 **100501 钻**）是**用户本人在 iOS 真机上测试礼物特效**产生的真实送礼，不是 AI 测试污染。判定依据：本项目只有一个会话 transcript，当天首条记录是 15:15:55（用户发来那 4 张截图），而 08:00–15:00 之间 AI 侧零活动，送礼全部落在这个空档里。账目对账吻合：用户 27 钻石 529675→**429174**（−100501），用户 25 `gift_income` 30119320→**37154390** 分（+7035070 = 100501×100×70%）、`charm_value` 430276→**530777**（+100501）。**这批数据要保留**——它是用户自己的操作记录，也是那 4 张截图的现场证据。（顺带：`transactions` 124-135 的 `balance_after` 依旧带着待办 #12 的双计错误，例如 #128 记 409674、#130 反而回升到 419674）
   - IM 云端消息无法通过 REST 删除，会残留在会话里（C2C 25↔27 至少含 2 条流星雨自定义消息）
9. **TUIKit 首屏空白竞态（原记录「偶发 + 刷新即恢复」已被 2026-09-08 生产实测推翻）** — 报错固定是 `Error in event handler for sdkStateReady: e.chat.getConversationList is not a function`。实测结论：**以 `#/TUIKit/components/TUIConversation/index` 作为入口路由（深链/整页重载）时列表必空，连刷两次都不恢复；改走「`#/pages/home/home` 整页载入 → 点消息 Tab」则 6 条会话全部正常渲染**。所以它不是偶发，是**入口路径决定的必现分支**，原先「刷新一次即恢复」很可能只是因为刷新后 uni 路由落到了别的入口。
   - **定位到哪一步**：console 里能看到 `_syncConversationList success count:6`，说明 **SDK 已经把会话拉回来了**；但紧接着 `TUIChatEngine.resetStore ok.` 之后 `sdkStateReady` 处理器抛错，TUIStore 没被填充 → 列表 DOM 停在 `tui-conversation` / `-header` / `-list` 各 1 个、`.tui-conversation-item` **0 条**（查选择器没错，列表真的是空的）。
   - **不是我们源码的问题**：`sdkStateReady` 处理器在三方 bundle 里（生产 `index-D6lcmXuO.js`），我们唯一一处 `getConversationList` 调用在 `TUIConversation/entry-conversation.ts:64-65`，已有 `typeof svc.getConversationList === 'function'` 守卫，且该文件的 `isReady()` 轮询（最长 10s）+ `TUIChatKit.init()/login()` 都跑完了，深链下依旧空白。**别再去改 `entry-conversation.ts` 试。**
   - **验证时要用的入口**：想看会话列表，一律走 home + 点 tabbar；想直连聊天页则必须整页重载 `?v=xxx#/TUIKit/components/TUIChat/index?conversationID=C2C25`（裸改 hash 会报「会话参数缺失」，见坑点 22 末）。
   - **尚未修复**，且与待办 13 的入口路径去重（`restoreSession` / `App.vue:125` / `entry-conversation.ts:39` 三条独立路径各自调 `ensureTUILogin`）高度耦合——D6 做去重时要一并评估，去重不当可能扩大触发面
10. **微信分享未配置，iOS 上必然失败** — `manifest.json` 有 `modules.Share: {}`，但 `sdkConfigs` 里**没有 `share` 节点**（缺微信 appid / UniversalLinks）。`invite.vue` 的 `uni.share({ provider: 'weixin' })` 在 App 端会走 `fail`，而 fail 回调统一提示「分享取消」，把「未配置」伪装成「用户取消」。上线前需补 `sdkConfigs.share.weixin`（appid + UniversalLinks），或在未配置时隐藏微信分享入口
11. **iOS ATS 与「服务器地址」热切换冲突** — `request.js` 支持在 App 内把 BASE_URL 改成 `http://电脑IP:3000/api` 便于联调，但 iOS App Transport Security 默认禁止明文 HTTP。打包后该调试入口在 iOS 上会静默失败，需确认 HBuilderX 生成的 Info.plist 是否含 `NSAllowsArbitraryLoads`，或联调时改用 HTTPS 隧道
12. **`transactions.balance_after` 把差额算了两次**（2026-09-07 生产端到端实测发现，未修）— `gifts.js:61` 的 `wallet.update({ diamond: wallet.diamond - totalDiamond })` 会**就地修改实例**，返回后 `wallet.diamond` 已是新值；而 `:81` 又写 `balanceAfter: wallet.diamond - totalDiamond`，等于扣了两次。接收方 `:67`/`:90` 同理（加两次）。实测证据：送 1 个流星雨（50000 钻）后，用户 27 真实余额 579676，`transactions#114.balance_after` 却记 529676；用户 25 真实 `gift_income` 26619110 分，`#115.balance_after` 记 30119110。**最小复现**（同日，故意送 1 钻的点赞）：用户 27 真实余额 529675，`#118.balance_after` 记 529674——差额正好等于一个礼物金额，收方 `#119` 的 +70 分同样翻倍，可排除其他干扰因素。**钱包与收入本身是对的，只有审计字段错**，影响管理后台交易明细与对账。修法：在 `update()` 之前把目标值存成局部变量（`const senderBalanceAfter = wallet.diamond - totalDiamond`），`update` 和 `balanceAfter` 都用它。**第三组证据（同日 07:39/07:42 两笔 1 钻点赞，用户 23→25）**：真实钻石 10→9→8，而 `#120.balance_after=8`、`#122.balance_after=7` 各少 1；收方真实 `gift_income` 30119320 分，而 `#121.balance_after=30119320`、`#123.balance_after=30119390` 各多 70 分——双计逐笔稳定复现，且**最后一笔的 `balance_after` 与真实值总是差恰好一个礼物金额**，可据此批量校正历史数据。
13. **`auth.js getUser()` 在 H5 恒返回 `{}`**（2026-09-07 浏览器实测确认，未修）— `setUser()` 存的是 `JSON.stringify(user)`，而 uni-h5 的 `getStorageSync` 会把「看起来像 JSON」的字符串**自动解析成对象**再返回（实测：存 `'{"a":1}'` → 原样落 localStorage → 取回得到 `{a:1}` 对象）。`getUser()` 于是执行 `JSON.parse(对象)` → `JSON.parse("[object Object]")` → 抛 `SyntaxError` → 被 catch 吞掉返回 `{}`。**后果**：`store/user.js` 的 `restoreSession()` 里 `if (this.token && this.user && this.user.id)` 恒为假，`kickOffTUIInit()` 与 `fetchProfile()` 在「带已有登录态刷新页面」时**根本不会执行**——它们是死代码，IM 登录之所以没出事是因为另有两条独立路径：`App.vue:125` 用 `isLoggedIn`（`!!user.id || !!token`，靠 token 成立）挂载 `msgNotify`，其内部会调幂等的 `ensureTUILogin()`；`entry-chat-only.ts:50` / `entry-conversation.ts:39` / `chat.vue:721` 也各自直接调。`userStore.userId`/`nickname`/`avatar` 刷新后则确实全为空。当前绕行：新增 `getUserId()`（解 JWT payload 取 `id`，纯 JS base64 解码不用 `atob`，App 端也能跑），`giftAnimPlayed.js` 与 `chat.vue isMine()` 已改用它。**没有直接修 `getUser()` 的原因**：修好会一次性激活上面那段死代码（每次启动都登录 IM + 拉资料），有可能加重待办 #9 的首屏竞态，需要单独评估后再改。改法本身是一行：`const raw = uni.getStorageSync(USER_KEY); return typeof raw === 'string' ? JSON.parse(raw) : (raw || {})`

14. ~~礼物特效音效~~ **用户已明确决定不做（2026-09-07）** — 曾实现过一版：`utils/giftSfx.js`（`uni.createInnerAudioContext()` 单例 + H5 首次触摸解锁）、`scripts/gen-gift-sounds.js`（零依赖 WAV 合成器）、`static/sounds/` 19 个 wav（16 个与 SVGA 同名 + `gift-l1/l2/l3` 等级通用音），并在 H5 实测播放成功。**用户指令「不做特效的音效，特效相关的音效都做回退」后已全部删除**，`GiftAnimation.vue` 回到 HEAD。⚠️ 后续会话不要「顺手把音效加回来」；若真要重做，注意 App 端自动播放策略与 iOS 静音开关，且素材必须落在 `src/static/`（坑点 16）
15. **`groups` 表存量 city 仍是未规范化的 `'深圳'`（2 行）** — 读侧用 `Op.in: cityVariants` 匹配 `'深圳'`/`'深圳市'`，但**变体展开第一版是不对称的**（只在 `cityNorm !== cityRaw` 时补第二个形态），导致查询已规范化的 `'深圳市'` 时短名从不进 SQL、线上返回 0 条；2026-09-07 已修成对称展开，两个方向实测都是 2 条（详见坑点 27）。新建/编辑走 `normalizeCityName()` 写规范值。**没有跑存量 UPDATE**（会把 2 行改成 `'深圳市'`），因为读侧已双向兼容、改它没有收益还要动生产数据。若将来要按 city 做聚合统计或加唯一索引，再统一规范化
16. **iOS 真机验证清单（2026-09-07 这批修复，需 HBuilderX 打包后逐项过）** — H5 侧已全部实测通过，但用户报的四个现象都在 iOS App 上，且 App 端 WKWebView 与 H5 有三处关键差异（`file://` 源要靠 `siteOrigin + /static/...` 绝对 URL、dpr=3、无 `window` 兜底路径）：
    - [ ] 送 L3 礼物（流星雨）→ 特效**铺满全屏**，不再缩在左上角一小块（坑点 24）
    - [ ] 送 L1/L2 礼物 → 特效按 46vw / 82vw 居中，比例正确
    - [ ] SVGA 下载失败时能降级成 CSS 特效而不是黑屏（可断网或改错 URL 试）
    - [ ] 特效播完自动消失，不残留（`onFinished` → `callMethod('onSvgaEnd')` 走通，坑点 19）
    - [ ] 发布组局 → 页面**不再一直转圈**，返回发现页后筛选城市自动切到发布城市，且能看到刚发的卡片
    - [ ] 发现页/首页下拉刷新 → 松手后加载圈会消失
    - [ ] 点动态卡片任意区域 → 进详情页；点卡片上的 ❤️/💬/↗️ 不会误触进详情
    - [ ] 详情页点赞 → 立刻变色变数，断网时回滚并提示「操作失败，请重试」
    - [ ] 详情页发评论 → 出现「评论成功」、评论置顶显示、计数 +1
    - [ ] 确认发现页动态显示 0 赞 0 评论是**预期结果**（坑点 26 已校正伪造计数），不是数据丢失

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
