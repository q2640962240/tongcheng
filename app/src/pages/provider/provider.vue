<template>
  <view class="page" v-if="provider">
    <!-- 顶部封面 -->
    <view class="hero">
      <view class="back-btn" @tap="onBack">‹</view>
      <image class="hero-bg" :src="avatarFull || '/static/avatar-user.png'" mode="aspectFill" />
      <view class="hero-mask"></view>
      <view class="hero-info">
        <image class="hero-avatar" :src="avatarFull || '/static/avatar-user.png'" mode="aspectFill" />
        <view class="hero-meta">
          <view class="name-row">
            <text class="name">{{ provider.nickname }}</text>
            <text v-if="provider.isElite" class="elite-badge">👑 精英</text>
            <text v-if="provider.realPersonStatus === 'passed'" class="verify-badge">✓ 实名</text>
          </view>
          <view class="sub-row">
            <text class="sub-item">{{ genderText }}</text>
            <text v-if="provider.city" class="sub-item">{{ provider.city }}</text>
            <text class="sub-item">{{ provider.bio || '这个人很懒，还没写简介' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 数据统计 -->
    <view class="stats-card">
      <view class="stat">
        <text class="stat-num">{{ provider.stats.orderCount || 0 }}</text>
        <text class="stat-label">已完成订单</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat">
        <text class="stat-num">{{ provider.stats.avgRating || 5.0 }}</text>
        <text class="stat-label">综合评分</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat">
        <text class="stat-num">{{ provider.stats.totalReviews || 0 }}</text>
        <text class="stat-label">评价数</text>
      </view>
    </view>

    <!-- 在线服务列表 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">TA的服务</text>
        <text class="section-count">{{ services.length }} 项</text>
      </view>

      <view v-if="services.length" class="service-list">
        <view v-for="s in services" :key="s.id" class="service-item" @tap="onService(s)">
          <image class="cover" :src="coverFull(s.coverImage)" mode="aspectFill" />
          <view class="service-info">
            <view class="service-top">
              <text class="service-title">{{ s.title }}</text>
              <text class="cat-tag">{{ categoryText(s.category) }}</text>
            </view>
            <text class="service-desc">{{ s.description || '暂无介绍' }}</text>
            <view class="service-bottom">
              <view class="price">
                <text class="amount">{{ s.price }}</text>
                <text class="unit">{{ s.priceUnit || '次' }}</text>
              </view>
              <view class="service-stats">
                <text class="ss-item">👁 {{ s.viewCount || 0 }}</text>
                <text class="ss-item">📦 {{ s.orderCount || 0 }}</text>
                <text class="ss-item">⭐ {{ s.ratingAvg || 5.0 }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view v-else class="empty">
        <text class="empty-text">TA还没有上架服务</text>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar">
      <view class="bottom-action" @tap="onChat">
        <text class="ba-icon">💬</text>
        <text class="ba-text">私信</text>
      </view>
      <view class="bottom-action" @tap="onFavorite">
        <text class="ba-icon">{{ isFavorited ? '★' : '☆' }}</text>
        <text class="ba-text">{{ isFavorited ? '已收藏' : '收藏' }}</text>
      </view>
      <view class="bottom-primary" @tap="onOrderDirect">
        立即下单
      </view>
    </view>
  </view>

  <view v-else class="loading" :class="{ failed }">
    <text v-if="!failed" class="loading-text">加载中...</text>
    <view v-else>
      <text class="loading-text">加载失败</text>
      <view class="retry-btn" @tap="loadData">重试</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { userApi, orderApi } from '../../api'

const provider = ref(null)
const services = ref([])
const failed = ref(false)
const isFavorited = ref(false)
const providerId = ref(null)

const BASE_URL = (() => {
  // #ifdef H5
  return '/api'
  // #endif
  // #ifndef H5
  return 'http://localhost:3000'
  // #endif
})()

const fullUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return BASE_URL + url
}

const avatarFull = computed(() => fullUrl(provider.value?.avatar))
const coverFull = (url) => fullUrl(url)

const genderText = computed(() => {
  const g = provider.value?.gender
  if (g === 1) return '♂ 男'
  if (g === 2) return '♀ 女'
  return '保密'
})

const categoryText = (c) => ({ warm: '暖心', game: '游戏', offline: '约玩' }[c] || c || '其他')

const loadData = async () => {
  if (!providerId.value) return
  failed.value = false
  try {
    const res = await userApi.provider(providerId.value)
    provider.value = res.data
    services.value = res.data.services || []
    // 检查收藏状态
    const favKey = `fav_provider_${providerId.value}`
    isFavorited.value = uni.getStorageSync(favKey) === true
  } catch (e) {
    failed.value = true
  }
}

const onBack = () => uni.navigateBack()

const onService = (s) => {
  uni.navigateTo({ url: `/pages/service-detail/service-detail?id=${s.id}` })
}

const onChat = () => {
  if (!provider.value) return
  uni.navigateTo({
    url: `/pages/chat/chat?userId=${provider.value.id}&name=${encodeURIComponent(provider.value.nickname)}`
  })
}

const onFavorite = () => {
  if (!provider.value) return
  const favKey = `fav_provider_${provider.value.id}`
  isFavorited.value = !isFavorited.value
  uni.setStorageSync(favKey, isFavorited.value)
  uni.showToast({
    title: isFavorited.value ? '已收藏' : '已取消收藏',
    icon: 'none'
  })
}

const onOrderDirect = () => {
  if (!provider.value) return
  if (!services.value.length) {
    uni.showToast({ title: 'TA还没有上架服务', icon: 'none' })
    return
  }
  // 跳到第一个服务详情
  onService(services.value[0])
}

onLoad((q) => {
  if (q.id) {
    providerId.value = Number(q.id)
    loadData()
  }
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; padding-bottom: 200rpx; }
.hero {
  position: relative; width: 100%; height: 480rpx;
  overflow: hidden;
}
.hero-bg {
  position: absolute; inset: 0; width: 100%; height: 100%;
  filter: blur(20rpx); transform: scale(1.2);
}
.hero-mask {
  position: absolute; inset: 0; background: linear-gradient(
    to bottom,
    rgba(0,0,0,0.3) 0%,
    rgba(0,0,0,0.5) 100%
  );
}
.back-btn {
  position: absolute; top: calc(env(safe-area-inset-top) + 24rpx); left: 24rpx;
  width: 72rpx; height: 72rpx; border-radius: 9999rpx; background: rgba(0,0,0,0.4);
  color: #ffffff; font-size: 48rpx; display: flex; align-items: center; justify-content: center;
  z-index: 2;
}
.hero-info {
  position: absolute; left: 32rpx; right: 32rpx; bottom: 48rpx;
  display: flex; align-items: flex-end; gap: 24rpx;
}
.hero-avatar {
  width: 160rpx; height: 160rpx; border-radius: 32rpx; background: #f5f5f5;
  border: 4rpx solid rgba(255,255,255,0.8);
  flex-shrink: 0;
}
.hero-meta { flex: 1; min-width: 0; padding-bottom: 8rpx; }
.name-row { display: flex; align-items: center; gap: 12rpx; margin-bottom: 12rpx; flex-wrap: wrap; }
.name { font-size: 40rpx; font-weight: 700; color: #ffffff; }
.elite-badge {
  background: #ffd60a; color: #171717; font-size: 22rpx; font-weight: 600;
  padding: 4rpx 16rpx; border-radius: 9999rpx;
}
.verify-badge {
  background: rgba(16,185,129,0.9); color: #ffffff; font-size: 22rpx;
  padding: 4rpx 16rpx; border-radius: 9999rpx;
}
.sub-row { display: flex; align-items: center; gap: 16rpx; flex-wrap: wrap; }
.sub-item { font-size: 26rpx; color: rgba(255,255,255,0.85); }
.stats-card {
  display: flex; align-items: center; background: #ffffff; margin: -32rpx 24rpx 24rpx;
  padding: 32rpx 0; border-radius: 24rpx; box-shadow: 0 4rpx 12rpx rgba(23,23,23,0.08);
  position: relative; z-index: 2;
}
.stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.stat-num { font-size: 40rpx; font-weight: 700; color: #171717; }
.stat-label { font-size: 22rpx; color: #737373; }
.stat-divider { width: 2rpx; height: 64rpx; background: #f5f5f5; }
.section { padding: 0 24rpx; }
.section-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16rpx 8rpx; margin-bottom: 16rpx;
}
.section-title { font-size: 32rpx; font-weight: 600; color: #171717; }
.section-count { font-size: 24rpx; color: #737373; }
.service-list { display: flex; flex-direction: column; gap: 16rpx; }
.service-item {
  display: flex; gap: 20rpx; background: #ffffff; padding: 24rpx;
  border-radius: 24rpx;
  &:active { opacity: 0.85; }
}
.cover {
  width: 200rpx; height: 200rpx; border-radius: 16rpx; background: #f5f5f5;
  flex-shrink: 0;
}
.service-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.service-top { display: flex; align-items: center; gap: 8rpx; }
.service-title { font-size: 30rpx; font-weight: 600; color: #171717; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-tag {
  font-size: 20rpx; padding: 2rpx 12rpx; background: #fff9c4; color: #b45309;
  border-radius: 9999rpx; flex-shrink: 0;
}
.service-desc {
  font-size: 24rpx; color: #737373; line-height: 1.5;
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.service-bottom { display: flex; align-items: flex-end; justify-content: space-between; margin-top: auto; }
.price { display: flex; align-items: baseline; gap: 4rpx; }
.amount { font-size: 36rpx; font-weight: 700; color: #ef4444; }
.unit { font-size: 22rpx; color: #737373; }
.service-stats { display: flex; gap: 12rpx; }
.ss-item { font-size: 22rpx; color: #a3a3a3; }
.empty { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #a3a3a3; }
.bottom-bar {
  position: fixed; left: 0; right: 0; bottom: 0;
  padding: 16rpx 32rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: #ffffff; border-top: 2rpx solid #e5e5e5;
  display: flex; align-items: center; gap: 24rpx;
}
.bottom-action {
  display: flex; flex-direction: column; align-items: center; gap: 4rpx;
  padding: 0 16rpx;
  &:active { opacity: 0.7; }
}
.ba-icon { font-size: 40rpx; color: #737373; }
.ba-text { font-size: 22rpx; color: #737373; }
.bottom-primary {
  flex: 1; height: 88rpx; background: #ffd60a; color: #171717;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 30rpx; font-weight: 700;
  &:active { opacity: 0.85; }
}
.loading { padding: 200rpx 0; text-align: center; }
.loading-text { font-size: 26rpx; color: #737373; }
.retry-btn {
  display: inline-block; margin-top: 16rpx; padding: 12rpx 48rpx;
  background: #ffd60a; color: #171717; border-radius: 9999rpx; font-size: 26rpx;
}
</style>
