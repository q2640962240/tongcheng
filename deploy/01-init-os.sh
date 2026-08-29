#!/usr/bin/env bash
# 白夜 · 2C2G 轻量机部署 · Step 1：系统 & 软件初始化（宝塔面板装好后执行）
# ------------------------------------------------------------------------------
# 必做：
#   · 2G 内存必须加 2G swap（MySQL 8 启动基线）
#   · 宝塔「软件商店」安装：Nginx 1.24+  MySQL 8.0  Node.js 18（勾选 PM2 管理器）
#   · MySQL 8 2G 内存专用 my.cnf（innodb_buffer_pool_size=512M，避免 OOM killer 杀进程）
# ------------------------------------------------------------------------------
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log(){ printf "%b[INIT-OS]%b %s\n" "$GREEN" "$NC" "$*"; }
warn(){ printf "%b[WARN]%b %s\n" "$YELLOW" "$NC" "$*"; }
err(){ printf "%b[ERROR]%b %s\n" "$RED" "$NC" "$*"; exit 1; }
[[ $EUID -ne 0 ]] && err "请用 root"

# ---------------- 1.1) Swap：2GB，开机自动挂载 ----------------
log "创建 2GB swap（仅 2G 内存必要）"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap defaults 0 0' >> /etc/fstab
  fi
  sysctl -w vm.swappiness=10 >/dev/null
  # vm.swappiness 持久化
  if [ -f /etc/sysctl.conf ]; then
    if ! grep -q '^vm.swappiness' /etc/sysctl.conf; then
      echo 'vm.swappiness=10' >> /etc/sysctl.conf
    else
      sed -i 's/^vm.swappiness=.*/vm.swappiness=10/' /etc/sysctl.conf
    fi
  fi
else
  warn "已存在 swap，跳过创建。当前："
  free -h
fi

# ---------------- 1.2) 宝塔「软件商店」一键安装提示 ----------------
log "接下来去宝塔 → 软件商店 → 安装以下软件（必装）"
cat <<'EOF'
  ① Nginx 1.24+
  ② MySQL 8.0   （不要选 MySQL 5.6/5.5；如包管理有 5.7 也可，但默认 8.0）
  ③ Node.js 18 LTS 版（务必勾选安装 PM2 管理器；不要用 20+ 除非你确认有兼容）
  ④ 纯静态站点工具（File Manager 已默认）
EOF
warn "安装顺序：先 MySQL → 再 Nginx → 最后 Node.js。MySQL 安装时间 8-15 分钟，期间不要关浏览器页。"
warn "等待 MySQL 安装完成后再继续本脚本（不要跳步！）。然后按回车继续……"
read -r _ </dev/tty || true

# 检查
for cmd in nginx mysql node npm pm2; do
  if ! command -v $cmd >/dev/null 2>&1; then
    warn "【缺软件】未检测到：$cmd；请先到宝塔「软件商店」安装。"
    MISS=1
  fi
done
[[ -n "${MISS:-}" ]] && err "缺上述软件，安装后重新执行本脚本。"

# ---------------- 1.3) MySQL 8：2G 内存专用 my.cnf 覆盖 ----------------
log "写入 2C2G 专用 MySQL 配置（innodb_buffer_pool_size=512M，max_connections=150）"
BT_MYCNF="/www/server/mysql/my.cnf"
BT_MYCNF_BACKUP="/www/server/mysql/my.cnf.bak.baiye$(date +%F)"
if [[ -f "$BT_MYCNF" ]]; then
  cp -a "$BT_MYCNF" "$BT_MYCNF_BACKUP"
  log "已备份原配置到 $BT_MYCNF_BACKUP"
else
  warn "没找到宝塔标准 my.cnf=$BT_MYCNF，尝试通用路径 /etc/my.cnf"
  BT_MYCNF="/etc/my.cnf"
  [[ -f "$BT_MYCNF" ]] && cp -a "$BT_MYCNF" "${BT_MYCNF}.bak.baiye$(date +%F)" || touch "$BT_MYCNF"
fi

# 幂等写入：若 [mysqld] 段已存在同名 key，则替换，否则追加
patch_cnf() {
  local file="$1" key="$2" val="$3"
  if grep -Eq "^[[:space:]]*${key}[[:space:]]*=" "$file"; then
    sed -Ei "s|^[[:space:]]*${key}[[:space:]]*=.*|${key}=${val}|" "$file"
  else
    # 确保存在 [mysqld] 段
    grep -q '^\[mysqld\]' "$file" || printf '\n[mysqld]\n' >> "$file"
    sed -Ei "/^\[mysqld\]/a ${key}=${val}" "$file"
  fi
}
patch_cnf "$BT_MYCNF" character-set-server        utf8mb4
patch_cnf "$BT_MYCNF" collation-server            utf8mb4_unicode_ci
patch_cnf "$BT_MYCNF" default-authentication-plugin mysql_native_password
patch_cnf "$BT_MYCNF" max_connections             150
patch_cnf "$BT_MYCNF" innodb_buffer_pool_size     536870912   # 512M
patch_cnf "$BT_MYCNF" innodb_log_file_size        134217728   # 128M
patch_cnf "$BT_MYCNF" innodb_flush_method         O_DIRECT
patch_cnf "$BT_MYCNF" tmp_table_size              32M
patch_cnf "$BT_MYCNF" max_heap_table_size         32M
patch_cnf "$BT_MYCNF" slow_query_log              1
patch_cnf "$BT_MYCNF" long_query_time             1
patch_cnf "$BT_MYCNF" skip-name-resolve           1
patch_cnf "$BT_MYCNF" sql_mode                    'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'

log "重启 MySQL 使配置生效……"
if command -v /etc/init.d/mysqld >/dev/null 2>&1; then /etc/init.d/mysqld restart
elif systemctl list-units --type=service --all | grep -q mysqld; then systemctl restart mysqld
elif systemctl list-units --type=service --all | grep -q mysql;  then systemctl restart mysql
else warn "无法识别 MySQL 服务名，请到宝塔 → 软件 → MySQL → 重启"; fi

# ---------------- 1.4) Node 18 + 国内镜像 + PM2 开机自启 ----------------
log "Node 版本：$(node -v) | npm：$(npm -v)"
npm config set registry https://registry.npmmirror.com
npm install -g pm2@latest --registry=https://registry.npmmirror.com || true
pm2 install pm2-logrotate >/dev/null 2>&1 || true
# 开机自启：systemd
if command -v systemctl >/dev/null 2>&1; then
  pm2 startup systemd -u root --hp /root 2>/dev/null | tee /root/pm2-startup.txt || true
  warn "如上方出现形如「sudo env …… systemctl enable pm2-root」的命令，请复制粘贴执行一次即可。"
fi
pm2 save || true

# ---------------- 1.5) 安全基础 ----------------
log "关闭不必要的自启服务（rpcbind/avahi-daemon/cups 等可能 OOM 或被扫）"
for svc in rpcbind cups avahi-daemon; do
  if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^${svc}.service"; then
    systemctl disable --now "$svc" >/dev/null 2>&1 || true
  fi
done

free -h
echo '--------------------------------------------'
log "Step 1 完成。现在你可以开始 Step 2：代码上传 + 部署（执行 deploy/02-deploy-app.sh）"
