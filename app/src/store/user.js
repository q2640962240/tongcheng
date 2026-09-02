/** 用户状态 */
import { defineStore } from 'pinia'
import { getUser, setUser, removeToken, setToken, getToken } from '../utils/auth'
import { get, post } from '../utils/request'
import { ensureTUILogin, logoutTUILogin } from '../utils/tuilogin'

/**
 * 异步触发 TUIKit 登录初始化（不阻塞主流程）
 * 目的：让官方 chat-uikit-uniapp 组件可用，自动将用户导入腾讯云 IM
 */
let _tuiInitPromise = null
function kickOffTUIInit() {
  if (_tuiInitPromise) return _tuiInitPromise
  _tuiInitPromise = ensureTUILogin().then((r) => {
    if (r && !r.ok) console.warn('[userStore] TUIKit login:', r.reason)
    return r
  })
  return _tuiInitPromise
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    user: getUser(),
    isElite: false,
    certifications: {
      realPerson: 'passed',   // 真人认证
      identity: 'none'         // 身份认证
    }
  }),
  getters: {
    isLoggedIn: (state) => !!state.user.id || !!state.token,
    userId: (state) => state.user.id,
    nickname: (state) => state.user.nickname || '游客',
    avatar: (state) => state.user.avatar || ''
  },
  actions: {
    /** 恢复会话 */
    restoreSession() {
      this.token = getToken()
      this.user = getUser()
      if (this.user && this.user.isElite) this.isElite = true
      // 已有登录态 → 异步触发 TIM SDK init + login（让用户被自动导入 IM）
      if (this.token && this.user && this.user.id) {
        setTimeout(() => kickOffTUIInit(), 500)
        // 异步刷新最新用户信息（含 isElite/认证状态），避免管理后台通过精英后前端状态不同步
        this.fetchProfile().catch(() => {})
      }
    },

    /** 短信验证码登录 */
    async loginByCode(phone, code) {
      const res = await post('/auth/login', { phone, code })
      const { token, refreshToken, user } = res.data || {}
      setToken(token || '', refreshToken || '')
      this.token = token || ''
      this.user = user || {}
      this.isElite = (user && user.isElite) || false
      setUser(user || {})
      // 登录成功 → 异步触发 TIM SDK init + login
      setTimeout(() => { _tuiInitPromise = null; kickOffTUIInit() }, 300)
      // 登录成功 → 挂载全局消息提醒（角标 + 震动）
      import('../utils/msgNotify').then((m) => m.setupGlobalMsgNotify()).catch(() => {})
      return res.data
    },

    /** 密码登录 */
    async loginByPassword(phone, password) {
      const res = await post('/auth/login-password', { phone, password })
      const { token, refreshToken, user } = res.data || {}
      setToken(token || '', refreshToken || '')
      this.token = token || ''
      this.user = user || {}
      this.isElite = (user && user.isElite) || false
      setUser(user || {})
      // 登录成功 → 异步触发 TIM SDK init + login
      setTimeout(() => { _tuiInitPromise = null; kickOffTUIInit() }, 300)
      // 登录成功 → 挂载全局消息提醒（角标 + 震动）
      import('../utils/msgNotify').then((m) => m.setupGlobalMsgNotify()).catch(() => {})
      return res.data
    },

    /** 发送验证码 */
    async sendCode(phone) {
      const res = await post('/auth/sms', { phone })
      return res.data
    },

    /** 获取用户信息 */
    async fetchProfile() {
      const res = await get('/user/profile')
      this.user = res.data
      this.isElite = res.data.isElite || false
      setUser(res.data)
      return res.data
    },

    /** 申请精英认证 */
    async applyElite(payload) {
      const res = await post('/user/elite/apply', payload)
      return res
    },

    /** 退出登录 */
    async logout() {
      try { const m = await import('../utils/msgNotify'); m.teardownGlobalMsgNotify() } catch (_) {}
      await logoutTUILogin()
      removeToken()
      this.token = ''
      this.user = {}
      this.isElite = false
      uni.reLaunch({ url: '/pages/login/login' })
    }
  }
})
