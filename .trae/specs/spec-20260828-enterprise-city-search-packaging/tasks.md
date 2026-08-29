# 任务队列：spec-20260828-enterprise-city-search-packaging
> 父规格：[spec.md](./spec.md)
> 生成时间：2026-08-28

每个任务需包含：ID、说明、依赖、优先级、状态字段、测试需求（TR，rule/rubric）、实现路径、完成证据。

---

## Task 1: 构建 2024 版全国行政区划数据集（34 省 + ≥337 地级及以上城市）
- **依赖**：无
- **优先级**：high
- **Status**: pending

### 实现
1. 安装轻量拼音生成依赖 `pinyin-pro`（MIT，已核对）用于 spell/首字母。
2. 在 `server/src/data/china_cities.js`（或 `.json`）内写死民政 2024 版 34 省及其下所有地级城市列表。
   - 34 省级行政区覆盖范围：4 直辖市 + 22 省 + 5 自治区 + 2 特别行政区 + 台湾省（共 34）。
   - 地级行政单位：以"地级市/地区/自治州/盟"为口径，去重后按省级代码排序。
   - 每条数据字段：`{ code, name, provinceCode, provinceName, spell, firstLetter, alias[] }`；直辖市的 `provinceCode=自身代码`。
3. 生成后增加元信息 `meta: { source: '民政部 2024 县以上行政区划代码', version: '2024', provinceCount, cityCount }`。
4. 在 `server/src/data/index.js`（如不存在则新建）导出 `chinaCities` 和构造函数：`getRegionTree()`、`searchRegions(kw)`。
5. 后端挂载：新增 routes/regions.js 并在 app.js 作为 `/api/regions` 引入。

### 本地测试需求（Task-local TRs）
- **rule T1-1**：`getRegionTree()` 返回 provinces.length === 34；cities total ≥ 337。
- **rule T1-2**：`searchRegions('郑州')` 首项 name 包含 "郑州"；`searchRegions('shenzhen')` 返回 "深圳市"；`searchRegions('bj')` 返回至少包含 "北京市" 的结果。
- **rule T1-3**：接口 `/api/regions/tree` 返回 200，code=0；`/api/regions/search?kw=SH` 不区分大小写且首字母匹配 "上海市"。
- **rubric T1-4**（数据完整性 0-3，≥2）：
  - 0：缺失多个省或城市数 <200。
  - 1：34 省完整但地级城市缺漏>20，或 alias/firstLetter 字段缺失。
  - 2：34 省+≥337 地级城市齐全；spell / firstLetter / alias 三字段齐全，均为字符串/数组。
  - 3：上述+别名覆盖常见简称（如"蓉"=成都、"申"=上海、"鹏城"=深圳、"星城"=长沙）。

### 完成证据
- Jest 新增 `regions.test.js` 单测（至少 4 用例）通过；
- `/api/regions/tree` 与 `/api/regions/search` 冒烟日志；
- 城市总数 `cityCount` 的控制台输出数值。

---

## Task 2: 后端定位路由 + 4 级降级流水线（reverse + guess-by-ip）
- **依赖**：Task 1
- **优先级**：high
- **Status**: pending

### 实现
1. `server/src/utils/geo.js`：封装 3 个函数：
   - `async reverseGeocode({ lat, lng })`：读取配置中心 `app.geoProvider / app.geoKey`，按 provider 发 axios 到高德/腾讯逆地理；未配置时抛 `ConfigNotSet` 错误，不请求外网。
   - `async guessCityByIp(req)`：读取 `X-Forwarded-For/req.ip`，优先本地规则库（本机网段 `127/8`、`192.168/16`、`10/8`、`172.16-31/12` → 返回 `{ fallback:true, province:'未知', city:'北京' }` 避免外部费用）；若配置了 IP 定位 key 可升级到外部服务，本次默认不启用。
   - `normalizeCityName(name)`：把"广州"→"广州市"、"北京"→"北京市"等，写一张 34 省名/别名表 + 337+ 城市前缀匹配，匹配 `chinaCities`。
2. `server/src/routes/location.js`：
   - `POST /api/location/reverse`：body `{ lat, lng }`；成功返回 `{ province, city, district, source }`；未配置时 `source='not-configured'`，不抛 4xx。
   - `GET /api/location/guess-by-ip`：返回 `{ province, city, fallback }`。
3. `app.js` 挂载路由 `/api/location`。
4. 配置中心新增字段：`app.geoProvider`、`app.geoKey`；`ENV_DEFAULTS` 中为空串；`FIELD_LABELS` 中加中文 label + 选填 tag + 描述。

### 本地测试需求
- **rule T2-1**：geoKey 为空时 `POST /api/location/reverse` 返回 200 且 body 中 `source === 'not-configured'`，不发出外网请求（可通过响应体字段确认）。
- **rule T2-2**：`GET /api/location/guess-by-ip` 无论配置如何始终 200，返回 `{ province, city }` 两字段非空。
- **rule T2-3**：`normalizeCityName('广州')==='广州市'`；`normalizeCityName('北京市')==='北京市'`（幂等）。
- **rubric T2-4**（降级完备性 0-2，≥1）：
  - 0：有任一路径会 500 或未配置时抛 400 给前端。
  - 1：两条路由都 200，有兜底值，但缺少日志与 source/fallback 标识。
  - 2：日志 info 级别打印 tookMs、provider、source；返回体标识清晰便于前端降级提示。

### 完成证据
- Jest `location.test.js`（3+ 用例）；
- routes 挂载冒烟；
- FIELD_LABELS / ENV_DEFAULTS 变更位置的代码链接。

---

## Task 3: 搜索后端扩展（services/posts/groups/user.discover 同义+meta+keyword 长度策略）
- **依赖**：Task 1
- **优先级**：high
- **Status**: pending

### 实现
1. `server/src/utils/searchAlias.js`：构建同义词表（LOL/撸啊撸=英雄联盟、吃鸡=和平精英、农药=王者荣耀、剧本杀=剧本杀…）并导出 `expandAlias(keyword)`。
2. 对 4 个列表路由：
   - `services.js`：keyword 走 `expandAlias`；城市字段使用 Task 1 的 normalizeCityName 兼容"广州/广州市"；
   - `posts.js / groups.js`：keyword 长度 <2 时返回空数组 + `meta.ignored=true`；
   - `user.discover` 扩展字段（nickname/标签/服务标题/城市）模糊；avatar 缺失兜底默认 avatar URL；nickname 兜底为"用户#{id}"。
3. 统一响应 `meta` 注入：改造 `utils/response.js success()` 支持第三个参数 meta；若传 meta 则返回 `{ code, data, message, meta }`。
4. `request.js` 或日志中间件：搜索/定位接口写 info 日志记录 tookMs。

### 本地测试需求
- **rule T3-1**：`GET /api/services?keyword=LOL` 返回的 list 中存在 `title like 英雄联盟`；同时 meta.tookMs 是数字。
- **rule T3-2**：`GET /api/posts?keyword=X`（长度 1）返回 list=[] 且 meta.ignored=true。
- **rule T3-3**：`GET /api/user/discover?city=北京` 当数据库中 avatar 字段为空时，返回的 avatar 字段是字符串（非空）。
- **rubric T3-4**（搜索质量 0-2，≥1）：
  - 0：同义映射缺失或 meta 字段不全。
  - 1：4 个接口都有 meta 与同义扩展；但别名只有 10 个以下。
  - 2：别名覆盖 ≥20 组常见电竞/桌游/陪练场景词汇；响应体里 reason 有描述。

### 完成证据
- Jest 新增 `searchAlias.test.js` / 修改 `services.test.js` 单测；
- 4 个接口 HTTP 冒烟返回包含 meta 字段。

---

## Task 4: 前端城市选择页企业级改版（全国 34 省 + 地级市全覆盖 + 字母索引 + 三模搜索）
- **依赖**：Task 1、Task 2
- **优先级**：high
- **Status**: pending

### 实现
1. `app/src/api/index.js`：新增 `regionsApi.tree() / regionsApi.search(kw) / locationApi.reverse({ lat, lng }) / locationApi.guessIp()`。
2. 重写 `app/src/pages/city/city.vue`：
   - 启动时请求 `/api/regions/tree`，构造"字母→城市"分组 `letterGroups`，仅生成实际有城市的字母（A..Z 按序）。
   - 顶部搜索框：change 调用 `/api/regions/search?kw=`，结果优先展示；空值时渲染字母分组。
   - 右列字母索引条：`scrollToLetter(L)` 使用 `uni.createSelectorQuery().select('#group-'+L).boundingClientRect + uni.pageScrollTo`（H5 与小程序通用）。
   - 顶部定位模块：调用 4 级流水线（getLocation → reverse → guessIp → 默认），各级用 try/catch 吞错；成功则高亮"当前已定位 XX 市"；失败则显示软提示"定位服务暂未配置，已切换到手动选择城市"。
   - 热门城市 12 个：选择一线+新一线+业务高频（北上广深、成都、杭州、武汉、西安、重庆、南京、长沙、郑州…）；从 regionsTree 匹配取真实 name。
   - 选择城市后：写入 `baiye_city` + `emitPagesReloadCity`（事件总线），首页/发现页监听后刷新；`uni.navigateBack()` 返回。
3. pages.json 确认 city 路由存在（之前已注册，不增删）。

### 本地测试需求
- **rule T4-1**：H5 页面加载 city 后，字母索引条渲染数量 > 20（全国应覆盖绝大多数字母）。
- **rule T4-2**：搜索框输入 "bj" → 候选项含 "北京市"；点击后 `baiye_city` 存储内容含 "北京市"。
- **rule T4-3**：未配置 geo 且关闭定位权限后，顶部软提示条出现且页面无 JS Error（Console 无 uncaught）。
- **rubric T4-4**（体验 0-2，≥1）：
  - 0：交互卡顿、字母点击无滚动、搜索接口一直 pending。
  - 1：功能完备但 UI 与白夜主题色偏差明显。
  - 2：严格遵循白夜主题，卡片金色点缀、极光渐变背景、响应式高度适配刘海屏。

### 完成证据
- 搜索"bj / shenzhen / 郑州" 3 组关键词的成功截图/H5 HTTP 日志；
- city 页面字母索引条 DOM 渲染存在；
- 选择后 home 页城市显示刷新的观察证据。

---

## Task 5: 首页 / 发现页 / 搜索页 7 大场景全量兜底 + 未登录降级
- **依赖**：Task 3、Task 4
- **优先级**：high
- **Status**: pending

### 实现
1. 新增 `app/src/utils/fallback.js`：
   - `toList(v)`：`Array.isArray(v) ? v : []`
   - `toObj(v)`：`v && typeof v==='object' && !Array.isArray(v) ? v : {}`
   - `toStr(v, d='')`：`typeof v==='string' ? v : d`
   - `toNum(v, d=0)`：`Number.isFinite(+v)?+v:d`
   - 通用空态占位图 URL（`/static/empty/…`，使用项目已有 static 路径或内联 SVG Data URI 避免请求）。
2. 改造 7 大页面：
   - **home**：services/banners/categories 三路请求，任意失败在对应区块显示 "加载失败 点击重试"；空态显示去发布/去配置中心；未登录时 精英入口/签到区显示登录按钮。
   - **discover**：寻人大厅 / 动态 / 组局 / 红包 4 Tab，分别做 toList；未登录隐藏"我的动态/报名"部分。
   - **search**：4 Tab 搜索结果列表都走 toList；接口失败保留已输入 keyword 并给出 "点击重试"；历史搜索为空时降级为空态图。
   - **city**：Task 4 已含兜底；本任务复核。
   - **orders**：4 个状态 Tab + 空态图；接口失败 toast + 重试。
   - **wallet**：余额/钻石/交易记录/签到/充值 均做类型收敛；提现接口失败不清空输入框。
   - **profile**：统计数据（服务数/订单数/钻石）默认 0；认证徽章、精英状态缺省 false。
3. `request.js` 改造：已在之前做了一部分；此任务要求失败回调除 toast 外，`request(options)` 支持 `options.silentFail=true`（关键空态场景避免骚扰式 toast）。

### 本地测试需求
- **rule T5-1**：在浏览器使用 Block URL 方式阻断 7 大页面各 1 个核心请求 → 页面无 "undefined" 文本、无未捕获错误、有空态/重试按钮。
- **rule T5-2**：未登录进入首页、订单、钱包 → 无任何 401 弹窗 toast 叠加次数 ≥3 的情况（登录引导使用静态 UI，不请求需要鉴权的接口）。
- **rubric T5-3**（质量 0-3，≥2）：
  - 0：仍有明显崩溃或 undefined 展示。
  - 1：主要页面兜底，但空态 UI 风格不统一。
  - 2：7 大页面兜底风格统一、无 undefined、关键路径可重试。
  - 3：再加上 记忆滚动位置 / 记忆查询参数 / 错误提示含可执行建议。

### 完成证据
- 阻断请求后的 7 页截图或 DOM 校验输出；
- 未登录态下 Console 无 401 相关重复错误；
- fallback.js 工具函数覆盖率的 Jest 单测（`app/test-utils/fallback.test.js`，若已有则扩展）。

---

## Task 6: 构建 & 打包验证（H5 + 微信小程序双端）
- **依赖**：Task 1-5 至少代码完成
- **优先级**：high
- **Status**: pending

### 实现
1. 在 `app/package.json` 增加脚本：
   - `"build:h5": "uni build -p h5"` 或使用 Vite 对应命令（依据当前 uni cli 版本，若缺失 `uni` 命令则回退到 `npx vite build -c vite.config.js --mode h5`，需验证两种）。
   - `"build:mp-weixin": "uni build -p mp-weixin"`（同上 fallback）。
2. 运行构建并收集日志，输出构建用时与产物大小。
3. 校验 H5：`Test-H5.ps1`（或临时 Node 脚本）：
   - 存在 `dist/build/h5/index.html`
   - index.html 解析 `<link rel=stylesheet>` 与 `<script src=…>` 抽样 6 个（首 3 + 尾 3），都以 `/static/` 开头；无 `/node_modules/` 引用
   - 启动临时 `http-server`（没有则 `python -m http.server`），`Invoke-WebRequest` 对 index + 抽样资源全部返回 200。
4. 校验微信小程序：`Test-MP.ps1`
   - 存在 `dist/build/mp-weixin/app.json`、`app.js`、`app.wxss`、`project.config.json`（若 uni 不生成 project.config.json，则提供一份最小模板 `build/mp-weixin/project.config.json` 脚本生成）。
   - 页面文件：`pages/home`、`pages/discover`、`pages/search`、`pages/city`、`pages/order/list`、`pages/profile`、`pages/wallet/wallet` 目录下都有 `index.js / index.wxml`（或等价文件，视 uni 命名规范而定）。
5. 构建产物合规检查：`dist/**` 中 grep 不到 `admin123`；grep 不到 `http://localhost:3000`（H5 中必须是相对 `/api`）。

### 本地测试需求
- **rule T6-1**：H5 产物中 `index.html` + 6 个抽样静态资源 200 OK。
- **rule T6-2**：小程序 7 个核心目录齐全且可被微信开发者工具导入（以文件存在性判断）。
- **rule T6-3**：`dist/**` 无 `admin123` / `http://localhost:3000` 明文敏感内容。
- **rubric T6-4**（完备度 0-3，≥2）：
  - 0：两端缺一个或以上无法构建。
  - 1：能构建，但目录结构与规范差异较大需手动修正。
  - 2：两端直接可用，资源校验通过。
  - 3：附带量化数据（文件数、Gzip 体积估算等）。

### 完成证据
- 构建日志完整输出（stdout 尾部 60 行）；
- Test-H5.ps1 / Test-MP.ps1 执行结果；
- `findstr /s` 敏感内容扫描输出。

---

## Task 7: 文档与配置中心元数据同步
- **依赖**：Task 1-6
- **优先级**：medium
- **Status**: pending

### 实现
1. `PROJECT.md`：新增"全国行政区划覆盖说明"、"4 级定位流水线"、"打包命令与产物校验"三章。
2. `README.md`：Quick Start 新增 `npm run build:h5 / build:mp-weixin`、三端构建产物路径与部署建议；新配置项说明。
3. `.env.example`：新增 `# App: 定位服务（amap/tencent/off）` 注释段落，app.geoProvider 与 app.geoKey 默认为空，示例给占位值。
4. 配置中心 FIELD_LABELS：新增 app.geoProvider / app.geoKey 中文 label、选填标签和描述；Settings.vue UI 能渲染。

### 本地测试需求
- **rule T7-1**：三个文档都包含新增章节且不与现有内容冲突。
- **rule T7-2**：Settings.vue 配置中心"应用"模块出现"地理逆解服务提供商"和"地理服务密钥"两个字段，标签为中文且符合 spec。
- **rubric T7-3**（文档质量 0-2，≥1）：
  - 0：缺两个以上文档更新。
  - 1：三个都更了但步骤不够复现。
  - 2：三个都更，含具体命令 + 预期输出说明。

### 完成证据
- 三处文档的最终 diff（以行号引用路径）；
- Settings.vue 界面渲染字段截图（或 DOM 校验）。

---

## Task 8: 回归测试与最终打包证据
- **依赖**：Task 1-7
- **优先级**：high
- **Status**: pending

### 实现
1. 运行：`cd server; npm test`（Jest 12+ 套件）。
2. HTTP 冒烟脚本跑：
   - health + regions/tree + regions/search + services?keyword=LOL + posts?keyword=X + user.discover + location/reverse（未配置）+ guess-by-ip。
3. 运行 Task 6 H5 & 小程序构建 + 验证脚本。
4. 汇总证据写入 `tasks.md` 末尾的「最终回归证据表」（后续 review 引用）。

### 本地测试需求
- **rule T8-1**：Jest 全部通过（不降级通过率）。
- **rule T8-2**：所有冒烟接口 code==0 或 200。
- **rule T8-3**：H5/小程序双端构建均成功。
- **rubric T8-4**（0-2，≥1）：
  - 0：存在任一项 red。
  - 1：全部通过，但证据缺日志。
  - 2：全部通过 + 证据表齐备可复用。

### 完成证据
- Jest 输出尾部 40 行；
- HTTP 冒烟表；
- 构建与校验表；
- 三端当前端口和访问地址的最终列表。
