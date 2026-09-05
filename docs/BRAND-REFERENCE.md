# 白夜 v2 · Sucai 素材 → 代码实现 映射参考手册

> 文档版本：v2.1.0 · 2026-09-05
> 素材根目录：`d:\tongcheng\companion-play-app\sucai\`（10 张 JPG，用户提供的同类型项目参考图）
> 目的：记录每张素材在白夜项目中的「设计提取点 → 落地代码位置 → 验证方法」，供后续 UI 迭代、品牌维护和视觉还原使用。

---

## 品牌定位

| 维度 | 描述 |
|---|---|
| **产品定位** | 同城聊天交友社交平台 |
| **核心功能** | 自由聊天、动态广场、寻人大厅、同城组局、用户主页、关注体系、聊天礼物 |
| **商业模式** | 免费社交 + 精英认证门槛 + 虚拟礼物经济 |
| **品牌调性** | 真实、安全、有趣的同城社交平台 |

---

## 目录速查

| # | 素材文件名 | 参考类别 | 核心提取点 | 主要落地文件 |
|---|---|---|---|---|
| 1 | `07db62c02f72d99581cffc375c02969e.jpg` | 首页 Banner 风格 | 极光渐变 + 金边卡片 + 人物头像叠层 | `app/src/pages/home/home.vue` |
| 2 | `378849617002ad354923701552859204.jpg` | 发现页多 Tab 布局 | 4 Tab 顶部吸顶 + 卡片流 + 角标红点 | `app/src/pages/discover/discover.vue` |
| 3 | `4ae4ef173d7e29b7fbc0d96f66c6925c.jpg` | 精英会员权益页 | 金「E」徽章 + 权益竖排 6 项 + 底部大按钮 | `app/src/pages/elite-pay/elite-pay.vue` |
| 4 | `4fbed1c6794c6aceb1d07c76333950a7.jpg` | 动态发布页 | 文本框占位 + 9 宫格上传 + 城市标签 | `app/src/pages/post/publish.vue` |
| 5 | `561925a2ca6621e0d278e48d28a877e6.jpg` | 个人中心头部 | 渐变毛玻璃头图 + 金 E 标 + 钱包三列 | `app/src/pages/profile/profile.vue` |
| 6 | `667380c7033f640dd8b587920a29d7f3.jpg` | 组局详情封面 | 极光渐变头图 + 标签云 + 报名进度条 | `app/src/pages/group/detail.vue` |
| 7 | `9ee225e9247a3afdda873436c062d136.jpg` | 动态卡片 UI | 圆角 16 + 左头像右内容 + 9 图缩略 | `app/src/pages/discover/discover.vue`（动态 Tab） |
| 8 | `b3aa58a457966267d08cfdb2689e9cfd.jpg` | 聊天守卫弹窗 | 金边框 + 渐变 CTA + 双按钮（取消 / 去开通） | `app/src/pages/chat/chat.vue`（首次私聊精英守卫） |
| 9 | `b888ef3a55af5ade422f2818a4936f45.jpg` | TabBar 图标风格 | 金色线条 / 极光描边 / 选中态加粗 | `scripts/generate-icons.js` → `app/src/static/tabbar/` |
| 10 | `c7336999f91b7da1a1b329c76472a0e9.jpg` | 充值页钻石卡 | 阶梯卡片 + 钻石💎 图标 + 渐变边框 | `app/src/pages/recharge/recharge.vue` |

---

## 逐张详细映射

### 素材 1：`07db62c02f72d99581cffc375c02969e.jpg` — 首页 Banner 风格参考

**素材观察**：
- 顶部横版 Banner，背景使用 **紫→粉→蓝 斜向极光渐变**（类似素材 `#7b61ff → #b57bff → #ff9fc5`）
- Banner 中央有**半透明毛玻璃卡片**，卡片边框带 1~2px 金色描边
- 卡片左侧人物头像圆形叠层，头像边缘金色描边
- 右下角有小号「去看看 →」金 CTA 按钮

**代码落地**：

| 提取点 | 实现位置 | 代码片段 / 方法 |
|---|---|---|
| 极光渐变 | `app/src/uni.scss` L18-20 | `$by-gradient-aurora: linear-gradient(135deg, #7b61ff 0%, #b57bff 50%, #ff9fc5 100%);` |
| 金色描边卡片 | `app/src/App.vue` L88-96 `.by-card-gold` | `border: 2rpx solid rgba(212,175,55,.5); box-shadow: 0 10rpx 30rpx rgba(212,175,55,.25);` |
| Banner 轮播 | `app/src/pages/home/home.vue` L35-58 `<swiper>` + `.banner-item` | `background: $by-gradient-aurora;` + 覆盖渐变遮罩层 + `.banner-card` 毛玻璃 |
| 人物头像叠层 | `home.vue` `.banner-avatar-wrap` | 圆形 `border-radius: 50%` + `border: 4rpx solid $by-gold` + 左侧绝对定位 |
| 金边 CTA 按钮 | `home.vue` `.banner-cta` | `background: linear-gradient(180deg, $by-gold 0%, $by-gold-soft 100%); color: $by-bg;` |

**验证方法**：
1. 启动移动端 `npm run dev:h5` → 首页
2. 第一张 Banner「净化网络 · 举报违规」第二张「组局新玩法」均使用极光渐变 + 金边卡片
3. 截图与素材对比：色值 `#7b61ff #b57bff #d4af37` 三者必须可被拾色器检出

---

### 素材 2：`378849617002ad354923701552859204.jpg` — 发现页 4 Tab 布局参考

**素材观察**：
- 顶部 4 个 Tab 横向排列，选中 Tab 文字金色加粗 + **底部金色短下划线**（未填满整格，约文字宽度 60%）
- Tab 下方是瀑布流 / 列表卡片，卡片间距 16rpx
- 右上角有**红色小圆点角标**（对应「新人秀 / 红包」有更新时）
- 空状态有插画 + 浅灰提示语

**代码落地**：

| 提取点 | 实现位置 | 代码片段 / 方法 |
|---|---|---|
| 4 Tab 吸顶 | `app/src/pages/discover/discover.vue` L45-65 `<view class="by-tabs">` | 4 个 `.tab-item`（寻人大厅 / 动态广场 / 同城组局 / 红包签到），`position: sticky; top: 0; z-index: 10;` |
| 金色下划线 | `discover.vue` `.tab-item.active::after` | `content: ''; width: 60%; height: 6rpx; background: $by-gold; border-radius: 3rpx; position: absolute; bottom: 0; left: 20%;` |
| 红点角标 | `discover.vue` `.tab-badge` | `position: absolute; top: -4rpx; right: -10rpx; width: 16rpx; height: 16rpx; background: #ef4444; border-radius: 50%;`（红包专区 Tab 默认挂红点） |
| 卡片流间距 | `discover.vue` `.list-wrap` | `padding: 16rpx; gap: 16rpx;` + 每张卡片 `border-radius: 16rpx;` |
| 空状态 | `discover.vue` `.empty-state` | 插画 `<text class="emoji">🌌</text>` + 文案 `$by-text-mute` 色 + 「去看看」按钮 |

**验证方法**：
1. 进入「发现」页 → 依次点 4 个 Tab
2. 切到「动态广场」时：金色下划线只占 Tab 宽度 60%，不是整格底部横条
3. 「红包专区」Tab 右上角小红点可见

---

### 素材 3：`4ae4ef173d7e29b7fbc0d96f66c6925c.jpg` — 精英会员权益页参考

**素材观察**：
- 顶部大幅「E」字徽章金背景，徽章外圈渐变描边
- 6 项权益**竖排卡片列表**，每项左图标 + 标题 + 副标题
- 「3 大平台保证」独立说明块，图标盾牌样式
- 底部固定「立即开通 ¥30 / 终身」圆角大按钮（金色渐变，白色小字副文案）

**代码落地**：

| 提取点 | 实现位置 | 代码片段 / 方法 |
|---|---|---|
| 金 E 徽章 | `app/src/pages/elite-pay/elite-pay.vue` L50-65 `.elite-badge` | `width: 200rpx; height: 200rpx; border-radius: 50%; background: linear-gradient(135deg, $by-gold 0%, $by-gold-soft 100%); border: 6rpx solid rgba(255,255,255,.2); box-shadow: 0 0 60rpx rgba(212,175,55,.5);` + 中央金色描边 E 字 |
| 6 项权益竖排 | `elite-pay.vue` L80-130 `.rights-list` + `.right-item` | 每项图标 64rpx + flex 布局 + 副标题 `$by-text-mute` |
| 3 大平台保证 | `elite-pay.vue` `.guarantee-block` | 浅金背景 `rgba(212,175,55,.08)` + 圆角 16 + 盾牌 iconfont 前缀 |
| 为什么付费可折叠 | `elite-pay.vue` L160-180 `.why-pay` + `@toggle` | `<view class="arrow" :class="{rotated: expanded}">▾</view>` + CSS `transform: rotate(180deg)` 动画 |
| 底部大 CTA | `elite-pay.vue` `.pay-btn-wrap` + `.pay-btn` | `position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));` 渐变按钮 + 副文案「7 天无理由退款 · 终身有效」 |

**验证方法**：
1. 我的 → 立即开通精英 → 进入页面
2. 顶部 E 徽章大小 ≥ 200rpx，金色渐变+阴影发光效果
3. 下拉可见 6 权益 + 3 保证 + 为什么付费折叠块
4. 底部开通按钮在 iPhone X+ 机型上自动适配安全区（`env(safe-area-inset-bottom)`）

---

### 素材 4：`4fbed1c6794c6aceb1d07c76333950a7.jpg` — 动态发布页参考

**素材观察**：
- 顶部多行文本输入框，提示语「分享此刻心情…」浅灰色
- 下方 9 宫格图片上传占位框（3×3，最后一格是 + 号）
- 底部工具条：🌍 城市标签 + 😊 表情 + 📍 位置 + 「发布」按钮

**代码落地**：

| 提取点 | 实现位置 | 代码片段 / 方法 |
|---|---|---|
| 文本框 500 字上限 | `app/src/pages/post/publish.vue` L42-55 `<textarea>` | `maxlength="500"` + 右下角 `.counter` `current/500` 金色高亮 |
| 9 宫格上传 | `publish.vue` L60-85 `.image-grid` + `.grid-item` | `display: grid; grid-template-columns: repeat(3, 1fr); gap: 16rpx;` + `.add-btn` 「+」按钮，达到 9 张时自动隐藏 |
| 城市标签 | `publish.vue` L95-110 `.toolbar .city-tag` | 点击弹 `uni.showActionSheet` 选择「不展示城市 / 北京 / 上海 / 广州 / 深圳 / 杭州」 |
| 登录守卫 | `publish.vue` `onSubmit()` 顶部 | `if (!userStore.isLogin) { uni.showToast('请先登录'); setTimeout(navigateTo /pages/login/login, 600); return; }` |
| 敏感词前过滤 | `publish.vue` + 后端 `server/src/middleware/sensitive.js` | `POST /api/posts` 前先 `sensitive.detect(text)` → 命中直接 400 返回「内容包含违规词：xxx」 |

**验证方法**：
1. 未登录点「+ 发布动态」→ 弹「请先登录」→ 跳登录页
2. 登录后，文本框输入 501 字 → 无法再输入
3. 上传 9 张图片 → 「+」按钮消失
4. 输入敏感词（如：赌博）→ 点发布 → 立即 toast 拦截，不进审核队列

---

### 素材 5：`561925a2ca6621e0d278e48d28a877e6.jpg` — 个人中心头部参考

**素材观察**：
- 顶部头图：毛玻璃 + **极光渐变叠加**，左下大头像圆形金边
- 头像右上角：金「E」小徽章（精英用户才有）
- 昵称旁：VIP 金色小标签 + 性别 ♂/♀ 图标
- 头图下方：钱包信息三列（💎钻石 / ⭐星币 / 💰收入），每列数字金色加粗

**代码落地**：

| 提取点 | 实现位置 | 代码片段 / 方法 |
|---|---|---|
| 渐变毛玻璃头图 | `app/src/pages/profile/profile.vue` L35-55 `.profile-header` | `background: linear-gradient(135deg, rgba(123,97,255,.3), rgba(181,123,255,.2)), $by-bg-secondary; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);` |
| 金 E 徽章（头像角） | `profile.vue` `.avatar .e-badge` + `v-if="userInfo.isElite"` | `position: absolute; right: -6rpx; bottom: -6rpx; width: 44rpx; height: 44rpx; border-radius: 50%; background: $by-gold; color: $by-bg; font-weight: 900; display: flex; align-items: center; justify-content: center; border: 3rpx solid $by-bg;` |
| VIP / 性别标签 | `profile.vue` `.name-row` | 昵称后 `<text class="vip-tag" v-if="isElite">精英</text>`（金边金底金字） + `<text class="gender male">♂</text>`（蓝 / 粉色） |
| 钱包三列 | `profile.vue` `.wallet-row` | 3 个 `.wallet-cell` flex:1 等分；数字 `font-size: 40rpx; font-weight: 700; color: $by-gold;` |
| 精英入口 CTA | `profile.vue` `.elite-cta` 位于钱包下方 | 未开通：渐变卡片 + 立即开通；已开通：金卡「查看精英权益」→ 跳 elite-pay 页 |

**验证方法**：
1. 使用 13800000001（小鹿同学，精英）登录 → 头像右上角金 E 标出现
2. 钱包三列数字均为金色（#d4af37）
3. 使用 13800000004（柚子，非精英）登录 → 无 E 标，精英 CTA 显示「立即开通，¥30 终身」

---

### 素材 6：`667380c7033f640dd8b587920a29d7f3.jpg` — 组局详情封面参考

**素材观察**：
- 顶部高 400~480rpx 大图：**极光渐变背景** + 中央组局主题字（白色大字号加粗）
- 头图左下角标签云：🏷 密室逃脱 · 🎬 周末 · 👥 4/6 人（圆角 999 半透明胶囊）
- 头图下方「报名进度条」：灰色底 + 金色填充条 + 百分比文字
- 报名人头像墙：圆形头像**从左到右叠加排列**（第二个压第一个 1/3），最多展示 8 个，超出 +N

**代码落地**：

| 提取点 | 实现位置 | 代码片段 / 方法 |
|---|---|---|
| 极光渐变头图 | `app/src/pages/group/detail.vue` L35-60 `.group-cover` | `height: 480rpx; background: $by-gradient-aurora; position: relative;` + 中央 `.cover-title` 48rpx 白粗字 + 毛玻璃遮罩层 |
| 标签云胶囊 | `group/detail.vue` `.tag-cloud` | 多个 `.tag { padding: 8rpx 24rpx; border-radius: 999rpx; background: rgba(0,0,0,.35); backdrop-filter: blur(8px); color: #fff; font-size: 24rpx; margin-right: 16rpx; }` |
| 报名进度条 | `group/detail.vue` `.progress-wrap` + `.progress-bar` | `.progress-bar { height: 16rpx; border-radius: 8rpx; background: rgba(255,255,255,.15); overflow: hidden; } .progress-fill { height: 100%; background: linear-gradient(90deg, $by-gold 0%, $by-gold-soft 100%); transition: width .5s; }` |
| 叠加头像墙 | `group/detail.vue` `.avatar-wall` + `.avatar-stack` | `.avatar-stack { position: relative; display: flex; } .avatar-stack .ava { width: 64rpx; height: 64rpx; border-radius: 50%; border: 4rpx solid $by-bg-secondary; margin-left: -20rpx; } .avatar-stack .ava:first-child { margin-left: 0; }` + 最后 `.more { background: rgba(255,255,255,.1); color: #fff; display:flex;align-items:center;justify-content:center; font-size:22rpx; }` |
| 双 CTA 按钮 | `group/detail.vue` `.cta-row` | 左「💬 联系发起人」次按钮（边框金） / 右「🎯 报名进群」主按钮（金色渐变） |

**验证方法**：
1. 发现 → 同城组局 → 进入任一「剧本杀深夜车」组局
2. 封面渐变拾色必须出现 `#7b61ff` 紫色和 `#ff9fc5` 粉色
3. 进度条填充色为金色（`#d4af37 → #f5d583`），动画从 0 到当前百分比
4. 头像墙：第 2 个头像压在第 1 个上（`margin-left: -20rpx` 生效），最后一位是 +N 更多按钮

---

### 素材 7：`9ee225e9247a3afdda873436c062d136.jpg` — 动态卡片 UI 参考

**素材观察**：
- 左头像（圆形，金边）+ 右上昵称 + 时间 + 城市小地标 + 举报「···」
- 中间正文：深灰文字（≤ 3 行自动截断，超出「展开」按钮）
- 下方 9 图缩略：`grid-template-columns: repeat(3,1fr)`，单图时变 16:9 大图
- 底部操作栏：❤️ 点赞数 / 💬 评论数 / 📤 分享，图标 + 数字

**代码落地**：

| 提取点 | 实现位置 | 代码片段 / 方法 |
|---|---|---|
| 头像 + 昵称行 | `app/src/pages/discover/discover.vue` `.post-card .post-head` | flex 布局，`.ava { width: 80rpx; height: 80rpx; border-radius: 50%; border: 3rpx solid rgba(212,175,55,.5); }` + `.nickname { color:$by-text-1; font-weight: 600; font-size: 28rpx; }` + `.city { color: $by-text-mute; font-size: 22rpx; }` |
| 正文 3 行截断 | `discover.vue` `.post-text` | `font-size: 28rpx; line-height: 1.6; color: $by-text-1; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;` + 超过 3 行显示 `展开`（toggle `expanded` 状态） |
| 9 图缩略 | `discover.vue` `.post-images` | `grid-template-columns: repeat(3, 1fr); gap: 6rpx;` 图片 `aspect-ratio: 1; object-fit: cover; border-radius: 12rpx;` + 单图时特殊类 `.post-images.single img { aspect-ratio: 16/9; grid-column: 1 / -1; }` |
| 底部操作栏 | `discover.vue` `.post-actions` | 3 栏 flex:1，`.action-item { display: flex; align-items: center; justify-content: center; gap: 8rpx; color: $by-text-mute; font-size: 24rpx; } .action-item.liked { color: #ef4444; }`（点赞后红色爱心） |
| 举报入口 ··· | `discover.vue` `.more-btn` + `@click` | 右上角三个点 → `uni.showActionSheet({ itemList: ['举报该动态', '不感兴趣', '复制内容'] })` → 举报 → 跳反馈页并自动填入动态 ID |

**验证方法**：
1. 发现 → 动态广场 → 滚动前 5 条动态
2. 长文动态（> 3 行）显示「展开」→ 点击展开全文 → 显示「收起」
3. 9 图动态缩略图为正方形 3×3 网格，单图动态为 16:9 横大图
4. 点赞：空心 ❤️ 点 → 变实心红色 ❤️ + 数字 +1（后端 `POST /api/posts/:id/like`）

---

### 素材 8：`b3aa58a457966267d08cfdb2689e9cfd.jpg` — 聊天精英守卫弹窗参考

**素材观察**：
- 弹出 Modal 居中，**金边金阴影 + 圆角 24**
- 顶部大号 E 徽章 + 标题「开通白夜精英 · 畅聊无限制」
- 要点列表 3 条：✅ 无限制私聊 / ✅ 查看真人微信 / ✅ 组局优先展示
- 底部双按钮：左「稍后再说」（灰色空心）/ 右「立即开通 ¥30」（金色渐变实底）
- 左上角「×」关闭按钮

**代码落地**：

| 提取点 | 实现位置 | 代码片段 / 方法 |
|---|---|---|
| 弹窗触发时机 | `app/src/pages/chat/chat.vue` `sendMessage()` 顶部守卫 | `if (!userStore.isElite && firstTime && !对方回复过) { showGuardModal.value = true; return; }`（首次主动私聊精英才弹，对方先回复则不打扰） |
| 金边 Modal | `chat.vue` `<view class="guard-mask" v-if="showGuardModal">` + `.guard-card` | `.guard-card { width: 80%; max-width: 640rpx; background: $by-bg-secondary; border: 3rpx solid rgba(212,175,55,.6); border-radius: 24rpx; box-shadow: 0 20rpx 60rpx rgba(212,175,55,.3); padding: 40rpx; }` |
| E 徽章 | `chat.vue` `.guard-card .big-e` | 同素材 3，尺寸 140rpx，居中显示 |
| 3 条权益勾 | `chat.vue` `.guard-tips` | 每条前缀 ✅ emoji + 28rpx 正文，3 行 |
| 双按钮 | `chat.vue` `.guard-btns` | flex row gap 24rpx，`.btn-secondary { flex:1; border: 2rpx solid $by-border; color: $by-text-mute; border-radius: 999rpx; padding: 20rpx; }` / `.btn-primary { flex: 1.6; background: $by-gradient-gold; color: $by-bg; border-radius: 999rpx; padding: 20rpx; font-weight: 700; }` |
| × 关闭 | `chat.vue` `.close-x` | 右上角绝对定位 44×44rpx，`font-size: 36rpx; color: $by-text-mute;` → 点击设置 `showGuardModal=false` |

**验证方法**：
1. 用 13800000004（非精英）登录 → 消息列表 → 点击 13800000001（精英）→ 首次发送输入内容 → 发送
2. 弹出守卫弹窗（金边 + E 徽章 + 3 权益勾 + 双按钮）
3. 点「稍后再说」→ 弹窗关闭，消息**未发送**（引导成功）
4. 点「立即开通」→ 跳转到精英付费页（`/pages/elite-pay/elite-pay`）
5. 对方先回复自己（或已开通精英后）→ 再次发送 → 不弹守卫，消息正常走 WebSocket

---

### 素材 9：`b888ef3a55af5ade422f2818a4936f45.jpg` — TabBar 图标风格参考

**素材观察**：
- 4 个底部 Tab：首页（🏠 房子）/ 发现（🧭 指南针）/ 消息（💬 聊天气泡）/ 我的（👤 人像）
- **未选中态**：细金色线条描边图标，`1.5px` 宽，色 `#8a7a3a`（暗金）
- **选中态**：**2.5px 粗金线 + 极光描边发光**（`#d4af37` 金 + 外圈 `#b57bff` 紫光晕）
- 图标下方文字：未选中暗灰 / 选中金色加粗

**代码落地**：

| 提取点 | 实现位置 | 代码片段 / 方法 |
|---|---|---|
| 4×2 PNG 生成 | `scripts/generate-icons.js` L300-460 4 个函数：`drawHomeIcon / drawDiscoverIcon / drawMessageIcon / drawProfileIcon` | 使用 Canvas（node-canvas 或 SVG fallback）批量生成 8 张 PNG：`tab-home.png / tab-home-active.png` × 4 Tab，尺寸 81×81px，分辨率 `@2x` |
| 未选中描边色 | `generate-icons.js` `.strokeStyle = '#8a7a3a'` | 线条宽 1.5px，圆角端点 `lineCap = 'round'` |
| 选中发光效果 | `generate-icons.js` `.shadowColor = '#b57bff'` + `.shadowBlur = 8` + `.strokeStyle = '#d4af37'` | 线条宽 2.5px，先画极光外发光层再画金实线 |
| pages.json 配置 | `app/src/pages.json` L15-45 `tabBar.list[4]` | `iconPath: /static/tabbar/tab-home.png` + `selectedIconPath: /static/tabbar/tab-home-active.png`，4 组对应；`color: '#8a7a3a'` + `selectedColor: '#d4af37'` |
| 图标完整性校验 | `scripts/generate-icons.js --check` | 读取 manifest.json 中所有 icon 路径，逐一 `fs.existsSync` 验证不存在缺失，输出 `OK: 43/43 icons exist` |

**验证方法**：
1. 执行 `node scripts/generate-icons.js --check` → 输出 OK
2. H5 预览 / App 真机 → 底部 TabBar 4 项
3. 切到「发现」Tab：图标从暗金细线 → 粗金 + 紫色发光（放大 400% 截图可见紫色阴影）
4. 图片文件实际校验：`ls app/src/static/tabbar/` → 8 张 PNG：`tab-{home,discover,message,profile}{-active,}.png`

---

### 素材 10：`c7336999f91b7da1a1b329c76472a0e9.jpg` — 充值页钻石卡参考

**素材观察**：
- 6 张钻石卡（¥6 / ¥18 / ¥30 / ¥68 / ¥128 / ¥328）**两列三行网格**
- 每张卡：左上 💎 钻石大图标（金色边框 + 渐变蓝白色钻石本体）
- 右上：钻石数量（金色加粗数字 + 「+额外送 XXX」红字角标，¥30 以上档）
- 下方：价格标签（¥ + 数字大字号）
- 选中态：卡片边框变金色渐变 + 右上角金色「✓」小勾 + 阴影放大

**代码落地**：

| 提取点 | 实现位置 | 代码片段 / 方法 |
|---|---|---|
| 6 档位两列网格 | `app/src/pages/recharge/recharge.vue` L50-90 `.packs-grid` | `display: grid; grid-template-columns: repeat(2, 1fr); gap: 24rpx;` + `.pack-card { border-radius: 20rpx; background: $by-bg-card; border: 2rpx solid $by-border; padding: 28rpx; transition: all .2s; }` |
| 💎 钻石图标 | `recharge.vue` `.diamond-icon` | 自定义 CSS 钻石图形（或 SVG base64）+ `width: 72rpx; height: 72rpx; border: 3rpx solid $by-gold; border-radius: 50%; background: linear-gradient(135deg, #e0f2fe 0%, #93c5fd 100%); display:flex;align-items:center;justify-content:center;` |
| 红字赠送角标 | `recharge.vue` `.bonus-tag` | `position: absolute; top: 12rpx; right: 12rpx; background: rgba(239,68,68,.12); color: #ef4444; font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 999rpx; font-weight: 600;` + `v-if="pack.bonus"` |
| 金色选中态 | `recharge.vue` `.pack-card.selected` | `.pack-card.selected { border-color: transparent; background-image: linear-gradient($by-bg-card, $by-bg-card), $by-gradient-gold; background-origin: border-box; background-clip: padding-box, border-box; box-shadow: 0 10rpx 30rpx rgba(212,175,55,.3); transform: translateY(-4rpx); }` 渐变描边技巧 |
| 选中 ✓ 角标 | `recharge.vue` `.selected-mark` | `position: absolute; top: -6rpx; right: -6rpx; width: 44rpx; height: 44rpx; border-radius: 50%; background: $by-gold; color: $by-bg; display:flex;align-items:center;justify-content:center; font-weight: 900; border: 3rpx solid $by-bg;` + `v-if="selected"` |

**验证方法**：
1. 我的 → 钻石余额 → 充值 → 进入充值页
2. 6 档卡片 2 列排列，每档左上角💎图标金边框
3. ¥30 / ¥68 / ¥128 / ¥328 档右上角出现红色「+送 XXX 💎」角标
4. 点击任一卡片 → 边框渐变金 + 上浮 4rpx + 右上角金 ✓ 出现
5. 再次点同一卡片取消选中（如交互设为单选，保持单选验证）

---

## 设计 Token 统一索引（所有素材共用）

为了确保 10 张素材提取的配色在全项目一致，所有落地文件均引用 `app/src/uni.scss` 中以 `$by-*` 为前缀的变量（禁止硬编码色值，便于将来品牌二次升级）。

| 变量名 | 值 | 使用场景（对应素材 #）|
|---|---|---|
| `$by-bg` | `#0b0f1a` 午夜蓝底 | 所有页面 body 背景（#1~#10 全）|
| `$by-bg-secondary` | `#141a2d` 深蓝次底 | 卡片 / TabBar 底色（#1 #2 #5 #7 #8）|
| `$by-bg-card` | `#1a2238` 卡片蓝 | 动态卡片 / 充值卡 / 权益卡（#3 #5 #7 #10）|
| `$by-gold` | `#d4af37` 主金 | 按钮 / 选中 / E 徽章主色（#1 #3 #5 #6 #8 #9 #10）|
| `$by-gold-soft` | `#f5d583` 软金 | 金色渐变终点 / 弱高亮（#1 #3 #6 #9 #10）|
| `$by-gradient-gold` | `linear-gradient(180deg, $by-gold, $by-gold-soft)` | CTA 按钮渐变（#3 #6 #8 #10）|
| `$by-gradient-aurora` | `linear-gradient(135deg, #7b61ff, #b57bff, #ff9fc5)` | 极光渐变 Banner / 封面 / 选中描边（#1 #2 #5 #6 #9）|
| `$by-text-1` | `#f5f7ff` | 昵称 / 正文 / 标题（#2 #4 #5 #7 #10）|
| `$by-text-mute` | `#4a5476` 辅助灰 | 时间 / 城市 / 副文案（#2 #5 #7 #8）|
| `$by-border` | `rgba(255,255,255,0.08)` | 细边框 / 分割线（#2 #7 #10）|

---

## 迭代维护指南

后续如果替换 `sucai/` 中的素材或追加新参考图，请按以下步骤更新本文档：

1. **新增素材**：将文件放入 `sucai/` 目录 → 在「目录速查」表追加一行 → 在「逐张详细映射」追加对应小节（至少包含：素材观察 4 点 + 代码落地 4 行 + 验证方法 3 步）
2. **修改配色**：不要改各页面硬编码色值，改为修改 `app/src/uni.scss` 的 `$by-*` 变量 → 执行全局搜索确认无残留硬编码 → 运行 `node scripts/generate-icons.js` 重新生成 TabBar 图标
3. **验证变更**：修改后必跑
   ```bash
   node scripts/generate-icons.js --check   # TabBar 图标没断链
   node scripts/rebrand-baiye.js --check     # 没有旧品牌词残留
   cd server && npm test                      # 后端没挂
   ```
4. **设计评审材料**：每次视觉改版，将「新旧截图对比 + 本文档映射表」打包发给产品确认，避免出现「素材和实现对不上」的返工。

---

**文档结束。**

版本历史：
- v1.0.0（2026-08-27）：初稿，随品牌重命名计划创建
- v2.0.0（2026-08-28）：正式版，覆盖 10 张素材完整映射 + 设计 token 索引 + 维护指南
- v2.1.0（2026-09-05）：品牌定位更新，产品从“付费陪玩陪聊平台”统一为“同城聊天交友社交平台”
