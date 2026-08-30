# 白夜陪玩 — 部署规则 (DEPLOYMENT RULES)

> **任何对部署相关文件的修改前必须读此文件。所有踩过的坑均已记录。**

---

## 0. 部署总览

| 项 | 值 |
|---|---|
| 服务器 | Aliyun ECS 2C4G, 101.132.17.214, Aliyun Linux 3 |
| SSH | root@101.132.17.214:22, key ~/.ssh/github_actions_deploy |
| 域名 | zyb001.cn + www.zyb001.cn -> 101.132.17.214 |
| SSL | Let's Encrypt SAN in /opt/baiye/deploy/certbot/ |
| CI/CD | GitHub Actions .github/workflows/deploy.yml |
| 仓库 | github.com/q2640962240/tongcheng main |
| 路径 | /opt/baiye, Docker Compose v2+, 6 containers |
| 管理员 | admin / admin123 |
| MySQL | root/Baiye@2024! DB companion_play |
| Redis | BaiyeRedis2026!, 64MB+AOF |
| JWT | baiye_prod_jwt_secret_please_change_ME_2026_v1_abcdef |

---

## 1. 容器拓扑

公网->80/443->baiye-gateway(nginx:1.27-alpine)
  +-baiye-admin:80 (nginx)
  +-baiye-h5:80 (nginx)
  +-baiye-server:3000 (node:20-slim)
      +-baiye-mysql:3306 (internal only)
      +-baiye-redis:6379 (internal only)

Networks: back(server+mysql+redis), front(all 6)
Only gateway 80/443 exposed; DB bound to 127.0.0.1
2C4G requires 4G swapfile

---

## 2. Dockerfile Rules

Rule 1 - server/Dockerfile apt MUST use HTTP Aliyun mirror (ECS blocks HTTPS deb822):
  RUN rm -f /etc/apt/sources.list.d/debian.sources
  RUN echo 'deb http://mirrors.aliyun.com/debian/ bookworm main' > /etc/apt/sources.list
  RUN echo 'deb http://mirrors.aliyun.com/debian-security/ bookworm-security main' >> /etc/apt/sources.list
  RUN apt-get update && apt-get install -y wget curl ca-certificates procps net-tools iproute2

Rule 2 - server/Dockerfile MUST NOT install 'timeout' package (provided by coreutils)

Rule 3 - admin/h5 Dockerfile uses nginx:1.27-alpine runtime, no apt needed

Rule 4 - All 3 Dockerfiles: npm_config_registry=https://registry.npmmirror.com, no 'npm cache clean --force'

---

## 3. Nginx Gateway Rules

Rule 1 - HTTPS server block MUST have: location /health { proxy_pass http://server:3000/health; }
Rule 2 - HTTP 80 -> HTTPS 443 redirect is CORRECT, deploy.yml HTTP verify must accept 301|302
Rule 3 - Only ASCII in nginx.conf. No Unicode backticks, no Markdown code fences.

---

## 4. seed.js MUST exit

Add at end of seed.js:
  await sequelize.close();
  process.exit(0);

Without this, sequelize pool keeps Node event loop alive, entrypoint never reaches exec node src/app.js.

---

## 5. GitHub Actions SSH Setup

Server side:
  ssh-keygen -t ed25519 -N '' -f ~/.ssh/github_actions_deploy
  cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys ~/.ssh/github_actions_deploy

GitHub Secrets (settings/secrets/actions):
  SERVER_HOST = 101.132.17.214
  SERVER_PORT = 22
  SERVER_USER = root
  SERVER_SSH_KEY = full output of cat ~/.ssh/github_actions_deploy (BEGIN/END must be included)

Verify SERVER_SSH_KEY:
  wc -l = 6-8 lines
  head -1 = BEGIN OPENSSH PRIVATE KEY
  tail -1 = END OPENSSH PRIVATE KEY

Aliyun security group: allow 22/tcp 80/tcp 443/tcp inbound.

---

## 6. deploy.yml v2 Smart Build

OLD operations (removed, caused 15-30min deploys):
  x docker compose down -v (wipes volumes)
  x docker rmi -f baiye-server baiye-admin baiye-h5
  x docker system prune -af (clears ALL cache)
  x --no-cache (forces full rebuild)

NEW smart logic:
  + git diff OLD_SHA NEW_SHA detects what changed
  + CHANGED_SERVER/ADMIN/H5/INFRA flags
  + Only build changed services
  + Docker layer cache reused (npm install skipped if package.json unchanged)
  + docker image prune -f (only dangling images)

6-step pipeline:
  [1/6] sync code          git fetch + reset --hard origin/main
  [2/6] golden rules       4 checks, PASS>=4 required
  [3/6] smart diff         git diff -> BUILD PLAN
  [4/6] build              only services marked true in PLAN
  [5/6] up -d + healthy    docker compose up -d, wait for server healthy
  [6/6] HTTP verify        curl 4 endpoints

Manual trigger inputs:
  GIT_RESET_MODE: hard/mixed/keep (default hard)
  ONLY_START: true = skip pull/build, just up -d
  FORCE_REBUILD: true = ignore diff, rebuild ALL

Logs: tail -f /tmp/baiye-deploy.log

Expected deploy time: 30s-3min for code-only changes, 5-10min for full rebuild

---

## 7. Aliyun ECS 2C4G Limits

Outbound HTTP 80: BLOCKED -> apt MUST use domestic mirrors
Outbound HTTPS 443: OK -> Docker Hub/npm works
Available RAM: ~2.8G -> MUST have 4G swapfile
Disk: 49G -> enough
Docker Compose: v2+ only (no standalone docker-compose)

First-time server init:
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

## 8. Manual Deploy (only when Actions broken)

  cd /opt/baiye
  eval "$(ssh-agent -s)" && ssh-add ~/.ssh/github_actions_deploy
  git fetch --prune origin main && git reset --hard origin/main
  docker image prune -f
  docker compose build server  # or admin / h5 / mysql redis gateway
  docker compose up -d
  for i in $(seq 1 48); do docker compose ps server | grep -qi healthy && break; sleep 5; done
  for ep in /health /api/health /admin/ /; do curl -sk -o /dev/null -w "%{http_code}" https://zyb001.cn$ep; echo " $ep"; done

---

## 9. Local Pre-push Checklist

  cd server && npm test
  node server/scripts/_e2e_diagnose.js
  grep -c 'URIs: https' server/Dockerfile    # = 0
  grep -c 'mirrors.aliyun.com' server/Dockerfile # >= 2
  grep -c 'timeout' server/Dockerfile    # apt list = 0
  git add . && git commit -m 'fix: x' && git push
  # push main triggers deploy.yml automatically

---

## 10. FAQ

Q: Actions 'SSH deploy' fails in 3 seconds?
A: 99% SERVER_SSH_KEY wrong. Include BEGIN/END lines, don't merge into one.

Q: apt exit 100 during build?
A: Must use old sources.list format + HTTP Aliyun mirror.

Q: Gateway healthcheck fails?
A: HTTPS block missing /health location, or HTTP->HTTPS 301 redirect.

Q: Server always Unhealthy?
A: seed.js missing sequelize.close() + process.exit(0).

Q: Deploy very fast (30s)?
A: No --no-cache, Docker layer cache works, smart diff only builds changed services.

Q: Force full rebuild?
A: Actions manual run, set FORCE_REBUILD=true.

Q: Skip build, just restart?
A: ONLY_START=true in Actions, or docker compose up -d on server.

Q: Admin/h5 502 Bad Gateway?
A: gateway proxy_pass must use Docker Compose service name, not IP.

---

## 11. Rollback

Option A - server local:
  cd /opt/baiye && git log --oneline -5
  git reset --hard HEAD~1
  docker compose build server && docker compose up -d server

Option B - Actions ONLY_START:
  Actions -> Deploy -> Run workflow -> ONLY_START=true

Option C - safest:
  git revert <bad-commit-sha>
  git push origin main

---

## 12. File Responsibility Table

What to change            File                              Read Rule
-----------               ------                            ---------
apt source                server/Dockerfile                 2(1)
apt packages              server/Dockerfile                 2(2)
npm mirror                all Dockerfiles                   2(4)
nginx routes              deploy/nginx-docker.conf         3 (all)
add/remove container      docker-compose.yml                1
SSH key                   server + GitHub Secrets           5
password/JWT              docker-compose.yml env            0
deploy pipeline           .github/workflows/deploy.yml      6

Version: v2.0 (2026-08-30) - 22+ Actions runs + v2 Smart Build optimization
