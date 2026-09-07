# SVGA 工具链

礼物特效素材的**选型与加工**工具，零依赖（只用 Node 内置 `zlib` + 仓库里已有的播放器）。

> ⚠️ 这不是运行时资源，**不要挪进 `app/src/static/`** —— AGENTS.md 坑点 16 说的是运行时资源必须进
> `src/static/`，工具链进去只会白白增大三端包体。

## 为什么需要它

本项目 16 个礼物特效全部是 SVGA 矢量动画（见 `docs/adr/ADR-0004`）。SVGA 生态 2023 年起已停更，
GitHub 上几乎没有素材库，可用素材集中在少数几个 demo 仓库里，而且**文件名与画面语义经常对不上**
（`auction_success` 不一定有锤子，`jixujiayou` 有 5 个变体）。所以每次扩充礼物都必须：

1. 先解析容器，拿到 `videoSize / fps / frames / 内嵌图片数` —— 尺寸决定它能放在哪一级
2. 再抽帧出图，**用眼睛确认画面语义** —— 名字全是推测，看图才算数
3. 最后从同一份 SVGA 抽一帧生成礼物图标，保证图标与特效同源

## 文件

| 文件 | 作用 |
|---|---|
| `check.mjs` | 容器解析（Node 命令行，秒级粗筛全部素材） |
| `server.mjs` | 本地静态服务 + 抽帧落盘端点 |
| `extract.html` | 浏览器侧：抽帧、拼图选型、生成图标 |
| `test.html` | 浏览器侧：播放自检（验证素材能否真的推帧） |
| `candidates/` | 候选 .svga（**gitignore**，本地工作文件） |
| `out/` | 抽帧产物（**gitignore**） |

## 用法

```bash
cd scripts/svga-toolchain

# 1) 粗筛：解析全部候选，看尺寸/帧率/时长/图片数
node check.mjs
node check.mjs bianbian lvmaozi           # 只看指定几个
node check.mjs --dir ../../app/src/static/svga   # 扫已上线的素材
node check.mjs --entries auction_success  # 额外打印 zip 内条目

# 2) 起服务（服务根 = 仓库根，这样才能加载 App 真正在用的那份播放器）
node server.mjs        # http://127.0.0.1:8899

# 3) 浏览器打开 /scripts/svga-toolchain/extract.html，控制台里调：
#    拼图选型（一张 PNG 装下整批，素材为行、帧为列、带文字标注）
__contactSheet(['bianbian','lvmaozi','live_pk_egg_fly'], 'L1')
#    单素材多帧原图
__dumpFrames([{ name:'auction_success', at:[0.1,0.4,0.7,0.95] }])
#    生成礼物图标（192×192，按内容包围盒裁剪，key:true 抠掉自带压暗背景）
__extractIcons([{ name:'bianbian', at:0.35, key:true }])

# 4) 播放自检
#    /scripts/svga-toolchain/test.html
__runTest(['bianbian','lvmaozi'])
__runTest(['liuxingyu'], 3000, '/app/src/static/svga/')
```

产物落在 `out/`。选型确认后才把 `.svga` 复制到 `app/src/static/svga/`、图标复制到 `app/src/static/gifts/`。

## 两个必须知道的坑

**① 自动化浏览器的标签页是 hidden，`requestAnimationFrame` 被挂起。**
播放器永远不推帧，量到的全是 0×0 / 空画布。两个 html 都在加载时装了 shim：

```js
window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
```

**一个 document 只能装一次**，装两次会互相包裹（同类陷阱见 AGENTS.md 坑点 23 的 XHR 钩子）。

**② 取帧要用 `pauseAnimation()`，不能用 `stopAnimation()`** —— 后者会清空画布。
且 `onFrame` 回调是在**绘制之前**触发的，在回调里暂停只能拿到空画布，
所以 `seekTo()` 改成「按时长等待 → 再暂停」（`targetFrame / FPS * 1000 + 200ms` 余量）。

## 容器格式（`check.mjs` 逆出来的，不是照文档抄的）

`.svga` 有两大类外层包装，靠魔数区分：

| 魔数 | 包装 | 内容 |
|---|---|---|
| `50 4b 03 04` | ZIP | SVGA **1.x**：`movie.spec`(JSON) 或 `movie.binary`(protobuf) + `images/*` |
| `78 01/9c/da` | zlib | SVGA **2.0/2.1**：裸 protobuf `FileTransfer`（候选池里最常见） |
| `1f 8b` | gzip | 同上 |
| 其它 | 无 | 裸 protobuf |

### ZIP 形态的 `movie.spec`（SVGA 1.x JSON）

```
{ ver: "1.1.0", movie: { viewBox: {width,height}, fps, frames }, images: {...}, sprites: [...], audios: [] }
```

### protobuf 形态的 `FileTransfer`（SVGA 2.x）

字段编号是 hex dump 逆出来的，**与直觉顺序不同**：

```
1 = version (string)          ← 不是 params！
2 = params  (MovieParams)
3 = images  (map<string,bytes>)
4 = sprites (repeated)

MovieParams:
  1 = viewBoxWidth   (fixed32 float)
  2 = viewBoxHeight  (fixed32 float)
  3 = FPS            (varint —— 实测不是 float)
  4 = frames         (varint)
```

## 候选池清单（`selfimprW/SVGAPlayerDemo`，53 个）

`node check.mjs` 的输出，2026-09-07 实测。**尺寸是选型的第一道闸**：
礼物特效 L1 显示在 46vw、L2 在 82vw、L3 铺满全屏，画布太小的素材放大到 L3 会糊。

已上线 16 个的尺寸基线（`node check.mjs --dir ../../app/src/static/svga`）：
L1 最小 60×60（`dianzan`）、L2 最小 500×500（`xindong`）、**L3 无一小于 750 宽**。

| 素材 | KB | 容器 | 版本 | 画布 | fps | 帧 | 时长 | 图 | 精灵 |
|---|---|---|---|---|---|---|---|---|---|
| auction_success | 269 | zlib+pb | 2.0.0 | 500x500 | 30 | 90 | 3000ms | 12 | 16 |
| auction_success_1 | 153 | zip+spec | 1.1.0 | 750x750 | 30 | 195 | 6500ms | 34 | 57 |
| bianbian | 13 | zlib+pb | 2.0.0 | 60x60 | 15 | 75 | 5000ms | 2 | 2 |
| bid | 32 | zip+spec | 1.1.0 | 750x238 | 30 | 150 | 5000ms | 4 | 6 |
| bid_1 | 78 | zip+spec | 1.1.0 | 750x238 | 30 | 450 | 15000ms | 5 | 12 |
| dabaima | 607 | zlib+pb | 2.0.0 | 750x1334 | 20 | 80 | 4000ms | 28 | 43 |
| dianzan | 12 | zlib+pb | 2.0.0 | 60x60 | 15 | 75 | 5000ms | 2 | 4 |
| find_guide | 18 | zlib+pb | 2.1.0 | 170x157 | 20 | 22 | 1100ms | 6 | 6 |
| find_heart | 8 | zlib+pb | 2.1.0 | 120x120 | 20 | 11 | 550ms | 5 | 5 |
| findx_living | 3 | zlib+pb | 2.1.0 | 60x60 | 20 | 30 | 1500ms | 6 | 12 |
| fudai | 118 | zlib+pb | 2.1.0 | 750x1640 | 20 | 55 | 2750ms | 8 | 61 |
| gift_default | 49 | zlib+pb | 2.0.0 | 450x400 | 10 | 20 | 2000ms | 5 | 5 |
| huahaoyueyuan | 311 | zlib+pb | 2.0.0 | 750x1334 | 12 | 60 | 5000ms | 9 | 45 |
| huangguan | 86 | zlib+pb | 2.0.0 | 750x1624 | 20 | 65 | 3250ms | 7 | 25 |
| jixujiayou | 114 | zlib+pb | 2.0.0 | 750x1624 | 12 | 22 | 1833ms | 11 | 26 |
| jixujiayou_a | 102 | zlib+pb | 2.0.0 | 750x1624 | 12 | 23 | 1917ms | 11 | 37 |
| jixujiayou_b | 121 | zlib+pb | 2.0.0 | 750x1624 | 12 | 26 | 2167ms | 13 | 70 |
| jixujiayou_c | 76 | zlib+pb | 2.0.0 | 750x1624 | 12 | 23 | 1917ms | 11 | 70 |
| jixujiayou_d | 76 | zlib+pb | 2.0.0 | 750x1624 | 20 | 40 | 2000ms | 10 | 74 |
| linkpk_ko | 29 | zlib+pb | 2.0.0 | 130x70 | 20 | 80 | 4000ms | 23 | 23 |
| linkpk_lose | 18 | zip+spec | 1.1.0 | 190x160 | 20 | 60 | 3000ms | 4 | 4 |
| linkpk_rampage | 24 | zip+spec | 1.1.0 | 190x160 | 20 | 60 | 3000ms | 6 | 12 |
| linkpk_task_doing | 21 | zip+spec | 1.1.0 | 190x160 | 20 | 40 | 2000ms | 4 | 19 |
| linkpk_task_done | 27 | zip+spec | 1.1.0 | 190x160 | 20 | 60 | 3000ms | 5 | 19 |
| linkpk_triple_kill | 24 | zip+spec | 1.1.0 | 190x160 | 20 | 60 | 3000ms | 6 | 12 |
| linkpk_ultra_kill | 24 | zip+spec | 1.1.0 | 190x160 | 20 | 60 | 3000ms | 6 | 12 |
| linkpk_win | 26 | zip+spec | 1.1.0 | 190x160 | 20 | 60 | 3000ms | 7 | 13 |
| liuxingyu | 450 | zlib+pb | 2.0.0 | 750x1334 | 20 | 60 | 3000ms | 15 | 125 |
| live_danmu_anim | 83 | zlib+pb | 2.1.0 | 375x820 | 60 | 600 | 10000ms | 8 | 16 |
| live_grab_timed_red_packet | 112 | zlib+pb | 2.1.0 | 260x260 | 20 | 20 | 1000ms | 8 | 9 |
| live_ktv_music_playing | 2 | zlib+pb | 2.1.0 | 100x100 | 12 | 24 | 2000ms | 2 | 2 |
| live_ktv_stage_music_wave | 10 | zlib+pb | 2.1.0 | 666x60 | 20 | 40 | 2000ms | 0 | 55 |
| live_pk_egg_fly | 11 | zlib+pb | 2.1.0 | 130x260 | 20 | 100 | 5000ms | 2 | 2 |
| live_pk_get_prop | 127 | zlib+pb | 2.1.0 | 510x510 | 20 | 60 | 3000ms | 11 | 12 |
| live_pk_get_prop_audience | 118 | zlib+pb | 2.1.0 | 510x510 | 20 | 60 | 3000ms | 11 | 11 |
| live_pk_prop_fog | 289 | zlib+pb | 2.1.0 | 750x200 | 20 | 24 | 1200ms | 8 | 8 |
| live_scroll_room_guide | 7 | zlib+pb | 2.1.0 | 750x300 | 20 | 50 | 2500ms | 2 | 2 |
| lvmaozi | 8 | zlib+pb | 2.1.0 | 120x120 | 15 | 75 | 5000ms | 1 | 2 |
| paoche | 547 | zlib+pb | 2.1.0 | 750x1624 | 20 | 68 | 3400ms | 12 | 26 |
| praise | 2 | zlib+pb | 2.1.0 | 400x400 | 20 | 20 | 1000ms | 0 | 9 |
| random_pk_box | 23 | zip+spec | 1.1.0 | 190x160 | 20 | 40 | 2000ms | 5 | 19 |
| random_pk_match | 22 | zip+spec | 1.1.0 | 450x250 | 20 | 40 | 2000ms | 7 | 12 |
| shuijingqiu | 406 | zlib+pb | 2.0.0 | 750x1624 | 20 | 80 | 4000ms | 15 | 37 |
| vf_pk_start | 27 | zip+spec | 1.1.0 | 750x750 | 20 | 60 | 3000ms | 5 | 5 |
| vs_dating_choose_line | 2 | zip+spec | 1.1.0 | 535x70 | 20 | 41 | 2050ms | 0 | 3 |
| vs_dating_wedding_hug | 575 | zip+spec | 1.1.0 | 750x1334 | 20 | 100 | 5000ms | 17 | 17 |
| vs_dating_wedding_hug_chinese | 412 | zip+spec | 1.1.0 | 750x1334 | 20 | 100 | 5000ms | 13 | 13 |
| vs_gift_anim_high | 29 | zip+spec | 1.1.0 | 200x200 | 20 | 10 | 500ms | 5 | 38 |
| vs_gift_anim_one | 11 | zip+spec | 1.1.0 | 200x200 | 20 | 10 | 500ms | 2 | 4 |
| xiaotianshi | 239 | zlib+pb | 2.1.0 | 750x1624 | 20 | 60 | 3000ms | 10 | 21 |
| xuanzhuanmuma | 497 | zlib+pb | 2.0.0 | 750x1334 | 12 | 70 | 5833ms | 15 | 808 |
| yijianchuanxin | 134 | zlib+pb | 2.0.0 | 750x1334 | 20 | 60 | 3000ms | 11 | 11 |
| zuanshi | 177 | zlib+pb | 2.0.0 | 750x1334 | 20 | 67 | 3350ms | 6 | 11 |

其中 14 个已上线（`dabaima`→独角兽、`find_heart`→比心、`gift_default`→星际少女、
`huahaoyueyuan`→花好月圆、`xiaotianshi`→天使、`yijianchuanxin`→一剑穿心，其余同名），
另 2 个（玫瑰 / 心动）来自 `svga/SVGAPlayer-Web` 的 samples。
**全部 53 个 `audio=0`** —— 这批素材不自带音轨，与「不做礼物音效」的决定不冲突。

### 粗筛结论（尺寸维度，尚未看图）

- **可用于 L3（需 ≥750 宽）**：`jixujiayou` 五个变体（750×1624）、`vf_pk_start`（750×750）、
  `auction_success_1`（750×750）、`vs_dating_wedding_hug`（750×1334）
- **可用于 L2（≥500 已有先例 `xindong`）**：`auction_success`（500×500）、
  `live_pk_get_prop` / `_audience`（510×510）
- **只能用于 L1**：`bianbian`（60×60）、`lvmaozi`（120×120）、`live_pk_egg_fly`（130×260）、
  `random_pk_box`（190×160）、`praise`（400×400，仅 1s）
- **横条，不适合任何一级**：`live_pk_prop_fog`（750×200）、`bid`/`bid_1`（750×238）、
  `live_scroll_room_guide`（750×300）、`live_ktv_stage_music_wave`（666×60）、
  `vs_dating_choose_line`（535×70）、`random_pk_match`（450×250）
- **时长异常**：`live_danmu_anim` 10s/60fps/600 帧（偏重）、`bid_1` 15s、`vs_gift_anim_high`/`_one` 仅 500ms
- **PK 结算文字动画，语义不适用**：`linkpk_*` 8 个（画布也只有 190×160）

### 选型结果（2026-09-07，全部抽帧看图定稿，拼图见 `out/sheet-*.png`）

**入选 6 个**（已落 `app/src/static/svga/` 与 `app/src/static/gifts/`，与既有 16 个合成 22 礼物）：

| 礼物 code | 源文件 | 级别 | 价格槽 | 看图结论 |
|---|---|---|---|---|
| `bianbian` | `bianbian` | L1 | 2 | 便便+厕纸，可爱；主体只在前 ~40% 时长可见，L1 展示窗内刚好 |
| `lvmaozi` | `lvmaozi` | L1 | 5 | 绿帽+嫩芽，三帧都在，语义直白 |
| `jidan` | `live_pk_egg_fly` | L1 | 8 | 单颗彩蛋飞弧，稀疏但「扔鸡蛋」的趣味就在这一颗 |
| `jiayou` | `jixujiayou_b` | L2 | 150 | 宝箱爆开+「继续加油!」徽章+星芒；徽章文字与礼物名自洽。**图标不抠背景**——竖条压暗层与已上线的 L3 图标同款风格 |
| `luochui` | `auction_success` | L3 | 30000 | 金色法槌砸底座+黄色星芒，无硬编码文字。画布 500×500，全屏层里是居中方形（向下采样不糊），与既有 L3 的满幅构图不同，已在 ADR 记录 |
| `yuanding` | `vs_dating_wedding_hug` | L3 | 88888 | 新郎新娘+花瓣雨+背后绽开的巨心，750×1334 满屏，无硬编码文字。**zip 容器，依赖下面的 JSZip 修复才能播** |

`jixujiayou` 五个变体里只有 `_b` 有「合箱→爆开→徽章」的完整叙事；`_d` 开局就是开箱、base 版中段后主体消失。

**淘汰清单（看图后判死，名字不可信）**：

| 源文件 | 死因 |
|---|---|
| `live_pk_get_prop` / `_audience` | 硬编码「恭喜你」「立即使用」按钮 |
| `live_grab_timed_red_packet` | 巨型「抢」字 |
| `live_danmu_anim` | 火箭+不可读中文弹幕墙，10s/600 帧偏重 |
| `auction_success_1` | **不是法槌**：开奖机+硬编码「正在开奖/准备开奖」倒计时 |
| `random_pk_box` | 宝箱上烙着巨型「VS」PK 标 |
| `vf_pk_start` | 硬编码「PK / 开启」文字 |
| `vs_dating_wedding_hug_chinese` | 与英文版重复且含硬编码文案 |
| `kingset` | 皇冠框里烙着**陌生人头像占位图**，其余帧是女巫角色 |
| `halloween` / `TwitterHeart` / `praise` / `findx_living` | 只有一颗小心心/信号条，与既有比心、点赞重复或语义不符 |
| `live_pk_prop_fog` | 750×200 横条雾带，任何一级都不适配 |
| `bid` / `bid_1` / `live_scroll_room_guide` / `live_ktv_stage_music_wave` / `vs_dating_choose_line` / `random_pk_match` | 横条/UI 引导形状 |
| `linkpk_*` 8 个 | PK 结算文字动画，190×160 |

**计划里的 26 个为什么变成 22 个**：`danmu`/`hongbao`/`baoxiang`/`miwu` 四个槽位的源素材全部在上表里判死（硬编码中文 UI / 横条 / PK 标），两个开源仓库（`selfimprW/SVGAPlayerDemo` 53 个 + `svga/SVGAPlayer-Web` samples 16 个）里再无语义合适的替代；宁可少 4 个槽位，不凑数。

## zip 素材与 JSZip（2026-09-07 查实的根因）

候选池里所有 **zip+movie.spec（SVGA 1.x）** 素材一度全部报 pako 的 `incorrect header check`，
一度误判为「播放器 zip 路径坏了」。真相反而是**缺依赖**：

```js
// svga.min.js 内部 loadAssets 的第一行门控
if ("object" == typeof JSZipUtils && "function" == typeof JSZip) { ...zip 分支... }
```

npm 构建**不打包 JSZip**——官方文档要求页面在 `svga.min.js` 之前另挂 `jszip.min.js` +
`jszip-utils.min.js` 两个全局 script。我们（和选型 harness）只挂了 svga.min.js，
门控为假 → zip 字节直接掉进 `load_viaProto` → pako 对 zip 魔数报 `incorrect header check`。
已上线 16 个素材全是 zlib+protobuf，所以这个缺口**从未在生产暴露**。

处理：D4 把 `jszip.min.js`(95KB) + `jszip-utils.min.js`(2KB) 放进 `app/src/static/lib/`，
由 `SvgaStage.vue` 在加载 svga.min.js 之前按需注入（门控在**调用时**检查，顺序只要早于
`parser.load()` 即可）。代价是礼物特效首次播放多两个缓存请求；收益是 `yuanding` 解锁 +
zip 素材不再静默黑屏降级。harness 复现：`extract.html` 里动态注入这两个 script 后，
`vs_dating_wedding_hug` / `auction_success_1` / `random_pk_box` / `vf_pk_start` 立即全部能播（见 `out/sheet-ZIP.png`）。

## 授权

素材来自无 LICENSE 的公开仓库。用户已明确本项目**非商用**，据此使用；
若将来商用，这批素材必须整体替换或取得授权（AGENTS.md 待办 4 遗留项①）。
