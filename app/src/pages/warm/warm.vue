<template>
  <view class="page">
    <view class="header">
      <text class="back" @tap="onBack">‹</text>
      <text class="title">暖心服务</text>
      <view class="placeholder"></view>
    </view>

    <!-- 快捷分类入口 -->
    <scroll-view scroll-x class="cat-bar">
      <view class="cat-item" :class="{ on: subCategory === '' }" @tap="onSub('')">全部</view>
      <view v-for="s in subs" :key="s.key" class="cat-item" :class="{ on: subCategory === s.key }" @tap="onSub(s.key)">
        {{ s.name }}
      </view>
    </scroll-view>

    <!-- 服务列表 -->
    <view class="content" v-if="list.length">
      <view v-for="item in list" :key="item.id" class="service-block" @tap="onDetail(item)">
        <view class="block-icon" :style="{ background: iconBg(item.subCategory) }">
          <text :style="{ color: iconColor(item.subCategory) }">{{ iconChar(item.subCategory) }}</text>
        </view>
        <view class="block-info">
          <view class="block-top">
            <text class="block-name">{{ item.title }}</text>
            <view class="price-tag">
              <text class="price-num">{{ item.price }}</text>
              <text class="price-unit">{{ item.priceUnit || '次' }}</text>
            </view>
          </view>
          <text class="block-desc">{{ item.description }}</text>
          <view class="provider-row">
            <image class="provider-avatar" :src="item.provider?.avatar || '/static/avatar-user.png'" mode="aspectFill" />
            <text class="provider-name">{{ item.provider?.nickname || '-' }}</text>
            <text v-if="item.provider?.isElite" class="elite-badge">精英</text>
            <text class="stat">📦 {{ item.orderCount || 0 }} 单</text>
          </view>
        </view>
        <view class="block-cta" @tap.stop="onContact(item)">联系</view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!loading" class="empty">
      <text class="empty-icon">🛋️</text>
      <text class="empty-text">暂无相关服务</text>
      <text class="empty-tip">抢先发布，成为第一位服务者</text>
    </view>

    <!-- 发布按钮 -->
    <view class="footer-cta">
      <view class="footer-btn" @tap="onPublish">发布我的服务</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh, onLoad } from '@dcloudio/uni-app'
import { serviceApi } from '../../api'

const subs = [
  { key: 'virtual-lover', name: '虚拟恋人' },
  { key: 'sing', name: '唱歌' },
  { key: 'sleep', name: '哄睡' },
  { key: 'wake', name: '叫醒' }
]
const subCategory = ref('')
const list = ref([])
const loading = ref(false)

const iconChar = (s) => ({ 'virtual-lover': '❤', sing: '♪', sleep: '🌙', wake: '⏰' }[s] || '❤')
const iconColor = (s) => ({ 'virtual-lover': '#f472b6', sing: '#a855f7', sleep: '#0ea5e9', wake: '#b45309' }[s] || '#f472b6')
const iconBg = (s) => ({ 'virtual-lover': '#fce7f3', sing: '#f3e8ff', sleep: '#e0f2fe', wake: '#fff9c4' }[s] || '#fce7f3')

const loadData = async () => {
  loading.value = true
  try {
    const res = await serviceApi.list({ category: 'warm', subCategory: subCategory.value, page: 1, pageSize: 50 })
    list.value = res.data.list || []
  } catch (e) {} finally {
    loading.value = false
  }
}

const onSub = (key) => { subCategory.value = key; loadData() }
const onDetail = (item) => uni.navigateTo({ url: `/pages/service-detail/service-detail?id=${item.id}` })
const onContact = (item) => {
  if (!item.provider) return
  uni.navigateTo({ url: `/pages/chat/chat?userId=${item.provider.id}&name=${encodeURIComponent(item.provider.nickname)}` })
}
const onPublish = () => uni.navigateTo({ url: '/pages/service-publish/service-publish' })
const onBack = () => uni.navigateBack()

onLoad(loadData)
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
.cat-bar { white-space: nowrap; padding: 16rpx 24rpx; background: #ffffff; border-bottom: 2rpx solid #f5f5f5; }
.cat-item {
  display: inline-block; padding: 12rpx 28rpx; margin-right: 16rpx;
  background: #f5f5f5; border-radius: 9999rpx; font-size: 26rpx; color: #525252;
  &.on { background: #ffd60a; color: #171717; font-weight: 600; }
}
.content { padding: 32rpx; display: flex; flex-direction: column; gap: 24rpx; }
.service-block {
  display: flex; align-items: stretch; gap: 24rpx;
  background: #ffffff; border-radius: 32rpx; padding: 28rpx;
  box-shadow: 0 2rpx 4rpx rgba(23, 23, 23, 0.05);
  &:active { transform: scale(0.99); }
}
.block-icon {
  width: 96rpx; height: 96rpx; border-radius: 24rpx;
  display: flex; align-items: center; justify-content: center; font-size: 44rpx; flex-shrink: 0;
}
.block-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.block-top { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.block-name { font-size: 30rpx; font-weight: 600; color: #171717; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320rpx; }
.price-tag { display: flex; align-items: baseline; gap: 4rpx; flex-shrink: 0; }
.price-num { font-size: 32rpx; font-weight: 700; color: #ef4444; }
.price-unit { font-size: 22rpx; color: #737373; }
.block-desc { font-size: 24rpx; color: #737373; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.provider-row { display: flex; align-items: center; gap: 8rpx; margin-top: 4rpx; }
.provider-avatar { width: 32rpx; height: 32rpx; border-radius: 9999rpx; }
.provider-name { font-size: 22rpx; color: #525252; }
.elite-badge { background: #ffd60a; color: #171717; font-size: 18rpx; padding: 0 8rpx; border-radius: 9999rpx; }
.stat { font-size: 22rpx; color: #a3a3a3; margin-left: auto; }
.block-cta {
  align-self: center; background: #ffd60a; color: #171717;
  font-size: 24rpx; font-weight: 600; padding: 12rpx 24rpx; border-radius: 9999rpx; flex-shrink: 0;
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
