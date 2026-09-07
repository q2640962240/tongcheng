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
    // 这里读到的是**原生** uni-h5 的 getStorageSync（vite-plugin-uni 把裸 uni 编译成模块导入），
    // 它只解 {type,data} 信封，普通 JSON 串原样返回字符串，所以下面的 JSON.parse 是对的。
    // 不要加 `typeof raw === 'string'` 守卫：会自动 JSON.parse 的是 main.js:74 挂在 window.uni
    // 上的项目自有 polyfill，本文件用不到它（详见 AGENTS.md 待办 13）。
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
 * 当前登录用户 id：优先读 storage 里的 user，拿不到再解 JWT payload（服务端签的就是 {id, iat, exp}）。
 *
 * getUser() 在三端都是好的（见它上面的注释）；JWT 兜底只覆盖 storage 被清、token 还在的情况。
 * 解 base64 用下面的 b64UrlToAscii 而不是 atob —— App 端逻辑层跑在 JSCore/V8，没有任何浏览器全局
 * （见 AGENTS.md 坑点 17）。
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
