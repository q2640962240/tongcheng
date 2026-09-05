/**
 * 腾讯云 TUIKit 登录初始化工具
 *
 * 负责：从后端获取 IM 配置 + userSig → 调用 TUILogin.login()
 * 官方组件（TUIConversation / TUIChat / TUIGroup 等）依赖 TUILogin 完成 SDK 登录。
 *
 * 使用：
 *   import { ensureTUILogin, logoutTUILogin } from '@/utils/tuilogin'
 *   await ensureTUILogin()   // 在业务登录成功后调用
 */
import request from './request'
import { getToken } from './auth'

// #ifdef H5 || APP-PLUS || APP
import { TUILogin } from '@tencentcloud/tui-core-lite'
import TencentCloudChat from '@tencentcloud/chat'
// #endif

let _loginPromise = null
let _lastUserId = ''
let _attachedChat = null

// IM 连接状态：供其他模块查询当前连接情况
export let imConnectionStatus = 'disconnected' // 'connected' | 'connecting' | 'reconnecting' | 'disconnected'

// 出站消息回报去重：conversationID + lastSequence
const _syncedSeq = new Set()

/**
 * 监听会话列表更新：找出"我刚发出"的单聊消息，回报业务服务端落库。
 * 业务服务端据此维护会话列表/历史记录，并在对方是 AI 用户时触发自动回复。
 */
function _onConversationListUpdated(event) {
  const list = (event && event.data) || []
  let myUserId = ''
  try { myUserId = String((TUILogin.getContext() || {}).userID || '') } catch (_) { /* ignore */ }
  for (const conv of list) {
    try {
      if (!conv || conv.type !== 'C2C') continue
      const lm = conv.lastMessage
      if (!lm) continue
      // lite 版 SDK 会话的 lastMessage 无 flow 字段，用 fromAccount 判断方向
      const isOut = lm.flow === 'out' || (!!myUserId && String(lm.fromAccount) === myUserId)
      if (!isOut) continue
      const key = `${conv.conversationID}:${lm.lastSequence || lm.lastTime || ''}`
      if (_syncedSeq.has(key)) continue
      _syncedSeq.add(key)
      if (_syncedSeq.size > 500) {
        const first = _syncedSeq.values().next().value
        _syncedSeq.delete(first)
      }
      const toUserId = String(conv.conversationID).replace(/^C2C/, '')
      if (!toUserId) continue
      const timType = lm.type || 'TIMTextElem'
      if (timType === 'TIMCustomElem') continue
      const type = timType === 'TIMImageElem' ? 'image'
        : timType === 'TIMSoundElem' ? 'voice'
        : timType === 'TIMFileElem' ? 'file'
        : 'text'
      request({
        url: '/chat/im-sync',
        method: 'POST',
        data: {
          to: toUserId,
          type,
          content: String(lm.messageForShow || ''),
          timMsgTime: lm.lastTime || 0
        }
      }).catch(() => {})
    } catch (_) { /* 单条会话同步失败不影响其它 */ }
  }
}

function _attachOutgoingSync() {
  // #ifdef H5 || APP-PLUS || APP
  try {
    const ctx = TUILogin.getContext()
    const chat = ctx && ctx.chat
    if (!chat || typeof chat.on !== 'function') return
    if (_attachedChat === chat) return
    // 重新登录后 chat 实例会更换：先从旧实例解绑
    if (_attachedChat && typeof _attachedChat.off === 'function') {
      try { _attachedChat.off(TencentCloudChat.EVENT.CONVERSATION_LIST_UPDATED, _onConversationListUpdated) } catch (_) { /* ignore */ }
    }
    chat.on(TencentCloudChat.EVENT.CONVERSATION_LIST_UPDATED, _onConversationListUpdated)
    _attachedChat = chat
  } catch (_) { /* ignore */ }
  // #endif
}

/**
 * 确保 TUILogin 已完成登录
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function ensureTUILogin() {
  // #ifdef H5 || APP-PLUS || APP
  // 如果已经登录过同一个用户，直接返回
  try {
    const ctx = TUILogin.getContext()
    if (ctx && ctx.chat && ctx.chat.isReady && ctx.chat.isReady() && _lastUserId === String(ctx.userID)) {
      _attachOutgoingSync()
      return { ok: true, cached: true }
    }
  } catch (_) { /* ignore */ }

  // 避免并发重复登录
  if (_loginPromise) return _loginPromise

  _loginPromise = (async () => {
    try {
      // 1. 获取 IM 配置
      let cfg = { enabled: false, ready: false, sdkAppId: '' }
      try {
        const r1 = await request({ url: '/im/config', method: 'GET', skipAuth: true })
        if (r1 && r1.data) cfg = r1.data
      } catch (e) {
        console.warn('[TUILogin] /config fail', e && e.message)
      }

      if (!cfg.enabled) return { ok: false, reason: 'IM 未在服务端启用' }
      if (!cfg.ready) return { ok: false, reason: 'IM 配置不齐全（SDKAppID / 密钥未填）' }
      if (!getToken()) return { ok: false, reason: '未登录' }

      // 2. 获取 userSig
      let loginRes
      try {
        loginRes = await request({ url: '/im/login', method: 'POST' })
      } catch (e) {
        console.warn('[TUILogin] /login fail', e && e.message)
        return { ok: false, reason: '获取 userSig 失败：' + (e && e.message) }
      }

      if (!loginRes || !loginRes.data || !loginRes.data.userSig) {
        return { ok: false, reason: 'userSig 为空' }
      }

      const { sdkAppId, userId, userSig } = loginRes.data

      // 3. 先登出（如果已有旧登录），再重新登录
      try { await TUILogin.logout() } catch (_) { /* ignore */ }

      // 4. 登录（带一次重试：首次超时/失败后等 3s 再试一次）
      const loginParams = {
        SDKAppID: Number(sdkAppId),
        userID: String(userId),
        userSig,
        framework: 'vue3'
      }

      async function _tryLoginWithRetry() {
        try {
          imConnectionStatus = 'connecting'
          await TUILogin.login(loginParams)
          imConnectionStatus = 'connected'
          return { ok: true }
        } catch (firstErr) {
          console.warn('[TUILogin] first login attempt failed, retrying in 3s...', firstErr)
          imConnectionStatus = 'reconnecting'
          await new Promise(r => setTimeout(r, 3000))
          try {
            await TUILogin.login(loginParams)
            imConnectionStatus = 'connected'
            return { ok: true, retried: true }
          } catch (retryErr) {
            imConnectionStatus = 'disconnected'
            throw retryErr
          }
        }
      }

      await _tryLoginWithRetry()

      _lastUserId = String(userId)
      console.log('[TUILogin] ✅ login success, userId=', userId)
      _attachOutgoingSync()
      return { ok: true }
    } catch (e) {
      imConnectionStatus = 'disconnected'
      console.warn('[TUILogin] login fail', e)
      return { ok: false, reason: (e && e.message) || String(e) }
    } finally {
      _loginPromise = null
    }
  })()

  return _loginPromise
  // #endif
  // #ifndef H5 || APP-PLUS || APP
  // 小程序端：entry-chat-only.ts 在页面 onLoad 时自动初始化
  return { ok: true, platform: 'mp-weixin' }
  // #endif
}

/**
 * 登出 TUIKit
 */
export async function logoutTUILogin() {
  // #ifdef H5 || APP-PLUS || APP
  try {
    if (_attachedChat && typeof _attachedChat.off === 'function') {
      _attachedChat.off(TencentCloudChat.EVENT.CONVERSATION_LIST_UPDATED, _onConversationListUpdated)
    }
  } catch (_) { /* ignore */ }
  _attachedChat = null
  try {
    await TUILogin.logout()
  } catch (_) { /* ignore */ }
  _lastUserId = ''
  _loginPromise = null
  // #endif
}

/**
 * 获取 TUILogin 上下文
 */
export function getTUILoginContext() {
  // #ifdef H5 || APP-PLUS || APP
  try {
    return TUILogin.getContext()
  } catch (_) {
    return null
  }
  // #endif
  // #ifndef H5 || APP-PLUS || APP
  return null
  // #endif
}
