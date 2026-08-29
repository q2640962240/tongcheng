# 白夜 · 宝塔面板「源码上传 → 宝塔终端构建」上传清单（Windows 手动上传版）
> 适用用户：**不想用 Git/rsync/SFTP 命令**，只用宝塔网页「文件管理器 → 上传」按钮，并且在宝塔终端 `npm install/npm run build` 构建。
> 对应脚本：`deploy/zip-source.ps1`（Windows 一键打包成 4 个 ZIP，避免你手动挑文件漏传）

---

## 一、总览：总共要手动上传的只有 **4 个 ZIP 包 + 1 个可选包**（共 5 个，约 18~35MB）
| # | 压缩包名 | 打包内容 | 大小参考 | 上传到服务器绝对路径 | 解压后位置 |
|---|---|---|---|---|---|
| 1 | `baiye-root.zip` | 项目根目录核心文件：README / docs / deploy 脚本 / .env.example 等（不含 app/admin/server 三大子目录源码，这三个在下面 2/3/4 分开发） | ≈ 2 MB | `/www/wwwroot/baiye/baiye-root.zip` | 解压到 `/www/wwwroot/baiye/` |
| 2 | `baiye-server-src.zip` | 后端源码（无 node_modules，无 .env，无 data/logs/uploads 运行时目录） | ≈ 1 MB | `/www/wwwroot/baiye/server/baiye-server-src.zip` | 解压到 `/www/wwwroot/baiye/server/` |
| 3 | `baiye-admin-src.zip` | 管理后台源码（无 node_modules，无 dist） | ≈ 3 MB | `/www/wwwroot/baiye/admin/baiye-admin-src.zip` | 解压到 `/www/wwwroot/baiye/admin/` |
| 4 | `baiye-app-src.zip` | 移动端 H5/小程序/App uni-app 源码（无 node_modules，无 dist/.hbuilderx/.cache/release） | ≈ 5~20 MB | `/www/wwwroot/baiye/app/baiye-app-src.zip` | 解压到 `/www/wwwroot/baiye/app/`（**H5 走 Nginx 静态托管才需上传；纯 APK 云打包不需要上传**） |
| 5 | `baiye-sucai-uploads.zip`（可选，冷启动第 1 天首页有图） | `server/uploads/sucai/*` 10 张素材图 与 前端静态素材一一对应 | ≈ 4 MB | `/www/wwwroot/baiye/server/uploads/baiye-sucai-uploads.zip` | 解压到 `/www/wwwroot/baiye/server/uploads/sucai/` |

---

## 二、每个 ZIP 详细「必须包含 / 禁止包含 / 可选」清单

### ZIP 1：baiye-root.zip（必须上传）
**✅ 必须包含（根目录第一层）**
```
README.md
docs/                  （全部：PROJECT / PRIVACY / APP-STORE-CHECKLIST / BRAND-REFERENCE / APP-PACKAGING-CHECKLIST）
deploy/                （全部：4 个 sh 脚本 + nginx-baiye.conf）
sucai/                 （可选但建议保留：根目录素材图，后续运营要对比时有用）
server/.env.example    （重要，服务器生成 .env 时要复制）
pages/                 （原型参考页，可选；不会在服务器运行，纯文档）
scripts/               （rebrand-baiye.js 等；运行时不用，但线上排查品牌残留会用到）
```

**❌ 绝对不要包含（包含了会泄漏密钥/拖慢上传）**
- `server/.env`（本地开发配置，包含 JWT_SECRET/DB_PASSWORD；线上由 .env.example 重新生成）
- `server/data/*.json`（测试/本地运行时 JSON 回退数据；生产走 MySQL）
- `server/uploads/*`（本地头像/上传文件；**不要**把自己测试期图片传到线上；只有 `server/uploads/sucai/*` 可选）
- `server/logs/*`、`server/node_modules/*`、`admin/node_modules/*`、`app/node_modules/*`
- `admin/dist/*`、`app/dist/*`、`app/.hbuilderx/cache/*`、`app/.hbuilderx/release/*`
- `.trae/`（规格文档；绝不上传）、`.github/`（CI 不需要）、`.preflight/`、本地 Windows 锁定文件 `.keystore`（项目根目录如果有 51ec7…keystore 请删除或单独离线保存，绝不进 ZIP）

---

### ZIP 2：baiye-server-src.zip（必须上传）
**✅ 必须包含**
```
server/package.json
server/package-lock.json        ※ 非常重要：不要删！npm ci 严格对齐依赖版本，避免线上 npm install 拉到不一致
server/ecosystem.config.js      ※ 生产 PM2 配置
server/src/**                   （整棵 src 树：app.js/config/models/routes/utils/middleware/seed.js 等）
server/scripts/smoke-check.js   （生产冒烟用）
server/test/**                  （可选，建议保留：出问题了可以线上 npm test 定位）
server/.env.example             （生成 .env 用）
server/jest.config.js 等构建配置（如果有）
```

**❌ 绝对不要包含**
```
server/node_modules/           （体积 300~500MB，上传会死，绝对不上传）
server/.env                    （见上，敏感）
server/data/                   （本地 JSON 数据）
server/uploads/                （运行时上传；只有 sucai 子目录另打包）
server/logs/
server/*.log                   （pm2 日志等）
server/coverage/               （如果有，测试覆盖率产物，不需要）
```

---

### ZIP 3：baiye-admin-src.zip（必须上传，因为我们要在宝塔终端 npm run build）
**✅ 必须包含**
```
admin/package.json
admin/package-lock.json        ※ 必须
admin/.env.production          ※ 必须：生产 VITE_API_BASE=/api
admin/vite.config.js
admin/index.html
admin/src/**                   （全部：views/router/store/api/styles/components 等）
```

**❌ 绝对不要包含**
```
admin/node_modules/            （上传会死）
admin/dist/                    （将在宝塔终端 npm run build 产出）
admin/.env                     （若有本地开发专用 .env，不要上传）
admin/.vite/                   （Vite 开发缓存）
```

---

### ZIP 4：baiye-app-src.zip（**纯 APK 云打包可完全不上传；只有要上线 H5 版/微信小程序端时才上传**）
**✅ 必须包含（如果你要做 H5 / MP-WEIXIN 发布）**
```
app/package.json
app/package-lock.json
app/index.html
app/vite.config.js   （若存在）
app/src/**           （全部 uni-app Vue 源码：pages/components/store/utils/api）
app/static/**        （tab 图标/logo/favicon 等运行时静态，H5 需要）
app/manifest.json
app/pages.json
app/App.vue
app/main.js
app/i18n/
app/project.config.json
app/project.miniapp.json
```

**❌ 绝对不要包含**
```
app/node_modules/
app/dist/                （构建产物，H5 在宝塔终端 npm run build:h5 产出）
app/.hbuilderx/cache/    （HBuilder 云打包缓存，几十 MB）
app/.hbuilderx/release/  （APK 安装包，不要上传；请在本地 / 云打包直接分发）
app/unpackage/dist       （若存在）
app/project.private.config.json  （通常含本地个人偏好，不要上传）
```

---

### ZIP 5：baiye-sucai-uploads.zip（可选，但**强烈建议**，否则第 1 天首页 banner/动态/个人中心素材图会全空白 → 404）
**✅ 必须包含**
```
server/uploads/sucai/*.jpg  （10 张：banner-home/banner-purify/banner-join/group-movie/group-travel/post-food1~game2/profile-xiaokui/profile-ziqing 等）
```
> 实际上传后 Nginx `/uploads/sucai/banner-home.jpg` 与前端调用路径一致，这就是冷启动第 1 天的首页素材。

---

## 三、你本地 Windows 推荐：一键打包命令（不用手动挑）
打开 PowerShell，切到项目根目录 `D:\tongcheng\companion-play-app>`，复制下面三行（或直接运行 `deploy\zip-source.ps1`）：
```powershell
cd D:\tongcheng\companion-play-app
powershell -ExecutionPolicy Bypass -File deploy\zip-source.ps1
dir deploy\artifacts\           # 生成 5 个 ZIP：baiye-root / server-src / admin-src / app-src / sucai-uploads
```
5 个 ZIP 全部输出到 `deploy/artifacts/`，你在宝塔文件管理器里分别点「上传」→ 选中这 5 个即可。

---

## 四、宝塔文件管理器：每个 ZIP 上传到哪？解压后动作？（一步一图式说明）
### 4.0 先在宝塔创建根目录：
- 宝塔左侧：**文件** → 进入 `/www/wwwroot` → 新建目录 `baiye` → 进入 `/www/wwwroot/baiye`。
- 在 `/www/wwwroot/baiye/` 下再建 3 个空目录：`server/`、`admin/`、`app/`，并进入 `server/` 建 `uploads/`，进入 `uploads/` 再建 `sucai/`。

### 4.1 上传 baiye-root.zip
- 位置：`/www/wwwroot/baiye/` 目录下 → 上传。
- 上传完右键 → **解压到当前目录**（不要新建一层同名子目录！宝塔默认会解压到 `baiye-root/`，若出现请把里面文件剪切到上一层并删除空的 `baiye-root/`）。
- 检查：你现在能看到 `/www/wwwroot/baiye/deploy/`、`/www/wwwroot/baiye/README.md`、`/www/wwwroot/baiye/docs/`。

### 4.2 上传 baiye-server-src.zip
- 位置：`/www/wwwroot/baiye/server/` → 上传 → 解压到当前目录。
- 检查：能看到 `/www/wwwroot/baiye/server/src/app.js`、`/www/wwwroot/baiye/server/package.json`。

### 4.3 上传 baiye-admin-src.zip
- 位置：`/www/wwwroot/baiye/admin/` → 上传 → 解压到当前目录。
- 检查：能看到 `/www/wwwroot/baiye/admin/src/views/dashboard/Dashboard.vue`、`/www/wwwroot/baiye/admin/package.json`。

### 4.4 上传 baiye-app-src.zip（**仅当你还要部署 H5/小程序**，否则跳过）
- 位置：`/www/wwwroot/baiye/app/` → 上传 → 解压到当前目录。
- 检查：能看到 `/www/wwwroot/baiye/app/src/pages/home/home.vue`。

### 4.5 上传 baiye-sucai-uploads.zip（可选但强烈建议）
- 位置：`/www/wwwroot/baiye/server/uploads/sucai/` → 上传 → 解压到当前目录。
- 检查：能看到 10+ 张 `.jpg`（banner-home.jpg 等）。

---

## 五、上传后必须手动做的 3 件事（不能省）
### 5.1 生成 server/.env（不要直接上传本地 .env）
进入 `/www/wwwroot/baiye/server/`，复制 `server/.env.example` 为 `server/.env`，改：
```
NODE_ENV=production
DB_HOST=127.0.0.1   DB_NAME=companion_play   DB_USER=companion_play   DB_PASSWORD=<deploy/02-deploy-app.sh 给你生成的>
DB_POOL_MIN=1  DB_POOL_MAX=6
JWT_SECRET=<32 字节随机>   JWT_REFRESH_SECRET=<另 32 字节>
APP_DOMAIN=https://baiye.yourdomain.com
CORS_ORIGINS=https://baiye.yourdomain.com,https://admin.yourdomain.com（若有）
```
> ⚠️ 这一步最容易错 1：`APP_DOMAIN` 协议必须带 `https://`，不能写域名裸字符串；否则微信/支付宝回调 URL 会变成 `baiye.yourdomain.com/...`（缺协议）。
> ⚠️ 错 2：`DB_USER=root` 请不要，就用 `companion_play` 单库账号。

### 5.2 Nginx 站点配置：把 deploy/nginx-baiye.conf 粘贴到宝塔站点配置
- 宝塔 → 网站 → 添加站点：域名 `baiye.yourdomain.com`、根目录 `/www/wwwroot/baiye`、PHP=纯静态。
- 站点 → 设置 → 配置文件：**清空所有** → 粘贴 `/www/wwwroot/baiye/deploy/nginx-baiye.conf` 的全部内容。
- 然后按 `Ctrl+F` 搜索 `baiye.yourdomain.com`，替换成你真实域名（3 处）。
- 站点 → SSL → Let's Encrypt 申请 → 勾选 **强制 HTTPS**。

### 5.3 目录权限 + 软链（保证上传/运行可写）
宝塔终端执行：
```bash
cd /www/wwwroot/baiye/server
mkdir -p data uploads logs
chmod -R 755 uploads data logs  # 安全点：chown -R www:www uploads（若 www 用户存在）
chmod 600 /www/wwwroot/baiye/server/.env
# Nginx 模板 E 块指向 /www/wwwroot/baiye/admin/dist/；模板默认 root=/www/wwwroot/baiye；
# 若你在宝塔「添加站点」填的根目录是别的路径，请做一个软链接对齐：
ln -sfn /www/wwwroot/baiye /www/wwwroot/baiye.yourdomain.com 2>/dev/null || true
```

---

## 六、上传完成后你在宝塔终端按顺序执行的命令（复制粘贴即可）
```bash
# Step A：系统/软件三件套/swap/my.cnf（只需第 1 次）
cd /www/wwwroot/baiye
bash deploy/01-init-os.sh

# Step B：建库 + 依赖 + seed + PM2 + admin 构建 + Nginx 站点落盘（部署脚本会自动做 90%）
cd /www/wwwroot/baiye
bash deploy/02-deploy-app.sh

# Step C：健康验收 11 条
HOST=https://baiye.yourdomain.com ADMIN_PASSWORD=你改过后的管理员密码 \
  bash deploy/03-healthcheck.sh
```
看到最后一行 `PASS 23+ / FAIL 0 / WARN 0` 即部署成功。

---

## 七、宝塔文件上传常见坑（踩了必返工）
| 坑 | 现象 | 解决 |
|---|---|---|
| 解压出一层多余的 `baiye-root/` 子目录 | `/www/wwwroot/baiye/baiye-root/README.md` 而不是 `/baiye/README.md` → 脚本下一步全报错 | 宝塔解压弹窗里把「解压到：baiye-root/」改成 **当前目录 /www/wwwroot/baiye/**，或手工剪切回上一级 |
| 传了 `server/.env` 含本地 JWT_SECRET | 用户登录偶尔「401 切换 IP 就过期」，移动端反复弹登录 | 删掉服务器端 `.env`，重新从 `.env.example` 生成新随机 |
| 传了 `node_modules/`（哪怕部分）| 依赖版本不一致导致 Cannot find module、`SyntaxError: Unexpected token` | 服务器端 `rm -rf node_modules && npm ci --omit=dev` 重新安装 |
| 上传了 `server/uploads/*` 本地头像 | 用户未上传却看到他人头像/旧订单截图（严重隐私事故）| 服务器端只保留 `server/uploads/sucai/*`，其它全部删除 |
| 没改 Nginx 模板里 3 处 `baiye.yourdomain.com` | HTTPS 报错（证书名不匹配）或 HTTP/2 推送失败 | 全局替换；保存前先 `nginx -t` |
