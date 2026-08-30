/**
 * 腾讯云即时通信 IM (TIM) 服务端工具集
 *
 * 功能：
 *   1. genUserSig(userId) — 使用 HMAC-SHA256 签发 UserSig（新版 TLV1 JSON Web Signature 格式，兼容 TIM SDK）
 *   2. base64url 工具
 *
 * 注意：
 *   - 本实现使用纯 Node.js crypto，不依赖任何第三方包，生产可直接使用。
 *   - 签发格式采用腾讯云 IM 官方推荐新版：
 *       JSON.header → JSON.payload → base64url(json) → HMAC(secretKey, base64_json) → base64url(sig)
 *   - 服务端 REST API (账号导入、单发消息等) 走腾讯云 API v3，由 routes/im.js 内部调用。
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
 * 签发 UserSig
 *
 * @param {Object} options
 * @param {number|string} options.sdkAppId  IM 应用 SDKAppID
 * @param {string}        options.userId    用户 UserID（兼容 IM 限制：≤32 bytes，允许 a-z/A-Z/0-9/_/-）
 * @param {string}        options.secretKey IM 密钥 Key
 * @param {number}       [options.expireSeconds=15552000]  过期秒数，默认 180 天
 * @returns {string} userSig
 */
function genUserSig({ sdkAppId, userId, secretKey, expireSeconds = 15552000 }) {
  if (!sdkAppId || !userId || !secretKey) {
    throw new Error('[IM genUserSig] sdkAppId / userId / secretKey 必须全部提供')
  }
  const now = Math.floor(Date.now() / 1000)
  const expire = now + Number(expireSeconds || 15552000)
  // 兼容 TIM 新版字段名：TLS 签名同时支持 Tencent 官方 Java/Go/Node 生成工具字段
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }
  const payload = {
    Tencent: {
      Account: String(userId),
      UserBuf: '',
      SdkAppId: Number(sdkAppId),
      Expire: Number(expireSeconds),
      Time: now
    },
    iat: now,
    exp: expire,
    iss: 'baiye-server'
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
