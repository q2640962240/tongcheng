# ADR-004: 礼物特效改用 SVGA 矢量动画（替代 CSS + 静态背景图）

## 状态

已采纳 (2026-09-07)

## 背景

原实现的三个问题叠在一起：

1. **L1-L3 特效全是 CSS**：`.gift-effect-bg` 把一张静态图当背景，配 `scale/brightness/blur` 关键帧假装"动"。视觉上和抖音/快手的礼物特效差距明显。
2. **16 个礼物里 8 个还是 emoji 占位**（🍭🌹🍦❤️🎂🚀🪐🌌），另外 8 个的图标是低质量 jpg。
3. **图标素材无路可走**：ImageGen 额度耗尽（403 / code 112），用户提供的 MJ/SD 提示词需要人工出图，短期拿不到。

用户明确要求："继续全网寻找，可以改变礼物型号，直到全部补全"，并确认"项目并不会进行商用"（解除了授权门槛）。

## 决策

**引入 svgaplayerweb 2.3.2，用真实 SVGA 矢量动画替换全部 16 个礼物的特效；礼物图标由 SVGA 抽帧生成，不再依赖外部出图。**

### 素材

- 播放库：`svgaplayerweb` 2.3.2（Apache-2.0），UMD 构建 `svga.min.js` 落盘到 `app/src/static/lib/`，由 renderjs 动态注入 `<script>`，不打进主包。
- 16 个 `.svga` 落盘到 `app/src/static/svga/`，共 4.0MB。
- 16 个 192×192 透明 PNG 图标落盘到 `app/src/static/gifts/`，共 684KB，**由 SVGA 抽帧 + 抠除自带暗色遮罩层生成**（不是外部素材）。

### 礼物阵容（价格与 sort 全部保持不变）

| sort | 名称 | 价格 | 级别 | 素材文件 | 时长 |
|---|---|---|---|---|---|
| 1 | 点赞 | 1 | L1 | dianzan | 5.0s |
| 2 | 比心 | 10 | L1 | bixin | 0.55s |
| 3 | 星际少女 | 20 | L1 | xingji | 2.0s |
| 4 | 玫瑰 | 50 | L2 | meigui | 4.0s |
| 5 | 心动 | 80 | L2 | xindong | 8.0s |
| 6 | 一剑穿心 | 100 | L2 | yijian | 3.0s |
| 7 | 钻石 | 200 | L2 | zuanshi | 3.35s |
| 8 | 天使 | 300 | L2 | tianshi | 4.0s |
| 9 | 花好月圆 | 500 | L2 | huahao | 5.0s |
| 10 | 福袋 | 500 | L3 | fudai | 2.75s |
| 11 | 皇冠 | 1000 | L3 | huangguan | 3.25s |
| 12 | 水晶球 | 2000 | L3 | shuijingqiu | 4.0s |
| 13 | 独角兽 | 5000 | L3 | dushou | 4.0s |
| 14 | 跑车 | 10000 | L3 | paoche | 3.4s |
| 15 | 旋转木马 | 20000 | L3 | xuanzhuanmuma | 5.83s |
| 16 | 流星雨 | 50000 | L3 | liuxingyu | 3.0s |

`price` / `sort` 是金额与排序字段，改动需用户批准，因此本次**只改名、改图标、改特效、改动画级别**，价格一个都没动。

### 播放架构

- `app/src/components/SvgaStage.vue`：renderjs 组件。逻辑层把 `{src, uid, base}` 写进 `:prop`，视图层 `:change:prop` 收到后注入播放器库、建 canvas、`Parser().load()` → `Player.startAnimation()`。
- 尺寸按级别分档：L1 = 46vw 方形，L2 = 82vw 方形，L3 = 100vw×100vh 全屏，`setContentMode` 用 AspectFit。
- **队列切换由 `player.onFinished` 驱动**，不再用固定时长表。`GiftAnimation.vue` 只保留一个 15s 兜底定时器防结束事件丢失。
- 小程序端（mp-weixin）不支持 renderjs，`SVGA_SUPPORTED=false`，自动降级回原有 CSS 特效层；加载/解码失败同样降级。

## 三个必须记住的实现约束

1. **`ownerInstance.callMethod` 的目标方法必须写成 Options API 的 `methods`。**
   uni-app H5 的实现是 `this.$vm[funcName]`（见 `@dcloudio/uni-h5/dist/uni-h5.es.js:1455`）。`<script setup>` + `defineExpose` 挂到的是 Vue 的 exposed 代理，`$vm` 上取不到，回调会**静默丢失**——不报错、不进 catch，表现是特效播完后画面停住，直到兜底定时器才切下一个。这是本次调试耗时最久的一处，SvgaStage 因此是项目里少数几个 Options API 组件。

2. **`.svga` 必须放 `app/src/static/`，且 App 端要配 CORS。**
   App 端页面跑在 WKWebView 里，源是 `file://`，renderjs 用 XHR 拉 `.svga` 属于跨源请求。`deploy/nginx-docker.conf` 的 `location /static/` 因此加了 `Access-Control-Allow-Origin: *`。H5 同源不受影响。逻辑层的站点源从 `getCurrentBaseURL()` 去掉 `/api` 推导（照 `invite.vue` 的写法），不能读 `window.location.origin`。

3. **`change:prop` 靠"值变化"触发，首帧要给空 src。**
   `stageProp` 初始为 `{src:''}`，`mounted` + `$nextTick` 后才填真值。这样既保证变更事件一定派发，也保证 holder 已经在视图层 DOM 里。

## 素材授权（重要）

| 授权 | 数量 | 礼物 |
|---|---|---|
| Apache-2.0 | 3 | 玫瑰 / 心动 / 天使 |
| 无 LICENSE 文件 | 13 | 其余全部 |

- 13 个无授权素材来自 GitHub 公开仓库 `selfimprW/SVGAPlayerDemo`（仓库未附 LICENSE 文件）。
- **用户已确认本项目不做商用**，这是采用无授权素材的前提。一旦转为商业用途，这 13 个素材必须替换或补授权。
- 候选素材 `kingset`（金色套装）在抽帧审查时发现**画面里嵌了一张真人女性照片**（素材自带的头像位），已剔除，未进入阵容。
- 抽帧审查还剔除了 4 个损坏/无效文件：`vs_gift_anim_high`、`random_pk_box`、`bid`（inflate 报 incorrect header check）、`praise`（帧号推进但 alphaMax 恒为 0）。

## 后果

**正面**
- 16/16 礼物都有真实矢量动画特效，0 个 emoji 占位，待办 #4 和 #119 同时关闭。
- 图标与特效同源（同一份 SVGA 抽帧），视觉上必然一致，不需要设计师再对齐。
- 队列时长自适应素材本身，新增素材不用改时长表。

**负面**
- H5 包体积 +4.7MB（svga 4.0M + 图标 684K + 播放器 124K）。
- 13 个素材授权状态不明，商用前必须处理（见上）。
- SvgaStage 是 Options API，和项目主流的 `<script setup>` 风格不一致——但这是 renderjs 的硬约束，不能改。
- 首个礼物有一次冷启动延迟（要下载 124K 的播放器库 + 首个 .svga）。已靠 nginx 30 天缓存缓解，未做预热。

## 验证记录

在本地构建产物上（`app/dist/build/h5`，端口 8901）用临时自检页跑了全量 16 个素材。测试页 `pages/svga-test/svga-test.vue` 已删除，未提交。

判据：canvas 中心区域采样，`distinct frames > 2 && alphaMax > 200`。

结果：**16/16 全部通过**，alphaMax 均为 255，去重帧数 7-70，每个素材的实测时长与其标称时长吻合（例如 huangguan 3294ms vs 标称 3.25s，xindong 8054ms vs 标称 8.0s），且全部由 `onFinished` 正常推进、无一次落到兜底定时器。

降级路径也验证过：注入 `Parser.load` 失败后，SvgaStage 卸载、CSS 层接管、按 `durations[level]` 正常切下一个。

> 测试环境的坑：浏览器标签页处于 `hidden` 状态时 rAF 不 tick、`setInterval` 被钳到 1s，canvas 会一直是空的——看起来像"特效不工作"，其实是测试假象。必须用 MessageChannel 驱动 rAF 才能采到帧。真机/前台页面不受影响。

## 线上验证（2026-09-07，https://zyb001.cn）

部署后在生产环境复验，结论与本地一致：

- **资产可达**：16 个 `.svga` + 16 个 `.png` + `svga.min.js` 全部 200，`/static/` 带 `Access-Control-Allow-Origin: *` 与 `X-Content-Type-Options: nosniff`。
- **构建产物一致**：线上 `assets/GiftAnimation.C3wSLJQ7.js`（5619B）与本地 `GiftAnimation.bdp_FsdW.js` 逐字节相同，唯一差异是它 import 的 entry chunk 哈希。哈希不同只是 CI 独立构建，不是代码不同。
- **图标加载证据**：16 个 PNG 在页面内 `new Image()` 全部 `naturalWidth = naturalHeight = 192`，无一失败。
- **真实组件全量跑通**：线上 `#/pages/chat/chat` 未登录也会挂载 `<GiftAnimation>`，从 Vue 组件树里取到实例后直接调它 expose 的 `play()`，礼物数据取自线上 `/api/gifts`。**16/16 PASS**，`sawCanvas` 全为 true（说明确实走了 SVGA 分支而非 CSS 降级），alphaMax 均为 255，去重帧数 6-53，累计 72s，无一次落到兜底定时器。

> 局限：① 生产短信未配置且 `NODE_ENV=production` 下 `sms.js` 无 dev/mock 回退，因此**没有做真实登录后的送礼端到端**（不写 `gift_records`、不动钻石），上面的组件验证是绕过 API 直接驱动动画层；② App(WKWebView) 端无法在此环境验证，它依赖 `siteOrigin + /static/...` 绝对 URL 与新增的 CORS 头，属打包后待验项。

## 连带发现：部署即改生产数据

这次验证时发现线上 `gifts` 表变成了 **30 行**：`server/Dockerfile` 的 ENTRYPOINT 每次容器启动都跑完整 `seed.js`，而每次部署都会重建 server 容器，于是 `upgradeGifts()` 按 name 匹配不到改名后的旧行、新建了 14 行，另有 2 行（皇冠/跑车）name 撞上被就地改了 sort 与素材路径但 price 保持旧值。

已修复：旧行 `active=0` 下架（有 `gift_records_ibfk_99` 外键引用，不能删），皇冠/跑车 price 修正为 1000/10000（已获批准）。根因与长期对策见 [ADR-0005](0005-seed-on-boot-gate.md)。

## 关键文件

- `app/src/components/SvgaStage.vue` — renderjs 播放器（**Options API，勿改**）
- `app/src/components/GiftAnimation.vue` — SVGA 分支 + CSS 降级 + 队列
- `app/src/static/svga/*.svga` — 16 个特效素材
- `app/src/static/gifts/*.png` — 16 个抽帧图标
- `app/src/static/lib/svga.min.js` — svgaplayerweb 2.3.2 UMD
- `server/src/seed.js` — `DEFAULT_GIFTS`
- `deploy/nginx-docker.conf` — `location /static/` 的 CORS
