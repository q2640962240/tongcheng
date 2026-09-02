<template>
  <view class="page">
    <!-- 角色切换 -->
    <view class="tabs">
      <view class="tab" :class="{ on: role === 'user' }" @tap="switchRole('user')">我购买的</view>
      <view class="tab" :class="{ on: role === 'provider' }" @tap="switchRole('provider')">我接的单</view>
    </view>

    <!-- 状态筛选 -->
    <scroll-view scroll-x class="status-bar">
      <view class="status-item" :class="{ on: status === '' }" @tap="switchStatus('')">全部</view>
      <view v-for="(label, val) in statusMap" :key="val" class="status-item" :class="{ on: status === val }" @tap="switchStatus(val)">
        {{ label }}
      </view>
    </scroll-view>

    <!-- 加载中 -->
    <view v-if="loading && list.length === 0" class="loading-wrap">
      <view class="loading-skeleton" v-for="i in 3" :key="i">
        <view class="sk-line sk-line-sm"></view>
        <view class="sk-body">
          <view class="sk-line sk-line-md"></view>
          <view class="sk-line sk-line-lg"></view>
        </view>
        <view class="sk-line sk-line-sm"></view>
      </view>
    </view>

    <!-- 订单列表 -->
    <view class="order-list">
      <view v-for="o in list" :key="o.id" class="order-card" @tap="onDetail(o)">
        <view class="order-top">
          <text class="order-no">单号 {{ o.orderNo }}</text>
          <text class="order-status" :class="o.status">{{ getStatusLabel(o.status) }}</text>
        </view>
        <view class="order-body">
          <view class="service-info">
            <text class="service-title">{{ o.serviceTitle }}</text>
            <text class="counterpart">{{ role === 'user' ? '服务者' : '买家' }}：{{ o.counterpart.nickname }}</text>
          </view>
          <view class="amount-info">
            <text class="amount">{{ o.amount }} 星币</text>
            <text class="quantity">x{{ o.quantity }}</text>
          </view>
        </view>
        <view class="order-bottom">
          <text class="time">{{ formatTime(o.createdAt) }}</text>
          <view class="actions" @tap.stop>
            <text v-if="o.status === 'pending' && role === 'user'" class="act-btn pay" @tap="onPay(o)">立即支付</text>
            <text v-if="o.status === 'paid' && role === 'provider'" class="act-btn start" @tap="onStart(o)">开始服务</text>
            <text v-if="o.status === 'serving' && role === 'provider'" class="act-btn confirm" @tap="onConfirm(o)">完成服务</text>
            <text v-if="['pending', 'paid'].includes(o.status) && role === 'user'" class="act-btn cancel" @tap="onCancel(o)">取消</text>
          </view>
        </view>
      </view>
      <view v-if="!loading && list.length === 0" class="empty">
        <view class="empty-aurora"></view>
        <text class="empty-icon">📦</text>
        <text class="empty-text">暂无订单</text>
        <text class="empty-sub">去发现更多精彩服务吧</text>
      </view>
      <!-- 分页加载状态 -->
      <view v-if="list.length > 0" class="load-more">
        <text v-if="loading && !isRefresh" class="load-text">加载更多...</text>
        <text v-if="!hasMore && list.length > 0" class="load-text no-more">没有更多了</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { orderApi } from '../../api'
import {
  guard, unwrapPage, safeMap, getPath, toStr, toNum, toObj,
  requireLogin, formatTime
} from '../../utils/fallback'

const loading = ref(false)
const list = ref([])
const role = ref('user')
const status = ref('')
const page = ref(1)
const pageSize = 20
const hasMore = ref(true)
const isRefresh = ref(false)

const statusMap = {
  pending: '待支付', paid: '已支付', serving: '服务中',
  completed: '已完成', cancelled: '已取消', refunding: '退款中', refunded: '已退款'
}

const getStatusLabel = (s) => toStr(statusMap[s], '未知状态')

const normalizeOrder = (raw) => {
  const counterpart = toObj(getPath(raw, 'counterpart', {}), {})
  return {
    id: getPath(raw, 'id', toStr(Math.random())),
    orderNo: toStr(getPath(raw, 'orderNo', getPath(raw, 'order_no')), '-'),
    status: toStr(getPath(raw, 'status'), 'pending'),
    serviceTitle: toStr(getPath(raw, 'serviceTitle', getPath(raw, 'service_title')), '服务订单'),
    amount: toNum(getPath(raw, 'amount'), 0),
    quantity: toNum(getPath(raw, 'quantity'), 1),
    createdAt: getPath(raw, 'createdAt', getPath(raw, 'created_at')),
    counterpart: {
      ...counterpart,
      nickname: toStr(getPath(counterpart, 'nickname'), '-')
    }
  }
}

const loadData = async (append = false) => {
  loading.value = true
  // 追加模式下记录当前页码，失败时回退
  const currentPage = page.value
  try {
    const pageData = await guard(
      orderApi.list({ role: role.value, status: status.value, page: page.value, pageSize })
        .then(r => unwrapPage(r, { list: [], total: 0 })),
      { list: [], total: 0 }
    )
    const normalized = safeMap(pageData.list, normalizeOrder)
    if (append) {
      list.value = [...list.value, ...normalized]
    } else {
      list.value = normalized
    }
    hasMore.value = normalized.length >= pageSize
  } catch (_) {
    if (!append) {
      list.value = []
    } else {
      // 追加模式请求失败，回退页码
      page.value = currentPage
    }
    hasMore.value = false
  } finally {
    loading.value = false
    isRefresh.value = false
  }
}

const switchRole = (r) => { role.value = r; page.value = 1; loadData() }
const switchStatus = (s) => { status.value = s; page.value = 1; loadData() }

const onDetail = (o) => {
  const id = toStr(getPath(o, 'id'), '')
  if (!id) return
  uni.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` })
}

const onPay = async (o) => {
  if (!requireLogin()) return
  const id = toStr(getPath(o, 'id'), '')
  if (!id) return
  try {
    await guard(orderApi.pay(id), null)
    uni.showToast({ title: '支付成功', icon: 'success' })
    loadData()
  } catch (_) {}
}

const onStart = async (o) => {
  if (!requireLogin()) return
  const id = toStr(getPath(o, 'id'), '')
  if (!id) return
  try {
    await guard(orderApi.start(id), null)
    uni.showToast({ title: '已开始服务', icon: 'success' })
    loadData()
  } catch (_) {}
}

const onConfirm = async (o) => {
  if (!requireLogin()) return
  const id = toStr(getPath(o, 'id'), '')
  if (!id) return
  uni.showModal({
    title: '确认完成', content: '确认已完成该订单服务？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await guard(orderApi.confirm(id), null)
          uni.showToast({ title: '订单已完成', icon: 'success' })
          loadData()
        } catch (_) {}
      }
    }
  })
}

const onCancel = (o) => {
  if (!requireLogin()) return
  const id = toStr(getPath(o, 'id'), '')
  if (!id) return
  uni.showModal({
    title: '取消订单', content: '确认取消该订单？已支付订单将退还星币',
    success: async (res) => {
      if (res.confirm) {
        try {
          await guard(orderApi.cancel(id), null)
          uni.showToast({ title: '已取消', icon: 'success' })
          loadData()
        } catch (_) {}
      }
    }
  })
}

onShow(() => { page.value = 1; loadData() })
onPullDownRefresh(async () => {
  isRefresh.value = true
  page.value = 1
  await loadData()
  uni.stopPullDownRefresh()
})
onReachBottom(() => {
  if (!hasMore.value || loading.value) return
  page.value++
  loadData(true)
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: $by-bg; padding-bottom: 32rpx; }

/* Tabs */
.tabs { display: flex; background: $by-card-bg; border-bottom: 1rpx solid $by-border; }
.tab {
  flex: 1; text-align: center; padding: 28rpx 0; font-size: 30rpx; color: $by-text-2;
  position: relative; transition: color 0.2s ease;
  &.on { color: $by-text-1; font-weight: 700; }
  &.on::after {
    content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 48rpx; height: 6rpx; background: $by-gradient-gold; border-radius: $by-radius-pill;
  }
}

/* Status bar */
.status-bar { white-space: nowrap; padding: 20rpx $by-page-pad-x; background: $by-bg; }
.status-item {
  display: inline-block; padding: 12rpx 28rpx; margin-right: 16rpx;
  background: $by-soft-card; border-radius: $by-radius-pill; font-size: 26rpx; color: $by-text-2;
  border: 1rpx solid $by-border; transition: all 0.2s ease;
  &.on {
    background: color.adjust($by-gold, $alpha: 0.2);
    color: $by-gold; font-weight: 600;
    border-color: color.adjust($by-gold, $alpha: 0.35);
  }
}

/* Loading skeleton */
.loading-wrap { padding: 16rpx $by-page-pad-x; display: flex; flex-direction: column; gap: 24rpx; }
.loading-skeleton {
  background: $by-card-bg; border-radius: $by-radius-lg; padding: 28rpx;
  border: 1rpx solid $by-border; display: flex; flex-direction: column; gap: 20rpx;
}
.sk-line {
  height: 24rpx; border-radius: $by-radius-sm;
  background: linear-gradient(90deg, $by-soft-card 0%, $by-surface-2 50%, $by-soft-card 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}
.sk-line-sm { width: 30%; height: 20rpx; }
.sk-line-md { width: 60%; }
.sk-line-lg { width: 40%; height: 32rpx; }
.sk-body { display: flex; flex-direction: column; gap: 12rpx; padding: 12rpx 0; }
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Order list */
.order-list { padding: 16rpx $by-page-pad-x 32rpx; display: flex; flex-direction: column; gap: 24rpx; }
.order-card {
  background: $by-card-bg; border-radius: 24rpx; padding: 28rpx;
  border: 1rpx solid $by-border;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
  &:active { transform: scale(0.99); }
}
.order-top {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 20rpx; border-bottom: 1rpx solid $by-border;
}
.order-no { font-size: 24rpx; color: $by-text-3; }
.order-status {
  font-size: 26rpx; font-weight: 600; padding: 6rpx 16rpx; border-radius: $by-radius-sm;
  background: $by-soft-card; color: $by-text-2;
  &.paid {
    background: color.adjust($by-gold, $alpha: 0.16);
    color: $by-gold;
  }
  &.serving {
    background: color.adjust($by-aurora-b, $alpha: 0.2);
    color: $by-aurora-b;
  }
  &.completed {
    background: color.adjust($by-success, $alpha: 0.16);
    color: $by-success;
  }
  &.refunding {
    background: color.adjust($by-warning, $alpha: 0.16);
    color: $by-warning;
  }
  &.refunded {
    background: color.adjust($by-error, $alpha: 0.16);
    color: $by-error;
  }
  &.cancelled {
    background: $by-soft-card;
    color: $by-text-3;
  }
  &.pending {
    background: color.adjust($by-info, $alpha: 0.16);
    color: $by-info;
  }
}
.order-body { display: flex; justify-content: space-between; padding: 24rpx 0; }
.service-info { flex: 1; display: flex; flex-direction: column; gap: 10rpx; }
.service-title { font-size: 30rpx; font-weight: 600; color: $by-text-1; }
.counterpart { font-size: 24rpx; color: $by-text-3; }
.amount-info { text-align: right; display: flex; flex-direction: column; gap: 6rpx; }
.amount {
  font-size: 32rpx; font-weight: 700;
  background: $by-gradient-gold;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.quantity { font-size: 24rpx; color: $by-text-3; }
.order-bottom {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 20rpx; border-top: 1rpx solid $by-border;
}
.time { font-size: 24rpx; color: $by-text-3; }
.actions { display: flex; gap: 16rpx; }
.act-btn {
  font-size: 26rpx; padding: 12rpx 30rpx; border-radius: $by-radius-pill;
  display: inline-flex; align-items: center; justify-content: center;
  transition: opacity 0.15s ease;
  &:active { opacity: 0.8; }
  &.pay {
    background: $by-gradient-gold; color: #0B0F1A; font-weight: 600;
    box-shadow: $by-shadow-gold;
  }
  &.start {
    background: $by-gradient-aurora; color: $by-text-1; font-weight: 600;
  }
  &.confirm {
    background: $by-gradient-gold; color: #0B0F1A; font-weight: 600;
  }
  &.cancel {
    background: $by-soft-card; color: $by-text-2;
    border: 1rpx solid $by-border;
  }
}

/* Empty state */
.empty {
  display: flex; flex-direction: column; align-items: center;
  padding: 120rpx 0 80rpx; gap: 16rpx; position: relative;
}
.empty-aurora {
  position: absolute; top: 40rpx; left: 50%; transform: translateX(-50%);
  width: 320rpx; height: 320rpx; border-radius: 50%;
  background: $by-gradient-aurora;
  filter: blur(80rpx); opacity: 0.15;
  pointer-events: none;
}
.empty-icon { font-size: 96rpx; position: relative; z-index: 1; }
.empty-text { font-size: 30rpx; color: $by-text-1; font-weight: 600; position: relative; z-index: 1; }
.empty-sub { font-size: 24rpx; color: $by-text-3; position: relative; z-index: 1; }

/* Load more */
.load-more { padding: 32rpx 0; text-align: center; }
.load-text { font-size: 24rpx; color: $by-text-3; }
.no-more { opacity: 0.6; }
</style>
