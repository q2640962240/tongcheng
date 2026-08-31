/**
 * 腾讯云即时通信 IM (TIM) 服务端工具集
 *
 * 功能：
 *   1. genUserSig(userId) — 使用标准 JWT (HS256) 签发 UserSig，兼容 TIM SDK v2.10+（新版 SDK 只认扁平 TLS.xxx 字段）
 *   2. base64url 工具
 *
 * 注意：
 *   - 本实现使用纯 Node.js crypto，不依赖任何第三方包，生产可直接使用。
 *   - 签发格式：标准 JWT = base64url(header) + "." + base64url(payload) + "." + base64url(HS256_signature)
 *   - 兼容策略：payload 同时写入【新版 SDK 必需的扁平 TLS.xxx 字段 5 项】+【老版嵌套 Tencent 对象】，向前向后双保险。
 *   - 新增 nbf: now-60，容忍服务器与腾讯云 UTC 时钟偏差 ≤60 秒（避免"signature not valid yet"类错误）。
 */
const crypto = require('crypto')

function base64UrlEncode(buf) {
  if (typeof buf === 'string') buf = Buffer.from(buf, 'utf8')
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const base64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64')
}

/**
 * 签发 UserSig（标准 JWT HS256 — 新版腾讯云 IM SDK 唯一识别格式）
 *
 * 新版 IM SDK（v2.10+ / tim-js-sdk / tim-wx-sdk）验证 UserSig 时 payload 必须包含
 * 扁平前缀字段（注意大小写严格匹配 SDK 内部解析）：
 *     TLS.ver        = "2.0"                    [必填，固定字符串]
 *     TLS.identifier = 业务 userId              [必填，字符串]
 *     TLS.sdkappid   = 数字 SDKAppID            [必填，Number]
 *     TLS.expire     = 持续有效秒数 expireSeconds [必填，Number，最大 180 天 = 15552000]
 *     TLS.time       = 签发时 unix 秒戳          [必填，当前时间]
 * 为了兼容可能仍在使用老版签名格式的边缘场景，同步写入嵌套 Tencent 对象作为双保险。
 *
 * @param {Object} options
 * @param {number|string} options.sdkAppId  IM 应用 SDKAppID
 * @param {string}        options.userId    用户 UserID（兼容 IM 限制：≤32 bytes，允许 a-z/A-Z/0-9/_/-）
 * @param {string}        options.secretKey IM 密钥 Key
 * @param {number}       [options.expireSeconds=15552000]  过期秒数，默认 180 天（IM 官方上限 180 天 = 15552000）
 * @returns {string} userSig  — 标准三片段 JWT：xxx.yyy.zzz
 */
function genUserSig({ sdkAppId, userId, secretKey, expireSeconds = 15552000 }) {
  if (!sdkAppId || !userId || !secretKey) {
    throw new Error('[IM genUserSig] sdkAppId / userId / secretKey 必须全部提供')
  }
  const rawExp = Number(expireSeconds) || 15552000
  // 安全钳制：超过 IM 官方上限 180 天=15552000 秒时，自动截断到上限（SDK 会拒绝超上限签名）
  const safeExp = Math.min(Math.max(60, rawExp), 15552000)
  const now = Math.floor(Date.now() / 1000)
  const expireAt = now + safeExp

  // header: 标准 JWT + HS256（与腾讯云所有版本 SDK 一致）
  const header = { alg: 'HS256', typ: 'JWT' }

  // payload: 【TLS 扁平字段（新版 SDK 必需）】 + 【Tencent 嵌套对象（老版兼容）】 + 【JWT 标准字段】
  const sdkIdNum = Number(sdkAppId)
  const uidStr = String(userId)
  const payload = {
    // ========== 新版 IM SDK (v2.10+) 必需要求：TLS.xxx 扁平字段 5 项（缺任一直接判 illegal）==========
    'TLS.ver': '2.0',
    'TLS.identifier': uidStr,
    'TLS.sdkappid': sdkIdNum,
    'TLS.expire': safeExp,           // 注意：是"持续有效期秒数"，不是时间戳！
    'TLS.time': now,

    // ========== 老版 Tencent SDK (v1.x 格式) 嵌套对象 — 向前兼容 ==========
    Tencent: {
      Account: uidStr,
      UserBuf: '',
      SdkAppId: sdkIdNum,
      Expire: safeExp,
      Time: now
    },

    // ========== 标准 JWT 字段（可选但带上更稳，容忍 NTP 偏差）==========
    iat: now,                        // JWT 签发时间
    exp: expireAt,                   // JWT 到期时间戳（与 TLS.expire 语义不同：exp 是时间戳）
    nbf: Math.max(0, now - 60),      // not-before：允许 60 秒服务器时钟偏差（与腾讯云 UTC 不同步的常见坑）
    iss: 'baiye-server'              // 签发方标识（自定义，可忽略）
  }

  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`
  const hmac = crypto.createHmac('sha256', String(secretKey))
  hmac.update(signingInput)
  const sigB64 = base64UrlEncode(hmac.digest())
  return `${headerB64}.${payloadB64}.${sigB64}`
}

module.exports = {
  genUserSig,
  base64UrlEncode,
  base64UrlDecode
}
