#!/usr/bin/env bash
# 白夜 · 2C2G 轻量机部署 · Step 0：安装宝塔面板（支持 Ubuntu 20.04/22.04 LTS 与 CentOS 7/9、AlmaLinux 8）
# ------------------------------------------------------------------------------
# 用法：
#   ssh root@<你的服务器IP>
#   bash <(curl -fsSL https://raw.githubusercontent.com/... )   # 或直接复制整段到终端
# 目标：
#   1) 选官方推荐国内镜像源 + 非交互安装（避免安装脚本卡在 Confirm [Y/n]）
#   2) 安装完毕打印入口 URL + 初始账号密码（务必进面板第一时间改密码 / 改 8888 端口）
#   3) 兼容：服务器若已跑 Nginx/Apache，本脚本不自动停服务；安装后用宝塔迁移即可
# ------------------------------------------------------------------------------
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log(){ printf "%b[INSTALL-BT]%b %s\n" "$GREEN" "$NC" "$*"; }
warn(){ printf "%b[WARN]%b %s\n" "$YELLOW" "$NC" "$*"; }
err(){ printf "%b[ERROR]%b %s\n" "$RED" "$NC" "$*"; exit 1; }

if [[ $EUID -ne 0 ]]; then err "请用 root 登录后执行（或 sudo -i）"; fi

# 0) 基础包与时区
export DEBIAN_FRONTEND=noninteractive
if command -v apt-get >/dev/null 2>&1; then
  OS=ubuntu
  apt-get update -y
  apt-get install -y curl wget ca-certificates tzdata vim lsof net-tools
elif command -v yum >/dev/null 2>&1; then
  OS=centos
  yum install -y curl wget ca-certificates tzdata vim lsof net-tools bash
else
  err "未识别包管理器，仅支持 apt / yum"
fi
ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
echo 'Asia/Shanghai' > /etc/timezone 2>/dev/null || true

# 1) 放行宝塔 / Web 常用端口（iptables + 云厂商安全组提示）
log "放行了入站端口：22 80 443 8888 3000/本地 3306/本地"
if command -v ufw >/dev/null 2>&1 && ufw status | head -n1 | grep -qi 'active'; then
  for p in 22 80 443 8888; do ufw allow $p/tcp comment "baiye:$p"; done
  ufw reload || true
elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port=22/tcp --add-port=80/tcp --add-port=443/tcp --add-port=8888/tcp
  firewall-cmd --reload
fi
warn ">>> 如服务器在阿里云/腾讯云/华为云「轻量云控制台」还有「防火墙/安全组」，请手动放行：80/443/8888。"
warn ">>> MySQL 3306 不对外放行；如宝塔在同机，用 127.0.0.1 访问即可。"

# 2) 选择官方宝塔安装：Ubuntu 用 .sh / CentOS 用 install_6.0.sh
DOWNLOAD_URL=""
if [[ $OS == "ubuntu" ]]; then
  DOWNLOAD_URL="https://download.bt.cn/install/install-ubuntu_6.0.sh"
else
  DOWNLOAD_URL="https://download.bt.cn/install/install_6.0.sh"
fi
log "使用官方安装脚本: $DOWNLOAD_URL"

# 3) 官方安装脚本非交互：echo y | bash，确保不卡
cd /root
echo y | bash <(curl -fsSL "$DOWNLOAD_URL") 2>&1 | tee /root/bt-install.log || true

if command -v bt >/dev/null 2>&1; then
  log "安装完成。打印宝塔入口与默认密码……"
  # bt 14 = 查看默认面板信息
  bt 14 || /etc/init.d/bt default 2>&1 | tee /root/bt-default.log
  warn "请立刻：① 浏览器打开上方外网面板地址 → 改管理员密码 → ② 面板设置 → 修改 8888 端口（例如改为 5位数随机）+ 绑定宝塔账号。"
else
  err "宝塔安装失败，请把 /root/bt-install.log 最后 50 行贴给工单 / 宝塔社区。"
fi

log "Step 0 完成。下一步执行：bash deploy/01-init-os.sh（或按 README 手动点装软件）"
