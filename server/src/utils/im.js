/**
 * 腾讯云即时通信 IM (TIM) 服务端工具集
 *
 * 本文件严格按照腾讯云官方 tencentyun/tls-sig-api-v2-node（TLSSigAPIv2.js v2）
 * 原版算法实现，零第三方依赖（只用 Node 内置 crypto + zlib）。
 * 官方源码参考: https://github.com/tencentyun/tls-sig-api-v2-node/blob/master/TLSSigAPIv2.js
 *
 * 一、算法核心差异（之前踩的坑）：
 *   错误做法：标准 JWT 三片段 = base64url(header) + "." + base64url(payload) + "." + base64url(HMAC)
 *   正确做法：sigDoc JSON → zlib.deflateSync 压缩 → base64 → 自定义字符转义 (TLSSigAPIv2 规范)
 *     自定义转义表:  '+'  →  '*'
 *                    '/'  →  '-'
 *                    '='  →  '_'
 *   其中 sigDoc 内含 6 个 TLS.* 字段：
 *       'TLS.ver'        = "2.0"
 *       'TLS.identifier' = userId (字符串)
 *       'TLS.sdkappid'   = SDKAppID (数字)
 *       'TLS.time'       = currTime (签发时 unix 秒戳)
 *       'TLS.expire'     = expireSeconds (持续有效秒数, 最大 180 天=15552000)
 *       'TLS.sig'        = _hmacsha256( "TLS.identifier:xxx\nTLS.sdkappid:xxx\nTLS.time:xxx\nTLS.expire:xxx\n" , secretKey )
 *
 * 二、HMAC 输入是 "key:value\n" 换行拼接的纯文本（不是 JSON），签名结果做 base64（不是 base64url）
 * 三、最终 UserSig 长度一般为 200~400，首字符通常为字母或数字（base64 压缩后）。
 */

const crypto = require('crypto')
const zlib = require('zlib')

// ============================================================
// 工具函数：base64 + TLSSigAPIv2 自定义转义（严格与官方一致）
// ============================================================
function _newBuffer(fill, encoding) {
  return Buffer.from ? Buffer.from(fill, encoding) : Buffer.alloc(fill, encoding)
}

/**
 * 官方 TLSSigAPIv2 自定义 base64url 转义：
 *   '+' → '*',   '/' → '-',   '=' → '_'
 * 注意：这与标准 base64url (+→-, /→_, =移除) 完全不同！
 */
function _b64Escape(str) {
  return str
    .replace(/\+/g, '*')
    .replace(/\//g, '-')
    .replace(/=/g, '_')
}
function _b64Unescape(str) {
  return (str + Array(5 - (str.length % 4 || 4)))
    .replace(/_/g, '=')
    .replace(/-/g, '/')
    .replace(/\*/g, '+')
}
function _b64Encode(strOrBuf) {
  const buf = typeof strOrBuf === 'string' ? _newBuffer(strOrBuf) : strOrBuf
  return buf.toString('base64')
}
function _b64UrlEncode(strOrBuf) {
  return _b64Escape(_b64Encode(strOrBuf))
}

// ============================================================
// _hmacsha256：按照官方约定的 "key:value\n" 文本计算签名
// ============================================================
function _hmacsha256({ sdkAppId, identifier, currTime, expire, base64UserBuf, secretKey }) {
  let content = `TLS.identifier:${identifier}\n`
  content += `TLS.sdkappid:${sdkAppId}\n`
  content += `TLS.time:${currTime}\n`
  content += `TLS.expire:${expire}\n`
  if (base64UserBuf != null) {
    content += `TLS.userbuf:${base64UserBuf}\n`
  }
  const hmac = crypto.createHmac('sha256', String(secretKey))
  hmac.update(content, 'utf8')
  return hmac.digest('base64')
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 签发 UserSig（严格按腾讯云 TLSSigAPIv2 官方算法）
 *
 * @param {Object}  opts
 * @param {number|string} opts.sdkAppId      IM 应用 SDKAppID
 * @param {string}        opts.userId        用户 UserID (≤32 bytes, a-z/A-Z/0-9/_/-)
 * @param {string}        opts.secretKey     IM 密钥 Key
 * @param {number}       [opts.expireSeconds=15552000] 过期秒数，上限 180 天=15552000
 * @returns {string} userSig — 官方格式：zlib-deflate(sigDocJSON) → base64 → 自定义转义
 */
function genUserSig({ sdkAppId, userId, secretKey, expireSeconds = 15552000 }) {
  if (!sdkAppId || !userId || !secretKey) {
    throw new Error('[IM genUserSig] sdkAppId / userId / secretKey 必须全部提供')
  }
  const sdkAppIdNum = Number(sdkAppId)
  const uidStr = String(userId)
  // 注意：不能用 ||，否则 expireSeconds=0 会被当成"未传"而走默认值
  const numExp = Number(expireSeconds)
  const rawExp = (expireSeconds === undefined || expireSeconds === null || Number.isNaN(numExp))
    ? 15552000
    : numExp
  const safeExp = Math.min(Math.max(60, rawExp), 15552000) // 钳制 60s ~ 180 天
  const currTime = Math.floor(Date.now() / 1000)

  // 1. 构造 sigDoc
  const sigDoc = {
    'TLS.ver': '2.0',
    'TLS.identifier': uidStr,
    'TLS.sdkappid': sdkAppIdNum,
    'TLS.time': currTime,
    'TLS.expire': safeExp
  }

  // 2. 计算 HMAC 签名（签名对象是 key:value\n 文本，不是 JSON）
  const sig = _hmacsha256({
    sdkAppId: sdkAppIdNum,
    identifier: uidStr,
    currTime,
    expire: safeExp,
    base64UserBuf: null,
    secretKey
  })
  sigDoc['TLS.sig'] = sig

  // 3. JSON 序列化 → zlib deflate 压缩 → base64 → 官方自定义转义
  const jsonBuf = _newBuffer(JSON.stringify(sigDoc))
  const compressed = zlib.deflateSync(jsonBuf)
  const compressedB64 = _b64Encode(compressed)
  return _b64Escape(compressedB64)
}

/**
 * 签发 PrivateMapKey（TRTC 进房权限控制票据，可选功能，按需调用）
 * 当开启「启动权限密钥」开关后才需要，普通 IM 聊天无需使用。
 */
function genPrivateMapKey({ sdkAppId, userId, secretKey, expireSeconds, roomId, privilegeMap }) {
  const sdkAppIdNum = Number(sdkAppId)
  const uidStr = String(userId)
  const numExp = Number(expireSeconds)
  const rawExp = (expireSeconds === undefined || expireSeconds === null || Number.isNaN(numExp))
    ? 15552000
    : numExp
  const safeExp = Math.min(Math.max(60, rawExp), 15552000)
  const currTime = Math.floor(Date.now() / 1000)
  const roomNum = Number(roomId) || 0
  const privNum = Number(privilegeMap) || 255
  const accountType = 0

  const uidLen = uidStr.length
  const totalLen = 1 + 2 + uidLen + 20 // cVer(1) + wAccountLen(2) + buffAccount(N) + dwSdkAppid(4) + dwAuthId(4) + dwExpTime(4) + dwPrivilegeMap(4) + dwAccountType(4)
  const userBuf = Buffer.alloc(totalLen)
  let off = 0
  userBuf[off++] = 0 // cVer: 0 = 无字符串房间号
  userBuf[off++] = (uidLen & 0xFF00) >> 8
  userBuf[off++] = uidLen & 0x00FF
  for (let i = 0; i < uidLen; i++) userBuf[off++] = uidStr.charCodeAt(i) & 0xFF
  // dwSdkAppid
  userBuf[off++] = (sdkAppIdNum & 0xFF000000) >> 24
  userBuf[off++] = (sdkAppIdNum & 0x00FF0000) >> 16
  userBuf[off++] = (sdkAppIdNum & 0x0000FF00) >> 8
  userBuf[off++] = sdkAppIdNum & 0x000000FF
  // dwAuthId (roomId)
  userBuf[off++] = (roomNum & 0xFF000000) >> 24
  userBuf[off++] = (roomNum & 0x00FF0000) >> 16
  userBuf[off++] = (roomNum & 0x0000FF00) >> 8
  userBuf[off++] = roomNum & 0x000000FF
  // dwExpTime: now + expire
  const expAbs = currTime + safeExp
  userBuf[off++] = (expAbs & 0xFF000000) >> 24
  userBuf[off++] = (expAbs & 0x00FF0000) >> 16
  userBuf[off++] = (expAbs & 0x0000FF00) >> 8
  userBuf[off++] = expAbs & 0x000000FF
  // dwPrivilegeMap
  userBuf[off++] = (privNum & 0xFF000000) >> 24
  userBuf[off++] = (privNum & 0x00FF0000) >> 16
  userBuf[off++] = (privNum & 0x0000FF00) >> 8
  userBuf[off++] = privNum & 0x000000FF
  // dwAccountType
  userBuf[off++] = (accountType & 0xFF000000) >> 24
  userBuf[off++] = (accountType & 0x00FF0000) >> 16
  userBuf[off++] = (accountType & 0x0000FF00) >> 8
  userBuf[off++] = accountType & 0x000000FF

  const sigDoc = {
    'TLS.ver': '2.0',
    'TLS.identifier': uidStr,
    'TLS.sdkappid': sdkAppIdNum,
    'TLS.time': currTime,
    'TLS.expire': safeExp
  }
  const base64UserBuf = _b64Encode(userBuf)
  sigDoc['TLS.userbuf'] = base64UserBuf
  sigDoc['TLS.sig'] = _hmacsha256({
    sdkAppId: sdkAppIdNum,
    identifier: uidStr,
    currTime,
    expire: safeExp,
    base64UserBuf,
    secretKey
  })
  return _b64Escape(_b64Encode(zlib.deflateSync(_newBuffer(JSON.stringify(sigDoc)))))
}

// ============================================================
// 自检工具：解密 userSig 返回 payload（只用于服务端排障，SDK 不需要）
// ============================================================
function inspectUserSig(userSig) {
  try {
    const compressedB64 = _b64Unescape(String(userSig || ''))
    const compressed = _newBuffer(compressedB64, 'base64')
    const jsonBuf = zlib.inflateSync(compressed)
    return JSON.parse(jsonBuf.toString('utf8'))
  } catch (e) {
    return { error: (e && e.message) || String(e) }
  }
}

module.exports = {
  genUserSig,
  genPrivateMapKey,
  inspectUserSig,
  // 工具函数暴露方便测试
  _b64Escape,
  _b64Unescape,
  _hmacsha256
}
