<template>
  <view class="page chat-list-page">
    <!-- 顶部导航栏（微信风格：绿色底 + 搜索框） -->
    <view class="nav-bar wechat-nav">
      <view class="nav-title">消息</view>
      <view class="nav-add-btn" @tap="onAddTap">
        <text class="add-icon">＋</text>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar" @tap="onSearch">
      <text class="search-icon">🔍</text>
      <text class="search-placeholder">搜索</text>
    </view>

    <!-- 状态提示条（告诉用户当前通道：腾讯云 IM / 自建 WS） -->
    <view v-if="showBanner" class="channel-banner" :class="{ ok: useTIM, bad: !useTIM }">
      <text class="banner-icon">{{ useTIM ? '✅' : '⚠️' }}</text>
      <text class="banner-text">{{ useTIM ? '已连接：腾讯云 IM（多端同步 + 离线消息）' : `自建聊天模式：${fallbackReason || '实时可达，但离线不同步'}` }}</text>
    </view>

    <!-- 会话列表（TIM + 自建统一数据模型） -->
    <scroll-view scroll-y class="list-scroll" v-if="!loading">
      <view v-if="list.length === 0" class="empty">
        <text class="empty-icon">💬</text>
        <text class="empty-title">暂无消息</text>
        <text class="empty-tip">下单 / 发布服务 / 点「发消息」后开始实时聊天</text>
      </view>

      <view class="session-list">
        <view
          v-for="(s, idx) in list"
          :key="s.sessionId + '_' + idx"
          class="session-row"
          @tap="onOpen(s)"
          @longpress="onLongPress(s, idx)"
          :class="{ pinned: s.pinned, muted: s.muted }"
          hover-class="session-hover"
        >
          <!-- 头像 + 徽章 -->
          <view class="avatar-box">
            <image class="avatar" :src="s.avatar || '/static/avatar-user.png'" mode="aspectFill" />
            <view v-if="s.unreadCount > 0" class="badge" :class="{ dot: s.unreadCount < 0 }">
              <text v-if="s.unreadCount > 0">{{ s.unreadCount > 99 ? '99+' : s.unreadCount }}</text>
            </view>
          </view>
          <!-- 主体：昵称 / 最后一条 / 时间 -->
          <view class="session-body">
            <view class="row-top">
              <view class="name-row">
                <text class="name">{{ s.name || '未知用户' }}</text>
                <text v-if="s.isElite" class="elite-tag">精英</text>
                <text v-if="s.pinned" class="pinned-tag">置顶</text>
              </view>
              <text class="time">{{ formatTime(s.lastMessageTime) }}</text>
            </view>
            <view class="row-bottom">
              <text class="last-msg" @tap.stop="onOpen(s)">
                <text v-if="s.lastMessageType === 'voice'">[语音]</text>
                <text v-else-if="s.lastMessageType === 'image'">[图片]</text>
                <text v-else-if="s.lastMessageType === 'file'">[文件]</text>
                <text v-else>{{ s.lastMessage || '' }}</text>
              </text>
              <text v-if="s.muted" class="mute-icon">🔕</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-else class="loading-box">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { chatApi } from '../../api'
import { timeAgo } from '../../utils/format'
import tim from '../../utils/im'
import { useUserStore } from '../../store/user'

const userStore = useUserStore()
const loading = ref(false)
const list = ref([])             // 统一会话数组
const useTIM = ref(false)        // 是否使用腾讯云 IM
const fallbackReason = ref('')   // 未使用 IM 的原因
const showBanner = ref(true)

let offs = []

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }
  const yesterday = new Date(now.getTime() - 86400000).toDateString()
  if (d.toDateString() === yesterday) return '昨天'
  // 同一年 => MM/DD
  if (d.getFullYear() === now.getFullYear()) {
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

/** 将 TIM 会话转换到统一数据模型 */
function timConv2Local(c) {
  const isC2C = String(c.conversationID || '').startsWith('C2C')
  const otherId = isC2C ? String(c.userProfile && c.userProfile.userID ? c.userProfile.userID : '').replace(/^C2C/, '') : ''
  const avatar = (c.userProfile && c.userProfile.avatar) || c.faceUrl || '/static/avatar-user.png'
  const name = (c.name && c.name.length)
    ? c.name
    : ((c.userProfile && c.userProfile.nick) || (c.userProfile && c.userProfile.userID) || (isC2C ? otherId : '群聊'))
  const last = c.lastMessage
  let type = 'text'
  let text = ''
  if (last) {
    switch (last.type) {
      case 'TIMTextElem':  type = 'text'; text = (last.payload && last.payload.text) || ''; break
      case 'TIMImageElem': type = 'image'; break
      case 'TIMSoundElem': type = 'voice'; break
      case 'TIMFileElem':  type = 'file'; break
      case 'TIMCustomElem': type = 'custom'; text = '[自定义消息]'; break
      default: type = 'text'; text = (last.payload && (last.payload.text || last.payload.desc)) || ''
    }
  }
  return {
    sessionId: c.conversationID || String(Date.now()),
    convID: c.conversationID,
    otherUser: {
      id: otherId,
      userId: otherId,
      nickname: name,
      avatar
    },
    avatar,
    name,
    unreadCount: Number(c.unreadCount || 0),
    lastMessage: text,
    lastMessageType: type,
    lastMessageTime: last ? last.time * 1000 : (c.lastMessage ? (c.lastMessage.time * 1000) : (c.lastTime ? c.lastTime * 1000 : Date.now())),
    pinned: !!c.isPinned,
    muted: !!c.isMute,
    isElite: false,
    source: 'TIM'
  }
}

/** 自建聊天 sessions 映射 */
function localConv2Local(s) {
  return {
    sessionId: s.sessionId,
    convID: '',
    otherUser: s.otherUser || { id: s.otherUserId, nickname: s.name || '用户' },
    avatar: (s.otherUser && s.otherUser.avatar) || '/static/avatar-user.png',
    name: (s.otherUser && s.otherUser.nickname) || s.name || '未知用户',
    unreadCount: Number(s.unreadCount || 0),
    lastMessage: s.lastMessage || '',
    lastMessageType: s.lastMessageType || 'text',
    lastMessageTime: s.lastMessageTime ? new Date(s.lastMessageTime).getTime() : Date.now(),
    pinned: false,
    muted: false,
    isElite: !!(s.otherUser && s.otherUser.isElite),
    source: 'LOCAL'
  }
}

/** 从缓存的自建 sessions 里剔除已经由 TIM 覆盖的（以 otherUser.id 去重） */
function dedupe(timList, localList) {
  const set = new Set()
  for (const t of timList) {
    const id = (t.otherUser && String(t.otherUser.id)) || ''
    if (id) set.add(id)
  }
  const onlyLocal = localList.filter(l => {
    const id = (l.otherUser && String(l.otherUser.id)) || String(l.otherUserId || '')
    return !id || !set.has(id)
  })
  // 按 lastMessageTime 倒序合并
  return [...timList, ...onlyLocal].sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0))
}

/** 加载数据（主流程） */
const loadData = async () => {
  loading.value = true
  try {
    // 1) 尝试走腾讯云 IM
    const init = await tim.ensureReady()
    if (init.ok) {
      useTIM.value = true
      fallbackReason.value = ''
      const r = await tim.getConversationList()
      const timList = (r.ok ? r.list : []).map(timConv2Local)
      // 2) 自建会话拉过来用于兜底（历史遗留 + IM 未导入的老会话）
      let localList = []
      try {
        const r2 = await chatApi.sessions()
        localList = (r2.data || []).map(localConv2Local)
      } catch (_) { /* ignore */ }
      list.value = dedupe(timList, localList)
    } else {
      useTIM.value = false
      fallbackReason.value = init.reason || ''
      // 自建兜底
      try {
        const r2 = await chatApi.sessions()
        list.value = (r2.data || []).map(localConv2Local)
      } catch (_) { list.value = [] }
    }
  } catch (e) {
    console.warn('[chat-list] load fail', e)
  } finally {
    loading.value = false
  }
}

const onOpen = (s) => {
  const otherId = (s.otherUser && (s.otherUser.id || s.otherUser.userId)) || s.otherUserId || ''
  if (!otherId) {
    // TIM C2C：从 conversationID 截取 userID
    const cid = s.convID || s.sessionId || ''
    const match = /^C2C(.+)$/.exec(cid)
    if (match) {
      uni.navigateTo({ url: `/pages/chat/chat?userId=${encodeURIComponent(match[1])}&name=${encodeURIComponent(s.name || '')}&avatar=${encodeURIComponent(s.avatar || '')}` })
    }
    return
  }
  uni.navigateTo({
    url: `/pages/chat/chat?userId=${encodeURIComponent(otherId)}&name=${encodeURIComponent(s.name || '')}&avatar=${encodeURIComponent(s.avatar || '')}`
  })
}

const onLongPress = (s, idx) => {
  uni.showActionSheet({
    itemList: ['标记为已读', '删除会话', '置顶会话'],
    success: async (r) => {
      try {
        if (r.tapIndex === 0) {
          if (s.source === 'TIM' && s.convID) await tim.setMessageRead(s.convID)
          loadData()
        } else if (r.tapIndex === 1) {
          const ok = await new Promise(resolve => {
            uni.showModal({
              title: '删除会话',
              content: '确定删除该会话吗？删除后无法恢复。',
              success: (m) => resolve(!!m.confirm)
            })
          })
          if (!ok) return
          if (s.source === 'TIM' && s.convID) await tim.deleteConversation(s.convID)
          list.value.splice(idx, 1)
        } else if (r.tapIndex === 2) {
          if (s.source === 'TIM' && s.convID && tim.tim) {
            try {
              await tim.tim.pinConversation({ conversationID: s.convID, isPinned: !s.pinned })
            } catch (_) {}
          }
          loadData()
        }
      } catch (_) {}
    }
  })
}

const onAddTap = () => {
  uni.showToast({ title: '发现页找人发起聊天', icon: 'none' })
}
const onSearch = () => {
  uni.showToast({ title: '搜索功能即将上线', icon: 'none' })
}

onShow(() => {
  // 事件订阅：会话更新
  loadData()
  offs.push(tim.on('CONVERSATION_UPDATED', () => loadData()))
  offs.push(tim.on('MESSAGE', () => loadData()))
  offs.push(tim.on('READY', () => loadData()))
})
onBeforeUnmount(() => {
  while (offs.length) { const fn = offs.pop(); if (typeof fn === 'function') fn() }
})
</script>

<style lang="scss" scoped>
.chat-list-page {
  background: #ededed;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ========== 顶部微信绿导航 ========== */
.wechat-nav {
  position: sticky; top: 0; z-index: 10;
  padding-top: calc(env(safe-area-inset-top) + 24rpx);
  padding-bottom: 24rpx;
  background: #ededed;
  display: flex; align-items: center; justify-content: space-between;
  padding-left: 32rpx; padding-right: 32rpx;
  border-bottom: 2rpx solid #dcdcdc;
}
.nav-title { font-size: 34rpx; font-weight: 600; color: #07c160; }
.nav-add-btn {
  width: 56rpx; height: 56rpx; border-radius: 12rpx;
  display: flex; align-items: center; justify-content: center;
}
.add-icon { font-size: 40rpx; color: #07c160; font-weight: 500; }

/* ========== 搜索条 ========== */
.search-bar {
  margin: 16rpx 24rpx;
  height: 68rpx;
  background: #ffffff;
  border-radius: 10rpx;
  display: flex; align-items: center; justify-content: center;
  gap: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.03);
}
.search-icon { font-size: 26rpx; opacity: .6; }
.search-placeholder { font-size: 26rpx; color: #888; }

/* ========== 通道提示条 ========== */
.channel-banner {
  margin: 0 24rpx 16rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  display: flex; align-items: center; gap: 12rpx;
  font-size: 24rpx;
}
.channel-banner.ok { background: #e6f7ec; color: #0a7f3c; }
.channel-banner.bad { background: #fff7e6; color: #ad6800; }
.banner-icon { font-size: 28rpx; }
.banner-text { flex: 1; line-height: 1.4; }

/* ========== 会话列表 ========== */
.list-scroll { flex: 1; background: #ffffff; }
.session-list { background: #ffffff; }
.session-row {
  display: flex; align-items: center; gap: 24rpx;
  padding: 24rpx 28rpx;
  border-bottom: 2rpx solid #ececec;
  background: #ffffff;
  position: relative;
}
.session-hover { background: #f5f5f5; }
.session-row.pinned { background: #faf8ed; }
.avatar-box { position: relative; flex-shrink: 0; }
.avatar {
  width: 96rpx; height: 96rpx; border-radius: 12rpx;
  background: #f0f0f0;
}
.badge {
  position: absolute; top: -10rpx; right: -10rpx;
  min-width: 36rpx; height: 36rpx; padding: 0 10rpx;
  background: #fa5151; color: #ffffff;
  font-size: 22rpx; font-weight: 600;
  border-radius: 9999rpx; border: 4rpx solid #ffffff;
  display: flex; align-items: center; justify-content: center;
  box-sizing: border-box;
}
.badge.dot { min-width: 20rpx; height: 20rpx; padding: 0; right: -4rpx; border-width: 3rpx; }

.session-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10rpx; }
.row-top { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.name-row { display: flex; align-items: center; gap: 10rpx; min-width: 0; }
.name {
  font-size: 32rpx; font-weight: 500; color: #111;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 360rpx;
}
.elite-tag {
  background: #ffd60a; color: #171717;
  font-size: 20rpx; font-weight: 600;
  padding: 2rpx 12rpx; border-radius: 9999rpx;
  flex-shrink: 0;
}
.pinned-tag {
  background: #07c160; color: #ffffff;
  font-size: 20rpx; font-weight: 600;
  padding: 2rpx 12rpx; border-radius: 9999rpx;
  flex-shrink: 0;
}
.time { font-size: 22rpx; color: #999; flex-shrink: 0; }
.row-bottom { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.last-msg {
  font-size: 26rpx; color: #888;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  flex: 1; min-width: 0;
}
.mute-icon { font-size: 28rpx; }

/* ========== 空状态 ========== */
.empty { padding: 220rpx 0 100rpx; display: flex; flex-direction: column; align-items: center; gap: 16rpx; }
.empty-icon { font-size: 120rpx; opacity: .45; }
.empty-title { font-size: 32rpx; color: #333; font-weight: 600; }
.empty-tip { font-size: 26rpx; color: #999; }

.loading-box { padding: 200rpx 0; text-align: center; color: #888; font-size: 26rpx; }
</style>
