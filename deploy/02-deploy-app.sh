#!/usr/bin/env bash
# 白夜 · 2C2G 轻量机部署 · Step 2：代码同步 → 建库 → .env → seed → PM2 启动 → Nginx + HTTPS
# ------------------------------------------------------------------------------
# 用法：
#   A) 推荐：先把项目上传到 /www/wwwroot/baiye（Git / 宝塔文件上传 / scp rsync 都可）
#      然后以 root 执行：
#        cd /www/wwwroot/baiye && bash deploy/02-deploy-app.sh
#   B) 执行时会交互式询问 4 个关键信息（留空则取默认/生成）：
#        · 域名（例 baiye.yourdomain.com）
#        · 管理后台域名（可与主域名相同，默认同 /admin/ 路径）
#        · 数据库账号（默认 companion_play，密码自动生成 16 位强）
#        · JWT 双密钥（自动 openssl rand -hex 32）
# ------------------------------------------------------------------------------
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log(){ printf "%b[DEPLOY]%b %s\n" "$GREEN" "$NC" "$*"; }
warn(){ printf "%b[WARN]%b %s\n" "$YELLOW" "$NC" "$*"; }
err(){ printf "%b[ERROR]%b %s\n" "$RED" "$NC" "$*"; exit 1; }
[[ $EUID -ne 0 ]] && err "请用 root"

# ---------------- 2.0) 路径校验 ----------------
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
log "项目根目录：$PROJECT_ROOT"
for d in server admin; do
  [[ -d "$PROJECT_ROOT/$d" ]] || err "缺目录 $PROJECT_ROOT/$d，请确认项目已完整上传。"
done
[[ -f server/package.json ]] || err "未找到 server/package.json"

# ---------------- 2.1) 交互式问答 ----------------
read -rp "输入生产域名（如 baiye.yourdomain.com）： " -e MAIN_DOMAIN
if [[ -z "$MAIN_DOMAIN" ]]; then
  err "必须输入域名（用于 SSL 证书 + 支付回调 URL）"
fi
read -rp "管理后台域名（留空=同主域名，在 /admin/ 路径下）： " -e ADMIN_DOMAIN
read -rp "MySQL 业务库用户名（默认 companion_play）： " -e DB_USER
DB_USER="${DB_USER:-companion_play}"
DB_NAME="${DB_NAME:-companion_play}"
# 生成 16 位强密码
if [[ -z "${DB_PASSWORD:-}" ]]; then
  DB_PASSWORD="$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9@#' | head -c 16)@1"
fi
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(openssl rand -hex 32)}"

# ---------------- 2.2) 创建数据库 + 最小权限账号 ----------------
log "创建数据库 $DB_NAME 与账号 $DB_USER（只给该库权限）"
# 宝塔 MySQL 一般 root 无密码或保存在 /www/server/panel/default.pl，这里走 socket 优先
MYSQL_ROOT_ARGS=""
if mysql -uroot -e "SELECT 1" >/dev/null 2>&1; then
  MYSQL_ROOT_ARGS="-uroot"
else
  # 尝试读取宝塔默认 root 密码
  BT_PASS_FILE="/www/server/panel/default.pl"
  if [[ -f "$BT_PASS_FILE" ]]; then
    ROOT_PASS="$(cat $BT_PASS_FILE)"
    MYSQL_ROOT_ARGS="-uroot -p${ROOT_PASS}"
  else
    warn "MySQL root 连接失败，请先到宝塔 → 数据库 → 修改 root 密码后重新运行脚本"
    read -rsp "请粘贴 MySQL root 密码：" ROOT_PASS; echo
    MYSQL_ROOT_ARGS="-uroot -p${ROOT_PASS}"
  fi
fi
mysql $MYSQL_ROOT_ARGS 2>/dev/null <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
log "数据库就绪。账号=${DB_USER} 密码=${DB_PASSWORD}（已保存在 server/.env，注意保密）"

# ---------------- 2.3) 生成 server/.env（2C2G 专用调参） ----------------
log "生成 server/.env（2C2G 调参：DB_POOL_MIN=1 / DB_POOL_MAX=6）"
cat > server/.env <<ENV
# 白夜 · 2C2G 轻量机生产配置（脚本生成，建议不要手改 key 名称）
NODE_ENV=production
PORT=3000

DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_LOGGING=false
# 2C2G 同机 MySQL：连接池宁小不大，避免 + session buffers 导致 OOM
DB_POOL_MIN=1
DB_POOL_MAX=6

# Redis 预留（2G 内存不建议启用同机 Redis，等升级 4C8G 再说）
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=30d

APP_NAME=白夜
APP_DOMAIN=https://${MAIN_DOMAIN}
APP_NOTICE=
KEFU_WECHAT=
KEFU_QRCODE=
KEFU_PHONE=

# 生产严格 CORS 白名单
CORS_ORIGINS=https://${MAIN_DOMAIN}$([[ -n "${ADMIN_DOMAIN}" && "${ADMIN_DOMAIN}" != "${MAIN_DOMAIN}" ]] && echo ",https://${ADMIN_DOMAIN}")

# 模块占位（推荐在「管理后台 → 配置中心」动态填写，优先级更高）
SMS_PROVIDER=
SMS_ACCESS_KEY_ID=
SMS_SIGN_NAME=白夜
WXPAY_ENABLED=false
ALIPAY_ENABLED=false
OSS_PROVIDER=local
PUSH_ENABLED=false
ENV
chmod 600 server/.env

# 为 PM2 + Node 在 2C2G 下预设环境变量（ecosystem.config.js 会读取）
export BY_INSTANCES=1
export BY_MAX_MEM=384M
# 持久化到 /etc/environment（下次 reboot 仍生效）
grep -q '^BY_INSTANCES=' /etc/environment 2>/dev/null || echo 'BY_INSTANCES=1' >> /etc/environment
grep -q '^BY_MAX_MEM='    /etc/environment 2>/dev/null || echo 'BY_MAX_MEM=384M' >> /etc/environment

# ---------------- 2.4) 目录权限 & 依赖安装 ----------------
log "后端安装生产依赖（--omit=dev）"
mkdir -p server/uploads server/data server/logs
# 部署排除：保留上传文件 & 老数据
chown -R www:www server/uploads 2>/dev/null || chmod -R 777 server/uploads
cd "$PROJECT_ROOT/server"
# 国内镜像 + 只装生产依赖
npm ci --omit=dev --registry=https://registry.npmmirror.com || npm install --production --registry=https://registry.npmmirror.com

# ---------------- 2.5) 首次 seed：建表 + 管理员 + 配置模板 ----------------
log "首次 seed（自动 alter 建表 + admin/admin123 + 46 项配置模板）"
cd "$PROJECT_ROOT/server"
NODE_ENV=production node src/seed.js 2>&1 | tee /root/baiye-seed.log
echo '---- seed 最后 5 行 ----'; tail -n 5 /root/baiye-seed.log

# ---------------- 2.6) PM2 启动 ----------------
log "PM2 启动（2C2G 默认 1 instance + 384M 阈值）"
cd "$PROJECT_ROOT/server"
pm2 delete by-server 2>/dev/null || true
pm2 start ecosystem.config.js --env production --no-autorestart 2>/dev/null || pm2 start ecosystem.config.js --env production
sleep 6
pm2 logs by-server --lines 30 --nostream || true
if ! pm2 list | grep -q 'by-server.*online'; then
  warn "PM2 未 online，请查看：pm2 logs by-server --lines 200"
  warn "常见 2C2G 报错：FATAL ERROR: Ineffective mark-compacts near heap limit → 把 BY_MAX_MEM 下调到 320M 再启动"
fi
pm2 save || true

# ---------------- 2.7) 管理后台 Vite 构建 ----------------
log "管理后台构建（admin/.env.production 默认 VITE_API_BASE=/api 同域名反代）"
cd "$PROJECT_ROOT/admin"
if [[ -f package-lock.json ]]; then
  npm ci --registry=https://registry.npmmirror.com
else
  npm install --registry=https://registry.npmmirror.com
fi
npm run build 2>&1 | tail -n 20

# ---------------- 2.8) Nginx 站点模板替换域名 ----------------
log "写入 Nginx 配置（deploy/nginx-baiye.conf → 宝塔 vhost）"
cd "$PROJECT_ROOT"
VHOST_FILE="/www/server/panel/vhost/nginx/${MAIN_DOMAIN}.conf"
mkdir -p /www/server/panel/vhost/nginx
cp deploy/nginx-baiye.conf "$VHOST_FILE"
# 替换 3 处占位域名
sed -i "s|baiye\.yourdomain\.com|${MAIN_DOMAIN}|g" "$VHOST_FILE"
# 若独立管理后台域名：可选启用末尾 admin block（暂不启用，默认 /admin/ 路径）
if [[ -n "$ADMIN_DOMAIN" && "$ADMIN_DOMAIN" != "$MAIN_DOMAIN" ]]; then
  warn "你选择了独立管理后台域名。请手动编辑 $VHOST_FILE 末尾的 server{ admin.yourdomain.com } 块，取消注释并改域名。"
fi

# 放一个临时健康文件以便 HTTPS 签发前验证 /health 反代正确
mkdir -p /www/wwwroot/baiye 2>/dev/null || true
# 注意：真正的 root 在 Nginx 里 /www/wwwroot/baiye，项目可放同路径（即 PROJECT_ROOT=/www/wwwroot/baiye）
# 若 PROJECT_ROOT 不是默认，做一个软链接
if [[ "$PROJECT_ROOT" != "/www/wwwroot/baiye" ]]; then
  ln -sfn "$PROJECT_ROOT" /www/wwwroot/baiye || warn "无法创建软链接，请检查 Nginx 根目录。"
fi

# ---------------- 2.9) Nginx 重载 & SSL（HTTP 模式先过健康检查） ----------------
nginx -t 2>&1 | tail -n 3
if command -v /etc/init.d/nginx >/dev/null 2>&1; then /etc/init.d/nginx reload
elif systemctl list-unit-files --type=service | grep -q nginx; then systemctl reload nginx
else /www/server/nginx/sbin/nginx -s reload 2>/dev/null || service nginx reload || true
fi

# ---------------- 2.10) 健康检查（非 HTTPS 模式） ----------------
echo
log "本地 HTTP 健康检查（还没 SSL 证书时用）："
for path in /health /api/health /api/admin/config/modules; do
  code=$(curl -s -o /tmp/baiye-http.out -w '%{http_code}' --max-time 6 "http://127.0.0.1${path}" || echo "000")
  body=$(head -c 200 /tmp/baiye-http.out 2>/dev/null || true)
  echo "  $path → HTTP $code   BODY=$body"
done

# 打印下一步
cat <<EOF

======================================================================
✅ Step 2 完成 ✅

🔐 下一步（必须！）：到宝塔面板 → 网站 → 添加站点
     域名填：${MAIN_DOMAIN}${ADMIN_DOMAIN:+ 与 ${ADMIN_DOMAIN}}
     根目录填：/www/wwwroot/baiye
     PHP 版本选：纯静态
   站点创建完成后 → 站点设置 → SSL → Let's Encrypt 一键申请 → 勾选「强制 HTTPS」
   申请成功后，宝塔会自动覆盖 ssl_certificate/ssl_certificate_key 两行，无需手动改。

👤 默认管理后台：https://${MAIN_DOMAIN}/admin/
   账号：admin  /  密码：admin123   —— 登录后「管理员信息」立即改密！

💾 敏感凭证：已存 2 处（请注意不要 Git 提交）：
   · 数据库：用户名 ${DB_USER} / 密码 ${DB_PASSWORD}
   · JWT_SECRET ：已写入 server/.env
======================================================================
EOF
