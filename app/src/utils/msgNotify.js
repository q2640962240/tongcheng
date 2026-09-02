/**
 * 全局消息提醒：底部「消息」Tab 未读角标 + 新消息震动
 *
 * 独立于会话/聊天页挂载，登录后常驻，保证用户在首页/发现等任意页面也能：
 *   - 看到「消息」Tab 上的未读数字随 IM 总未读实时更新
 *   - 收到他人新消息且不在聊天页时短震动提醒
 * 与官方 TUIConversation 组件内的角标 watch 幂等（同为 setTabBarBadge 同一 index）。
 * 第三方系统推送按需求排除，这里均为本地能力。
 */
import { TUILogin } from '@tencentcloud/tui-core-lite'
import { TUIStore, StoreName } from '@tencentcloud/chat-uikit-engine-lite'
import TencentCloudChat from '@tencentcloud/chat'
import { ensureTUILogin } from './tuilogin'

// tabBar 顺序：首页(0) 发现(1) 消息(2) 我的(3)
const MSG_TAB_INDEX = 2

let _attachedChat = null

function setBadge(count) {
  try {
    const n = Number(count) || 0
    if (n > 0) {
      uni.setTabBarBadge({ index: MSG_TAB_INDEX, text: n > 99 ? '99+' : String(n) })
    } else {
      uni.removeTabBarBadge({ index: MSG_TAB_INDEX })
    }
  } catch (_) { /* 非 tabbar 页或 index 越界时忽略 */ }
}

function isOnChatPage() {
  try {
    const pages = getCurrentPages() || []
    const route = String((pages[pages.length - 1] || {}).route || '')
    return route.includes('TUIChat') || route.includes('pages/chat/chat')
  } catch (_) {
    return false
  }
}

function _onUnread(count) {
  setBadge(count)
}

// 未读数计算防抖 + 频率限制：避免会话列表频繁更新时重复计算
let _unreadTimer = null
let _lastCompute = 0
const UNREAD_DEBOUNCE = 300 // 300ms 防抖
const UNREAD_MIN_INTERVAL = 500 // 两次计算至少间隔 500ms

function debouncedComputeUnread(list) {
  const now = Date.now()
  if (now - _lastCompute < UNREAD_MIN_INTERVAL) return // 频率限制
  clearTimeout(_unreadTimer)
  _unreadTimer = setTimeout(() => {
    _lastCompute = Date.now()
    const total = computeUnread(list)
    setBadge(total)
  }, UNREAD_DEBOUNCE)
}

function computeUnread(list) {
  let total = 0
  for (const c of (list || [])) {
    if (c && !c.isMuted) total += Number(c.unreadCount) || 0
  }
  return total
}

function _onConvList(list) {
  debouncedComputeUnread(list)
}

function _onMsgReceived(event) {
  const list = (event && event.data) || []
  let myId = ''
  try { myId = String((TUILogin.getContext() || {}).userID || '') } catch (_) { /* ignore */ }
  const hasIncoming = list.some(
    (m) => m && String(m.conversationID || '').startsWith('C2C') && String(m.from || '') !== myId,
  )
  if (!hasIncoming) return
  if (isOnChatPage()) return
  try { uni.vibrateShort({ fail: () => {} }) } catch (_) { /* 部分平台不支持 */ }
}

function attach() {
  try {
    const ctx = TUILogin.getContext()
    const chat = ctx && ctx.chat
    if (!chat || typeof chat.on !== 'function') return
    if (_attachedChat === chat) return
    // 换账号/重登后 chat 实例会更换：先解绑旧的
    if (_attachedChat && typeof _attachedChat.off === 'function') {
      try { _attachedChat.off(TencentCloudChat.EVENT.MESSAGE_RECEIVED, _onMsgReceived) } catch (_) { /* ignore */ }
      try { TUIStore.unwatch(StoreName.CONV, { totalUnreadCount: _onUnread, conversationList: _onConvList }) } catch (_) { /* ignore */ }
    }
    TUIStore.watch(StoreName.CONV, { totalUnreadCount: _onUnread, conversationList: _onConvList })
    chat.on(TencentCloudChat.EVENT.MESSAGE_RECEIVED, _onMsgReceived)
    _attachedChat = chat
  } catch (e) {
    console.warn('[msgNotify] attach fail', e && e.message)
  }
}

/** 登录后（或 App 启动已登录）调用；内部幂等 */
export async function setupGlobalMsgNotify() {
  // #ifdef H5 || APP-PLUS || APP
  const r = await ensureTUILogin()
  if (!r || !r.ok) return
  attach()
  try {
    setBadge(computeUnread(TUIStore.getData(StoreName.CONV, 'conversationList')))
  } catch (_) { /* ignore */ }
  // #endif
}

/** 主动刷新角标：tab 页 onShow 调用，规避在非 tab 页时 setTabBarBadge/removeTabBarBadge 不生效 */
export function refreshMsgBadge() {
  // #ifdef H5 || APP-PLUS || APP
  try {
    setBadge(computeUnread(TUIStore.getData(StoreName.CONV, 'conversationList')))
  } catch (_) { /* ignore */ }
  // #endif
}

/** 退出登录时调用，清理监听与角标 */
export function teardownGlobalMsgNotify() {
  // #ifdef H5 || APP-PLUS || APP
  try {
    if (_attachedChat && typeof _attachedChat.off === 'function') {
      _attachedChat.off(TencentCloudChat.EVENT.MESSAGE_RECEIVED, _onMsgReceived)
    }
    TUIStore.unwatch(StoreName.CONV, { totalUnreadCount: _onUnread, conversationList: _onConvList })
  } catch (_) { /* ignore */ }
  _attachedChat = null
  setBadge(0)
  // #endif
}
