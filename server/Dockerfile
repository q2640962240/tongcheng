FROM node:20-slim AS builder
ENV TZ=Asia/Shanghai
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund --legacy-peer-deps && npm cache clean --force 2>/dev/null || true

FROM node:20-slim
ENV TZ=Asia/Shanghai NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/logs /app/uploads /app/data
EXPOSE 3000
ENTRYPOINT ["sh","-c"," \
  echo === 1/3 wait mysql/redis === && \
  node -e \"const net=require('net');const sleep=s=>new Promise(r=>setTimeout(r,s));async function chk(h,p,n){for(let i=0;i<40;i++){try{await new Promise((rs,rj)=>{const s=new net.Socket();s.setTimeout(4000);s.on('connect',()=>{s.destroy();rs()});s.on('error',()=>{s.destroy();rj()});s.on('timeout',()=>{s.destroy();rj()});s.connect(p,h)});console.log('  OK '+h+':'+p);return}catch(e){console.log('  retry '+h+':'+p);await sleep(2000)}}process.exit(1);}(async()=>{await chk(process.env.DB_HOST,Number(process.env.DB_PORT||3306),'mysql');await chk(process.env.REDIS_HOST,Number(process.env.REDIS_PORT||6379),'redis')})()\" && \
  echo === 2/3 seed === && node src/seed.js || true && \
  echo === 3/3 start api === && exec node src/app.js \
"]
