<template>
  <view class="page">
    <view class="header">
      <text class="back" @tap="onBack">‹</text>
      <text class="title">游戏陪玩</text>
      <view class="placeholder"></view>
    </view>

    <!-- 游戏分类 -->
    <view class="games">
      <view
        v-for="g in games"
        :key="g.key"
        class="game-card"
        :class="{ active: subCategory === g.key }"
        @tap="onGame(g.key)"
      >
        <text class="game-emoji">{{ g.emoji }}</text>
        <text class="game-name">{{ g.name }}</text>
      </view>
    </view>

    <!-- 陪玩师列表 -->
    <view class="players">
      <text class="section-title">推荐陪玩师</text>
      <view v-for="item in list" :key="item.id" class="player-card" @tap="onDetail(item)">
        <image class="avatar" :src="item.provider?.avatar || '/static/avatar-user.png'" mode="aspectFill" />
        <view class="info">
          <view class="top">
            <view class="name-row">
              <text class="name">{{ item.provider?.nickname || '-' }}</text>
              <text v-if="item.provider?.isElite" class="elite-badge">精英</text>
            </view>
            <view class="rate">
              <text class="star">★</text>
              <text class="rate-num">{{ item.ratingAvg || 5.0 }}</text>
            </view>
          </view>
          <text class="title-text">{{ item.title }}</text>
          <view class="tags" v-if="item.tags && item.tags.length">
            <text v-for="(t, i) in item.tags" :key="i" class="tag tag-blue">{{ t }}</text>
          </view>
          <view class="bottom">
            <view class="price">
              <text class="amount">{{ item.price }}</text>
              <text class="unit">星币 / {{ item.priceUnit || '局' }}</text>
            </view>
            <text class="stat">📦 {{ item.orderCount || 0 }} 单</text>
          </view>
        </view>
        <view class="cta" @tap.stop="onContact(item)">联系</view>
      </view>
      <view v-if="!loading && list.length === 0" class="empty">
        <text class="empty-icon">🎮</text>
        <text class="empty-text">暂无陪玩师</text>
        <text class="empty-tip">抢先入驻，成为第一位</text>
      </view>
    </view>

    <view class="footer-cta">
      <view class="footer-btn" @tap="onPublish">发布陪玩服务</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { serviceApi } from '../../api'

const games = [
  { key: '', name: '全部', emoji: '🎮' },
  { key: 'wzry', name: '王者', emoji: '👑' },
  { key: 'hpjy', name: '和平', emoji: '🔫' },
  { key: 'lol', name: 'LOL', emoji: '⚔️' },
  { key: 'other', name: '其他', emoji: '🎲' }
]
const subCategory = ref('')
const list = ref([])
const loading = ref(false)

const loadData = async () => {
  loading.value = true
  try {
    const res = await serviceApi.list({ category: 'game', subCategory: subCategory.value, page: 1, pageSize: 50 })
    list.value = res.data.list || []
  } catch (e) {} finally {
    loading.value = false
  }
}

const onGame = (key) => { subCategory.value = key; loadData() }
const onDetail = (item) => uni.navigateTo({ url: `/pages/service-detail/service-detail?id=${item.id}` })
const onContact = (item) => {
  if (!item.provider) return
  uni.navigateTo({ url: `/pages/chat/chat?userId=${item.provider.id}&name=${encodeURIComponent(item.provider.nickname)}` })
}
const onPublish = () => uni.navigateTo({ url: '/pages/service-publish/service-publish' })
const onBack = () => uni.navigateBack()

onShow(loadData)
onPullDownRefresh(async () => { await loadData(); uni.stopPullDownRefresh() })
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; padding-bottom: 200rpx; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24rpx; height: 88rpx; background: #ffffff;
  border-bottom: 2rpx solid #f5f5f5; position: sticky; top: 0; z-index: 10;
  padding-top: env(safe-area-inset-top);
}
.back { font-size: 56rpx; color: #171717; line-height: 1; }
.title { font-size: 34rpx; font-weight: 600; }
.placeholder { width: 56rpx; }
.games {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12rpx; padding: 24rpx 24rpx;
}
.game-card {
  background: #ffffff; border-radius: 24rpx; padding: 24rpx 0;
  display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  border: 4rpx solid transparent;
  &.active { border-color: #ffd60a; background: #fff9c4; }
  &:active { transform: scale(0.97); }
}
.game-emoji { font-size: 48rpx; }
.game-name { font-size: 22rpx; font-weight: 500; color: #171717; }
.players { padding: 16rpx 32rpx 48rpx; }
.section-title { display: block; font-size: 32rpx; font-weight: 600; margin-bottom: 24rpx; color: #171717; }
.player-card {
  display: flex; align-items: center; gap: 24rpx; background: #ffffff;
  border-radius: 32rpx; padding: 24rpx; margin-bottom: 24rpx;
  box-shadow: 0 2rpx 4rpx rgba(23,23,23,0.05);
  &:active { transform: scale(0.99); }
}
.avatar { width: 128rpx; height: 128rpx; border-radius: 32rpx; background: #f5f5f5; flex-shrink: 0; }
.info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.top { display: flex; align-items: center; justify-content: space-between; }
.name-row { display: flex; align-items: center; gap: 8rpx; }
.name { font-size: 30rpx; font-weight: 600; color: #171717; }
.elite-badge { background: #ffd60a; color: #171717; font-size: 18rpx; font-weight: 600; padding: 2rpx 10rpx; border-radius: 9999rpx; }
.rate { display: flex; align-items: center; gap: 4rpx; }
.star { color: #ffd60a; font-size: 24rpx; }
.rate-num { font-size: 24rpx; font-weight: 600; color: #525252; }
.title-text { font-size: 26rpx; color: #525252; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tags { display: flex; gap: 8rpx; flex-wrap: wrap; }
.tag {
  padding: 2rpx 16rpx; border-radius: 9999rpx; font-size: 20rpx; font-weight: 500;
}
.tag-blue { background: #e0f2fe; color: #0ea5e9; }
.bottom { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.price { display: flex; align-items: baseline; gap: 4rpx; }
.amount { font-size: 32rpx; font-weight: 700; color: #ef4444; }
.unit { font-size: 22rpx; color: #737373; }
.stat { font-size: 22rpx; color: #a3a3a3; }
.cta {
  flex-shrink: 0; background: #ffd60a; color: #171717; font-size: 26rpx;
  font-weight: 600; padding: 16rpx 28rpx; border-radius: 9999rpx;
}
.empty { display: flex; flex-direction: column; align-items: center; padding: 120rpx 0; gap: 16rpx; }
.empty-icon { font-size: 96rpx; }
.empty-text { font-size: 28rpx; color: #525252; }
.empty-tip { font-size: 24rpx; color: #a3a3a3; }
.footer-cta {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20rpx);
  border-top: 2rpx solid #e5e5e5;
}
.footer-btn {
  height: 96rpx; background: #ffd60a; color: #171717;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700;
  &:active { opacity: 0.85; }
}
</style>
