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
- **动画**: GiftAnimation 组件，4级效果 (L0无/L1小飘/L2横幅/L3全屏)
- **经济**: 钻石(充值) → 送礼消耗 → 收礼获 giftIncome(分) → 提现
- **关键文件**: `server/src/routes/gifts.js`, `app/src/components/GiftPanel.vue`, `app/src/components/GiftAnimation.vue`

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
2. 配置中心填写真实密钥 (短信/支付/OSS/推送)
3. 钻石充值接入微信/支付宝支付
4. 礼物素材正式设计 (当前 emoji 占位)
5. 会话列表深色主题适配

## 文档索引

| 文件 | 说明 |
|---|---|
| `docs/HANDOVER.md` | **完整交接文档 (必读)** |
| `docs/PROJECT.md` | 详细项目文档 |
| `docs/BRAND-REFERENCE.md` | 品牌规范 |
| `.trae/rules/deployment.md` | 部署规则 v3.0 |

---

*最后更新: 2026-09-06*
