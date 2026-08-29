# 白夜 App — 项目说明

> 白夜 + 线上付费陪玩陪聊平台。用户可发布/购买陪伴服务（陪玩、陪聊、唱歌、哄睡、叫醒、虚拟恋人等），平台通过精英认证锁定付费用户，并内置股东邀请裂变体系。

---

## 一、技术栈

### 移动端 App（`/app`）
- **框架**：uniapp（Vue 3 + Vite）— 一套代码多端打包（iOS / Android / H5 / 微信小程序）
- **状态管理**：Pinia
- **请求层**：uni.request 封装 + 拦截器（token 注入、错误统一处理）
- **UI**：自研组件 + uni.scss 设计 token（与原型 `colors_and_type.css` 对齐）
- **图标**：uni-icons + 自定义字体图标
- **构建**：HBuilderX / Vite CLI

### 后端 API（`/server`）
- **运行时**：Node.js 18+
- **框架**：Express 4
- **存储层**：Sequelize 6 + MySQL 8.0（主存储）+ JSON 文件存储层（`server/data/*.json`，开发/测试回退，仿 Sequelize API）
- **鉴权**：JWT（双 token：access 7d + refresh 30d）+ scrypt 密码哈希
- **存储**：本地 / 阿里云 OSS（头像、服务图片）— multer 已就绪 + ali-oss SDK 已安装
- **支付**：真实双通道（微信支付 V3 + 支付宝官方 SDK），回调 + 幂等入账 + 提现审核制（SDK 已安装：axios + alipay-sdk）
- **推送**：极光(jpush) / 个推(getui) 双模式 + Socket.IO 在线优先（叫醒/订单状态/IM离线；axios HTTP 调用）
- **短信**：阿里云 / 腾讯云 双模式 + 频控 + 管理后台配置中心热刷新（SDK 已安装：@alicloud/* + tencentcloud-sdk-nodejs-sms）
- **实时通讯**：Socket.IO（IM 聊天 / 已读回执 / 输入中提示）
- **AI 聊天**：DeepSeek / OpenAI / Custom 三厂商兼容，三级兜底（用户 aiConfig → 配置中心备用 → 本地策略回复），10s 超时熔断
- **服务分类**：ServiceCategory 模型支持二级树形分类，管理后台 CRUD + 上下架 + 排序，用户端动态读取

### 管理后台（`/admin`）
- **框架**：Vue 3 + Vite
- **UI 库**：Element Plus
- **状态**：Pinia
- **图表**：ECharts
- **路由**：Vue Router 4
- **请求**：Axios 封装

### 设计规范
- **主色**：午夜蓝 `#0b0f1a`（夜间底）、次底 `#141a2d`、卡片 `#1a2238`
- **强调色**：金 `#d4af37` / 软金 `#f5d583`（按钮渐变、徽章、E 标）
- **极光渐变**：紫 `#7b61ff → #b57bff → #ff9fc5`（Banner / 组局封面 / CTA）
- **语义色**：success `#22c55e` / warning `#f59e0b` / info `#3b82f6` / error `#ef4444`（低饱和不抢主题）
- **圆角**：小 8 / 中 16 / 大 24 / 药丸 999（rpx）
- **阴影**：暗色系阴影 `0 4rpx 32rpx rgba(0,0,0,.4)`；金卡 `0 10rpx 30rpx rgba(212,175,55,.35)`
- **字体**：Inter + PingFang SC；标题 40-48rpx 粗；正文 28-30rpx；辅助 22-24rpx `$by-text-muted`
- **视觉参考素材**：`sucai/` 图 1-10（映射表见 `docs/BRAND-REFERENCE.md`）
- **token 前缀**：uni.scss 全局统一为 `$by-*`（baiye 缩写），避免 `$companion-*` 残留

---

## 二、项目结构

```
companion-play-app/
├── app/                        # uniapp 移动端
│   ├── src/
│   │   ├── pages/              # 页面
│   │   │   ├── login/         # 登录（验证码）
│   │   │   ├── home/          # 首页推荐流
│   │   │   ├── warm/          # 暖心服务
│   │   │   ├── game/          # 游戏陪玩
│   │   │   ├── offline/       # 线下兴趣约玩
│   │   │   ├── elite/         # 精英认证（含真人照片上传）
│   │   │   ├── profile/       # 个人中心
│   │   │   ├── profile-edit/  # 编辑资料（头像上传 + 昵称/性别/城市/简介）
│   │   │   ├── provider/      # 服务者主页（资料 + 统计 + 在线服务 + 私信/收藏）
│   │   │   ├── invite/        # 邀请股东
│   │   │   ├── settings/      # 设置
│   │   │   ├── feedback/      # 意见反馈
│   │   │   ├── service-detail/  # 服务详情 + 下单（含服务者跳转）
│   │   │   ├── service-publish/ # 服务发布
│   │   │   ├── order-list/    # 订单列表（买家/卖家双视角）
│   │   │   ├── order-detail/  # 订单详情（含评价入口）
│   │   │   ├── review/        # 订单评价（星级 + 评论 + 匿名）
│   │   │   ├── my-services/   # 我的服务（服务者上下架管理）
│   │   │   ├── chat-list/     # 聊天会话列表
│   │   │   ├── chat/          # 聊天（WebSocket）
│   │   │   ├── recharge/      # 钻石充值
│   │   │   ├── exchange/      # 钻石兑换星币
│   │   │   ├── withdraw/      # 收入提现（微信/支付宝）
│   │   │   └── transactions/  # 交易记录（类型筛选 + 分页）
│   │   ├── components/         # 公共组件（服务卡片、底部导航、弹窗等）
│   │   ├── store/              # Pinia 状态（user/wallet/order）
│   │   ├── api/                # 接口封装
│   │   ├── utils/              # 工具（request/auth/format/upload）
│   │   ├── static/             # 静态资源
│   │   ├── App.vue
│   │   ├── main.js
│   │   ├── pages.json          # 路由 + tabBar 配置
│   │   ├── manifest.json       # 应用配置
│   │   └── uni.scss            # 设计 token
│   └── package.json
├── server/                     # 后端 API
│   ├── src/
│   │   ├── config/             # 环境配置
│   │   ├── store/              # JSON 文件存储层（仿 Sequelize API）
│   │   ├── models/             # 18 个模型（User/Service/ServiceCategory/Order/Wallet/Invite/Message/Transaction/Admin/Feedback/Review/Post/Comment/Group/GroupJoin/Banner/EliteOrder/SignIn/Config）
│   │   ├── routes/             # 18 个路由（auth/user/services/orders/wallet/invite/feedback/settings/admin/chat/upload/config/posts/groups/banners/elite/push/regions/location）
│   │   ├── middleware/         # 鉴权 / 错误处理 / 上传
│   │   ├── utils/              # 工具（response 等）
│   │   ├── app.js              # 入口（Express + Socket.IO）
│   │   └── seed.js             # 种子数据初始化（npm run seed）
│   ├── data/                   # JSON 数据存储（自动生成）
│   ├── uploads/                # 上传文件存储（自动生成）
│   ├── .env.example
│   └── package.json
├── admin/                      # 管理后台
│   ├── src/
│   │   ├── views/              # 页面（dashboard/users/services(含 Categories)/orders/finance/invite/content/login/settings/discover/operations/auth）
│   │   ├── components/         # 布局 / 表格 / 表单
│   │   ├── store/              # 状态
│   │   ├── api/                # 接口（axios 封装）
│   │   └── router/             # 路由
│   └── package.json
├── docs/                       # 文档
│   └── PROJECT.md
├── pages/                      # 原型 HTML（参考用）
├── assets/                     # 原型资源
└── README.md
```

---

## 三、核心功能清单与进度

| # | 功能模块 | App | API | Admin | 状态 |
|---|---------|-----|-----|-------|------|
| 1 | 登录注册（短信验证码） | ✅ | ✅ | — | 功能完成 |
| 2 | 首页推荐流 | ✅ | ✅ | — | 功能完成 |
| 3 | 暖心服务（虚拟恋人/唱歌/哄睡/叫醒） | ✅ | ✅ | ✅ | 功能完成 |
| 4 | 游戏陪玩（王者/和平/LOL/其他） | ✅ | ✅ | ✅ | 功能完成 |
| 5 | 线下兴趣约玩 | ✅ | ✅ | ✅ | 功能完成 |
| 6 | 精英认证体系（含真人照片上传） | ✅ | ✅ | ✅ | 功能完成 |
| 7 | 个人中心 + 资料编辑（头像上传） | ✅ | ✅ | — | 功能完成 |
| 8 | 钱包（钻石/星币/充值/兑换/提现/交易记录） | ✅ | ✅ | ✅ | 功能完成 |
| 9 | 邀请股东裂变（10% 分红） | ✅ | ✅ | ✅ | 功能完成 |
| 10 | 意见反馈 + 客服（含处理弹窗 + 奖励） | ✅ | ✅ | ✅ | 功能完成 |
| 11 | 设置与注销 | ✅ | ✅ | — | 功能完成 |
| 12 | IM 聊天（WebSocket） | ✅ | ✅ | — | 功能完成 |
| 13 | 服务详情 + 下单流程 | ✅ | ✅ | — | 功能完成 |
| 14 | 服务发布 | ✅ | ✅ | ✅ | 功能完成 |
| 15 | 订单管理（买家/卖家双视角） | ✅ | ✅ | ✅ | 功能完成 |
| 16 | 后台仪表盘 | — | — | ✅ | 功能完成 |
| 17 | 用户管理 | — | — | ✅ | 功能完成 |
| 18 | 服务审核 | — | — | ✅ | 功能完成 |
| 19 | 财务管理（含提现审核 Tab） | — | — | ✅ | 功能完成 |
| 20 | 邀请管理 | — | — | ✅ | 功能完成 |
| 21 | 内容（反馈）管理（含处理弹窗 + 奖励钻石） | — | — | ✅ | 功能完成 |
| 22 | 支付集成（微信/支付宝真实通道 + 回调 + 提现审核） | ✅ | ✅ | ✅ | 功能完成 |
| 23 | 推送（叫醒/订单状态/IM离线） | ✅ | ✅ | ✅ | 功能完成 |
| 24 | 评价系统（订单评分 + 评论 + 图片 + 匿名） | ✅ | ✅ | — | 功能完成 |
| 25 | 我的服务（上下架 + 更新） | ✅ | ✅ | — | 功能完成 |
| 26 | 收入提现（微信/支付宝）+ 后台审核（通过/拒绝/打款/拒绝退款） | ✅ | ✅ | ✅ | 功能完成 |
| 27 | 交易记录（类型筛选 + 分页） | ✅ | ✅ | — | 功能完成 |
| 28 | 服务评价列表展示（评分汇总 + 分布 + 分页） | ✅ | ✅ | — | 功能完成 |
| 29 | 图片上传（反馈/封面/评价图/头像/认证照） | ✅ | ✅ | — | 功能完成 |
| 30 | 语音消息（录制 + 上传 + 播放） | ✅ | ✅ | — | 功能完成 |
| 31 | 配置中心（短信/支付/OSS/推送/应用密钥可视化管理） | — | — | ✅ | 功能完成 |
| 32 | 短信验证码（dev/aliyun/tencent 三模式 + 频控） | ✅ | ✅ | — | 功能完成 |
| 33 | OSS 存储（local/aliyun 两模式切换） | ✅ | ✅ | — | 功能完成 |
| 34 | 资料编辑（头像专用上传接口 + 昵称/性别/城市/简介） | ✅ | ✅ | — | 功能完成 |
| 35 | 服务者主页（公开访问：资料 + 统计 + 在线服务 + 私信/收藏） | ✅ | ✅ | — | 功能完成 |
| 36 | 头像上传（专用接口自动写回 user.avatar） | ✅ | ✅ | — | 功能完成 |
| 37 | 首页推荐流对接真实接口（分类筛选 + 服务卡片） | ✅ | ✅ | — | 功能完成 |
| 38 | 客服联系（配置中心读取客服微信号 + 复制 + 引导反馈） | ✅ | ✅ | — | 功能完成 |
| 39 | 设置页功能完善（认证状态 + 换绑手机 + 免打扰 + 注销） | ✅ | ✅ | — | 功能完成 |
| 40 | 邀请分享（H5 复制链接 + 小程序/App 微信分享） | ✅ | ✅ | — | 功能完成 |
| 41 | 邀请月度奖励（从 Transaction 真实计算） | — | ✅ | — | 功能完成 |
| 42 | 品牌统一为「白夜」：名称 / 图标 / 主题 / manifest / 启动图 | ✅ | — | ✅ | 功能完成（v2 新增）|
| 43 | 设计主题切换：午夜蓝 + 金色 + 紫极光渐变（`$by-*` token 体系） | ✅ | — | ✅ | 功能完成（v2 新增）|
| 44 | TabBar 扩展为 4 项：首页 / 发现 / 消息 / 我的，配套 4×2 PNG 图标 | ✅ | — | — | 功能完成（v2 新增）|
| 45 | 首页改版：Banner 轮播 + 快捷入口 + 新人秀横滚 + 精英 CTA 金卡 | ✅ | ✅ | — | 功能完成（v2 新增）|
| 46 | 发现页 4 Tab：寻人大厅 / 动态广场 / 同城组局 / 红包签到专区 | ✅ | ✅ | — | 功能完成（v2 新增）|
| 47 | 动态广场：发布 / 列表 / 点赞 / 评论 / 敏感词过滤 / 审核流转 | ✅ | ✅ | ✅ | 功能完成（v2 新增）|
| 48 | 发布动态页：500 字文本 + 9 图上传 + 城市标签 + 登录守卫 | ✅ | ✅ | — | 功能完成（v2 新增）|
| 49 | 同城组局：8 个模板 + 列表 + 极光封面详情 + 报名进度条 + 头像墙 | ✅ | ✅ | ✅ | 功能完成（v2 新增）|
| 50 | 组局报名 / 取消报名：精英守卫 + 人数更新 + 发起人通知 | ✅ | ✅ | — | 功能完成（v2 新增）|
| 51 | 白夜精英会员：¥30 终身 / 6 权益 / 3 保证 / 微信解锁 99 💎 / 金 E 标 | ✅ | ✅ | ✅ | 功能完成（v2 新增）|
| 52 | 精英付费流程：下单接口 + dev 直开 + 7 天无理由退款条款 + isElite 持久化 | ✅ | ✅ | ✅ | 功能完成（v2 新增）|
| 53 | 红包签到专区：每日领取 💎 + 本地/服务端双重去重 + 余额回写 | ✅ | ✅ | — | 功能完成（v2 新增）|
| 54 | 举报通道闭环：意见反馈 3 类举报 Tab（动态 / 组局 / 用户）+ 对应 ID 字段 | ✅ | ✅ | ✅ | 功能完成（v2 新增）|
| 55 | 敏感词过滤中间件：30+ 正则 + 「白夜」白名单 + 动态/评论/组局/反馈挂载 | — | ✅ | — | 功能完成（v2 新增）|
| 56 | 聊天守卫：非精英首次主动私聊精英弹「开通精英后畅聊」Modal | ✅ | — | — | 功能完成（v2 新增）|
| 57 | 设置页通知开关：动态通知 / 组局通知 → 持久化至 `meta.notification` | ✅ | ✅ | — | 功能完成（v2 新增）|
| 58 | Banner 运营位：2 张默认（净化网络 / 组局新玩法）+ 后台 CRUD + 权重排序 | ✅ | ✅ | ✅ | 功能完成（v2 新增）|
| 59 | 管理后台 4 新 Tab：动态审核 / 组局管理 / Banner 管理 / 精英订单 | — | ✅ | ✅ | 功能完成（v2 新增）|
| 60 | 仪表盘 4 新增指标：动态数 / 组局数 / 精英付费人数 / 精英累计收入（金色渐变） | — | ✅ | ✅ | 功能完成（v2 新增）|
| 61 | JSON 存储层扩展：Collection 静态 update/destroy 批量能力 | — | ✅ | — | 功能完成（v2 新增）|
| 62 | 密码登录：验证码/密码双 Tab + 注册后引导设置密码 + 管理员改密后直接可登录（无需验证码） | ✅ | ✅ | ✅ | 功能完成（v2.1 新增）|
| 63 | AI 用户聊天接入 DeepSeek：User 模型 userType/aiProvider/aiConfig + chat.js 三级兜底（用户配置→配置中心→本地策略）+ 10s 超时熔断 | ✅ | ✅ | ✅ | 功能完成（v2.1 新增）|
| 64 | 服务分类管理：ServiceCategory 模型 + 二级树形 CRUD + 上下架 + 排序 + 用户端动态读取 + seed 默认 14 条 | ✅ | ✅ | ✅ | 功能完成（v2.1 新增）|
| 65 | 配置中心真连通性测试：6 模块真实网络探测（短信/微信/支付宝/OSS/推送/AI），空配置/乱填均返回明确失败 | — | ✅ | ✅ | 功能完成（v2.1 新增）|
| 66 | 城市选择多级菜单：按省选择 Tab（展开省份→点击城市）+ 按字母查找 Tab（A-Z 索引）+ TDZ/IIFE 修复 | ✅ | ✅ | — | 功能完成（v2.1 新增）|
| 67 | JWT 自动续期：refreshToken 无感续期 + 统一 token key 'companion_token' + 401 自动刷新重试 | ✅ | ✅ | — | 功能完成（v2.1 新增）|
| 68 | 管理后台错误修复：certifications where.$or→where[Op.or] + 用户列表 userType 过滤 + hasPassword 字段 + Users.vue openEdit 修复 | — | ✅ | ✅ | 功能完成（v2.1 新增）|

**图例**：✅ 功能完成 / 🚧 待开发 / — 不适用

---

## 四、业务逻辑要点

### 付费体系
- **星币**：服务消费币（虚拟恋人 99 星币/20分钟、唱歌 6~10 星币/首、游戏 10 星币/局）
- **钻石**：充值获得 + 反馈奖励，可兑换星币
- 充值入口：个人中心 → 钻石余额 → 充值

### 精英认证门槛
- 线下兴趣约玩入口 → 强制弹窗（立即加入 / 再逛逛）
- 解锁：线下约玩、高阶服务、优先匹配

### 邀请股东裂变
- 邀请男性好友 → 获其消费 10% 现金分红
- 邀请女性好友 → 获其收入 10% 现金分红
- 模块：邀请规则 / 我的邀请成绩 / 奖励排行榜 / 立即邀请

### 订单状态机
```
待支付 → 已支付 → 服务中 → 已完成 → 已评价
                 ↘ 已取消
                 ↘ 退款中 → 已退款
```
> 评价由买家在订单完成后发起，提交后服务 `ratingAvg` 自动按所有评价重新计算并更新。

---

## 五、本地开发

### 环境要求
- Node.js 18+
- HBuilderX（uniapp 打包，可选）

> 后端支持 MySQL/JSON 双驱动：开发默认 DB_DRIVER=json（零依赖），生产强制 MySQL。详见 `server/.env.example`。

### 启动后端
```bash
cd server
npm install
npm run seed          # 初始化种子数据（幂等，首次必跑）
npm run dev           # http://localhost:3000
```

种子数据初始化后：
- 管理员账号：`admin` / `admin123`（仅初始化管理员与配置中心空模板，**生产级默认不预置任何测试用户 / 服务 / 订单**）
- 真实用户需要用户端自行注册（短信验证码），或在管理后台「用户管理」手动创建。

### 启动管理后台
```bash
cd admin
npm install
npm run dev           # http://localhost:5174 （自动代理 /api 到 3000）
```

### 启动移动端
```bash
cd app
npm install
npm run dev:h5        # http://localhost:5173 （自动代理 /api 到 3000）
# 或 HBuilderX 打开 app 目录运行到浏览器/模拟器/真机
```

> 移动端登录：点击「发送验证码」。
>   - **生产环境**：必须在管理后台「配置中心 → 短信」填写阿里云/腾讯云参数，真实短信网关下发（未配置会提示配置）。
>   - **开发环境（NODE_ENV !== production）**：未配置真实短信时接口仍会返回明确错误，请在管理后台配置后再测试，或在 Jest 单测（NODE_ENV=test）使用内存验证码。

---

## 六、路线图

### Phase 1 — 骨架搭建 ✅ 已完成
- [x] 项目结构 + 文档（PROJECT.md / README.md）
- [x] uniapp 移动端：10 个页面 + 设计 token + 状态管理 + API 封装
  - 登录（验证码）/ 首页推荐流 / 暖心服务 / 游戏陪玩 / 线下约玩
  - 精英认证 / 个人中心 / 邀请股东 / 设置 / 意见反馈
- [x] 后端 API：9 个路由模块 + 6 个数据模型 + JWT 鉴权 + 错误处理
  - auth / user / services / orders / wallet / invite / feedback / settings / admin
- [x] 管理后台：7 个管理页面 + 布局组件 + 路由守卫 + API 封装
  - 仪表盘 / 用户管理 / 服务审核 / 订单管理 / 财务管理 / 邀请管理 / 内容管理

### Phase 2 — 核心业务打通 ✅ 已完成
- [x] 后端 JSON 文件存储层（替代 MySQL/Redis，零外部依赖）
- [x] 种子数据脚本（npm run seed，幂等）
- [x] 管理后台对接真实接口（登录、财务、邀请）
- [x] IM 聊天 WebSocket（实时消息、会话列表、已读回执、HTTP 回退）
- [x] 服务详情 + 下单流程（数量、备注、支付、订单跳转）
- [x] 服务发布（分类、子分类、标签、价格单位）
- [x] 订单管理（买家/卖家双视角、状态筛选、支付/开始/完成/取消）
- [x] 钻石兑换星币（快捷金额、余额校验）
- [x] 充值套餐（6 档、微信/支付宝选择）
- [x] 三端打通：uniapp ↔ Node.js API ↔ Vue 3 Admin

### Phase 2.5 — 交易与评价闭环 ✅ 已完成
- [x] 评价系统（订单完成后星级评分 + 评价内容 + 评价图片 + 匿名评价，自动更新服务 ratingAvg）
- [x] 我的服务（服务者管理：状态筛选、上下架、查看详情、跳转发布）
- [x] 收入提现（余额展示、全部提现、微信/支付宝到账方式、T+1 说明）
- [x] 交易记录（7 类流水筛选：充值/兑换/消费/收入/提现/退款/奖励、下拉刷新、上拉分页）
- [x] 邀请页对接真实接口（统计、排行榜、邀请码复制）
- [x] 订单详情新增评价入口（已评价显示"查看评价"，未评价显示"写评价"）

### Phase 2.6 — 上传与评价展示 ✅ 已完成
- [x] 图片上传工具（`utils/upload.js`，基于 uni.uploadFile，token 自动注入）
- [x] 服务详情评价列表展示（评分汇总、星级分布、分页加载、图片预览）
- [x] 服务发布封面图上传（选图、上传、预览、更换/删除）
- [x] 反馈页对接真实接口（问题类型、图片批量上传、提交反馈）
- [x] 评价页支持图片上传（最多 6 张，与评价列表展示闭环）

### Phase 3 — 生产化基础设施 ✅ 已完成
- [x] 配置中心（`models/Config.js` + `utils/config.js`，DB 覆盖 env 默认值，1 分钟内存缓存热更，支持按模块重置）
- [x] 配置管理接口（`routes/admin.js`：模块元信息 / 读取 / 更新 / 重置 / 测试连通性；`routes/config.js` 保留兼容别名为 deprecated）
- [x] 管理后台配置中心页面（`views/settings/Settings.vue` + `store/config.js`，6 模块表单：应用/短信/微信支付/支付宝/OSS/推送；模块卡片 + 颜色编码 + 必填彩色条 + 状态标签 + 高对比度表单）
- [x] 短信验证码抽象层（`utils/sms.js`，aliyun/tencent 双模式，60s 重发限制 + 5 分钟有效 + 5 次尝试上限；Jest 单测走内存验证码；未配置明确报错引导管理后台配置）
- [x] 微信支付抽象层（`utils/wxpay.js`，统一下单 / 回调验签 / 退款，SDK 已安装 axios，**不再有 dev 自动充值直达钱包回退**）
- [x] 支付宝抽象层（`utils/alipay.js`，下单 / 异步通知验签 / 退款，SDK 已安装 alipay-sdk，**不再有 dev 回退**）
- [x] OSS 存储抽象层（`utils/oss.js`，local/aliyun 两模式，SDK 已安装 ali-oss，未配置即报错）
- [x] 充值流程生产化（真实支付下单 + 待支付订单 + 回调幂等入账；未配置支付通道 → 接口返回明确业务错误，引导在管理后台「配置中心」填写）
- [x] 提现流程生产化（扣减 income + 创建待审核 Transaction，后台审核后打款；最低提现额 + 手续费配置化）
- [x] 短信频控（express-rate-limit：IP 每分钟 1 次、每小时 10 次；Jest 单测环境自动放宽）
- [x] .env.example 补全所有可选配置项（敏感配置推荐在管理后台「配置中心」管理，本 env 只作占位）
- [x] 外部 SDK 全部生产安装到 server/package.json（阿里云短信 + 腾讯云短信 + ali-oss + alipay-sdk + axios）；**取消 dev 回退**，未配置时接口明确报错引导管理后台配置中心填写

### Phase 2.7 — 业务闭环补齐 ✅ 已完成
- [x] 头像专用上传接口（`POST /user/avatar`，multer + OSS 自动写回 `user.avatar`，失败回退本地）
- [x] 资料编辑页（`pages/profile-edit`，头像上传 + 昵称/性别/城市/简介 + 认证状态展示 + 保存同步本地用户）
- [x] 服务者主页接口（`GET /user/provider/:id` 公开访问：资料 + 在线服务 + 订单数/评分/评价数统计）
- [x] 服务者主页页（`pages/provider`，毛玻璃封面 + 数据统计卡 + 在线服务列表 + 私信/收藏/立即下单）
- [x] 服务详情页接入服务者主页跳转（点击头像/资料跳转，💬 按钮独立触发聊天）
- [x] 精英认证照片真实上传（`POST /user/elite/apply` 改为 multipart 接收 photo 文件 + 表单字段）
- [x] 个人中心新增"编辑资料"入口（user-card 整体可点击 + 模块网格首项）
- [x] 上传工具扩展 `uploadFileTo(path, filePath, name, formData)` 支持自定义端点（头像/认证照等专用接口）
- [x] 后台提现审核接口（`GET /admin/withdrawals` 列表 + `PUT /admin/withdrawals/:id` 通过/拒绝/标记打款 + 拒绝自动退款）
- [x] 后台财务管理新增提现审核 Tab（状态筛选 / 待审核红点角标 / 通过二次确认 / 拒绝填理由 / 标记打款备注）
- [x] 后台内容管理反馈处理弹窗（状态切换 + 回复内容 + 奖励钻石发放 + 历史回复展示）
- [x] Transaction 模型新增 `extra` 字段（JSON 类型，存储提现审核状态/审核备注/打款时间/操作人等扩展信息）

### Phase 2.8 — 骨架功能补齐 ✅ 已完成
- [x] 首页推荐流对接真实接口（`home.vue` 改为 `serviceApi.list` + 分类筛选 + 服务卡片点击跳详情）
- [x] 邀请股东裂变完善（`inviteApi` 补 `bind` 接口 + 月度奖励从 Transaction 真实计算 + H5 复制链接 + 小程序/App 微信分享）
- [x] 设置页功能完善（认证状态展示 + 换绑手机号 + 短信免打扰 + 账号注销软删除 + 未完成订单校验）
- [x] 客服联系功能（`GET /user/kefu` 公开接口从配置中心读取客服微信号 + 复制 + 引导反馈）
- [x] 后端 settings 路由全部对接真实业务（`auth` 鉴权 + 换绑手机号 + 免打扰持久化 + 注销校验）
- [x] User 模型新增 `meta` 字段（JSON 类型，存储短信免打扰、注销申请时间等扩展信息）
- [x] 订单详情「联系客服」按钮对接客服接口（退款中状态）

### Phase 4 — 推送与语音消息 ✅ 已完成
- [x] 推送抽象层（`utils/push.js`，jpush/getui 双模式；生产未配置即明确报错；Jest 单测走 test-memory 占位；axios 已安装）
- [x] 推送路由（`routes/push.js`：测试连通性 / 叫醒服务 / 广播通知）
- [x] 订单状态推送（支付/开始/完成/取消 → Socket.IO 在线 + 离线推送通知对方）
- [x] IM 离线推送（聊天消息发送时，接收方不在线自动推送通知）
- [x] Socket.IO emitToUser 导出（供路由层调用在线推送）
- [x] 语音消息录制（`chat.vue` 使用 `uni.getRecorderManager`，MP3 格式，最长 60 秒）
- [x] 语音消息上传（`uploadFile` 复用图片上传通道，multer 已支持 audio/* MIME）
- [x] 语音消息发送（WebSocket 优先 + HTTP 回退，type=voice + content=url + duration）
- [x] 语音消息播放（`uni.createInnerAudioContext`，支持播放/暂停/切换）
- [x] 语音录制 UI（按住说话 + 录制中提示 + 松开发送 + 手指移出取消）

### Phase 5 — 生产化基础设施 ✅ 已完成
- [x] 单元测试 + 接口测试（Jest + supertest，**12 套件 95 用例全通过**；覆盖短信限流豁免、精英 dev 开通仅 Jest、推送 test-memory 占位）
- [x] 安全加固（XSS 输入过滤 + 敏感日志脱敏 + app.js require 时不启动 server；测试环境自动放宽 SMS 限流）
- [x] 压测脚本（`npm run bench`，零依赖 Node 内置实现，QPS/P50/P95/P99 报告）
- [x] CI/CD 流水线（GitHub Actions：后端测试 + 管理后台构建 + 移动端构建）
- [x] 应用市场提审清单（`docs/APP-STORE-CHECKLIST.md` v2，6 条 v2 新增：动态/组局举报、敏感词过滤日志等）
- [x] 隐私政策文档（`docs/PRIVACY-POLICY.md` v2，新增动态发布、组局位置、可关闭位置匹配 3 段）
- [x] 健康检查接口（`GET /health` + `GET /api/health` 双路径）

### Phase 6 — 白夜品牌升级 v2（sucai 素材落地 + 动态 / 组局 / 精英 / 举报）✅ 已完成
- [x] 品牌重命名：「伴玩」→「白夜」全量替换（脚本 `scripts/rebrand-baiye.js` 幂等 + 反扫校验）
- [x] 设计主题体系：午夜蓝 `#0b0f1a` + 金 `#d4af37` + 紫极光渐变，`app/src/uni.scss` 全局 `$by-*` token 统一
- [x] 白夜主题图标：`scripts/generate-icons.js` 生成 App 图标 / 启动图 / TabBar 4×2 PNG（共 43 个路径全量校验）
- [x] TabBar 4 项：首页 / 发现 / 消息 / 我的 + 配套页面路由注册（`app/src/pages.json`）
- [x] 后端 6 新模型（Post / Comment / Group / GroupJoin / Banner / EliteOrder / SignIn）+ JSON Store 批量 update/destroy 能力
- [x] 后端 4 新路由（posts.js / groups.js / banners.js / elite.js）+ 敏感词工具 + 中间件（30+ 正则 + 白名单）
- [x] 种子数据生产化：**仅初始化管理员 + 配置中心空模板**（不再预置任何测试用户 / 服务 / 订单 / 动态 / 组局；符合「无冗余测试数据」要求）
- [x] 红包签到闭环（`wallet/sign-in` 幂等 + 连续签到天数 + 奖励钻石写入钱包 + 交易流水；前端 `discover.vue` Tab 4 接入）
- [x] 精英 dev 快捷开通（仅 Jest/test 环境兼容 `channel=dev` 自动开通；production 一律禁用；已精英回包含 alreadyElite 字段）
- [x] 举报通道 3 类关联字段（Feedback 模型：refType + postId + groupId + targetUserId；反馈路由作存在性校验；管理后台反馈筛选下拉 + 目标 ID 列）
- [x] 管理后台 4 新 Tab API 封装（postsApi / groupsApi / bannersApi / eliteOrdersApi）与列表接口（GET /admin/posts、/admin/groups、/admin/banners/*）
- [x] 去重重复接口：routes/banners.js 提供 `/admin/banners/*` 别名（routes/admin.js 不再重复写 Banner 写接口）；routes/config.js 标记 deprecated 兼容保留
- [x] 前端首页改版：Banner 轮播 + 快捷入口 + 新人秀横滚 + 精英 CTA（`app/src/pages/home/home.vue`）
- [x] 发现页 4 Tab：寻人大厅 / 动态广场 / 同城组局 / 红包签到（`app/src/pages/discover/discover.vue`）
- [x] 子页闭环：发布动态 / 组局详情 / 精英付费 + 微信解锁 + 首次私聊精英守卫弹窗
- [x] 个人中心收尾：精英入口按 isElite 切换 / 金 E 标 / 极光渐变毛玻璃头图 / 钱包三列
- [x] 设置页 / 反馈页 / 聊天页：动态+组局通知开关持久化 / 3 类举报 Tab+ID 字段 / 守卫 Modal
- [x] 管理后台扩展：动态审核 Tab / 组局管理 Tab / Banner 管理 Tab / 精英订单 Tab + 仪表盘 4 新指标（金色渐变）
- [x] 文档交付 v2：README 功能全景、PROJECT 61 行功能清单、PRIVACY-POLICY v2、APP-STORE-CHECKLIST v2、**新增 BRAND-REFERENCE（10 张 sucai 映射）**
- [x] 测试扩展：Jest 8 → **12 套件 95 用例全通过**；E2E 71 → 83 条；SDK 覆盖率 100%（短信/支付/OSS/推送全部真实 SDK 安装完毕，不再 dev 回退）
- [x] 管理后台 Layout 菜单项完整（仪表盘/用户/服务/订单/财务/邀请/内容/发现/运营/配置中心，含 4 新 Tab 子项）

### Phase 7 — 企业级城市覆盖 · 定位流水线 · 搜索同义词 · 全页兜底 ✅ 已完成
- [x] **全国行政区划数据集（民政 2024 版）**：`server/src/data/china_cities.js` 构建 **34 省级行政区 + 382 地级及以上城市** 全量覆盖；支持中文/拼音/首字母/别名 4 维搜索；对外路由 `GET /api/regions/tree`（省→市两级树，附 provinceCount/cityCount/tookMs meta）、`GET /api/regions/search`（Top-N 关键字匹配）、`GET /api/regions/meta`（版本/总量元信息）；管理后台配置中心新增「应用 → 地理服务(geoProvider / geoKey)」2 项必填字段
- [x] **定位服务 4 级降级流水线（前后端协同）**：后端 `utils/geo.js` 实现逆地理(高德/腾讯双provider, 未配置返回 not-configured 空对象 + IP 粗定位（192/10/172/127 本地网段一律降级默认) + 城市名规范化（"广州"/"沪"/"申城" → "广州市"/"上海市"）；路由层暴露 `POST /api/location/reverse`、`GET /api/location/guess-by-ip`；前端 `utils/fallback.js` 实现 `resolveCityViaPipeline` 4 级顺序：①本地持久化缓存（24h 有效）② uni.getLocation + 后端逆地理（`retry(times=2, delay=400ms)` 偶发重试）③后端 IP 粗定位 ④ 默认值/手动选择；任意级别失败均进入下一级，绝不抛到 UI 线程
- [x] **搜索同义词扩展与关键词工程**：`utils/searchAlias.js` 维护 20+ 游戏/场景同义词组（LOL/英雄联盟/撸啊撸、王者/农药/王者荣耀、密室/密室逃脱、哄睡/ASMR/助眠电台…），`expandAlias(keyword)` 规范化后输出数组；服务 `services.js`、动态 `posts.js`、组局 `groups.js`、用户 `user.js#discover` 4 路由全链路接入：关键词 ≥2 字符才触发；多关键词 OR 匹配；城市字段 `normalizeCityName` 统一；响应返回 `{list,total,meta:{keywordNormalized, aliasesExpanded, cityNormalized, tookMs}}` 便于埋点
- [x] **前端兜底工具库（企业级防崩溃）**：`app/src/utils/fallback.js` 对外 23 个工具函数，分 9 类 — 类型收敛 `toList/toObj/toStr/toNum/toBool`；列表/对象安全访问 `safeMap/getPath`；格式化 `formatCount/formatTime/truncate`；城市收敛 `pickCity`；请求/异步防御 `retry/guard/unwrap/unwrapPage`；登录守卫 `requireLogin`（未登录弹 Modal + redirect 参数）；图片/Avatar 兜底 `avatarUrl/coverUrl`；标签 `pickTags`；4 级定位流水线 `resolveCityViaPipeline`；性能 `debounce/throttle`；全站 28 页脚本均走该工具作收敛
- [x] **7 大关键页全量兜底改造**（符合 React Best Practices `async-parallel` / `rerender-derived-state` / `js-early-exit` 三大类规则；UICraft `onboard.md` 空态 / `harden.md` 鲁棒性 / `audit.md` 可访问性）：
  - **首页**：定位走 `resolveCityViaPipeline`，服务/精英/banner 三路接口 `Promise.all` 并行；卡片字段全部 safeMap；城市/搜索入口拆分事件；未登录仅展示
  - **城市选择**：字母 A-Z 索引；`regionApi.search` 实时搜索中文/拼音/别名；L1-L4 4 级定位按钮；全国 382 城市不遗漏
  - **综合搜索**：4 Tab（服务/大神/动态/组局）；`onInput` debounce(300) 实时刷新；onSubmit 四路接口 `Promise.all`；每个列表独立 `loading/empty/error` 三态；未登录聊聊按钮触发守卫
  - **发现**：4 Tab；城市读/写走 4 级流水线；Posts/Groups/Finder 全部 guard+unwrapPage+safeMap；点赞/分享/报名/聊聊/签到 5 动作全 requireLogin；签到未登录降级本地 sign_history 视觉
  - **订单列表**：买家/卖家双角色；7 种状态筛选；列表字段收敛（单号/状态/金额/数量/服务标题/对方昵称）；4 类操作（Pay/Start/Confirm/Cancel）全守卫 + guard
  - **交易记录（钱包视图）**：7 类型筛选；金额 fen/starCoin 双币种格式化；toNum 防 NaN；total 未知时禁止无限下拉
  - **个人中心**：未登录 → 头像卡 "登录/注册" 引导；11 个功能入口 requireLogin；客服接口 guard + unwrap + toObj；钱包数字 toNum 防 NaN
  - **服务详情**：service + reviews 两路 `Promise.all`；service=null 双态（shimmer 骨架 → 最终空态）；底部购买按钮 requireLogin；下单后 toStr(orderData.id) 非空才跳转
- [x] **白夜主题零硬编码改造**（UICraft `normalize.md` + `arrange.md`）：原 4 页（订单/交易/个人/服务详情）残留 `#fffbeb / #ffffff / #ffd60a / #171717 / #ef4444` 全部替换为 `$by-bg / $by-card-bg / $by-soft-card / $by-text-1/2/3 / $by-gold / $by-gradient-gold / $by-gradient-aurora / color.adjust($color, $alpha:X)`；状态色改用语义背景 `color.adjust(状态色, $alpha:0.16)`；每页均实现 shimmer 骨架 + 极光 blur 空态；零重复 @use
- [x] **H5 + 微信小程序双端构建 + 敏感词 + 完整性校验**：
  - H5 `app/dist/build/h5` **102 个文件 / 4.64 MB**；`index.html` 标题「白夜」+ favicon.png + static/** 全量复制 + 31 路由页对应 31 份 CSS；敏感词扫描 0 命中
  - 微信小程序 `app/dist/build/mp-weixin` **170 个文件 / 4.34 MB**；`project.config.json`（appid=touristappid 占位，用户可在 HBuilder X 或开发者工具替换为真实 AppID）+ `app.json`/`app.js`/`app.wxss` 三件套齐全；31 路由（wxml+wxss+json+js）×4 文件全部存在；敏感词扫描（JS/JSON/WXML/WXSS）0 命中

### Phase 7.5 — Sequelize + MySQL 企业级主存储改造 ✅ 已完成
- [x] **双驱动架构（MySQL 强制 / JSON 回退）**：`server/src/config/database.js` 统一接入 Sequelize + mysql2 连接池；`NODE_ENV=production` **强制**走真实 MySQL；开发/测试通过 `DB_DRIVER=json` 回退到 JSON 文件，保证单测与本地零依赖体验不变
- [x] **17 个模型全部按 Sequelize 标准定义**：主键统一为 `BIGINT UNSIGNED AUTO_INCREMENT`（通过 beforeDefine 钩子注入）；TIMESTAMPS 开启、`underscored: true` → 列名 `created_at/updated_at`；字符集 `utf8mb4_unicode_ci`；TIMEZONE `+08:00`；覆盖模型：Admin / User / Wallet / Service / Order / Transaction / Review / Invite / Message / Config / Feedback / Banner / Post / Comment / Group / GroupJoin / EliteOrder / SignIn
- [x] **关联声明（Sequelize 模式生效）**：User↔Wallet 1:1、User↔Invite 1:N、User↔Service 1:N、User↔Order 双角色（买家/卖家）、Order↔Service N:1、Post↔Comment 1:N、Group↔GroupJoin 1:N 共 12+ 条级联关系；JSON 层保持 in-memory join 兼容
- [x] **seed.js 生产级事务幂等初始化**：MySQL 模式下 `sequelize.transaction()` 包裹管理员 + 配置模板写入；`bulkCreate(ignoreDuplicates:true)` 保证 (module,key) 零重复；老库 alter 同步保留历史数据；JSON 模式按原有循环 create 顺序幂等
- [x] **密码二次 hash 漏洞修复（C 级）**：Admin 模型新增 `isBcryptHash($2a|$2b|$2y)` 正则判空，setter 已 hash 不再重复 hash；Sequelize 原型方法 `verifyPassword` 兼容 bcrypt **与**旧明文（导入期一次兼容）；JSON 驱动 wrap 层同名方法同样引入幂等 hash 写入 + 双路校验
- [x] **Config 反序列化漏洞修复（B 级）**：`utils/config.js#getModuleConfig` 新增 `coerceValue(value, type)` 按 Config.type 元数据对 TEXT 反序列化 — boolean('true'/'1'→true, 其他 false) / number(空串→空, Number(x) NaN 兜底) / json(JSON.parse) / secret、string(保持)；set() 写入统一做 `boolean → 'true'/'false'` 与 object → JSON.stringify；读取对 Sequelize 实例与 JSON plain 双路径取 `r.get('key') / r.key`
- [x] **缓存一致性**：`set() / setModule() / DELETE /modules/:name / admin.js reset` 全链路 `cache.delete(name)`，避免 1 分钟缓存读到旧值
- [x] **健康探针升级**：`GET /health` 新增 `driver / storage` 字段；`GET /api/health` 新增 driver + MySQL 模式做 `SELECT 1`（失败返回 `status: degraded`，失败原因落 `dbError`）；`GET /api/admin/config/status`（管理后台配置中心健康条）输出 `driver/ok/dbOk/target/pool/error`，6 模块参数齐全性校验沿用 `POST /config/modules/:name/test`
- [x] **路由层零差异适配**：`Op / fn / col / literal / DataTypes` 统一从 `models/index.js` 导入；JSON 层 `store/index.js` 导出同名符号；修复 `admin.js / services.js / user.js` 3 处旧路径 `require('../store').Op` 导致的 undefined；routes 中所有 Model 实例使用 `toJSON()`（admin 用户详情、订单详情、服务详情、组局详情、banners 创建），避免 Sequelize 实例元属性被直接 spread 到响应
- [x] **列类型 / 时间 / JSON 字段兼容审计**：SignIn `createdAt` 与 Sequelize 默认字段冲突修复；User/Post/Group `meta/images/tags/location` 显式声明 DataTypes.JSON，JSON 层存取仍走原序列化；EliteOrder `paidAt/snapshot`、Order `startedAt/completedAt` 统一写入 `toISOString`，Sequelize 自动转换 DATE 列
- [x] **双驱动回归（12 套件 95 用例全过 + smoke 17 项全过）**：
  - 测试隔离：`test/setup.js` 强制 `DB_DRIVER=json` + 独立数据目录，保证 CI 零 MySQL 依赖
  - `npm run seed` ✅ 46 项配置模板幂等；`scripts/smoke-check.js` ✅ 17/17；`npm test` ✅ 95/95 全绿
- [x] **部署文档 MySQL 切换 Checklist（见下方 Phase 8 新增 §A）**：含宝塔面板 5 步创建库、.env 字段映射、alter 首启、冷数据迁移校验、驱动回退开关、连接池参数建议

### Phase 8 — 上线发布（进行中 · 整体完成度 70%）

#### 已完成项
- [x] MySQL 双驱动架构（Sequelize + JSON 回退）+ 18 个模型 + alter 建表
- [x] PM2 ecosystem + Nginx 反代模板 + 4 个部署脚本
- [x] 生产域名 zyb001.cn 已部署：Nginx 站点 + HTTPS 证书 + CORS 白名单 + 后端服务运行中
- [x] 管理后台已上线：`https://zyb001.cn/admin/` 可登录操作
- [x] App BASE_URL 已修复（LAN IP → 公网域名）
- [x] App 离线资源包构建完成（98 文件 / 5.43 MB）+ 图标 17 档 + 启动图 7 档
- [x] 密码登录 + AI DeepSeek 接入 + 服务分类管理 + 配置中心真测试（v2.1 迭代）
- [x] 城市选择多级菜单 + JWT 自动续期 + 管理后台错误修复（v2.1 迭代）

#### 待完成项（按优先级排列）
- [ ] **MySQL 生产驱动切换**：当前生产仍用 JSON 驱动；需 .env 设 NODE_ENV=production + DB_DRIVER=mysql + 填 DB 连接信息后重启
- [ ] **短信服务配置**：阿里云/腾讯云短信签名+模板未申请，当前 dev 模式
- [ ] **微信支付配置**：商户号/API V3 密钥/证书未配置
- [ ] **Android APK 云打包**：HBuilder X 打包 + 证书（离线资源已就绪）
- [ ] **iOS IPA 云打包**：Apple Developer 证书 + Provisioning Profile
- [ ] **应用市场资质**：ICP 备案 / 软著 / 隐私政策 URL
- [ ] **监控告警**：API 错误率 / 订单成功率 / UGC 审核积压

#### §A MySQL 切换 Checklist（生产级 · 推荐配合宝塔面板使用）
1. **服务器环境准备**：MySQL 8.0+（最低 5.7，需 utf8mb4 支持）；Node 18+；Nginx 反代后端/管理后台；防火墙放行 3306（仅本机或内网）/80/443
2. **宝塔面板一键建库**（推荐）：宝塔 → 数据库 → 添加数据库 → 库名 `companion_play` / 字符集 `utf8mb4` / 排序 `utf8mb4_unicode_ci` → 自动生成账号密码 → 复制到下一步
3. **后端 .env 对齐**：拷贝 `server/.env.example` 为 `server/.env`；`NODE_ENV=production`；`DB_DRIVER=mysql`（即使不写 production 也会强制 mysql）；填 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`；连接池建议：`DB_POOL_MIN=5 DB_POOL_MAX=40`（2C4G）/ `DB_POOL_MAX=80`（4C8G）；时区保持默认 `+08:00`
4. **首次启动（alter 建表 / 补索引）**：`cd server && npm ci && npm run seed` — ① `authenticate()` 成功 ② `sequelize.sync({ alter: true })` 自动建表/补齐列/补齐索引 **绝不删老列**；首次 seed 后：管理员 `admin / admin123` 登录后台立刻改密
5. **冷数据迁移（JSON → MySQL）**：若线上已有 JSON 数据，按以下顺序迁移避免外键孤儿：
   - ① admins → users → wallets → services → banners → posts → groups
   - ② comments → groupJoins → orders → eliteOrders → transactions → reviews → invites → messages → feedbacks → signIns → configs
   - 迁移脚本完成后，`SELECT COUNT(*)` 逐表比对 JSON 条数；`GET /api/health` 确认 `status: ok + driver: mysql + dbOk: true`
6. **驱动回退应急开关**：若 MySQL 临时故障又需快速恢复，仅需在 `server/.env` 中临时设置 `NODE_ENV=development DB_DRIVER=json` 并重启进程（注意：回退后 JSON 仅为本地文件，不同步 MySQL；这是降级不是长期方案，最多 24h 内修复 MySQL 连接后切回）
7. **生产健康断言**：
   - `GET /health` → `{ status: 'ok', driver: 'mysql', storage: 'mysql://...', ... }`
   - `GET /api/health` → `{ status: 'ok', driver: 'mysql', dbOk: true }`
   - `GET /api/admin/config/status` → `{ driver: 'mysql', ok: true, dbOk: true, target, pool }`
   - 管理后台 → 配置中心 → 6 模块测试连通性（短信/微信/支付宝/OSS 未配置时按预期返回 400 级业务错误，非 5xx）
8. **宝塔运维建议**：后端 PM2 守护 (`pm2 start src/app.js --name by-server`)；cron 每日 02:00 `mysqldump companion_play | gzip > /backup/by-$(date +%F).sql.gz` + 保留 7 天；Nginx 配置上传大小 `client_max_body_size 20m` 匹配本地 multer 限制
- [x] **App 离线资源包构建完成**：执行 `cd app && npm run build:app`（uni build -p app）输出产物至 `app/dist/build/app`，共 **98 个文件 / 5.43 MB**；构建零错误；动态 + 静态导入冲突告警已消除（order-detail.vue / settings.vue 的 `await import('../../utils/request')` 全部改为脚本顶部静态 import）；Sass legacy-js-api deprecation 不影响上线，HBuilder X 发行模式会重编译
- [x] **App 打包资源完整性校验（icon + splash）**：
  - App 级多尺寸图标 `app/unpackage/res/icons`：共 **17 张**（20/29/40/58/60/72/76/80/87/96/120/144/152/167/180/192 + 1024x1024），全部非空；与 `manifest.json → distribute.icons` 100% 对齐
  - 启动图 `app/src/static/app-plus`：**7 张主流尺寸**（750x1334 / 828x1792 / 1080x1920 / 1125x2436 / 1242x2688 / 720x1280 / 1280x720 + splash.png 兜底）
  - 额外 App 图标副本 `app/src/static/app-plus/icon-*.png`：9 档（48/72/96/128/144/192/256/512/1024）+ icon.png 基础版；manifest.json 引用的 unpackage/res/icons/** 均已通过图标脚本生成
- [x] **manifest.json App 发布基础配置就绪**：name=白夜 / appid=`__UNI__B38A42D` / versionName=1.0.0 / versionCode=100 / vueVersion=3；`app-plus.distribute.android` 已声明 INTERNET/STORAGE R&W/CAMERA/RECORD_AUDIO/VIBRATE/ACCESS_NETWORK_STATE 7 项权限；`modules` 开启 Push / Share；`sdkConfigs.oauth/payment/push` 为占位空对象，需要在 HBuilder X 可视化界面选填微信/QQ/支付宝/推送后 DCloud 会自动合并
- [ ] **HBuilder X 云打包步骤（Android）**：①打开 HBuilder X → 项目 → 打开目录 → 选 `app/` 作为项目根 ②菜单 发行 → 原生App-云打包 ③平台勾选 Android（APK） ④证书：使用自有证书 → 选择 .keystore 文件（建议 RSA2048，30 年有效期；未生成时可临时用 DCloud 公共证书 打测试包，正式上架必须替换为自有证书）→ 填写 keystore 密码 / alias / alias 密码 ⑤「打正式包」勾选，Android 包名填公司反域名（如 `com.baiye.app`，manifest.json 默认未写，HBuilder X 打包表单里补） ⑥权限保持当前声明即可；「开启 x86 支持」不勾选（应用市场主流 arm64-v8a / armeabi-v7a） ⑦使用传统 uni 统计保持默认 ⑧点击「打包」→ 等待 3-8 分钟，完成后控制台给出 APK 下载链接 ⑨验证 APK 签名：`keytool -printcert -jarfile 白夜.apk`
- [ ] **HBuilder X 云打包步骤（iOS）**：①①同 Android 前两步 ②平台勾选 iOS ③证书文件：上传发布版 .p12（从 Apple Developer 导出 Distribution 证书，Keychain 导出 p12 需设置密码）→ 填 p12 密码 ④Provisioning Profile：上传发布版 .mobileprovision（Apple Developer → Identifiers 注册 app ID → Profiles 新建 App Store 类型，绑定对应 app ID + 证书 + 全部设备无关） ⑤Bundle ID：填入与 .mobileprovision 一致的反域名（如 `com.baiye.app`） ⑥「打正式包」勾选 ⑦打包完成 → 下载 .ipa → 使用 Transporter App 或 `xcrun altool --upload-app -f 白夜.ipa -t ios -u APPLE_ID -p APP_SPECIFIC_PASSWORD` 上传至 App Store Connect → TestFlight → 提交审核
- [ ] **证书 / 配置项占位清单（真实值由团队密钥管理器维护）**：
  | 类型 | 字段 | 占位值 / 生成方法 | 必须 |
  |---|---|---|---|
  | Android 签名 | keystore 文件 | `keytool -genkey -v -keystore baiye-release.keystore -alias baiye -keyalg RSA -keysize 2048 -validity 10950` | ✅ 上架 |
  | Android 签名 | keystore 密码 | **≥8 位，字母+数字，单独存档** | ✅ |
  | Android 签名 | alias | baiye（与 keytool 一致） | ✅ |
  | Android 签名 | alias 密码 | 可与 keystore 密码一致 | ✅ |
  | Android 应用 | 包名 (package) | `com.baiye.app`（推荐） | ✅ |
  | iOS 签名 | Distribution .p12 | Apple Developer → Certificates → Apple Distribution → 下载 .cer → 导入 Keychain → 右键导出 .p12 | ✅ |
  | iOS 签名 | p12 密码 | 导出时手动设置 | ✅ |
  | iOS 签名 | .mobileprovision (App Store) | Apple Developer → Profiles → App Store，绑定 app ID + Distribution 证书 | ✅ |
  | iOS 应用 | Bundle ID | 与 .mobileprovision 的 Identifier 一致 | ✅ |
  | iOS 连接 | App Store Connect Apple ID | 开发者账户邮箱 | ✅ |
  | iOS 连接 | App 专用密码 | appleid.apple.com → 安全 → 生成 | ✅ 上传 |
  | 管理后台 | 7 大模块配置（应用/短信/微信支付/支付宝/推送/OSS/地理） | 登录 http://服务器IP:5174 管理后台 → 配置中心 → 逐项填入 + 测试连通性 | ✅ 线上 |
- [x] **「原生 App 云打包发布清单 v1.0」独立文档已生成**：[docs/APP-PACKAGING-CHECKLIST.md](APP-PACKAGING-CHECKLIST.md) 涵盖 §0 前置 7 项 Gate、§1 离线资源包重构建、§2 证书 17 条占位表（Android 8/ iOS 9）、§3 Android 云打包表单 + 签名验证、§4 iOS 云打包表单 + Transporter 上传、§5 真机冒烟 12+3+3 条、§6 应用市场 ICP/软著/隐私政策 资质、§7 产物归档 SHA256/dSYM、§8 常见失败 10 条速查、§9 运维证书到期预警
- [ ] **生产环境打包前必改（request.js BASE_URL）**：`app/src/utils/request.js` 的 `BASE_URL` 默认值当前走 H5 dev server 代理；生产 APK/IPA 必须指向真实公网 HTTPS 域名（推荐在管理后台「应用配置」里注入 baseUrl 再由客户端首启动拉取；短期方案直接改 `VITE_API_BASE=https://api.baiye.example.com` 环境变量后重新 `npm run build:app`）
- [ ] **App Store / 应用市场提审**（按 `docs/APP-STORE-CHECKLIST.md` v2 九大类逐项过；打包细节完全对齐 `docs/APP-PACKAGING-CHECKLIST.md` §5 真机冒烟 18 条 + §6 市场资质）
- [ ] **生产环境部署**：后端 HTTPS + 管理后台 HTTPS + 移动端 H5 静态资源 CDN；微信小程序上传代码 → 开发版 → 体验版 → 提审
- [ ] **监控告警**（API 错误率 / 订单成功率 / UGC 审核积压 / 敏感词命中异常尖峰）
- [ ] **首次冷启动用户灰度**（1% → 5% → 20% → 100%），观察举报工单 / 敏感词拦截 / 精英转化漏斗

---

## 七、设计规范来源

原型页面位于 `/pages/*.html`，由 solo-design 技能生成，设计 token 见 `colors_and_type.css`。uniapp 的 `uni.scss` 已对齐该 token 体系。
