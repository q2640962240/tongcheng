<template>
  <view class="page chat-list-page">
    <!-- 未登录 -->
    <view v-if="!isLoggedIn" class="empty-wrap">
      <text class="empty-icon">💬</text>
      <text class="empty-text">登录后查看你的消息</text>
      <view class="btn-login" @tap="goLogin">去登录</view>
    </view>

    <template v-else>
      <!-- 加载 / 空态 -->
      <view v-if="loading" class="empty-wrap">
        <text class="empty-text">加载中…</text>
      </view>
      <view v-else-if="!sessions.length" class="empty-wrap">
        <text class="empty-icon">💬</text>
        <text class="empty-text">暂无会话，去发现页找位伙伴聊聊吧</text>
      </view>

      <!-- 会话列表 -->
      <scroll-view v-else class="session-scroll" scroll-y>
        <view
          v-for="s in sessions"
          :key="s.sessionId"
          class="session-item"
          @tap="openSession(s)"
        >
          <view class="avatar-wrap">
            <image class="session-avatar" :src="avatarOf(s)" mode="aspectFill" />
            <view v-if="s.unreadCount > 0" class="badge">
              {{ s.unreadCount > 99 ? '99+' : s.unreadCount }}
            </view>
          </view>
          <view class="session-main">
            <view class="session-top">
              <text class="session-name">{{ s.otherUser ? s.otherUser.nickname : '用户' + peerIdOf(s) }}</text>
              <text class="session-time">{{ formatTime(s.lastMessageTime) }}</text>
            </view>
            <view class="session-bottom">
              <text class="session-last">{{ lastText(s) }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import request, { getCurrentBaseURL } from '@/utils/request'
import chatSocket from '@/utils/chatSocket'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const isLoggedIn = ref(userStore.isLoggedIn)
const loading = ref(false)
const sessions = ref([])

let socketOffs = []

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

function peerIdOf(s) {
  if (s.otherUser && s.otherUser.id) return s.otherUser.id
  const myId = String(userStore.userId)
  return String(s.sessionId || '').split('-').find(x => x !== myId) || ''
}

function avatarOf(s) {
  return resolveUrl(s.otherUser && s.otherUser.avatar) || '/static/logo.png'
}

function lastText(s) {
  if (s.lastMessageType === 'image') return '[图片]'
  if (s.lastMessageType === 'voice') return '[语音]'
  const t = String(s.lastMessage || '')
  return t.length > 30 ? t.slice(0, 30) + '…' : t
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  const now = new Date()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === now.toDateString()) return hm
  const yesterday = new Date(now.getTime() - 86400000)
  if (d.toDateString() === yesterday.toDateString()) return '昨天'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

async function loadSessions() {
  loading.value = true
  try {
    const r = await request({ url: '/chat/sessions', method: 'GET' })
    sessions.value = (r && r.data) || []
  } catch (e) {
    console.warn('[chat-list] load fail', e)
  } finally {
    loading.value = false
  }
}

function openSession(s) {
  const pid = peerIdOf(s)
  const name = s.otherUser ? encodeURIComponent(s.otherUser.nickname || '') : ''
  uni.navigateTo({ url: `/pages/chat/chat?userId=${pid}&name=${name}` })
}

function goLogin() {
  uni.reLaunch({ url: '/pages/login/login' })
}

function setupSocket() {
  socketOffs.push(chatSocket.on('message', (msg) => {
    if (!msg) return
    const myId = String(userStore.userId)
    const fromMe = String(msg.senderId) === myId
    const otherId = fromMe ? String(msg.receiverId) : String(msg.senderId)
    const sid = [myId, otherId].sort((a, b) => Number(a) - Number(b)).join('-')
    const arr = [...sessions.value]
    const idx = arr.findIndex(x => x.sessionId === sid)
    const preview = msg.type === 'image' ? '[图片]' : msg.type === 'voice' ? '[语音]' : String(msg.content || '')
    if (idx >= 0) {
      const s = { ...arr[idx], lastMessage: preview, lastMessageType: msg.type, lastMessageTime: msg.createdAt || Date.now() }
      if (!fromMe) s.unreadCount = (s.unreadCount || 0) + 1
      arr.splice(idx, 1)
      arr.unshift(s)
    } else {
      arr.unshift({
        sessionId: sid,
        otherUser: { id: otherId, nickname: '用户' + otherId, avatar: '' },
        lastMessage: preview,
        lastMessageType: msg.type,
        lastMessageTime: msg.createdAt || Date.now(),
        unreadCount: fromMe ? 0 : 1
      })
    }
    sessions.value = arr
  }))
  socketOffs.push(chatSocket.on('connect', () => {}))
  chatSocket.connect()
}

onShow(() => {
  isLoggedIn.value = userStore.isLoggedIn
  if (!isLoggedIn.value) return
  loadSessions()
  if (!socketOffs.length) setupSocket()
})

onUnload(() => {
  while (socketOffs.length) {
    const fn = socketOffs.pop()
    try { fn && fn() } catch (_) {}
  }
})
</script>

<style lang="scss" scoped>
.chat-list-page {
  background: #fff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.empty-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}
.empty-icon { font-size: 96rpx; margin-bottom: 24rpx; }
.empty-text { color: #999; font-size: 28rpx; }
.btn-login {
  margin-top: 32rpx;
  padding: 16rpx 64rpx;
  background: #07c160;
  color: #fff;
  border-radius: 40rpx;
  font-size: 30rpx;
}

.session-scroll {
  flex: 1;
  height: 0;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #f2f2f2;

  &:active { background: #f5f5f5; }
}

.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.session-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #eee;
}
.badge {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  min-width: 34rpx;
  height: 34rpx;
  line-height: 34rpx;
  padding: 0 8rpx;
  border-radius: 17rpx;
  background: #e53935;
  color: #fff;
  font-size: 20rpx;
  text-align: center;
}

.session-main {
  flex: 1;
  margin-left: 24rpx;
  overflow: hidden;
}
.session-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.session-name {
  font-size: 32rpx;
  color: #222;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-time { font-size: 22rpx; color: #bbb; margin-left: 16rpx; flex-shrink: 0; }
.session-bottom { margin-top: 8rpx; }
.session-last {
  font-size: 26rpx;
  color: #999;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
