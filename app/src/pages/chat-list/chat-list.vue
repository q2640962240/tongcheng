<template>
  <view class="page">
    <view v-if="!loading && list.length === 0" class="empty">
      <text class="empty-icon">💬</text>
      <text class="empty-text">还没有消息</text>
      <text class="empty-tip">下单后可与陪玩师实时沟通</text>
    </view>

    <view class="session-list">
      <view v-for="s in list" :key="s.sessionId" class="session" @tap="onOpen(s)">
        <view class="avatar-wrap">
          <image class="avatar" :src="s.otherUser?.avatar || '/static/avatar-user.png'" mode="aspectFill" />
          <view v-if="s.unreadCount > 0" class="badge">{{ s.unreadCount }}</view>
        </view>
        <view class="session-main">
          <view class="session-top">
            <view class="name-row">
              <text class="name">{{ s.otherUser?.nickname || '未知用户' }}</text>
              <text v-if="s.otherUser?.isElite" class="elite-badge">精英</text>
            </view>
            <text class="time">{{ formatTime(s.lastMessageTime) }}</text>
          </view>
          <text class="last-msg">{{ s.lastMessageType === 'voice' ? '[语音]' : s.lastMessage }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { chatApi } from '../../api'
import { timeAgo } from '../../utils/format'

const loading = ref(false)
const list = ref([])

const formatTime = (ts) => {
  if (!ts) return ''
  return timeAgo(new Date(ts).getTime())
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await chatApi.sessions()
    list.value = res.data || []
  } catch (e) {} finally {
    loading.value = false
  }
}

const onOpen = (s) => {
  uni.navigateTo({ url: `/pages/chat/chat?userId=${s.otherUser?.id}` })
}

onShow(loadData)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 200rpx 0; gap: 16rpx; }
.empty-icon { font-size: 96rpx; }
.empty-text { font-size: 32rpx; color: #525252; font-weight: 600; }
.empty-tip { font-size: 26rpx; color: #a3a3a3; }
.session-list { background: #ffffff; }
.session {
  display: flex; align-items: center; gap: 24rpx; padding: 28rpx 32rpx;
  border-bottom: 2rpx solid #f5f5f5;
  &:active { background: #fafafa; }
}
.avatar-wrap { position: relative; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 9999rpx; background: #f5f5f5; }
.badge {
  position: absolute; top: -8rpx; right: -8rpx; min-width: 36rpx; height: 36rpx;
  background: #ef4444; color: #ffffff; font-size: 22rpx; font-weight: 600;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  padding: 0 8rpx; border: 4rpx solid #ffffff;
}
.session-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.session-top { display: flex; justify-content: space-between; align-items: center; }
.name-row { display: flex; align-items: center; gap: 8rpx; }
.name { font-size: 30rpx; font-weight: 600; color: #171717; }
.elite-badge { background: #ffd60a; color: #171717; font-size: 18rpx; font-weight: 600; padding: 2rpx 10rpx; border-radius: 9999rpx; }
.time { font-size: 22rpx; color: #a3a3a3; }
.last-msg { font-size: 26rpx; color: #737373; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
