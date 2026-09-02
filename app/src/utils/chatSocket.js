/**
 * 自建聊天实时通道 — 基于 uni.connectSocket 的极简 Socket.IO v4 客户端（零依赖）
 *
 * 为什么不用 socket.io-client：uni-app App 端没有可靠的浏览器 WebSocket 全局对象，
 * 而 uni.connectSocket 是官方跨端 API（H5 / App / 小程序均可用）。
 * 服务端是标准 socket.io（engine.io v4 协议 + websocket transport），
 * 本文件按协议手工实现握手、心跳、事件收发与 ack。
 *
 * 用法：
 *   import chatSocket from '@/utils/chatSocket'
 *   chatSocket.on('message', (msg) => {...})
 *   chatSocket.connect()
 *   chatSocket.emit('message', { receiverId, type, content }, (ack) => {...})
 */
import { getCurrentBaseURL } from './request'
import { getToken } from './auth'

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 20000]
const ACK_TIMEOUT = 5000 // 5s 未收到 ack 视为失败

class ChatSocket {
  constructor() {
    this.connected = false
    this.connecting = false
    this.shouldReconnect = true
    this.socketTask = null
    this.listeners = new Map()
    this.buffer = []
    this._ackId = 0
    this._acks = new Map()
    this._retries = 0
    this._reconnectTimer = null
    this._pingTimer = null
    this._connSeq = 0
    // 消息去重：维护最近发送的消息 ID，10s 后自动清理
    this._recentMsgIds = new Set()
  }

  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, new Set())
    this.listeners.get(evt).add(fn)
    return () => this.off(evt, fn)
  }
  off(evt, fn) {
    const set = this.listeners.get(evt)
    if (!set) return
    if (!fn) { this.listeners.delete(evt); return }
    set.delete(fn)
  }
  _emitLocal(evt, payload) {
    const set = this.listeners.get(evt)
    if (!set) return
    for (const fn of set) {
      try { fn(payload) } catch (e) { console.warn('[chatSocket] handler error', evt, e) }
    }
  }

  /** 由 API BASE_URL 推导 WS 地址：https://zyb001.cn/api → wss://zyb001.cn/socket.io/?... */
  _buildUrl() {
    const base = getCurrentBaseURL() || ''
    let httpBase = base
    if (/\/api\/?$/i.test(httpBase)) httpBase = httpBase.replace(/\/api\/?$/i, '')
    if (!/^https?:\/\//i.test(httpBase)) {
      // 相对路径（H5 走 /api 代理的场景）→ 用当前页面 host 拼绝对地址
      try {
        if (typeof window !== 'undefined' && window.location) {
          const proto = window.location.protocol === 'https:' ? 'https' : 'http'
          httpBase = `${proto}://${window.location.host}`
        }
      } catch (_) {}
    }
    const wsBase = httpBase.replace(/^http/i, (m) => 'ws')
    const token = encodeURIComponent(getToken() || '')
    return `${wsBase}/socket.io/?EIO=4&transport=websocket&token=${token}`
  }

  connect() {
    this.shouldReconnect = true
    if (this.connected || this.connecting) return
    this.connecting = true
    const seq = ++this._connSeq
    let task = null
    try {
      task = uni.connectSocket({
        url: this._buildUrl(),
        header: { Authorization: getToken() ? `Bearer ${getToken()}` : '' },
        complete: () => {}
      })
    } catch (e) {
      this.connecting = false
      this._scheduleReconnect()
      return
    }
    this.socketTask = task

    task.onOpen(() => {
      if (seq !== this._connSeq) return
    })

    task.onMessage((res) => {
      if (seq !== this._connSeq) return
      this._onPacket(String(res.data))
    })

    task.onClose(() => {
      if (seq !== this._connSeq) return
      this._handleDown()
    })

    task.onError(() => {
      if (seq !== this._connSeq) return
      try { task.close({}) } catch (_) {}
    })
  }

  _handleDown() {
    const wasConnected = this.connected
    this.connected = false
    this.connecting = false
    this.socketTask = null
    this._stopPing()
    // 未确认的 ack 以失败回调释放，避免页面一直等待
    for (const [, entry] of this._acks) {
      try { entry.cb && entry.cb({ ok: false, message: '连接断开' }) } catch (_) {}
    }
    this._acks.clear()
    if (wasConnected) this._emitLocal('disconnect')
    this._scheduleReconnect()
  }

  _scheduleReconnect() {
    if (!this.shouldReconnect) return
    if (this._reconnectTimer) return
    const delay = RECONNECT_DELAYS[Math.min(this._retries, RECONNECT_DELAYS.length - 1)]
    this._retries += 1
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      this.connect()
    }, delay)
  }

  _onPacket(data) {
    if (!data) return
    const head = data.charAt(0)
    // engine.io 层
    if (head === '0') {
      // open：记录心跳间隔，立刻发起 socket.io 命名空间连接
      let pingInterval = 25000
      try {
        const info = JSON.parse(data.slice(1))
        if (info && info.pingInterval) pingInterval = Number(info.pingInterval)
      } catch (_) {}
      this._startPing(pingInterval)
      this._send('40')
      return
    }
    if (head === '2') { // server ping → 回 pong
      this._send('3')
      return
    }
    if (head === '1' || head === '3' || head === '5' || head === '6') return

    // socket.io 层
    if (data === '40' || data.indexOf('40{') === 0) {
      this.connected = true
      this.connecting = false
      this._retries = 0
      this._emitLocal('connect')
      // 冲刷缓冲
      const buf = this.buffer
      this.buffer = []
      for (const raw of buf) this._send(raw)
      return
    }
    if (data.charAt(0) === '4' && data.charAt(1) === '2') {
      this._onEvent(data.slice(2))
      return
    }
    if (data.charAt(0) === '4' && data.charAt(1) === '3') {
      this._onAck(data.slice(2))
      return
    }
    if (data.indexOf('44') === 0) {
      // 连接错误（如 token 无效）
      this._emitLocal('error', data.slice(2))
      try { this.socketTask && this.socketTask.close({}) } catch (_) {}
      return
    }
  }

  _onEvent(body) {
    let arr = null
    try { arr = JSON.parse(body) } catch (_) { return }
    if (!Array.isArray(arr) || !arr.length) return
    const evt = arr[0]
    const payload = arr[1]
    this._emitLocal(evt, payload)
  }

  _onAck(body) {
    // 格式: <ackId>[<json args...>]
    const i = body.indexOf('[')
    if (i < 0) return
    const id = Number(body.slice(0, i))
    let args = []
    try { args = JSON.parse(body.slice(i)) } catch (_) { return }
    const entry = this._acks.get(id)
    if (entry) {
      this._acks.delete(id)
      clearTimeout(entry.timer)
      try { entry.cb && entry.cb(args[0]) } catch (_) {}
    }
  }

  _startPing(interval) {
    this._stopPing()
    this._pingTimer = setInterval(() => this._send('2'), interval)
  }
  _stopPing() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null }
  }

  _send(raw) {
    if (!this.socketTask) return false
    try {
      this.socketTask.send({ data: raw, fail: () => {} })
      return true
    } catch (_) { return false }
  }

  /**
   * 发送事件；带 cb 时使用 socket.io ack（服务端 socket.on('message', (data, ack) => ...)）
   * 未连接时事件进入缓冲，连接建立后自动发出；5s 未收到 ack 视为失败。
   * 内置消息去重：相同内容 10s 内不会重复发送。
   */
  emit(evt, data, cb) {
    // 消息去重：为每条消息生成唯一 ID，检查是否重复发送
    const msgId = data && data._msgId
    if (msgId) {
      if (this._recentMsgIds.has(msgId)) {
        console.warn('[chatSocket] duplicate message blocked:', msgId)
        if (typeof cb === 'function') {
          try { cb({ ok: false, message: '重复消息已拦截' }) } catch (_) {}
        }
        return
      }
      this._recentMsgIds.add(msgId)
      setTimeout(() => this._recentMsgIds.delete(msgId), 10000)
    }

    let raw
    if (typeof cb === 'function') {
      const id = ++this._ackId
      raw = `42${id}${JSON.stringify([evt, data])}`
      const timer = setTimeout(() => {
        if (this._acks.has(id)) {
          this._acks.delete(id)
          try { cb({ ok: false, message: '发送超时' }) } catch (_) {}
        }
      }, ACK_TIMEOUT)
      this._acks.set(id, { cb, timer })
    } else {
      raw = `42${JSON.stringify([evt, data])}`
    }
    if (this.connected) this._send(raw)
    else {
      this.buffer.push(raw)
      if (this.buffer.length > 100) this.buffer.shift()
      this.connect()
    }
  }

  close() {
    this.shouldReconnect = false
    this._connSeq += 1
    this._stopPing()
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null }
    try { this.socketTask && this.socketTask.close({}) } catch (_) {}
    this.socketTask = null
    this.connected = false
    this.connecting = false
    this.buffer = []
  }
}

const chatSocket = new ChatSocket()
export default chatSocket
