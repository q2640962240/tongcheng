<template>
  <view class="page chat-page">
    <!-- 消息流 -->
    <scroll-view
      class="msg-scroll"
      scroll-y
      :scroll-into-view="scrollAnchor"
      :scroll-with-animation="true"
      @scrolltoupper="onScrollTop"
    >
      <view v-if="loadingMore" class="load-tip">加载更早消息…</view>
      <view v-if="!hasMore && messages.length" class="load-tip">已是最早的消息</view>

      <view v-for="(m, idx) in messages" :key="m.id" :id="`msg-${m.id}`">
        <view v-if="showTimeDivider(idx)" class="time-divider">{{ formatTime(m.createdAt) }}</view>
        <view class="msg-row" :class="{ mine: isMine(m) }">
          <image v-if="!isMine(m)" class="msg-avatar" :src="avatarOf(m, false)" mode="aspectFill" @tap="onPeerTap" />
          <view class="bubble" :class="isMine(m) ? 'bubble-mine' : 'bubble-peer'">
            <template v-if="m.type === 'image'">
              <image class="msg-image" :src="resolveUrl(m.content)" mode="widthFix" @tap="previewImage(m)" />
            </template>
            <template v-else-if="m.type === 'video'">
              <view class="video-card" @tap="playVideo(m)">
                <image class="video-thumb" :src="m.coverUrl || resolveUrl(m.content)" mode="aspectFill" />
                <view class="video-play-icon">▶</view>
                <view class="video-duration" v-if="m.duration">{{ m.duration }}″</view>
              </view>
            </template>
            <template v-else-if="m.type === 'voice'">
              <view class="voice-row" @tap="playVoice(m)">
                <text class="voice-icon">{{ playingId === m.id ? '⏸' : '▶' }}</text>
                <view class="voice-bars">
                  <view v-for="n in 4" :key="n" class="voice-bar" :style="{ height: (8 + n * 4) + 'rpx' }"></view>
                </view>
                <text class="voice-dur">{{ m.duration || 1 }}″</text>
              </view>
            </template>
            <template v-else>
              <text class="msg-text">{{ m.content }}</text>
            </template>
          </view>
          <view v-if="isMine(m)" class="msg-status">
            <text v-if="m.status === 'sending'" class="status-sending">…</text>
            <text v-else-if="m.status === 'failed'" class="status-failed" @tap="resend(m)">!</text>
            <text v-else-if="m.isRead" class="status-read">已读</text>
          </view>
          <image v-if="isMine(m)" class="msg-avatar" :src="avatarOf(m, true)" mode="aspectFill" />
        </view>
      </view>

      <view v-if="typing" class="typing-tip">对方正在输入…</view>
      <view id="msg-bottom" style="height: 10rpx;"></view>
    </scroll-view>

    <!-- 输入栏 -->
    <view class="input-bar">
      <view class="btn-plus" @tap="onPickImage">
        <text class="plus-icon">🖼</text>
      </view>
      <input
        class="msg-input"
        v-model="draft"
        confirm-type="send"
        :adjust-position="true"
        placeholder="输入消息…"
        @confirm="sendText"
        @input="onTyping"
      />
      <view class="btn-send" :class="{ disabled: !draft.trim() }" @tap="sendText">发送</view>
    </view>
  </view>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import request, { getCurrentBaseURL } from '@/utils/request'
import chatSocket from '@/utils/chatSocket'
import { uploadFile } from '@/utils/upload'
import { useUserStore } from '@/store/user'
import { ensureTUILogin, getTUILoginContext } from '@/utils/tuilogin'

const userStore = useUserStore()

const peerId = ref('')
const peerName = ref('聊天')
const peerAvatar = ref('')
const messages = ref([])
const draft = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const page = ref(1)
const typing = ref(false)
const playingId = ref('')
const scrollAnchor = ref('')
const connected = ref(false)

let seq = 0
let typingTimer = null
let typingHideTimer = null
let pollTimer = null
let socketOffs = []
let audioCtx = null

function resolveUrl(u) {
  const s = String(u || '')
  if (!s) return ''
  if (/^(https?:)?\/\//.test(s) || s.startsWith('data:')) return s
  const base = getCurrentBaseURL() || ''
  let host = base.replace(/\/api\/?$/i, '')
  if (!/^https?:\/\//i.test(host)) {
    try {
      if (typeof window !== 'undefined' && window.location) host = window.location.origin
    } catch (_) { host = '' }
  }
  return host + (s.startsWith('/') ? s : '/' + s)
}

function isMine(m) {
  return String(m.senderId) === String(userStore.userId)
}

function avatarOf(m, mine) {
  if (mine) return resolveUrl(userStore.avatar) || '/static/logo.png'
  return resolveUrl(peerAvatar.value) || '/static/logo.png'
}

function showTimeDivider(idx) {
  if (idx === 0) return true
  const prev = messages.value[idx - 1]
  const cur = messages.value[idx]
  return (new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime()) > 5 * 60 * 1000
}

function formatTime(t) {
  const d = new Date(t)
  const now = new Date()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === now.toDateString()) return hm
  const yesterday = new Date(now.getTime() - 86400000)
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hm}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

function scrollToBottom() {
  nextTick(() => {
    scrollAnchor.value = ''
    nextTick(() => { scrollAnchor.value = 'msg-bottom' })
  })
}

async function loadPeer() {
  try {
    const r = await request({ url: `/user/provider/${peerId.value}`, method: 'GET' })
    const d = r && r.data
    if (d) {
      peerName.value = d.nickname || peerName.value
      peerAvatar.value = d.avatar || ''
      uni.setNavigationBarTitle({ title: peerName.value })
    }
  } catch (_) { /* 头像昵称拉取失败不影响聊天 */ }
}

async function loadHistory(appendOlder = false) {
  if (loading.value || loadingMore.value) return
  if (appendOlder) loadingMore.value = true
  else loading.value = true
  try {
    const nextPage = appendOlder ? page.value + 1 : 1
    const r = await request({
      url: `/chat/history/${peerId.value}?page=${nextPage}&pageSize=50`,
      method: 'GET'
    })
    const d = r && r.data
    const list = (d && d.list) || []
    const total = (d && d.total) || 0
    if (appendOlder) {
      if (list.length) messages.value = [...list, ...messages.value]
      page.value = nextPage
      hasMore.value = messages.value.length < total
    } else {
      messages.value = list
      page.value = 1
      hasMore.value = list.length < total
      scrollToBottom()
    }
  } catch (e) {
    console.warn('[chat] loadHistory fail', e)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function onScrollTop() {
  if (hasMore.value && !loadingMore.value && messages.value.length) loadHistory(true)
}

function pushMessage(m) {
  const exists = messages.value.some(x => String(x.id) === String(m.id))
  if (exists) return
  messages.value = [...messages.value, m]
  scrollToBottom()
}

function appendLocalMessage(m) {
  messages.value = [...messages.value, m]
  scrollToBottom()
}

function updateLocalMessage(id, patch) {
  messages.value = messages.value.map(x => String(x.id) === String(id) ? { ...x, ...patch } : x)
}

/** 发送消息：优先走实时通道（带 ack），未连接时走 HTTP 备用通道 */
async function doSend(type, content, extra = {}) {
  const localId = `local_${Date.now()}_${seq++}`
  const localMsg = {
    id: localId,
    senderId: userStore.userId,
    receiverId: peerId.value,
    type,
    content,
    duration: extra.duration || 0,
    isRead: false,
    status: 'sending',
    createdAt: Date.now()
  }
  appendLocalMessage(localMsg)

  const applyAck = (saved) => {
    if (saved && saved.id) updateLocalMessage(localId, { id: saved.id, status: 'success', createdAt: saved.createdAt || Date.now() })
    else updateLocalMessage(localId, { status: 'success' })
  }

  if (chatSocket.connected) {
    chatSocket.emit('message', {
      receiverId: Number(peerId.value),
      type,
      content,
      duration: extra.duration || undefined
    }, (ack) => {
      if (ack && ack.ok) applyAck(ack.data)
      else sendViaHttp(type, content, extra, localId, applyAck)
    })
  } else {
    await sendViaHttp(type, content, extra, localId, applyAck)
  }
}

async function sendViaHttp(type, content, extra, localId, applyAck) {
  try {
    const r = await request({
      url: '/chat',
      method: 'POST',
      data: { receiverId: Number(peerId.value), type, content, duration: extra.duration || undefined }
    })
    if (r && r.code === 0) applyAck(r.data)
    else {
      updateLocalMessage(localId, { status: 'failed' })
      uni.showToast({ title: (r && r.message) || '发送失败', icon: 'none' })
    }
  } catch (e) {
    updateLocalMessage(localId, { status: 'failed' })
    uni.showToast({ title: '网络异常，发送失败', icon: 'none' })
  }
}

function resend(m) {
  if (m.status !== 'failed') return
  messages.value = messages.value.filter(x => String(x.id) !== String(m.id))
  doSend(m.type, m.content, { duration: m.duration })
}

function sendText() {
  const text = draft.value.trim()
  if (!text) return
  draft.value = ''
  doSend('text', text)
}

function onPickImage() {
  uni.chooseImage({
    count: 1,
    success: async (res) => {
      const path = res.tempFilePaths && res.tempFilePaths[0]
      if (!path) return
      try {
        uni.showLoading({ title: '发送中…' })
        const up = await uploadFile(path)
        uni.hideLoading()
        if (up && up.url) doSend('image', up.url)
      } catch (e) {
        uni.hideLoading()
        uni.showToast({ title: '图片发送失败', icon: 'none' })
      }
    }
  })
}

function previewImage(m) {
  uni.previewImage({ urls: [resolveUrl(m.content)] })
}

function playVideo(m) {
  const url = resolveUrl(m.content)
  if (!url) return
  // #ifdef APP-PLUS || H5
  uni.previewMedia({
    sources: [{ url, type: 'video' }],
    fail: () => {
      uni.showToast({ title: '视频播放失败', icon: 'none' })
    }
  })
  // #endif
  // #ifndef APP-PLUS || H5
  uni.showToast({ title: '当前平台不支持视频播放', icon: 'none' })
  // #endif
}

function playVoice(m) {
  try {
    if (!audioCtx) audioCtx = uni.createInnerAudioContext()
    if (playingId.value === m.id) {
      audioCtx.stop()
      playingId.value = ''
      return
    }
    audioCtx.src = resolveUrl(m.content)
    audioCtx.onEnded(() => { playingId.value = '' })
    audioCtx.onError(() => { playingId.value = ''; uni.showToast({ title: '语音播放失败', icon: 'none' }) })
    audioCtx.play()
    playingId.value = m.id
  } catch (_) {
    uni.showToast({ title: '语音播放失败', icon: 'none' })
  }
}

let lastTypingAt = 0
function onTyping() {
  const now = Date.now()
  if (now - lastTypingAt < 2000) return
  lastTypingAt = now
  if (chatSocket.connected) chatSocket.emit('typing', { receiverId: Number(peerId.value) })
}

function onPeerTap() {
  // 旧达人主页已移除，统一跳转到新个人主页
  if (peerId.value) uni.navigateTo({ url: `/pages/user-profile/user-profile?id=${peerId.value}` })
}

function setupSocket() {
  let everConnected = false
  socketOffs.push(chatSocket.on('connect', () => {
    connected.value = true
    chatSocket.emit('read', { receiverId: Number(peerId.value) })
    if (everConnected) {
      // 重连：刷新历史，找回断线期间服务端推送但没收到的消息
      loadHistory(false)
    }
    everConnected = true
  }))
  socketOffs.push(chatSocket.on('disconnect', () => { connected.value = false }))
  socketOffs.push(chatSocket.on('message', (msg) => {
    if (!msg) return
    const myId = String(userStore.userId)
    const fromPeer = String(msg.senderId) === String(peerId.value) && String(msg.receiverId) === myId
    const echoMine = String(msg.senderId) === myId && String(msg.receiverId) === String(peerId.value)
    if (!fromPeer && !echoMine) return
    if (fromPeer) {
      pushMessage({ ...msg, status: 'success' })
      chatSocket.emit('read', { receiverId: Number(peerId.value) })
    }
  }))
  socketOffs.push(chatSocket.on('typing', (d) => {
    if (!d || String(d.from) !== String(peerId.value)) return
    typing.value = true
    if (typingHideTimer) clearTimeout(typingHideTimer)
    typingHideTimer = setTimeout(() => { typing.value = false }, 3000)
  }))
  socketOffs.push(chatSocket.on('read', (d) => {
    if (!d || String(d.by) !== String(peerId.value)) return
    messages.value = messages.value.map(x => isMine(x) ? { ...x, isRead: true } : x)
  }))
  chatSocket.connect()
}

/** 实时通道不可用时的轮询兜底：每 5s 拉一次最新消息 */
function startPollingFallback() {
  pollTimer = setInterval(async () => {
    if (chatSocket.connected) return
    try {
      const r = await request({ url: `/chat/history/${peerId.value}?page=1&pageSize=50`, method: 'GET' })
      const list = (r && r.data && r.data.list) || []
      if (!list.length) return
      const known = new Set(messages.value.map(x => String(x.id)))
      const fresh = list.filter(x => !known.has(String(x.id)))
      if (fresh.length) {
        messages.value = list
        scrollToBottom()
      } else {
        // 同步已读状态变化
        messages.value = messages.value.map(x => {
          const s = list.find(y => String(y.id) === String(x.id))
          return s ? { ...x, isRead: s.isRead } : x
        })
      }
    } catch (_) {}
  }, 5000)
}

onLoad(async (options) => {
  const o = options || {}
  let pid = ''
  if (o.conversationID) {
    pid = String(o.conversationID).replace(/^C2C/i, '').replace(/^GROUP/i, '')
  }
  if (!pid) pid = String(o.userId || o.to || o.id || o.uid || o.providerId || '')
  peerId.value = pid
  if (o.name) peerName.value = decodeURIComponent(o.name)
  uni.setNavigationBarTitle({ title: peerName.value })

  // #ifdef APP-PLUS
  // 监听键盘高度变化，确保消息列表跟随滚动
  uni.onKeyboardHeightChange((height) => {
    if (height > 0) {
      nextTick(() => {
        scrollToBottom()
      })
    }
  })
  // #endif

  if (!userStore.isLoggedIn) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 800)
    return
  }
  if (!peerId.value) {
    uni.showToast({ title: '会话参数缺失', icon: 'none' })
    return
  }

  // 优先走腾讯云官方 TUIKit 聊天页：IM 登录就绪则跳官方页面；
  // 未启用/未就绪/超时 → 回退下方自建 WebSocket 聊天，保证聊天永远可用
  try {
    const r = await Promise.race([
      ensureTUILogin(),
      new Promise((resolve) => setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 8000))
    ])
    const ctx = getTUILoginContext()
    if (r && r.ok && ctx && ctx.chat && ctx.chat.isReady && ctx.chat.isReady()) {
      uni.redirectTo({ url: `/TUIKit/components/TUIChat/index?conversationID=C2C${peerId.value}` })
      return
    }
  } catch (_) { /* IM 不可用，走自建聊天 */ }

  loadPeer()
  setupSocket()
  startPollingFallback()
  await loadHistory(false)

  // 打招呼：无历史消息时自动发送一句问候
  if (String(o.hi) === '1' && messages.value.length === 0) {
    doSend('text', '你好，我对你的服务很感兴趣，方便聊聊吗？')
  }
})

onUnload(() => {
  while (socketOffs.length) {
    const fn = socketOffs.pop()
    try { fn && fn() } catch (_) {}
  }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (typingTimer) clearTimeout(typingTimer)
  if (typingHideTimer) clearTimeout(typingHideTimer)
  if (audioCtx) { try { audioCtx.destroy() } catch (_) {} audioCtx = null }
})
</script>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $by-bg;
}

.msg-scroll {
  flex: 1;
  height: 0;
  padding: 20rpx 24rpx;
  box-sizing: border-box;
}

.load-tip {
  text-align: center;
  color: $by-text-3;
  font-size: 24rpx;
  padding: 16rpx 0;
}

.time-divider {
  text-align: center;
  color: $by-text-3;
  font-size: 22rpx;
  padding: 18rpx 0;
}

.msg-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 28rpx;

  &.mine {
    flex-direction: row-reverse;
  }
}

.msg-avatar {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: $by-bg-soft;
  flex-shrink: 0;
}

.bubble {
  max-width: 62%;
  margin: 0 20rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  word-break: break-all;
}
.bubble-peer { background: $by-surface; box-shadow: $by-shadow-1; }
.bubble-mine { background: $by-surface-2; }

.msg-text {
  font-size: 30rpx;
  color: $by-text-1;
  line-height: 1.5;
}

.msg-image {
  max-width: 320rpx;
  border-radius: 12rpx;
  display: block;
}

.video-card {
  position: relative;
  width: 320rpx;
  height: 240rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: #000;
}
.video-thumb {
  width: 100%;
  height: 100%;
}
.video-play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.video-duration {
  position: absolute;
  bottom: 8rpx;
  right: 12rpx;
  font-size: 22rpx;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.voice-row {
  display: flex;
  align-items: center;
  min-width: 160rpx;
}
.voice-icon { font-size: 28rpx; margin-right: 12rpx; }
.voice-bars {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-right: 12rpx;
}
.voice-bar {
  width: 6rpx;
  background: $by-text-3;
  border-radius: 4rpx;
}
.voice-dur { font-size: 26rpx; color: $by-text-3; }

.msg-status {
  display: flex;
  align-items: center;
  margin-right: 12rpx;
}
.status-sending { color: $by-text-3; font-size: 28rpx; }
.status-failed {
  color: #fff;
  background: #EF4444;
  border-radius: 50%;
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  font-size: 26rpx;
}
.status-read { color: $by-text-3; font-size: 22rpx; }

.typing-tip {
  text-align: center;
  color: $by-text-3;
  font-size: 24rpx;
  padding: 8rpx 0;
}

.input-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 20rpx;
  padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: $by-bg-soft;
  border-top: 1rpx solid $by-border;
}

.btn-plus {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.plus-icon { font-size: 44rpx; }

.msg-input {
  flex: 1;
  height: 72rpx;
  background: $by-bg-soft;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: $by-text-1;
}

.btn-send {
  margin-left: 16rpx;
  padding: 0 32rpx;
  height: 72rpx;
  line-height: 72rpx;
  background: $by-gold;
  color: $by-bg;
  border-radius: 12rpx;
  font-size: 30rpx;
  font-weight: 600;
  flex-shrink: 0;

  &.disabled {
    background: $by-bg-soft;
    color: $by-text-mute;
  }
}

/* #ifdef APP-PLUS */
.chat-page {
  /* 防止键盘弹出时页面异常缩放 */
  height: 100vh;
  overflow: hidden;
}
.msg-scroll {
  /* 消息区域可滚动 */
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.input-bar {
  /* 输入栏固定在底部 */
  flex-shrink: 0;
}
/* #endif */
</style>
