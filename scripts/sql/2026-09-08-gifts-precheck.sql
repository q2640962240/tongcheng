-- D4 前置断言（只读，不写库）
-- 用途：在跑 2026-09-08-gifts-16to22.sql 之前确认生产礼物表处于预期状态。
-- 任一行与「期望」列不符就停止，先查清原因再动库。
--
-- 2026-09-08 实测基线（部署 156f9c5 后）：
--   总行数 30 = 16 个在售(active=1) + 14 个 2026-09-07 boot-seed 事故遗留的旧礼物(active=0)
--   MAX(id) = 30；code 列已由 db.bootstrap() 的 sync({alter:true}) 添加，全部为 NULL
--
-- ⚠️ 必须有下面这行，否则本脚本的断言结果不可信。
-- 容器内 mysql CLI 的 character_set_client 默认从 OS locale 推导、不是 utf8mb4，
-- 文件里的 UTF-8 中文字节会被当 latin1 解释。后果有两个：
--   1. 输出里所有中文名字显示成 `??`，16 行在售明细根本读不了；
--   2. 末尾那条「期望 0 行」的中文 IN 断言变成**假通过** ——
--      返回 0 行不是因为新名字不存在，而是因为字面量被解坏了、匹配不上任何东西。
-- 实测：`SELECT COUNT(*) FROM gifts WHERE name='点赞' AND active=1` 不加 SET NAMES 得 0，加了得 1。
-- 教训：任何「期望 0 行」的断言，都必须先证明它的字面量没被解坏。
SET NAMES utf8mb4;

-- 期望：total=30, active_1=16, active_0=14, max_id=30, code_filled=0
SELECT
  COUNT(*)                                   AS total,
  SUM(active = 1)                            AS active_1,
  SUM(active = 0)                            AS active_0,
  MAX(id)                                    AS max_id,
  SUM(code IS NOT NULL)                      AS code_filled
FROM gifts;

-- 期望：16 行，sort 连续 1..16，code 全 NULL
SELECT id, name, price, sort, animation_level, code
FROM gifts WHERE active = 1 ORDER BY sort, id;

-- 期望：14 行，全部 active=0（这些是旧礼物，本脚本一律不碰）
SELECT id, name, price, sort, active
FROM gifts WHERE active = 0 ORDER BY id;

-- 期望：0 行（22 档新名字不应已存在于在售礼物中）
SELECT id, name FROM gifts
WHERE active = 1 AND name IN ('便便','绿帽子','扔鸡蛋','加油','一锤定音','缘定今生');

-- 期望：gifts 表尚无 uk_gifts_code 唯一索引
SHOW INDEX FROM gifts;
