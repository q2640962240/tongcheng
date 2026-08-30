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

### Phase 8 — 上线发布（进行中 · 整体完成度 94% · Docker Compose v2 生产部署）

> **部署方式已从「宝塔面板 + PM2」全面切换为「Docker Compose 6 容器编排」（2026-08-29 完成迁移）**。
> 详细拓扑、黄金规则、踩坑、回滚方法、手动部署命令见：`.trae/rules/deployment.md`（v2.0，23+ 次 CI/CD 验证）。

#### 8.0 Phase 8 部署时间节点表（所有时间 = 北京时间 UTC+8，摘自 git log `--date=iso` 真实记录，可 `git show <SHA>` 逐条复核）

| 阶段 | 时间 | Commit SHA | 里程碑事件 | 结果 |
|---|---|---|---|---|
| ① CI 基座落地 | **2026-08-29 17:04:48** | `b3a9ae7` | deploy.yml 定型：appleboy/ssh-action v1.0.3（去除 known_hosts / fingerprint_hash 不兼容字段）→ 22 端口 root 用户 SSH 登录 101.132.17.214 | ✅ 完成 |
| ① CI 基座落地 | **2026-08-29 17:27:58** | `bb2de00` | drone-ssh 脚本路径修复：`cd /opt/baiye` 硬编码（DEPLOY_DIR 未绑定 set -u exit 1）+ 去除 script_stop（不在 drone-ssh 1.8.4 inputs）| ✅ 完成 |
| ② server 容器化首通 | **2026-08-29 18:20:27** | `57d2328` | 诊断 server unhealthy 根因：seed.js sequelize pool 保持 Node 事件循环 → entrypoint 进不去 app.js → 3000 不监听（首次诊断，加 timeout 180 兜底）| 🩺 诊断 |
| ② server 容器化首通 | **2026-08-29 18:21:41** | `81389da` | 根本性修复：seed.js 结尾补 `await sequelize.close(); process.exit(0)` | ✅ server 从此 Healthy |
| ② server 容器化首通 | **2026-08-29 18:49:41** | `e416f05` | 双补丁：① apt 列表移除不存在的「timeout」包（coreutils 自带，apt exit 100 解除）② CORS `CORS_ORIGINS=*` 裸通配符支持（浏览器跨域不再 403）| ✅ 完成 |
| ② server 容器化首通 | **2026-08-29 21:05:35** | `5f2be36` | ECS 出站阻断 deb.debian.org:80 → server runtime apt 全挂（exit 100）；改为阿里云 HTTPS 443 镜像 bookworm + bookworm-security（deb822 Signed-By 结构） | ✅ apt 从此成功 |
| ③ HTTPS/6 容器第一次全 Healthy | **2026-08-30 09:30:54** | `6f369aa` | 生产 HTTPS 全量对接：docker-compose gateway 健康检查改 HTTPS+--no-check-certificate；certbot 卷挂载；APP_DOMAIN=https://zyb001.cn；nginx-docker.conf 双 server（HTTP 80 ACME+/health 200+301；HTTPS 443 证书+HSTS/locations）| ✅ 6 容器首次全部 Healthy + HTTPS 4 端点 200 |
| ③ HTTPS/6 容器第一次全 Healthy | **2026-08-30 09:58:50** | `a586650` | CI mode-A smoke deploy 通过；README 加 Actions 状态徽章 | ✅ CI 通 |
| ④ 用户端 BUG 集中修复（第 1 轮） | **2026-08-30 10:43:18** | `c587881` | 用户端 5 项问题修复（登录流/精英列表显示/服务者详情参数…）| ✅ 完成 |
| ④ 用户端 BUG 集中修复（第 1 轮） | **2026-08-30 10:59:39** | `15c6eba` | Bug 3/4/5 遗留修复 + 管理后台四色语义化（成功/警告/危险/信息按钮 + Tag 配色 + 斑马纹表格）| ✅ 完成 |
| ④ 用户端 BUG 集中修复（第 2 轮 6 连环） | **2026-08-30 12:15:22** | `ba2ef71` | 6 项连环修复：① matchCity 空城市 + services city 规范化自动过审升级 isProvider；② store instance.save() + password(passwordHash) bcrypt 双向兼容；③ static increment(id,field,by)；④ chat.js to=receiverId 别名；⑤ kickToLogin 12s 防抖防吞跳转；⑥ warm/game/offline 统一 requireElite（正式结束发布动态重复登录死循环）| ✅ Jest + smoke 全绿 |
| ④ 用户端 BUG 集中修复（第 3 轮 city/chat/admin 全绿 155） | **2026-08-30 13:09:43** | `8d6b893` | 6 项修复 + E2E harness：① store looseEq/looseIncludes 宽松类型匹配；② posts 城市 Op.like prefix% 前缀匹配；③ admin 登录 URL (`/admin/login`) 和 header (`x-admin-token`) 契约修正；④ 21 场景 Admin E2E harness 补齐 | ✅ 155 用例全绿 |
| ④ 两轮 Comment Commit 触发全链路验证（Secrets / CI） | **2026-08-30 13:26:45 / 14:24:30** | `9a3ec67` / `0a939c5` | 9a3ec67 验证 city-type/chat-history 修复 → 0a939c5 验证 ed25519 SSH Secrets 修复目标 8d6b893（Comment commit，代码零变更）| ✅ CI 通 |
| ⑤ 基础设施 2 连修复（apt + HTTP verify） | **2026-08-30 14:35:06** | `3d4d549` | server Dockerfile apt 再改：HTTPS deb822 Signed-By → **HTTP 旧式 sources.list + 阿里云 HTTP 镜像**（ECS HTTPS 证书链失败，HTTP 更稳定）| ✅ apt 成功率 100% |
| ⑤ 基础设施 2 连修复（apt + HTTP verify） | **2026-08-30 14:51:18** | `e9482d8` | HTTP verify 放宽至包含 301/302（nginx 内部 127.0.0.1 HTTP 会强制 301→HTTPS，不表示失败）| ✅ CI 伪消除 |
| ⑥ Smart Build v2 提速 15min → 30s | **2026-08-30 15:11:20** | `e297820` | 开启 Docker 层缓存；git diff 判 CHANGED_*；移除 `--no-cache` / `system prune -af` / `rmi -f` / `down -v`（保留 volume）| ⚡ 构建提速 ×10~×30 |
| ⑥ Smart Build v2 提速 15min → 30s | **2026-08-30 15:11:51 → 15:13:03** | `2c45b40` → `e3259ee` | 三端 Dockerfile npm 统一 `npmmirror.com` 国内镜像；移除 `npm cache clean --force`（Docker 层缓存处理）| ⚡ npm install 阶段从 15min → 1~3min |
| ⑥ Smart Build v2 提速 15min → 30s | **2026-08-30 15:32:35 / 15:37:00** | `e784b52` / `efe4fa1` | `.trae/rules/deployment.md` v2 交付（12 节：服务器规格 + 6 容器拓扑 + 4 黄金 + 3 nginx + seed 退出 + SSH 配置 + §6 Smart Build + ECS 限制 + 手动部署 + FAQ + 回滚 + 文件职责表）| 📄 文档交付 |
| ⑦ IM 接入腾讯云 TIM SDK | **2026-08-30 16:32:35** | `83c3c1d` | 集成 Tencent Cloud IM Chat UIKit（微信聊天风格 UI + Socket.IO 双通道兜底）| ✅ 代码到位 |
| ⑦ IM 接入腾讯云 TIM SDK | **2026-08-30 16:41:31** | `e4ea98e` | tim-js-sdk 版本锁定 ^2.27.6 + 中间件 import 名称修复（authRequired→auth）| ✅ 修正 |
| ⑦ IM 接入腾讯云 TIM SDK | **2026-08-30 17:19:10** | `6815fa5` | require → **静态 import**（否则 Vite tree-shake TIM SDK 丢包）；从此 H5 构建出独立 597KB `im.*.js` chunk | ✅ 真正打进 H5 |
| **⑧ P0 数据清空最终修复** | **2026-08-30 17:39:51** | `c851d67` | `seed.js db.bootstrap({force:true})` → **`force:false`**；Sequelize sync alter 模式；部署/容器重启从此绝不 DROP TABLE，用户 + 配置中心密钥 100% 保留 | **🔥 P0 终结** |
| ⑨ P1 IM 404 路径修复 | **2026-08-30 17:55:07** | `01461d8` | `/api/api/im/config 404` 根源：im.js 写了 `/api/im/config`，但 request.js BASE_URL= `/api` → 双重叠加；改为无前缀 `/im/config` 和 `/im/login`（自动拼 `/api/im/config` 200）| ✅ 源码修复；H5 镜像待重建 |
| ⑩ CI Smart Build 竞态修复 | **2026-08-30 18:07:01** | `2e4cd92` | OLD_SHA==NEW_SHA 时 git diff 为空 → 旧逻辑所有 CHANGED_* 全部 false 跳过；**else 分支强制 CHANGED_*=true 全量构建** | ✅ 兜底 |
| ⑩ CI Smart Build 竞态修复 | **2026-08-30 18:13:18** | `1589531` | INFRA pattern 加入 `^\.github/`（否则改 workflow 自己不会触发任何构建）；im.js 追加 marker comment 强制触发 H5 build | ✅ 再兜底 |
| ⑪ P3 H5 浏览器缓存根治 | **2026-08-30 18:41:55** | `deee836` | app/Dockerfile nginx 段补齐：hash 化资源（含 /assets 和 hash 正则）1 年 immutable；`location = /index.html` + SPA catch-all 全部 `no-cache no-store Pragma=0`（从根源解决「服务器已更新、浏览器仍卡旧 index」）| ✅ 源码写入；待 H5 镜像生效 |
| **⑫ 当前阻塞（待服务器命令执行）** | **未执行 → 待补真实时间** | — | `cd /opt/baiye && git fetch --prune origin main && git reset --hard origin/main && docker compose build --no-cache h5 && docker compose up -d h5 && docker compose ps h5`（刷新 H5 镜像，让 ⑨ + ⑪ 线上生效，用户端 /api/api/im/config 404 即消失）| 🔴 待执行 |
| **⑬ 下一极高优先级** | 待配置中心录入后补记录 | — | 管理后台 → 配置中心 → IM 模块，录入 userSig 签名密钥（1600159799 已就绪，缺密钥时 TIM SDK 鉴权失败，聊天消息无法真发出）| 🟡 极高 |
| ⑭ 后续（中高） | 填完补时间 | — | 短信签名+模板 / 微信支付 V3 密钥+证书 / 阿里云 OSS / 推送 AppKey / DeepSeek API Key；Android APK + iOS IPA 云打包；微信小程序；应用市场资质；监控告警搭建 | 🟡~🔴 排队中 |

> 说明：所有时间均来自「北京时间」的 git commit 时间戳（与 GitHub Commit Page 显示一致）。完成阻塞项 ⑫ 后，把「未执行 → 待补真实时间」替换成真实的 SSH 操作完成时间，例如 **2026-08-30 20:xx:xx**。


#### 8.1 生产环境概览

| 维度 | 值 |
|---|---|
| 服务器 | 阿里云轻量 ECS 2C4G；公网 101.132.17.214；Aliyun Linux 3.2104 LTS；4GB swapfile；49G SSD |
| 代码路径（服务器）| `/opt/baiye`（git clone `github.com/q2640962240/tongcheng`）|
| 编排 | Docker Compose v2；6 容器 + 2 网络（`back`：server/mysql/redis；`front`：gateway/server/admin/h5）|
| 唯一公网入口 | `baiye-gateway` nginx:1.27-alpine（TCP 80/443）；数据库/Redis 均绑定 127.0.0.1 / 仅 Docker 内部可达，不公网暴露 3306/6379 |
| 域名 + SSL | `zyb001.cn` + `www.zyb001.cn`；Let's Encrypt SAN 证书（有效期至 2026-11-27），certbot cron 自动续期（`/etc/cron.d/baiye-cert-renew`）|
| 部署 CI/CD | GitHub Actions `.github/workflows/deploy.yml`（Smart Build v2）：`push main` → appleboy SSH 连接 → `git diff OLD NEW` 智能判断 → 只构建变更服务（30s~3min 小改动，对比旧 15-30min 全量）；FORCE_REBUILD / ONLY_START 手动触发参数已支持 |
| CI/CD Secrets | GitHub Settings → Secrets → Actions：SERVER_HOST / SERVER_PORT / SERVER_USER / SERVER_SSH_KEY（ed25519 私钥，完整 6-8 行，头尾含 BEGIN/END OPENSSH PRIVATE KEY）|
| 生产管理员 | https://zyb001.cn/admin/ `admin / admin123`（**请尽快修改**）|
| 生产 MySQL | 容器内 DB `companion_play`；utf8mb4_unicode_ci；环境变量 `MYSQL_ROOT_PASSWORD=Baiye@2024!` |
| 生产 Redis | 容器内 `requirepass BaiyeRedis2026!`；64MB maxmemory-policy allkeys-lru；AOF fsync everysec |
| 生产 JWT Secret | `baiye_prod_jwt_secret_please_change_ME_2026_v1_abcdef`（建议上线前替换新 commit）|
| APP_DOMAIN 默认 | `https://zyb001.cn`（docker-compose.yml environment）|

#### 8.2 6 容器拓扑

```
公网 80/443 → [baiye-gateway nginx]
                ├─ /api/*    ──────────► [baiye-server node:20-slim] :3000
                ├─ /socket.io/*  Upgrade► [baiye-server node:20-slim] :3000
                ├─ /admin/*  ──────────► [baiye-admin  nginx] SPA alias
                ├─ /health   ──────────► [baiye-server] 探针（HTTP 块必写，否则 301）
                └─ /         ──────────► [baiye-h5     nginx] uni-app H5 静态
                                          │
                                ┌─────────┴──────────┐
                                ▼                    ▼
                         [baiye-mysql 8.0]    [baiye-redis 7-alpine]
                          companion_play DB     64MB + AOF
```

| 容器名 | 镜像基础 | 构建位置 | 状态 |
|---|---|---|---|
| baiye-gateway | nginx:1.27-alpine | `deploy/nginx-docker.conf` 生成器（docker-compose 内建）| ✅ Healthy |
| baiye-server | node:20-slim 两阶段（builder + slim runtime）| `server/Dockerfile` | ✅ Healthy |
| baiye-admin | nginx:1.27-alpine 两阶段（builder=Vite build；runtime=nginx SPA）| `admin/Dockerfile` | ✅ Healthy |
| baiye-h5 | nginx:1.27-alpine 两阶段（builder=npm run build:h5 uni-app）| `app/Dockerfile`（含最新缓存策略：hash 资源 1y immutable，index.html no-cache）| 🟡 等待重建 H5 镜像后 Healthy |
| baiye-mysql | mysql:8.0 | Docker Hub 官方 + docker-compose volume 持久化 `/var/lib/mysql` | ✅ Healthy |
| baiye-redis | redis:7-alpine | Docker Hub 官方 + docker-compose volume 持久化 `/data` | ✅ Healthy |

#### 已完成项（2026-08-30 v2 更新）
- [x] Docker Compose 6 容器生产部署（替代原宝塔 + PM2 方案）+ 4/4 部署黄金规则校验通过
- [x] 部署方式迁移：服务器 root `git clone git@github.com:q2640962240/tongcheng.git baiye` → `docker compose up -d --build` 即可冷启动
- [x] HTTPS Let's Encrypt SAN 证书（zyb001.cn + www）部署 + cron 自动续期 + gateway 正确配置 /health location
- [x] **生产 MySQL 驱动强制启用**：`NODE_ENV=production` + `DB_DRIVER=mysql`；utf8mb4；BIGINT UNSIGNED；18 表 alter 模式同步（不删表，数据持久）
- [x] **数据不丢失重大 BUG 修复**：`seed.js` `db.bootstrap({ force: true })` → `{ force: false }`；之前每次 server 容器重启都会 DROP TABLE 清空用户和配置中心数据 → 现已 100% 保留（P0 已修）
- [x] server 容器 Unhealthy 根因修复：`seed.js` 结尾必须 `await sequelize.close(); process.exit(0)`（否则连接池保持 Node 事件循环，entrypoint 永远到不了 `exec node src/app.js`，端口 3000 不监听）
- [x] **server/Dockerfile apt 双修复**（ECS 出站阻断 HTTP 80 deb.debian.org）：①`rm debian.sources` + `/etc/apt/sources.list` 切「阿里云 HTTP」镜像；②`timeout` 包已从 apt install 列表移除（属于 coreutils 已自带，安装不存在包会 apt exit 100）
- [x] CORS 裸通配符 `CORS_ORIGINS=*` 支持（原代码只匹配逗号分隔域名），浏览器跨域不再 403
- [x] GitHub Actions Smart Build v2：OLD_SHA==NEW_SHA 竞态兜底 + `.github/` 纳入 INFRA pattern（P2 修复）；§6 4/4 金标准：worker_processes 首行、healthcheck.js 存在、admin Dockerfile nginx.conf 尾部、HEAD SHA 匹配
- [x] 管理后台已上线：`https://zyb001.cn/admin/` + **用户管理可创建 AI 用户 + 设置登录密码**（userType 限制已去掉）+ **新增「指定用户上架服务」对话框**（admin 后台服务管理）
- [x] 管理后台视觉升级：成功/警告/危险/信息四色语义按钮 + Tag 配色分化 + 表格斑马纹（Element Plus）
- [x] App BASE_URL 已实现 4 级优先级（无重新打包即可切换）：① 运行时 localStorage 热切换 ② VITE_API_BASE 编译变量 ③ H5 默认 `/api` 同源代理 ④ App/小程序默认 `https://zyb001.cn/api`
- [x] 腾讯云 IM SDK 接入（用户端 H5 构建输出独立 `im.*.js` chunk ≈597KB，本地构建验证只含正确 `/im/config` 路径）+ 后端 `/im/config` + `/im/login` 接口返回 sdkAppId 1600159799 ap-guangzhou
- [x] 精英守卫全面修复（解决发布动态/服务重复弹窗死循环）：`requireElite` 替代 `requireLogin` 放在发布/联系入口，配合 request.js kickToLogin 12s 冷却，避免 401 往返跳转
- [x] 服务者详情页 500 修复：home.vue `?id=` + provider.vue 接受 `id/uid/userId/providerId` 四种别名
- [x] 服务发布后「同城其他用户看不到」三连环修复：①发布时 city 字段兜底 ②matchCity 允许空值 ③动态城市 `Op.like prefix%` 前缀模糊匹配（解决「北京朝阳区」搜不到）
- [x] 聊天记录查不到修复：`store/index.js` looseEq / looseIncludes 宽松匹配，string id ⇄ numeric id 不再相互错过（JSON 回退 + MySQL 均生效）
- [x] App 离线资源包构建完成（98 文件 / 5.43 MB）+ 图标 17 档 + 启动图 7 档
- [x] 城市选择多级菜单 + 全国 34 省 382 地级市（民政部 2024 版数据）
- [x] 密码登录双 Tab + 「稍后设置密码」跳首页 + 设置完密码立即刷新 Pinia hasPassword
- [x] 服务自动审核配置：`serviceAutoApprove=true`（管理后台配置中心 → 应用配置 → 默认自动上架）

#### 8.3 待完成项（按优先级排列）

| 优先级 | 项目 | 说明 |
|---|---|---|
| **🔴 阻塞** | **刷新 H5 镜像（IM 路径修复生效）** | 当前线上 H5 仍请求 `/api/api/im/config` 404。需在服务器 SSH 执行：`cd /opt/baiye && git fetch --prune origin main && git reset --hard origin/main && docker compose build --no-cache h5 && docker compose up -d h5 && docker compose ps h5` |
| **🟡 极高** | 配置中心填写真实密钥：腾讯云 IM userSig 密钥 | SDKAppID=1600159799 已就位，但 `/im/login` 生成合法 userSig 需密钥字符串；否则 IM 消息会鉴权失败 |
| **🟡 高** | 短信服务（阿里云 / 腾讯云）签名 + 模板 | 当前 dev 模式直接返回真实验证码字段，生产需要配置中心录入 + 测试连通性 |
| **🟡 高** | 微信支付 V3 密钥 + 平台证书 + 回调 URL | 钱包充值 / 精英付费 / 订单支付都依赖此通道；`APP_DOMAIN=https://zyb001.cn` 回调无需额外改 |
| **🟡 中** | 支付宝公钥 / 私钥 | 备用支付通道 |
| **🟡 中** | 阿里云 OSS Bucket + RAM 子账号 | 图片/语音上传切换至对象存储；本地 multer 仅冷启动初期 |
| **🟡 中** | 推送（极光 / 个推）AppKey | IM 离线 / 订单状态 / 叫醒推送；未配置时 fallback 到 Socket.IO 在线通道 |
| **🟡 中** | AI DeepSeek / OpenAI API Key | 管理后台录入后，AI 用户聊天三级兜底生效 |
| **🟡 高** | Android APK 云打包 + 签名证书 | HBuilder X 步骤见 §8.5（BASE_URL 无需重打包：默认 https://zyb001.cn/api + 热切换）|
| **🟡 中** | iOS IPA 云打包 + App Store Connect | §8.5 |
| **🟡 中** | 微信小程序提审 | 合法域名单填 `https://zyb001.cn`（request/uploadFile/downloadFile/socket）|
| **🟡 中** | 应用市场资质：ICP 备案 / 软著 / 隐私政策 URL | 对应九大类 APP-STORE-CHECKLIST |
| **🔴 低** | 监控告警 | API 错误率 / 订单成功率 / UGC 审核积压；阿里云云监控 `curl /health` HTTP 200 探针即可起步 |
| **🔴 低** | 冷启动灰度 | 1% → 5% → 20% → 100% |

#### 8.4 IM 接入说明（腾讯云即时通信 TIM）

1. **SDK**：H5 端静态 import `tim-js-sdk + tim-upload-plugin`（Vite 代码分割出独立 `im.<hash>.js`，首次进入消息页懒加载；**不再 require 动态依赖**）
2. **配置**：`app/src/utils/im.js` 路径修正：**请使用 `url: '/im/config'` 而不是 `/api/im/config`**。因为 `app/src/utils/request.js` 的 H5 BASE_URL 默认为 `/api`（同源网关代理，CORS 零依赖），finalURL = `/api` + `/im/config` = `/api/im/config` 正确。若写成 `/api/im/config` → 最终双叠加 `/api/api/im/config` HTTP 404。
3. **后端**：
   - `GET /im/config`：返回 `{ enabled, ready, sdkAppId, imRegion }`（当前 ap-guangzhou 1600159799）
   - `POST /im/login`：已登录用户 → 用配置中心密钥签发 userSig 返回给客户端
4. **状态**：SDK 已打包进 H5；后端接口 HTTP 200 已通过；仅缺配置中心录入密钥，完成后即可真实发消息。

#### 8.5 客户端 BASE_URL 生产切换说明（无需每次重打包）

`app/src/utils/request.js` 提供了 `getRuntimeBaseURL` / `setRuntimeBaseURL` / `resetRuntimeBaseURL` 热切换 API（uni 本地存储 `app.baseURL`），默认解析顺序：

```
① 运行时 localStorage (用户端「我的→设置→服务器地址」图形化弹窗填 https://zyb001.cn/api → 立即生效)
  ↓ (无)
② VITE_API_BASE 编译期 env
  ↓ (无)
③ IS_H5 ? '/api' (同源 nginx gateway /api proxy，生产 zyb001.cn 已在工作)
  ↓ (App/小程序)
④ 'https://zyb001.cn/api' (内置最终兜底生产域名)
```

**因此：APK/IPA 打包不再需要手动改 BASE_URL**，客户端默认就能连到正确生产公网；如果以后迁移域名，只要在管理后台「应用配置」里改或让用户在设置里贴新地址，立即生效。

#### 8.6 发布迭代 / 回滚 / Smart Build 命令速查

**（服务器 SSH，/opt/baiye 目录下）**

```bash
# ⭐ 标准更新流程（代码 + 构建 + 重启）
cd /opt/baiye
eval "$(ssh-agent -s)" >/dev/null 2>&1
ssh-add ~/.ssh/github_actions_deploy            # 加载 SSH key（ed25519）
git fetch --prune origin main
git reset --hard origin/main                    # 同步 main 最新（任何本地修改会被覆盖，幂等）
docker compose build server admin h5            # 全量 build（也可以只改了什么就 build 哪个，节省时间）
docker compose up -d
for i in $(seq 1 24); do
  [ "$(docker inspect --format '{{.State.Health.Status}}' baiye-server 2>/dev/null)" = "healthy" ] && break
  sleep 5; echo -n .
done
# 4 端点验收
for ep in /health /api/health /admin/ /; do
  curl -sk -o /dev/null -w "$ep -> %{http_code}\n" https://zyb001.cn$ep
done

# ⭐ 仅重建 H5（如修复前端 CSS/JS 路径）
cd /opt/baiye && git fetch && git reset --hard origin/main \
  && docker compose build --no-cache h5 \
  && docker compose up -d h5 && docker compose ps h5

# ⭐ 回滚上一个 commit（避免重复踩坑）
cd /opt/baiye
git log --oneline -5
git reset --hard HEAD~1
docker compose build server   # 或 h5 / admin / ...
docker compose up -d server
```

#### 8.7 HBuilder X 云打包步骤（保留原文档但标注：BASE_URL 已内置，无需重改）

##### Android APK
① 打开 HBuilder X → 项目 → 打开目录 → 选 `app/` 作为项目根
② 菜单 **发行 → 原生 App-云打包**
③ 平台勾选 Android（APK）
④ 证书：使用自有证书 → 选择 .keystore（建议 RSA2048 30 年；无证书可选 DCloud 公共证书打临时测试包）→ 填 keystore 密码 / alias / alias 密码
⑤「打正式包」勾选，Android 包名推荐 `com.baiye.app`（manifest.json 未声明，打包表单里补）
⑥ 权限保持默认声明；「开启 x86」不勾；统计保持默认
⑦ 打包完成 → 下载 APK → `keytool -printcert -jarfile 白夜.apk` 验证签名
⑧ 安装 APK → 首页加载、登录、下单、IM 均走 `https://zyb001.cn/api`（无需配置；如需内网联调，在 App「我的 → 设置 → 服务器地址」弹窗填新地址即可）

##### iOS IPA
① Apple Developer：Identifier → 注册 app ID（如 `com.baiye.app`）→ Certificates → Apple Distribution 导出 p12；Profiles 创建 App Store Release 用的 .mobileprovision
② HBuilder X 发行 → 原生 App 云打包 → iOS → 上传 .p12 + .mobileprovision → 填密码 + Bundle ID → 打正式包
③ 下载 .ipa → Transporter App 或 `xcrun altool --upload-app -f 白夜.ipa -t ios -u <APPLE_ID> -p <APP_SPECIFIC_PASSWORD>` 上传 App Store Connect
④ TestFlight 内部测试 → App Store 提审

证书 / 配置项完整 17 项占位清单见：`docs/APP-PACKAGING-CHECKLIST.md` §2

#### 8.8 应用市场提审 / 资质 / 监控（收尾）
- 九大类自检清单 → `docs/APP-STORE-CHECKLIST.md`
- 打包证书完整清单 → `docs/APP-PACKAGING-CHECKLIST.md`
- 隐私政策（三段位置新增：动态发布/组局/位置匹配）→ `docs/PRIVACY-POLICY.md`
- 品牌素材映射表 → `docs/BRAND-REFERENCE.md`

---

## 七、设计规范来源

原型页面位于 `/pages/*.html`，由 solo-design 技能生成，设计 token 见 `colors_and_type.css`。uniapp 的 `uni.scss` 已对齐该 token 体系。
