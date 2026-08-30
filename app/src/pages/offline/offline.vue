<template>
  <view class="page">
    <view class="header">
      <text class="back" @tap="onBack">‹</text>
      <text class="title">兴趣约玩</text>
      <view class="placeholder"></view>
    </view>

    <view class="banner">
      <text class="banner-title">同城线下约玩</text>
      <text class="banner-desc">运动 · 约会 · 开黑 · 聚餐，认识志同道合的朋友</text>
    </view>

    <!-- 子分类 -->
    <scroll-view scroll-x class="cat-bar">
      <view class="cat-item" :class="{ on: subCategory === '' }" @tap="onSub('')">全部</view>
      <view v-for="c in subCats" :key="c.key" class="cat-item" :class="{ on: subCategory === c.key }" @tap="onSub(c.key)">
        {{ c.name }}
      </view>
    </scroll-view>

    <!-- 服务列表 -->
    <view class="list" v-if="list.length">
      <view v-for="item in list" :key="item.id" class="item" @tap="onDetail(item)">
        <view class="item-icon" :style="{ background: iconBg(item.subCategory) }">
          <text :style="{ color: iconColor(item.subCategory) }">{{ iconChar(item.subCategory) }}</text>
        </view>
        <view class="item-info">
          <text class="item-title">{{ item.title }}</text>
          <text class="item-desc">{{ item.description }}</text>
          <view class="item-bottom">
            <view class="provider">
              <text class="provider-name">{{ item.provider?.nickname || '-' }}</text>
              <text v-if="item.provider?.isElite" class="elite-badge">精英</text>
            </view>
            <view class="price">
              <text class="amount">{{ item.price }}</text>
              <text class="unit">星币</text>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view v-else-if="!loading" class="empty">
      <text class="empty-icon">🛋️</text>
      <text class="empty-text">暂无约玩服务</text>
      <text class="empty-tip">抢先发布，约到志同道合的朋友</text>
    </view>

    <view class="notice">
      <text class="notice-icon">🔒</text>
      <text class="notice-text">线下约玩需完成精英认证，保障双方安全</text>
    </view>

    <view class="footer-cta">
      <view class="footer-btn" @tap="onPublish">发布约玩活动</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { serviceApi } from '../../api'
import { requireElite } from '../../utils/fallback'
const subCats = [
  { key: 'sport', name: '运动健身' },
  { key: 'date', name: '同城约会' },
  { key: 'offline-game', name: '线下开黑' }
]
const subCategory = ref('')
const list = ref([])
const loading = ref(false)

const iconChar = (s) => ({ sport: '🏃', date: '☕', 'offline-game': '🎮' }[s] || '🎉')
const iconColor = (s) => ({ sport: '#f472b6', date: '#a855f7', 'offline-game': '#0ea5e9' }[s] || '#f472b6')
const iconBg = (s) => ({ sport: '#fce7f3', date: '#f3e8ff', 'offline-game': '#e0f2fe' }[s] || '#fce7f3')

const loadData = async () => {
  loading.value = true
  try {
    const res = await serviceApi.list({ category: 'offline', subCategory: subCategory.value, page: 1, pageSize: 50 })
    list.value = res.data.list || []
  } catch (e) {} finally {
    loading.value = false
  }
}

const onSub = (key) => { subCategory.value = key; loadData() }
const onDetail = (item) => {
  if (!requireElite()) return
  uni.navigateTo({ url: `/pages/service-detail/service-detail?id=${item.id}` })
}
const onPublish = () => {
  if (!requireElite()) return
  uni.navigateTo({ url: '/pages/service-publish/service-publish' })
}
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
.banner {
  margin: 32rpx; padding: 40rpx 32rpx; border-radius: 32rpx;
  background: linear-gradient(135deg, #ffd60a 0%, #ffcc00 100%);
  display: flex; flex-direction: column; gap: 12rpx;
}
.banner-title { font-size: 40rpx; font-weight: 700; color: #171717; }
.banner-desc { font-size: 26rpx; color: rgba(23,23,23,0.7); }
.cat-bar { white-space: nowrap; padding: 16rpx 24rpx; }
.cat-item {
  display: inline-block; padding: 12rpx 28rpx; margin-right: 16rpx;
  background: #ffffff; border-radius: 9999rpx; font-size: 26rpx; color: #525252;
  &.on { background: #ffd60a; color: #171717; font-weight: 600; }
}
.list { padding: 16rpx 32rpx; display: flex; flex-direction: column; gap: 24rpx; }
.item {
  display: flex; gap: 24rpx; background: #ffffff; border-radius: 32rpx; padding: 28rpx;
  box-shadow: 0 2rpx 4rpx rgba(23,23,23,0.05);
  &:active { transform: scale(0.99); }
}
.item-icon {
  width: 96rpx; height: 96rpx; border-radius: 24rpx;
  display: flex; align-items: center; justify-content: center; font-size: 44rpx; flex-shrink: 0;
}
.item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.item-title { font-size: 30rpx; font-weight: 600; color: #171717; }
.item-desc { font-size: 24rpx; color: #737373; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 4rpx; }
.provider { display: flex; align-items: center; gap: 8rpx; }
.provider-name { font-size: 22rpx; color: #525252; }
.elite-badge { background: #ffd60a; color: #171717; font-size: 18rpx; padding: 0 8rpx; border-radius: 9999rpx; }
.price { display: flex; align-items: baseline; gap: 4rpx; }
.amount { font-size: 28rpx; font-weight: 700; color: #ef4444; }
.unit { font-size: 22rpx; color: #737373; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 80rpx 0; gap: 16rpx; }
.empty-icon { font-size: 96rpx; }
.empty-text { font-size: 28rpx; color: #525252; }
.empty-tip { font-size: 24rpx; color: #a3a3a3; }
.notice {
  margin: 32rpx; padding: 24rpx; background: #fff9c4; border-radius: 16rpx;
  display: flex; align-items: center; gap: 12rpx;
}
.notice-icon { font-size: 32rpx; }
.notice-text { font-size: 26rpx; color: #b45309; }
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
