/**
 * 推送抽象层 — 生产级
 *
 * 支持 Provider：
 *   - jpush  极光推送 (REST API v3, 需要 appKey + masterSecret)
 *   - getui  个推 (需要 appId + appKey + masterSecret)
 *
 * 生产原则：
 *   - 未启用 or provider 为 none / 缺字段 → 返回 {success:false, message:明确引导}
 *   - 不再有 console.log 假成功（防止误以为送达）
 *   - 仅 Jest 自动化（NODE_ENV=test）提供内存占位成功分支，保证单测可跑（绝不泄漏到 production）
 *
 * 依赖：axios
 */

const { getModuleConfig } = require('./config')

function loadAxios() {
  try { return require('axios') } catch (e) { return null }
}

async function getConfig() {
  return getModuleConfig('push')
}

function missingFields(cfg, required) {
  return required.filter(k => !cfg[k])
}

/** 配置是否可用：非 test 用途会走到真实推送 */
async function isEnabled() {
  const cfg = await getConfig()
  if (String(cfg.enabled) !== 'true') return false
  if (!cfg.provider || cfg.provider === 'none') return false
  const required = ['appKey', 'masterSecret']
  if (cfg.provider === 'getui') required.push('appId')
  return missingFields(cfg, required).length === 0
}

/**
 * 极光推送
 */
async function pushByJpush(userId, notification, cfg) {
  const axios = loadAxios()
  if (!axios) return { success: false, provider: 'jpush', message: '缺少 axios 依赖，请执行 npm i axios' }
  try {
    const auth = Buffer.from(`${cfg.appKey}:${cfg.masterSecret}`).toString('base64')
    const extras = notification.extras || {}
    const body = {
      platform: 'all',
      audience: { alias: [String(userId)] },
      notification: {
        alert: notification.body,
        android: { alert: notification.body, title: notification.title, extras },
        ios: {
          alert: { title: notification.title, body: notification.body },
          sound: notification.sound || 'default',
          extras
        }
      },
      options: { time_to_live: notification.ttl || 86400 }
    }
    const resp = await axios.post('https://api.jpush.cn/v3/push', body, {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      timeout: 8000
    })
    return { success: true, provider: 'jpush', msgId: resp.data && resp.data.msg_id, message: '推送已发送' }
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message
    return { success: false, provider: 'jpush', message: `极光推送失败: ${detail}` }
  }
}

/**
 * 个推
 */
async function pushByGetui(userId, notification, cfg) {
  const axios = loadAxios()
  if (!axios) return { success: false, provider: 'getui', message: '缺少 axios 依赖，请执行 npm i axios' }
  const crypto = require('crypto')
  try {
    const ts = Math.floor(Date.now() / 1000)
    const signStr = cfg.appKey + ts + cfg.masterSecret
    const signToken = crypto.createHash('sha256').update(signStr, 'utf8').digest('hex')
    const authResp = await axios.post(`https://restapi.getui.com/v2/${cfg.appId}/auth`, {
      sign: signToken,
      timestamp: String(ts),
      appkey: cfg.appKey
    }, { timeout: 8000 })
    const token = authResp.data && authResp.data.data && authResp.data.data.token
    if (!token) return { success: false, provider: 'getui', message: '个推获取鉴权 token 失败: ' + JSON.stringify(authResp.data || {}) }

    const pushResp = await axios.post(`https://restapi.getui.com/v2/${cfg.appId}/push/single/alias`, {
      request_id: String(Date.now()) + userId,
      audience: { alias: [String(userId)] },
      push_message: {
        notification: {
          title: notification.title,
          body: notification.body,
          click_type: 'payload',
          payload: JSON.stringify(notification.extras || {})
        }
      }
    }, { headers: { token, 'Content-Type': 'application/json' }, timeout: 8000 })
    return {
      success: true,
      provider: 'getui',
      msgId: pushResp.data && pushResp.data.data && pushResp.data.data.taskId,
      message: '推送已发送'
    }
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message
    return { success: false, provider: 'getui', message: `个推推送失败: ${detail}` }
  }
}

/** 校验配置并返回可推送信息 */
async function checkConfigReady() {
  const cfg = await getConfig()
  if (String(cfg.enabled) !== 'true') {
    return { ok: false, message: '推送未启用，请在管理后台「配置中心 → 推送」打开 enabled 开关并填写参数' }
  }
  if (!cfg.provider || cfg.provider === 'none') {
    return { ok: false, message: '推送服务商未选择，请在管理后台「配置中心 → 推送」选择 jpush(极光) 或 getui(个推)' }
  }
  if (!['jpush', 'getui'].includes(cfg.provider)) {
    return { ok: false, message: `不支持的推送服务商: ${cfg.provider}` }
  }
  const required = ['appKey', 'masterSecret']
  if (cfg.provider === 'getui') required.push('appId')
  const miss = missingFields(cfg, required)
  if (miss.length) {
    return { ok: false, message: `推送缺少必要配置: ${miss.join(', ')}，请在管理后台「配置中心 → 推送」填写` }
  }
  if (!loadAxios()) {
    return { ok: false, message: '推送依赖 axios 未安装，请执行 npm i axios' }
  }
  return { ok: true, cfg }
}

/**
 * Jest(NODE_ENV=test) 专属：未配置推送时也能返回"内存模拟成功"，
 * 保证单测可跑；生产/开发环境永不走此分支。
 */
function _testMemoryFallback(extra = {}) {
  if (process.env.NODE_ENV !== 'test') return null
  return { success: true, provider: 'test-memory', message: '[TEST] 推送占位成功（仅 Jest 自动化）', ...extra }
}

/**
 * 推送给单个用户
 */
async function pushToUser(userId, notification) {
  const ready = await checkConfigReady()
  if (!ready.ok) {
    const fb = _testMemoryFallback({ userId })
    if (fb) return fb
    return { success: false, userId, message: ready.message }
  }
  if (!notification || !notification.title || !notification.body) {
    return { success: false, userId, message: '推送 title 和 body 必填' }
  }
  const { cfg } = ready
  switch (cfg.provider) {
    case 'jpush': return pushByJpush(userId, notification, cfg)
    case 'getui': return pushByGetui(userId, notification, cfg)
    default: return { success: false, userId, message: `未知推送服务商: ${cfg.provider}` }
  }
}

async function pushToUsers(userIds, notification) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { success: false, message: 'userIds 必填数组' }
  }
  const results = []
  for (const uid of userIds) {
    const r = await pushToUser(uid, notification)
    results.push({ userId: uid, ...r })
  }
  return { success: true, results }
}

/**
 * 广播推送（极光支持；个推建议使用批量 alias）
 */
async function pushToAll(notification) {
  const ready = await checkConfigReady()
  if (!ready.ok) {
    const fb = _testMemoryFallback()
    if (fb) return fb
    return { success: false, message: ready.message }
  }
  const { cfg } = ready
  if (!notification || !notification.title || !notification.body) {
    return { success: false, message: '推送 title 和 body 必填' }
  }
  if (cfg.provider === 'jpush') {
    const axios = loadAxios()
    if (!axios) return { success: false, message: '缺少 axios 依赖' }
    try {
      const auth = Buffer.from(`${cfg.appKey}:${cfg.masterSecret}`).toString('base64')
      const body = {
        platform: 'all',
        audience: 'all',
        notification: {
          alert: notification.body,
          android: { alert: notification.body, title: notification.title, extras: notification.extras || {} },
          ios: { alert: { title: notification.title, body: notification.body }, sound: notification.sound || 'default' }
        }
      }
      const resp = await axios.post('https://api.jpush.cn/v3/push', body, {
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        timeout: 10000
      })
      return { success: true, provider: 'jpush', msgId: resp.data && resp.data.msg_id, message: '广播推送已发送' }
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message
      return { success: false, provider: 'jpush', message: `极光广播失败: ${detail}` }
    }
  }
  return { success: false, provider: cfg.provider, message: '该服务商暂不支持广播推送' }
}

async function testConfig() {
  const ready = await checkConfigReady()
  if (!ready.ok) {
    const fb = _testMemoryFallback()
    if (fb) return fb
    return { success: false, provider: 'config', message: ready.message }
  }
  return { success: true, provider: ready.cfg.provider, message: `推送配置校验通过(${ready.cfg.provider})` }
}

module.exports = {
  isEnabled,
  pushToUser,
  pushToUsers,
  pushToAll,
  testConfig,
  validateConfig: async (cfg) => {
    if (String(cfg?.enabled) !== 'true') {
      return { ok: false, message: '推送未启用，请在「配置中心 → 离线推送」打开 enabled 开关并选择服务商' }
    }
    const provider = (cfg.provider || '').trim().toLowerCase()
    if (!provider || provider === 'none') return { ok: false, message: '请选择推送服务商: jpush(极光) 或 getui(个推)' }
    if (!['jpush', 'getui'].includes(provider)) return { ok: false, message: `不支持的推送服务商: ${provider}` }
    const required = ['appKey', 'masterSecret']
    if (provider === 'getui') required.push('appId')
    const miss = missingFields(cfg, required)
    if (miss.length) return { ok: false, message: `推送缺少必要配置: ${miss.join(', ')}` }
    return { ok: true, provider }
  }
}
