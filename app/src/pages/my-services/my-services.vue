<template>
  <view class="page">
    <!-- 状态筛选 -->
    <view class="tabs">
      <view class="tab" :class="{ on: status === '' }" @tap="switchStatus('')">全部</view>
      <view class="tab" :class="{ on: status === 'online' }" @tap="switchStatus('online')">已上架</view>
      <view class="tab" :class="{ on: status === 'offline' }" @tap="switchStatus('offline')">已下架</view>
      <view class="tab" :class="{ on: status === 'pending' }" @tap="switchStatus('pending')">审核中</view>
    </view>

    <!-- 服务列表 -->
    <view class="list" v-if="list.length">
      <view v-for="item in list" :key="item.id" class="svc-card" @tap="onDetail(item)">
        <view class="svc-top">
          <text class="svc-title">{{ item.title }}</text>
          <text class="svc-status" :class="item.status">{{ statusMap[item.status] }}</text>
        </view>
        <text class="svc-desc">{{ item.description }}</text>
        <view class="svc-stats">
          <text class="stat">👁 {{ item.viewCount || 0 }}</text>
          <text class="stat">📦 {{ item.orderCount || 0 }} 单</text>
          <text class="stat">⭐ {{ item.ratingAvg || 5.0 }}</text>
          <view class="price">
            <text class="amount">{{ item.price }}</text>
            <text class="unit">星币 / {{ item.priceUnit || '次' }}</text>
          </view>
        </view>
        <view class="svc-actions" @tap.stop>
          <view
            v-if="item.status !== 'pending'"
            class="act-btn ghost"
            @tap="onToggle(item)"
          >{{ item.status === 'online' ? '下架' : '上架' }}</view>
          <view class="act-btn" @tap="onDetail(item)">查看</view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!loading" class="empty">
      <text class="empty-icon">📋</text>
      <text class="empty-text">还没有发布服务</text>
      <view class="empty-btn" @tap="onPublish">立即发布</view>
    </view>

    <!-- 发布按钮 -->
    <view class="footer-cta" v-if="list.length">
      <view class="footer-btn" @tap="onPublish">发布新服务</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { serviceApi } from '../../api'
import { requireElite } from '../../utils/fallback'

const list = ref([])
const loading = ref(false)
const status = ref('')

const statusMap = { online: '已上架', offline: '已下架', pending: '审核中', rejected: '已驳回' }

const loadData = async () => {
  loading.value = true
  try {
    const res = await serviceApi.myServices({ status: status.value, page: 1, pageSize: 50 })
    list.value = res.data.list || []
  } catch (e) {} finally {
    loading.value = false
  }
}

const switchStatus = (s) => { status.value = s; loadData() }

const onToggle = (item) => {
  const next = item.status === 'online' ? 'offline' : 'online'
  const tip = next === 'online' ? '上架' : '下架'
  uni.showModal({
    title: `确认${tip}`,
    content: `确定${tip}「${item.title}」？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await serviceApi.updateStatus(item.id, next)
          uni.showToast({ title: `已${tip}`, icon: 'success' })
          loadData()
        } catch (e) {}
      }
    }
  })
}

const onDetail = (item) => uni.navigateTo({ url: `/pages/service-detail/service-detail?id=${item.id}` })
const onPublish = () => {
  if (!requireElite()) return
  uni.navigateTo({ url: '/pages/service-publish/service-publish' })
}

onShow(() => {
  if (!requireElite()) return
  loadData()
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; padding-bottom: 200rpx; }
.tabs { display: flex; background: #ffffff; border-bottom: 2rpx solid #f5f5f5; }
.tab {
  flex: 1; text-align: center; padding: 28rpx 0; font-size: 28rpx; color: #737373;
  position: relative;
  &.on { color: #171717; font-weight: 700; }
  &.on::after {
    content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 48rpx; height: 6rpx; background: #ffd60a; border-radius: 9999rpx;
  }
}
.list { padding: 24rpx 32rpx; display: flex; flex-direction: column; gap: 24rpx; }
.svc-card { background: #ffffff; border-radius: 24rpx; padding: 28rpx; }
.svc-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.svc-title { font-size: 30rpx; font-weight: 600; color: #171717; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.svc-status { font-size: 24rpx; font-weight: 600; padding: 4rpx 16rpx; border-radius: 8rpx; background: #f5f5f5; color: #525252; flex-shrink: 0; margin-left: 12rpx; }
.svc-status.online { background: #dcfce7; color: #22c55e; }
.svc-status.offline { background: #f5f5f5; color: #a3a3a3; }
.svc-status.pending { background: #fff9c4; color: #b45309; }
.svc-desc { font-size: 26rpx; color: #737373; margin-bottom: 16rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.svc-stats { display: flex; align-items: center; gap: 24rpx; padding: 16rpx 0; border-top: 2rpx solid #f5f5f5; }
.stat { font-size: 22rpx; color: #a3a3a3; }
.price { margin-left: auto; display: flex; align-items: baseline; gap: 4rpx; }
.amount { font-size: 30rpx; font-weight: 700; color: #ef4444; }
.unit { font-size: 22rpx; color: #737373; }
.svc-actions { display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: 2rpx solid #f5f5f5; }
.act-btn {
  font-size: 26rpx; padding: 10rpx 32rpx; border-radius: 9999rpx;
  background: #ffd60a; color: #171717; font-weight: 600;
  &.ghost { background: #f5f5f5; color: #525252; }
}
.empty { display: flex; flex-direction: column; align-items: center; padding: 160rpx 0; gap: 16rpx; }
.empty-icon { font-size: 96rpx; }
.empty-text { font-size: 28rpx; color: #525252; }
.empty-btn {
  margin-top: 24rpx; padding: 16rpx 48rpx; background: #ffd60a; color: #171717;
  border-radius: 9999rpx; font-size: 28rpx; font-weight: 600;
}
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
