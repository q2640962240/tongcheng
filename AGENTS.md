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
- **礼物库**: **22 档在售**（2026-09-08 起，价格阶梯 1→88888，L1 六档 / L2 七档 / L3 九档），完整阵容见待办 4。`gifts.code` 是稳定业务键（`uk_gifts_code` 唯一索引），seed 按它匹配；另有 14 行 `active=0` 的历史礼物，任何脚本都不要碰
- **动画**: GiftAnimation 组件，4级效果 (L0无/L1小飘/L2横幅/L3全屏)；L1-L3 播放 SVGA 矢量动画（`SvgaStage` 用 renderjs），加载失败自动降级为 CSS 特效，小程序端不支持 renderjs 恒走 CSS
- **SVGA 容器有两种**: 绝大多数是 zlib+protobuf；`yuanding.svga`（缘定今生）是 **zip 容器（SVGA 1.x）**，`svga.min.js` 的 zip 分支门控在 `JSZip`/`JSZipUtils` 全局上，所以 `SvgaStage.ensureLib()` 会在加载播放器之前先注入这两个库（双向实测证据见待办 4：有 JSZip 解析出 750×1334/100帧，无 JSZip 精确报 `incorrect header check`）
- **经济**: 钻石(充值) → 送礼消耗 → 收礼获 giftIncome(分) → 提现（需先绑定收款账号）
- **收款绑定**: 提现前必须绑定支付宝/微信收款账号+二维码，换绑需短信验证（payment_bind）
- **关键文件**: `server/src/routes/gifts.js`, `app/src/components/GiftPanel.vue`, `app/src/components/GiftAnimation.vue`, `app/src/components/SvgaStage.vue`, `app/src/pages/gift-shop/gift-shop.vue`, `app/src/pages/withdraw/payment-bind.vue`

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
16. **静态资源只能放 `app/src/static/`，路径用绝对 `/static/...`** — Vite 的 `app/public/`（构建后落到 `/assets/`）是 **H5 专用**，uni-app App 端只打包 `src/static/`。礼物特效图曾长期写成 `/assets/gift-effect-*.png`，而该文件从未存在于 `public/`，线上全部 404，全屏特效背景图**从未真正显示过**（H5 和 App 双端）。种子数据在 `server/src/seed.js` 的 `DEFAULT_GIFTS`，但**生产库改路径不要跑 seed**：`ensureGifts`/`upgradeGifts` 都按 `name` 匹配，改名后会新建重复行（2026-09-07 线上礼物表因此从 16 行涨到 30 行，见坑点 20 与 ADR-0005）。生产改素材路径的正确姿势是按 `id`/`sort` 定向 `UPDATE gifts SET image_url=..., effect_image=...`。⚠️ **时效性提示（2026-09-08 起）**：这里说的「`ensureGifts`/`upgradeGifts` 按 `name` 匹配」是**历史成因**，`seed.js` 已改为按 `code` 匹配（`byCode[g.code] || byName[g.name]`，name 只作兜底）、`gifts.code` 也已回填并加了 `uk_gifts_code` 唯一索引，见待办 4 ③。但**「生产库不要跑 seed」的结论不变**——理由已从「会产生重复行」变成「seed 会覆盖运营在后台改过的文案/价格」（坑点 20）
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

28. **「重复请求风暴」的三个乘数：`onMounted`+`onShow` 双触发 × 两条路径打同一端点 × store action 无 in-flight 合并** — 2026-09-08 生产实测（旧构建 `index-C7lMOwJj.js`，真实登录态，单次进个人页）：`GET /api/user/profile` **9 次**、`wallet/balance` 3 次、`user/certifications` 3 次、`POST /api/im/login` 1 次。三个乘数相乘：① `profile.vue` 同时写了 `onMounted(loadAll)` 和 `onShow(loadAll)`，而 uni-app 首次显示页面**本来就会触发 `onShow`**，于是 `loadAll` 跑两遍、加上 `restoreSession` 那一次共 3 轮；② `loadAll` 内部调 `userStore.fetchProfile()`，另有一个 `refreshSocialStats()` 调 `userApi.profile()` —— 两者**是同一个端点**（`api/index.js:19`），却当成两件事各发一次，每轮 2 次；③ store 的 `fetchProfile()` 没有 in-flight 合并，同一 tick 的并发调用各自发请求。3 × (2+1) = **9**，算术闭合。
    - **修法三处**：删掉 `onMounted`（`onShow` 已覆盖首次显示）；把 `refreshSocialStats()` 改成纯函数 `applySocialStats(profileData)`，复用 `loadAll` 里 `fetchProfile()` 已拿到的那份数据、不再单独发请求；`store/user.js` 加 `let _profilePromise = null` 做 in-flight 合并（`.finally()` 里复位）。**生产实测结果（`ae63f5c` 上线后，真实入口 home → 点「我的」tab）**：`/user/profile` **9 → 2**、`wallet/balance` **3 → 1**、`user/certifications` **3 → 1**。剩下的 2 次分别是 `App.vue:122` onLaunch 与页面 `onShow`，相隔 43 秒、in-flight 闸门吃不到，属预期下限。⚠️ **深链直入 `#/pages/profile/profile` 会量到 3**（uni-app H5 在该入口下让 `onShow` 触发两次），别误判成修复无效——详见待办 17。
    - ⚠️ **验证陷阱：本地测不出请求次数**。H5 构建产物里的 `BASE_URL` 解析成**绝对生产地址** `https://zyb001.cn/api`（不是相对 `/api`），所以「本地静态服务 + 反代拦截 API」对请求计数完全无效——本地 dist 会直连生产，且写入的合成假 token 会拿到 401 → `request.js` 的 `kickToLogin()` → `reLaunch` 到登录页，把探针和被测页面一起清掉。要数请求次数只能在**部署后用生产真实会话**测，且**入口必须是「home 整页载入 → 点 tabbar」**（深链直入会让 `onShow` 多触发一次，见待办 17），计数用页面内 `performance.getEntriesByType('resource')` 按路径分组收集 `startTime`。改前端时能做的最强本地证据是**产物结构对照**：比对生产 chunk 与新构建 chunk 里 `.profile(`、`onMounted` 的 import 绑定等指纹的出现次数。

29. **手写生产 SQL 必须自带 `SET NAMES utf8mb4;` 和自中止闸门 —— 否则脚本会「退出码 0 却把库改坏」**（2026-09-08 D4 礼物 16→22，两个陷阱都在真跑之前被挡下）
    - **字符集陷阱（致命且完全静默）**：容器内 mysql CLI 的 `character_set_client` 从 OS locale 推导、**不是 utf8mb4**，脚本文件里的 UTF-8 中文字节被当 latin1 解释。实测 `SELECT COUNT(*) FROM gifts WHERE name='点赞' AND active=1` → 不加 `--default-character-set=utf8mb4` 得 **0**，加了得 **1**（id 17）；所有中文名字在输出里显示成 `??`。后果链是静默的：`UPDATE ... WHERE name='<中文>'` 全部命中 **0 行** → 后续按 `code` 定位的 UPDATE 也跟着命中 0 行 → 而 `INSERT ... SELECT` 里的中文 name **照样插入，变成乱码行**。整个脚本退出码 0，看不出任何异常。
    - **连带后果：任何「期望 0 行」的中文断言都可能是假通过** —— 返回 0 行不是因为不存在，而是因为字面量被解坏了、匹配不上任何东西。所以这类断言必须**再做一次阳性对照**：同一个 IN 列表里混进一个已知存在的值，确认它精确返回 1 行，才能证明断言机制真的活着。
    - **修法**：脚本内**第一行**写 `SET NAMES utf8mb4;`，不依赖调用方记得传 CLI 参数（`SET NAMES` 是会话级，一次设置对同一文件的后续所有语句都生效，包括末尾的断言）。三个 D4 脚本 `scripts/sql/2026-09-08-gifts-{precheck,16to22,code-unique}.sql` 都已内置。
    - **★ 已验证的自中止闸门手法 ★** —— 断言不成立时往 NOT NULL 列写 NULL：
      ```sql
      INSERT INTO gifts (name, price, created_at, updated_at)
      SELECT NULL, NULL, NOW(), NOW() FROM DUAL
      WHERE <断言不成立的条件>;
      ```
      → `ERROR 1048 (23000): Column 'name' cannot be null` → mysql CLI 批处理模式遇错即停、退出码 1 → 连接关闭 → **未 COMMIT 的事务自动回滚**，生产库回到执行前状态。断言成立时 WHERE 为假、SELECT 出 0 行，什么都不插也不触发约束检查。MySQL 不支持无 FROM 的 WHERE，必须写 `FROM DUAL`。
    - **⚠️ 不要用「插一个已存在的 id 撞主键」做闸门**：第一版就是这么写的，在临时库里因为**恰好没有 id=1** 而直接插入成功、根本没中止，后续语句照跑。任何依赖既有数据的设计都是脆弱的——NOT NULL 违例只依赖 schema。
    - **闸门怎么放**：变更脚本每做完一个「必须命中 N 行」的步骤就卡一道（D4 的闸门 A 卡在 16 条 code 回填之后，专拦上面的字符集坑），`COMMIT` 之前再卡一道总断言（闸门 B：在售 22 行 / distinct code 22 / 在售行 code 无 NULL）。这样闸门一旦触发，`COMMIT` 永远执行不到。
    - **验证闸门本身也要用生产同款 schema**：取 `SHOW CREATE TABLE gifts` 照抄 DDL 建临时库（`baiye_gate_test`），**故意不插 id=1**，再逐项测四个行为：断言成立时静默不插行 / 不成立时 ERROR 1048 + 退出码 1 / 后续语句不执行 / 未提交事务在新连接里确实回滚。测完 `DROP DATABASE`——验证脚本若在中途被闸门中止，**它末尾的清理语句也不会执行**，临时库会残留在生产实例上（本次就残留了，已手工 DROP）。
    - 另：SQL 文件必须 `docker cp` 进容器再 `< /tmp/x.sql`，不能靠管道传（会丢字符集）；`mysqldump` 备份也要带 `--default-character-set=utf8mb4`，否则备份文件里的中文同样是坏的。

30. **「在线状态」的写入点必须在鉴权中间件，不在 Socket.IO connect —— 否则这个功能对主通道用户从来没生效过**（2026-09-08 D7 修，`8d935b1` + `c23824f`，生产实测通过）
    - **消费方只有一处**：`server/src/routes/user.js:121` 的 `isOnline = (now - lastActiveAt) < 5 分钟`，供首页/发现页的在线绿点。
    - **修复前唯一的生产者是 `app.js` 的 Socket.IO connect**，但主通道是官方 TUIKit、走腾讯云 IM 收发，**从不连自建 Socket.IO**。只有兜底页 `pages/chat/chat.vue`（IM 就绪时立刻 `redirectTo` TUIChat，几乎不存活）和 `pages/chat-list/chat-list.vue`（在 `pages.json` 里注册了，但**不在 tabbar、全项目没有任何入口导航到它**）会 `chatSocket.connect()`。生产实测：6 个真人用户里 **5 个 `lastActiveAt` 为 NULL**，剩下 1 个已 stale 31 小时 → 绿点对所有人恒为 false。任务 #43「Phase 3.1: 在线状态」当年标记完成，实际是个死功能。
    - **改法**：新增 `server/src/utils/presence.js`，在 `middleware/auth.js` 的 `auth` **和** `optionalAuth` 里各调一次 `touch(userId)`（`/user/discover` 用的是 `optionalAuth`，只挂 `auth` 会漏掉纯浏览场景）。主通道的活跃聊天会经 `POST /chat/im-sync` 回报、浏览会经列表接口，两条都覆盖到。`app.js` 的 connect 写入也改成走同一个 `touch`，避免两条路径各写一次。
    - **两个必须一起写的细节**：① **内存节流 60s**，且必须**显著小于**消费方的 5 分钟窗口，否则用户明明在线也会被判掉线；② `User.update(..., { silent: true })`，否则心跳会把 `users.updated_at` 刷成每分钟一次，毁掉「资料最后修改时间」的语义（全项目没有任何地方消费 `users.updated_at`，但别把它变成噪声）。
    - **生产实测证据**：一次 `GET /api/user/profile` 后 `last_active_at` 变成 2 秒前、`updated_at` 仍停在 3 小时前（`silent` 生效）；紧接着第二次请求 `last_active_at` **完全不变**（节流生效）；`GET /api/user/discover` 里 23 号 `isOnline=true`、`onlineIds=[23]`（修复前恒为 `[]`）。
    - **前端一行没改**：原计划要给 `chatSocket.js` 加 60s `setInterval` 心跳 + `visibilitychange` 守卫，但主通道根本不连 socket，加了也只覆盖那条几乎不存活的兜底路径，收益接近零还要担坑点 17 的 `document` 守卫风险。**别"顺手把前端心跳补上"。**
    - **管理员不会污染 presence**：`routes/admin.js` 用完全独立的 `x-admin-token` + `req.adminId`，不经 `auth`/`optionalAuth`，所以 `touch()` 永远拿不到管理员 ID（否则会把管理员 ID 当成用户 ID 写进 `users` 表）。

31. **AI 自动回复闸门：三个触发点收口在 `tryAiAutoReply` 入口，而「对方 lastActiveAt 超过 N 分钟才回复」这一条不能用**（2026-09-08 D7）
    - 触发点有三个：`chat.js` 的 im-sync、`chat.js` 的 `POST /chat/messages`、`app.js` 的 Socket.IO `message`。三者**都已经** gate 在 `other.userType === 'ai'` 上，所以闸门只加在 `tryAiAutoReply` 里，且必须在拉历史消息与调 LLM **之前**——否则被拦下的请求照样产生一次上下文查询和 token 花费。三个触发点零改动复用。
    - **⚠️「按对方活跃度决定要不要回复」这个思路在本项目是错的**：触发前提就决定了对端必是 AI 用户，而 AI 用户从不登录，`lastActiveAt` 恒为 NULL 或极旧（生产 11 个 AI 用户里 10 个是 NULL，唯一非空的 12 号已 stale 31 小时）。该条件**恒真等于没写**；反过来若把 NULL 当成「刚活跃」处理，会让 10 个 AI 用户**永久哑掉**。同理，「两个真人账号互发消息、期望日志出现 skip」这种验证场景**根本不可能触发** `tryAiAutoReply`（真人对真人不进这个函数），别照着写测试。
    - **真正落地的三条**：① `sender-is-ai`（发起方也是 AI 就不回）——**不是空防御**，生产 `messages` 29→30 真发生过一轮：AI 12 发给 AI 13，AI 13 回了本地兜底句。只到深度 1 未失控，是因为自动回复直接 `Message.create`、不会再进触发点；② `cooldown` 2 秒；③ `window-cap` 滚动 10 分钟内同一 AI 发送方最多 15 条。每次 skip 都打 `[ai-gate] skip reason=... conv=... sender=... ai=...`，否则「AI 怎么不回复了」这类问题无法定位。
    - **阈值依据（别重复我犯过的统计错误）**：闸门只数 `senderId = aiUser.id` 的回复。会话 `12-13` 两端**都是 AI 用户**，按会话统计消息数会把两边都算进去、得出「20 条/10 分钟」的**假峰值**；按单发送方统计，全站历史真实峰值是 **5 条**，真人↔AI 会话（`12-25`/`12-27`）是 2/3 条。所以 15 是「失控与 LLM 花费」的上限（约观测最坏值 3 倍），**不是业务限流**，别拿它去调对话体验。
    - **零污染验证手法**：在容器内直接 `require('/app/src/routes/chat').tryAiAutoReply({...})`，被闸门拦下时不会创建任何行。`cooldown` **不靠真实回复路径计时**——它会 `await` 腾讯 IM REST，可能 >2s，等它返回时冷却窗口已过期；改为插一条锚点消息、验完立刻 `destroy`。`window-cap` 不造 15 条垃圾消息，改用生产真实数据回放同一条查询、把 `limit` 换成 3，证明「limit 截断 + `length >= limit`」这个形状双向都对（`limit=3 / trueCount=3 → 触发`、`limit=15 → 不触发`）。实测：会话 `12-23` 消息数 1→2（放行 +1）→3（插锚点）→3（cooldown 拦下，不变）→2（删锚点）；`12-13` 33→33（sender-is-ai 拦下）；全站消息 308→309；探针残留 **0 行**。
    - **验证脚本必须放容器内 `/app` 而不是 `/tmp`**：`/tmp/x.js` 解析不到 `/app/node_modules`，直接报 `Cannot find module 'jsonwebtoken'`。用 `docker cp` + `docker exec -w /app baiye-server node x.js`，跑完删掉。

32. **管理 API 的鉴权曾是「token 以 `admin_` 开头就放行」，公网可伪造 —— 已收口成签名 JWT**（2026-09-08 P0，已修）
    - **旧实现有四份互不相同的弱副本**：`routes/admin.js:7-16`、`routes/config.js:22-27`、`routes/im.js:355-357` 三份**只检查 `token.startsWith('admin_')`，既不验签名也不查库**；`routes/banners.js:8-17` 多一步 `Admin.findByPk(id)` 但同样接受未签名的 `admin_<id>`。而 `POST /admin/login` 签发的就是字面量 `'admin_' + admin.id`。
    - **公网实测（修复前，https://zyb001.cn）**：带 `admin_1` 返回 200；带 **`admin_99999`（一个根本不存在的 id）也返回 200** —— 这一条证明连库都没查，不是「id 可猜」而是「无校验」。不带 header 返回 401（所以平时看着像有鉴权）。
    - **能读到什么**：`/api/admin/users` 返回**真实手机号**；`/api/admin/config/modules/{sms,oss,im}` 返回**明文阿里云 accessKeyId + accessKeySecret（两对）**、**腾讯 IM secretKey + sdkAppId + adminUserId**。**能写什么**：34 个写端点全敞开（封号、调余额、审批提现、退款、改配置中心、删动态/礼物/评论）。拿到 IM secretKey + adminUserId 后可直接调 v4 REST **读任意用户私聊记录并冒充任意用户发消息**。
    - **修法**：新建 `server/src/middleware/adminAuth.js` 作为**全站唯一实现**，四个路由文件改为 `require` 它。用 `jwt.verify` 验签 + `payload.type === 'admin'` 断言 + 有效期 12h。
    - **密钥必须是独立的 `ADMIN_JWT_SECRET`，「派生自 `config.jwt.secret`」这个方案已被证伪**：我第一版写的是 `process.env.ADMIN_JWT_SECRET || \`${config.jwt.secret}::baiye-admin\``，理由是「复用会让用户 JWT 变管理员令牌，强制新增环境变量又怕漏改把人锁在外面」。**但实测发现线上 `JWT_SECRET` 与仓库公开串逐字节相同（见坑点 33），派生值任何读过仓库的人都算得出来 —— 等于没修。** 最终设计：生产环境**必须**有独立且合格的 `ADMIN_JWT_SECRET`，缺失**或命中公开占位串**（判定见坑点 33 的 `config.isWeakSecret`）就 **fail closed**（`adminAuth` 返回 503、`signAdminToken` 抛错、`/admin/login` 用 `adminSecretMissing()` 返回 503、`config/index.js` 启动时打 WARN），只有非生产环境才退回派生值图方便。`ADMIN_JWT_SECRET` 缺失只锁管理后台、不影响用户端，所以是 503 而不是让整个 API crash。
    - **`/admin/login` 的 503 检查必须挡在「空库自动创建 superadmin」之前**，否则密钥缺失时仍会建出管理员行却没有令牌可签发，留下一个「存在但永远登录不了」的账号。
    - **`type:'admin'` 是纵深防御不是必需**：普通用户 JWT 里没有 `type` 字段（解码确认过），所以即使将来两个 secret 被配成同一个值，用户 token 仍过不了这条断言。
    - **查库那段必须带 `typeof Admin.findByPk === 'function'` 守卫**：`config.db.driver` 在本地开发是 `'json'`、生产是 `'mysql'`；JSON 驱动下 `define()` 返回的是 Collection 实例、**没有 `findByPk`**。签名校验才是真正的安全边界，查库只是拦掉「已被删除的管理员」，所以守卫失败时 `catch` 里**必须 fail closed**（返回 401），不能放行。
    - **API 层零改动，但有一处前端必须跟着改**：`admin/src/api/http.js:11-13` 把 `localStorage.admin_token` 原样塞进 `x-admin-token`，所以令牌换成 JWT 后请求侧不用动，用户只是**被要求重新登录一次**；`/admin/login` 的响应结构也刻意保持不变（`{token, admin}`）。**但 `:32` 的 401 跳转原先写的是裸 `window.location.href = '/login'`，而后台部署在 `/admin/` 子路径下**（`vite.config.js:9 base:'/admin/'` + `createWebHistory(import.meta.env.BASE_URL)`），裸路径会跳出后台落到用户端站点上。已改成 `` `${import.meta.env.BASE_URL}login` ``。**这个 bug 原先几乎不可达**：旧令牌是明文 `'admin_'+id`、永不过期，所以 401 分支基本不会触发；换成 12h JWT 后**每个已登录会话在部署后都会撞上它一次**——典型的「安全性修复把一个可用性缺陷变成必经路径」。router 内部的 `next('/login')` / `router.push('/login')` 是 base 相对的、天然正确，**只有裸 `window.location.href` 会逃出 base**。
    - **`req.adminId` 从 string 变成 number 是安全的**：消费方只有 `admin.js:245`（`extra.operatorId`）、`:531`（`handledBy`）、`:619`、`:1881`，且 `banners.js:15` 本来就赋的是 `admin.id`（number），number 才是既有先例。
    - **`banners.js` 有个容易漏的点**：它被**同时挂载在两个路径**上 —— `/api/banners`（`app.js:127`，公开）和 `/api/admin/banners`（`app.js:130`）。而它的 `router.post('/')` / `put('/:id')` / `delete('/:id')` 是把 `adminAuth` 挂在**路由级**而不是 `router.use`，所以**公开挂载点上的 `POST /api/banners` 修复前一样可伪造**。改这个文件时别只看 admin 挂载点。
    - **部署后系统化验证：24/24 PASS（2026-09-08，`d73a0c0` 上线后打生产 https://zyb001.cn）**。四组：① 旧攻击载荷全部失效 —— `admin_1` / `admin_99999` / `admin_` 打 `/api/admin/dashboard`、无 header 打 `/api/admin/users`、`admin_1` 打 `/api/admin/config/modules/sms`、`/api/im/diag`（有无 header 各一次）、公开挂载点 `POST /api/banners`、`POST /api/im/batch-import`，**九个全是 401**（修复前 `admin_1` 与 `admin_99999` 都是 **200**）；② 已轮换的旧 JWT 密钥伪造 `{id:23}` → 401、伪造 refresh → 401；③ 真实管理员登录仍可用 —— `/api/admin/login` 200、令牌是 **157 字符三段式 JWT**（不再 `admin_` 前缀）、payload 含 `type:'admin'` + `id:4` + `exp`，该令牌打 dashboard / users / config\modules\sms / im\diag / admin\banners **五个全 200**，且 `/api/im/diag` 响应里不存在 20 字符以上的 `secretKey` 明文；④ 用户端未受影响 —— 首页 / `/api/banners` / `/api/health` / `/admin/` 全 200。
    - **「401」本身不足以证明鉴权生效，必须验响应体来源**：nginx 也能返回 401（HTML 错误页），那种情况下应用侧改动可能根本没上线。所以额外断言了 401 是**应用自己的 JSON 信封**：实测 `{"code":401,"message":"管理员登录已过期，请重新登录"}` —— 这条 message 只在 `jwt.verify` 抛错的 `catch` 里出现，等于直接证明新的验签路径在跑。
    - **⚠️ 验证脚本自己踩了一次假失败（23 项里 20 项误报 ❌）**：getter 写成 `async () => (await req(...)).status`（返回**数字**），而断言谓词写的是 `(g) => g.status === 401`，对数字取 `.status` 恒 `undefined` → 谓词恒假。**症状极具误导性**：每行都打印出了正确的状态码（`→ 401`、`→ 200`），看起来像「值对但判定错」，容易反过来怀疑服务端。修法是让 `check()` 把数字归一化成 `{status:n}`。教训与坑点 32 之外的多次自测翻车同源：**断言层和被测层要用同一种数据形状，且第一次跑就该有「已知会失败」的对照项**——本轮所有项都 ❌ 恰恰是脚本坏了的信号，不是生产坏了的信号。
    - **★ 鉴权收口把 CI 弄红了，这是预期信号，要改测试而不是回退鉴权 ★**（2026-09-08，`07649c4`/`d73a0c0` 推送后 CI run #124/#125 的「后端测试」job 失败）：`server/test/banner.test.js:9` 原先写的是 `function adminToken(id=1){ return {'x-admin-token': \`admin_${id}\`} }`，注释还理直气壮地写着「与 Banner 路由 adminAuth 规则一致」——**测试本身在依赖那个漏洞**。收口后 5 项变红（`401` 而不是 `200`，其中「删除」那条因为 `created.body.data` 为 undefined 报 `TypeError`）。修法是改成 `signAdminToken(id)`（中间件导出的真签发函数），顺带让测试覆盖到「验签 + `type` 断言 + 查库」整条路径。**注意 `test/e2e.test.js:585` 本来就是对的**（走 `/api/admin/login` 拿真令牌），所以只有 banner 一个文件受影响；`testPathIgnorePatterns` 也把 e2e 排除在 CI 之外。
    - **纪律：改服务端鉴权/中间件后，推送前必须本地跑一次 `cd server && npx cross-env NODE_ENV=test npx jest --runInBand --forceExit`**（约 11s，13 个 suite / 113 项）。本轮我没跑就推，是靠 CI 才发现，白白多花一轮部署等待。测试环境事实：`test/setup.js` 设 `NODE_ENV=test` + `DB_DRIVER=json` + `JWT_SECRET='test-jwt-secret'`（15 字符，**故意短**），**不设 `ADMIN_JWT_SECRET`** → `isProd=false` 所以 `assertProdSecrets()` 直接返回、`adminAuth` 走派生值 `${config.jwt.secret}::baiye-admin`；JSON 驱动下 `Admin.findByPk` 不存在，查库那段被守卫跳过。新增的 `server/test/admin-auth.test.js`（18 项）就是这次修复的回归测试：旧伪造格式全部 401、用户 JWT 不能当管理员令牌、签名合法但缺 `type` 也 401、真令牌仍 200、`/api/im/diag` 只回 `secretKeyLen` 不回明文。

33. **GitHub 仓库曾是 public，AGENTS.md 明文发布过生产口令；仓库里的证书是占位文件**（2026-09-08 已去敏）
    - **可见性**：`api.github.com/repos/q2640962240/tongcheng` 未鉴权返回 200、`private=false`（private 仓库未鉴权会 404，所以这是可靠的判据；`github.com` 网页在本机被代理挡住返回 000，**要用 API 端点测**）。自 commit `b1d76dc` 起，公开的 AGENTS.md 里含 MySQL / Redis / 管理员口令、服务器 IP、SSH 私钥文件名、IM sdkAppId。**用户已决定改为 private**（控制台操作，不在本仓库内）。
    - **⚠️ 截至 2026-09-08 深夜复查，仓库仍然是 public**（同一条 API 判据：HTTP 200 + `"private": false`）—— 也就是说「改 private」这一步还没在控制台执行，**泄露窗口目前仍开着**。已完成的只是「不再往公开仓库里追加新口令」+「轮换掉公网可直接利用的 JWT 密钥」；MySQL/Redis/管理员口令虽然还留在 git 历史里，但靠「只绑 127.0.0.1」和「端口公网不可达」缓解（见下条）。**下次会话开头应重新用这条 API 判据复查一次**，别假设它已经 private 了。
    - **为什么 DB/Redis 口令泄露暂未造成远程利用**：`baiye-mysql` 只绑 `127.0.0.1:3306`、`baiye-redis` 只绑 `127.0.0.1:6379`，公网实测这两个端口 closed/filtered（22/80/443 OPEN，3000 closed）。所以泄露的 DB/Redis 口令**需要先拿到 SSH 或代码执行才能用**。`.env` 与 SSH 私钥本体从未入库。**但 JWT 密钥不同 —— 它走的是 443，公网直接可利用，见下一条。**
    - **★ 最严重的一条：两个 JWT 签名密钥也曾明文发布，且就是线上活密钥 ★** —— `docker-compose.yml:75,77` 写成 `${JWT_SECRET:-baiye_prod_jwt_...}` / `${JWT_REFRESH_SECRET:-baiye_prod_jwt_refresh_...}`，而服务器 `/opt/baiye/.env` 里的值与这两个 fallback **逐字节相同**（sha256 双向比对确认）。`middleware/auth.js:25` 只做 `jwt.verify(token, config.jwt.secret)`、不校验 issuer/audience，所以**任何人都能签一个 `{id:<任意用户>}` 的令牌冒充该用户**。生产实测（修复前）：伪造 id=23 的令牌打 `/api/user/profile` → **200 + 该用户资料**；用旧 refresh secret 伪造 `{id,type:'refresh'}` 打 `/api/auth/refresh` 同样能续期。影响面比坑点 32 的管理面更大——**可直接接管任意账号、送礼消耗其钻石、绑定自己的收款账号后提现其 giftIncome**。这也是坑点 32 里「派生 admin secret」方案作废的原因。
    - **2026-09-08 已轮换并验证**：服务器 `.env` 换成三个 `openssl rand -hex 32`（64 字符）新值（`JWT_SECRET` / `JWT_REFRESH_SECRET` / 新增 `ADMIN_JWT_SECRET`），旧 `.env` 备份为 `.env.bak-20260908-042948`，`docker compose up -d --no-deps server` 重建生效。轮换后实测：旧 access 密钥伪造 → **401**、旧 refresh 密钥伪造 → **401**、新密钥签发 → **200 且 data.id 正确**、6 个容器全 healthy、首页与 `/api/banners` 均 200。**代价是所有已登录用户被登出一次**（App 尚未上线、真实用户个位数，用户已批准）。
    - **部署后已系统化复验（`d73a0c0` 上线，24/24 PASS，明细见坑点 32 末）**。另有一条**便宜但容易被忽略的推理证据**：`docker-compose.yml:55` 设了 `NODE_ENV: production`，所以 `assertProdSecrets()` **一定**会在容器启动时执行；观察到 `baiye-server Up (healthy)` 就等于「自检跑过且通过」，也就是「`.env` 里的新密钥确实传进了新容器」。反过来，若 `.env` 漏了任何一个变量，这里会是 crash-loop 而不是静默降级。
    - **`assertProdSecrets()` + `isWeakSecret()` 的本地自测：15/15 PASS**（临时脚本，已删）。config 层 8 项：两值都合格 → 不抛；只缺 `JWT_SECRET` → 抛且点名该变量；只轮换了 access、refresh 仍是泄露旧值 → 抛且原因是「泄露的旧值」；`.env.example` 的长占位串 → 抛且原因是「公开的占位串」；`dev_secret` → 抛；16 字符 → 抛且原因含「长度 16 < 32」；非生产环境什么都不设 → 不抛且 `cfg.jwt.secret === 'dev_secret'`（开发体验未被打断）；生产环境只缺 `ADMIN_JWT_SECRET` → **不抛**但打 WARN（同时匹配 `/ADMIN_JWT_SECRET/` 与 `/503/`）。中间件层 7 项：合格密钥 → `adminSecretMissing()===false`、令牌三段式且无 `admin_` 前缀；缺失 → `true` + `signAdminToken` 抛 `/无法签发/` + 中间件 503 且 `next` 未被调用；占位串 → 同样 `true` + 503；`admin_1`/`admin_99999`/任意串/空串 → 全 401；**用 `JWT_SECRET` 签的用户令牌 → 401**（两把密钥确实独立）；**用 ADMIN 密钥签但 payload 无 `type` → 401**（纵深防御有效）；非生产什么都不设 → 派生值仍可用。
    - **⚠️ 轮换的部署顺序陷阱**：新 `docker-compose.yml` 用了 `${JWT_SECRET:?必须在 .env 设置}` 强校验，**compose 的任何子命令（含 `ps`/`config`/`logs`）在变量缺失时都会直接失败**。所以必须**先在服务器 `.env` 写好三个密钥、再推这份 compose**，顺序反了会让 CI 部署整段中断。
    - **为什么不能只删 fallback 不轮换**：`process.env.JWT_SECRET || 'dev_secret'` 意味着环境变量为空时会**静默退化成人尽皆知的 `dev_secret`**，比泄露值更糟。所以 `config/index.js` 加了 `assertProdSecrets()`：生产环境下 `JWT_SECRET`/`JWT_REFRESH_SECRET` 若为空、命中公开占位串、长度 <32、或 sha256 命中已泄露值清单，就在**模块加载时抛错**让容器 crash-loop（刻意 fail fast，静默带病运行更危险）。已泄露值用 **sha256 常量**比对而不是明文，避免把密钥又写回源码。
    - **拒绝名单里必须包含 `.env.example` 的示例串** —— 那几串（`please_change_to_a_strong_random_secret_at_least_32_bytes` 等）长度都 >32，**只靠长度检查会漏掉**，照抄示例文件部署生产同样等于密钥公开。判定逻辑抽成了 `config.isWeakSecret(v)`（返回原因字符串或 null），`middleware/adminAuth.js` 复用它：生产环境下**弱 `ADMIN_JWT_SECRET` 等同于「未配置」** → 管理接口 503 fail closed，而不是拿一个公开串去签管理员令牌。`ADMIN_JWT_SECRET` 在 `assertProdSecrets()` 里**只打 WARN 不抛错**，因为它只锁管理后台，为它 crash 整个服务代价不对等。
    - **compose `:?` 强校验已预检通过（2026-09-08，服务器实跑）**：分别去掉 `ADMIN_JWT_SECRET` / `JWT_SECRET` / `JWT_REFRESH_SECRET` 后 `docker compose --project-directory /opt/baiye --env-file <残缺env> -f <新compose> config` 三次都是 **exit=15** 且错误信息点名对应变量；用完整 `.env` 则 **exit=0**。⚠️ 预检时**必须指向新文件**：第一次误把 `-f` 指到服务器上仍是旧版的 `/opt/baiye/docker-compose.yml`（旧版没有 `:?`），得到了「竟然成功了」的假阴性结论。

    - **仓库里的 4 个 pem 是占位证书，不是活证书**：`deploy/certbot/etc/letsencrypt/live/zyb001.cn/{cert,chain,fullchain,privkey}.pem` 的 subject/issuer 均为 `O=BaiYePlaceholder`、自签名、2026-08-29→2036-08-30。三方 modulus 比对证明 `privkey.pem` **不是线上 TLS 私钥**（仓库 / 线上证书 / 服务器工作树三者 modulus 各不相同）。已 `git rm --cached` 取消跟踪。
    - **取消跟踪为什么不会打断 HTTPS**：`.github/workflows/deploy.yml:84-171` 有三重证书保护 —— ① `git reset --hard` **之前**，若工作树证书是真的（subject 不含 `BaiYePlaceholder` **或** issuer 匹配 `Let's Encrypt|R3|ISRG`）就备份到 `/root/.baiye-certs-backup` 并置 `restore_flag=1`；② reset **之后**从备份还原；③ Fallback 1 = 宿主机 `/etc/letsencrypt/live/zyb001.cn`（须 LE 签发）；④ Fallback 2 = 备份目录。服务器上这三个来源**实测都是真 LE 证书**（notBefore 2026-09-06 / notAfter 2026-12-05）。`docker-compose.yml:140` 挂的是**宿主机路径** `./deploy/certbot/etc/letsencrypt`，与 git 跟踪与否无关；reset 删掉文件后脚本会 `mkdir -p` + `cp -f` 还原，之后它们在服务器上变成 untracked，`reset --hard` 不再动它们。
    - **★ 上面这套推理已经过部署实测（2026-09-08，`d73a0c0`，这是第一次真的执行「reset 删掉已跟踪的 4 个 pem」）**：部署后 `openssl x509 -in /opt/baiye/deploy/certbot/.../fullchain.pem -noout -subject -issuer -enddate` 得到 `subject=CN=zyb001.cn`、`issuer=C=US, O=Let's Encrypt, CN=YR1`、`notAfter=Dec 5 2026` —— 仍是真 LE 证书，不是仓库里的占位文件；同时首页 / `/api/banners` / `/api/health` / `/admin/` 四项 HTTPS 请求全 **200**，6 个容器全 healthy。**一个容易踩的细节**：实测 issuer 的 CN 是 **`YR1`**，既不是 `R3` 也不是 `ISRG`，deploy.yml 那条正则**靠 `Let's Encrypt` 这个 O 字段命中**——将来若把正则收窄成只认 `R3|ISRG` 就会误判成真证书不在场，别去「精确化」它。
    - **`.gitignore` 早就覆盖了**：`:25 *.pem`、`:26 *.key`、`:50 deploy/certbot/`、`:21-23 .env`。这 4 个文件是**在规则生效前就被提交**的，所以「已跟踪」压过了 ignore。验证覆盖必须用 `git check-ignore -v --no-index <path>` —— **不加 `--no-index` 时已跟踪文件恒报 NOT IGNORED**（默认会查索引），本轮就被这个坑误导过一次。
    - **去敏范围不止 AGENTS.md**：同一批口令还散落在 `docs/HANDOVER.md`（含阿里云 AccessKeyId）、`docs/PROJECT.md`、`.trae/rules/deployment.md`、`scripts/sql/*.sql` 的注释里。**只删 AGENTS.md 等于没删**，四处一并处理。
    - **⚠️ 未处理残留**：`docker-compose.yml` 里 **JWT 两个 fallback 已改成 `${VAR:?}` 强校验**，但 `DB_PASSWORD: "${MYSQL_ROOT_PASSWORD:-<活口令>}"` 与 `REDIS_PASSWORD: "${REDIS_PASSWORD:-<活口令>}"` **仍是明文活口令**（服务器 `.env` 里的值与之相同）；管理员口令本轮**用户明确选择不改**；git 历史未清理（清理需 force-push，要单独报批）。MySQL/Redis 那两处要动必须「改 `.env` 口令 + 去 fallback」两步一起做，见「服务器信息」节末。

34. **同批查出的三个次级问题：无鉴权孤儿端点、永远为 undefined 的管理员判定、空库自动引导**
    - **`GET /api/im/diag` 曾完全无鉴权**，公开返回 `sdkAppId` / `adminUserId` / `secretKeyLen` / `cloudSecretIdFilled` / `cloudSecretKeyFilled`，外加**内部 UserSig 签名算法描述**和管理后台 URL（**不返回 secretKey 本身**，只给长度）。全仓库 `admin/src`、`app/src`、`server/src` **零调用方**，是纯孤儿端点，加 `adminAuth` 不会破坏任何功能。教训：写「排障用」端点时默认它会一直留在生产上，必须自带鉴权。
    - **`routes/posts.js:169` 的 `req._adminAuth` 全仓库从未被赋值**，所以 `DELETE /api/posts/:id` 的「作者或管理员」分支是**死代码**，真正的管理员删帖路径是 `admin.js:1440`（D1b 已补）。属残留，未清理。教训：看到 `req.xxx` 判定前先 `git grep` 它在哪里被**写入**，只搜读取点会误以为它有效。
    - **`/admin/login` 有空库自动引导**：若 `admin` 表查不到任何行，`username === 'admin' && password === 'admin123'` 会**自动创建一个 superadmin**。生产库该行已存在所以分支不触发，但**全新环境上第一个访问该端点的人就成为超管**。未修（超出本轮范围），部署新环境时要注意先把库初始化好再暴露端口。
    - **网关日志留存极短，事后审计能力接近于零**：`baiye-gateway` 容器内 `access.log -> /dev/stdout`、`error.log -> /dev/stderr`，**无落盘、无轮转**，`baiye_gateway-logs` 卷里只有这两个符号链接。容器 2026-09-07T19:47:39Z 启动，`docker logs` 总量仅 19KB ≈ 9 小时。想查「有没有被利用过」只能覆盖到这 9 小时。**在这 9 小时里已确认有主动扫描**：`195.182.16.23` 打 `GET /SDK/webLanguage`（已知设备漏洞探测路径）、`119.249.100.x` 打 robots.txt ×4、PerplexityBot、百度蜘蛛若干。若要长期审计需给 nginx 配落盘 + logrotate。

35. **★ 封掉伪造洞 ≠ 管理后台安全了：合法口令 `admin`/`admin123` 本身是公开的且可用，而后台根本没有「改自己密码」这个功能 ★**（2026-09-08 坑点 32 收口之后查出，尚未处置）
    - **反讽的证据来源**：坑点 32 那份 24/24 PASS 的验证脚本，C 组「真实管理员登录必须仍然可用」就是**从公网用 `admin`/`admin123` 登进去的** —— 拿到 200 + 157 字符的 12h JWT，然后 200 读到 `/api/admin/users` 的真实手机号、`/api/admin/config/modules/sms` 的明文云 AK/SK、`/api/im/diag`、`/api/admin/banners`。**「真令牌仍可用」这一项在证明功能没被锁死的同时，也证明了合法入口大开。** 以后写这类验证脚本，要把「我用的是什么凭证、这凭证是否公开」当成一条独立结论读出来，别只当成功路径的垫脚石。
    - **上次「不改密码」的决定前提已经反转**：当时鉴权有 `admin_1` 伪造洞，改不改密码都拦不住人，所以口令不是瓶颈；洞封了之后，口令**变成唯一入口**，而它是公开的。
    - **穷尽验证：改密功能不存在**（别再去后台里找）—— ① `server/src/routes/admin.js` 的全部路由里**没有任何管理员改自己密码的端点**，只有改**用户**密码的 `:337-343` / `:386-390`（走 `User.setPassword`）；② `admin/src` 里 `password` 字段只出现在三处：`Login.vue`（登录表单）、`Settings.vue:132`（配置中心 `v-else-if="f.type === 'secret'"` 的密钥输入框，与管理员口令无关）、`Users.vue`（改真人/AI **用户**的登录密码，`form.password=''` 表示不改）；③ `admin/src/router/index.js` 的 21 条路由（login / dashboard / users / chat-records / services{,/categories} / orders / finance{,/elite-orders} / invite / content / discover/{posts,groups} / operations/{banners,announcements,sign-ins} / auth/certifications / gifts / content/{comments,reviews}）里**没有对应页面**。
    - **所以 `README.md:337` 的「登录后『管理员信息』立即改密」是文档承诺了一个不存在的能力** —— 本来归 D12「删假文案」，但它现在有安全含义：它会让人以为风险已经可以自己关掉。
    - **生产 `admins` 表只有 1 行**（2026-09-08 实测，只打印非敏感字段）：`id=4 / username=admin / role=superadmin / hashLen=60 / hashIsBcrypt=true`。与坑点 32 里 JWT payload 的 `id:4` 吻合。改密不会漏掉别的账号。
    - **`Admin` 模型没有 `setPassword`，靠 `password` 的 setter 自动 bcrypt**（`models/Admin.js:17-26`）：`set(val)` 里 `isBcryptHash(str) ? str : bcrypt.hashSync(str, 10)`，所以 `a.password = '新口令'; await a.save()` 就够了，且**重复赋值已哈希的值不会二次加密**。注意 setter 对空串是 `if (!str) return` **静默忽略**——传空密码不会报错也不会清空，任何改密脚本必须自己先卡长度。`verifyPassword()` 还兼容明文老数据（`isBcryptHash` 为假时直接字符串比较）。
    - **★ 已验证的「零残留」改密预演手法：事务 + rollback ★** —— 想在生产证明写路径通、又不想真改口令，就在一个事务里改、reload、验证，然后回滚，再在事务外确认哈希一字未变：
      ```js
      const t = await seq.transaction()
      const a = await Admin.findOne({ where: { username: 'admin' }, transaction: t })
      const before = String(a.password)
      a.password = pw; await a.save({ transaction: t })
      const b = await Admin.findOne({ where: { username: 'admin' }, transaction: t })
      // → hashChanged=true hashLen=60 isBcrypt=true verifyNew=true
      await t.rollback()
      const c = await Admin.findOne({ where: { username: 'admin' } })
      // → hashUnchanged=true decoyRejected=true
      ```
      实测输出正是这两行。**这比「拿真口令试一次」安全得多**，且顺带证明了 setter、bcrypt、save、reload、verifyPassword 整条链在生产容器里都活着。
    - **交给用户自己跑的命令必须让口令走 stdin，不能进 argv** —— `docker exec -e PW='...'` 或 `node -e "...'字面口令'..."` 都会出现在本机 shell history、远端 `ps` 和对话记录里。可用的形态是 `read -rs NEWPW` → `printf '%s' "$NEWPW" | ssh ... "docker exec -i -w /app baiye-server node -e '...'"`，脚本内用 `require('fs').readFileSync(0,'utf8').trim()` 读 fd 0。**两个踩过的坑**：① `readFileSync(0)` 要求 stdin 是管道（`ssh` 不加 `-t` 时天然满足）；② 通过 ssh 传 `node -e '...'` 时脚本在**本机双引号内**，所以脚本里的 `"` 要写成 `\"`，而 **`$` 会被本机 bash 先展开**——正则 `/^\$2[aby]\$/` 这种会被啃掉反斜杠，改用模型导出的 `Admin._isBcryptHash(v)` 就完全不用写 `$`。另：`process.stdin.on('end', ...)` 后面**不要**再跟 `()`，那是把 stream 当函数调，会报 `process.stdin.on(...) is not a function`。
    - **仓库内 `admin123` 在当前 HEAD 有 26 处命中（不只是 git 历史）**：`README.md:74,88,304,337`（**把它当默认凭证公开发布**）、`server/src/routes/admin.js:19,22`（**活代码**：坑点 34 的空库自动引导）、`server/src/seed.js:14,137,141`、`server/.env.example:139`、`deploy/02-deploy-app.sh:140,219`、`deploy/04-first-boot.sh:57`、`server/scripts/smoke-check.js:29`、`smoke-extended.js:37`、`_e2e_diagnose.js:58,116,191`、`scripts/setup-test-accounts.js:112,170`、`server/test/e2e.test.js:581,582`、`.trae/specs/.../tasks.md:189,194`、`spec.md:70`、`AGENTS.md:242`。
    - **优先级判断：改活口令能一次性作废这 26 处对生产的威胁** —— 公开的那个字符串不再对应任何活凭证。剩下的仓库清扫解决的是**另一个**问题：「新部署天生弱口令」（尤其 `admin.js:19-22` 那段活代码 + `README.md` 的 4 处发布），归 D12。**别把两件事混成一件，也别指望只做仓库清扫就能关掉线上的洞。**
    - **⚠️ 截至 2026-09-08 深夜再次复查，GitHub 仓库仍是 `private: false`**（同一条 API 判据），坑点 33 里「用户会在控制台改 private」这一步**仍未执行**，泄露窗口开着。

36. **z-paging 接入规范（2026-09-08 D8 落地，试点 `pages/transactions/transactions.vue`）** — 版本 `z-paging@2.8.8`（npm，MIT，明确支持 vue3 + 全平台）。它自带 renderjs 与 wxs、且本身是 Options API，**不踩坑点 19**。
    - **★ easycom 必须写三条规则，计划里那条通用规则单独用会直接构建失败 ★** —— npm 包的 `components/` 下只有 5 个标准目录，但 `z-paging.vue` 内部还用了 `<z-paging-refresh>` 和 `<z-paging-load-more>` 两个标签，它们的文件在**非标准路径** `components/z-paging/components/` 下，而 `z-paging.vue` **没有 `components:` 选项**、完全依赖 easycom 解析。只写通用规则 `"^z-paging(.*)"` 会把它们映射成不存在的 `components/z-paging-refresh/z-paging-refresh.vue` → `Rollup failed to resolve import`。`pages.json` 现在的写法（**两条精确规则必须在通用规则之前**，easycom 按对象键插入顺序取第一个命中）：
      ```json
      "easycom": { "autoscan": true, "custom": {
        "^z-paging-refresh$": "z-paging/components/z-paging/components/z-paging-refresh.vue",
        "^z-paging-load-more$": "z-paging/components/z-paging/components/z-paging-load-more.vue",
        "^z-paging(.*)": "z-paging/components/z-paging$1/z-paging$1.vue"
      }}
      ```
      `pages.json` 原先**没有 `easycom` 节点**，是 D8 新加的（加在第一个顶层键）。
    - **哪些页面接、哪些不接**：接 = 纯列表 + 后端给真实 total 的分页页（transactions 已接；D11 计划迁移 4 页）。**明确不接** = `home.vue`（多区块拼装 + banner + 横向滚动，不是单列表）、`chat.vue` / TUIChat（消息列表由 SDK 驱动，且有坑点 14 的「只播一次」基线逻辑，换分页容器会动到那套 watcher）。
    - **`complete()` 的成功失败两路**：成功用 **`completeByTotal(list, total)`**（`js/modules/data-handle.js:238`）——后端 `paginate()` 已经给了真实 total，比默认的「本页条数 < pageSize 就认为到底」更准；失败用 **`complete(false)`**，组件会展示失败态而不是静默停在空列表。**注意 `complete(false)` 与自定义 `#empty` 的冲突，见下一条。**
    - **★ 自定义 `#empty` 会顶掉内置失败视图，必须自己接住 `isLoadFailed` ★** —— `z-paging.vue:153` 是 `<slot v-if="zSlots.empty" name="empty" :isLoadFailed="isLoadFailed"/>` **`v-else`** 才渲染 `<z-paging-empty-view>`，而「加载失败，点击重试」这个 affordance 只存在于后者。所以一旦写了自定义空态，网络失败时页面会**谎报「暂无交易记录」**（本轮实测确认，断后端后空态文案一字未变）。修法是把插槽作用域参数接出来分流文案 + 整块可点重试：
      ```vue
      <template #empty="{ isLoadFailed }">
        <view class="empty" @tap="isLoadFailed && reload()">
          <text class="empty-text">{{ isLoadFailed ? '加载失败' : '暂无交易记录' }}</text>
          <text class="empty-sub">{{ isLoadFailed ? '点击重试' : '首次交易将在这里显示' }}</text>
        </view>
      </template>
      ```
      实测双向通过：停后端 → 显示「⚠️ 加载失败 / 点击重试」；起后端后点这块 → 恰好 1 次 `page=1` 请求、200、20 条、空态消失。
    - **★ `onShow` + `auto` 会叠加成「同一端点两次请求」（坑点 28 那一类）★** —— uni-app 首次进页面本来就触发 `onShow`，而 z-paging 的 `auto` 又会在 mounted 自发一次 `@query`。必须 `let firstShow = true`，首次 `onShow` 直接 return，只在「从别的页面返回」时才 `reload()`。实测首次进入**恰好 1 次** `/api/wallet/transactions`。
    - **`#top` 插槽替代 `position: sticky`** —— 筛选条放进 `#top`（在滚动容器之外，天然吸顶），原来的 `position:sticky; top:0; z-index:5` 整段删掉。顺带消除了坑点 22 里「sticky 计入 scrollable overflow」的那处隐患。
    - **fixed 模式下页面根元素不要抢布局** —— z-paging 自己算高度并用 `systemInfo.windowTop` 处理原生导航栏偏移（`js/modules/common-layout.js:18` + `z-paging-main.js:308-309`）。实测 `.z-paging-content` 拿到的是 `position:fixed; top:44px; height:597.6px`，**完全正确**。所以页面根类只留背景色，把原来的 `min-height:100vh` 和 `padding-bottom: calc(32rpx + env(safe-area-inset-bottom))` 都删掉。
    - **`enablePullDownRefresh` 互斥规则，以及本轮查出的「反向失效」形态** —— 坑点 25 讲的是「开了配置没写回调 → 转圈不消失」；transactions 是**反过来**：写了 `onPullDownRefresh` 回调，但 `pages.json` **从来没给这个页面开** `enablePullDownRefresh`（全站只有 `pages/home/home` 与 `pages/discover/discover` 开了），所以那段回调是**死代码，用户在这个页面从来没下拉刷新成功过**。接 z-paging 时这段回调连同 `onReachBottom` 一起删掉即可，计划 8c 说的「必须同时删掉 pages.json 配置」对试点页**不适用**（它压根没配）——z-paging 是在**新增**一个此前不存在的下拉刷新。规则本身不变：**接了 z-paging 的页面必须确保 `enablePullDownRefresh` 为 false/缺省，且不留 `onPullDownRefresh` 回调**，否则一次下拉两次请求。实测下拉手势单独触发恰好 1 次 `page=1` 请求且列表不重复。
    - **`box-sizing`**：坑点 22 的全局重置已覆盖 `view`/`scroll-view` 等标签，z-paging 编译后同样是 `uni-view`/`uni-scroll-view`，自动吃到。`.type-bar` 上那处存量补丁按坑点 22 的结论**保留不回收**。实测该页 `documentElement.scrollWidth - clientWidth = 0`。
    - **⚠️ App 端未验证** —— 本轮全部证据来自 H5（且是**生产模式构建产物**，不是 dev server）。z-paging 官方声明支持 App，但本项目的 App 端尚未打包实测，与待办 16 的 iOS 清单一起过。小程序端也未验证。
    - **★ 顺带查出一个既有的全局缺陷（不是 D8 引入，未修）★**：`App.vue` 全局样式给 `uni-page-body` 写了 **`min-height: 100vh`**，而它坐在 44px 原生导航栏**之下**（`uni-page-wrapper` 只有 597.6px）→ `uni-page-body` 变成 top=44 / height=641.6 / bottom=686，**每个带原生导航栏的页面都凭空多出 44px 竖向滚动**（`documentElement.scrollHeight - clientHeight = 44`）。对照验证：`pages/wallet/wallet` 内容本身就比视口高（pageBody 1043px），min-height 不是约束项所以看不出来；transactions 因为列表被 fixed 容器接管、pageBody 内容高度≈0，min-height 才成为约束项暴露出来。**这正是坑点 18 警告的 `100vh` 类问题。** 候选修法是 `min-height:100vh` → `min-height:100%`（父级 `uni-page-wrapper` 有确定高度 597.6px），但它影响全部 33 个页面、需要单独一轮逐页验证，**不要在别的任务里顺手改**。
    - **本地验证手法（可复用，且比 dev server 可靠）** —— `npm run dev:h5` 在本项目**当前是坏的且零报错**：`main.js` 里 `import { createVueApp as createSSRApp } from 'vue'` 的裸标识符**不被改写**（同文件里 `pinia`、`@dcloudio/uni-h5` 都被正常改写成 `/node_modules/...`，`App.vue` 的导入也正常），浏览器报 `Failed to resolve module specifier "vue"` → **module script 根本不执行** → `#app` 空、`window.uni` undefined、只发 3 个请求、**console 零错误**。清 `node_modules/.vite` 重启无效（`deps/` 里只有 5 个 tencentcloud + i18next，**从来没有 `vue.js`**）。**诊断钥匙**：在页面里手动 `await import('/src/main.js')`，才会把被吞掉的错误抛出来。**可用替代路径**：`npm run build:h5`（产物与 CI 同源）+ 一个 ~50 行的 node 静态服务把 `dist/build/h5` 挂在 5173 并把 `/api` 反代到本地 3000 → 能走完整 UI 登录（本地 `POST /api/auth/sms` 的 `data.code` 恒为 **`888888`**），且测的就是要上线的那份产物。
    - **⚠️ 两个配套陷阱**：① **Git Bash 会把 `/api` 形式的环境变量值转换成 Windows 路径** —— `VITE_API_BASE=/api npm run build:h5` 产物里出现的是 `"C:/Users/chen/AppData/Local/Programs/Git/api"`（静默、构建照样成功）。改用文件 `.env.production.local`（已被 `.gitignore:22 .env.*` 覆盖）写同一个值就正确内联成 `"/api"`。与坑点 26 的 `curl --data-urlencode` GBK 问题同源：**Windows Git Bash 会在你不注意时改写你传给原生程序的字符串**。② **本地后端别用 `npm run dev`（nodemon）** —— 它默认监视整个 cwd，包含 `data/*.json`；而 D7 的 `presence.touch()` 每个鉴权请求都写 `last_active_at` → 触发重启 → 内存里的 60s 节流表丢失 → 下个请求又写 → **自激重启循环**，浏览器侧表现为登录后一片 502。用 `node src/app.js` 直接跑。

## 服务器信息

> ⚠️ **本表刻意不含任何口令。** 生产凭证（MySQL / Redis / 管理后台账号密码 / SSH 私钥路径 /
> 阿里云 RAM AK）统一存放在**本机记忆库**：
> `C:\Users\chen\.qoder-cn\projects\D--tongcheng-companion-play-app\memory\reference-server-access.md`
> 该文件不在 git 仓库内、不会被推送。需要口令时去读它，**不要写回本文件**。
>
> 历史包袱：本表自 commit `b1d76dc` 起在 **public** 仓库里明文发布过 MySQL / Redis / 管理员口令，
> 2026-09-08 已移除（见坑点 33）。git 历史仍可检出，且这批口令**尚未轮换**（用户本轮只选了轮换
> 阿里云 AK/SK 与腾讯 IM secretKey）。当前唯一的缓解是 MySQL/Redis 只绑 `127.0.0.1`。

| 项 | 值 | 是否机密 |
|---|---|---|
| IP | 114.55.225.77 | 否（`zyb001.cn` DNS 可解析） |
| SSH | `root@114.55.225.77`，密钥登录 | 密钥**路径**见记忆库 |
| 部署目录 | `/opt/baiye` | 否 |
| MySQL | 库 `companion_play`，容器 `baiye-mysql`，仅绑 `127.0.0.1:3306` | 口令见记忆库 |
| Redis | 容器 `baiye-redis`，仅绑 `127.0.0.1:6379` | 口令见记忆库 |
| 管理后台 | `https://zyb001.cn/admin/` | 账号口令见记忆库 |
| IM sdkAppId | 1600159799 | 否（`GET /api/im/config` 公开返回） |
| 容器名 | `baiye-gateway` / `-server` / `-admin` / `-h5` / `-mysql` / `-redis` | 否 |

**已知残留（未处理，改动需单独报批）**：`docker-compose.yml` 把 MySQL/Redis 口令写成
`${MYSQL_ROOT_PASSWORD:-<活口令>}` / `${REDIS_PASSWORD:-<活口令>}`，fallback 默认值就是生产口令
本身；服务器 `/opt/baiye/.env` 虽已设这两个变量，但值与仓库公开的默认值**完全相同**
（2026-09-08 实测 `MYSQL_ROOT_PASSWORD` len=11、`REDIS_PASSWORD` len=15）。要真正作废必须
「改 `.env` 里的口令 + 去掉 compose 的 fallback」**两步一起做**——只改 compose 会让 `.env`
缺失时静默用另一个口令起库，属于难排查的故障源。

## 待办事项

1. Android APK 打包 (HBuilderX 本地)
2. **配置中心密钥：短信/OSS/IM 已配好，剩支付、推送与 AI** — 2026-09-08 复核生产 `configs` 表全量（只数行数与非空值，不打印明文），共 **9 个模块**：
   | module | 行数 | value 非空 | 状态 |
   |---|---|---|---|
   | `sms` | 7 | 5 | ✅ 已配（空的 templateLogin/templateRegister 是可选覆盖） |
   | `oss` | 7 | 5 | ✅ 已配 |
   | `im` | 8 | 6 | ✅ 已配 |
   | `app` | 13 | 12 | ✅ 已配 |
   | `tasks` | 7 | 7 | ✅ 已配 |
   | `gift` | 1 | 1 | ✅ 已配 |
   | `wxpay` | 8 | **1** | ❌ 未配 |
   | `alipay` | 6 | **2** | ❌ 未配 |
   | `push` | 6 | **1** | ❌ 未配 |
   | `ai` | **0** | — | ❌ **表里一行都没有** |
   - **⚠️ `ai` 模块从未配置，所以线上 AI 自动回复历来全是本地兜底句，LLM 一次都没真正接通**（2026-09-08 D7 查证）。链路：`chat.js` 的 `_callAiWithFallback` 按「主用户 `aiConfig` → `configs` 的 ai 备份 → 本地策略」三层降级；而 11 个 AI 用户里 **12 号的 `aiConfig.apiKey` 与 `baseUrl` 长度均为 0**（只有 `model` 有 13 字符）、**13-22 号 `aiConfig` 整个是 NULL**，加上 `configs` 无 `ai` 行 → `_loadAiBackupConfig()` 返回 null → `candidates` 数组为空 → for 循环一次都不执行 → 立即落 `_pickLocalFallback`。**日志铁证**：`[AI-AUTO-REPLY] fallback → local. errors= ` —— errors 为空说明连一次 HTTP 请求都没发出去（发了就会有超时/401 之类的错误串）。要接通需在后台配置中心补 `ai` 模块（apiKey/baseUrl/model），或给 AI 用户逐个填 `aiConfig`。
   - ⚠️ 别再把「短信未配置」当既成事实——这条待办曾长期笼统写着「短信/支付/OSS/推送」都没填，导致误判线上无法登录。判断某模块是否可用要直接查 `configs` 表或调 `getModuleConfig()`，不要照抄本行。查询时**只打印 `CHAR_LENGTH(value)`，不要打印明文**
3. 钻石充值接入微信/支付宝支付
4. ~~礼物素材正式设计~~ **已完成，并于 2026-09-08 扩到 22 档（D4 生产已执行）** — 全部为 SVGA 矢量动画（L1-L3），图标由同一份 SVGA 抽帧生成，emoji 占位清零。见 ADR-0004。
   - **22 档阵容（sort / 名字 / 价格 / 等级）**：1 点赞 1 L1｜2 便便 2 L1｜3 绿帽子 5 L1｜4 扔鸡蛋 8 L1｜5 比心 10 L1｜6 星际少女 20 L1｜7 玫瑰 50 L2｜8 心动 80 L2｜9 一剑穿心 100 L2｜10 加油 150 L2｜11 钻石 200 L2｜12 天使 300 L2｜13 花好月圆 500 L2｜14 福袋 500 L3｜15 皇冠 1000 L3｜16 水晶球 2000 L3｜17 独角兽 5000 L3｜18 跑车 10000 L3｜19 旋转木马 20000 L3｜20 一锤定音 30000 L3｜21 流星雨 50000 L3｜22 缘定今生 88888 L3。加粗的 6 档（便便/绿帽子/扔鸡蛋/加油/一锤定音/缘定今生）是 D4 新增，其余 16 档 **name/price/素材路径一分未动，只重排了 sort**。
   - **计划偏离：最终是 22 档不是 26** —— 另外四个槽位的候选源素材抽帧后视觉上被否掉了（详见 `scripts/svga-tools/README.md`）。
   - ~~① **素材授权**~~ **用户已明确豁免（2026-09-08：「不用考虑授权问题，这个项目不会进行商用」）** — .svga 来自无 LICENSE 的仓库，以非商用为前提使用。**若将来要商用，这一项重新变成阻塞项。**
   - ② **App(WKWebView) 端未验证** — 依赖 `siteOrigin + /static/...` 绝对 URL 与 nginx 的 `/static/` CORS 头，需 HBuilderX 打包后实测（见待办 16）。
   - ~~③ **`gifts` 表缺稳定业务键**~~ **已完成（2026-09-08，D4）** — `code varchar(32)` 列已由 `db.bootstrap()` 的 `sync({alter:true})` 建出，22 行在售礼物全部回填（14 行 `active=0` 旧礼物保持 NULL、一律不碰），并加了 `uk_gifts_code` 唯一索引；`seed.js` 的 `DEFAULT_GIFTS` 已改成 22 条带 `code`、匹配逻辑改为 `byCode[g.code] || byName[g.name]`（name 只作兜底）。**坑点 16 与坑点 20 里「seed 按 name 匹配、改名会产生重复行」的说法自此过时**——但「生产库禁止跑完整 seed」的纪律不变（见坑点 20）。
   - **`yuanding.svga` 是 zip 容器（SVGA 1.x），必须靠 JSZip** — `svga.min.js` 的 zip 分支门控在 `JSZip`/`JSZipUtils` 两个全局上，npm 构建不打包它们。`SvgaStage.vue` 的 `ensureLib()` 因此在加载 `svga.min.js` **之前**先注入 `/static/lib/jszip.min.js` 与 `jszip-utils.min.js`（两者加载失败不阻断，绝大多数素材是 zlib+protobuf 走不到 zip 分支）。**双向实测证据（2026-09-08 生产 H5）**：三个全局齐备时 `yuanding.svga` 解析出 `videoSize 750×1334 / 100 帧 / 17 张图`（zip entry 名 `img_72` 等，值为 base64 字符串）；**只加载 `svga.min.js`、不加载 JSZip 时精确复现 `incorrect header check`**（掉进 proto 路径的 pako zlib 报错）——所以这个注入是必要的，不是 no-op。其余 5 个新素材不需要 JSZip：bianbian 60×60/75帧、lvmaozi 120×120/75帧、jidan 130×260/100帧、jiayou 750×1624/26帧、luochui 500×500/90帧。
   - **22 档上线实测（2026-09-08，生产 H5，视口 626×642）**：`GET /api/gifts` 返回 22 条、sort 1..22 连续；礼物商城 22 张卡片、26 张图 `naturalWidth` 全部 >0、0 破图、横向溢出 0；TUIChat 送礼面板 22 格全渲染、22 张图 0 破图、真实滚动层 `scrollHeight 749 > clientHeight 250`、滚到底 `scrollTop 499.2 == maxScroll 499` 且最后一格「缘定今生 88888💎」完整可见、`.gift-actions` 574–642 在视口内显示「请先选择礼物」。**6 个新素材的 png/svga 全部 HTTP 200**（yuanding.svga 588KB）。
   - ⚠️ **观察项：`luochui`（一锤定音，L3 全屏档，30000 钻）的 `videoSize` 只有 500×500**，而其它 L3 全是 750×1334/1624。AspectFit 下它在 390×844 的 holder 里渲染成 `390×390 @ 0,227`（铺满宽度、垂直居中、占屏高 46%），**画布内容占比 91%×91%**，所以不是「大黑屏里一小块」；但视觉冲击力弱于流星雨那种 `390×694`、内容 96%×82% 的满屏效果。**要不要把它降到 L2（82vw 方形 holder，更贴合方形素材）或换一个满屏源素材，等 iOS 真机眼看后再定**，不要凭数字单方面改。
   - 同理，`bianbian` 60×60 / `lvmaozi` 120×120 在 L1 的 46vw holder 里会被放大数倍——但这与既有的 `dianzan` 60×60、`bixin` 120×120 **完全同构**，不是 D4 引入的退化。
   - **未做真实送礼端到端**（会在生产留下 `gift_records`/`messages`/`transactions` 与一条**无法用 REST 删除**的 IM 云端消息，见待办 8）：新礼物行走的是与既有礼物完全相同的 `POST /api/gifts/send` → `Gift.findByPk(giftId)` 路径，且 API 已验证 6 个新字段（name/price/imageUrl/effectImage/animationLevel/sort）都正确下发，zip 容器解码也已双向验证，所以没有单独花钻石测。要补测的话最便宜的是「便便」2 钻。
5. 会话列表深色主题适配
6. ~~`diamondAmount` 字段语义不一致~~ **已修 (2026-09-08, `254234c`)** — 决定**以总价为准**。消息体里的 `diamondAmount` 保持「单价」语义不动（改它会让存量消息全部误读），改为**四个渲染点统一走 `totalDiamond ?? diamondAmount × quantity`**。关键的一点：**主通道走 `viaIM:true`，IM 消息体是前端 `message-input-gift.vue` 自己拼的**，服务端那份 `gifts.js:97-108` 只写进 DB Message，所以补齐字段要补在前端 payload（`quantity`/`totalDiamond`），不是补在服务端。已改的四处渲染：`message-custom.vue`(主通道卡片)、`chat.vue`(兜底卡片)、`GiftAnimation.vue`(本就已带 quantity，且不显示金额)、以及会话摘要三处（见待办 7）。**存量消息不会金额翻倍**：IM 云端的历史自定义消息两个字段都没有，但主通道数量恒为 1，`单价 × 1` 就等于实付总价——这也是当初担心的「改语义导致历史卡片翻倍」风险归零的原因
7. ~~会话列表礼物摘要显示「[自定义消息]」~~ **已修 (2026-09-08, `254234c`)** — 根因确认：Lite SDK 的 `getLastMessageText()` 对 `MSG_CUSTOM` 只解析 `payload.data` 判 `businessID === 1`（数字，CallKit），其余一律取 `messageForShow` 再过翻译表，**从不解析我们塞的 gift JSON**，所以服务端在 `Desc` 里传的「送出了N个XX」根本用不上。修法是在 `TUIConversation/conversation-list/index.vue` 加 `lastMessageSummary()`，**只接管 `businessID === 'gift'` 这一类**，其余原样交回 SDK（避免复刻它的草稿/撤回/群提示分支）；SDK 会前缀未读条数（如「[3条]」），接管正文时用正则从 fallback 里把前缀取回来，不自己复刻判定条件。自建通道两处（`server/routes/chat.js`、`chat-list.vue`）文案与之对齐。**顺带修了一个计划外的真 bug**：`chat-list.vue` 的 `lastText()` 对上游已格式化好的「[礼物] XX」做 `JSON.parse` 必失败，于是所有礼物摘要都退化成没有名字的「[礼物]」——现在解析失败就原样透传
   - **全站唯一残留的「[自定义消息]」已查明：Base64 时代产物，永久不可修，不要再排查**（2026-09-08，C2C27「星期日 03:00」= DB `messages#130`，giftId 2 / 50 钻 / 发于 2026-09-06 **03:00:40**）。真实根因是**时间线**：`1df9680`（2026-09-06 **22:33:23**）才把 `sendIMC2CCustomV4` 的 `MsgContent.Data` 从 `Buffer.from(JSON.stringify(data)).toString('base64')` 改成原样 JSON 字符串（即坑点 15）。这条消息发于同日 03:00，早于修复近 20 小时，**它的 IM `Data` 是一串 Base64**：接收端 `JSONToObject` 解析失败，`customData` 根本不是对象，既没有 `businessID` 也没有 `giftName`，于是落到 `v-else` 的 `<span v-html>` 显示「[自定义消息]」。IM 云端已投递的消息**无法用 REST 编辑或删除**，所以这条永久不可修；为它单加一段 Base64 解码没有收益（存量仅此一条测试期遗留）。
   - ⚠️ **我曾按错误诊断提交 `c87e52e` 并已回滚（`69d10ca`），别照着那条 commit message 重做** — 错误推理是：看到 DB `#124`/`#125`/`#130` 的 content 都缺 `businessID`，而 124/125 能渲染成礼物卡、130 不能，就归因于「130 走兜底通道、IM 载荷缺字段」，并把判定放宽成 `businessID === 'gift' || (!businessID && giftName)`。**生产证伪**：放宽逻辑确实上线了（chunk `index-Cow3J9lq.js` + `TUIKit-components-TUIChat-index.BYFVDIUC.js` 各命中 1 次 `businessID&&!!`），但那条消息**依旧**显示「[自定义消息]」。放宽条件针对的「JSON 合法 + 有 `giftName` + 无 `businessID`」这一类消息在服务端路径上**从未存在过**——`f79f912`（2026-09-06 **17:18:31**）给 `gifts.js` 的 `giftContent` 加上 `businessID`，而早于它的服务端消息**同时**也是 Base64 的（Base64 到 22:33 才移除）；主通道自 `a300484`（2026-09-05 22:29）起前端 payload 就一直带 `businessID`。所以那是死代码，还给 vendored TUIKit 的热渲染路径加了分支。
   - **方法论教训：DB 的 `messages.content` 不是 IM 载荷，二者不同源**。主通道（`viaIM:true`）的 IM 载荷由前端 `message-input-gift.vue` 拼，服务端 `gifts.js:97-108` 那份只写进 DB；兜底通道（`viaIM:false`）才由服务端转发。而且**生产 Vue 构建不给 DOM 挂 `__vueParentComponent`**、`window` 上也没有 TUI/TIM 全局，无法从 DOM 反查组件 props 来读真实载荷——要断言 IM 里到底是什么，只能靠 DB 时间戳对齐 + git 考古 + grep 构建产物 + `performance.getEntriesByType('resource')` 确认实际加载的 chunk 这几条间接证据。
8. **清理礼物特效验证期间的测试数据**（清理前逐项与用户确认，勿自作主张回滚）
   - **2026-09-06 批次**：`gift_records` 43-46（20→23 一条、13→23 三条）及对应 `messages` 245-248；用户 13/20 钱包被充值（现余 500/1500）；用户 23 的 `gift_income`(3783570 分) 与 `charm_value`(54051) 含测试污染
   - **2026-09-07 端到端验证批次**（全部 27→25，流星雨 ×2）：`gift_records` 57、58；`messages` 271、272；`transactions` 114-117。用户 27 钻石 629676→529676（−100000）；用户 25 `gift_income` 23119110→30119110 分（+70000 元）、`charm_value` 330273→430273（+100000）
   - **2026-09-07「只播一次」验证批次**（27→25，点赞 ×1，故意挑最便宜的）：`gift_records` 59；`messages` 276；`transactions` 118、119。用户 27 钻石 529676→529675（−1）；用户 25 `gift_income` +70 分（1 钻 ×100 分 ×70% 分成）。IM 云端另有 1 条点赞自定义消息
   - **2026-09-07「防连点/滚动」验证批次**（23→25，点赞 ×1，两轮连点各只扣一次）：`gift_records` 60、61；`messages` 283、284；`transactions` 120、122（用户 23 `gift_send` −1）与 121、123（用户 25 `gift_income` +70 分）。用户 23 钻石 10→8；用户 25 `gift_income` 30119180→30119320 分、`charm_value` 430274→430276。IM 云端另有 2 条点赞自定义消息（C2C 23↔25）
   - **归属不明**：`gift_records` 50-56（同日 00:31–05:24，27→25 的棒棒糖/小红花/冰淇淋/钻石戒指/烟花/跑车/水晶球）也疑似同期测试数据，但不是我这两笔，清理前先问。另 `messages` 277-279（06:29:46）与 280-282（07:01:55）是两组「27→24 文本 / 27→12 语音 / 27→27 自发自收」的三连发，同一秒内产生，来源未查清，清理前先问
   - **⚠️ 已查明归属，禁止清理**：`gift_records` 62-67 + `transactions` 124-135（2026-09-07 14:47:49 与 15:09:23–15:10:02，全部 27→25：旋转木马 20000 / 点赞 1 / 流星雨 50000 / 旋转木马 20000 / 跑车 10000 / 花好月圆 500，合计 **100501 钻**）是**用户本人在 iOS 真机上测试礼物特效**产生的真实送礼，不是 AI 测试污染。判定依据：本项目只有一个会话 transcript，当天首条记录是 15:15:55（用户发来那 4 张截图），而 08:00–15:00 之间 AI 侧零活动，送礼全部落在这个空档里。账目对账吻合：用户 27 钻石 529675→**429174**（−100501），用户 25 `gift_income` 30119320→**37154390** 分（+7035070 = 100501×100×70%）、`charm_value` 430276→**530777**（+100501）。**这批数据要保留**——它是用户自己的操作记录，也是那 4 张截图的现场证据。（顺带：`transactions` 124-135 的 `balance_after` 依旧带着待办 #12 的双计错误，例如 #128 记 409674、#130 反而回升到 419674）
   - **2026-09-08 D7 批次（presence + AI 闸门验证）——干净，只多 1 行，无需清理**：`messages` id **312**（2026-09-08 03:47:51，会话 `12-23`，AI 12 → 用户 23，text「哈哈，我刚才走神啦，你刚刚说的是……？」）是**闸门放行路径的真实产物**，不是探针。验证用的 cooldown 锚点行（content `D7-cooldown-probe`）验完已 `destroy`，`SELECT COUNT(*) FROM messages WHERE content LIKE '%D7-%probe%'` 复核为 **0**；window-cap 那组是「回放同一条查询、把 limit 换小」证明的，**零写入**。全站 `messages` 由 308 → **309**（已复核），差额就是 312 这一行。这批**不涉及钻石/收入/流水**，所以 `gift_records`、`transactions`、`wallets` 均无变化。副作用：users#23 的 `last_active_at` 被写成了验证时刻（这正是被测行为，且 `updated_at` 因 `silent:true` 未被 bump），IM 云端多 1 条 AI 12 → 用户 23 的文本消息
   - IM 云端消息无法通过 REST 删除，会残留在会话里（C2C 25↔27 至少含 2 条流星雨自定义消息；C2C 12↔23 含 D7 那 1 条 AI 文本）
9. **TUIKit 首屏空白竞态（原记录「偶发 + 刷新即恢复」已被 2026-09-08 生产实测推翻）** — 报错固定是 `Error in event handler for sdkStateReady: e.chat.getConversationList is not a function`。实测结论：**以 `#/TUIKit/components/TUIConversation/index` 作为入口路由（深链/整页重载）时列表必空，连刷两次都不恢复；改走「`#/pages/home/home` 整页载入 → 点消息 Tab」则 6 条会话全部正常渲染**。所以它不是偶发，是**入口路径决定的必现分支**，原先「刷新一次即恢复」很可能只是因为刷新后 uni 路由落到了别的入口。
   - **定位到哪一步**：console 里能看到 `_syncConversationList success count:6`，说明 **SDK 已经把会话拉回来了**；但紧接着 `TUIChatEngine.resetStore ok.` 之后 `sdkStateReady` 处理器抛错，TUIStore 没被填充 → 列表 DOM 停在 `tui-conversation` / `-header` / `-list` 各 1 个、`.tui-conversation-item` **0 条**（查选择器没错，列表真的是空的）。
   - **不是我们源码的问题**：`sdkStateReady` 处理器在三方 bundle 里（生产 `index-D6lcmXuO.js`），我们唯一一处 `getConversationList` 调用在 `TUIConversation/entry-conversation.ts:64-65`，已有 `typeof svc.getConversationList === 'function'` 守卫，且该文件的 `isReady()` 轮询（最长 10s）+ `TUIChatKit.init()/login()` 都跑完了，深链下依旧空白。**别再去改 `entry-conversation.ts` 试。**
   - **验证时要用的入口**：想看会话列表，一律走 home + 点 tabbar；想直连聊天页则必须整页重载 `?v=xxx#/TUIKit/components/TUIChat/index?conversationID=C2C25`（裸改 hash 会报「会话参数缺失」，见坑点 22 末）。
   - **尚未修复**。原先记的「与待办 13 的入口路径去重高度耦合、D6 要一并评估」**已作废**：待办 13 被证伪，且生产实测（2026-09-08，旧构建 `index-C7lMOwJj.js`，单次进个人页）`POST /api/im/login` 恒为 **1 次**——`kickOffTUIInit` 缓存 `_tuiInitPromise`、`ensureTUILogin` 自带缓存快路径与 `_loginPromise` 并发闸门，`restoreSession` / `App.vue:125` / `entry-conversation.ts:39` 三条路径**已经**收敛成一次真实登录。所以这里没有「登录去重」可做，排查方向应放在 `sdkStateReady` 处理器本身（在三方 bundle 里）与入口路由的差异上
10. **微信分享配置仍缺，但入口侧已收口（2026-09-08，D6 的 6c）** — `manifest.json` 有 `modules.Share: {}`，`sdkConfigs` 里**没有 `share` 节点**（缺微信 appid / UniversalLinks）。原症状是 `invite.vue` 的 `uni.share({ provider: 'weixin' })` 在 App 端必走 `fail`，而 fail 回调统一提示「分享取消」，把「未配置」伪装成「用户取消」。现已改成**运行时探测**：`probeWxShare()` 读 `plus.share.getServices()`，只有真拿到 `weixin` 服务且 `authenticated` 才把 `wxShareReady` 置真，action sheet 的两条微信项（好友 / 朋友圈）是动态拼进数组的，探测不到就**根本不出现**——用户不会再点到一条注定失败还谎报「已取消」的入口。**剩下的工作只是补配置**：`sdkConfigs.share.weixin`（appid + UniversalLinks）填好后探测自动变真、入口自动出现，前端代码无需再改。⚠️ 探测整段包在 `#ifdef APP-PLUS` 里，H5/小程序构建产物中 `WXSceneSession`/`getServices` 等字符串应为 0 个（已按产物验证）
11. **iOS ATS 与「服务器地址」热切换冲突** — `request.js` 支持在 App 内把 BASE_URL 改成 `http://电脑IP:3000/api` 便于联调，但 iOS App Transport Security 默认禁止明文 HTTP。打包后该调试入口在 iOS 上会静默失败，需确认 HBuilderX 生成的 Info.plist 是否含 `NSAllowsArbitraryLoads`，或联调时改用 HTTPS 隧道
12. **`transactions.balance_after` 把差额算了两次**（2026-09-07 生产端到端实测发现，未修）— `gifts.js:61` 的 `wallet.update({ diamond: wallet.diamond - totalDiamond })` 会**就地修改实例**，返回后 `wallet.diamond` 已是新值；而 `:81` 又写 `balanceAfter: wallet.diamond - totalDiamond`，等于扣了两次。接收方 `:67`/`:90` 同理（加两次）。实测证据：送 1 个流星雨（50000 钻）后，用户 27 真实余额 579676，`transactions#114.balance_after` 却记 529676；用户 25 真实 `gift_income` 26619110 分，`#115.balance_after` 记 30119110。**最小复现**（同日，故意送 1 钻的点赞）：用户 27 真实余额 529675，`#118.balance_after` 记 529674——差额正好等于一个礼物金额，收方 `#119` 的 +70 分同样翻倍，可排除其他干扰因素。**钱包与收入本身是对的，只有审计字段错**，影响管理后台交易明细与对账。修法：在 `update()` 之前把目标值存成局部变量（`const senderBalanceAfter = wallet.diamond - totalDiamond`），`update` 和 `balanceAfter` 都用它。**第三组证据（同日 07:39/07:42 两笔 1 钻点赞，用户 23→25）**：真实钻石 10→9→8，而 `#120.balance_after=8`、`#122.balance_after=7` 各少 1；收方真实 `gift_income` 30119320 分，而 `#121.balance_after=30119320`、`#123.balance_after=30119390` 各多 70 分——双计逐笔稳定复现，且**最后一笔的 `balance_after` 与真实值总是差恰好一个礼物金额**，可据此批量校正历史数据。
13. ~~`auth.js getUser()` 在 H5 恒返回 `{}`~~ **诊断错误，2026-09-08 生产证伪，相关改动已全部回退** — 原记录声称「uni-h5 的 `getStorageSync` 会把看起来像 JSON 的字符串自动解析成对象」，据此推断 `getUser()` 的 `JSON.parse` 收到对象 → 抛 `SyntaxError` → 恒返回 `{}`，再推断 `restoreSession()` 里的 `kickOffTUIInit()`/`fetchProfile()` 是死代码、`userStore.userId` 刷新后为空。**这条推理链每一环都是错的，不要照着它改任何代码。**
    - **真相：项目里有两个 `getStorageSync`，行为不同，而 `auth.js` 用的不是会自动解析的那个。** ① **原生** uni-h5 实现在 `app/node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js:20120` 的 `getStorageOrigin()`：先 `let data = value`（原始字符串），再 `JSON.parse` 后交给 `parseValue()`（`:20074`），而 `parseValue` **只解 `{type,data}` 信封**（要求 `object.type` 属于五种类型名、`Object.keys().length === 2` 且含 `data`）。我们存的是 `JSON.stringify(user)`，没有 `type` 字段 → `parseValue` 返回 `undefined` → `data` 保持**原始字符串**，`getUser()` 的 `JSON.parse` 正常工作。② **会自动解析的是本项目自己写的 polyfill**：`main.js:74` 的 `U.getStorageSync = (key) => { … try { return JSON.parse(v) } catch { return v } }`，它挂在 `window.uni` 上（原生 uni-h5 **不**把 storage API 挂到 `window.uni`，见 `main.js:63-68` 的注释），只服务于 TUIKit 的 `@tencentcloud/universal-api`。vite-plugin-uni 把源码里的裸 `uni` 编译成模块导入，所以 `auth.js` 走①、永远碰不到②。
    - **生产实测证据（2026-09-08，旧构建 `index-C7lMOwJj.js`，真实登录态 id=23）**：在页面上下文里按 `getStorageOrigin` + `parseValue` 的原样逻辑复算真实存储值 → 返回 **string / 291 字符**；对它 `JSON.parse` → **不抛错**，得到 `{id:23, nickname:"测试用户A"}`。同一页面 `window.uni.getStorageSync('companion_user')` 返回 **object** —— 两者确实不同，但只有后者会自动解析。DOM 侧交叉验证：打开自己的主页 `#/pages/user-profile/user-profile?userId=23`，`.actions`（`v-if="!isSelf"`，内含打招呼/关注/私信）为 **0 个元素**，说明旧代码里 `isSelf` 为真、`userStore.userId` 确实等于 23。
    - **因此已回退**：`getUser()` 的 `typeof raw === 'string'` 守卫（三端皆为 no-op），以及我据此「顺带修」的 `userStore.userId` → `getUserId()` 改写（`chat.vue` ×3、`chat-list.vue` ×2、`user-profile.vue`、`group/detail.vue`）。**那 4 个所谓「H5 端真 bug」（兜底聊天页收不到实时消息、会话列表插幽灵会话、看自己主页 isSelf 恒假、组局 joined 永不生效）全都不存在。** `getUserId()` 本身保留（JWT 兜底对「storage 被清但 token 还在」仍有意义），但其文档注释里的错误前提已删除。
    - **⚠️ 方法论教训（与待办 7 的 `c87e52e` 属同一类错误）**：在页面里用 `window.uni.xxx` 探测行为，**测到的是本项目的 polyfill，不是业务代码实际调用的原生实现**。凡涉及 `uni.*` API 行为的结论，必须先去 `app/node_modules/@dcloudio/uni-*` 读原生源码，并用 DOM 或网络产物交叉验证，不能只凭 `window.uni` 的返回值下判断。

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
    - [ ] 邀请页点「分享」→ 未配置微信时 action sheet **只有两个复制项**（复制邀请码 / 复制邀请链接），不出现「分享给微信好友 / 分享到朋友圈」（待办 10 的运行时探测）；配好 `sdkConfigs.share.weixin` 后两项自动出现且能真正拉起微信
    - [ ] 礼物面板 / 礼物商城显示 **22 档**（不是 16），6 个新图标（便便/绿帽子/扔鸡蛋/加油/一锤定音/缘定今生）在 App 的 `file://` 源下也能加载出来——H5 是同源相对路径，App 端要靠 `siteOrigin + /static/...` 绝对 URL，两端不是同一条路径
    - [ ] 送「缘定今生」（88888，最贵）→ **zip 容器 SVGA 能播**。这是 App 端唯一走 JSZip 分支的素材，`ensureLib()` 注入的两个库同样要能从 `siteOrigin` 绝对 URL 取到；播不出来会降级成 CSS 特效（不是黑屏），但那就说明 JSZip 那条路在 WKWebView 里断了
    - [ ] 送「一锤定音」（30000）→ 人眼判断观感。它的 `videoSize` 只有 500×500（其它 L3 都是 750×1334/1624），AspectFit 后是「铺满宽度、垂直居中、占屏高约 46%」的方形画面、内容占画布 91%×91%。**数字上不算缺陷，但 30000 钻的档位是否够震撼只有眼看能定**；不满意就改 `animation_level` 降到 2（82vw 方形 holder 更贴合方形素材）或换源素材，别只凭数字改（待办 4 观察项）

17. ~~部署后复测个人页请求次数~~ **已完成（2026-09-08，`ae63f5c` 上线后生产实测）** — 真实入口（`#/pages/home/home` 整页载入 → 点 tabbar「我的」）下：`GET /api/user/profile` **9 → 2**、`wallet/balance` **3 → 1**、`user/certifications` **3 → 1**、`POST /api/im/login` **1 → 1**（未变）、`im/config` 1 次。页面无回归：昵称「测试用户A」、魅力值 54051、钱包 [8 钻 / 37835.70 元]、8 个功能宫格、认证卡片正常。剩下的 2 次 profile 是 `App.vue:122` onLaunch 的 `restoreSession()`（startTime 1404ms）与 profile.vue `onShow` 的合并调用（44662ms），**分属两个时刻、无法再合并**——in-flight 闸门只吃同 tick 的并发。
    - ⚠️ **测量陷阱：深链直入会多量一轮**。用 `?v=xxx#/pages/profile/profile` 整页载入时量到的是 **3 / 2 / 2**，因为 uni-app H5 在这种入口下会让页面 `onShow` **触发两次**（两轮完整的 loadAll）。那是入口方式的产物，不是真实使用路径。**复测必须走「home 整页载入 → 点 tab」**，与待办 9 的会话列表验证入口要求一致。
    - **计数方法**：用页面内 `performance.getEntriesByType('resource').filter(e => e.name.includes('/api/'))` 并按 `norm(name)` 分组收集 `startTime`，比 `list_network_requests` 好——它带时间戳，能把「哪几次属于同一轮」分开，还能跨 tab 切换累积（不用在点击前后各列一次再手工做差）。
    - **仍未修，同类缺陷在 home.vue**：同一次测量里 `/banners`、`/user/discover`、`/posts` **各加载 3 次**（startTime 2167 / 2373 / 5310 —— 前两次相隔约 200ms 像是同 tick 两个调用方，第三次晚 3s 像是 IM 登录后或城市解析回调再拉一遍）。这属于同一类「多条路径打同一端点」。**归属已变更（2026-09-08）**：原先写的「在 D8/D11 接 z-paging 时一并重整」已作废 —— D8 明确判定 `home.vue` **不接** z-paging（多区块拼装 + banner + 横向滚动，不是单列表，见坑点 36）。改归 D12，按坑点 28 的三条乘数逐条排查（重复 `onShow`/`onMounted`、两条路径打同一端点、store action 无 in-flight 合并），**不要单独打补丁**。
18. **`profile.vue` 的「联系客服」是完整实现但无入口的死代码（2026-09-08 核对构建产物时发现）** — `onCustomerService()`（`:288-330`）逻辑齐全：调 `userApi.kefu()` 取客服微信、`showModal` 展示、确认后 `setClipboardData` 复制，还写了「未配置」和「获取失败」两条降级文案（都引导用户走「意见反馈」）。但**模板里没有任何地方绑它** —— 8 宫格入口是 我的动态/礼物商城/关注粉丝/精英特权/礼物排行/每日任务/反馈问题/设置，没有客服项。`<script setup>` 的顶层绑定只有被 render 函数引用才会保留，所以 rollup 直接把它摇掉了：构建产物 `pages-profile-profile.DaQgYAdB.js` 里 `kefu` 字符串出现 **0 次**。**发现方式值得复用**：数产物指纹时发现某个源码里明明存在的 API 调用消失了，顺着查就能揪出「写了但没接线」的功能，比通读模板快得多。
    - **两个方向，二选一，别放着不管**：① 接线——在 8 宫格加「联系客服」项（会挤掉或需要扩成 3 行，要先看排版）；② 删掉——连同 `api/index.js` 的 `userApi.kefu` 与服务端 `/user/kefu` 一起评估是否还有别处用。归 D12 的「删假文案 / 死代码清扫」一起做，**不要在其它任务里顺手加个入口**（属于范围蔓延，且排版影响需要单独验证）。
19. **全站 44px 竖向溢出：`App.vue` 全局给 `uni-page-body` 写了 `min-height: 100vh`（2026-09-08 D8 期间顺带查出，未修）** — 该元素坐在 **44px 原生导航栏之下**（`uni-page-wrapper` 实测只有 597.6px），于是 `uni-page-body` 变成 top=44 / height=641.6 / bottom=686 → **每个带原生导航栏的页面都凭空多出 44px 竖向滚动**（`documentElement.scrollHeight - clientHeight = 44`）。这正是坑点 18 警告的 `100vh` 类问题。
    - **为什么以前没人报**：内容比视口高的页面（如 `pages/wallet/wallet`，pageBody 1043px）里 min-height 根本不是约束项，看不出来。只有「内容高度 ≈ 0、由 fixed 容器接管」的页面才会暴露 —— D8 把 transactions 迁到 z-paging（fixed 模式）后正好撞上。**所以它不是 D8 引入的回归**，z-paging 自己的 `.z-paging-content` 实测是 `fixed; top:44px; height:597.6px`，完全正确。
    - **候选修法**：`min-height: 100vh` → `min-height: 100%`（父级 `uni-page-wrapper` 有确定高度，百分比可解析）。**但它影响全部 33 个页面，必须单独一轮逐页验证**（尤其要复查各页 `100vh` / `100dvh` 混用与 fixed 底部栏的安全区），不要在别的任务里顺手改。归 D12 或单开一轮。
    - **验证方法**（不需要截图）：`documentElement.scrollHeight - documentElement.clientHeight` 应为 0；再量 `uni-page-wrapper` / `uni-page-body` 的 `getBoundingClientRect()` 看 top 与 height 是否吻合。

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

*最后更新: 2026-09-08*
