#!/usr/bin/env bash
# 白夜 · 2C2G 轻量机部署 · Step 3：生产健康验收（与 README 11 条对齐，可直接跑）
# 用法：
#   HOST=https://baiye.yourdomain.com ADMIN_PASSWORD=你改后的管理员密码 bash deploy/03-healthcheck.sh
# ------------------------------------------------------------------------------
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass(){ ((PASS++)) ; printf "  %bPASS%b %s\n" "$GREEN" "$NC" "$*"; }
fail(){ ((FAIL++)) ; printf "  %bFAIL%b %s\n" "$RED" "$NC" "$*"; }
PASS=0; FAIL=0; WARN=0

HOST="${HOST:-http://127.0.0.1:3000}"
HOST="${HOST%/}"

[[ -z "${ADMIN_PASSWORD:-}" ]] && { echo -e "${YELLOW}提示：未设置 ADMIN_PASSWORD，仅跳过 admin 登录相关项（3/11）${NC}"; }

echo "=== 目标主机: $HOST ==="
which jq >/dev/null 2>&1 || { echo -e "${YELLOW}未装 jq，建议 apt-get install -y jq${NC}"; }

# T1 /health
echo
echo "#T1 /health：driver=mysql + env=production"
B=$(curl -sk --max-time 6 "$HOST/health")
if echo "$B" | grep -q '"driver":"mysql"'; then
  pass "driver=mysql OK"
else
  fail "未检测到 driver=mysql，当前 body=$(echo "$B" | head -c 200)"
fi
echo "$B" | grep -q '"env":"production"' || { fail "未检测到 NODE_ENV=production"; WARN=$((WARN+1)); echo "  当前 env body=$B"; }

# T2 /api/health
echo
echo "#T2 /api/health：MySQL SELECT 1"
B=$(curl -sk --max-time 6 "$HOST/api/health")
if echo "$B" | grep -q '"dbOk":true'; then
  pass "/api/health dbOk=true"
else
  fail "SELECT 1 探测失败 body=$B"
fi

# T3/T4 管理员
echo
echo "#T3 /api/admin/login + #T4 /config/status"
if [[ -n "${ADMIN_PASSWORD:-}" ]]; then
  LOGIN=$(curl -sk --max-time 10 \
    -X POST "$HOST/api/admin/login" \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"'"${ADMIN_PASSWORD}"'"}')
  TOKEN=$(echo "$LOGIN" | grep -oE '"token":"[^"]+' | head -n1 | cut -c10-)
  if [[ -n "$TOKEN" ]]; then
    pass "admin 登录成功"
    ST=$(curl -sk --max-time 6 "$HOST/api/admin/config/status" -H "x-admin-token: $TOKEN")
    echo "$ST" | grep -q '"driver":"mysql"' && pass "config/status driver=mysql" || fail "config/status 非 mysql body=$ST"
    echo
    echo "#T4 配置中心 6 模块齐全"
    MOD=$(curl -sk --max-time 6 "$HOST/api/admin/config/modules" -H "x-admin-token: $TOKEN")
    N=$(echo "$MOD" | grep -oE '"name":"[a-zA-Z]+"' | wc -l | tr -d ' ')
    [[ "${N:-0}" -ge 6 ]] && pass "模块数≥6 当前=$N" || fail "模块数不足 body=$MOD"
  else
    fail "admin 登录失败（密码错？）body=$LOGIN"
  fi
fi

# T5 限流 200/min
echo
echo "#T5 API 限流（1 分钟默认 200 次后，第 210 次应返回 429）"
if command -v ab >/dev/null 2>&1; then
  ab -n 210 -c 10 -k -q "$HOST/api/health" > /tmp/ab.log 2>&1 || true
  FAILS=$(grep -E 'Non-2xx responses' /tmp/ab.log | awk '{print $NF}')
  [[ "${FAILS:-0}" -ge 5 ]] && pass "ab 210 次请求 Non-2xx=$FAILS（≥5 证明限流生效）" || fail "限流未生效 Non-2xx=$FAILS"
else
  echo -e "  ${YELLOW}未装 ab：apt install apache2-utils；改用 curl 并发 220 次粗测${NC}"
  for i in $(seq 1 220); do
    curl -sk -o /dev/null -w '%{http_code}\n' "$HOST/api/user/kefu"
  done 2>/dev/null > /tmp/ccodes.log
  F429=$(grep -c '429' /tmp/ccodes.log || true)
  [[ "${F429:-0}" -ge 10 ]] && pass "curl 220 次 429=$F429（≥10 证明限流生效）" || fail "限流未生效 429=$F429"
fi

# T6 上传静态可达
echo
echo "#T6 /uploads/* 静态可达（防盗链 + 缓存）"
H=$(curl -skI --max-time 5 "$HOST/uploads/sucai/banner-home.jpg" | head -n 10)
echo "$H" | grep -q 'HTTP/.* 200' && pass "/uploads HTTP 200 OK" || { fail "banner-home.jpg 未命中，请先上传或允许 OSS=local 默认 404"; WARN=$((WARN+1)); }
echo "$H" | grep -qi 'cache-control.*max-age' && pass "Cache-Control 已设置" || fail "未设置 Cache-Control（Nginx 模板缺 E 块？）"

# T7 HTTP→HTTPS（仅当 HOST 是 https 时才有意义）
echo
echo "#T7 HTTP→HTTPS 强制跳转"
if echo "$HOST" | grep -q '^https://'; then
  HTTP_HOST="http://${HOST#https://}"
  CODE=$(curl -sLo /dev/null -w '%{http_code}' --max-time 6 "$HTTP_HOST/health")
  [[ "$CODE" == "301" || "$CODE" == "302" ]] && pass "HTTP → HTTPS 301/302 (当前 $CODE)" || fail "未做 HTTPS 强制跳转，当前 HTTP $CODE"
fi

# T8 CORS 非法 Origin
echo
echo "#T8 CORS 非法 Origin 不回 ACAO（避免凭据泄露）"
H=$(curl -skI --max-time 6 -H 'Origin: https://evil.com' "$HOST/api/user/kefu")
ACAO=$(echo "$H" | grep -i '^access-control-allow-origin:' || true)
if [[ -z "$ACAO" ]]; then
  pass "evil Origin 未返回 Access-Control-Allow-Origin"
else
  fail "CORS 配置可能过于宽松: $ACAO"
fi

# T9 Socket.IO 握手
echo
echo "#T9 Socket.IO 握手"
B=$(curl -sk --max-time 6 "$HOST/socket.io/?EIO=4&transport=polling" | head -c 40)
echo "$B" | grep -q '0{"sid"' && pass "Socket.IO 握手响应正确" || fail "Socket.IO 未正确监听 /socket.io/（$B）"

# T10 敏感文件 403
echo
echo "#T10 敏感文件 .env / ecosystem 403"
for p in /.env /ecosystem.config.js /seed.js /node_modules/package.json; do
  CODE=$(curl -skL -o /dev/null -w '%{http_code}' --max-time 6 "$HOST$p")
  if [[ "$CODE" == "403" || "$CODE" == "404" ]]; then
    pass "$p = HTTP $CODE（安全）"
  else
    fail "$p = HTTP $CODE，有泄漏风险"
  fi
done

# T11 错误堆栈不泄漏
echo
echo "#T11 生产 5xx 堆栈不泄漏；随机接口 404 无 _stack 字段"
B=$(curl -sk --max-time 6 "$HOST/api/not-exist-check-xyz-$$")
echo "$B" | grep -q '/www/wwwroot' && fail "404 响应泄露服务器路径：$(echo "$B" | head -c 200)" || pass "未泄漏服务器路径"
echo "$B" | grep -q '"_stack"' && fail "生产响应不应带 _stack" || pass "_stack 字段已隐藏"

# 服务器资源基线（额外，非 11 条标配）
echo
echo "#RESOURCE 轻量机资源基线（2C2G）"
free -h | grep -E 'Mem:|Swap:'
df -h | grep -E '/$|/www'
echo -e "CPU loadavg: $(cut -d' ' -f1,2,3 /proc/loadavg 2>/dev/null || uptime | awk -F'load average: *' '{print $2}')"

echo
echo "===================================================================="
printf "结果: %bPASS %d%b / %bFAIL %d%b / %bWARN %d%b\n" "$GREEN" "$PASS" "$NC" "$RED" "$FAIL" "$NC" "$YELLOW" "$WARN" "$NC"
echo "如 FAIL>0，按 README『宝塔部署指南 §11 条健康验收』定位并修。"
[[ "$FAIL" -eq 0 ]] && echo -e "${GREEN}🎉 生产验收全绿，可以发布。${NC}"
echo "===================================================================="
