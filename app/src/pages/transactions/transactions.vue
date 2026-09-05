<template>
  <view class="page">
    <!-- 类型筛选 -->
    <scroll-view scroll-x class="type-bar">
      <view class="type-item" :class="{ on: type === '' }" @tap="switchType('')">全部</view>
      <view v-for="(label, val) in typeMap" :key="val" class="type-item" :class="{ on: type === val }" @tap="switchType(val)">
        {{ label }}
      </view>
    </scroll-view>

    <!-- 加载骨架 -->
    <view v-if="loading && list.length === 0" class="loading-wrap">
      <view class="loading-skeleton" v-for="i in 5" :key="i">
        <view class="sk-avatar"></view>
        <view class="sk-body">
          <view class="sk-line sk-line-sm"></view>
          <view class="sk-line sk-line-md"></view>
        </view>
        <view class="sk-amount"></view>
      </view>
    </view>

    <!-- 列表 -->
    <view class="tx-list">
      <view v-for="t in list" :key="t.id" class="tx-item">
        <view class="tx-icon" :class="t.type">{{ typeIcon(t.type) }}</view>
        <view class="tx-info">
          <text class="tx-title">{{ getTypeLabel(t.type) }}</text>
          <text class="tx-remark">{{ t.remark }}</text>
          <text class="tx-time">{{ formatTime(t.createdAt) }}</text>
        </view>
        <text class="tx-amount" :class="isIncome(t.type) ? 'in' : 'out'">
          {{ isIncome(t.type) ? '+' : '-' }}{{ formatCurrency(t) }}
        </text>
      </view>
      <view v-if="!loading && list.length === 0" class="empty">
        <view class="empty-aurora"></view>
        <text class="empty-icon">💰</text>
        <text class="empty-text">暂无交易记录</text>
        <text class="empty-sub">首次交易将在这里显示</text>
      </view>
      <view v-if="loading && list.length > 0" class="loading-more">
        <text class="loading-text">加载中…</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { walletApi } from '../../api'
import {
  guard, unwrapPage, safeMap, getPath, toStr, toNum,
  requireLogin, formatTime
} from '../../utils/fallback'

const list = ref([])
const loading = ref(false)
const type = ref('')
const page = ref(1)
const total = ref(0)

const typeMap = {
  recharge: '充值', exchange: '兑换', consume: '消费',
  income: '约玩收入', withdraw: '提现', refund: '退款', reward: '分红奖励'
}

const INCOME_TYPES = ['recharge', 'income', 'refund', 'reward']

const getTypeLabel = (t) => toStr(typeMap[t], '其他交易')

const typeIcon = (t) => ({
  recharge: '💎', exchange: '⇄', consume: '🛒',
  income: '💼', withdraw: '🏧', refund: '↩️', reward: '🎁'
}[t] || '💰')

// 收入类（金额为正显示）
const isIncome = (t) => INCOME_TYPES.includes(toStr(t, ''))

// 自实现 formatCurrency：fen→¥x.xx，其他 + N 星币
const formatCurrency = (t) => {
  const amt = toNum(getPath(t, 'amount'), 0)
  const currency = toStr(getPath(t, 'currency'), 'starCoin')
  if (currency === 'fen') {
    const yuan = (amt / 100).toFixed(2)
    return `¥${yuan}`
  }
  return `${amt} 星币`
}

const normalizeTx = (raw) => {
  return {
    id: getPath(raw, 'id', toStr(Math.random())),
    type: toStr(getPath(raw, 'type', getPath(raw, 'tx_type')), 'consume'),
    remark: toStr(getPath(raw, 'remark'), '-'),
    createdAt: getPath(raw, 'createdAt', getPath(raw, 'created_at')),
    amount: toNum(getPath(raw, 'amount'), 0),
    currency: toStr(getPath(raw, 'currency'), 'starCoin')
  }
}

const loadData = async (reset = true) => {
  if (!requireLogin()) {
    loading.value = false
    return
  }
  if (reset) { page.value = 1; list.value = []; total.value = 0 }
  loading.value = true
  try {
    const pageData = await guard(
      walletApi.transactions({ type: type.value, page: page.value, pageSize: 20 })
        .then(r => unwrapPage(r, { list: [], total: 0 })),
      { list: [], total: 0 }
    )
    const newList = safeMap(pageData.list, normalizeTx)
    list.value = reset ? newList : list.value.concat(newList)
    total.value = toNum(pageData.total, list.value.length)
  } catch (_) {
    if (reset) list.value = []
  } finally {
    loading.value = false
  }
}

const switchType = (t) => { type.value = t; loadData(true) }

onShow(() => loadData(true))
onPullDownRefresh(async () => {
  await loadData(true)
  uni.stopPullDownRefresh()
})
onReachBottom(() => {
  const t = toNum(total.value, 0)
  const len = list.value.length
  // total 未知时（<= 0）不触发加载；使用原生 < 比较
  if (t > 0 && len < t && !loading.value) {
    page.value++
    loadData(false)
  }
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: $by-bg; padding-bottom: 32rpx; }

/* Type bar */
.type-bar {
  white-space: nowrap; padding: 20rpx $by-page-pad-x;
  background: $by-card-bg; border-bottom: 1rpx solid $by-border;
  position: sticky; top: 0; z-index: 5;
}
.type-item {
  display: inline-block; padding: 12rpx 28rpx; margin-right: 16rpx;
  background: $by-soft-card; border-radius: $by-radius-pill; font-size: 26rpx; color: $by-text-2;
  border: 1rpx solid $by-border; transition: all 0.2s ease;
  &.on {
    background: color.adjust($by-gold, $alpha: 0.25);
    color: $by-gold; font-weight: 600;
    border-color: color.adjust($by-gold, $alpha: 0.4);
  }
}

/* Loading skeleton */
.loading-wrap { padding: 24rpx $by-page-pad-x; display: flex; flex-direction: column; gap: 16rpx; }
.loading-skeleton {
  display: flex; align-items: center; gap: 20rpx;
  background: $by-card-bg; border-radius: 24rpx; padding: 24rpx;
  border: 1rpx solid $by-border;
}
.sk-avatar {
  width: 80rpx; height: 80rpx; border-radius: $by-radius-pill;
  background: linear-gradient(90deg, $by-soft-card 0%, $by-surface-2 50%, $by-soft-card 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
  flex-shrink: 0;
}
.sk-body { flex: 1; display: flex; flex-direction: column; gap: 12rpx; }
.sk-line {
  height: 24rpx; border-radius: $by-radius-sm;
  background: linear-gradient(90deg, $by-soft-card 0%, $by-surface-2 50%, $by-soft-card 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}
.sk-line-sm { width: 40%; height: 28rpx; }
.sk-line-md { width: 65%; height: 20rpx; }
.sk-amount {
  width: 120rpx; height: 36rpx; border-radius: $by-radius-sm;
  background: linear-gradient(90deg, $by-soft-card 0%, $by-surface-2 50%, $by-soft-card 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Transaction list */
.tx-list { padding: 24rpx $by-page-pad-x; }
.tx-item {
  display: flex; align-items: center; gap: 20rpx;
  background: $by-card-bg; border-radius: 24rpx; padding: 24rpx;
  margin-bottom: 16rpx; border: 1rpx solid $by-border;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.99); }
}
.tx-icon {
  width: 80rpx; height: 80rpx; border-radius: $by-radius-pill;
  background: $by-soft-card;
  display: flex; align-items: center; justify-content: center; font-size: 40rpx; flex-shrink: 0;
  border: 1rpx solid $by-border;
  &.recharge {
    background: color.adjust($by-gold, $alpha: 0.16);
    border-color: color.adjust($by-gold, $alpha: 0.3);
  }
  &.income, &.reward {
    background: color.adjust($by-success, $alpha: 0.16);
    border-color: color.adjust($by-success, $alpha: 0.3);
  }
  &.consume {
    background: color.adjust($by-aurora-a, $alpha: 0.16);
    border-color: color.adjust($by-aurora-a, $alpha: 0.3);
  }
  &.withdraw {
    background: color.adjust($by-info, $alpha: 0.16);
    border-color: color.adjust($by-info, $alpha: 0.3);
  }
  &.exchange {
    background: color.adjust($by-aurora-b, $alpha: 0.16);
    border-color: color.adjust($by-aurora-b, $alpha: 0.3);
  }
  &.refund {
    background: color.adjust($by-warning, $alpha: 0.16);
    border-color: color.adjust($by-warning, $alpha: 0.3);
  }
}
.tx-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.tx-title { font-size: 28rpx; font-weight: 600; color: $by-text-1; }
.tx-remark {
  font-size: 24rpx; color: $by-text-3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tx-time { font-size: 22rpx; color: $by-text-muted; }
.tx-amount { font-size: 30rpx; font-weight: 700; flex-shrink: 0; }
.tx-amount.in {
  background: $by-gradient-gold;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.tx-amount.out {
  color: $by-text-2;
}

/* Empty state */
.empty {
  display: flex; flex-direction: column; align-items: center;
  padding: 160rpx 0 80rpx; gap: 16rpx; position: relative;
}
.empty-aurora {
  position: absolute; top: 60rpx; left: 50%; transform: translateX(-50%);
  width: 320rpx; height: 320rpx; border-radius: 50%;
  background: $by-gradient-aurora;
  filter: blur(80rpx); opacity: 0.15;
  pointer-events: none;
}
.empty-icon { font-size: 96rpx; position: relative; z-index: 1; }
.empty-text { font-size: 30rpx; color: $by-text-1; font-weight: 600; position: relative; z-index: 1; }
.empty-sub { font-size: 24rpx; color: $by-text-3; position: relative; z-index: 1; }

/* Loading more */
.loading-more {
  padding: 32rpx 0; text-align: center;
}
.loading-text {
  font-size: 24rpx; color: $by-text-3;
  display: inline-block;
  &::before {
    content: ''; display: inline-block; width: 24rpx; height: 24rpx;
    border: 3rpx solid $by-border-strong;
    border-top-color: $by-gold;
    border-radius: 50%;
    margin-right: 12rpx; vertical-align: -4rpx;
    animation: spin 0.8s linear infinite;
  }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
