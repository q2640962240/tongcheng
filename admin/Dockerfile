FROM hub.rat.dev/library/node:20-slim AS builder
ENV TZ=Asia/Shanghai NODE_OPTIONS=--max-old-space-size=2048 npm_config_registry=https://registry.npmmirror.com
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --include=dev --no-audit --no-fund --legacy-peer-deps
COPY . .
RUN npm run build && ls -la dist/

FROM hub.rat.dev/library/nginx:1.27-alpine
ENV TZ=Asia/Shanghai
RUN set -eu; mkdir -p /etc/nginx /usr/share/nginx/html /var/cache/nginx /var/run /var/log/nginx
COPY --from=builder /app/dist /usr/share/nginx/html
RUN cat > /etc/nginx/nginx.conf <<'NGXEOF'
worker_processes  auto;
pid               /var/run/nginx.pid;
error_log         /var/log/nginx/error.log warn;
events {
    worker_connections  1024;
}
http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';
    access_log  /var/log/nginx/access.log  main;
    sendfile        on;
    keepalive_timeout  65;
    server_tokens off;
    gzip on; gzip_comp_level 6; gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;

    server {
        listen 80; server_name _;
        root /usr/share/nginx/html; index index.html; charset utf-8;
        client_max_body_size 20m;
        location ^~ /assets/ { expires 30d; add_header Cache-Control "public, immutable"; }
        location / { try_files $uri $uri/ /index.html; }
    }
}
NGXEOF
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 CMD wget -qO- http://127.0.0.1/ >/dev/null
CMD ["nginx","-g","daemon off;","-c","/etc/nginx/nginx.conf"]
