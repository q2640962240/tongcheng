<template>
  <view class="page chat-list-page">
    <!-- 状态提示条 -->
    <view v-if="!tuiReady" class="channel-banner bad">
      <text class="banner-icon">⚠️</text>
      <view class="banner-text-wrap">
        <text class="banner-text">TUIKit 未就绪：{{ tuiReason || '请先登录' }}</text>
      </view>
    </view>

    <!-- 官方会话列表组件 -->
    <view class="tui-wrap">
      <TUIConversation
        @handleSwitchConversation="onSwitchConversation"
      />
    </view>
  </view>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { onShow } from '@dcloudio/uni-app'
// #ifdef H5 || APP-PLUS || APP
import TUIConversation from '@/TUIKit/components/TUIConversation/index.vue'
import { ensureTUILogin, logoutTUILogin } from '@/utils/tuilogin'
// #endif

const tuiReady = ref(true)
const tuiReason = ref('')

let offs = []

/** 用户点击官方会话列表中的某个会话 → 跳转到 chat 页 */
const onSwitchConversation = (conversationID) => {
  if (!conversationID) return
  // conversationID 格式: C2C123 或 GROUP456
  uni.navigateTo({
    url: '/pages/chat/chat?conversationID=' + encodeURIComponent(conversationID)
  })
}

onShow(async () => {
  // #ifdef H5 || APP-PLUS || APP
  const r = await ensureTUILogin()
  tuiReady.value = !!r.ok
  tuiReason.value = r.reason || ''
  // #endif
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

/* ========== 通道提示条 ========== */
.channel-banner {
  margin: 24rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  display: flex; align-items: center; gap: 12rpx;
  font-size: 24rpx;
}
.channel-banner.bad { background: #fff7e6; color: #ad6800; }
.banner-icon { font-size: 28rpx; }
.banner-text { flex: 1; line-height: 1.4; }
.banner-text-wrap { flex: 1; display: flex; flex-direction: column; gap: 6rpx; }

/* ========== TUIKit 容器 ========== */
.tui-wrap {
  flex: 1;
  // TUIConversation 自带完整 UI（导航栏+搜索+会话列表），占满页面
}
</style>