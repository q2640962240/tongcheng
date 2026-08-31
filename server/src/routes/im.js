/**
 * 腾讯云即时通信 IM 路由
 *
 * GET  /api/im/config        — 获取前端初始化所需的非敏感配置（enabled + sdkAppId + imRegion）
 * POST /api/im/login         — 已登录用户获取 UserSig（服务端签发），返回 { userSig, sdkAppId, userId, expireAt }
 * POST /api/im/account-import  — (服务端) 为本项目 User 表用户导入 IM 账号，可选填 nick/avatar
 * POST /api/im/sendmsg       — (服务端) 通过 IM REST v3 单发一条单聊消息（C2C）
 */
const router = require('express').Router()
const { success, fail } = require('../utils/response')
const { auth } = require('../middleware/auth')
const { getModuleConfig } = require('../utils/config')
const { genUserSig } = require('../utils/im')
const { User } = require('../models')

/**
 * 内部：读取 IM 配置并校验核心字段
 * @returns {Promise<{cfg:Object,ready:boolean}>}
 */
async function loadImCfg() {
  const cfg = await getModuleConfig('im')
  const ready = !!(cfg && cfg.enabled && String(cfg.sdkAppId) && String(cfg.secretKey))
  return { cfg: cfg || {}, ready }
}

/**
 * GET /api/im/config
 * 返回前端用于判断是否启用腾讯云 IM 的非敏感字段
 */
router.get('/config', async (req, res, next) => {
  try {
    const { cfg, ready } = await loadImCfg()
    success(res, {
      enabled: !!cfg.enabled,
      ready,
      sdkAppId: cfg.sdkAppId ? String(cfg.sdkAppId) : '',
      imRegion: cfg.imRegion || 'ap-guangzhou'
    })
  } catch (e) { next(e) }
})

/**
 * GET /api/im/diag  — 排障专用（无需登录）
 * 返回 IM 模块在服务端的当前视图：配置是否齐全、userSig 签发算法、核心字段长度。
 * 用法：浏览器直接访问 https://zyb001.cn/api/im/diag 检查运营配置。
 */
router.get('/diag', async (req, res, next) => {
  try {
    const { cfg, ready } = await loadImCfg()
    const result = {
      module: 'im',
      enabled: !!cfg.enabled,
      ready,
      sdkAppId: cfg.sdkAppId ? String(cfg.sdkAppId) : '',
      sdkAppIdFilled: !!(cfg.sdkAppId && String(cfg.sdkAppId).trim()),
      secretKeyFilled: !!(cfg.secretKey && String(cfg.secretKey).trim()),
      secretKeyLen: cfg.secretKey ? String(cfg.secretKey).length : 0,
      expireSeconds: Number(cfg.expireSeconds) || 0,
      adminUserId: cfg.adminUserId || '',
      cloudSecretIdFilled: !!(cfg.cloudSecretId && String(cfg.cloudSecretId).trim()),
      cloudSecretKeyFilled: !!(cfg.cloudSecretKey && String(cfg.cloudSecretKey).trim()),
      signatureAlgorithm: 'HMAC-SHA256 / TLV1-base64url JWS 风格（utils/im genUserSig）',
      hint: ready
        ? 'IM 核心密钥齐全，前端登录后会调用 /api/im/login 取 userSig 并登录 TIM。'
        : (
          !cfg.enabled
            ? '未在配置中心启用 IM 模块：请在后台 配置中心 → 即时通信 IM 打开「启用 IM」开关。'
            : 'IM 必填未填：请在 https://zyb001.cn/admin/ 配置中心 → 即时通信 IM 填入 SDKAppID + 密钥 Key，保存后点「测试连通性」验证。'
        )
    }
    // 如果填齐全，顺带做一次 1 分钟有效期的签发自检（不把 userSig 回传，只返回长度/成功与否）
    if (ready) {
      try {
        const { genUserSig } = require('../utils/im')
        const sig = genUserSig({
          sdkAppId: Number(cfg.sdkAppId),
          userId: 'diag-probe-user',
          secretKey: String(cfg.secretKey),
          expireSeconds: 60
        })
        result.selfSignOk = true
        result.userSigLen = sig ? sig.length : 0
      } catch (e) {
        result.selfSignOk = false
        result.selfSignError = (e && e.message ? e.message : String(e)).slice(0, 160)
      }
    } else {
      result.selfSignOk = false
      result.selfSignError = 'skipped (核心密钥未填)'
    }
    success(res, result)
  } catch (e) { next(e) }
})

/**
 * POST /api/im/login (authRequired)
 * 登录用户向业务服务器换取用于登录腾讯云 TIM SDK 的 UserSig
 * 响应:
 *   {
 *     enabled, ready, sdkAppId, userId, userSig, expireAt(unix秒)
 *   }
 *  - 若 im.enabled=false 或配置不齐全，前端应该回退自建 WebSocket 聊天。
 */
router.post('/login', auth, async (req, res, next) => {
  try {
    const { cfg, ready } = await loadImCfg()
    if (!cfg.enabled) return success(res, { enabled: false, ready: false, sdkAppId: '' })
    if (!ready) return fail(res, 'IM 未正确配置，请联系管理员在后台「配置中心 → 即时通信 IM」填写 SDKAppID 与 密钥', 503)

    const userId = String(req.user && req.user.id ? req.user.id : (req.userId || ''))
    if (!userId) return fail(res, '未登录', 401)

    const expireSeconds = Number(cfg.expireSeconds) || 15552000
    const sdkAppId = Number(cfg.sdkAppId)
    const userSig = genUserSig({
      sdkAppId,
      userId,
      secretKey: String(cfg.secretKey),
      expireSeconds
    })
    const expireAt = Math.floor(Date.now() / 1000) + expireSeconds
    success(res, {
      enabled: true,
      ready: true,
      sdkAppId: String(sdkAppId),
      userId,
      userSig,
      expireAt
    })
  } catch (e) { next(e) }
})

/**
 * POST /api/im/account-import (authRequired)
 * 触发腾讯云 IM 账号导入（account_import REST v3）：
 * 将当前业务用户写入腾讯云 IM，后续可以正常登录并收发消息。
 *
 * 说明：
 *   - cloudSecretId / cloudSecretKey 已配置时，使用腾讯云 API v3 签名真实调用；
 *   - 未配置时返回 200，但 action=no-op，前端仍可继续（TIM SDK 首次 login 也会自动导入非黑名单用户）。
 */
router.post('/account-import', auth, async (req, res, next) => {
  try {
    const { cfg } = await loadImCfg()
    const user = await User.findByPk(req.user?.id || req.userId)
    if (!user) return fail(res, '用户不存在', 404)

    if (!cfg.cloudSecretId || !cfg.cloudSecretKey) {
      // 未配置云 API 密钥：跳过真实 REST，但仍然返回业务层面成功
      return success(res, {
        action: 'noop',
        reason: 'IM cloudSecretId/cloudSecretKey 未配置，跳过账号导入；首次 TIM.login 会自动导入非黑名单账号。',
        userId: String(user.id),
        nick: user.nickname || '',
        faceUrl: user.avatar || ''
      })
    }

    const result = await callCloudApi({
      cfg,
      service: 'ims',
      version: '2024-09-02',
      action: 'InvokeRESTAPI',
      region: cfg.imRegion || 'ap-guangzhou',
      payload: {
        Service: 'im_open_login_svc',
        Cmd: 'account_import',
        ClientIp: '',
        ApiIp: '',
        SDKAppID: Number(cfg.sdkAppId),
        Content: JSON.stringify({
          UserID: String(user.id),
          Nick: user.nickname || '',
          FaceUrl: user.avatar || ''
        })
      }
    })
    success(res, { action: 'import', userId: String(user.id), result })
  } catch (e) { next(e) }
})

/**
 * POST /api/im/sendmsg (authRequired)
 * 业务层通过腾讯云 IM 单聊 REST 接口（sendmsg）向某个 userId 发送一条文本消息。
 * 仅用于系统通知、订单提醒等服务端推送消息场景。
 *
 * Body:
 *   { toUserId: string, text: string, ext?: object }
 */
router.post('/sendmsg', auth, async (req, res, next) => {
  try {
    const { cfg, ready } = await loadImCfg()
    if (!cfg.enabled) return fail(res, 'IM 未启用', 503)
    if (!ready) return fail(res, 'IM 配置不齐全', 503)
    const { toUserId, text, ext } = req.body || {}
    if (!toUserId || !text) return fail(res, 'toUserId 与 text 必填', 400)

    if (!cfg.cloudSecretId || !cfg.cloudSecretKey) {
      return fail(res, 'IM cloudSecretId/cloudSecretKey 未配置，无法调用服务端单发消息 REST', 503)
    }
    const fromUserId = cfg.adminUserId || 'administrator'
    const msgBody = [{
      MsgType: 'TIMTextElem',
      MsgContent: { Text: String(text) }
    }]
    const payload = {
      SyncOtherMachine: 1,
      From_Account: String(fromUserId),
      To_Account: String(toUserId),
      MsgRandom: Math.floor(Math.random() * 0x7fffffff),
      MsgBody: msgBody
    }
    if (ext && typeof ext === 'object') payload.CloudCustomData = JSON.stringify(ext)

    const result = await callCloudApi({
      cfg,
      service: 'ims',
      version: '2024-09-02',
      action: 'InvokeRESTAPI',
      region: cfg.imRegion || 'ap-guangzhou',
      payload: {
        Service: 'openim',
        Cmd: 'sendmsg',
        ClientIp: '',
        ApiIp: '',
        SDKAppID: Number(cfg.sdkAppId),
        Content: JSON.stringify(payload)
      }
    })
    success(res, { fromUserId, toUserId, result })
  } catch (e) { next(e) }
})

/**
 * 腾讯云 API v3 TC3-HMAC-SHA256 签名 + HTTPS 请求（零依赖实现）
 * 仅用于 IM 相关 InvokeRESTAPI。可按需扩展到其它产品。
 */
async function callCloudApi({ cfg, service, version, action, region, payload }) {
  const https = require('https')
  const crypto = require('crypto')
  const SecretId = String(cfg.cloudSecretId)
  const SecretKey = String(cfg.cloudSecretKey)
  const now = new Date()
  const date = now.toISOString().slice(0, 10)                 // YYYY-MM-DD
  const timestamp = Math.floor(now.getTime() / 1000)         // unix 秒

  const host = `${service}.tencentcloudapi.com`
  const httpRequestMethod = 'POST'
  const canonicalUri = '/'
  const canonicalQuerystring = ''
  const ct = 'application/json; charset=utf-8'
  const payloadStr = JSON.stringify(payload || {})

  const hashedPayload = crypto.createHash('sha256').update(payloadStr).digest('hex')
  const canonicalHeaders =
    `content-type:${ct}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    hashedPayload
  ].join('\n')

  const algorithm = 'TC3-HMAC-SHA256'
  const credentialScope = `${date}/${service}/tc3_request`
  const hashedCR = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  const stringToSign = [
    algorithm,
    String(timestamp),
    credentialScope,
    hashedCR
  ].join('\n')

  function hmacSha256(key, data) {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
  }
  const secretDate = hmacSha256(Buffer.from(`TC3${SecretKey}`, 'utf8'), date)
  const secretService = hmacSha256(secretDate, service)
  const secretSigning = hmacSha256(secretService, 'tc3_request')
  const signature = crypto.createHmac('sha256', secretSigning)
    .update(stringToSign, 'utf8')
    .digest('hex')

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
    'X-TC-Version': version,
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
          const text = Buffer.concat(chunks).toString('utf8')
          resolve(JSON.parse(text))
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

module.exports = router
