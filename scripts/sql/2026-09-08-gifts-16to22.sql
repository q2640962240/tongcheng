-- D4 生产礼物表 16 → 22（含 code 业务键回填）
--
-- 执行前提（缺一不可）：
--   1. 已跑 2026-09-08-gifts-precheck.sql 且输出与「期望」全部一致
--   2. 已备份：
--      ssh -i ~/.ssh/tongcheng.pem root@114.55.225.77 \
--        'mkdir -p /opt/baiye/backup && docker exec baiye-mysql sh -c \
--         "mysqldump -uroot -p\"Baiye@2024!\" --single-transaction companion_play gifts \
--          > /tmp/gifts-$(date +%F-%H%M).sql" && docker cp baiye-mysql:/tmp/gifts-*.sql /opt/baiye/backup/'
--   3. 用户已批准本脚本（sort 属排序字段，price 出现在 INSERT 新行中）
--
-- 本脚本绝不触碰的东西：
--   - 14 行 active=0 的旧礼物（2026-09-07 boot-seed 事故遗留）：不删、不改、不给 code
--   - 16 行在售礼物的 name / price / image_url / effect_image / animation_level：只改 sort
--   - id：INSERT 一律省略，让 AUTO_INCREMENT 自己接（历史上涨到过 30，硬编码会撞）
--
-- 幂等性：code 回填带 `code IS NULL` 守卫；sort 更新按 code 定位；INSERT 用 NOT EXISTS 判重。
-- 重跑本脚本不会产生重复行。

START TRANSACTION;

-- ========== 步骤 1：给 16 行在售礼物回填 code（按 name 精确匹配） ==========
UPDATE gifts SET code = 'dianzan',       updated_at = NOW() WHERE name = '点赞'       AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'bixin',         updated_at = NOW() WHERE name = '比心'       AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'xingji',        updated_at = NOW() WHERE name = '星际少女'   AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'meigui',        updated_at = NOW() WHERE name = '玫瑰'       AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'xindong',       updated_at = NOW() WHERE name = '心动'       AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'yijian',        updated_at = NOW() WHERE name = '一剑穿心'   AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'zuanshi',       updated_at = NOW() WHERE name = '钻石'       AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'tianshi',       updated_at = NOW() WHERE name = '天使'       AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'huahao',        updated_at = NOW() WHERE name = '花好月圆'   AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'fudai',         updated_at = NOW() WHERE name = '福袋'       AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'huangguan',     updated_at = NOW() WHERE name = '皇冠'       AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'shuijingqiu',   updated_at = NOW() WHERE name = '水晶球'     AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'dushou',        updated_at = NOW() WHERE name = '独角兽'     AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'paoche',        updated_at = NOW() WHERE name = '跑车'       AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'xuanzhuanmuma', updated_at = NOW() WHERE name = '旋转木马'   AND active = 1 AND code IS NULL;
UPDATE gifts SET code = 'liuxingyu',     updated_at = NOW() WHERE name = '流星雨'     AND active = 1 AND code IS NULL;

-- ========== 步骤 2：重排 16 行在售礼物的 sort（只动 sort，为新礼物腾出档位） ==========
-- 旧 sort 1..16 → 新 sort（16 个既有价格一分未动）
UPDATE gifts SET sort = 1,  updated_at = NOW() WHERE code = 'dianzan';
UPDATE gifts SET sort = 5,  updated_at = NOW() WHERE code = 'bixin';
UPDATE gifts SET sort = 6,  updated_at = NOW() WHERE code = 'xingji';
UPDATE gifts SET sort = 7,  updated_at = NOW() WHERE code = 'meigui';
UPDATE gifts SET sort = 8,  updated_at = NOW() WHERE code = 'xindong';
UPDATE gifts SET sort = 9,  updated_at = NOW() WHERE code = 'yijian';
UPDATE gifts SET sort = 11, updated_at = NOW() WHERE code = 'zuanshi';
UPDATE gifts SET sort = 12, updated_at = NOW() WHERE code = 'tianshi';
UPDATE gifts SET sort = 13, updated_at = NOW() WHERE code = 'huahao';
UPDATE gifts SET sort = 14, updated_at = NOW() WHERE code = 'fudai';
UPDATE gifts SET sort = 15, updated_at = NOW() WHERE code = 'huangguan';
UPDATE gifts SET sort = 16, updated_at = NOW() WHERE code = 'shuijingqiu';
UPDATE gifts SET sort = 17, updated_at = NOW() WHERE code = 'dushou';
UPDATE gifts SET sort = 18, updated_at = NOW() WHERE code = 'paoche';
UPDATE gifts SET sort = 19, updated_at = NOW() WHERE code = 'xuanzhuanmuma';
UPDATE gifts SET sort = 21, updated_at = NOW() WHERE code = 'liuxingyu';

-- ========== 步骤 3：插入 6 个新礼物（省略 id；NOT EXISTS 判重） ==========
INSERT INTO gifts (name, image_url, price, sort, active, created_at, updated_at, animation_level, effect_image, code)
SELECT s.name, s.image_url, s.price, s.sort, 1, NOW(), NOW(), s.animation_level, s.effect_image, s.code
FROM (
  SELECT '便便'     AS name, '/static/gifts/bianbian.png' AS image_url, 2     AS price, 2  AS sort, 1 AS animation_level, '/static/svga/bianbian.svga' AS effect_image, 'bianbian' AS code
  UNION ALL SELECT '绿帽子',   '/static/gifts/lvmaozi.png',      5,     3,  1, '/static/svga/lvmaozi.svga',      'lvmaozi'
  UNION ALL SELECT '扔鸡蛋',   '/static/gifts/jidan.png',        8,     4,  1, '/static/svga/jidan.svga',        'jidan'
  UNION ALL SELECT '加油',     '/static/gifts/jiayou.png',       150,   10, 2, '/static/svga/jiayou.svga',       'jiayou'
  UNION ALL SELECT '一锤定音', '/static/gifts/luochui.png',      30000, 20, 3, '/static/svga/luochui.svga',      'luochui'
  UNION ALL SELECT '缘定今生', '/static/gifts/yuanding.png',     88888, 22, 3, '/static/svga/yuanding.svga',     'yuanding'
) AS s
WHERE NOT EXISTS (SELECT 1 FROM gifts g WHERE g.code = s.code);

COMMIT;

-- ========== 步骤 4：执行后断言 ==========
-- 期望：total=36, active_1=22, active_0=14, code_filled=22, distinct_code=22, null_code_active1=0
SELECT
  COUNT(*)                                        AS total,
  SUM(active = 1)                                 AS active_1,
  SUM(active = 0)                                 AS active_0,
  SUM(code IS NOT NULL)                           AS code_filled,
  COUNT(DISTINCT code)                            AS distinct_code,
  SUM(active = 1 AND code IS NULL)                AS null_code_active1
FROM gifts;

-- 期望：22 行，sort 连续 1..22 无重复无缺口，price 阶梯 1/2/5/8/10/20/50/80/100/150/200/300/500/500/1000/2000/5000/10000/20000/30000/50000/88888
SELECT sort, code, name, price, animation_level, image_url, effect_image
FROM gifts WHERE active = 1 ORDER BY sort;

-- 期望：0 行（sort 无重复）
SELECT sort, COUNT(*) c FROM gifts WHERE active = 1 GROUP BY sort HAVING c > 1;

-- 期望：14 行且与执行前完全一致（旧礼物未被触碰）
SELECT id, name, price, sort, active, code FROM gifts WHERE active = 0 ORDER BY id;

-- 期望：0 行（在售礼物的 name/price/素材路径未被改动 —— 与执行前快照比对）
SELECT id, name, price, image_url, effect_image, animation_level
FROM gifts
WHERE active = 1 AND code IN ('dianzan','bixin','xingji','meigui','xindong','yijian','zuanshi','tianshi','huahao','fudai','huangguan','shuijingqiu','dushou','paoche','xuanzhuanmuma','liuxingyu')
  AND (
    (code='dianzan'       AND (name<>'点赞'       OR price<>1))     OR
    (code='bixin'         AND (name<>'比心'       OR price<>10))    OR
    (code='xingji'        AND (name<>'星际少女'   OR price<>20))    OR
    (code='meigui'        AND (name<>'玫瑰'       OR price<>50))    OR
    (code='xindong'       AND (name<>'心动'       OR price<>80))    OR
    (code='yijian'        AND (name<>'一剑穿心'   OR price<>100))   OR
    (code='zuanshi'       AND (name<>'钻石'       OR price<>200))   OR
    (code='tianshi'       AND (name<>'天使'       OR price<>300))   OR
    (code='huahao'        AND (name<>'花好月圆'   OR price<>500))   OR
    (code='fudai'         AND (name<>'福袋'       OR price<>500))   OR
    (code='huangguan'     AND (name<>'皇冠'       OR price<>1000))  OR
    (code='shuijingqiu'   AND (name<>'水晶球'     OR price<>2000))  OR
    (code='dushou'        AND (name<>'独角兽'     OR price<>5000))  OR
    (code='paoche'        AND (name<>'跑车'       OR price<>10000)) OR
    (code='xuanzhuanmuma' AND (name<>'旋转木马'   OR price<>20000)) OR
    (code='liuxingyu'     AND (name<>'流星雨'     OR price<>50000))
  );
