<template>
  <view class="page">
    <!-- 余额展示 -->
    <view class="balance-card">
      <view class="bal-item">
        <text class="bal-num">{{ wallet.diamond }}</text>
        <text class="bal-label">钻石余额</text>
      </view>
      <view class="bal-item">
        <text class="bal-num">{{ wallet.starCoin }}</text>
        <text class="bal-label">星币余额</text>
      </view>
    </view>

    <!-- 充值套餐 -->
    <view class="section">
      <text class="section-title">选择充值套餐</text>
      <view class="plans">
        <view
          v-for="plan in plans"
          :key="plan.diamond"
          class="plan"
          :class="{ active: selected === plan.diamond }"
          @tap="selected = plan.diamond"
        >
          <view class="plan-diamond">
            <text class="plan-num">{{ plan.diamond }}</text>
            <text class="plan-unit">钻石</text>
          </view>
          <text class="plan-price">¥{{ plan.price }}</text>
          <text v-if="plan.gift" class="plan-gift">赠 {{ plan.gift }} 钻石</text>
        </view>
      </view>
    </view>

    <!-- 支付方式 -->
    <view class="section">
      <text class="section-title">支付方式</text>
      <view class="pay-methods">
        <view class="pay-item" :class="{ active: payMethod === 'wechat' }" @tap="payMethod = 'wechat'">
          <text class="pay-icon">💚</text>
          <text class="pay-name">微信支付</text>
          <text class="radio" :class="{ on: payMethod === 'wechat' }"></text>
        </view>
        <view class="pay-item" :class="{ active: payMethod === 'alipay' }" @tap="payMethod = 'alipay'">
          <text class="pay-icon">💙</text>
          <text class="pay-name">支付宝</text>
          <text class="radio" :class="{ on: payMethod === 'alipay' }"></text>
        </view>
      </view>
    </view>

    <!-- 兑换说明 -->
    <view class="tips">
      <text class="tips-title">说明</text>
      <text class="tips-line">· 1 钻石 = 1 星币，可在钱包内兑换</text>
      <text class="tips-line">· 充值后钻石即时到账，不可退款</text>
      <text class="tips-line">· 反馈采纳可获得钻石奖励</text>
    </view>

    <!-- 交易记录 -->
    <view class="section">
      <view class="history-header">
        <text class="section-title" style="margin-bottom:0">交易记录</text>
        <view class="history-more" @tap="goTransactions">全部 →</view>
      </view>
      <view v-if="txLoading" class="tx-loading">加载中…</view>
      <view v-else-if="txList.length === 0" class="tx-empty">暂无交易记录</view>
      <view v-else class="tx-list">
        <view v-for="t in txList" :key="t.id" class="tx-item">
          <view class="tx-icon" :class="t.type">{{ t.type === 'recharge' ? '💎' : t.type === 'consume' ? '🛒' : '⇄' }}</view>
          <view class="tx-info">
            <text class="tx-title">{{ t.label }}</text>
            <text class="tx-remark">{{ t.remark }}</text>
          </view>
          <view class="tx-right">
            <text class="tx-amount" :class="t.type === 'recharge' ? 'in' : 'out'">{{ t.type === 'recharge' ? '+' : '-' }}{{ t.amountText }}</text>
            <text class="tx-time">{{ t.time }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 充值按钮 -->
    <view class="submit-btn" :class="{ disabled: !selected }" @tap="onRecharge">
      确认充值 ¥{{ selectedPrice }}
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useWalletStore } from '../../store/wallet'
import { walletApi } from '../../api'

const walletStore = useWalletStore()
const wallet = computed(() => ({
  diamond: walletStore.diamond,
  starCoin: walletStore.starCoin
}))

const txList = ref([])
const txLoading = ref(false)

const plans = [
  { diamond: 60, price: 6, gift: 0 },
  { diamond: 300, price: 30, gift: 15 },
  { diamond: 680, price: 68, gift: 50 },
  { diamond: 1280, price: 128, gift: 120 },
  { diamond: 3280, price: 328, gift: 380 },
  { diamond: 6880, price: 688, gift: 1000 }
]
const selected = ref(680)
const selectedPrice = computed(() => plans.find(p => p.diamond === selected.value)?.price || 0)
const payMethod = ref('wechat')

const labelMap = {
  recharge: '充值', consume: '消费', exchange: '兑换',
  gift_send: '送礼', refund: '退款', reward: '奖励'
}

const formatDate = (str) => {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${day} ${h}:${min}`
}

const fetchTransactions = async () => {
  txLoading.value = true
  try {
    const res = await walletApi.transactions({ page: 1, pageSize: 10 })
    const list = res?.data?.list || res?.list || []
    txList.value = list.map(item => {
      const type = item.type || 'consume'
      const amt = item.amount || 0
      const currency = item.currency || 'starCoin'
      let amountText
      if (currency === 'fen') {
        amountText = `¥${(amt / 100).toFixed(2)}`
      } else {
        amountText = `${Math.abs(amt)} ${currency === 'diamond' ? '钻石' : '星币'}`
      }
      return {
        id: item.id,
        type,
        label: labelMap[type] || '交易',
        remark: item.remark || '',
        amountText,
        time: formatDate(item.createdAt || item.created_at)
      }
    })
  } catch (e) {
    txList.value = []
  } finally {
    txLoading.value = false
  }
}

const goTransactions = () => {
  uni.navigateTo({ url: '/pages/transactions/transactions' })
}

const onRecharge = async () => {
  if (!selected.value) return
  try {
    await walletStore.recharge(selectedPrice.value)
    uni.showToast({ title: '充值成功', icon: 'success' })
    await walletStore.fetchBalance()
    setTimeout(() => uni.navigateBack(), 800)
  } catch (e) {}
}

onShow(() => {
  walletStore.fetchBalance().catch(() => {})
  fetchTransactions()
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: $by-bg; padding: 32rpx; padding-bottom: 200rpx; }
.balance-card {
  display: flex; background: linear-gradient(135deg, $by-bg-soft 0%, $by-surface 100%);
  border-radius: 32rpx; padding: 48rpx 32rpx; margin-bottom: 32rpx;
}
.bal-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.bal-num { font-size: 56rpx; font-weight: 700; color: $by-gold-soft; }
.bal-label { font-size: 24rpx; color: $by-text-2; }
.section { margin-bottom: 32rpx; }
.section-title { font-size: 30rpx; font-weight: 600; color: $by-text-1; margin-bottom: 24rpx; display: block; }
.plans { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16rpx; }
.plan {
  background: $by-surface; border-radius: 24rpx; padding: 32rpx 24rpx;
  display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  border: 4rpx solid $by-border; transition: all 0.2s;
}
.plan.active { border-color: $by-gold; background: $by-surface-2; }
.plan-diamond { display: flex; align-items: baseline; gap: 4rpx; }
.plan-num { font-size: 44rpx; font-weight: 700; color: $by-text-1; }
.plan-unit { font-size: 24rpx; color: $by-text-3; }
.plan-price { font-size: 30rpx; font-weight: 600; color: #DC2626; }
.plan-gift { font-size: 22rpx; color: $by-gold-soft; background: color.adjust($by-gold, $alpha: -0.82); padding: 4rpx 16rpx; border-radius: 9999rpx; }
.pay-methods { background: $by-surface; border-radius: 24rpx; overflow: hidden; }
.pay-item {
  display: flex; align-items: center; padding: 32rpx; border-bottom: 2rpx solid $by-border;
  &:last-child { border-bottom: none; }
}
.pay-item.active { background: $by-surface-2; }
.pay-icon { font-size: 40rpx; margin-right: 24rpx; }
.pay-name { flex: 1; font-size: 30rpx; color: $by-text-1; }
.radio {
  width: 36rpx; height: 36rpx; border-radius: 9999rpx; border: 4rpx solid $by-text-mute;
}
.radio.on { border-color: $by-gold; background: $by-gold; box-shadow: inset 0 0 0 6rpx $by-surface; }
.tips {
  background: $by-surface; border-radius: 24rpx; padding: 32rpx; margin-bottom: 32rpx;
  display: flex; flex-direction: column; gap: 8rpx;
}
.tips-title { font-size: 26rpx; font-weight: 600; color: $by-text-2; margin-bottom: 8rpx; }
.tips-line { font-size: 24rpx; color: $by-text-3; line-height: 1.6; }
.submit-btn {
  position: fixed; left: 32rpx; right: 32rpx; bottom: calc(48rpx + env(safe-area-inset-bottom));
  height: 96rpx; background: $by-gradient-gold; color: $by-bg;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700;
  box-shadow: $by-shadow-2;
  &:active { opacity: 0.85; }
  &.disabled { background: $by-bg-soft; color: $by-text-mute; box-shadow: none; }
}
.history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.history-more { font-size: 24rpx; color: $by-text-3; }
.tx-loading, .tx-empty { font-size: 26rpx; color: $by-text-3; text-align: center; padding: 32rpx 0; }
.tx-list { display: flex; flex-direction: column; gap: 12rpx; }
.tx-item {
  display: flex; align-items: center; gap: 16rpx;
  background: $by-surface; border-radius: 20rpx; padding: 20rpx 24rpx;
  border: 1rpx solid $by-border;
}
.tx-icon {
  width: 64rpx; height: 64rpx; border-radius: 9999rpx;
  background: $by-soft-card; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; flex-shrink: 0;
  &.recharge { background: color.adjust($by-gold, $alpha: 0.16); }
  &.consume { background: color.adjust($by-aurora-a, $alpha: 0.16); }
}
.tx-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.tx-title { font-size: 26rpx; font-weight: 600; color: $by-text-1; }
.tx-remark { font-size: 22rpx; color: $by-text-3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tx-right { display: flex; flex-direction: column; gap: 4rpx; align-items: flex-end; flex-shrink: 0; }
.tx-amount { font-size: 28rpx; font-weight: 700; &.in { color: $by-gold; } &.out { color: $by-text-2; } }
.tx-time { font-size: 22rpx; color: $by-text-muted; }
</style>
