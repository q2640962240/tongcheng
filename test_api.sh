#!/bin/bash
cd /opt/baiye
TOKEN=$(docker compose exec -T server node -e 'const jwt=require("jsonwebtoken");const c=require("./src/config");console.log(jwt.sign({id:27},c.jwt.secret,{expiresIn:"1h"}))')
echo "TOKEN_LEN=${#TOKEN}"
echo "=== transactions (no type) ==="
curl -sk -H "Authorization: Bearer $TOKEN" https://127.0.0.1/api/wallet/transactions -H 'Host: zyb001.cn' | head -c 600
echo ""
echo "=== balance ==="
curl -sk -H "Authorization: Bearer $TOKEN" https://127.0.0.1/api/wallet/balance -H 'Host: zyb001.cn' | head -c 300
