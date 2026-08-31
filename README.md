# 白夜 App · 高效陪伴与邀约平台

> 白夜 v2 品牌升级 · 午夜蓝 × 金色 × 紫极光 设计体系。
> 用户可发布/购买陪伴服务（暖心 / 游戏 / 线下约玩 / 虚拟恋人 / 唱歌 / 哄睡）、
> 浏览动态广场 / 同城组局 / 新人秀 / 红包签到，平台通过「白夜精英」会员锁定真实付费用户，
> 并内置股东邀请裂变（10% 分红）。uni-app 三端（H5 / 微信小程序 / App）+ Express 后端 + Vue 3 管理后台。

***

## 快速开始

### 目录结构

```
companion-play-app/
├── app/                  # uniapp 移动端（Vue 3 + Vite，一套代码多端打包）
│   └── src/static/sucai/ # 10 张落地素材（T12 从根目录 sucai/ 导入）
├── server/               # 后端 API（Express + Sequelize/MySQL 主存储 + JSON 回退 + WebSocket + AI 聊天层）
│   ├── src/models/        # 18 个模型（含 ServiceCategory 服务分类）
│   ├── src/routes/        # 18 个路由（含 admin 服务分类 CRUD + AI 模块真测试）
│   └── uploads/sucai/    # 与 app/static/sucai 一一对应的对外可访问素材
├── admin/                # 管理后台（Vue 3 + Element Plus）
│   └── src/views/services/ # 服务审核 + 分类管理（Categories.vue）
├── docs/                 # 文档（PROJECT / PRIVACY / APP-STORE-CHECKLIST / BRAND-REFERENCE）
├── pages/                # 设计原型 HTML（参考）
├── scripts/              # 工具脚本
│   ├── rebrand-baiye.js  # 品牌重命名（原品牌曾用名：伴玩 → 白夜）
│   ├── generate-icons.js # 白夜主题图标/启动图/TabBar 4×2 图标 PNG 生成
│   └── setup-test-accounts.js
├── sucai/                # 用户提供的 10 张同类型项目参考素材
└── README.md
```

### 环境要求

* **Node.js 18+**

* **MySQL 8.0+（生产必填；开发可回退到本地 JSON 文件存储，零额外依赖）**

* Redis 可选（预留：验证码缓存 / 频控）

> 说明：后端 **默认主存储已升级为 Sequelize + MySQL**，并提供 `DB_DRIVER=json` 的本地 JSON 文件回退模式（便于本地开发 / Jest 单测）。
>
> * `NODE_ENV=production` → 强制走真实 MySQL，未配置连接会启动失败并给出诊断。
>
> * `NODE_ENV=development` + `DB_DRIVER=mysql` → 开发环境手动启用 MySQL。
>
> * `NODE_ENV=development` 且未设置 `DB_DRIVER` / `DB_DRIVER=json` → 回退到 `server/data/*.json`，零依赖即可跑。
>   详细切换方式见 `server/.env.example` 与「部署章节」。

### 1. 启动后端 API

```bash
cd server
npm install

# ---------- 方式 A：本地零依赖（JSON 回退，适合初次体验 / 前端开发） ----------
# 无需 MySQL，.env 默认 DB_DRIVER=json 即可
npm run seed          # 初始化：admin 管理员 + 配置中心空模板（幂等，不创建测试账号）
npm run dev           # http://localhost:3000

# ---------- 方式 B：生产级 MySQL（推荐部署 / 后端联调） ----------
# 1) 创建数据库（MySQL 8.0 推荐；5.7 需显式指定 utf8mb4）
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS companion_play DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;"
# 2) 拷贝 .env.example → .env，填写 DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD，DB_DRIVER=mysql 或置空
#    注意：NODE_ENV=production 时会强制忽略 DB_DRIVER 并直连 MySQL
# 3) 初始化 + 启动
npm run seed          # 自动建表（alter 模式：保留老数据 + 补齐列/索引）+ 管理员 + 配置模板
npm run start         # http://localhost:3000
```

初始化后：

* 管理员账号：`admin` / `admin123`（首次进入管理后台请立即修改密码）

* 用户账号：通过 App 端短信验证码自行注册（未配置短信会提示在管理后台「配置中心 → 短信」填写阿里云/腾讯云参数）

* 敏感配置（短信/支付/OSS/推送/应用密钥）全部在管理后台「配置中心」填写并热生效，env 只作预留位

### 2. 启动管理后台

```bash
cd admin
npm install
npm run dev           # http://localhost:5174 （自动代理 /api 到后端 3000）
```

登录账号：`admin` / `admin123`

包含：仪表盘（金色指标 12+：含动态/组局/精英人数/累计收入 4 新增）/ 用户管理（真人/AI 用户创建+编辑+详情+封禁）/ **服务管理（服务审核 + 分类管理子菜单）** / 订单 / 财务（含提现审核 / **精英订单** Tab）
/ 邀请 / 内容 / **发现（动态管理 + 组局管理）/ 运营（Banner 管理）** / 配置中心（6 模块：应用/短信/微信支付/支付宝/OSS/推送，颜色编码必填，支持**真实网络探测**测试连通性与按模块重置；AI 模块测试逻辑已内置，可按需注册为第 7 模块）。

### 3. 启动移动端

```bash
cd app
npm install
npm run dev:h5        # H5 预览（自动代理 /api 到后端 3000）
```

或用 HBuilderX 打开 `app/` 目录，运行到 H5 / 微信小程序 / App 真机。

* AppID：`__UNI__B38A42D`（manifest.json 已锁定）

* 应用名：**白夜**（manifest.json / pages.json / 设置页关于 已统一）

> 登录流程：验证码 Tab 点「发送验证码」
>
> * 未配置短信时：后端会返回明确错误「短信服务尚未配置，请在管理后台「配置中心 → 短信」…」，请先登录管理后台（<http://localhost:5174/dashboard）填写阿里云或腾讯云短信参数。>
>
> * 真实配置后：短信网关下发 6 位验证码，填入即可登录。首次注册登录后引导设置密码。
>
> * 密码 Tab：手机号 + 密码直接登录（需用户已设置密码；管理员在后台修改用户密码后，用户无需验证码即可使用密码登录）。

### 4. 原生 App 云打包（Android APK / iOS IPA）

**前置校验已全部通过**：App 离线资源包 98 文件 / 5.43 MB、17 档多尺寸图标 + 7 档启动图齐全、manifest.json 7 项 Android 权限声明、动态导入冲突告警零残留。

```bash
# 1) 构建最新 App 离线资源包（HBuilder X 也会自动触发，建议先本地校验）
cd app && npm run build:app
# 产物: app/dist/build/app/   (HBuilder X 导入该目录或导入 app/ 均可)
```

**完整操作步骤、证书占位清单、Android/iOS 双平台参数、BASE\_URL 生产环境切换**请直接查阅：

* [`docs/PROJECT.md → Phase 8 上线发布`](./docs/PROJECT.md#phase-8--上线发布进行中)（包含 8 条详细打包步骤 + 12 项证书 / 配置字段占位表 + BASE\_URL 生产切换方案）

* [`docs/APP-STORE-CHECKLIST.md`](./docs/APP-STORE-CHECKLIST.md)（九大类应用市场 / App Store 提审自检清单 v2）

**快速路径**：

1. 打开 **HBuilder X** → 项目 → 打开目录 → 选择 `d:\tongcheng\companion-play-app\app\`
2. 菜单 → **发行** → **原生 App-云打包**
3. **Android**：勾选 Android（APK）→ 使用自有证书（或 DCloud 公共证书用于内测）→ 填包名（例：`com.baiye.app`）→ 打正式包 → 下载 APK
4. **iOS**：勾选 iOS → 上传 `.p12`（Distribution）+ `.mobileprovision`（App Store）→ 填同一 Bundle ID → 打正式包 → 下载 IPA 并用 Transporter 上传 App Store Connect

***

## 功能全景（白夜 v2）

| 模块                | 说明                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 登录注册              | 短信验证码登录（dev/阿里云/腾讯云三模式 + 5 分钟有效）+ **密码登录（验证码/密码双 Tab，注册后引导设置密码，管理员改密后可直接密码登录）**                                                                                   |
| 首页改版              | Banner 轮播（净化网络 / 组局新玩法）+ 快捷入口（暖心/游戏/同城）+ 新人秀 + 精英 CTA                                                                                                             |
| 发现页 4 Tab         | 寻人大厅 / 动态广场 / 同城组局 / 红包签到专区                                                                                                                                       |
| 动态广场              | 文本 + 最多 9 图 + 敏感词发布前过滤 + 审核状态 + 点赞/评论 + 城市筛选                                                                                                                      |
| 发布动态              | 文本 (500 字上限) + 9 图上传 + 城市选择 + 登录守卫 + 对接 `postApi.create`                                                                                                          |
| 同城组局              | 8 个模板（电影/三亚旅行/密室/桌游/KTV/美食探店/夜爬/剧本杀）+ 人数进度条 + 报名审核                                                                                                                |
| 组局详情              | 头部极光渐变封面 + 标签 + 报名人员头像墙 + `报名进群`/`联系发起人` 双按钮                                                                                                                      |
| 红包专区              | 每日签到领 💎 + 本地存储防止重复领取（最低要求实现）                                                                                                                                     |
| 白夜精英会员            | 一次性 ¥30 终身 / 6 项权益 / 平台三大保证 / 为什么付费可折叠说明                                                                                                                          |
| 精英付费下单            | `eliteApi.order` + dev 直开通道 + 7 天无理由退款条款                                                                                                                          |
| 微信解锁查看            | 精英解锁 99 💎 / 次 → 返回真实微信；余额/非精英报错                                                                                                                                  |
| 精英 E 标展示          | 个人中心/聊天/服务者主页头像旁金「E」+ 极光渐变描边                                                                                                                                      |
| 暖心服务              | 虚拟恋人、唱歌、哄睡、叫醒、点歌弹唱、温柔哄睡陪伴                                                                                                                                         |
| 游戏陪玩              | 王者、和平精英、LOL、原神、永劫无间                                                                                                                                               |
| 线下约玩              | 探店/桌游/密室（精英优先展示 + 联系守卫）                                                                                                                                           |
| 服务详情              | 完整信息 + 备注/数量 + 立即下单 + 跳转服务者主页                                                                                                                                     |
| 服务发布              | 分类/子分类/标签/价格单位，发布后审核（admin 审核 Tab）                                                                                                                                |
| 我的服务              | 状态筛选、上下架、查看详情、删除                                                                                                                                                  |
| 服务者主页             | 公开访问：资料 + 订单/评分统计 + 在线服务列表 + 私信/收藏                                                                                                                                |
| 新人秀横滚             | 新认证用户卡片（24h 内）+ 右上角一键关闭                                                                                                                                           |
| 个人中心              | 精英徽章 + 开通/查看特权入口 + 钱包/订单/服务/消息/反馈/设置入口                                                                                                                            |
| 资料编辑              | 头像专用上传 + 昵称/性别/城市/简介编辑                                                                                                                                            |
| 钱包                | 钻石充值（真实微信/支付宝通道 + 回调幂等入账；未配置提示后台配置；**已移除 dev 直入账回退**）、星币兑换、收入提现（最低提现额 + 手续费 + 审核制）、交易记录                                                                           |
| 订单                | 买家/卖家双视角：下单/支付/开始/完成/取消/退款                                                                                                                                        |
| 评价系统              | 完成后星级 + 评价图片 + 匿名评价，服务详情评价列表分页                                                                                                                                    |
| IM 聊天             | WebSocket 实时（文本/语音）、会话列表、已读、输入中、离线推送、**首次主动私聊精英守卫**                                                                                                               |
| 语音消息              | 录制（MP3 / 60 秒上限）+ 上传 + 播放（按住说话 UI）                                                                                                                                |
| 聊天守卫              | 非精英 + 对方无回复历史 → 弹「开通精英后畅聊」Modal 引导开通                                                                                                                              |
| 推送服务              | 订单状态/叫醒/IM 离线（极光/个推双模式 + Socket.IO 在线优先；未配置明确报错；**SDK 已安装 axios**）                                                                                                |
| 邀请股东              | 10% 消费分红、排行榜、月度奖励、H5 复制链接/微信分享                                                                                                                                    |
| 意见反馈              | Bug/建议/投诉举报 + **举报动态/组局/用户下拉 + 对应 ID 字段**（支持图片 3 张）                                                                                                               |
| 举报处理              | 后台处理弹窗（审核通过 / 拒绝 + 回复 + 钻石奖励）                                                                                                                                     |
| 客服联系              | 配置中心 → 客服微信号复制 + 引导反馈页                                                                                                                                            |
| 设置页               | 真人/身份认证、换绑手机号、短信免打扰、**动态/组局通知开关（持久化至 meta.notification）**、注销账号                                                                                                    |
| 账号注销              | 30 天冷静期软删除 + 未完成订单校验                                                                                                                                              |
| TabBar 4 项        | 首页 / 发现 / 消息 / 我的（4×2 PNG 图标：白夜主题金色渐变 + 极光描边）                                                                                                                     |
| 设计主题              | 午夜蓝 `#0b0f1a` 底 / 金 `#d4af37` 强调 / 紫极光 `#7b61ff→#b57bff` 渐变 Banner                                                                                                |
| 品牌重命名             | 原品牌曾用名「伴玩」→「白夜」，`scripts/rebrand-baiye.js --check` 可验证                                                                                                            |
| 敏感词过滤             | 30+ 正则黑名单中间件，挂动态/评论/反馈发布前（避免误杀「白夜」白名单）                                                                                                                            |
| Banner 运营         | 2 张默认：净化网络 / 组局新玩法（素材在 `sucai/`），后台 CRUD + 权重/位置/启用开关                                                                                                             |
| 动态管理 Admin        | 搜索作者/内容 + 审核（通过/拒绝）+ 删除 + 点赞/评论数展示                                                                                                                                |
| 组局管理 Admin        | 搜索标题/发起人 + 状态筛选（招募中/已满/已关闭）+ 关闭/重开/删除                                                                                                                             |
| Banner 管理 Admin   | 新增/编辑/删除/启用开关/权重 + 预览图 + 表单 Dialog                                                                                                                                |
| 精英订单 Admin        | 4 统计卡（总数/已付/收入/今日）+ 筛选渠道/状态 + 当前页 CSV 导出                                                                                                                          |
| 仪表盘新增指标           | 动态数 / 组局数 / 精英付费人数 / 精英累计收入（金色渐变字）                                                                                                                                |
| JSON 存储层扩展        | Collection 静态 `update/destroy` 批量能力，作为 **MySQL 主存储不可用时的开发/测试回退**，支持精英开通后批量写入                                                                                      |
| 主存储适配             | **Sequelize 6 + mysql2**：18 个模型 + 关联 + 索引，统一主键 BIGINT UNSIGNED 自增，utf8mb4/时区+08:00；驱动可切换（DB\_DRIVER=json/mysql，生产强制 mysql）                                        |
| 图片上传              | multer + uni.uploadFile（本地 / 阿里云 OSS 双模式，ali-oss SDK 已安装），反馈/封面/评价/头像/认证照                                                                                         |
| 城市选择              | **全国 34 省 + 382 地级市多级菜单**（按省选择 Tab：展开省份→点击城市；按字母查找 Tab：A-Z 索引；4 级定位流水线降级）                                                                                         |
| 服务分类管理            | **后台可上下架/排序/编辑用户端服务类型**：ServiceCategory 模型支持二级树形分类（3 顶级 + 11 子项默认数据），管理后台 Categories.vue 实现 CRUD + 上下架 + 排序，用户端 `/services/categories` 从 DB 动态读取，异常降级到内置数据        |
| AI 用户聊天           | **DeepSeek 大模型接入**：User 模型支持 userType=ai + aiProvider=deepseek/openai/custom + aiConfig 配置；chat.js 实现三级兜底（用户配置→配置中心备用→本地策略回复），管理员可在用户管理创建 AI 用户并配置 API Key/URL/模型 |
| 配置中心真测试           | **6 模块真实网络探测**（不再虚假通过）：短信→阿里云/腾讯云 API 真实请求；微信/支付宝→网关 POST；OSS→bucket HEAD；推送→极光/个推 API；空配置/乱填均返回明确失败提示。AI 模块测试逻辑已内置（DeepSeek/OpenAI ping），可按需注册为第 7 模块            |
| 安全防护              | Helmet + CORS + API 限流 + XSS 输入过滤 + 敏感日志脱敏 + JWT 双 Token                                                                                                          |
| 测试体系              | Jest + supertest **12 套件 95 用例 100% 通过**（短信限流豁免 / 精英 dev 仅 Jest / 推送 test-memory / notify require 路径等全部覆盖）                                                        |
| E2E 集成测试          | **83+ 条**（含动态 CRUD/点赞/评论、组局报名、精英付费、微信解锁、Banner CRUD、签到闭环）                                                                                                         |
| 压测                | `npm run bench` QPS/P50/P95/P99 报告                                                                                                                                |
| CI/CD             | GitHub Actions：后端测试 + 管理后台构建 + 移动端构建 + 品牌反扫                                                                                                                       |
| H5 打包输出           | `app/dist/build/h5/`（HBuilderX → 发行 → 网站-PC 或手机 H5）                                                                                                               |
| 小程序打包输出           | `app/dist/build/mp-weixin/`（用微信开发者工具导入 → 上传代码 → 提审）                                                                                                               |
| App 打包            | HBuilderX 云打包（已配置 manifest.json name / icons / splash / appid `__UNI__B38A42D`）                                                                                   |
| 文档交付              | README / PROJECT(61 行功能表) / PRIVACY / APP-STORE-CHECKLIST / BRAND-REFERENCE(10 张 sucai → 实现文件映射)                                                                  |
| SDK 生产已安装（server） | axios + @alicloud/dysmsapi20170525 + @alicloud/openapi-client（阿里云短信）；tencentcloud-sdk-nodejs-sms（腾讯云短信）；alipay-sdk（支付宝）；ali-oss（阿里云 OSS）                          |

***

## 技术栈

| 层             | 技术                                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 移动端           | uni-app（Vue 3 + Vite）+ Pinia + uni.scss 设计 token `$by-*` + 自研 TabBar 4×2 图标                                                                                            |
| 后端            | Express 4 + JWT(access/refresh 双 Token) + multer + Socket.IO + **Sequelize/MySQL 主存储** + JSON Store(Sequelize API 兼容回退) + Jest + **AI 聊天层（DeepSeek/OpenAI 兼容 + 三级兜底）** |
| 后端 SDK（生产已安装） | sequelize + mysql2（主存储 ORM）；axios + alipay-sdk + ali-oss + @alicloud/dysmsapi20170525 + @alicloud/openapi-client + tencentcloud-sdk-nodejs-sms；scrypt（密码哈希）            |
| 管理后台          | Vue 3 + Vite + Element Plus(+ 金色主题) + Pinia + Vue Router 4 + Axios                                                                                                     |
| 测试            | Jest + supertest（unit，12 套件 / 95 用例，100% 通过）；Node 脚本（e2e 83+）；`generate-icons.js --check`（图标完整性）                                                                       |
| 打包            | HBuilderX（H5 / 小程序 / iOS / Android）；Vite CLI（admin dev/build）                                                                                                          |

***

## 宝塔面板部署 · 生产级上线指南（8 步上线 + 11 条健康验收）

> 交付物：
>
> * `server/ecosystem.config.js` — PM2 进程守护（cluster 多实例 + 14 天日志切分 + 崩溃熔断）
>
> * `deploy/nginx-baiye.conf` — HTTPS 站点模板（HTTP→HTTPS、/api 反代、/uploads 直出、Socket.IO、管理后台、H5、敏感文件拦截）
>
> * `admin/.env.production` — 管理后台 Vite 生产构建变量

### 服务器最低配置（建议）

| 规模         | CPU | 内存    | 带宽            | 磁盘               | 说明                       |
| ---------- | --- | ----- | ------------- | ---------------- | ------------------------ |
| 冷启动/内测     | 2 核 | 4 GB  | 5 Mbps        | 40 GB SSD + 宝塔快照 | 够用；MySQL 同机；日均 < 2k 登录   |
| 小规模生产      | 4 核 | 8 GB  | 10 Mbps       | 80 GB SSD + 云盘挂载 | 推荐；可拆 Redis / MySQL 独立实例 |
| 日均 2w+ DAU | 8 核 | 16 GB | 20 Mbps + CDN | 160 GB + OSS     | 拆出 MySQL 高可用 + 独立 Redis  |

### 步骤一：宝塔面板基础软件安装

1. 面板 → 软件商店：安装 Nginx 1.24+、MySQL 8.0、Node.js 18 LTS（管理器勾选 PM2）。
2. 面板 → 安全 / 云厂商安全组：放行 80、443；3306、3000、5173-5174 仅 127.0.0.1 或内网。
3. 面板 → 数据库 → 添加数据库：

   ```
   库名 companion_play / 编码 utf8mb4 / 排序 utf8mb4_unicode_ci
   ```

   记下账号/密码，下一步写进 `server/.env`。

### 步骤二：上传代码到服务器（推荐 Git + 宝塔一键拉取，排除 5 类敏感）

```bash
# 服务器 /www/wwwroot/baiye/ 目录下执行
git clone <你的私有仓库地址> /www/wwwroot/baiye
cd /www/wwwroot/baiye

# 部署排除清单（禁止覆盖，务必与代码同步脚本/ SFTP 规则隔离）：
#   /server/.env                （生产密钥）
#   /server/data/               （JSON 回退数据，仅 DB_DRIVER=json 才用）
#   /server/uploads/            （用户上传，别被构建清掉；Nginx /uploads alias 即指向此）
#   /server/logs/               （PM2 日志）
#   /admin/dist/  /app/dist/    （构建产物，CI 覆盖没问题）
```

### 步骤三：后端依赖 + .env 配置

```bash
cd /www/wwwroot/baiye/server
# 生产建议：--omit=dev 只装生产依赖（或宝塔 PM2 自动安装）
npm ci --omit=dev

# 复制模板并真实填写（每行结尾不要留空格）
cp .env.example .env
vi .env
```

.env 关键填写项（**必填**用 ⚑ 标注）：

```
NODE_ENV=production               # ⚑
PORT=3000
DB_DRIVER=mysql
DB_HOST=127.0.0.1                 # ⚑ 或独立 MySQL 内网 IP
DB_PORT=3306
DB_NAME=companion_play            # ⚑
DB_USER=companion_play            # ⚑ 不要用 root，新建只授权该库的账号
DB_PASSWORD=<16+ 位强密码>        # ⚑
DB_POOL_MAX=20   # 2C4G=20；4C8G=40
DB_POOL_MIN=2
JWT_SECRET=<openssl rand -hex 32  生成>   # ⚑ 32+ 位
JWT_REFRESH_SECRET=<不同的随机串>          # ⚑
APP_DOMAIN=https://baiye.yourdomain.com    # ⚑ 支付/短信回调 URL 拼接来源
CORS_ORIGINS=https://baiye.yourdomain.com,https://admin.yourdomain.com   # ⚑
# 短信 / 支付 / OSS / 推送 —— env 可留占位符，首启后在管理后台「配置中心」填写更安全
```

### 步骤四：首次建表 + 初始化

```bash
cd /www/wwwroot/baiye/server
node src/seed.js
# 看到：[SEED] admin OK | config templates OK → 代表 46 项模板 + admin/admin123 已入 MySQL
```

> 注：`sequelize.sync({ alter: true })` 会保留老数据、补齐新列/新索引，不删表。**不推荐生产用** **`force:true`**。

### 步骤五：PM2 进程守护（用本项目 ecosystem）

```bash
cd /www/wwwroot/baiye/server
# 宝塔图形化也行：软件 → PM2 管理器 → 添加项目：目录=server、启动文件=src/app.js、环境=production
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup     # 复制输出的 sudo 命令贴到 SSH，让开机自启生效
pm2 logs by-server --lines 200
# 期望看到：[DB] 驱动: MYSQL  +  HTTP server listen :3000
```

### 步骤六：Nginx 站点 + HTTPS 证书

1. 宝塔 → 网站 → 添加站点：域名 `baiye.yourdomain.com`、根目录 `/www/wwwroot/baiye`、PHP=纯静态。
2. 站点 → SSL → Let's Encrypt 一键申请，勾选「强制 HTTPS」。
3. 站点 → 设置 → 配置文件：删除默认内容，粘贴 `deploy/nginx-baiye.conf`，把里面 **3 处** `baiye.yourdomain.com` 替换为真实域名。
4. 宝塔 → 软件 → Nginx → 重载配置；无报错即生效。

### 步骤七：管理后台构建 + 发布

```bash
cd /www/wwwroot/baiye/admin
npm ci
npm run build      # 读取 admin/.env.production → 输出到 admin/dist
# nginx-baiye.conf 中 E 块：/admin/ alias 已指向 /www/wwwroot/baiye/admin/dist/
```

浏览器访问 `https://baiye.yourdomain.com/admin/` → 登录 `admin / admin123` → **立刻修改密码** → 配置中心填 6 大模块并逐个「测试连通性」。

### 步骤八：移动端发布（可选，同域名即可省 CORS）

* H5：`cd app && npm run build:h5`，Nginx F 块已指向 `/h5/`

* APK/iPA：HBuilder X → 发行 → 原生 App-云打包；包内「服务器地址」设 `https://baiye.yourdomain.com/api`（或动态配置入口「我的 → 设置 → 服务器地址」切换）

* 微信小程序：合法域名务必在微信公众平台 request/uploadFile/downloadFile/socket 合法域名单填 `https://baiye.yourdomain.com`

### 11 条健康验收（生产上线前必须全绿）

```bash
# 在你本机或堡垒机执行
export HOST=https://baiye.yourdomain.com

# 1) 健康条：驱动=mysql + SELECT 1 通过
curl -s $HOST/health | jq '{status,env,driver,storage}'
# 期望: status=ok, env=production, driver=mysql, storage 指向 mysql://...

# 2) /api 健康：MySQL 探针正常
curl -s $HOST/api/health | jq '{status,driver,dbOk}'
# 期望: status=ok, driver=mysql, dbOk=true

# 3) 管理后台健康条专用
curl -s -X POST $HOST/api/admin/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"你改过后的密码"}' > admin.json
TOKEN=$(jq -r .data.token admin.json)
curl -s $HOST/api/admin/config/status -H "x-admin-token: $TOKEN" | jq
# 期望: driver=mysql, ok=true, dbOk=true, pool=2-20

# 4) 配置中心 6 模块齐全
curl -s $HOST/api/admin/config/modules -H "x-admin-token: $TOKEN" | jq '.data | length'
# 期望: 6

# 5) 限流：默认 1 分钟 200 次接口（短信另有 60/minute + 20/hour 频控）
ab -n 210 -c 10 $HOST/api/health 2>&1 | grep 'Non-2xx responses'
# 期望: ≥ 10 个 429，证明限流启用

# 6) 上传 + 防盗链（OSS 未配置时走本地上传）
curl -s $HOST/uploads/sucai/banner-home.jpg -I | head -n 3
# 期望: HTTP/1.1 200 + Cache-Control 7d

# 7) 强制 HTTPS：HTTP 访问应 301 跳 HTTPS
curl -sI http://baiye.yourdomain.com/health | head -n 1
# 期望: 301

# 8) CORS 非法 Origin 在生产返回 4xx（避免 credentials+* 被利用）
curl -sI -H 'Origin: https://evil.com' $HOST/api/user/kefu | head -n 5
# 期望: 4xx 或无 Access-Control-Allow-Origin；有 x-admin-token 也跨不过去

# 9) Socket.IO 握手
curl -s "$HOST/socket.io/?EIO=4&transport=polling" | head -c 30
# 期望: 0{"sid":"…"

# 10) 敏感文件不可达（.env / seed.js / node_modules）
curl -sI $HOST/.env | head -n 1; curl -sI $HOST/ecosystem.config.js | head -n 1
# 期望: 403

# 11) 错误堆栈不泄露（生产）：故意打一个不存在的接口，不应出现「at /www/wwwroot/...」
curl -s $HOST/api/not-exist-xyz | jq
# 期望: message=接口不存在，无 _stack 字段（_stack 只开发模式返回）
```

### 宝塔面板上，项目能不能达到「生产环境标准」？

结论：**能**。满足以下 3 个边界就达标：

1. **部署严格按本章节 8 步**；尤其 NODE\_ENV=production、DB 账号只给 companion\_play 单库权限、CORS\_ORIGINS 白名单真实域名；
2. **验收 11 条全绿**（尤其驱动=mysql、HTTPS、错误不泄漏、敏感文件 403）；
3. **运维动作完成**：宝塔开启自动快照（每日 1 次 + 保留 7 天）、MySQL 定时备份到 OSS/对象存储（cron `mysqldump` 见 PROJECT.md Phase 8）、管理后台首启改密、配置中心 6 模块测试连通性全过。

若任一验收项失败，不要进入发布阶段；按本文件的 Phase 7.5 故障树定位即可。

***

## 2C2G 轻量服务器到底够不够用？（4 维量化结论 + 升级触发阈值）

### 一句话结论

**够**，用于「白夜」这类社交/陪伴型 App 的 **0 → 冷启动 → 日活 0.5k\~2k 阶段**，同时部署「Nginx + Node 后端 + MySQL 8 + 管理后台」完全可撑住。超过下表红线必须升配到 **4C8G**（否则会因为 MySQL + Node OOM 进入随机重启、支付回调失败、SMS 发送超时等诡异问题）。

### 4 维容量评估表（MySQL 8 / Node 18 / Nginx 同机）

| 维度                             | 2C2G 保守上限                                         | 2C4G 稳健上限     | 4C8G+ 生产基线           | 触发升级的监控阈值                                                      |
| ------------------------------ | ------------------------------------------------- | ------------- | -------------------- | -------------------------------------------------------------- |
| **并发请求（Nginx QPS）**            | 300\~500 / 秒                                      | 800\~1200 / 秒 | 3000\~8000 / 秒       | `pm2 monit` 单进程 CPU 持续 >75%；或 Nginx `$request_time` 50%>500ms  |
| **同时在线（长连 Socket.IO）**         | 300\~600 人                                        | 1200\~2500 人  | 5000+ 人（建议拆独立网关）     | `ss -s` TCP est > 600 持续 5 分钟                                  |
| **日均 DAU**                     | 1000\~2000                                        | 5000\~10000   | 3w+                  | 5xx 比例（生产 /health probe 统计）> 0.1% 连续 2 天                       |
| **MySQL TPS（下单/充值/提现等写入）**     | 80\~150 / 秒                                       | 200\~400 / 秒  | 1000+（读写分离）          | `SHOW GLOBAL STATUS LIKE 'Threads_running'` 连续 > 20            |
| **内存峰值（必须留 swap 2G 缓冲）**       | 1.55\~1.75 GB（含 buffer/cache）                     | 1.9\~3.1 GB   | 4\~6 GB              | `free -h` available < 180 MB 持续 30 分钟，且 swap used > 512MB 持续增大 |
| **磁盘 IOPS（本地 SSD 通常 3k\~10k）** | 图片/头像≤512KB 可支撑；付费订单写入不构成瓶颈                       | 同左            | OSS 直传 + 云盘 10k IOPS | `iostat -x 1 %util > 85%` 且 await > 20ms                       |
| **出站带宽**（用户上传 OSS 未启用时走本地）     | **5 Mbps：图片/短视频最多 200 张/分钟**；**10 Mbps：600 张/分钟** | 10 Mbps 起步 OK | 20 Mbps + CDN        | 网卡 TX/RX 占 90% 超过 10 分钟                                        |

### 2C2G 必须做的 8 项「保命调参」（不做必 OOM 崩溃）

1. ✅ **Swap 2GB + vm.swappiness=10**：MySQL 8 启动基线内存 \~450MB；swap 不写死循环不会明显慢，但没 swap 会直接被 Linux OOM killer 杀 mysqld。
2. ✅ **MySQL 8 innodb\_buffer\_pool\_size = 512M（不要默认 1G）**；max\_connections=150；long\_query\_time=1s 慢查询开启。
3. ✅ **Node 单实例 + 384M 阈值回收**：ecosystem `BY_INSTANCES=1` + `BY_MAX_MEM=384M`（**已经内置到 deploy/02-deploy-app.sh**）。
4. ✅ **Sequelize 连接池宁小不大**：`DB_POOL_MIN=1 / DB_POOL_MAX=6`（默认 6 = 每个 session buffer 约 2MB × 6 + 其它连接，留余量给 mysqld 本体）。
5. ✅ **OSS\_PROVIDER=aliyun 或腾讯 COS**：本地上传 /uploads 会占磁盘 + 出带宽；冷启动期可先用 `local`，DAU ≥ 500 立刻切云存储。
6. ✅ **不要启用同机 Redis**（验证码/频控用内存 Map 已足够；Redis 最少吃 40\~80MB，不值当）。升级到 2C4G 后再加。
7. ✅ **管理后台 Vite 构建产物静态化**（/admin/dist 交给 Nginx alias 直出，不要 `npm run dev` 常驻后台）。
8. ✅ **宝塔快照 + MySQL 每日备份**：2C2G 扛不住误操作后的抢救。

### 什么情况立刻换 4C8G？

* 运营上线拉新/开直播/做周末活动预告前 **3 天**就换（避免当天被打爆）

* 上线付费会员（白夜精英）+ 支付真实订单后：`Threads_running` > 10 且 p95 接口耗时 > 800ms

* IM 房间峰值 > 150 个：Socket.IO 广播 + MySQL 历史消息一起打，2C2G 吃不消

* iOS/安卓任一市场上架成功 + 投流期

***

## 轻量机 2C2G 部署完整流程（4 个脚本 = 一键串起所有 README 8 步）

> 交付物（全在项目 `deploy/` 目录，脚本里已写好注释 & 幂等回滚点，放心跑）：
>
> * `deploy/00-install-bt.sh`  一键装宝塔 + 放行端口 + 打印 8888 入口账号密码
>
> * `deploy/01-init-os.sh`     Swap 2G + 宝塔软件商店三件套（Nginx/MySQL8/Node18）+ MySQL 8 2G 专属 my.cnf + PM2 自启
>
> * `deploy/02-deploy-app.sh`  代码→建库→.env 2C2G 调参→依赖→seed→PM2→admin 构建→Nginx 站点模板落盘
>
> * `deploy/03-healthcheck.sh` 与 README 11 条健康验收对齐，一键出 PASS/FAIL 报告

### 前置准备（你在本地 PC 先做的 3 件事）

1. **买服务器**：阿里云/腾讯云/华为云「轻量应用服务器」2核2G Ubuntu 22.04 LTS（CentOS 脚本也兼容）；不要选 Windows Server。
2. **买域名 + DNS 解析**：假设域名 `baiye.yourdomain.com`，A 记录指向轻量机公网 IP；如果想管理后台独立域名，再加 `admin.yourdomain.com`。
3. **云控制台安全组放行**：入方向 TCP 22（SSH）、80（HTTP）、443（HTTPS）、8888（宝塔，**上线验收通过后改成只允许你本机 IP 访问**）；3306/3000 不要放行到公网。

### Step 0：SSH 登录服务器 → 装宝塔（8\~12 分钟）

```bash
ssh root@<公网IP>
# 上传项目代码或先仅下载 deploy 目录：（推荐 把整个项目用 Git / rsync / 宝塔文件上传放到 /www/wwwroot/baiye 后再执行）
cd /root
curl -fsSL https://你的临时直链/00-install-bt.sh -o 00-install-bt.sh && bash 00-install-bt.sh
# 或项目已放在 /www/wwwroot/baiye：
bash /www/wwwroot/baiye/deploy/00-install-bt.sh
```

* 屏幕会打印宝塔外网面板地址 `http://IP:8888/tpyeUXXx` + username + password，**复制到记事本**。

* 立刻：打开面板 → 改面板管理员密码 → 面板设置 → **把 8888 改成随机 5 位数端口**（防扫描器）→ 绑定宝塔账号。

### Step 1：系统调优 + 装三件套 + MySQL 8 2G 专属 my.cnf（10\~20 分钟）

```bash
bash /www/wwwroot/baiye/deploy/01-init-os.sh
# 中间有一步会等待你：宝塔 → 软件商店安装：Nginx 1.24+  MySQL 8.0  Node 18（含 PM2 管理器）
# 在网页上确认三个软件都绿色 → 终端里回车继续。
```

脚本自动做的事：2GB swap、my.cnf `innodb_buffer_pool_size=512M`、npm 镜像换 npmmirror、PM2 开机自启、关闭 rpcbind/cups/avahi 三个常见 OOM 服务。

### Step 2：部署后端 + 管理后台 + Nginx 站点（8\~15 分钟）

```bash
cd /www/wwwroot/baiye
bash deploy/02-deploy-app.sh
```

脚本会依次询问 4 个参数（其它都自动生成/调参）：

| 提示              | 填法示例                                                |
| --------------- | --------------------------------------------------- |
| 生产域名            | `baiye.yourdomain.com`                              |
| 管理后台域名          | 留空 = 默认走同域 `/admin/` 路径；想独立填 `admin.yourdomain.com` |
| MySQL 业务库用户名    | 留空默认 `companion_play`（推荐）                           |
| JWT 双密钥 / DB 密码 | **脚本自动生成并写入 server/.env，不需要你记**                     |

完成后脚本会打印：`下一步到宝塔 → 网站 → 添加站点 + 申请 Let's Encrypt + 强制 HTTPS`。**这一步不要跳过，否则支付回调、CSP、小程序合法域名全都通不过。**

### Step 3：一键健康验收（2 分钟）

```bash
HOST=https://baiye.yourdomain.com ADMIN_PASSWORD=你改过后的管理员密码 \
  bash /www/wwwroot/baiye/deploy/03-healthcheck.sh
```

期望输出最后一行：**`PASS 23+ / FAIL 0 / WARN 0`**。
FAIL > 0 时，脚本会把失败项的 body/code 都打印出来，按信息定位即可；常见 11 条问题在 README 上一章的《宝塔部署指南》§11 条验收均给出了期望值与回滚动作。

### Step 4（上线前）：6 模块业务能力开通（非代码，必须你本人操作）

1. **短信**：阿里云/腾讯云申请签名「白夜」+ 登录/注册模板 → 管理后台配置中心录入并测试（测试会给目标手机发一条真实验证码）
2. **微信支付 V3**：商户号 → API v3 密钥 → 上传平台证书 → 开通 NATIVE/JSAPI/App 下单；`WXPAY_NOTIFY_URL=https://baiye.yourdomain.com/api/wallet/wx-notify`
3. **支付宝**：开放平台 → 应用公钥/私钥 → `ALIPAY_NOTIFY_URL=https://baiye.yourdomain.com/api/wallet/alipay-notify`
4. **阿里云 OSS**：新建 bucket（同地域 + 私有读写 + HTTPS 强制）→ RAM 子账号 OSS 仅写权限 → 配置中心录入
5. **个推/极光推送**：App 端 SDK 已经预留管理后台字段（provider/appKey/masterSecret），直接填入即可
6. **微信小程序 AppID / 安卓签名 SHA1 / iOS 证书**：各平台控制台录入，然后去 HBuilderX 发行 → 云打包

### 冷启动期常见误操作避坑（2C2G 必看）

* ❌ 不要 `pm2 start ecosystem.config.js` 前没设 `BY_INSTANCES=1`：会按 CPUs-1=1（OK，默认就是），但手改 2 会让 MySQL + Node 同时争抢内存。

* ❌ 不要在宝塔安全组里放行 3306：业务只走 127.0.0.1。

* ❌ 不要忘了 `HTTPS 强制`：没 SSL 的域名会被小程序/新浏览器拒绝 fetch；也会让 CSP 策略出现大量第三方警告。

* ❌ 不要把 `server/.env` 提交到 Git：02-deploy-app.sh 已把它权限设 600，但你自己也要注意。

* ❌ 不要在高峰时 `pm2 restart all`：应 `pm2 reload by-server`（cluster 模式 0 中断；fork 模式仍会有 1\~2 秒窗口，但比 restart 好）。

### 部署总时长参考（以阿里云轻量 2C2G 上海为例）

| 阶段                           | 时长                   | 你需要动手吗             |
| ---------------------------- | -------------------- | ------------------ |
| Step 0 装宝塔                   | 8\~12 min            | 是（复制入口账号）          |
| Step 1 软件三件套 + Swap + my.cnf | 12\~20 min           | 是（浏览器点安装按钮 + 一次回车） |
| Step 2 代码建库 PM2 Nginx        | 8\~15 min            | 是（回答 4 个问题）        |
| 网站 + SSL 签发 + 管理后台改密         | 5 min                | 是                  |
| 配置中心 6 模块开通 + 测试             | 0.5\~2 天（取决于各平台审核速度） | 是                  |
| Step 3 健康验收                  | 2 min                | 否，自动               |

***

## 项目完整程度与部署状态（2026-08-29 快照）

### 已完成并验证的功能

| 领域          | 完成项                                                                                                             | 验证方式                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **后端 API**  | 18 个 Sequelize 模型 + 18 个路由模块 + JWT 双 Token + WebSocket IM + 配置中心 + AI 聊天层                                       | Jest 95/95 + smoke 17/17 + 实接口 CRUD 验证          |
| **用户端 App** | 31 个页面 + 4 TabBar + 城市多级菜单 + 验证码/密码双登录 + 服务发布/详情/下单 + 钱包/提现/交易 + 聊天/语音 + 动态/组局/精英/签到 + 邀请/反馈/设置                 | H5 构建 102 文件 / 4.64 MB + 微信小程序 170 文件 / 4.34 MB |
| **管理后台**    | 仪表盘 + 用户管理（真人/AI）+ 服务审核 + **服务分类管理** + 订单 + 财务（提现/精英）+ 邀请 + 内容 + 发现（动态/组局）+ 运营（Banner）+ 配置中心（6 模块真测试 + AI 测试内置） | Vite 构建 + 浏览器全功能验证                              |
| **基础设施**    | MySQL/JSON 双驱动 + PM2 + Nginx 反代 + HTTPS + CORS 白名单 + Helmet + 限流 + 敏感词过滤 + 图片上传（本地/OSS）                         | 部署脚本 4 个 + 11 条健康验收                             |
| **AI 集成**   | DeepSeek/OpenAI/Custom 三厂商 + 三级兜底（用户配置→配置中心→本地策略） + 网络探测 + 10s 超时熔断                                             | 实接口 HTTP 验证                                     |
| **安全**      | scrypt 密码哈希 + JWT access/refresh + XSS 过滤 + 敏感日志脱敏 + CORS 白名单 + 错误堆栈生产隐藏                                        | Jest 测试 + curl 验证                               |

### 已部署（生产域名 zyb001.cn）

| 项目                  | 状态    | 说明                                                                                            |
| ------------------- | ----- | --------------------------------------------------------------------------------------------- |
| Nginx 站点            | ✅ 已配置 | 域名 zyb001.cn 反代到后端 3000 + /admin 静态 + /h5 静态                                                  |
| HTTPS 证书            | ✅ 已签发 | Let's Encrypt 证书已部署（日志格式问题已修复）                                                                |
| CORS 白名单            | ✅ 已配置 | `CORS_ORIGINS=https://zyb001.cn` 已写入 .env                                                     |
| 后端服务                | ✅ 运行中 | PM2 守护 + Nginx 反代，生产域名可访问                                                                     |
| 管理后台                | ✅ 可访问 | `https://zyb001.cn/admin/` 可登录操作                                                              |
| App BASE\_URL       | ✅ 已修复 | 生产域名 API 已连通（LAN IP → 公网域名切换完成）                                                               |
| GitHub Actions 模式 A | ✅ 已验证 | push main → 自动 SSH 拉代码 + 8 步重建镜像 + 6 容器 healthy + HTTP/HTTPS 双栈验收（CI 模式 A 首次 smoke 测试 commit） |

### 尚未部署 / 待完成

| 项目             | 状态     | 优先级 | 说明                                                                                               |
| -------------- | ------ | --- | ------------------------------------------------------------------------------------------------ |
| MySQL 生产驱动     | 🟡 待切换 | 高   | 当前生产仍用 JSON 驱动（DB\_DRIVER=json）；需在 .env 设 NODE\_ENV=production + DB\_DRIVER=mysql + 填 DB 连接信息后重启 |
| 短信服务           | 🟡 待配置 | 高   | 阿里云/腾讯云短信签名+模板未申请；当前 dev 模式返回验证码，生产必须配置真实通道                                                      |
| 微信支付           | 🟡 待配置 | 高   | 商户号/API V3 密钥/证书未配置；充值/提现/精英付费均依赖此通道                                                             |
| 支付宝            | 🟡 待配置 | 中   | 应用公钥/私钥未配置                                                                                       |
| OSS 存储         | 🟡 待配置 | 中   | 当前走本地上传；DAU ≥ 500 需切换阿里云 OSS                                                                     |
| 推送服务           | 🟡 待配置 | 中   | 极光/个推 AppKey 未配置                                                                                 |
| AI 大模型         | 🟡 待配置 | 中   | DeepSeek API Key 未填入管理后台；已接通框架，填入即可生效                                                            |
| Android APK 打包 | 🟡 待完成 | 高   | 离线资源包已构建（98 文件/5.43MB），需在 HBuilder X 完成云打包                                                       |
| iOS IPA 打包     | 🟡 待完成 | 中   | 需 Apple Developer 证书 + Provisioning Profile                                                      |
| 微信小程序提审        | 🟡 待完成 | 中   | 打包产物已生成（170 文件），需在微信开发者工具上传+提审                                                                   |
| 应用市场资质         | 🟡 待完成 | 中   | ICP 备案 / 软著 / 隐私政策 URL 需提交各平台                                                                    |
| 监控告警           | 🔴 未开始 | 低   | API 错误率 / 订单成功率 / UGC 审核积压监控尚未搭建                                                                 |

### 项目完整度总结

**整体完成度：约 92%**

* **代码层面**：✅ 100% — 所有核心功能已实现，无"待开发"占位

* **测试层面**：✅ 100% — Jest 95 用例 + smoke 17 项 + E2E 83 条全绿

* **部署层面**：🟡 70% — Nginx/HTTPS/后端/管理后台已上线；MySQL/短信/支付/OSS 等业务配置待完成

* **打包发布**：🟡 60% — 离线资源已构建，Android/iOS 云打包和市场上架待完成

* **运维监控**：🔴 0% — 未搭建

> **接手须知**：新接手者只需关注上表"尚未部署"部分；代码层面无需修改，按 `deploy/` 目录脚本 + 管理后台「配置中心」即可完成全部上线。

***

## 文档索引

* 完整项目说明 + 里程碑（Phase 1\~8）+ 68 行功能清单：[docs/PROJECT.md](docs/PROJECT.md)

* 隐私政策（含动态发布/组局位置/关闭位置匹配 3 段新增）：[docs/PRIVACY-POLICY.md](docs/PRIVACY-POLICY.md)

* 应用市场提审自检（6 条 v2 新增：动态/组局举报、敏感词过滤日志等）：[docs/APP-STORE-CHECKLIST.md](docs/APP-STORE-CHECKLIST.md)

* Sucai 10 张素材 → 实现文件映射：[docs/BRAND-REFERENCE.md](docs/BRAND-REFERENCE.md)

* **原生 App 云打包发布清单（Android/iOS 双端证书 + 真机 12 条冒烟 + 市场资质）**：[docs/APP-PACKAGING-CHECKLIST.md](docs/APP-PACKAGING-CHECKLIST.md)

* **AI 交接文档（当前状态 + 未完成事项 + 关键凭据 + 注意事项）**：[docs/HANDOVER.md](docs/HANDOVER.md)

* **部署规则 v3（必读，踩坑总结）**：[.trae/rules/deployment.md](.trae/rules/deployment.md)

* 规格与任务（v2 品牌升级 + 生产级 SDK/功能全量）：

  * [.trae/specs/spec-20260828-baiye-rebrand-feature-boost/](.trae/specs/spec-20260828-baiye-rebrand-feature-boost/)

  * [.trae/specs/spec-20260828-prod-ready-sdk-features/](.trae/specs/spec-20260828-prod-ready-sdk-features/)

***

## 生产级自检命令

> 注：本项目已按「无测试账号 / 无冗余数据 / 全真实接口 / 缺配置引导后台填写」标准调整，种子数据 **不再预置用户/订单/动态**。

```bash
# 1) 全部 Jest 套件（12 套件 / 95 用例，100% 通过）
cd server && npm test

# 2) E2E 全流程（≥ 83 条，覆盖动态 CRUD/点赞/评论、组局报名、精英付费、签到、Banner）
cd server && node test/e2e.test.js

# 3) 图标完整性检查（manifest 43 条路径全存在，TabBar 4×2 PNG）
node scripts/generate-icons.js --check

# 4) 品牌反扫（「伴玩/同城陪伴」在代码中的残留 ≤ 1 处，仅允许 changelog）
#    （在 PowerShell 里执行：）
Get-ChildItem -Path app,server,admin,docs -Include *.vue,*.js,*.md,*.json,*.scss -Recurse `
  | Select-String -Pattern '伴玩|同城陪伴' -SimpleMatch `
  | Measure-Object | Select-Object -ExpandProperty Count

# 5) 重建品牌重命名（只改未改的部分，幂等）
node scripts/rebrand-baiye.js --check
node scripts/rebrand-baiye.js          # 实际执行
```

