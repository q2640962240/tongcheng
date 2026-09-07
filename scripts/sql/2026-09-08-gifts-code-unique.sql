-- D4 步骤 5：给 gifts.code 加唯一索引（三步法的最后一步）
--
-- 只能在 2026-09-08-gifts-16to22.sql 执行完并核对断言全部通过之后再跑本脚本。
-- 顺序不能颠倒：db.bootstrap() 是 sync({alter:true})，若一开始就在模型里写 unique:true，
-- 既有 30 行 code 全 NULL 时建唯一索引会失败或建出残缺索引。
--
-- MySQL 唯一索引允许多个 NULL，所以 14 行 active=0 的旧礼物（code 保持 NULL）不受影响。
--
-- 回滚：ALTER TABLE gifts DROP INDEX uk_gifts_code;

-- 前置断言，期望 0 行：在售礼物不能有 code 为 NULL 的
SELECT id, name FROM gifts WHERE active = 1 AND code IS NULL;

-- 前置断言，期望 0 行：不能有重复 code
SELECT code, COUNT(*) c FROM gifts WHERE code IS NOT NULL GROUP BY code HAVING c > 1;

ALTER TABLE gifts ADD UNIQUE INDEX uk_gifts_code (code);

-- 执行后断言：应看到 uk_gifts_code，Non_unique=0
SHOW INDEX FROM gifts WHERE Key_name = 'uk_gifts_code';
