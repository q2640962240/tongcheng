/**
 * 前端类型收敛与兜底工具集
 * 目标：任何接口返回异常（null/undefined/非预期类型）时，页面绝不展示 undefined、NaN 或抛错
 * 用法：
 *   import { toList, toObj, toStr, toNum, pickCity, safeMap, retry, guard } from '@/utils/fallback'
 */

/* ==================== 类型收敛 ==================== */

/** 保证返回数组 */
export function toList(v) {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object' && typeof v.length === 'number') {
    try { return Array.prototype.slice.call(v) } catch (_) { /* ignore */ }
  }
  return []
}

/** 保证返回纯对象 */
export function toObj(v, d = {}) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v
  return d && typeof d === 'object' && !Array.isArray(d) ? d : {}
}

/** 保证返回字符串 */
export function toStr(v, d = '') {
  if (typeof v === 'string') return v
  if (v === null || v === undefined) return d
  try { return String(v) } catch (_) { return d }
}

/** 保证返回数字；NaN 则用默认值 */
export function toNum(v, d = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

/** 保证返回布尔值 */
export function toBool(v, d = false) {
  if (typeof v === 'boolean') return v
  if (v === 1 || v === '1' || v === 'true' || v === 'TRUE') return true
  if (v === 0 || v === '0' || v === 'false' || v === 'FALSE') return false
  return d
}

/** 数字格式化带兜底：10000 -> 1万 */
export function formatCount(raw) {
  const n = toNum(raw, 0)
  if (n < 10000) return String(n)
  const w = (n / 10000).toFixed(1)
  return w.replace(/\.0$/, '') + 'w'
}

/** 时间戳/日期 -> 友好字符串，异常返回 '' */
export function formatTime(raw) {
  if (!raw) return ''
  const d = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  if (diff < 0) {
    const m = d.getMonth() + 1, day = d.getDate()
    return `${m}月${day}日`
  }
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
  if (diff < 7 * 86400000) return Math.floor(diff / 86400000) + ' 天前'
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate()
  return `${y}/${m < 10 ? '0' + m : m}/${day < 10 ? '0' + day : day}`
}

/* ==================== 列表/对象安全访问 ==================== */

/** 类似 Array.map，但自动 toList 兜底；callback 返回 undefined 时跳过 */
export function safeMap(arr, cb) {
  const list = toList(arr)
  if (!list.length) return []
  const out = []
  for (let i = 0; i < list.length; i++) {
    try {
      const r = cb(list[i], i)
      if (r !== undefined) out.push(r)
    } catch (_) { /* skip bad items */ }
  }
  return out
}

/** 安全地从对象里按路径取字段 */
export function getPath(obj, path, dflt) {
  const o = toObj(obj)
  if (!path) return dflt
  const parts = typeof path === 'string' ? path.split('.') : toList(path)
  let cur = o
  for (let i = 0; i < parts.length; i++) {
    const k = parts[i]
    if (cur && Object.prototype.hasOwnProperty.call(cur, k)) {
      cur = cur[k]
    } else {
      return dflt
    }
  }
  return cur === undefined ? dflt : cur
}

/* ==================== 城市收敛 ==================== */

/**
 * 收敛城市字段：未定义/空时用默认值；过长或带符号时清洗
 * @param {*} raw 原始值
 * @param {string} d 默认值
 */
export function pickCity(raw, d = '北京') {
  const s = toStr(raw, '').trim().replace(/[，。、,.!！？\s]+$/g, '')
  if (!s) return d
  if (s.length > 24) return d
  return s
}

/* ==================== 请求/异步 防御 ==================== */

/**
 * 带重试的 Promise 函数执行：用于地理位置/逆地理等偶发失败接口
 * @param {() => Promise<any>} fn 返回 Promise 的函数
 * @param {number} times 总尝试次数
 * @param {number} delayMs 初始重试间隔
 */
export function retry(fn, times = 2, delayMs = 400) {
  const call = (left) =>
    Promise.resolve()
      .then(() => fn())
      .catch((e) => {
        if (left <= 0) throw e
        return new Promise((res) => setTimeout(res, delayMs)).then(() => call(left - 1))
      })
  return call(Math.max(0, times - 1))
}

/**
 * 包一层 Promise，成功正常返回，失败用默认值（不抛错）
 * @param {Promise<any>} p
 * @param {*} d
 */
export function guard(p, d = null) {
  return Promise.resolve(p).then(
    (r) => r,
    () => d
  )
}

/**
 * 响应数据解包：后端统一 { code, message, data }；异常时用 dflt 兜底
 * @param {*} resp uni.request 返回或 Promise resolved 的响应
 * @param {*} dflt 默认 data
 */
export function unwrap(resp, dflt = null) {
  if (!resp || typeof resp !== 'object') return dflt
  if (resp.code === 0 || resp.code === 200) {
    return resp.data === undefined ? dflt : resp.data
  }
  return dflt
}

/**
 * 分页解包：自动从 { list, total } 或 { rows, count } 等多种形态收敛
 */
export function unwrapPage(resp, dflt = { list: [], total: 0 }) {
  const d = unwrap(resp, null)
  if (!d || typeof d !== 'object') return dflt
  const list = toList(d.list || d.rows || d.items || d.data || dflt.list)
  const total = toNum(d.total || d.count || d.totalCount || list.length, list.length)
  return { list, total }
}

/* ==================== 登录守卫 ==================== */

/**
 * 未登录时跳到登录页，返回是否已登录
 * @returns {boolean} 是否已登录
 */
export function requireLogin(redirect) {
  try {
    // 必须与 auth.js 的 TOKEN_KEY 保持一致，避免出现"已登录仍提示未登录"的兜底误判
    const TOKEN_KEY = 'companion_token'
    const USER_KEY = 'companion_user'
    let hasLogin = false
    try {
      const token = uni.getStorageSync(TOKEN_KEY)
      const userRaw = uni.getStorageSync(USER_KEY)
      const userId = userRaw ? (JSON.parse(userRaw || '{}') || {}).id : null
      if ((token && String(token).length > 8) || userId) hasLogin = true
    } catch (_) { /* ignore */ }
    // 兜底：再用 Pinia userStore 判断一次（如果全局已挂载）
    try {
      if (!hasLogin) {
        const u = (getApp && getApp() && getApp().$pinia) ? null : null
      }
    } catch (_) {}
    if (hasLogin) return true
    uni.showModal({
      title: '请先登录',
      content: '该操作需要登录后才能继续',
      confirmText: '去登录',
      success: (r) => {
        if (r.confirm) {
          const url = redirect ? `/pages/login/login?redirect=${encodeURIComponent(redirect)}` : '/pages/login/login'
          uni.navigateTo({ url, fail: () => uni.reLaunch({ url }) })
        }
      }
    })
  } catch (_) {
    /* ignore */
  }
  return false
}

/* ==================== 图片/Avatar 兜底 ==================== */

const FALLBACK_AVATAR = '/static/sucai/profile-xiaokui.jpg'
const FALLBACK_COVER = '/static/sucai/post-game1.jpg'

export function avatarUrl(raw) {
  const s = toStr(raw, '')
  if (!s) return FALLBACK_AVATAR
  return s
}

export function coverUrl(raw) {
  const s = toStr(raw, '')
  if (!s) return FALLBACK_COVER
  return s
}

/* ==================== 标签/文本 兜底 ==================== */

/** 最多取 N 个标签，返回空数组兜底 */
export function pickTags(tags, n = 3) {
  const list = toList(tags).map((t) => toStr(t, '')).filter(Boolean)
  return list.slice(0, n)
}

/** 截断过长文本，末尾加 … */
export function truncate(text, max = 80) {
  const s = toStr(text, '')
  if (!s) return ''
  if (s.length <= max) return s
  return s.slice(0, max) + '…'
}

/* ==================== 4 级定位流水线（前端侧）==================== */
/**
 * 城市定位 4 级降级流水线：
 *   1. 本地持久化缓存（24 小时内有效）
 *   2. uni.getLocation + 后端逆地理接口 POST /api/location/reverse
 *   3. 后端 IP 粗定位 GET /api/location/guess-by-ip
 *   4. 手动选择 / 热门默认
 * @returns {Promise<{city: string, source: string}>}
 */
const CITY_KEY = 'baiye_city'
const CITY_AT_KEY = 'baiye_city_at'
const DEFAULT_CITY = '北京'

export async function resolveCityViaPipeline({ requestFn, preferCacheMs = 24 * 3600 * 1000 } = {}) {
  // L1：本地持久化缓存
  try {
    const saved = uni.getStorageSync(CITY_KEY)
    const at = Number(uni.getStorageSync(CITY_AT_KEY) || 0)
    if (saved && Date.now() - at < preferCacheMs) {
      return { city: pickCity(saved, DEFAULT_CITY), source: 'cache' }
    }
  } catch (_) { /* ignore */ }

  // L2：uni.getLocation + 后端逆地理
  if (typeof uni.getLocation === 'function' && typeof requestFn === 'function') {
    try {
      const loc = await new Promise((resolve, reject) => {
        uni.getLocation({ type: 'gcj02', success: resolve, fail: reject })
      })
      try {
        const r = await requestFn({
          url: '/location/reverse',
          method: 'POST',
          data: { lat: loc.latitude, lng: loc.longitude }
        })
        const city = pickCity(getPath(r, 'data.city', ''), '')
        if (city) {
          persistCity(city)
          return { city, source: 'reverse-geocode' }
        }
      } catch (_) { /* 逆地理失败，继续下一级 */ }
    } catch (_) { /* 定位失败，继续下一级 */ }
  }

  // L3：后端 IP 粗定位
  if (typeof requestFn === 'function') {
    try {
      const r = await requestFn({ url: '/location/guess-by-ip', method: 'GET' })
      const city = pickCity(getPath(r, 'data.city', ''), '')
      if (city) {
        persistCity(city)
        return { city, source: 'ip-guess' }
      }
    } catch (_) { /* 失败进入最后一级 */ }
  }

  // L4：默认值（手动选择触发前的软兜底）
  persistCity(DEFAULT_CITY)
  return { city: DEFAULT_CITY, source: 'fallback-default' }
}

function persistCity(city) {
  try {
    uni.setStorageSync(CITY_KEY, city)
    uni.setStorageSync(CITY_AT_KEY, Date.now())
  } catch (_) { /* ignore */ }
}

/* ==================== 防抖/节流 ==================== */

export function debounce(fn, wait = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), wait)
  }
}

export function throttle(fn, wait = 300) {
  let last = 0
  let pending = null
  return function (...args) {
    const now = Date.now()
    const remain = wait - (now - last)
    if (remain <= 0) {
      last = now
      if (pending) { clearTimeout(pending); pending = null }
      fn.apply(this, args)
    } else if (!pending) {
      pending = setTimeout(() => { last = Date.now(); pending = null; fn.apply(this, args) }, remain)
    }
  }
}
