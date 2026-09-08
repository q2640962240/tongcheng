<template>
  <view class="page">
    <!-- 余额概览 -->
    <view class="balance-hero">
      <view class="hero-glow"></view>
      <view class="hero-row">
        <view class="hero-item">
          <text class="hero-num">{{ wallet.diamond }}</text>
          <text class="hero-label">💎 钻石</text>
        </view>
        <view class="hero-divider"></view>
        <view class="hero-item">
          <text class="hero-num">{{ wallet.starCoin }}</text>
          <text class="hero-label">⭐ 星币</text>
        </view>
      </view>
      <view class="hero-income">
        <text class="hero-income-label">礼物收入（1钻石=1角）</text>
        <text class="hero-income-num">{{ incomeDiamond }} 💎</text>
      </view>
    </view>

    <!-- 快捷操作 -->
    <view class="actions">
      <view class="action-btn primary" @tap="goRecharge">
        <text class="action-icon">💎</text>
        <text class="action-text">充值</text>
      </view>
      <view class="action-btn" @tap="goWithdraw">
        <text class="action-icon">💰</text>
        <text class="action-text">提现</text>
      </view>
      <view class="action-btn" @tap="goTransactions">
        <text class="action-icon">📋</text>
        <text class="action-text">明细</text>
      </view>
    </view>

    <!-- 最近交易 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">最近交易</text>
        <view class="section-more" @tap="goTransactions">全部 →</view>
      </view>

      <view v-if="txLoading" class="tx-loading">
        <text class="tx-loading-text">加载中…</text>
      </view>

      <view v-else-if="txList.length === 0" class="tx-empty">
        <text class="tx-empty-icon">💰</text>
        <text class="tx-empty-text">暂无交易记录</text>
      </view>

      <view v-else class="tx-list">
        <view v-for="t in txList" :key="t.id" class="tx-item">
          <view class="tx-icon" :class="t.type">{{ t.icon }}</view>
          <view class="tx-info">
            <text class="tx-title">{{ t.label }}</text>
            <text class="tx-remark" v-if="t.remark">{{ t.remark }}</text>
            <text class="tx-time">{{ t.time }}<text v-if="t.orderNo" class="tx-order"> · 订单 {{ t.orderNo }}</text></text>
          </view>
          <text class="tx-amount" :class="t.inOut">{{ t.prefix }}{{ t.amountText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useWalletStore } from '../../store/wallet'
import { walletApi } from '../../api'
import { guard, unwrapPage, safeMap, getPath, toStr, toNum, formatTime } from '../../utils/fallback'

const walletStore = useWalletStore()
const wallet = computed(() => ({
  diamond: walletStore.diamond,
  starCoin: walletStore.starCoin
}))
// 礼物收入统一以钻石显示：1元=100分=10钻石 → 10分=1钻石
const incomeDiamond = computed(() => Math.floor(Number(walletStore.giftIncome) / 10))

const txList = ref([])
const txLoading = ref(false)

const typeMap = {
  recharge: '充值', exchange: '兑换', consume: '消费',
  income: '收入', withdraw: '提现', refund: '退款', reward: '奖励',
  gift_send: '送礼', gift_income: '礼物收入',
  gift_withdraw: '礼物提现', elite_pay: '精英开通', diamond_unlock_wechat: '解锁微信',
  admin_adjustment: '管理员调整'
}
const iconMap = {
  recharge: '💎', exchange: '⇄', consume: '🛒',
  income: '💼', withdraw: '🏧', refund: '↩️', reward: '🎁',
  gift_send: '🎁', gift_income: '💰',
  gift_withdraw: '🎁', elite_pay: '🌟', diamond_unlock_wechat: '🔓',
  admin_adjustment: '⚙️'
}
const INCOME_TYPES = ['recharge', 'income', 'gift_income', 'refund', 'reward', 'admin_adjustment']

// 全局统一：所有交易以钻石为单位显示（1钻石=1角=10分）
const formatCurrency = (t) => {
  const amt = toNum(getPath(t, 'amount'), 0)
  const currency = toStr(getPath(t, 'currency'), 'diamond')
  let diamondAmt
  if (currency === 'fen') {
    diamondAmt = Math.floor(Math.abs(amt) / 10) // 10分 = 1钻石
  } else {
    diamondAmt = Math.abs(amt) // diamond / starCoin 都按钻石计
  }
  return `${diamondAmt} 钻石`
}

const fetchTransactions = async () => {
  txLoading.value = true
  try {
    const pageData = await guard(
      walletApi.transactions({ page: 1, pageSize: 5 }).then(r => unwrapPage(r, { list: [], total: 0 })),
      { list: [], total: 0 }
    )
    txList.value = safeMap(pageData.list, raw => {
      const type = toStr(getPath(raw, 'type'), 'consume')
      const isIn = INCOME_TYPES.includes(type)
      const extra = getPath(raw, 'extra') || {}
      return {
        id: getPath(raw, 'id', toStr(Math.random())),
        type,
        icon: iconMap[type] || '💰',
        label: typeMap[type] || '其他交易',
        remark: toStr(getPath(raw, 'remark'), ''),
        orderNo: toStr(getPath(raw, 'orderId') || extra.outTradeNo || extra.orderNo || ''),
        amountText: formatCurrency(raw),
        prefix: isIn ? '+' : '-',
        inOut: isIn ? 'in' : 'out',
        time: formatTime(getPath(raw, 'createdAt', getPath(raw, 'created_at')))
      }
    })
  } catch (_) {
    txList.value = []
  } finally {
    txLoading.value = false
  }
}

const goRecharge = () => uni.navigateTo({ url: '/pages/recharge/recharge' })
const goWithdraw = () => uni.navigateTo({ url: '/pages/withdraw/withdraw' })
const goTransactions = () => uni.navigateTo({ url: '/pages/transactions/transactions' })

onShow(() => {
  walletStore.fetchBalance().catch(() => {})
  fetchTransactions()
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: $by-bg; padding-bottom: calc(32rpx + env(safe-area-inset-bottom)); }

/* Hero balance */
.balance-hero {
  position: relative; overflow: hidden;
  margin: 24rpx $by-page-pad-x 0;
  background: linear-gradient(135deg, #171717 0%, #404040 100%);
  border-radius: 32rpx; padding: 48rpx 32rpx 36rpx;
}
.hero-glow {
  position: absolute; top: -60rpx; right: -40rpx;
  width: 240rpx; height: 240rpx; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,214,10,.18) 0%, transparent 70%);
  pointer-events: none;
}
.hero-row { display: flex; align-items: center; }
.hero-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.hero-num { font-size: 52rpx; font-weight: 700; color: #ffd60a; }
.hero-label { font-size: 24rpx; color: #a3a3a3; }
.hero-divider { width: 2rpx; height: 72rpx; background: linear-gradient(180deg, transparent, rgba(255,255,255,.12), transparent); flex-shrink: 0; }
.hero-income {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 24rpx; padding-top: 20rpx;
  border-top: 1rpx solid rgba(255,255,255,.08);
}
.hero-income-label { font-size: 26rpx; color: #a3a3a3; }
.hero-income-num { font-size: 32rpx; font-weight: 700; color: #ffd60a; }

/* Actions */
.actions {
  display: flex; gap: 16rpx;
  margin: 24rpx $by-page-pad-x;
}
.action-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  background: $by-card-bg; border-radius: 24rpx; padding: 28rpx 0;
  border: 1rpx solid $by-border;
  &:active { opacity: 0.8; transform: scale(0.97); }
  &.primary {
    background: linear-gradient(135deg, color.adjust($by-gold, $alpha: 0.12), color.adjust($by-gold, $alpha: 0.06));
    border-color: color.adjust($by-gold, $alpha: 0.3);
  }
}
.action-icon { font-size: 40rpx; }
.action-text { font-size: 26rpx; font-weight: 600; color: $by-text-1; }

/* Section */
.section {
  margin: 0 $by-page-pad-x;
}
.section-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16rpx;
}
.section-title { font-size: 30rpx; font-weight: 600; color: $by-text-1; }
.section-more { font-size: 24rpx; color: $by-text-3; }

/* Transaction list */
.tx-loading { text-align: center; padding: 48rpx 0; }
.tx-loading-text { font-size: 26rpx; color: $by-text-3; }
.tx-empty { display: flex; flex-direction: column; align-items: center; gap: 12rpx; padding: 64rpx 0; }
.tx-empty-icon { font-size: 64rpx; }
.tx-empty-text { font-size: 26rpx; color: $by-text-3; }

.tx-list { display: flex; flex-direction: column; gap: 12rpx; }
.tx-item {
  display: flex; align-items: center; gap: 16rpx;
  background: $by-card-bg; border-radius: 20rpx; padding: 20rpx 24rpx;
  border: 1rpx solid $by-border;
  &:active { transform: scale(0.99); }
}
.tx-icon {
  width: 72rpx; height: 72rpx; border-radius: 9999rpx;
  background: $by-soft-card;
  display: flex; align-items: center; justify-content: center; font-size: 36rpx; flex-shrink: 0;
  border: 1rpx solid $by-border;
  &.recharge { background: color.adjust($by-gold, $alpha: 0.16); border-color: color.adjust($by-gold, $alpha: 0.3); }
  &.income, &.gift_income, &.reward { background: color.adjust($by-success, $alpha: 0.16); border-color: color.adjust($by-success, $alpha: 0.3); }
  &.consume, &.gift_send { background: color.adjust($by-aurora-a, $alpha: 0.16); border-color: color.adjust($by-aurora-a, $alpha: 0.3); }
}
.tx-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.tx-title { font-size: 28rpx; font-weight: 600; color: $by-text-1; }
.tx-remark { font-size: 22rpx; color: $by-text-3; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 360rpx; }
.tx-time { font-size: 22rpx; color: $by-text-muted; }
.tx-order { font-size: 20rpx; color: $by-text-3; font-family: Menlo, Consolas, monospace; }
.tx-amount { font-size: 28rpx; font-weight: 700; flex-shrink: 0; }
.tx-amount.in {
  background: $by-gradient-gold;
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.tx-amount.out { color: $by-text-2; }
</style>
