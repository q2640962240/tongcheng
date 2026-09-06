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

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// 不能用 atob：App 端逻辑层跑在 JSCore/V8 里，没有任何浏览器全局（见 AGENTS.md 坑点 17）
function b64UrlToAscii(input) {
  const clean = String(input).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  let bits = 0
  let acc = 0
  let out = ''
  for (let i = 0; i < clean.length; i++) {
    const idx = B64_CHARS.indexOf(clean[i])
    if (idx < 0) continue
    acc = (acc << 6) | idx
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out += String.fromCharCode((acc >> bits) & 0xff)
    }
  }
  return out
}

/**
 * 当前登录用户 id。
 *
 * 不要改用 getUser().id：H5 端 uni.getStorageSync 会把存的 JSON 字符串自动解析成对象，
 * getUser() 里的 JSON.parse 于是收到一个对象、抛 SyntaxError、恒返回 {}。
 * 这里直接解 JWT 的 payload（服务端签的就是 {id, iat, exp}），三端一致且不依赖存储行为。
 */
export const getUserId = () => {
  try {
    const u = getUser()
    if (u && u.id) return u.id
  } catch {}
  try {
    const parts = String(getToken() || '').split('.')
    if (parts.length !== 3) return ''
    const m = b64UrlToAscii(parts[1]).match(/"id"\s*:\s*(\d+)/)
    return m ? Number(m[1]) : ''
  } catch {
    return ''
  }
}

export const setUser = (user) => {
  try {
    uni.setStorageSync(USER_KEY, JSON.stringify(user))
  } catch {}
}
