/**
 * 请求封装 — 基于 uni.request （企业级 · 多端可配置 · 真机黑屏友好）
 *
 * ★ 关键策略：
 *   1. BASE_URL 解析优先级（高→低）
 *      ① 运行时本地存储（uni.getStorageSync('app.baseURL')）→ 支持客户端"调试设置"热修改，不用重新打包
 *      ② 编译期环境变量 VITE_API_BASE → 生产公网域名用这个（推荐）
 *      ③ H5 端 → '/api'（走 Vite 代理 /api → http://localhost:3000）
 *      ④ App / 小程序 开发阶段 → 'http://' + 开发机局域网 IP + ':3000/api'（真机同 WiFi 可用）
 *
 *   2. 所有"网络异常"都会以 showToast 形式显示，并且文字里带最终解析出的 BASE_URL，
 *      避免"黑屏无反馈"排障无门。
 *
 *   3. 对外暴露 getRuntimeBaseURL / setRuntimeBaseURL / resetRuntimeBaseURL 函数，
 *      供首页 / 设置页的"服务器地址"入口调用（调试模式下使用，上线可隐藏入口）。
 */
import { getToken, getRefreshToken, setToken, removeToken } from './auth'
import { authApi } from '../api'

/** 401 续期锁：同一时刻只跑一次 refresh，避免并发请求同时 refresh 造成 N 个 401 */
let refreshLock = null

/** 401 跳转登录防抖：在 12s 窗口内只允许最多 1 次 reLaunch，避免"已登录但接口偶发 401 → 多次 removeToken → 真退出 → 反复重登死循环" */
let _lastReloginAt = 0
const RELOGIN_COOLDOWN_MS = 12 * 1000
function kickToLogin(reason = '登录已过期') {
  try {
    const now = Date.now()
    if ((now - _lastReloginAt) < RELOGIN_COOLDOWN_MS) return // 防抖窗口内直接忽略，保持用户当前会话
    _lastReloginAt = now
    const userApp = (typeof getApp === 'function') ? (getApp && getApp()) : null
    // 兼容：如果全局 Pinia 已挂载，调用 userStore.logout() 统一清理；清理后仍需显式跳转登录
    try {
      if (userApp && userApp.$pinia) {
        const { useUserStore } = require('../store/user')
        const s = useUserStore && useUserStore()
        if (s && typeof s.logout === 'function') {
          try { s.logout() } catch (_) {}
        }
      }
    } catch (_) {}
    removeToken()
    uni.reLaunch({ url: '/pages/login/login' })
  } catch (_) {
    // 最后兜底：保证不因 kickToLogin 自身抛错而影响外层错误提示
    try { removeToken() } catch (__) {}
  }
}

/** 尝试使用 refreshToken 自动续期；成功返回 true */
async function tryRefresh() {
  if (refreshLock) return refreshLock
  const rt = getRefreshToken()
  if (!rt) return false
  refreshLock = (async () => {
    try {
      const res = await authApi.refresh(rt)
      const d = res && res.data
      if (d && d.token) {
        setToken(d.token || '', d.refreshToken || '')
        return true
      }
    } catch (_) { /* 续期失败最后统一 removeToken 跳转登录 */ }
    return false
  })()
  const ok = await refreshLock
  refreshLock = null
  return ok
}

const STORAGE_KEY = 'app.baseURL'

/** 当前开发机局域网 IP（用户使用本地 WiFi 场景，默认指向当前 agent 启动时使用的地址，若未知留空）
 *  若用户电脑 IP 与本值不同，只需在 App 内「设置 → 服务器地址」里填入 http://电脑IP:3000/api 立即生效，无需重打包。 */
const DEFAULT_DEV_LAN_IP = '192.168.1.8'

/**
 * 双保险平台检测：
 *  1. 优先使用浏览器 host 是否 localhost/本地环境判断（H5 dev server 必然是浏览器宿主）
 *  2. uni-h5 在浏览器内调用 uni.getSystemInfoSync() 返回的 uniPlatform 为 'web'（不是 'h5'），
 *     之前写成 === 'h5' 导致浏览器侧被误判为"非 H5 平台"，回落到 LAN IP 走 CORS 预检（可工作但非最优）。
 *     修复：同时匹配 'h5' 和 'web'，并额外引入 location.host 浏览器宿主兜底 —— 只要有 window.location，一律视为 H5。
 */
function detectPlatform() {
  // ① 打包的 App（APP-PLUS）有全局 plus 对象 —— 必须最先判断，否则会被下面的 window 兜底误判成 h5
  try {
    if (typeof plus !== 'undefined' && plus) {
      return 'app'
    }
  } catch (e) { /* ignore */ }
  // ② uniPlatform 明确判断：web/h5 为 H5，其余（app/mp-weixin 等）原样返回
  try {
    if (typeof uni !== 'undefined' && uni.getSystemInfoSync) {
      const info = uni.getSystemInfoSync()
      const p = String(info && info.uniPlatform || '').toLowerCase()
      if (p === 'web' || p === 'h5') return 'h5'
      if (p) return p
    }
  } catch (e) { /* ignore */ }
  // ③ 兜底：浏览器宿主（H5）
  try {
    if (typeof window !== 'undefined' && window && typeof window.location !== 'undefined') {
      return 'h5'
    }
  } catch (e) { /* ignore */ }
  return 'h5'
}

const IS_H5 = detectPlatform() === 'h5'

function compileTimeBaseURL() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return String(import.meta.env.VITE_API_BASE || '').trim()
    }
  } catch (e) { /* ignore */ }
  return ''
}

/** 读取运行时本地存储的自定义 BASE_URL（未设置则返回空字符串） */
export function getRuntimeBaseURL() {
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      const v = String(uni.getStorageSync(STORAGE_KEY) || '').trim()
      return v
    }
  } catch (e) { /* ignore */ }
  return ''
}

/** 写入运行时 BASE_URL；设置后立即生效（后续所有请求使用新 URL）。传空字符串则重置回默认解析逻辑。 */
export function setRuntimeBaseURL(url) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(STORAGE_KEY, String(url || '').trim())
    }
  } catch (e) { /* ignore */ }
  // 热更新当前请求 URL
  BASE_URL_CACHE.current = resolveBaseURLInternal()
}

/** 清空用户自定义 BASE_URL，回到默认解析逻辑 */
export function resetRuntimeBaseURL() {
  try {
    if (typeof uni !== 'undefined' && uni.removeStorageSync) {
      uni.removeStorageSync(STORAGE_KEY)
    }
  } catch (e) { /* ignore */ }
  BASE_URL_CACHE.current = resolveBaseURLInternal()
}

// --- 内部 BASE_URL 解析实现 ------------------------------------------------------------------
function resolveBaseURLInternal() {
  // ① 运行时本地存储（最高优先级，调试 / 内网迁移热切换）
  const runtime = getRuntimeBaseURL()
  if (runtime) return stripTrailing(runtime)

  // ② 编译期环境变量（线上用 VITE_API_BASE=https://api.baiye.example.com 构建一次即可）
  const envBase = compileTimeBaseURL()
  if (envBase) return stripTrailing(envBase)

  // ③ H5 /api 代理（仅当没有 localStorage 运行时覆盖且没有 VITE_API_BASE 时，走 '/api' 同源 Vite 代理，避免 CORS 预检和局域网 IP 漂移）
  if (IS_H5) return '/api'

  // ④ App / 小程序：默认指向生产服务器，保证 APK 安装后即可使用
  //    开发阶段可在 App「设置 → 服务器地址」中改为 http://电脑IP:3000/api，立即生效
  const fallback = 'https://zyb001.cn/api'
  return fallback
}

function stripTrailing(u) {
  return String(u || '').replace(/\/+$/, '')
}

// 导出的 BASE_URL 第一次立即解析，后续 setRuntimeBaseURL / resetRuntimeBaseURL 会热更新本变量
const BASE_URL_CACHE = { current: resolveBaseURLInternal() }
// 使用 getter 保证任何时候读取到的都是最新值（兼容静态 import 的模块）
// 注意：ESM/Vite 浏览器环境不要使用 CommonJS 的 "exports" 变量（会导致 ReferenceError）
export let BASE_URL = BASE_URL_CACHE.current
try {
  // 仅在存在 CommonJS exports 对象时（极少见：Node 直引 / Jest CJS）附加 __BASE_URL__
  if (typeof exports !== 'undefined' && exports && typeof exports === 'object') {
    Object.defineProperty(exports, '__BASE_URL__', {
      configurable: true,
      enumerable: true,
      get() { return BASE_URL_CACHE.current }
    })
  }
} catch (_) { /* ignore */ }

function getCurrentBaseURL() {
  // 每次请求走这里，保证热更新生效
  return BASE_URL_CACHE.current
}
export { getCurrentBaseURL }

/**
 * 打开「服务器地址」热配置弹窗（首页/发现页/空态快捷入口复用）
 * 调用后用户可直接修改 BASE_URL，保存后立即生效，无需重新打包。
 * @param {Object} [opts]
 * @param {string} [opts.title] 自定义标题
 * @param {Function} [opts.onSaved] 保存后回调（用于刷新当前页数据）
 * @param {Function} [opts.onReset] 重置后回调
 */
export function openServerUrlModal(opts) {
  const o = opts && typeof opts === 'object' ? opts : {}
  const title = o.title || '设置服务器地址'
  const def = getCurrentBaseURL()
  try {
    uni.showModal({
      title,
      editable: true,
      placeholderText: '例如 http://电脑IP:3000/api',
      content: def,
      confirmText: '保存',
      cancelText: '重置默认',
      success: (res) => {
        if (res.confirm) {
          const v = String(res.content || '').trim()
          if (!v) return uni.showToast({ title: '地址不能为空', icon: 'none' })
          if (!/^https?:\/\//i.test(v)) return uni.showToast({ title: '必须以 http:// 或 https:// 开头', icon: 'none' })
          setRuntimeBaseURL(v)
          uni.showToast({ title: '已保存，立即生效', icon: 'success' })
          try { if (typeof o.onSaved === 'function') o.onSaved(getCurrentBaseURL()) } catch (_) {}
          setTimeout(() => uni.showModal({
            title: '服务器地址已切换',
            content: '请下拉刷新页面或重启 App，以重新加载数据。',
            showCancel: false
          }), 500)
        } else if (res.cancel === true) {
          resetRuntimeBaseURL()
          uni.showToast({ title: '已重置为默认地址', icon: 'none' })
          try { if (typeof o.onReset === 'function') o.onReset(getCurrentBaseURL()) } catch (_) {}
        }
      }
    })
  } catch (e) {
    uni.showToast({ title: '请到「我的 → 设置 → 服务器地址」进行设置', icon: 'none', duration: 3500 })
  }
}

function classifyNetworkError(err) {
  const raw = String((err && err.errMsg) || (err && err.message) || '')
  if (/timeout/i.test(raw)) return { kind: 'timeout', message: '连接服务器超时，请检查网络或稍后重试' }
  if (/fail/i.test(raw)) return { kind: 'fail', message: '网络异常，请检查网络设置或服务地址' }
  if (/abort/i.test(raw)) return { kind: 'abort', message: '请求已取消' }
  if (/denied|ssl|certificate/i.test(raw)) return { kind: 'security', message: '网络安全校验失败，请检查协议与证书' }
  return { kind: 'unknown', message: '网络异常' }
}

/** 延迟函数 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/** 执行单次 uni.request，统一返回 { ok, status, data, err } */
function doRequest({ method, finalURL, data, header, timeout }) {
  return new Promise((resolve) => {
    uni.request({
      url: finalURL,
      method,
      data,
      header,
      timeout,
      success: (res) => resolve({ ok: res.statusCode < 400, status: res.statusCode, data: res.data, err: null }),
      fail: (err) => resolve({ ok: false, status: 0, data: null, err })
    })
  })
}

export const request = (options) => {
  return new Promise(async (resolve, reject) => {
    const token = getToken()
    const header = {
      'Content-Type': 'application/json',
      ...(options.header || {})
    }
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }

    const method = options.method || 'GET'
    // App 端适当延长超时，iOS 冷启动时网络栈初始化可能较慢
    const timeout = Number(options.timeout) || (IS_H5 ? 15000 : 25000)
    const silent = !!options.silent // 静默模式：失败时不弹 toast，由调用方自行处理
    // 刷新端点自身必须置真：它的 401 若再进 tryRefresh()，会拿到尚未释放的 refreshLock
    // （正是当前在等它的那个 promise）→ 循环 await → 永久不 settle
    const noRefreshRetry = !!options.noRefreshRetry
    const base = getCurrentBaseURL()
    const finalURL = base + options.url

    // 调试期：DEV 模式打印请求
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
        // eslint-disable-next-line no-undef
        console.info('[Request]', method, finalURL, 'platform=' + detectPlatform(), 'timeout=' + timeout)
      }
    } catch (e) { /* ignore */ }

    // === 网络错误自动重试 ===
    // iOS App 冷启动时网络栈可能尚未就绪，首次请求会 fail，重试 1 次通常能恢复
    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 1
    const retryDelay = options.retryDelay || 1200
    let lastResult

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await sleep(retryDelay * attempt) // 递增等待
      }
      lastResult = await doRequest({ method, finalURL, data: options.data, header, timeout })

      // 成功（< 400）直接 resolve
      if (lastResult.ok) {
        resolve(lastResult.data)
        return
      }

      // 401 特殊处理：尝试 refreshToken 续期
      if (lastResult.status === 401) {
        const refreshed = noRefreshRetry ? false : await tryRefresh()
        if (refreshed) {
          const newToken = getToken()
          const retryHeader = { ...header }
          if (newToken) retryHeader['Authorization'] = `Bearer ${newToken}`
          const r2 = await doRequest({ method, finalURL, data: options.data, header: retryHeader, timeout })
          if (r2.ok) { resolve(r2.data); return }
          if (r2.status === 401) {
            kickToLogin('登录已过期')
            reject(new Error('登录已过期'))
            return
          }
          lastResult = r2
          break
        }
        kickToLogin('登录已过期')
        reject(new Error('登录已过期'))
        return
      }

      // 4xx 业务错误不重试
      if (lastResult.status >= 400 && lastResult.status < 500) {
        break
      }
      // 网络错误(status=0) 或 5xx 才进入下一轮重试
    }

    // === 统一错误处理 ===
    const { status, data, err } = lastResult
    if (status >= 400) {
      const msg = (data && data.message) || `请求失败 (${status})`
      const fullMsg = (status >= 500) ? `${msg} (${status})` : msg
      if (!silent) {
        uni.showToast({
          title: fullMsg.length > 48 ? fullMsg.slice(0, 48) : fullMsg,
          icon: 'none',
          duration: 3000
        })
      }
      console.error('[Request Error]', method, options.url,
        '\n  url:', finalURL,
        '\n  status:', status,
        '\n  body:', JSON.stringify(data).slice(0, 300))
      const e = new Error(fullMsg)
      e.status = status
      e.data = data
      reject(e)
      return
    }

    // 网络错误（status === 0）
    const classified = classifyNetworkError(err)
    const hint = IS_H5 && !/^https?:/i.test(base)
      ? `（请确认 Vite 代理 /api 已转发；base=${base}）`
      : `（服务器地址=${base}）`
    const fullMsg = classified.message + hint
    if (!silent) {
      uni.showToast({
        title: fullMsg.length > 48 ? fullMsg.slice(0, 48) : fullMsg,
        icon: 'none',
        duration: 4500
      })
    }
    console.error('[Request Fail]', method, finalURL,
      '\n  kind:', classified.kind,
      '\n  raw:', err && (err.errMsg || err.message),
      '\n  platform:', detectPlatform(),
      '\n  base:', base)
    const wrapped = new Error(fullMsg)
    wrapped.kind = classified.kind
    wrapped.raw = err
    wrapped.baseURL = base
    reject(wrapped)
  })
}

export const get = (url, data, extra) => request({ url, method: 'GET', data, ...extra })
export const post = (url, data, extra) => request({ url, method: 'POST', data, ...extra })
export const put = (url, data, extra) => request({ url, method: 'PUT', data, ...extra })
export const del = (url, data, extra) => request({ url, method: 'DELETE', data, ...extra })

export default request
export { IS_H5, detectPlatform }
