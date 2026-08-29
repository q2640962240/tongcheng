FROM node:20-slim AS builder
ENV TZ=Asia/Shanghai NODE_OPTIONS=--max-old-space-size=3072 npm_config_registry=https://registry.npmjs.org
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --include=dev --no-audit --no-fund --legacy-peer-deps && npm cache clean --force 2>/dev/null || true && echo "--- uni CLI check ---" && ls node_modules/.bin/uni
COPY . .
RUN echo "--- required files check ---" && ls src/pages.json src/manifest.json vite.config.js index.html && echo "--- uni build:h5 ---" && npm run build:h5 && echo "--- done ---" && ls -la dist/build/h5/ | head -20

FROM nginx:1.27-alpine
ENV TZ=Asia/Shanghai
RUN mkdir -p /etc/nginx/conf.d
COPY --from=builder /app/dist/build/h5 /usr/share/nginx/html
RUN printf 'server{\n listen 80;\n server_name _;\n root /usr/share/nginx/html;\n index index.html;\n client_max_body_size 20m;\n charset utf-8;\n gzip on; gzip_comp_level 6; gzip_min_length 1024;\n gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;\n location ^~ /static/ { expires 30d; add_header Cache-Control "public, immutable"; }\n location / { try_files $uri $uri/ /index.html; }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1/ >/dev/null
CMD ["nginx","-g","daemon off;"]
