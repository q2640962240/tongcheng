require('dotenv').config()
const crypto = require('crypto')

const config = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  appDomain: process.env.APP_DOMAIN || '',

  db: {
    driver: (process.env.DB_DRIVER || (process.env.NODE_ENV === 'production' ? 'mysql' : 'json')).toLowerCase(),
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'companion_play',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    logging: process.env.DB_LOGGING === 'true',
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    timezone: '+08:00',
    poolMax: Number(process.env.DB_POOL_MAX) || 20,
    poolMin: Number(process.env.DB_POOL_MIN) || 2
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || ''
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },

  sms: {
    provider: process.env.SMS_PROVIDER || 'aliyun',
    accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || '',
    signName: process.env.SMS_SIGN_NAME || '白夜',
    templateCode: process.env.SMS_TEMPLATE_CODE || ''
  },

  oss: {
    region: process.env.OSS_REGION || '',
    bucket: process.env.OSS_BUCKET || '',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || ''
  },

  wx: {
    appId: process.env.WX_APP_ID || '',
    mchId: process.env.WX_MCH_ID || '',
    mchKey: process.env.WX_MCH_KEY || '',
    notifyUrl: process.env.WX_NOTIFY_URL || ''
  }
}

/**
 * 生产环境密钥自检 —— 不通过就抛错，让容器 crash-loop 而不是带病运行。
 *
 * 要堵的是两个口子：
 * ① 旧值曾明文写在 docker-compose.yml 的 `${JWT_SECRET:-...}` fallback 里，随 public
 *    仓库发布过（AGENTS.md 坑点 33）。2026-09-08 实测：用那串签一个 `{id:23}` 的令牌打
 *    生产 `/api/user/profile`，返回 200 + 该用户资料 —— 等于任意账号都能被接管。
 * ② 去掉 fallback 之后，环境变量为空会让 `process.env.JWT_SECRET || 'dev_secret'`
 *    **静默退化成人尽皆知的 `dev_secret`**，比原来的泄露值更糟。
 *
 * 已泄露值用 sha256 比对而不是写明文常量，避免把密钥又写回源码。
 */
const LEAKED_SHA256 = new Set([
  '00f9863e4caf712f01fb548b398d3fc69b7caaf9085a74e219020182cb206b3a', // 旧 JWT_SECRET
  '1110716f9681022e882ca10bee1c617552e28494e77f3465771af81b34f9e4c1'  // 旧 JWT_REFRESH_SECRET
])
// 代码里的 `|| 'dev_xxx'` 兜底值，以及 .env.example 的示例串。
// 后者长度都 > 32，只靠长度检查会漏掉 —— 照抄示例文件部署生产同样等于密钥公开。
const PUBLISHED_PLACEHOLDERS = new Set([
  'dev_secret',
  'dev_refresh',
  'please_change_to_a_strong_random_secret_at_least_32_bytes',
  'please_change_to_a_strong_random_refresh_secret',
  'please_change_to_another_independent_random_secret'
])

/**
 * 弱密钥判定。返回原因字符串，合格则返回 null。
 * 挂在 config 上导出，middleware/adminAuth.js 用它把「弱 ADMIN_JWT_SECRET」
 * 等同于「未配置」处理 —— 那边选择 fail closed（503）而不是 crash 整个服务，
 * 因为它只锁管理后台，代价不对等。
 */
const isWeakSecret = (v) => {
  const s = String(v || '').trim()
  if (!s) return '未设置（空值会静默退化成代码里的 dev 占位密钥）'
  if (PUBLISHED_PLACEHOLDERS.has(s)) return '仍是仓库里公开的占位串'
  if (s.length < 32) return `长度 ${s.length} < 32`
  if (LEAKED_SHA256.has(crypto.createHash('sha256').update(s).digest('hex'))) {
    return '仍是曾随 public 仓库泄露的旧值'
  }
  return null
}
config.isWeakSecret = isWeakSecret

const assertProdSecrets = () => {
  if (!config.isProd) return
  const bad = []
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const reason = isWeakSecret(process.env[name])
    if (reason) bad.push(`${name} ${reason}`)
  }
  if (bad.length) {
    throw new Error(
      '[FATAL] 生产密钥自检未通过：\n  - ' + bad.join('\n  - ') +
      '\n修法：在 /opt/baiye/.env 里为上述变量写入新的强随机值（openssl rand -hex 32），' +
      '\n     然后 docker compose up -d server。刻意 fail fast：带病启动等于任何人都能伪造用户登录令牌。'
    )
  }
  // 只影响管理后台，且中间件自己会 fail closed，所以这里告警不抛错
  const adminReason = isWeakSecret(process.env.ADMIN_JWT_SECRET)
  if (adminReason) {
    console.error(`[WARN] ADMIN_JWT_SECRET ${adminReason} —— 管理后台所有接口将一律返回 503。` +
      '请在 /opt/baiye/.env 补一个独立的强随机值（不要复用也不要派生自 JWT_SECRET）。')
  }
}

assertProdSecrets()

module.exports = config
