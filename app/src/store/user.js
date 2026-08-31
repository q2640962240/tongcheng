/** 用户状态 */
import { defineStore } from 'pinia'
import { getUser, setUser, removeToken, setToken, getToken } from '../utils/auth'
import { get, post } from '../utils/request'

/**
 * 懒加载 TIM SDK（避免 store 在非 H5 端 import 报错）
 * 返回一个 Promise，resolve 为 TIMManager 实例或 null（IM 未启用时）
 */
function lazyLoadTIM() {
  // #ifdef H5 || APP-PLUS || APP
  return import('../utils/im').then(m => m.default).catch(() => null)
  // #endif
  // #ifndef H5 || APP-PLUS || APP
  return Promise.resolve(null)
  // #endif
}

/**
 * 异步触发 TIM SDK 初始化与 login（不阻塞主流程）
 * 目的：让用户尽快被自动导入到腾讯云 IM 系统，避免发消息给不存在的对端时被拒
 */
let _timInitPromise = null
function kickOffTIMInit() {
  if (_timInitPromise) return _timInitPromise
  _timInitPromise = lazyLoadTIM().then(async (tim) => {
    if (!tim) return null
    try {
      await tim.ensureReady()
      return tim
    } catch (_) {
      return null
    }
  })
  return _timInitPromise
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
        setTimeout(() => kickOffTIMInit(), 500)
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
      setTimeout(() => { _timInitPromise = null; kickOffTIMInit() }, 300)
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
      setTimeout(() => { _timInitPromise = null; kickOffTIMInit() }, 300)
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
    logout() {
      removeToken()
      this.token = ''
      this.user = {}
      this.isElite = false
      uni.reLaunch({ url: '/pages/login/login' })
    }
  }
})
