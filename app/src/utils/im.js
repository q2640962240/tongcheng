/**
 * 腾讯云即时通信 IM (TIM) — uni-app 三端 SDK 单例封装
 *
 * 跨端策略：
 *   - 微信小程序（mp-weixin）：使用 tim-wx-sdk
 *   - H5：使用 tim-js-sdk
 *   - App（app-plus / App）：使用 tim-js-sdk（内部带 websocket，uni-app App 端支持）
 * 通过 uni-app 条件编译 (#ifdef / #ifndef) 编译期选择对应 SDK，避免 H5/小程序 bundle 体积膨胀。
 *
 * 使用：
 *   import tim from '@/utils/im'
 *   await tim.ensureReady()   // 确保 TIM 已初始化并登录；失败则 fallback=false，前端回退自建 WS
 *   const { SDKReady, tim, convID } = tim.getCtx()
 *
 *   发消息：await tim.sendText(toUserId, text)
 *   拉会话：await tim.getConversationList()
 *   进单聊：await tim.getConversation(`C2C${userId}`)
 */

// ============================================================
// 1. 条件编译 + 静态 import（必须用 import 而非 require，否则 Vite 不会打包 SDK）
//    uni-app 编译期根据平台选择对应 import，另一平台的 import 被丢弃
// ============================================================
// #ifdef H5 || APP-PLUS || APP
import TIMCore from 'tim-js-sdk'
// #endif
// #ifdef MP-WEIXIN
import TIMCore from 'tim-wx-sdk'
// #endif

import request from './request'
import { getToken } from './auth'

// 日志等级
const LOG_LEVEL = 1 // 0=verbose 1=info 2=warn 3=error 4=none

// 存储 key
const STORAGE_KEY = 'baiye:im:login_state'

// 事件总线（对外 emit：READY / MESSAGE / CONVERSATION_UPDATED / TYPING / ERROR）
const listeners = new Map()

class TIMManager {
  constructor() {
    /** @type {any|null} TIM 实例 */
    this.tim = null
    this.TIM = TIMCore
    this.sdkAppId = 0
    this.userId = ''
    this.userSig = ''
    this.expireAt = 0
    /** 是否完全可用（SDK 已加载 + 配置齐全 + 已 login 成功） */
    this.ready = false
    /** IM 是否在服务端/配置层面启用（未启用时直接走 fallback） */
    this.enabled = false
    /** 会话缓存 */
    this.conversations = []
    /** 当前会话消息缓存 convID -> messages[] */
    this.messageCache = new Map()
    /** 初始化 Promise（避免重复初始化） */
    this._initPromise = null
  }

  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set())
    listeners.get(evt).add(fn)
    return () => this.off(evt, fn)
  }
  off(evt, fn) {
    if (!listeners.has(evt)) return
    if (!fn) { listeners.delete(evt); return }
    listeners.get(evt).delete(fn)
  }
  emit(evt, payload) {
    const set = listeners.get(evt)
    if (!set) return
    for (const fn of set) {
      try { fn(payload) } catch (e) { console.warn('[im] emit handler fail', evt, e) }
    }
  }

  /**
   * 获取后端下发的 IM 开关 + sdkAppId + userSig
   * @returns {Promise<{enabled:boolean, ready:boolean, sdkAppId:string, userId:string, userSig:string, expireAt:number}>}
   */
  async _fetchLogin() {
    // 1. 先 GET config（是否启用）
    let cfg = { enabled: false, ready: false, sdkAppId: '' }
    try {
      const r1 = await request({ url: '/im/config', method: 'GET', skipAuth: true })
      if (r1 && r1.data) cfg = r1.data
    } catch (e) {
      console.warn('[im] /config fail', e && e.message)
    }
    this.enabled = !!cfg.enabled
    if (!cfg.enabled || !cfg.ready) {
      return { enabled: !!cfg.enabled, ready: false, sdkAppId: '', userId: '', userSig: '', expireAt: 0 }
    }
    if (!getToken()) {
      return { enabled: true, ready: false, sdkAppId: cfg.sdkAppId, userId: '', userSig: '', expireAt: 0 }
    }
    // 2. POST /api/im/login 拿 userSig
    try {
      const r2 = await request({ url: '/im/login', method: 'POST' })
      return r2.data || {}
    } catch (e) {
      console.warn('[im] /login fail', e && e.message)
      return { enabled: true, ready: false, sdkAppId: cfg.sdkAppId, userId: '', userSig: '', expireAt: 0 }
    }
  }

  /**
   * 确保 TIM 初始化并完成 login。若 IM 未启用/缺密钥/无 token，返回 { ok:false, reason }
   * @returns {Promise<{ok:boolean, reason?:string}>}
   */
  async ensureReady() {
    if (this.ready && this.tim) return { ok: true }
    if (!this.TIM) {
      return { ok: false, reason: 'TIM SDK 未安装：请在 app/ 目录执行 npm install' }
    }
    if (this._initPromise) return this._initPromise
    this._initPromise = (async () => {
      try {
        const info = await this._fetchLogin()
        if (!info.enabled) { this._initPromise = null; return { ok: false, reason: 'IM 未在服务端启用' } }
        if (!info.ready)   { this._initPromise = null; return { ok: false, reason: 'IM 配置不齐全（SDKAppID / 密钥未填）' } }
        if (!info.userSig) { this._initPromise = null; return { ok: false, reason: '未登录 / 服务端签发 userSig 失败' } }

        const sdkAppId = Number(info.sdkAppId)
        if (!sdkAppId) { this._initPromise = null; return { ok: false, reason: 'SDKAppID 无效' } }

        // 复用现有实例
        if (!this.tim || this.sdkAppId !== sdkAppId) {
          this.tim = this.TIM.create({ SDKAppID: sdkAppId, oversea: false })
          // #ifndef MP-WEIXIN
          try { this.tim.setLogLevel(LOG_LEVEL) } catch (_) {}
          // #endif
          // #ifdef MP-WEIXIN
          try { this.tim.setLogLevel(LOG_LEVEL) } catch (_) {}
          // #endif

          // 监听核心事件
          this.tim.on(this.TIM.EVENT.MESSAGE_RECEIVED, (evt) => this._onMessage(evt))
          this.tim.on(this.TIM.EVENT.CONVERSATION_LIST_UPDATED, (evt) => this._onConvUpdated(evt))
          this.tim.on(this.TIM.EVENT.MESSAGE_REVOKED, (evt) => this.emit('MESSAGE_REVOKED', evt))
          this.tim.on(this.TIM.EVENT.MESSAGE_READ_BY_PEER, (evt) => this.emit('MESSAGE_READ', evt))
          this.tim.on(this.TIM.EVENT.ERROR, (evt) => this.emit('ERROR', evt))
          this.tim.on(this.TIM.EVENT.NET_STATE_CHANGE, (evt) => this.emit('NET_STATE', evt))
          this.tim.on(this.TIM.EVENT.KICKED_OUT, (evt) => this.emit('KICKED_OUT', evt))
        }

        // login（同账号同签名幂等）
        const needLogin = !this.userId || this.userId !== String(info.userId) || this.userSig !== info.userSig || Date.now() / 1000 >= this.expireAt - 600
        if (needLogin) {
          await this.tim.login({ userID: String(info.userId), userSig: info.userSig })
          this.userId = String(info.userId)
          this.userSig = info.userSig
          this.expireAt = Number(info.expireAt) || (Math.floor(Date.now() / 1000) + 15552000)
          this.sdkAppId = sdkAppId
          uni.setStorageSync(STORAGE_KEY, {
            sdkAppId, userId: this.userId, expireAt: this.expireAt
          })
        }
        this.ready = true
        this.emit('READY', { userId: this.userId, sdkAppId: this.sdkAppId })
        return { ok: true }
      } catch (e) {
        console.warn('[im] ensureReady fail', e)
        this.ready = false
        this._initPromise = null
        return { ok: false, reason: (e && e.message) || '初始化失败' }
      }
    })()
    return this._initPromise
  }

  /** 内部：新消息分发 */
  _onMessage(evt) {
    const list = (evt && evt.data) || []
    for (const m of list) {
      const convID = m.conversationID
      if (!convID) continue
      const cache = this.messageCache.get(convID)
      if (cache) cache.push(this._normalizeMsg(m))
    }
    this.emit('MESSAGE', list.map(m => this._normalizeMsg(m)))
  }
  /** 内部：会话更新 */
  _onConvUpdated(evt) {
    this.conversations = (evt && evt.data) || this.conversations
    this.emit('CONVERSATION_UPDATED', this.conversations)
  }

  /** 归一化消息到 app 内部通用格式 */
  _normalizeMsg(m) {
    if (!m) return null
    const type = m.type || ''
    let contentType = 'text'
    let content = ''
    let duration = 0
    if (type === this.TIM.TYPES.MSG_TEXT) {
      contentType = 'text'
      content = (m.payload && m.payload.text) || ''
    } else if (type === this.TIM.TYPES.MSG_CUSTOM) {
      contentType = 'custom'
      content = (m.payload && m.payload.data) || ''
    } else if (type === this.TIM.TYPES.MSG_IMAGE) {
      contentType = 'image'
      const imgs = (m.payload && m.payload.imageInfoArray) || []
      content = (imgs[0] && imgs[0].url) || ((m.payload && m.payload.url) || '')
    } else if (type === this.TIM.TYPES.MSG_AUDIO) {
      contentType = 'voice'
      content = (m.payload && m.payload.url) || ''
      duration = (m.payload && Number(m.payload.second)) || 0
    } else if (type === this.TIM.TYPES.MSG_FILE) {
      contentType = 'file'
      content = (m.payload && m.payload.url) || ''
    } else if (type === this.TIM.TYPES.MSG_FACE) {
      contentType = 'face'
      content = (m.payload && String(m.payload.index)) || ''
    } else {
      contentType = 'text'
      content = (m.payload && (m.payload.text || m.payload.desc)) || ''
    }
    return {
      id: m.ID || m.msgId || `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      convID: m.conversationID,
      senderId: m.from || m.fromAccount || '',
      receiverId: m.to || m.toAccount || '',
      type: contentType,
      content,
      duration,
      isRead: m.isRead !== false,
      isRevoked: !!m.isRevoked,
      flow: m.flow,
      createdAt: (m.time ? m.time * 1000 : Date.now()),
      status: m.status || 'success',
      nick: m.nick || '',
      avatar: m.avatar || '',
      _raw: m
    }
  }

  /**
   * 拉会话列表
   */
  async getConversationList() {
    const r = await this.ensureReady()
    if (!r.ok) return { list: [], ok: false, reason: r.reason }
    try {
      const res = await this.tim.getConversationList()
      const convs = (res.data && res.data.conversationList) || []
      this.conversations = convs
      return { list: convs, ok: true }
    } catch (e) {
      return { list: [], ok: false, reason: e && e.message }
    }
  }

  /**
   * 拉某会话历史消息
   */
  async getMessageList(convID, opt = {}) {
    const r = await this.ensureReady()
    if (!r.ok) return { list: [], ok: false, reason: r.reason }
    try {
      const res = await this.tim.getMessageList({
        conversationID: convID,
        nextReqMessageID: opt.nextReqMessageID || undefined,
        count: opt.count || 50
      })
      const list = ((res.data && res.data.messageList) || []).map(m => this._normalizeMsg(m))
      this.messageCache.set(convID, list)
      return {
        list,
        ok: true,
        isCompleted: !!(res.data && res.data.isCompleted),
        nextReqMessageID: (res.data && res.data.nextReqMessageID) || ''
      }
    } catch (e) {
      return { list: [], ok: false, reason: e && e.message }
    }
  }

  /**
   * 主动打开会话：返回 {conversation, convID}
   */
  async getConversation(convID) {
    const r = await this.ensureReady()
    if (!r.ok) return { ok: false, reason: r.reason }
    try {
      const res = await this.tim.checkConversation(convID)
      return { ok: true, conversation: res.data && res.data.conversation, convID }
    } catch (e) {
      return { ok: false, reason: e && e.message }
    }
  }

  /** 设置消息已读 */
  async setMessageRead(convID) {
    const r = await this.ensureReady()
    if (!r.ok) return r
    try { await this.tim.setMessageRead({ conversationID: convID }); return { ok: true } }
    catch (e) { return { ok: false, reason: e && e.message } }
  }

  /** 删除会话 */
  async deleteConversation(convID) {
    const r = await this.ensureReady()
    if (!r.ok) return r
    try { await this.tim.deleteConversation(convID); return { ok: true } }
    catch (e) { return { ok: false, reason: e && e.message } }
  }

  /** 发送文本消息 */
  async sendText(toUserId, text) {
    const r = await this.ensureReady()
    if (!r.ok) return r
    try {
      const convID = `C2C${toUserId}`
      const msg = this.tim.createTextMessage({ to: toUserId, conversationType: 'C2C', payload: { text: String(text) } })
      const res = await this.tim.sendMessage(msg)
      const sent = this._normalizeMsg(res.data && res.data.message ? res.data.message : msg)
      // 写入 cache
      const arr = this.messageCache.get(convID) || []
      arr.push(sent)
      this.messageCache.set(convID, arr)
      return { ok: true, message: sent }
    } catch (e) {
      return { ok: false, reason: e && e.message }
    }
  }

  /** 发送图片消息（url 先上传 OSS，再塞给 IM） */
  async sendImage(toUserId, imageUrl) {
    const r = await this.ensureReady()
    if (!r.ok) return r
    try {
      const msg = this.tim.createImageMessage({
        to: toUserId, conversationType: 'C2C',
        payload: { file: { url: imageUrl } }
      })
      const res = await this.tim.sendMessage(msg)
      const sent = this._normalizeMsg(res.data && res.data.message ? res.data.message : msg)
      const convID = `C2C${toUserId}`
      const arr = this.messageCache.get(convID) || []
      arr.push(sent)
      this.messageCache.set(convID, arr)
      return { ok: true, message: sent }
    } catch (e) {
      return { ok: false, reason: e && e.message }
    }
  }

  /** 发送语音消息（url + 秒数，先上传 OSS 再调用） */
  async sendVoice(toUserId, audioUrl, second) {
    const r = await this.ensureReady()
    if (!r.ok) return r
    try {
      const msg = this.tim.createAudioMessage({
        to: toUserId, conversationType: 'C2C',
        payload: { file: { url: audioUrl }, second: Math.max(1, Number(second) || 1) }
      })
      const res = await this.tim.sendMessage(msg)
      const sent = this._normalizeMsg(res.data && res.data.message ? res.data.message : msg)
      const convID = `C2C${toUserId}`
      const arr = this.messageCache.get(convID) || []
      arr.push(sent)
      this.messageCache.set(convID, arr)
      return { ok: true, message: sent }
    } catch (e) {
      return { ok: false, reason: e && e.message }
    }
  }

  /** 撤回消息 */
  async revokeMessage(message) {
    const r = await this.ensureReady()
    if (!r.ok) return r
    try {
      const raw = (message && message._raw) ? message._raw : message
      await this.tim.revokeMessage(raw)
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e && e.message }
    }
  }

  /** 获取上下文 */
  getCtx() {
    return {
      SDKReady: this.ready,
      enabled: this.enabled,
      tim: this.tim,
      TIM: this.TIM,
      sdkAppId: this.sdkAppId,
      userId: this.userId,
      expireAt: this.expireAt,
      messageCache: this.messageCache,
      conversations: this.conversations
    }
  }

  /** 登出并销毁 */
  async logout() {
    if (this.tim && this.ready) {
      try { await this.tim.logout() } catch (_) {}
      try { await this.tim.destroy() } catch (_) {}
    }
    this.tim = null
    this.ready = false
    this._initPromise = null
    this.conversations = []
    this.messageCache.clear()
    uni.removeStorageSync(STORAGE_KEY)
  }
}

const tim = new TIMManager()
export default tim

// force rebuild: ensure H5 image includes latest TIM SDK bundle
