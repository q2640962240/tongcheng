FROM node:20-slim AS builder
ENV TZ=Asia/Shanghai NODE_OPTIONS=--max-old-space-size=2048
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --include=dev --no-audit --no-fund --legacy-peer-deps && npm cache clean --force 2>/dev/null || true
COPY . .
RUN npm run build && ls -la dist/

FROM nginx:1.27-alpine
ENV TZ=Asia/Shanghai
RUN mkdir -p /etc/nginx/conf.d
COPY deploy/nginx-admin.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
RUN if [ ! -s /etc/nginx/conf.d/default.conf ]; then \
      printf 'server{\n listen 80;\n server_name _;\n root /usr/share/nginx/html;\n index index.html;\n location / { try_files $uri $uri/ /index.html; }\n}\n' > /etc/nginx/conf.d/default.conf; \
    fi
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1/ >/dev/null
CMD ["nginx","-g","daemon off;"]
