#!/usr/bin/env bash
set -e
echo "=== [1/6] dnf install base packages ==="
dnf install -y dnf-plugins-core device-mapper-persistent-data lvm2 curl git wget tar vim ca-certificates || true
dnf makecache --refresh || true
dnf upgrade-minimal --security -y || echo "WARN: security upgrade skipped"

echo "=== [2/6] install docker-ce ==="
if ! (dnf list installed docker-ce >/dev/null 2>&1); then
  dnf config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
  sed -i 's|$releasever|9|g' /etc/yum.repos.d/docker-ce.repo
  dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin --allowerasing --nobest
fi
systemctl enable --now docker
docker -v
docker compose version

echo "=== [3/6] docker daemon mirrors + log rotate ==="
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DAEMON'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com","https://dockerproxy.com"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "storage-driver": "overlay2"
}
DAEMON
systemctl restart docker

echo "=== [4/6] 2C2G kernel tuning ==="
sysctl -w vm.swappiness=10 2>/dev/null || true
echo 'vm.swappiness = 10' > /etc/sysctl.d/99-baiye-swap.conf
ulimit -n 65535 || true
if ! grep -q "\* soft nofile 65535" /etc/security/limits.conf 2>/dev/null; then
  cat >> /etc/security/limits.conf <<'LIMITS'
# baiye app
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
LIMITS
fi
echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true
echo never > /sys/kernel/mm/transparent_hugepage/defrag  2>/dev/null || true

echo "=== [5/6] hostname + timezone ==="
hostnamectl set-hostname baiye-prod 2>/dev/null || true
timedatectl set-timezone Asia/Shanghai 2>/dev/null || true
echo "  hostname: $(hostname)   tz: $(date +'%Z %:::z')   time: $(date '+%F %T')"

echo "=== [6/6] DONE. Next commands: ==="
echo "  cd \$PWD"
echo "  docker compose up -d --build        # 首次构建会比较慢，10-15 分钟"
echo "  sleep 60 ; docker compose ps        # 6 个服务应全部 healthy / Up"
echo "--- 访问地址 ---"
echo "  H5 用户端   : http://<SERVER_IP>/"
echo "  管理后台    : http://<SERVER_IP>/admin/      默认账号 admin / admin123（登录后立刻改密）"
echo "  健康检查    : curl -s http://127.0.0.1/api/health"
echo "  查看日志    : docker compose logs -f --tail 50 server"
