# 白夜陪玩 — 部署规则 (DEPLOYMENT RULES)

> **任何对部署相关文件的修改前必须读此文件。所有"踩过的坑"均已记录，重复犯错 = 低级失误。**

---

## §0 部署总览表

| 项 | 值 | 备注 |
|---|---|---|
| 服务器 | 阿里云轻量 ECS 2C4G | 公网 101.132.17.214，Aliyun Linux 3.2104 LTS |
| 服务器 SSH | root@101.132.17.214:22 | 密钥 ~/.ssh/github_actions_deploy (ed25519) |
| 域名 | zyb001.cn + www.zyb001.cn | DNS A -> 101.132.17.214 |
| SSL | Let's Encrypt SAN | /opt/baiye/deploy/certbot/ |
| 部署 | GitHub Actions CI/CD | .github/workflows/deploy.yml |
| 仓库 | github.com/q2640962240/tongcheng | main |
| 服务器路径 | /opt/baiye | git clone 目标 |
| 容器 | Docker Compose (2.29+) | 6 容器 2 网络 |
| 管理员 | admin / admin123 | https://zyb001.cn/admin/ |
| MySQL | Baiye@2024! | DB companion_play |
| Redis | BaiyeRedis2026! | 64MB + AOF |
| JWT | baiye_prod_jwt_secret_please_change_ME_2026_v1_abcdef | — |

---

## §1 6 容器拓扑

公网 -> 80/443 -> [baiye-gateway] nginx:1.27-alpine
                            |
             +--------------+--------------+
             v              v              v
       baiye-admin     baiye-h5       baiye-server
       (nginx:alpine)  (nginx:alpine)  (node:20-slim)
                                      :3000 API
                                             |
                             +---------------+---------------+
                             v                               v
                       baiye-mysql                      baiye-redis
                       (mysql:8.0)                      (redis:7-alpine)

网络: back (server/mysql/redis) + front (server/admin/h5/gateway)
暴露: 仅 gateway 80+443；数据库绑定 127.0.0.1
内存: 2C4G 必须 4G swapfile (npm install + vite build 防 OOM)

---

## §2 构建源四大黄金规则

### (1) server/Dockerfile apt 源必须用 HTTP 阿里云镜像

绝对不能用 HTTPS + deb822 + Signed-By:

RUN rm -f /etc/apt/sources.list.d/debian.sources \
  && echo 'deb http://mirrors.aliyun.com/debian/ bookworm main' > /etc/apt/sources.list \
  && echo 'deb http://mirrors.aliyun.com/debian-security/ bookworm-security main' >> /etc/apt/sources.list \
  && apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends wget curl ca-certificates procps net-tools iproute2 \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

### (2) server/Dockerfile 不能安装 timeout 包

timeout 命令由 coreutils 自带，Debian 没有名为 timeout 的 apt 包。
正确列表: wget curl ca-certificates procps net-tools iproute2

### (3) admin/h5 Dockerfile 不需要 apt

运行时是 nginx:1.27-alpine，无 apt 步骤。

### (4) npm 统一 npmmirror.com + 不做 cache clean

所有三个 Dockerfile 的 npm install:
  ENV npm_config_registry=https://registry.npmmirror.com
  # 不要 && npm cache clean --force (Docker 层缓存会处理)

---

## §3 Nginx Gateway 三大黄金规则

### (1) HTTPS 必须有 /health location
location /health { proxy_pass http://server:3000/health; }

### (2) HTTP 80 -> HTTPS 443 重定向是正确行为
deploy.yml HTTP verify 期望值必须包含 301|302

### (3) 只用标准 ASCII 字符
Unicode 反引号、Markdown 反引号都会导致 nginx -t 报错

---

## §4 seed.js 必须主动退出

sequelize 连接池保持 Node.js 事件循环。
seed.js 末尾必须有:
  await sequelize.close();
  process.exit(0);

---

## §5 GitHub Actions SSH 配置

### 服务器端
ssh-keygen -t ed25519 -N "" -f ~/.ssh/github_actions_deploy
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys ~/.ssh/github_actions_deploy

### GitHub Secrets (settings/secrets/actions)
  SERVER_HOST = 101.132.17.214
  SERVER_PORT = 22
  SERVER_USER = root
  SERVER_SSH_KEY = cat ~/.ssh/github_actions_deploy 完整输出

### SERVER_SSH_KEY 校验
  wc -l  # 6-8 行
  head -1  # BEGIN OPENSSH PRIVATE KEY
  tail -1  # END OPENSSH PRIVATE KEY

### 阿里云安全组
入方向放行: 22/tcp 80/tcp 443/tcp

---

## §6 deploy.yml v3 安全部署 (当前版本)

### v3 四大安全规则 (踩坑总结，违反必宕机)

#### 规则 1: 禁止 set -eu -o pipefail

`set -e` 是 v2 版快速失败的根因：任何命令返回非0（如 git fetch 网络抖动、grep 不匹配）
都会导致脚本立即退出，35 秒内失败，容器可能已被 down 但没 up 回来。

v3 改为：不用 set -e，手动检查关键步骤退出码。

#### 规则 2: 禁止 docker compose down

`docker compose down` 是服务杀手：down 后如果 build 失败（OOM/apt 失败/npm 失败），
容器永远不起来，服务器彻底宕机。

v3 改为：只 build 新镜像 → docker compose up -d 自动滚动替换有新镜像的容器。
旧容器保持运行直到新容器 ready，零停机。

唯一例外：FORCE_REBUILD=true 时由用户手动承担风险。

#### 规则 3: build 失败不中断

build 失败时设 BUILD_FAIL=1 但继续执行 up -d，用旧镜像保持服务可用。
verify 失败时执行兜底恢复（restart + up -d），不 exit 1，避免连环失败。

#### 规则 4: deploy.yml 自身变更不触发 INFRA

v2 中 deploy.yml 匹配 `^\.github/` 正则 → CHANGED_INFRA=true → down 容器。
导致每次改 deploy.yml 都触发全量 down，恶性循环。

v3 改为：CHANGED_INFRA 正则只匹配 nginx-docker.conf 和 docker-compose.yml，
deploy.yml 自身变更不算 INFRA。

### v3 七步流水线

  [1/7] sync code         git fetch (重试3次) + reset + 证书保护/还原
  [2/7] smart diff        git diff -> BUILD PLAN (INFRA只匹配nginx/compose)
  [3/7] golden rules      WARN模式 (PASS>=3即可，不退出)
  [4/7] system check      swap + 磁盘空间检查 (低则prune)
  [5/7] smart build       只 build 变化的服务 (失败不中断)
  [6/7] up -d + healthy   滚动更新 (不down旧容器)
  [7/7] verify + recovery HTTP检查 (失败则restart+up兜底)

### 手动触发参数
  GIT_RESET_MODE (hard/mixed/keep)
  ONLY_START (true=只 up -d，跳过一切)
  FORCE_REBUILD (true=忽略 diff, 全量重建+down)

### 日志
  tail -f /tmp/baiye-deploy.log

---

## §7 阿里云 ECS 2C4G 限制

  出站 HTTP 80: 被阻断 -> apt 必须国内镜像
  出站 HTTPS 443: 可达 -> Docker Hub/npm 正常
  可用内存: ~2.8G -> 必须 4G swapfile
  磁盘: 49G -> 够用
  Docker Compose: v2+ (docker compose)

### 服务器首次初始化
dnf install -y git curl wget
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap defaults 0 0' >> /etc/fstab
mkdir -p /opt && cd /opt
git clone git@github.com:q2640962240/tongcheng.git baiye
cd /opt/baiye && docker compose up -d --build

---

## §8 手动部署 (仅 Actions 挂了)

cd /opt/baiye
eval "" && ssh-add ~/.ssh/github_actions_deploy
git fetch --prune origin main && git reset --hard origin/main
docker image prune -f
docker compose build server  # 或 admin / h5 / infra
docker compose up -d
for i in ; do docker compose ps server | grep -qi healthy && break; sleep 5; done
for ep in /health /api/health /admin/ /; do curl -sk -o /dev/null -w "%{http_code}" https://zyb001.cn; echo " "; done

---

## §9 部署前本地 Checklist

cd server && npm test
node server/scripts/_e2e_diagnose.js
grep -c 'URIs: https' server/Dockerfile    # = 0
grep -c 'mirrors.aliyun.com' server/Dockerfile # >= 2
grep -c '\btimeout\b' server/Dockerfile    # apt 列表 = 0
git add . && git commit -m "fix: x" && git push
# push main -> deploy.yml 自动触发

---

## §10 FAQ

Q: Actions 35秒快速失败?
A: v2 的 set -eu -o pipefail 导致。v3 已移除，改为手动错误检查。

Q: 部署后服务器 502/不可达?
A: v2 的 docker compose down 导致。v3 改为 up -d 滚动更新，不 down 容器。

Q: 改了 deploy.yml 后连环失败?
A: v2 中 deploy.yml 匹配 ^\.github/ -> CHANGED_INFRA=true -> down。
   v3 正则缩小为 nginx-docker.conf|docker-compose.yml，deploy.yml 自身不算 INFRA。

Q: Actions "SSH deploy" 3 秒挂?
A: SERVER_SSH_KEY 值不对。头尾两行一起粘。

Q: apt exit 100?
A: 必须用旧式 sources.list + HTTP 阿里云镜像。

Q: gateway healthcheck 失败?
A: HTTPS block 缺 /health location 或 HTTP 被 301 重定向。

Q: server 一直 Unhealthy?
A: seed.js 缺 sequelize.close() + process.exit(0)。

Q: build 失败但服务还在?
A: v3 设计：build 失败设 BUILD_FAIL=1 但继续 up -d 用旧镜像，不中断服务。

Q: verify 失败但不报错?
A: v3 设计：verify 失败执行兜底恢复 (restart + up -d)，不 exit 1，避免连环失败。

Q: 部署很快 (30秒)?
A: Docker 层缓存生效, smart diff 只 build 变化的服务。

Q: 想全量重建?
A: Actions 手动触发 FORCE_REBUILD=true (会 down 容器)。

Q: 想跳过 build?
A: ONLY_START=true 或服务器 docker compose up -d。

---

## §11 回滚

cd /opt/baiye && git log --oneline -5
git reset --hard HEAD~1
docker compose build server && docker compose up -d server
# 或: git revert <sha> -> push -> 自动部署

---

## §12 文件职责

apt 源            server/Dockerfile      -> §2(1)
apt 包列表        server/Dockerfile      -> §2(2)
npm 镜像          所有 Dockerfile          -> §2(4)
nginx 路由        deploy/nginx-docker.conf -> §3
容器拓扑          docker-compose.yml       -> §1
SSH key           服务器 + GitHub Secrets -> §5
密码/JWT          docker-compose.yml env   -> §0
deploy 流程       .github/workflows/deploy.yml -> §6

文档: v3.0 (2026-08-31) - v3 安全部署 (no set-e, no down, auto recovery)