/**
 * 配置中心 — 运行时动态配置读写
 *
 * 优先级：DB（configs.json） > .env 默认值
 *
 * 使用：
 *   const { getModuleConfig, get, set } = require('../utils/config')
 *   const smsCfg = await getModuleConfig('sms')   // 合并后的最终值
 *   await set('sms', 'accessKeyId', 'LTAI5tXXX')
 */
const envConfig = require('../config')
const { Config } = require('../models')

// 内存缓存：module -> { values, ts }
const cache = new Map()
const TTL_MS = 60 * 1000  // 1 分钟缓存

// 模块 -> env 默认值映射（key 对齐 .env，且与 seed.js 中配置中心空模板保持一致）
// ★ 生产原则：
//   1. 除 app.name / oss.provider / jwt 等必要值外，其余敏感字段一律默认空，
//      引导用户在管理后台「配置中心」手动填写。
//   2. 任何模块不允许出现 dev/mock 回退；未配置即抛明确的业务错误。
const ENV_DEFAULTS = {
  app: {
    name: process.env.APP_NAME || '白夜',
    domain: process.env.APP_DOMAIN || '',
    kefuWechat: process.env.KEFU_WECHAT || '',
    kefuQrcode: process.env.KEFU_QRCODE || '',
    kefuPhone: process.env.KEFU_PHONE || '',
    notice: process.env.APP_NOTICE || '',
    // 业务参数（与 seed.js SINGLE_CONFIGS / admin.js FIELD_LABELS 对齐，留空表示使用种子默认值）
    signInRewardDiamond: process.env.SIGN_IN_REWARD_DIAMOND || '',
    // 定位服务：amap（高德）/ tencent（腾讯）/ off（关闭，默认）
    // 开启后配合 geoKey 才能使用第 1 级逆地理；未配置时系统会自动降级到 IP + 手动选择
    geoProvider: process.env.APP_GEO_PROVIDER || '',
    geoKey: process.env.APP_GEO_KEY || ''
  },
  jwt: {
    secret: envConfig.jwt.secret,
    expiresIn: envConfig.jwt.expiresIn,
    refreshSecret: envConfig.jwt.refreshSecret,
    refreshExpiresIn: envConfig.jwt.refreshExpiresIn
  },
  sms: {
    // 可选: aliyun / tencent，留空表示未启用（登录接口会提示配置）
    provider: process.env.SMS_PROVIDER || '',
    accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || '',
    signName: process.env.SMS_SIGN_NAME || '白夜',
    templateCode: process.env.SMS_TEMPLATE_CODE || '',
    templateRegister: process.env.SMS_TPL_REGISTER || '',
    templateLogin: process.env.SMS_TPL_LOGIN || '',
    appId: process.env.SMS_APP_ID || ''
  },
  wxpay: {
    enabled: process.env.WXPAY_ENABLED === 'true',
    appId: envConfig.wx.appId || '',
    mchId: envConfig.wx.mchId || '',
    mchKey: envConfig.wx.mchKey || '',
    notifyUrl: envConfig.wx.notifyUrl || '',
    certPath: process.env.WXPAY_CERT_PATH || '',
    certKey: process.env.WXPAY_CERT_SERIAL || '',
    certPrivateKey: process.env.WXPAY_CERT_PRIVATE_KEY || '',
    platformCert: process.env.WXPAY_PLATFORM_CERT || ''
  },
  alipay: {
    enabled: process.env.ALIPAY_ENABLED === 'true',
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
    sandbox: process.env.ALIPAY_SANDBOX === 'true'
  },
  oss: {
    // local = 本地 uploads/ 目录(单机生产可用)；aliyun = 阿里云 OSS
    provider: process.env.OSS_PROVIDER || 'local',
    region: envConfig.oss.region || '',
    bucket: envConfig.oss.bucket || '',
    accessKeyId: envConfig.oss.accessKeyId || '',
    accessKeySecret: envConfig.oss.accessKeySecret || '',
    endpoint: process.env.OSS_ENDPOINT || '',
    cdnDomain: process.env.OSS_CDN_DOMAIN || ''
  },
  push: {
    enabled: process.env.PUSH_ENABLED === 'true',
    // 可选: jpush / getui，留空或 none 表示未启用
    provider: process.env.PUSH_PROVIDER || '',
    appId: process.env.PUSH_APP_ID || '',
    channelId: process.env.PUSH_CHANNEL_ID || '',
    appKey: process.env.PUSH_APP_KEY || '',
    masterSecret: process.env.PUSH_MASTER_SECRET || ''
  }
}

/**
 * 按 Config.type（seed / 模板写入的类型元数据）把 TEXT 字符串 value 反序列化：
 *   - boolean: 'true'/'1' 为 true，其它（含空串）为 false
 *   - number: 空串保持空（让调用方用 fallback），否则 Number(x)，NaN 兜底原值字符串
 *   - json: JSON.parse，失败兜底 null 并打印 warn
 *   - string/secret：保留原字符串（空串即空）
 */
function coerceValue(value, type) {
  const raw = value == null ? '' : String(value)
  const t = String(type || 'string').toLowerCase()
  if (t === 'boolean') return raw === 'true' || raw === '1'
  if (t === 'number') {
    if (raw === '') return ''
    const n = Number(raw)
    return Number.isFinite(n) ? n : raw
  }
  if (t === 'json') {
    if (!raw) return null
    try { return JSON.parse(raw) } catch (e) { console.warn('[config] json parse fail:', raw.slice(0, 60)); return null }
  }
  return raw
}

/**
 * 读取某模块完整配置（DB 覆盖 env 默认值）
 */
async function getModuleConfig(moduleName) {
  const cached = cache.get(moduleName)
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return cached.values
  }
  const defaults = ENV_DEFAULTS[moduleName] || {}
  try {
    const rows = await Config.findAll({ where: { module: moduleName } })
    const merged = { ...defaults }
    for (const r of rows) {
      // 兼容 Sequelize 实例（Model.prototype.get 存在）与 JSON 驱动 plain object
      const key = typeof r.get === 'function' ? r.get('key') : r.key
      const value = typeof r.get === 'function' ? r.get('value') : r.value
      const type = typeof r.get === 'function' ? r.get('type') : (r.type || 'string')
      if (key === undefined || key === null) continue
      merged[key] = coerceValue(value, type)
    }
    cache.set(moduleName, { values: merged, ts: Date.now() })
    return merged
  } catch (e) {
    console.warn('[config] 读取模块失败，回退 env 默认:', moduleName, e && e.message)
    return defaults
  }
}

/**
 * 读取单值
 */
async function get(moduleName, key, fallback = undefined) {
  const cfg = await getModuleConfig(moduleName)
  return cfg[key] !== undefined && cfg[key] !== '' ? cfg[key] : fallback
}

/**
 * 写入单值（同步刷新缓存）
 * - value 自动 toString：boolean 存 'true'/'false'；object 走 JSON.stringify；数字直接 String
 */
async function set(moduleName, key, value, options = {}) {
  const storedValue = (() => {
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (typeof value === 'object' && value !== null) {
      try { return JSON.stringify(value) } catch (_) { return '' }
    }
    return value == null ? '' : String(value)
  })()
  let row = await Config.findOne({ where: { module: moduleName, key } })
  if (row) {
    // Sequelize 模式：instance.update；JSON 驱动：instance.update 已由 wrap 提供
    await row.update({ value: storedValue })
  } else {
    await Config.create({
      module: moduleName,
      key,
      value: storedValue,
      type: options.type || 'string',
      description: options.description || ''
    })
  }
  cache.delete(moduleName)
}

/**
 * 批量写入某模块配置
 */
async function setModule(moduleName, entries) {
  for (const [key, value] of Object.entries(entries)) {
    await set(moduleName, key, value)
  }
}

/**
 * 清空缓存（手动强制刷新）
 */
function clearCache(moduleName) {
  if (moduleName) cache.delete(moduleName)
  else cache.clear()
}

module.exports = {
  getModuleConfig,
  get,
  set,
  setModule,
  clearCache,
  ENV_DEFAULTS,
  // 对外暴露，方便管理后台的重置接口按模块失效缓存
  _cache: cache
}
