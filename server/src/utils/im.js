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

// ============================================================
// 服务端 REST 调用（账号导入 / 单发消息），需要腾讯云 API 密钥
//   cloudSecretId / cloudSecretKey 来自「配置中心 → 即时通信 IM」
//   （注意：区别于签发 UserSig 用的 secretKey，两者是不同的密钥）
// ============================================================

/**
 * TC3-HMAC-SHA256 签名 + HTTPS 请求，调用腾讯云 IM 的 InvokeRESTAPI（账号导入/单发消息等）。
 * 未配置 cloudSecretId/cloudSecretKey 时返回 { noop:true } 而不发真实请求。
 */
function callImCloudApi({ cfg, service, action, region, payload }) {
  const SecretId = String((cfg && cfg.cloudSecretId) || '').trim()
  const SecretKey = String((cfg && cfg.cloudSecretKey) || '').trim()
  if (!SecretId || !SecretKey) {
    return Promise.resolve({ noop: true, reason: 'IM cloudSecretId/cloudSecretKey 未配置，跳过服务端 REST 调用' })
  }

  const https = require('https')
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const timestamp = Math.floor(now.getTime() / 1000)
  const host = `${service}.tencentcloudapi.com`
  const httpRequestMethod = 'POST'
  const canonicalUri = '/'
  const canonicalQuerystring = ''
  const ct = 'application/json; charset=utf-8'
  const payloadStr = JSON.stringify(payload || {})

  const hashedPayload = crypto.createHash('sha256').update(payloadStr).digest('hex')
  const canonicalHeaders = `content-type:${ct}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = [httpRequestMethod, canonicalUri, canonicalQuerystring, canonicalHeaders, signedHeaders, hashedPayload].join('\n')

  const algorithm = 'TC3-HMAC-SHA256'
  const credentialScope = `${date}/${service}/tc3_request`
  const hashedCR = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  const stringToSign = [algorithm, String(timestamp), credentialScope, hashedCR].join('\n')

  const hmacSha256 = (key, data) => crypto.createHmac('sha256', key).update(data, 'utf8').digest()
  const secretDate = hmacSha256(Buffer.from(`TC3${SecretKey}`, 'utf8'), date)
  const secretService = hmacSha256(secretDate, service)
  const secretSigning = hmacSha256(secretService, 'tc3_request')
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign, 'utf8').digest('hex')

  const authorization = [
    `${algorithm} Credential=${SecretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ')

  const headers = {
    'Host': host,
    'Content-Type': ct,
    'X-TC-Action': action,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': '2024-09-02',
    'X-TC-Region': region || '',
    'Authorization': authorization,
    'Content-Length': Buffer.byteLength(payloadStr, 'utf8')
  }

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      port: 443,
      path: '/',
      method: 'POST',
      headers,
      timeout: 10000
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (e) {
          reject(new Error(`IM REST 响应非 JSON: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(new Error('IM REST 调用超时')) })
    req.write(payloadStr)
    req.end()
  })
}

/**
 * TIM 头像字段(Tag_Profile_IM_Image)限长 500 字节且无法渲染 data: 内联图。
 * 本项目种子头像为 SVG data URI，直接导入会报 ErrorCode 40601 导致
 * 整个 account_import 失败（连昵称也写不进去），这里统一清洗。
 */
function _safeFaceUrl(u) {
  const s = String(u || '').trim()
  if (!s) return ''
  if (/^data:/i.test(s)) return ''
  return Buffer.byteLength(s, 'utf8') > 500 ? '' : s
}

/**
 * 导入单个用户账号到腾讯云 IM（account_import）。
 * 幂等：腾讯云 IM 对已存在的账号重复导入会直接成功（更新昵称/头像）。
 * @param {Object} opts
 * @param {Object} opts.cfg          IM 模块配置（含 sdkAppId / cloudSecretId / cloudSecretKey / imRegion）
 * @param {string|number} opts.userId  业务用户 ID
 * @param {string} [opts.nick]      昵称
 * @param {string} [opts.faceUrl]   头像
 * @returns {Promise<{action:'import'|'noop', userId?:string, result?:object, reason?:string}>}
 */
async function importIMAccount({ cfg, userId, nick, faceUrl }) {
  if (!cfg || !cfg.cloudSecretId || !cfg.cloudSecretKey) {
    return { action: 'noop', reason: 'IM cloudSecretId/cloudSecretKey 未配置，跳过账号导入' }
  }
  try {
    const result = await callImCloudApi({
      cfg,
      service: 'ims',
      action: 'InvokeRESTAPI',
      region: cfg.imRegion || 'ap-guangzhou',
      payload: {
        Service: 'im_open_login_svc',
        Cmd: 'account_import',
        ClientIp: '',
        ApiIp: '',
        SDKAppID: Number(cfg.sdkAppId),
        Content: JSON.stringify({
          UserID: String(userId),
          Nick: nick || '',
          FaceUrl: _safeFaceUrl(faceUrl)
        })
      }
    })
    return { action: 'import', userId: String(userId), result }
  } catch (e) {
    return { action: 'import', userId: String(userId), result: { error: (e && e.message) || String(e) } }
  }
}

// ============================================================
// 老版 IM REST（v4 签名）：只需 SDKAppID + 密钥 Key（无需腾讯云 API 密钥）
//   URL: https://console.tim.qq.com/v4/{service}/{cmd}
//        ?sdkappid=&identifier=&usersig=&random=&contenttype=json
//   usersig 即 TLSSigAPIv2 为 identifier 签发的 UserSig（短有效期即可）
// ============================================================

/**
 * 调用老版 IM REST v4 接口
 * @param {Object} opts
 * @param {Object} opts.cfg        IM 模块配置（sdkAppId / secretKey）
 * @param {string} opts.identifier 操作者 UserID（须与 usersig 一致）
 * @param {string} opts.service    例如 openim / im_open_login_svc
 * @param {string} opts.cmd        例如 sendmsg / account_import
 * @param {Object} opts.body       JSON 请求体
 * @returns {Promise<Object>}      腾讯返回 JSON（含 ActionStatus/ErrorCode/ErrorInfo）
 */
function callImRestV4({ cfg, identifier, service, cmd, body }) {
  if (!cfg || !cfg.sdkAppId || !cfg.secretKey) {
    return Promise.resolve({ noop: true, reason: 'IM 未启用或 SDKAppID/密钥未配置' })
  }
  const usersig = genUserSig({
    sdkAppId: Number(cfg.sdkAppId),
    userId: String(identifier),
    secretKey: String(cfg.secretKey),
    expireSeconds: 600
  })
  const random = Math.floor(Math.random() * 0x7fffffff)
  const qs = [
    `sdkappid=${encodeURIComponent(Number(cfg.sdkAppId))}`,
    `identifier=${encodeURIComponent(String(identifier))}`,
    `usersig=${encodeURIComponent(usersig)}`,
    `random=${random}`,
    'contenttype=json'
  ].join('&')
  const payloadStr = JSON.stringify(body || {})
  const hostname = 'console.tim.qq.com'
  const path = `/v4/${service}/${cmd}?${qs}`

  return new Promise((resolve, reject) => {
    const req = require('https').request({
      hostname,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payloadStr, 'utf8')
      },
      timeout: 10000
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (e) {
          reject(new Error(`IM v4 REST 响应非 JSON: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(new Error('IM v4 REST 调用超时')) })
    req.write(payloadStr)
    req.end()
  })
}

/**
 * 老版 REST 账号导入（保证用户在腾讯云 IM 中存在，发消息不报 20009/20003）
 */
function importIMAccountV4({ cfg, userId, nick, faceUrl }) {
  return callImRestV4({
    cfg,
    identifier: String((cfg && cfg.adminUserId) || 'administrator'),
    service: 'im_open_login_svc',
    cmd: 'account_import',
    body: {
      UserID: String(userId),
      Nick: nick || '',
      FaceUrl: _safeFaceUrl(faceUrl)
    }
  })
}

/**
 * 老版 REST 以 fromUserId 身份单发一条文本消息给 toUserId
 * 注意：v4 REST 的 identifier 必须是应用管理员账号（60010），
 * 真实发送者通过请求体 From_Account 指定。
 */
function sendIMC2CTextV4({ cfg, fromUserId, toUserId, text }) {
  return callImRestV4({
    cfg,
    identifier: String((cfg && cfg.adminUserId) || 'administrator'),
    service: 'openim',
    cmd: 'sendmsg',
    body: {
      SyncOtherMachine: 2,
      From_Account: String(fromUserId),
      To_Account: String(toUserId),
      MsgRandom: Math.floor(Math.random() * 0x7fffffff),
      MsgBody: [{ MsgType: 'TIMTextElem', MsgContent: { Text: String(text) } }]
    }
  })
}

/**
 * 老版 REST 以 fromUserId 身份单发一条自定义消息给 toUserId
 * 用于礼物卡片等非文本消息。MsgBody 为 TIMCustomElem。
 */
function sendIMC2CCustomV4({ cfg, fromUserId, toUserId, data, desc }) {
  return callImRestV4({
    cfg,
    identifier: String((cfg && cfg.adminUserId) || 'administrator'),
    service: 'openim',
    cmd: 'sendmsg',
    body: {
      SyncOtherMachine: 2,
      From_Account: String(fromUserId),
      To_Account: String(toUserId),
      MsgRandom: Math.floor(Math.random() * 0x7fffffff),
      MsgBody: [{
        MsgType: 'TIMCustomElem',
        MsgContent: {
          Data: Buffer.from(JSON.stringify(data)).toString('base64'),
          Desc: String(desc || ''),
          Ext: '',
          Sound: ''
        }
      }]
    }
  })
}

module.exports = {
  genUserSig,
  genPrivateMapKey,
  inspectUserSig,
  importIMAccount,
  callImCloudApi,
  callImRestV4,
  importIMAccountV4,
  sendIMC2CTextV4,
  sendIMC2CCustomV4,
  // 工具函数暴露方便测试
  _b64Escape,
  _b64Unescape,
  _hmacsha256
}
