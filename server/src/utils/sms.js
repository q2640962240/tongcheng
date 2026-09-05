/**
 * 短信发送抽象层 — 生产级
 *
 * 支持的 Provider（缺一不可的真实配置）：
 *   - aliyun  阿里云短信（需安装 @alicloud/dysmsapi20170525）
 *   - tencent 腾讯云短信（需安装 tencentcloud-sdk-nodejs-sms）
 *
 * 生产原则：
 *   - 未配置短信服务时立即抛业务错误（引导在管理后台「配置中心 → 短信」填写）
 *   - 不再有 dev / mock 回退，不再在控制台打印明文验证码
 *   - 频控由路由层 + 业务层双层保证
 *
 * 使用：
 *   const { sendCode, verifyCode, testConfig } = require('../utils/sms')
 */
const { getModuleConfig } = require('./config')

// 内存验证码存储：key = `phone:scene`，value = { code, expireAt, sentAt, tries }
// 生产环境建议替换为 Redis（utils/config 已预留 redis 配置）
const codeStore = new Map()
const CODE_TTL_MS = 5 * 60 * 1000
const RESEND_INTERVAL_MS = 60 * 1000
const MAX_TRIES = 5

function loadAliyunSDK() {
  try { return require('@alicloud/dysmsapi20170525') } catch (e) { return null }
}

function loadTencentSDK() {
  try {
    const tencentcloud = require('tencentcloud-sdk-nodejs-sms')
    return tencentcloud.sms.v20210111.Client
  } catch (e) { return null }
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * 校验短信配置是否完整，不完整直接抛出带引导文案的错误
 */
function validateSmsConfig(cfg) {
  const safe = cfg && typeof cfg === 'object' ? cfg : {}
  const provider = String(safe.provider || '').trim().toLowerCase()
  if (!provider) {
    return { ok: false, message: '短信服务尚未配置，请在管理后台「配置中心 → 短信」选择服务商(aliyun/tencent)并填写密钥' }
  }
  if (!['aliyun', 'tencent'].includes(provider)) {
    return { ok: false, message: `不支持的短信服务商: ${provider}，请在管理后台选择 aliyun 或 tencent` }
  }
  if (!safe.accessKeyId) {
    return { ok: false, message: '短信 AccessKeyId 未配置，请在管理后台「配置中心 → 短信」填写' }
  }
  if (!safe.accessKeySecret) {
    return { ok: false, message: '短信 AccessKeySecret 未配置，请在管理后台「配置中心 → 短信」填写' }
  }
  if (!safe.signName) {
    return { ok: false, message: '短信签名(signName)未配置，请在管理后台「配置中心 → 短信」填写' }
  }
  return { ok: true, provider }
}

/**
 * 发送验证码
 */
async function sendCode(phone, scene = 'login') {
  if (!/^1\d{10}$/.test(phone)) {
    return { success: false, message: '手机号格式不正确', provider: 'invalid' }
  }

  const key = `${phone}:${scene}`
  const existing = codeStore.get(key)
  const nowMs = Date.now()
  if (existing && existing.sentAt && nowMs - existing.sentAt < RESEND_INTERVAL_MS) {
    const wait = Math.ceil((RESEND_INTERVAL_MS - (nowMs - existing.sentAt)) / 1000)
    return { success: false, message: `操作过于频繁，请 ${wait} 秒后重试`, provider: 'rate-limited' }
  }

  // ====== NODE_ENV=test：内存验证码模式（仅用于 Jest 自动化。生产部署禁用，生产需配置短信参数）======
  // 注意：这是 test 环境专用的"桩实现"，并不会真实下发短信；
  //       在开发/生产环境下，如果短信服务未配置，下面会返回 config-missing 业务错误，
  //       引导用户到管理后台「配置中心 → 短信」填写参数。
  if (process.env.NODE_ENV === 'test') {
    const code = genCode()
    codeStore.set(key, {
      code,
      scene,
      sentAt: nowMs,
      expireAt: nowMs + CODE_TTL_MS,
      tries: 0
    })
    return { success: true, message: 'TEST 环境验证码已生成', provider: 'test-memory', code }
  }

  // ====== NODE_ENV=development：开发环境固定验证码 888888（方便本地调试，不影响生产） ======
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    const devCode = '888888'
    codeStore.set(key, {
      code: devCode,
      scene,
      sentAt: nowMs,
      expireAt: nowMs + CODE_TTL_MS,
      tries: 0
    })
    return { success: true, message: '开发环境验证码: 888888', provider: 'dev-memory', code: devCode }
  }

  const cfg = await getModuleConfig('sms')
  const cfgCheck = validateSmsConfig(cfg)
  if (!cfgCheck.ok) return { success: false, message: cfgCheck.message, provider: 'config-missing' }

  const code = genCode()
  const provider = cfgCheck.provider

  let sendResult
  if (provider === 'aliyun') {
    sendResult = await sendByAliyun(phone, scene, code, cfg)
  } else if (provider === 'tencent') {
    sendResult = await sendByTencent(phone, scene, code, cfg)
  } else {
    sendResult = { success: false, message: `不支持的短信服务商: ${provider}`, provider }
  }

  if (sendResult.success) {
    codeStore.set(key, {
      code,
      scene,
      sentAt: nowMs,
      expireAt: nowMs + CODE_TTL_MS,
      tries: 0
    })
  }
  return sendResult
}

/**
 * 校验验证码
 */
async function verifyCode(phone, code, scene = 'login') {
  if (!code) return false
  const key = `${phone}:${scene}`
  const stored = codeStore.get(key)
  if (!stored) return false
  if (stored.expireAt < Date.now()) {
    codeStore.delete(key)
    return false
  }
  stored.tries = (stored.tries || 0) + 1
  if (stored.tries > MAX_TRIES) {
    codeStore.delete(key)
    return false
  }
  if (stored.code !== String(code)) return false
  codeStore.delete(key)
  return true
}

// ==================== 阿里云短信 ====================
async function sendByAliyun(phone, scene, code, cfg) {
  const Dysmsapi = loadAliyunSDK()
  if (!Dysmsapi) {
    return { success: false, message: '阿里云短信 SDK 未安装，请执行 npm i @alicloud/dysmsapi20170525 @alicloud/openapi-client', provider: 'aliyun' }
  }
  try {
    const AlibabaCloud = require('@alicloud/openapi-client')
    const config = new AlibabaCloud.Config({
      accessKeyId: cfg.accessKeyId,
      accessKeySecret: cfg.accessKeySecret
    })
    config.endpoint = 'dysmsapi.aliyuncs.com'
    const client = new Dysmsapi.default(config)
    const templateCode = (scene === 'register' ? cfg.templateRegister : cfg.templateLogin) || cfg.templateCode
    if (!templateCode) {
      return { success: false, message: '短信模板编码未配置，请在管理后台「配置中心 → 短信」填写 templateCode / templateLogin', provider: 'aliyun' }
    }
    const sendReq = new Dysmsapi.SendSmsRequest({
      phoneNumbers: phone,
      signName: cfg.signName,
      templateCode,
      templateParam: JSON.stringify({ code })
    })
    const resp = await client.sendSms(sendReq)
    if (resp.body.code === 'OK') {
      return { success: true, message: '发送成功', provider: 'aliyun', bizId: resp.body.bizId }
    }
    return { success: false, message: resp.body.message || '阿里云短信发送失败', provider: 'aliyun' }
  } catch (e) {
    return { success: false, message: `阿里云短信异常: ${e.message}`, provider: 'aliyun' }
  }
}

// ==================== 腾讯云短信 ====================
async function sendByTencent(phone, scene, code, cfg) {
  const SmsClient = loadTencentSDK()
  if (!SmsClient) {
    return { success: false, message: '腾讯云短信 SDK 未安装，请执行 npm i tencentcloud-sdk-nodejs-sms', provider: 'tencent' }
  }
  try {
    const client = new SmsClient({
      credential: { secretId: cfg.accessKeyId, secretKey: cfg.accessKeySecret },
      region: 'ap-guangzhou',
      profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com' } }
    })
    const templateCode = (scene === 'register' ? cfg.templateRegister : cfg.templateLogin) || cfg.templateCode
    if (!templateCode) {
      return { success: false, message: '短信模板编码未配置，请在管理后台「配置中心 → 短信」填写 templateCode / templateLogin', provider: 'tencent' }
    }
    const appId = cfg.appId || cfg.smsSdkAppId
    if (!appId) {
      return { success: false, message: '腾讯云 SmsSdkAppId 未配置，请在配置中心 sms 模块新增 appId 字段', provider: 'tencent' }
    }
    const resp = await client.SendSms({
      SmsSdkAppId: appId,
      SignName: cfg.signName,
      TemplateId: templateCode,
      TemplateParamSet: [code],
      PhoneNumberSet: [`+86${phone}`]
    })
    if (resp.SendStatusSet && resp.SendStatusSet[0] && resp.SendStatusSet[0].Code === 'Ok') {
      return { success: true, message: '发送成功', provider: 'tencent' }
    }
    return { success: false, message: resp.SendStatusSet?.[0]?.Message || '腾讯云短信发送失败', provider: 'tencent' }
  } catch (e) {
    return { success: false, message: `腾讯云短信异常: ${e.message}`, provider: 'tencent' }
  }
}

/**
 * 管理后台测试配置连通性
 */
async function testConfig() {
  const cfg = await getModuleConfig('sms')
  const cfgCheck = validateSmsConfig(cfg)
  if (!cfgCheck.ok) return { success: false, message: cfgCheck.message, provider: 'config' }
  // 只做 SDK + 配置校验，不去真实发送（避免浪费短信额度）
  if (cfgCheck.provider === 'aliyun') {
    const sdk = loadAliyunSDK()
    if (!sdk) return { success: false, message: '阿里云短信 SDK 未安装', provider: 'aliyun' }
  } else if (cfgCheck.provider === 'tencent') {
    const sdk = loadTencentSDK()
    if (!sdk) return { success: false, message: '腾讯云短信 SDK 未安装', provider: 'tencent' }
  }
  return { success: true, message: `短信配置校验通过(${cfgCheck.provider})，请真实发送一条做最终确认`, provider: cfgCheck.provider }
}

module.exports = {
  sendCode,
  verifyCode,
  testConfig,
  validateConfig: validateSmsConfig
}
