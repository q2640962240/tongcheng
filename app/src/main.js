import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
// 导入原生 uni-h5 事件函数，用于 polyfill 委托（避免创建独立事件总线）
// #ifdef H5
import { $emit as nativeEmit, $on as nativeOn, $off as nativeOff } from '@dcloudio/uni-h5'
// #endif

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

  // Network：uni-app H5 运行时不把 request API 挂到 window.uni（vite-plugin-uni
  // 只对 import 做编译期替换），导致 request.js 等通过 window.uni.request 发请求的
  // 代码抛 "uni.request is not a function"，所有 API 调用（礼物列表/余额/送礼等）
  // 静默失败。用 fetch 补齐，回调语义与 uni.request 对齐。
  if (typeof U.request !== 'function') {
    U.request = (opts) => {
      const o = opts || {}
      let url = String(o.url || '')
      const method = (o.method || 'GET').toUpperCase()
      const header = o.header || {}
      let body = o.data || null

      if (method === 'GET' && body && typeof body === 'object') {
        const qs = Object.keys(body)
          .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(body[k]))
          .join('&')
        if (qs) url += (url.includes('?') ? '&' : '?') + qs
        body = null
      } else if (body && typeof body === 'object') {
        const ct = header['Content-Type'] || header['content-type'] || ''
        if (ct.indexOf('json') !== -1 || !ct) {
          body = JSON.stringify(body)
          if (!header['Content-Type'] && !header['content-type']) {
            header['Content-Type'] = 'application/json'
          }
        }
      }

      const timer = o.timeout
        ? setTimeout(() => { if (typeof o.fail === 'function') o.fail({ errMsg: 'request:fail timeout' }) }, o.timeout)
        : null

      fetch(url, { method, headers: header, body: method !== 'GET' ? body : null })
        .then(res => res.text().then(text => {
          if (timer) clearTimeout(timer)
          let data
          try { data = JSON.parse(text) } catch (_) { data = text }
          if (typeof o.success === 'function') o.success({ statusCode: res.status, data, header: {} })
        }))
        .catch(err => {
          if (timer) clearTimeout(timer)
          if (typeof o.fail === 'function') o.fail({ errMsg: 'request:fail ' + (err.message || err) })
        })
    }
  }

  // UI 反馈类 API：request.js 的错误提示、chat.vue 的发送反馈等都通过 window.uni.showToast 调用
  if (typeof U.showToast !== 'function') {
    U.showToast = (opts) => {
      const o = opts || {}
      const title = o.title || ''
      const icon = o.icon || 'success'
      const duration = o.duration || 1500
      let el = document.getElementById('__uni_toast')
      if (!el) {
        el = document.createElement('div')
        el.id = '__uni_toast'
        el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(17,17,17,0.76);color:#fff;padding:16px 24px;border-radius:10px;font-size:14px;z-index:99999;text-align:center;max-width:70vw;word-break:break-all;pointer-events:none;transition:opacity 0.2s'
        document.body.appendChild(el)
      }
      const iconMap = { success: '✓', none: '', loading: '…' }
      const prefix = iconMap[icon] !== undefined ? (iconMap[icon] ? iconMap[icon] + ' ' : '') : '✓ '
      el.textContent = prefix + title
      el.style.opacity = '1'
      el.style.display = 'block'
      if (el._timer) clearTimeout(el._timer)
      if (duration > 0) {
        el._timer = setTimeout(() => { el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none' }, 200) }, duration)
      }
      if (typeof o.success === 'function') o.success()
      if (typeof o.complete === 'function') o.complete()
    }
  }
  if (typeof U.hideToast !== 'function') {
    U.hideToast = () => { const el = document.getElementById('__uni_toast'); if (el) el.style.display = 'none' }
  }
  if (typeof U.showModal !== 'function') {
    U.showModal = (opts) => {
      const o = opts || {}
      return new Promise((resolve) => {
        const mask = document.createElement('div')
        mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99998;display:flex;align-items:center;justify-content:center'
        const box = document.createElement('div')
        box.style.cssText = 'background:#fff;border-radius:12px;width:280px;padding:24px 20px 16px;text-align:center;font-family:system-ui'
        if (o.title) {
          const t = document.createElement('div')
          t.style.cssText = 'font-size:17px;font-weight:600;color:#333;margin-bottom:8px'
          t.textContent = o.title
          box.appendChild(t)
        }
        if (o.content) {
          const c = document.createElement('div')
          c.style.cssText = 'font-size:14px;color:#666;margin-bottom:20px'
          c.textContent = o.content
          box.appendChild(c)
        }
        const btnRow = document.createElement('div')
        btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center'
        const close = (confirm) => {
          document.body.removeChild(mask)
          const res = { confirm, cancel: !confirm }
          if (typeof o.success === 'function') o.success(res)
          if (typeof o.complete === 'function') o.complete(res)
          resolve(res)
        }
        if (o.showCancel !== false) {
          const cancelBtn = document.createElement('button')
          cancelBtn.style.cssText = 'flex:1;height:40px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#666;font-size:15px;cursor:pointer'
          cancelBtn.textContent = o.cancelText || '取消'
          cancelBtn.addEventListener('click', () => close(false))
          btnRow.appendChild(cancelBtn)
        }
        const confirmBtn = document.createElement('button')
        confirmBtn.style.cssText = 'flex:1;height:40px;border:none;border-radius:8px;background:#07c160;color:#fff;font-size:15px;cursor:pointer'
        confirmBtn.textContent = o.confirmText || '确定'
        confirmBtn.addEventListener('click', () => close(true))
        btnRow.appendChild(confirmBtn)
        box.appendChild(btnRow)
        mask.appendChild(box)
        document.body.appendChild(mask)
      })
    }
  }
  if (typeof U.showLoading !== 'function') {
    U.showLoading = (opts) => U.showToast({ ...(opts || {}), icon: 'loading', duration: 0 })
  }
  if (typeof U.hideLoading !== 'function') {
    U.hideLoading = () => U.hideToast()
  }

  // 图片类 API：chat.vue 的拍照/相册/预览通过 window.uni 调用
  if (typeof U.chooseImage !== 'function') {
    U.chooseImage = (opts) => {
      const o = opts || {}
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      if (o.sourceType && o.sourceType.includes('camera')) input.capture = 'environment'
      input.onchange = () => {
        const files = Array.from(input.files || [])
        const urls = files.map(f => URL.createObjectURL(f))
        const res = { tempFilePaths: urls, tempFiles: files.map((f, i) => ({ path: urls[i], size: f.size })) }
        if (typeof o.success === 'function') o.success(res)
        if (typeof o.complete === 'function') o.complete(res)
      }
      input.click()
    }
  }
  if (typeof U.previewImage !== 'function') {
    U.previewImage = (opts) => {
      const o = opts || {}
      const urls = o.urls || []
      if (!urls.length) return
      const mask = document.createElement('div')
      mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer'
      mask.onclick = () => document.body.removeChild(mask)
      const img = document.createElement('img')
      img.src = urls[o.current ? urls.indexOf(o.current) : 0] || urls[0]
      img.style.cssText = 'max-width:95vw;max-height:95vh;object-fit:contain'
      mask.appendChild(img)
      document.body.appendChild(mask)
    }
  }
  if (typeof U.uploadFile !== 'function') {
    U.uploadFile = (opts) => {
      const o = opts || {}
      const fd = new FormData()
      if (o.filePath) fd.append(o.name || 'file', o.filePath)
      if (o.formData) Object.keys(o.formData).forEach(k => fd.append(k, o.formData[k]))
      const header = o.header || {}
      return fetch(o.url, { method: 'POST', headers: header, body: fd })
        .then(res => res.text().then(text => {
          let data
          try { data = JSON.parse(text) } catch (_) { data = text }
          const result = { statusCode: res.status, data }
          if (typeof o.success === 'function') o.success(result)
          if (typeof o.complete === 'function') o.complete(result)
        }))
        .catch(err => {
          if (typeof o.fail === 'function') o.fail({ errMsg: err.message })
          if (typeof o.complete === 'function') o.complete()
        })
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

  // 事件通信 API：uni.$emit/$on/$off 用于跨组件通信（礼物动画触发等）。
  // 关键：必须委托给原生 @dcloudio/uni-h5 的 Emitter（vp.on/vp.emit），
  // 不能创建独立的闭包事件总线——否则 window.uni.$emit 和编译后代码的 uni.$on
  // 会走两条互不相通的事件通道，导致礼物动画等跨组件事件丢失。
  // #ifdef H5
  if (typeof U.$emit !== 'function') {
    U.$on = nativeOn
    U.$off = nativeOff
    U.$emit = nativeEmit
  }
  // #endif
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
