/** Token 管理 — 多端兼容存储 */
const TOKEN_KEY = 'companion_token'
const REFRESH_TOKEN_KEY = 'companion_refresh_token'
const USER_KEY = 'companion_user'

export const getToken = () => {
  try {
    return uni.getStorageSync(TOKEN_KEY)
  } catch {
    return ''
  }
}

export const getRefreshToken = () => {
  try {
    return uni.getStorageSync(REFRESH_TOKEN_KEY)
  } catch {
    return ''
  }
}

export const setToken = (token, refreshToken = '') => {
  try {
    uni.setStorageSync(TOKEN_KEY, token)
    if (refreshToken) uni.setStorageSync(REFRESH_TOKEN_KEY, refreshToken)
  } catch {}
}

export const removeToken = () => {
  try {
    uni.removeStorageSync(TOKEN_KEY)
    uni.removeStorageSync(REFRESH_TOKEN_KEY)
    uni.removeStorageSync(USER_KEY)
  } catch {}
}

export const getUser = () => {
  try {
    return JSON.parse(uni.getStorageSync(USER_KEY) || '{}')
  } catch {
    return {}
  }
}

export const setUser = (user) => {
  try {
    uni.setStorageSync(USER_KEY, JSON.stringify(user))
  } catch {}
}
