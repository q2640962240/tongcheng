<template>
  <view class="page chat-page">
    <!-- 官方 TUIChat 组件（从 URL 参数 conversationID 自动初始化会话） -->
    <TUIChat />
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
// #ifdef H5 || APP-PLUS || APP
import TUIChat from '@/TUIKit/components/TUIChat/index.vue'
import { ensureTUILogin } from '@/utils/tuilogin'
import { TUIConversationService } from '@tencentcloud/chat-uikit-engine-lite'
// #endif

const conversationID = ref('')

onLoad(async (options) => {
  // 兼容多种参数名：conversationID（官方格式）/ userId / to / id / uid / providerId
  let cid = options?.conversationID || ''
  if (!cid) {
    const rawId = options?.userId || options?.to || options?.id || options?.uid || options?.providerId || ''
    if (rawId) cid = 'C2C' + String(rawId)
  }
  conversationID.value = cid

  // 确保 TUIKit 已登录
  const r = await ensureTUILogin()
  if (!r.ok) {
    uni.showToast({ title: '聊天未就绪', icon: 'none' })
    return
  }
  // 显式打开会话
  if (conversationID.value) {
    try {
      TUIConversationService.switchConversation(conversationID.value)
    } catch (e) {
      console.warn('[chat] switchConversation fail', e)
    }
  }
})
</script>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
</style>