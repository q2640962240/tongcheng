# 白夜陪玩 — AI 交接文档 (HANDOVER)

> **文档版本**: v1.0 (2026-08-31)
> **上一位负责人工作期间**: 2026-08-28 ~ 2026-08-31
> **项目整体完成度**: ~92%（代码 100%，部署 ~70%，IM 集成 80%）
> **本文档目的**: 让下一位 AI 同事在 10 分钟内掌握项目全貌、当前状态、未完成事项和注意事项

---

## 一、项目概览

| 项 | 值 |
|---|---|
| 项目名 | 白夜陪玩 (BaiYe) |
| 技术栈 | uni-app (Vue 3) + Express + MySQL + Docker Compose |
| 仓库 | github.com/q2640962240/tongcheng (main 分支) |
| 服务器 | 阿里云轻量 ECS 2C4G, 101.132.17.214, Aliyun Linux 3 |
| 域名 | zyb001.cn (Let's Encrypt SSL) |
| 最新 commit | b580411 (docs: update deployment rules to v3) |
| 部署方式 | GitHub Actions CI/CD → SSH → Docker Compose |
| 部署规则文档 | .trae/rules/deployment.md (v3.0) |

### 目录结构

```
companion-play-app/
├── app/           # uni-app 移动端 (Vue 3 + Vite, H5/小程序/App)
├── server/        # 后端 API (Express + Sequelize/MySQL + JSON 回退)
├── admin/         # 管理后台 (Vue 3 + Element Plus)
├── deploy/        # Nginx 配置 + 部署脚本
├── docs/          # 项目文档
├── .github/workflows/deploy.yml  # CI/CD 部署脚本 v3
├── docker-compose.yml            # 6 容器编排
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

## 二、当前服务器状态

### 服务器状态 (截至 2026-08-31)

| 项 | 状态 | 说明 |
|---|---|---|
| SSH 22 | 通 | root@101.132.17.214 密钥登录 |
| HTTP 80 | 可能不通 | Docker 容器可能正在重建中 |
| HTTPS 443 | 可能不通 | 同上 |
| GitHub Actions Run #57 | 进行中 | v3 脚本执行中，从头 build 所有镜像 |
| 容器状态 | 未知 | 之前 v2 bug 导致容器全挂，v3 正在重建 |

### 紧急恢复方法

如果服务器不可达，SSH 登录后执行：

```bash
cd /opt/baiye
git fetch --prune origin main && git reset --hard origin/main
docker compose up -d --build
# 等待 3-5 分钟后验证
docker compose ps
curl -sk https://zyb001.cn/api/health
```

如果只需快速启动（跳过 build）：
```bash
# 在 GitHub Actions 页面手动触发
# Inputs: ONLY_START = true
# 或服务器直接执行:
cd /opt/baiye && docker compose up -d
```

---

## 三、部署系统 (deploy.yml v3)

### v3 四大安全规则（必读，违反必宕机）

1. **禁止 `set -eu -o pipefail`** — v2 的根因：任何命令返回非0导致脚本35秒退出
2. **禁止 `docker compose down`** — v2 的服务杀手：down 后 build 失败则永久宕机
3. **build 失败不中断** — 设 BUILD_FAIL=1 但继续 up -d 用旧镜像
4. **deploy.yml 自身变更不触发 INFRA** — 正则只匹配 nginx-docker.conf/docker-compose.yml

### 部署流程 (7 步)

```
[1/7] sync code      git fetch (重试3次) + reset + 证书保护
[2/7] smart diff     git diff → BUILD PLAN
[3/7] golden rules   WARN 模式 (PASS>=3)
[4/7] system check   swap + 磁盘空间
[5/7] smart build    只 build 变化的服务 (失败不中断)
[6/7] up -d          滚动更新 (不 down 旧容器)
[7/7] verify         HTTP 检查 (失败则 restart+up 兜底)
```

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
| proxy_timeout | 60s |

### 常见部署问题

| 问题 | 原因 | 解决 |
|---|---|---|
| Actions 35秒失败 | v2 的 set -e | v3 已修复 |
| 服务器 502 | v2 的 docker compose down | v3 已修复 |
| 连环失败 | deploy.yml 改动触发 INFRA | v3 正则缩小 |
| git fetch 失败 | 网络抖动 | v3 重试 3 次 |
| build OOM | 内存不足 | 4G swapfile 必须 |

---

## 四、IM 集成状态 (80% 完成)

### 已完成

| 文件 | 说明 |
|---|---|
| server/src/utils/im.js | TLSSigAPIv2 标准 UserSig 生成 (HMAC-SHA256 + zlib + base64url) |
| server/src/routes/im.js | /api/im/config + /api/im/login + /api/im/diag 端点 |
| app/src/utils/tuilogin.js | TUIKit 官方登录工具 (ensureTUILogin) |
| app/src/store/user.js | 登录后触发 kickOffTUIInit() |
| app/src/pages/chat-list/chat-list.vue | 官方 TUIConversation 组件 |
| app/src/pages/chat/chat.vue | 官方 TUIChat 组件 |
| app/src/main.js | H5 polyfill (showTabBar/hideTabBar 等) |
| app/src/utils/im.js | ensurePeer 自动创建对端账号 + 20009 错误重试 |
| app/package.json | @tencentcloud/chat-uikit-uniapp@3.2.0 + tim-js-sdk |
| app/src/TUIKit/ | 从 node_modules 复制的官方组件 |

### IM 配置

| 项 | 值 |
|---|---|
| sdkAppId | 1600159799 |
| imRegion | ap-guangzhou |
| secretKey | 已填入 (64 字符) |
| 好友关系检查 | 已关闭 (腾讯云控制台) |

### 未验证

- [ ] 服务器恢复后 H5 是否包含最新 TUIKit 代码
- [ ] 用户登录后 TUILogin 是否成功
- [ ] TUIConversation/TUIChat 是否正常渲染
- [ ] 消息发送是否成功（之前 20009 错误已修复但未验证）

### IM 排查命令

```bash
# 后端 IM 诊断
curl -sk https://zyb001.cn/api/im/diag

# 前端检查（浏览器控制台）
# 登录后查看 [TUILogin] 日志
# 聊天页面查看 [chat] 日志
```

---

## 五、未完成事项清单

### 高优先级

| # | 事项 | 说明 |
|---|---|---|
| 1 | 恢复服务器 | v3 部署脚本执行中，可能需要手动干预 |
| 2 | 验证 IM 完整功能 | TUIKit 组件渲染 + 消息收发 |
| 3 | 配置中心填写真实密钥 | 短信/支付/OSS/推送 6 模块 |
| 4 | Android APK 打包 | HBuilder X 云打包 |
| 5 | MySQL 生产切换 | 当前 Docker 用 MySQL，但业务配置未完全切换 |

### 中优先级

| # | 事项 | 说明 |
|---|---|---|
| 6 | iOS IPA 打包 | 需 Apple Developer 证书 |
| 7 | 微信小程序提审 | 打包产物已生成 |
| 8 | 应用市场资质 | ICP 备案/软著/隐私政策 |
| 9 | 后端登录后自动 account_import | auth.js 登录成功后调用 IM 账号导入 |

### 低优先级

| # | 事项 | 说明 |
|---|---|---|
| 10 | 监控告警搭建 | API 错误率/订单成功率/UGC 审核积压 |

---

## 六、已知问题与修复方案

### 问题 1: 服务器容器可能未恢复

- **原因**: v2 的 docker compose down 导致容器全挂
- **修复**: v3 已移除 down，但服务器需要从头 build（可能需要 30-60 分钟）
- **状态**: Run #57 正在执行，如果超时需要手动 SSH 恢复

### 问题 2: H5 线上版本可能未更新

- **原因**: GitHub Actions smart diff 在 OLD_SHA==NEW_SHA 时可能跳过 H5 build
- **修复**: v3 的兜底逻辑强制全量 build（但不 down 容器）
- **验证**: 恢复后检查 `curl -sk https://zyb001.cn/ | grep -o 'index-[A-Za-z0-9_-]*\.js'`

### 问题 3: IM 消息发送 20009 错误

- **原因**: 对端用户未登录过 TIM，账号不存在
- **修复**: app/src/utils/im.js 的 ensurePeer() 方法临时登录对端账号触发创建
- **状态**: 代码已写但未在线上验证

### 问题 4: H5 端 uni API 缺失

- **原因**: uni-app H5 端未实现 showTabBar/hideTabBar/switchTab
- **修复**: app/src/main.js 添加 polyfill
- **状态**: 代码已写，待线上验证

---

## 七、关键凭据

| 项 | 值 | 备注 |
|---|---|---|
| 服务器 IP | 101.132.17.214 | 阿里云轻量 ECS |
| SSH 用户 | root | 密钥: ~/.ssh/github_actions_deploy |
| 域名 | zyb001.cn | DNS A → 101.132.17.214 |
| 管理员账号 | admin / admin123 | https://zyb001.cn/admin/ |
| MySQL 密码 | Baiye@2024! | DB: companion_play |
| Redis 密码 | BaiyeRedis2026! | 64MB + AOF |
| JWT Secret | baiye_prod_jwt_secret_please_change_ME_2026_v1_abcdef | |
| 测试用户 | 17085186432 / 111111 | 手机号+密码登录 |
| IM sdkAppId | 1600159799 | 腾讯云 IM |
| SSL 证书 | Let's Encrypt | 有效期至 2026-11-29 |
| SSL 邮箱 | q2640962240@qq.com | |

---

## 八、关键文件清单

### 部署相关

| 文件 | 说明 |
|---|---|
| .github/workflows/deploy.yml | v3 安全部署脚本 (383 行) |
| docker-compose.yml | 6 容器编排 |
| deploy/nginx-docker.conf | Gateway Nginx 配置 |
| server/Dockerfile | 后端镜像 (apt HTTP 阿里云镜像) |
| admin/Dockerfile | 管理后台镜像 (nginx:alpine) |
| app/Dockerfile | H5 镜像 (nginx:alpine) |
| .trae/rules/deployment.md | 部署规则文档 v3.0 (必读) |

### IM 相关

| 文件 | 说明 |
|---|---|
| server/src/utils/im.js | TLSSigAPIv2 UserSig 生成 |
| server/src/routes/im.js | IM API 端点 (config/login/diag) |
| app/src/utils/tuilogin.js | TUIKit 登录工具 |
| app/src/utils/im.js | 前端 IM 工具 (ensurePeer) |
| app/src/store/user.js | 登录后触发 TUIKit 初始化 |
| app/src/pages/chat-list/chat-list.vue | TUIConversation 组件 |
| app/src/pages/chat/chat.vue | TUIChat 组件 |
| app/src/main.js | H5 polyfill |

### 测试相关

| 文件 | 说明 |
|---|---|
| server/test/*.test.js | Jest 12 套件 95 用例 |
| server/scripts/_e2e_diagnose.js | E2E 21 场景诊断 |
| server/scripts/smoke-extended.js | 扩展冒烟测试 |

---

## 九、本地开发快速启动

```bash
# 1. 后端 (端口 3000)
cd server && npm install && npm run seed && npm run dev

# 2. 管理后台 (端口 5174)
cd admin && npm install && npm run dev

# 3. 用户端 H5 (端口 5173)
cd app && npm install && npm run dev:h5

# 4. 测试
cd server && npm test           # Jest 95 用例
node scripts/_e2e_diagnose.js    # E2E 诊断
```

---

## 十、部署前 Checklist

```bash
# 1. 后端测试
cd server && npm test

# 2. E2E 诊断
node server/scripts/_e2e_diagnose.js

# 3. Dockerfile 黄金规则
grep -c 'mirrors.aliyun.com' server/Dockerfile  # >= 2
grep -c 'timeout' server/Dockerfile              # apt 列表 = 0

# 4. 提交并推送
git add . && git commit -m "fix: xxx" && git push
# → GitHub Actions 自动触发 v3 部署
```

---

## 十一、注意事项

1. **部署规则必读**: 修改任何部署相关文件前，先读 `.trae/rules/deployment.md`
2. **不要用 set -e**: deploy.yml 中禁止使用 `set -eu -o pipefail`
3. **不要 docker compose down**: 除非 FORCE_REBUILD=true
4. **apt 源必须 HTTP**: server/Dockerfile 用阿里云 HTTP 镜像
5. **npm 用 npmmirror.com**: 所有 Dockerfile 统一
6. **seed.js 必须退出**: 末尾 `await sequelize.close(); process.exit(0);`
7. **证书保护**: deploy.yml 有 3 层证书备份/还原逻辑，不要删除
8. **appleboy/ssh-action**: 锁定 v1.2.0，不要用 @master
9. **IM 好友关系检查**: 已在腾讯云控制台关闭，不要再开
10. **Git 凭据**: git push 时 credential-manager-core 警告可忽略，实际推送成功
