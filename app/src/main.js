import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

/**
 * TUIKit H5 Polyfill
 * uni-app H5 端部分 TabBar API 不存在，TUIConversation/TUISearch 等组件会调用
 * uni.showTabBar() / uni.hideTabBar() / uni.switchTab() 导致 TypeError。
 * 在应用入口处为 uni 对象补齐这些空方法。
 *
 * 修复：uni-app H5 运行时不会把「路由类 API」（navigateTo/redirectTo/reLaunch/switchTab/
 * navigateBack/showTabBar/hideTabBar）挂载到全局 window.uni（vite-plugin-uni 只对
 * request/showModal/showToast 等做 import 替换），导致页面跳转/切 Tab 报
 * "uni.navigateTo is not a function"。这里用 hash 路由补齐真正实现，仅当 API 缺失时覆盖。
 */
function _tuiPolyfillUni() {
  // 注意：必须用 window.uni 显式引用全局对象。若写 `uni`，vite-plugin-uni 会把它替换成
  // import 的 uni-h5 模块，导致 `typeof uni.xxx` 恒为 function、补丁永不生效。
  if (typeof window === 'undefined') return
  if (!window.uni) return
  const U = window.uni
  const noop = () => Promise.resolve()

  // TabBar 显隐：H5 端无独立 tabBar 层可切换，保持空操作避免 TUIKit 报错即可
  if (typeof U.showTabBar !== 'function') U.showTabBar = noop
  if (typeof U.hideTabBar !== 'function') U.hideTabBar = noop

  // 路由跳转：uni-app H5 使用 hash 路由（#/pages/xxx/xxx），直接改写 location.hash 即可触发 SPA 切页
  const toHash = (url) => {
    let u = String(url || '')
    if (u.charAt(0) === '/') u = u.slice(1)
    return '#/' + u
  }
  const nav = (opts) => {
    const o = opts || {}
    try {
      if (o.url) window.location.hash = toHash(o.url)
      if (typeof o.success === 'function') o.success({})
    } catch (e) {
      if (typeof o.fail === 'function') o.fail({ errMsg: (e && e.message) || 'navigate fail' })
    }
    if (typeof o.complete === 'function') o.complete()
    return Promise.resolve()
  }
  if (typeof U.navigateTo !== 'function') U.navigateTo = nav
  if (typeof U.redirectTo !== 'function') U.redirectTo = nav
  if (typeof U.reLaunch !== 'function') U.reLaunch = nav
  if (typeof U.switchTab !== 'function') U.switchTab = nav
  if (typeof U.navigateBack !== 'function') {
    U.navigateBack = (opts) => {
      const o = opts || {}
      try { window.history.back() } catch (_) { /* ignore */ }
      if (typeof o.success === 'function') o.success({})
      if (typeof o.complete === 'function') o.complete()
      return Promise.resolve()
    }
  }

  // Storage：uni-app H5 运行时不把 storage API 挂到 window.uni，而 TUIKit 的
  // @tencentcloud/universal-api 的 TUIGlobal 指向 window.uni。缺失会导致
  // TUIChat MessageList 的 onMounted 第一行 chatStorage.getChatStorage 抛
  // "getStorageSync is not a function"，中断后续 TUIStore.watch 注册，
  // 消息列表永远空白。用 localStorage 补齐（与 uni storage 语义对齐：
  // 读不到返回空字符串，对象自动 JSON 序列化/反序列化）。
  if (typeof U.getStorageSync !== 'function') {
    U.getStorageSync = (key) => {
      try {
        const v = window.localStorage.getItem(String(key))
        if (v === null) return ''
        try { return JSON.parse(v) } catch (_) { return v }
      } catch (_) { return '' }
    }
  }
  if (typeof U.setStorageSync !== 'function') {
    U.setStorageSync = (key, data) => {
      try {
        window.localStorage.setItem(String(key), typeof data === 'string' ? data : JSON.stringify(data))
      } catch (_) { /* 存储满/隐私模式忽略 */ }
    }
  }
  if (typeof U.removeStorageSync !== 'function') {
    U.removeStorageSync = (key) => {
      try { window.localStorage.removeItem(String(key)) } catch (_) { /* ignore */ }
    }
  }
  if (typeof U.getStorage !== 'function') {
    U.getStorage = (opts) => {
      const o = opts || {}
      const data = U.getStorageSync(o.key)
      const res = { data }
      if (typeof o.success === 'function') o.success(res)
      if (typeof o.complete === 'function') o.complete(res)
      return Promise.resolve(res)
    }
  }
  if (typeof U.setStorage !== 'function') {
    U.setStorage = (opts) => {
      const o = opts || {}
      U.setStorageSync(o.key, o.data)
      const res = { errMsg: 'setStorage:ok' }
      if (typeof o.success === 'function') o.success(res)
      if (typeof o.complete === 'function') o.complete(res)
      return Promise.resolve(res)
    }
  }

  // 观测/查询类 API：TUIKit 已读回执、滚动定位会用到；H5 缺失时给安全空实现，
  // 避免调用处抛错中断生命周期钩子（对应功能退化为不生效，可接受）。
  if (typeof U.createIntersectionObserver !== 'function') {
    U.createIntersectionObserver = () => {
      const noopChain = { observe: () => noopChain, disconnect: () => {} }
      noopChain.relativeTo = () => noopChain
      return noopChain
    }
  }
  if (typeof U.createSelectorQuery !== 'function') {
    U.createSelectorQuery = () => {
      const q = { exec: (cb) => { if (typeof cb === 'function') cb([]); return q } }
      q.select = () => ({
        boundingClientRect: (cb) => { if (typeof cb === 'function') cb(null); return q },
        scrollOffset: (cb) => { if (typeof cb === 'function') cb(null); return q }
      })
      q.selectAll = () => ({
        boundingClientRect: (cb) => { if (typeof cb === 'function') cb([]); return q }
      })
      return q
    }
  }
}
// 立即 + 多级延迟 + DOMContentLoaded 兜底：uni-app 运行时会异步初始化 window.uni（window.uni={}），
// 过早执行 polyfill 会被覆盖，因此多级延迟重试；polyfill 幂等（仅当 API 缺失时才覆盖），安全无副作用。
_tuiPolyfillUni()
;[0, 500].forEach((ms) => setTimeout(_tuiPolyfillUni, ms))
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _tuiPolyfillUni)
  } else {
    _tuiPolyfillUni()
  }
}

/**
 * H5 稳定性增强：
 * 1) 空闲时预取「聊天页 + 官方 TUIKit 聊天页」两个异步 chunk。
 *    uni-app H5 每个页面都是 defineAsyncComponent 动态 import，首次进入时若网络抖动
 *    导致 chunk 拉取失败会渲染「连接服务器超时」错误页；提前把 chunk 拉进缓存可大幅降低概率。
 * 2) MutationObserver 监听 .uni-async-error 错误占位，出现后自动 reload 恢复，
 *    用 sessionStorage 计数防止 reload 死循环（同一页面最多自动恢复 2 次）。
 */
function _prefetchChatChunks() {
  if (typeof window === 'undefined') return
  const run = () => {
    // #ifdef H5
    import('./pages/chat/chat.vue').catch(() => {})
    import('./TUIKit/components/TUIChat/index.vue').catch(() => {})
    // #endif
  }
  const ric = typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback
    : (fn) => setTimeout(fn, 2500)
  ric(run, { timeout: 8000 })
}
_prefetchChatChunks()

function _watchAsyncErrorRecovery() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const KEY = 'baiye_async_recovery'
  const tryRecover = () => {
    let n = 0
    try { n = parseInt(window.sessionStorage.getItem(KEY) || '0', 10) || 0 } catch (_) { n = 0 }
    if (n >= 2) return // 连续恢复 2 次仍失败，停止自动 reload，留给用户手动点击
    try { window.sessionStorage.setItem(KEY, String(n + 1)) } catch (_) { /* ignore */ }
    setTimeout(() => { try { window.location.reload() } catch (_) { /* ignore */ } }, 400)
  }
  const scan = () => {
    if (document.querySelector('.uni-async-error')) tryRecover()
  }
  const start = () => {
    scan()
    try {
      const mo = new window.MutationObserver(scan)
      mo.observe(document.body || document.documentElement, { childList: true, subtree: true })
    } catch (_) { /* 极老浏览器无 MutationObserver，仅靠首次扫描 */ }
  }
  // 成功渲染一次普通页面后清计数，避免跨页面误累计
  try {
    window.addEventListener('uni-app:page-ready', () => {
      try { window.sessionStorage.removeItem(KEY) } catch (_) { /* ignore */ }
    })
  } catch (_) { /* ignore */ }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
}
_watchAsyncErrorRecovery()

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)
  return { app, pinia }
}
