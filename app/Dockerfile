FROM hub.rat.dev/library/node:20-slim AS builder
ENV TZ=Asia/Shanghai NODE_OPTIONS=--max-old-space-size=3072 npm_config_registry=https://registry.npmmirror.com
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --include=dev --no-audit --no-fund --legacy-peer-deps && echo "--- uni CLI check ---" && ls node_modules/.bin/uni
COPY . .
RUN echo "--- required files check ---" && ls src/pages.json src/manifest.json vite.config.js index.html && echo "--- uni build:h5 ---" && npm run build:h5 && echo "--- done ---" && ls -la dist/build/h5/ | head -20

FROM hub.rat.dev/library/nginx:1.27-alpine
ENV TZ=Asia/Shanghai
RUN set -eu; mkdir -p /etc/nginx /usr/share/nginx/html /var/cache/nginx /var/run /var/log/nginx
COPY --from=builder /app/dist/build/h5 /usr/share/nginx/html
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
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    server {
        listen 80; server_name _;
        root /usr/share/nginx/html; index index.html; charset utf-8;
        client_max_body_size 20m;
        # =============================================================
        # 缓存策略说明（刻意不写量词正则，避免 heredoc+nginx 解析歧义）：
        #   - Vite / uni-app H5 所有带内容 hash 的产物全部在 /assets/ 目录下
        #   - /static/ 目录放长资源图（默认 30d）
        #   - index.html + SPA 路由一律 no-cache no-store（浏览器每次重验证）
        # =============================================================
        # /assets/ 目录: 所有 JS/CSS/图片 都带 hash — 长缓存 immutable
        location ^~ /assets/ {
            expires 365d;
            add_header Cache-Control "public, max-age=31536000, immutable";
            try_files $uri =404;
        }
        # /static/ 目录: 同样长缓存
        location ^~ /static/ {
            expires 30d;
            add_header Cache-Control "public, immutable";
            try_files $uri =404;
        }
        # 常见后缀静态资源（不带量词，扩展名匹配即可触发长缓存）
        location ~* \.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot|otf|map)$ {
            expires 365d;
            add_header Cache-Control "public, max-age=31536000, immutable";
            try_files $uri =404;
        }
        # index.html 本身: 绝对不缓存
        location = /index.html {
            add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0" always;
            add_header Pragma "no-cache" always;
            add_header Expires "Thu, 01 Jan 1970 00:00:00 GMT" always;
            try_files $uri /index.html;
        }
        # SPA 路由兜底: 所有不匹配上面静态路径的请求，都返回 index.html（同样不缓存）
        location / {
            add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0" always;
            try_files $uri $uri/ /index.html;
        }
    }
}
NGXEOF
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 CMD wget -qO- http://127.0.0.1/ >/dev/null
CMD ["nginx","-g","daemon off;","-c","/etc/nginx/nginx.conf"]
