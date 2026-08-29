FROM node:20-slim AS builder
ENV TZ=Asia/Shanghai
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund --legacy-peer-deps && npm cache clean --force 2>/dev/null || true

FROM node:20-slim
ENV TZ=Asia/Shanghai NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends wget curl ca-certificates procps net-tools iproute2 \
  && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
# 注：timeout 命令由 coreutils(essential) 自带，Debian 无名为 timeout 的 apt 包，切勿加入安装列表（会导致 apt 退出码 100 构建失败）
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/logs /app/uploads /app/data \
  && printf '%s\n' \
  '#!/usr/bin/env node' \
  '/* healthcheck: node-native HTTP probe (no curl/wget required) */' \
  'const http=require("http");const opts={host:"127.0.0.1",port:3000,path:"/health",method:"GET",timeout:4000};' \
  'const req=http.request(opts,(res)=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>{try{const o=JSON.parse(d);process.exit(o&&o.status==="ok"?0:1)}catch(e){process.exit(1)}})});' \
  'req.on("error",()=>process.exit(1));req.on("timeout",()=>{req.destroy();process.exit(1)});req.end();' \
  > /usr/local/bin/healthcheck.js && chmod +x /usr/local/bin/healthcheck.js
EXPOSE 3000
ENTRYPOINT ["sh","-c"," \
  set -eu; \
  echo === 1/3 wait mysql/redis ===; \
  node -e \"const net=require('net');const sleep=s=>new Promise(r=>setTimeout(r,s));async function chk(h,p,n){for(let i=0;i<40;i++){try{await new Promise((rs,rj)=>{const s=new net.Socket();s.setTimeout(4000);s.on('connect',()=>{s.destroy();rs()});s.on('error',()=>{s.destroy();rj()});s.on('timeout',()=>{s.destroy();rj()});s.connect(p,h)});console.log('  OK '+h+':'+p);return}catch(e){console.log('  retry '+h+':'+p);await sleep(2000)}}console.error(n+' unreachable');process.exit(1);}(async()=>{await chk(process.env.DB_HOST,Number(process.env.DB_PORT||3306),'mysql');await chk(process.env.REDIS_HOST,Number(process.env.REDIS_PORT||6379),'redis')})()\"; \
  echo === 2/3 seed ===; \
  timeout 180 node src/seed.js || true; \
  echo === 3/3 start api ===; \
  exec node src/app.js \
"]
