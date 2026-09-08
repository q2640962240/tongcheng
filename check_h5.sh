#!/bin/sh
echo "=== check 1钻石 ==="
grep -rl "1钻石" /usr/share/nginx/html/assets/ 2>/dev/null | head -3
echo "=== check orderNo/订单 ==="
grep -rl "订单" /usr/share/nginx/html/assets/ 2>/dev/null | head -3
echo "=== check starCoin/星币 ==="
grep -rl "星币" /usr/share/nginx/html/assets/ 2>/dev/null | head -3
echo "=== check switchTab discover ==="
grep -rl "switchTab" /usr/share/nginx/html/assets/ 2>/dev/null | head -3
