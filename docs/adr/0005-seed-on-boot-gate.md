# ADR-005: 容器启动默认不跑 seed（SEED_ON_BOOT 开关）

## 状态

已采纳 (2026-09-07)

## 背景

`server/Dockerfile` 的 ENTRYPOINT 原本长这样：

```sh
echo === 2/3 seed ===; \
timeout 180 node src/seed.js || true; \
echo === 3/3 start api ===; \
exec node src/app.js
```

即**每次容器启动都执行完整 seed**。而 CI/CD 每次部署都会 `docker compose up -d` 重建 server 容器 —— 两者叠加，等于**每次部署都在直接改生产数据**。

这个隐患在 2026-09-07 真实爆发了。ADR-0004 把 16 个礼物全部改名后部署，`seed.js` 的 `upgradeGifts()` 按 `name` 匹配：

- 14 个新名字匹配不到旧行 → **新建 14 行**（id 17-30）
- 「皇冠」「跑车」两个名字撞上旧行 → 就地改了 `sort` / `image_url` / `effect_image` / `animation_level`，但 `upgradeGifts` 不碰 `price`，于是这两行的价格停留在旧档（皇冠 100 却排在 sort 11 的 1000 档，跑车 2000 却排在 sort 14 的 10000 档）

线上 `gifts` 表从 16 行变成 **30 行且全部 active**，用户端礼物面板出现整套重复礼物，外加两个价格错档（等于长期打折漏收入）。

值得注意的是：项目记忆里原本写着「CI 不执行 seed」，**这条认知是错的** —— seed 不在 GitHub Actions workflow 里，而在 Dockerfile 的 ENTRYPOINT 里，藏得比预想的深。

## 决策

**seed 改为默认不执行，由 `SEED_ON_BOOT` 环境变量显式开启。**

`server/Dockerfile`：

```sh
echo === 2/3 seed ===; \
if [ "${SEED_ON_BOOT:-false}" = "true" ]; then \
  timeout 180 node src/seed.js || true; \
else \
  echo '  skip seed (SEED_ON_BOOT != true). 建表由 app.js 的 db.bootstrap() 负责；' ; \
  echo '  首次部署或需要同步种子数据时，显式设 SEED_ON_BOOT=true 再启动一次。' ; \
fi; \
```

`docker-compose.yml` 的 server 服务里显式声明 `SEED_ON_BOOT: "${SEED_ON_BOOT:-false}"`，让开关可发现、可从 `.env` 翻转。

**建表不受影响**：`server/src/app.js:178` 启动时自己会调 `db.bootstrap()`（alter 模式，只补列不重建表），schema 从来不依赖 seed。seed 负责的是**数据**——管理员账号、配置中心模板、AI 虚拟大神/服务/动态、Banner、礼物。

## 后果

**正面**
- 部署与生产数据解耦：改 `DEFAULT_GIFTS` 或任何种子定义，不再会「一部署就落库」。
- 保留了新环境的开箱能力：首次部署在 `.env` 里设 `SEED_ON_BOOT=true` 启动一次即可。
- 跳过时打印明确原因，不会让人误以为 seed 静默失败。

**负面**
- 种子数据变更从「自动生效」变成「需要有人显式执行一次」。这是有意的取舍——自动生效的代价已经证明太高。
- 新环境的部署步骤多一个开关，`deploy/02-deploy-app.sh` 那条 PM2 路径本来就显式跑 seed，不受影响。

## 存量数据修复记录

30 行 → 16 行的修复（2026-09-07 已执行）：

```sql
-- 旧行有 gift_records_ibfk_99 外键引用（44 条历史记录），不能 DELETE，只能下架
UPDATE gifts SET active = 0 WHERE id IN (1,2,4,5,6,7,8,9,10,11,13,14,15,16);
-- 价格错档修正（已获用户批准）
UPDATE gifts SET price = 1000  WHERE id = 3  AND name = '皇冠';
UPDATE gifts SET price = 10000 WHERE id = 12 AND name = '跑车';
```

选 `active=0` 而不是 DELETE 的三个理由：

1. `gift_records.gift_id` 有真实外键约束 `gift_records_ibfk_99`，删除会失败或需要级联。
2. 列表接口 `server/src/routes/gifts.js:13` 是 `where: { active: true }`，下架即从用户端消失，效果等同删除。
3. `gift_records.gift_name` 是冗余存储，历史记录的礼物名不依赖 `gifts` 行，下架不影响历史展示。

回滚备份：服务器 `/opt/baiye/gifts-backup-20260907.sql`（改动前 30 行的 mysqldump）。

**这个修复对未来的 seed 是稳定的**：`ensureGifts` / `upgradeGifts` 都只改 `sort` / `image_url` / `effect_image` / `animation_level`，**从不碰 `active`**，所以下架的旧行不会被复活；16 个新名字都能按 name 匹配到且各字段已一致，是两个 no-op。

## 适用范围与遗留

- 仍然**禁止在生产执行完整 `npm run seed`** —— 它会写入 AI 虚拟大神等假数据。本 ADR 只是把「每次部署都无意中跑一遍」变成「必须显式开启」。
- `seed.js` 内部按 name 匹配的设计本身仍是隐患：任何改名都会在开启 seed 时产生重复行。彻底解法是给 `gifts` 加一个稳定的业务键（如 `code`）并按它匹配，属独立改动，本次未做。

## 关键文件

- `server/Dockerfile` — ENTRYPOINT 的 seed 开关
- `docker-compose.yml` — server 服务的 `SEED_ON_BOOT` 声明
- `server/src/app.js:178` — `db.bootstrap()`，建表的真正负责方
- `server/src/seed.js` — `ensureGifts` / `upgradeGifts`，按 name 匹配
