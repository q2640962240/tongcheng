# 白夜陪玩 — AI 交接文档 (HANDOVER)

> **文档版本**: v2.0 (2026-09-02)
> **项目整体完成度**: ~95%（代码 100%，部署 100%，IM 95%）
> **本文档目的**: 让下一位 AI 同事在 10 分钟内掌握项目全貌、当前状态、未完成事项和注意事项

---

## 一、项目概览

| 项 | 值 |
|---|---|
| 项目名 | 白夜陪玩 (BaiYe) |
| 技术栈 | uni-app (Vue 3) + Express + MySQL + Docker Compose |
| 仓库 | github.com/q2640962240/tongcheng (main 分支) |
| 服务器 | 阿里云 ECS 2C4G, **114.55.225.77**, Aliyun Linux 3 |
| 域名 | zyb001.cn (Let's Encrypt SSL, 有效至 2026-11-29) |
| 部署方式 | GitHub Actions CI/CD → SSH → Docker Compose |
| 部署规则文档 | .trae/rules/deployment.md (v3.0) |
| 线上地址 | https://zyb001.cn (H5) / https://zyb001.cn/admin/ (管理后台) |

### 目录结构

```
companion-play-app/
├── app/           # uni-app 移动端 (Vue 3 + Vite, H5/小程序/App)
├── server/        # 后端 API (Express + Sequelize/MySQL + JSON 回退)
├── admin/         # 管理后台 (Vue 3 + Element Plus)
├── deploy/        # Nginx 配置 + 部署脚本 + 证书
├── docs/          # 项目文档 (本文档在此)
├── scripts/       # 工具脚本 (图标生成/品牌重命名/测试账号)
├── sucai/         # 用户提供的项目参考素材 (10张JPG)
├── assets/        # 头像/登录页素材 (4张JPG)
├── .github/workflows/deploy.yml  # CI/CD 部署脚本 v3
├── docker-compose.yml            # 6 容器编排
├── 51ec7a4ebd7c73d56a83cbedcef03a06.keystore  # Android 签名密钥
└── .trae/rules/deployment.md     # 部署规则 (必读)
```

### 6 容器拓扑

```
公网 80/443 → [gateway] nginx:1.27-alpine
                  |
        +---------+---------+
        v         v         v
   [admin]     [h5]     [server] node:20-slim:3000
                              |
                    +---------+---------+
                    v                   v
               [mysql:8.0]         [redis:7-alpine]
```

---

## 二、服务器状态 (截至 2026-09-02)

| 项 | 状态 |
|---|---|
| SSH | root@114.55.225.77 密钥登录 (`~/.ssh/tongcheng.pem`) |
| HTTPS | https://zyb001.cn → 200 OK |
| API | https://zyb001.cn/api/health → `{"status":"ok","driver":"mysql","dbOk":true}` |
| 容器 | 6 个全部运行 (gateway, server, admin, h5, mysql, redis) |
| 种子数据 | 11 用户, 15 服务, 1 管理员, 14 分类, 3 Banner, 11 帖子, 55 配置 |
| 部署目录 | /opt/baiye |

### 紧急恢复

```bash
SSH 登录后:
cd /opt/baiye
git fetch --prune origin main && git reset --hard origin/main
docker compose up -d --build
# 等待 3-5 分钟后验证
docker compose ps
curl -sk https://zyb001.cn/api/health
```

---

## 三、聊天架构 (双模 — 重要)

这是项目最复杂的模块，务必仔细阅读。

### 架构总览

```
用户进入聊天
  ├─ chat.vue onLoad → ensureTUILogin (8s 超时)
  │   ├─ 成功 → 跳转官方 TUIChat 页面 (主通道)
  │   └─ 失败 → 降级到自建 Socket.IO 聊天 (兜底)
  │
  消息 Tab (TUIConversation)
  ├─ 官方会话列表组件
  ├─ onLoad → ensureTUILogin → TUIChatKit.init → getConversationList
  └─ 进入会话 → switchConversation + setMessageRead (清未读)
```

### 关键文件

| 文件 | 说明 |
|---|---|
| `app/src/utils/tuilogin.js` | TUILogin 工具：GET /im/config → POST /im/login → TUILogin.login，轮询 isReady |
| `app/src/utils/msgNotify.js` | 全局角标 + 震动管理，监听 conversationList 计算未读总数 |
| `app/src/utils/chatSocket.js` | 自建 Socket.IO 聊天通道 (兜底) |
| `app/src/pages/chat/chat.vue` | 聊天入口：尝试 TUIChat → 降级自建 |
| `app/src/pages/chat-list/chat-list.vue` | 消息 Tab：官方 TUIConversation 组件 |
| `app/src/TUIKit/` | 官方 TUIKit 源码 (从 chat-uikit-uniapp 3.2.0 复制) |
| `app/src/TUIKit/components/TUIConversation/conversation-list/index.vue` | 会话列表：点击时调 setMessageRead 清未读 |
| `app/src/TUIKit/components/TUIConversation/index.vue` | TUIConversation 入口：onShow 刷新角标 |
| `app/src/TUIKit/components/TUIChat/entry-chat-only.ts` | TUIChat 入口：await ensureTUILogin → 轮询 isReady → switchConversation |
| `server/src/routes/chat.js` | 后端聊天路由 + forwardToIM 桥接 |
| `server/src/routes/im.js` | IM 配置/登录/诊断端点 |
| `server/src/utils/im.js` | TLSSigAPIv2 UserSig 生成 + IM v4 REST (sendIMC2CTextV4 等) |

### 数据流

```
发送消息 (TUIKit)
  → TIM SDK → 腾讯 IM 云 → 对方
  → CONVERSATION_LIST_UPDATED 事件 → im-sync POST → /api/chat/im-sync → DB

发送消息 (自建/AI)
  → POST /api/chat → DB
  → forwardToIM → IM v4 REST (console.tim.qq.com) → 腾讯 IM 云 → 对方

AI 自动回复
  → 后端检测消息 → AI 生成回复 → v4 REST 以 AI 用户身份发送
```

### IM 配置

| 项 | 值 |
|---|---|
| sdkAppId | 1600159799 |
| adminUserId | 'administrator' |
| imRegion | ap-guangzhou |
| 好友关系检查 | 已关闭 (腾讯云控制台) |

### 两个非显而易见的坑

1. **Lite SDK 的 totalUnreadCount 不可靠**: `setMessageRead` 后 watch 不一定重新触发。解决方案：用 `conversationList[].unreadCount` 求和代替（见 msgNotify.js 的 `computeUnread`）。

2. **非 Tab 页调 setTabBarBadge 是空操作**: 从 TUIChat 页面（非 Tab）返回消息 Tab 时，角标不会自动更新。解决方案：在 TUIConversation 的 `onShow` 钩子里调 `refreshMsgBadge()`。

3. **v4 REST identifier 必须是管理员账号**: 否则报 60010。实际发送者在 body `From_Account` 字段。

4. **H5 端 uni 路由 API 缺失**: `window.uni` 无 navigateTo/showTabBar 等。修复在 `app/src/main.js` 的 `_tuiPolyfillUni()`，必须用 `window.uni` 而非 `uni`（后者被 vite-plugin-uni 替换）。

---

## 四、部署系统 (deploy.yml v3)

### v3 四大安全规则（必读，违反必宕机）

1. **禁止 `set -eu -o pipefail`** — v2 的根因：任何命令返回非0导致脚本35秒退出
2. **禁止 `docker compose down`** — v2 的服务杀手：down 后 build 失败则永久宕机
3. **build 失败不中断** — 设 BUILD_FAIL=1 但继续 up -d 用旧镜像
4. **deploy.yml 自身变更不触发 INFRA** — 正则只匹配 nginx-docker.conf/docker-compose.yml

### 手动触发参数

| 参数 | 说明 |
|---|---|
| GIT_RESET_MODE | hard/mixed/keep (默认 hard) |
| ONLY_START | true = 跳过 build，只 up -d |
| FORCE_REBUILD | true = 全量重建 (会 down 容器，慎用) |

### 关键配置

| 项 | 值 |
|---|---|
| GitHub Secrets | SERVER_HOST, SERVER_PORT, SERVER_USER, SERVER_SSH_KEY |
| SSH 密钥 | ~/.ssh/github_actions_deploy (ed25519) |
| appleboy/ssh-action | 锁定 v1.2.0 (不要用 @master) |
| command_timeout | 720m (12 小时) |

---

## 五、未完成事项

### 高优先级

| # | 事项 | 说明 |
|---|---|---|
| 1 | Android APK 打包 | HBuilderX 本地打包（TUIKit 需本地编译，云打包可能缺依赖） |
| 2 | 配置中心填写真实密钥 | 短信/支付/OSS/推送 4 模块 (管理后台 → 系统设置) |
| 3 | APK 震动测试 | msgNotify.js 的震动功能需真机验证 |

### 中优先级

| # | 事项 | 说明 |
|---|---|---|
| 4 | iOS IPA 打包 | 需 Apple Developer 证书 |
| 5 | 微信小程序提审 | 打包产物已生成 |
| 6 | 应用市场资质 | ICP 备案/软著/隐私政策 |
| 7 | 会话列表深色主题适配 | 贴合白夜午夜蓝风格 |

### 低优先级

| # | 事项 | 说明 |
|---|---|---|
| 8 | 监控告警搭建 | API 错误率/订单成功率/UGC 审核积压 |

---

## 六、关键凭据

| 项 | 值 | 备注 |
|---|---|---|
| 服务器 IP | **114.55.225.77** | 阿里云 ECS (非轻量) |
| SSH 用户 | root | 密钥: `~/.ssh/tongcheng.pem` |
| 域名 | zyb001.cn | DNS A → 114.55.225.77 |
| 管理员账号 | admin / admin123 | https://zyb001.cn/admin/ |
| MySQL 密码 | Baiye@2024! | DB: companion_play |
| Redis 密码 | BaiyeRedis2026! | 64MB + AOF |
| JWT Secret | baiye_prod_jwt_secret_please_change_ME_2026_v1_abcdef | |
| IM sdkAppId | 1600159799 | 腾讯云 IM |
| SSL 证书 | Let's Encrypt | 有效至 2026-11-29 |

**注意**: 域名和 ECS 在不同阿里云账号下。RAM 子账号 `zyb001` (AccessKeyId: LTAI5t7HzC1KfbpCchhfDe7T) 无法管理 ECS 安全组。

---

## 七、本地开发快速启动

```bash
# 1. 后端 (端口 3000)
cd server && npm install && npm run seed && npm run dev

# 2. 管理后台 (端口 5174)
cd admin && npm install && npm run dev

# 3. 用户端 H5 (端口 5173)
cd app && npm install && npm run dev:h5

# 4. 测试
cd server && npm test           # Jest 测试套件
```

---

## 八、部署前 Checklist

```bash
# 1. 后端测试
cd server && npm test

# 2. 提交并推送
git add . && git commit -m "fix: xxx" && git push
# → GitHub Actions 自动触发 v3 部署

# 3. 验证
curl -sk https://zyb001.cn/api/health
curl -sk https://zyb001.cn/ | grep -o 'index-[A-Za-z0-9_-]*\.js'
```

---

## 九、注意事项

1. **部署规则必读**: 修改任何部署相关文件前，先读 `.trae/rules/deployment.md`
2. **不要用 set -e**: deploy.yml 中禁止使用 `set -eu -o pipefail`
3. **不要 docker compose down**: 除非 FORCE_REBUILD=true
4. **apt 源必须 HTTP**: server/Dockerfile 用阿里云 HTTP 镜像
5. **npm 用 npmmirror.com**: 所有 Dockerfile 统一
6. **seed.js 必须退出**: 末尾 `await sequelize.close(); process.exit(0);`
7. **证书保护**: deploy.yml 有 3 层证书备份/还原逻辑，不要删除
8. **appleboy/ssh-action**: 锁定 v1.2.0，不要用 @master
9. **IM 好友关系检查**: 已在腾讯云控制台关闭，不要再开
10. **cloudSecretId/cloudSecretKey 未配置**: 不要用 TC3 云 API 路径；v4 REST 是可用路径
11. **APK 需本地打包**: TUIKit 需 HBuilderX 本地编译，服务器 H5 部署不影响 APK
12. **Lite SDK 限制**: conversation.lastMessage 无 flow 字段，出站方向需通过 fromAccount === myUserId 判断

---

## 十、文档索引

| 文件 | 说明 |
|---|---|
| `docs/HANDOVER.md` | 本文档 — AI 交接总览 |
| `docs/PROJECT.md` | 详细项目文档 (63KB) |
| `docs/BRAND-REFERENCE.md` | 白夜品牌规范 (午夜蓝×金色×紫极光) |
| `docs/colors_and_type.css` | 品牌色彩/字体 CSS 变量 |
| `docs/companion-play-app.design` | 设计源文件 |
| `docs/APP-PACKAGING-CHECKLIST.md` | APK 打包检查清单 |
| `docs/APP-STORE-CHECKLIST.md` | 应用市场上架检查清单 |
| `docs/PRIVACY-POLICY.md` | 隐私政策模板 |
| `docs/MANUAL-UPLOAD.md` | 手动上传部署指南 |
| `.trae/rules/deployment.md` | 部署规则 v3.0 (必读) |
| `.trae/specs/` | 历史功能规格文档 |

---

## 十一、已验证功能清单

截至 2026-09-02，以下功能已在 H5 端验证通过：

- [x] 用户注册/登录 (手机号+密码)
- [x] 首页浏览 (Banner/分类/服务卡片)
- [x] 服务详情页
- [x] 发现页 (动态广场)
- [x] 消息 Tab (官方 TUIConversation)
- [x] 聊天功能 (TUIKit 主通道 + 自建兜底)
- [x] 未读角标 + 进入清除
- [x] AI 自动回复
- [x] 管理后台 (用户/服务/订单/内容/聊天/设置)
- [x] 种子数据完整
- [x] HTTPS + 自动续期
- [x] Docker 6 容器编排

---

*文档维护：每次重大变更后请更新此文档。*
