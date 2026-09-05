<template>
  <view class="page">
    <view class="header">
      <text class="title">礼物排行榜</text>
    </view>

    <!-- Tab 切换：魅力榜 / 豪礼榜 -->
    <view class="tab-bar">
      <view class="tab-item" :class="{ active: side === 'received' }" @tap="side = 'received'">
        <text class="tab-text">魅力榜</text>
      </view>
      <view class="tab-item" :class="{ active: side === 'sent' }" @tap="side = 'sent'">
        <text class="tab-text">豪礼榜</text>
      </view>
    </view>

    <!-- 时段切换 -->
    <view class="period-bar">
      <view class="period-item" :class="{ active: period === 'day' }" @tap="period = 'day'">
        <text class="period-text">今日</text>
      </view>
      <view class="period-item" :class="{ active: period === 'week' }" @tap="period = 'week'">
        <text class="period-text">本周</text>
      </view>
      <view class="period-item" :class="{ active: period === 'all' }" @tap="period = 'all'">
        <text class="period-text">总榜</text>
      </view>
    </view>

    <!-- 前三名领奖台 -->
    <view class="podium" v-if="rankList.length >= 3">
      <view class="podium-item second" @tap="goProfile(rankList[1])">
        <image class="podium-avatar silver" :src="avatarOf(rankList[1])" mode="aspectFill" />
        <text class="podium-name">{{ nameOf(rankList[1]) }}</text>
        <text class="podium-value">{{ rankList[1].totalDiamond }}💎</text>
        <view class="podium-base silver-base">
          <text class="podium-rank">2</text>
        </view>
      </view>
      <view class="podium-item first" @tap="goProfile(rankList[0])">
        <view class="crown">👑</view>
        <image class="podium-avatar gold" :src="avatarOf(rankList[0])" mode="aspectFill" />
        <text class="podium-name">{{ nameOf(rankList[0]) }}</text>
        <text class="podium-value">{{ rankList[0].totalDiamond }}💎</text>
        <view class="podium-base gold-base">
          <text class="podium-rank">1</text>
        </view>
      </view>
      <view class="podium-item third" @tap="goProfile(rankList[2])">
        <image class="podium-avatar bronze" :src="avatarOf(rankList[2])" mode="aspectFill" />
        <text class="podium-name">{{ nameOf(rankList[2]) }}</text>
        <text class="podium-value">{{ rankList[2].totalDiamond }}💎</text>
        <view class="podium-base bronze-base">
          <text class="podium-rank">3</text>
        </view>
      </view>
    </view>

    <!-- 排名列表 -->
    <view class="rank-list">
      <view
        v-for="item in rankList.slice(3)"
        :key="item.rank"
        class="rank-item"
        @tap="goProfile(item)"
      >
        <text class="rank-num">{{ item.rank }}</text>
        <image class="rank-avatar" :src="avatarOf(item)" mode="aspectFill" />
        <view class="rank-info">
          <text class="rank-name">{{ nameOf(item) }}</text>
          <text class="rank-count">{{ item.totalCount }}次</text>
        </view>
        <text class="rank-diamond">{{ item.totalDiamond }}💎</text>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty" v-if="!loading && rankList.length === 0">
      <text class="empty-icon">🏆</text>
      <text class="empty-text">暂无排行数据</text>
    </view>

    <!-- 加载中 -->
    <view class="loading" v-if="loading">
      <text class="loading-text">加载中...</text>
    </view>

    <view class="bottom-safe"></view>
  </view>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { giftApi } from '../../api'
import { avatarUrl } from '../../utils/fallback'

const side = ref('received')
const period = ref('all')
const rankList = ref([])
const loading = ref(false)

async function loadRank() {
  loading.value = true
  try {
    const res = await giftApi.rank({ side: side.value, period: period.value, limit: 50 })
    rankList.value = res.data || []
  } catch (e) {
    console.warn('[gift-rank] load fail', e)
    rankList.value = []
  } finally {
    loading.value = false
  }
}

function avatarOf(item) {
  const raw = item?.user?.avatar || ''
  return avatarUrl(raw)
}

function nameOf(item) {
  return item?.user?.nickname || '未知用户'
}

function goProfile(item) {
  if (!item?.user?.id) return
  uni.navigateTo({
    url: `/pages/user-profile/user-profile?userId=${item.user.id}`
  })
}

watch([side, period], () => {
  loadRank()
})

onMounted(() => {
  loadRank()
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: $by-bg; }

.header {
  display: flex; align-items: center; justify-content: center;
  padding: env(safe-area-inset-top) $by-page-pad-x 0;
  height: calc($by-topbar-h + env(safe-area-inset-top));
  position: sticky; top: 0;
  background: $by-bg;
  border-bottom: 1rpx solid $by-border; z-index: 10;
}
.title { font-size: 36rpx; font-weight: 700; color: $by-text-1; }

/* Tab 栏 */
.tab-bar {
  display: flex; padding: 24rpx $by-page-pad-x 0; gap: 16rpx;
}
.tab-item {
  flex: 1; height: 80rpx;
  display: flex; align-items: center; justify-content: center;
  background: $by-surface;
  border-radius: $by-radius-lg;
  border: 1rpx solid $by-border;
  transition: all 0.2s ease;
  &.active {
    background: $by-gradient-gold;
    border-color: transparent;
  }
}
.tab-text {
  font-size: 28rpx; font-weight: 600; color: $by-text-2;
  .tab-item.active & { color: #0B0F1A; }
}

/* 时段切换 */
.period-bar {
  display: flex; padding: 20rpx $by-page-pad-x; gap: 12rpx;
}
.period-item {
  flex: 1; height: 64rpx;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
  border-radius: $by-radius-pill;
  border: 1rpx solid $by-border;
  transition: all 0.2s ease;
  &.active {
    background: color.adjust($by-gold, $alpha: 0.15);
    border-color: color.adjust($by-gold, $alpha: 0.4);
  }
}
.period-text {
  font-size: 24rpx; color: $by-text-3;
  .period-item.active & { color: $by-gold-soft; font-weight: 600; }
}

/* 领奖台 */
.podium {
  display: flex; align-items: flex-end; justify-content: center;
  padding: 40rpx $by-page-pad-x 32rpx;
  gap: 16rpx;
}
.podium-item {
  display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  &.first { order: 2; margin-bottom: 20rpx; }
  &.second { order: 1; }
  &.third { order: 3; }
}
.podium-avatar {
  width: 120rpx; height: 120rpx; border-radius: 50%;
  border: 4rpx solid $by-border;
  &.gold { border-color: $by-gold; width: 140rpx; height: 140rpx; }
  &.silver { border-color: #C0C0C0; }
  &.bronze { border-color: #CD7F32; }
}
.crown {
  font-size: 48rpx; margin-bottom: -16rpx;
}
.podium-name {
  font-size: 24rpx; color: $by-text-1; font-weight: 500;
  max-width: 160rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  text-align: center;
}
.podium-value {
  font-size: 22rpx; color: $by-gold; font-weight: 600;
}
.podium-base {
  width: 140rpx; height: 80rpx;
  display: flex; align-items: center; justify-content: center;
  border-radius: $by-radius-md $by-radius-md 0 0;
  &.gold-base { background: linear-gradient(180deg, $by-gold 0%, $by-gold-deep 100%); height: 100rpx; }
  &.silver-base { background: linear-gradient(180deg, #C0C0C0 0%, #808080 100%); height: 70rpx; }
  &.bronze-base { background: linear-gradient(180deg, #CD7F32 0%, #8B4513 100%); height: 56rpx; }
}
.podium-rank {
  font-size: 32rpx; font-weight: 700; color: #0B0F1A;
}

/* 排名列表 */
.rank-list {
  padding: 0 $by-page-pad-x;
}
.rank-item {
  display: flex; align-items: center; gap: 20rpx;
  padding: 24rpx;
  background: $by-surface;
  border-radius: $by-radius-lg;
  margin-bottom: 16rpx;
  border: 1rpx solid $by-border;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.98); }
}
.rank-num {
  width: 48rpx; font-size: 28rpx; font-weight: 700;
  color: $by-text-3; text-align: center;
}
.rank-avatar {
  width: 88rpx; height: 88rpx; border-radius: 50%;
  border: 2rpx solid $by-border;
}
.rank-info {
  flex: 1; display: flex; flex-direction: column; gap: 4rpx;
}
.rank-name {
  font-size: 28rpx; color: $by-text-1; font-weight: 500;
}
.rank-count {
  font-size: 22rpx; color: $by-text-3;
}
.rank-diamond {
  font-size: 26rpx; color: $by-gold; font-weight: 600;
}

/* 空状态 */
.empty {
  display: flex; flex-direction: column; align-items: center;
  padding: 120rpx 0;
}
.empty-icon { font-size: 80rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 28rpx; color: $by-text-3; }

/* 加载中 */
.loading {
  display: flex; justify-content: center; padding: 80rpx 0;
}
.loading-text { font-size: 26rpx; color: $by-text-3; }

.bottom-safe { height: calc(#{$by-safe-bottom} + 40rpx); }
</style>
