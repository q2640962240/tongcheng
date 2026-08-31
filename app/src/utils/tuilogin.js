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
// #endif

let _loginPromise = null
let _lastUserId = ''

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

      await TUILogin.login({
        SDKAppID: Number(sdkAppId),
        userID: String(userId),
        userSig,
        framework: 'vue3'
      })

      _lastUserId = String(userId)
      console.log('[TUILogin] ✅ login success, userId=', userId)
      return { ok: true }
    } catch (e) {
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
