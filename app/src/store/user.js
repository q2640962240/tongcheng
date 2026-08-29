/** 用户状态 */
import { defineStore } from 'pinia'
import { getUser, setUser, removeToken, setToken, getToken } from '../utils/auth'
import { get, post } from '../utils/request'

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
