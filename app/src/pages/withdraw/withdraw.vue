<template>
  <view class="page">
    <!-- 余额 -->
    <view class="balance-card">
      <text class="bal-label">可提现礼物收入（元）</text>
      <text class="bal-num">{{ fenToYuan(wallet.giftIncome) }}</text>
      <text class="bal-tip">收到礼物后平台按分成比例结算的金额</text>
    </view>

    <!-- 提现金额 -->
    <view class="card">
      <text class="card-title">提现金额</text>
      <view class="input-row">
        <text class="cny">¥</text>
        <input
          v-model.number="amount"
          class="amount-input"
          type="digit"
          placeholder="最低 1 元"
        />
        <view class="all-btn" @tap="amount = incomeYuan">全部</view>
      </view>
      <view class="preview">
        <text class="preview-label">提现后剩余</text>
        <text class="preview-amount">¥{{ remainYuan }}</text>
      </view>
    </view>

    <!-- 提现方式 -->
    <view class="card">
      <text class="card-title">到账方式</text>
      <view class="methods">
        <view class="method" :class="{ on: method === 'wechat' }" @tap="method = 'wechat'">
          <text class="m-icon">💚</text>
          <text class="m-name">微信零钱</text>
          <text class="radio" :class="{ on: method === 'wechat' }"></text>
        </view>
        <view class="method" :class="{ on: method === 'alipay' }" @tap="method = 'alipay'">
          <text class="m-icon">💙</text>
          <text class="m-name">支付宝</text>
          <text class="radio" :class="{ on: method === 'alipay' }"></text>
        </view>
      </view>
    </view>

    <!-- 说明 -->
    <view class="tips">
      <text class="tips-title">提现说明</text>
      <text class="tips-line">· 单笔最低 1 元，T+1 个工作日到账</text>
      <text class="tips-line">· 每日最多提现 3 次，单日上限 5000 元</text>
      <text class="tips-line">· 提现手续费全免</text>
    </view>

    <!-- 提交 -->
    <view class="submit-btn" :class="{ disabled: !canSubmit }" @tap="onWithdraw">
      {{ submitting ? '提交中...' : '确认提现' }}
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useWalletStore } from '../../store/wallet'
import { giftApi } from '../../api'
import { fenToYuan } from '../../utils/format'

const walletStore = useWalletStore()
const wallet = computed(() => ({ giftIncome: walletStore.giftIncome }))
const amount = ref(null)
const method = ref('wechat')
const submitting = ref(false)

const incomeYuan = computed(() => (Number(walletStore.giftIncome) / 100))
const remainYuan = computed(() => {
  const remain = incomeYuan.value - (Number(amount.value) || 0)
  return Math.max(remain, 0).toFixed(2)
})

const canSubmit = computed(() => {
  const a = Number(amount.value)
  return a >= 1 && a <= incomeYuan.value
})

const onWithdraw = () => {
  if (!canSubmit.value || submitting.value) return
  uni.showModal({
    title: '确认提现',
    content: `提现 ¥${Number(amount.value).toFixed(2)} 到${method.value === 'wechat' ? '微信零钱' : '支付宝'}？`,
    success: async (res) => {
      if (res.confirm) {
        submitting.value = true
        try {
          await giftApi.withdraw({ amount: Number(amount.value) * 100, channel: method.value })
          uni.showToast({ title: '提现申请已提交', icon: 'success' })
          amount.value = null
          await walletStore.fetchBalance()
          setTimeout(() => uni.navigateBack(), 1000)
        } catch (e) {} finally {
          submitting.value = false
        }
      }
    }
  })
}

onShow(() => {
  walletStore.fetchBalance().catch(() => {})
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; padding: 32rpx; padding-bottom: 200rpx; }
.balance-card {
  background: linear-gradient(135deg, #171717 0%, #404040 100%);
  border-radius: 32rpx; padding: 48rpx 32rpx; margin-bottom: 32rpx;
  display: flex; flex-direction: column; align-items: center; gap: 8rpx;
}
.bal-label { font-size: 26rpx; color: #a3a3a3; }
.bal-num { font-size: 72rpx; font-weight: 700; color: #ffd60a; }
.bal-tip { font-size: 22rpx; color: #737373; }
.card { background: #ffffff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 24rpx; }
.card-title { font-size: 30rpx; font-weight: 600; color: #171717; margin-bottom: 24rpx; display: block; }
.input-row { display: flex; align-items: center; gap: 16rpx; margin-bottom: 24rpx; }
.cny { font-size: 48rpx; font-weight: 700; color: #171717; }
.amount-input {
  flex: 1; height: 96rpx; background: #f5f5f5; border-radius: 16rpx;
  padding: 0 24rpx; font-size: 40rpx; font-weight: 700; color: #171717;
}
.all-btn {
  padding: 0 24rpx; height: 72rpx; background: #fff9c4; color: #b45309;
  border-radius: 16rpx; display: flex; align-items: center; font-size: 26rpx; font-weight: 600;
}
.preview {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24rpx; background: #fffde6; border-radius: 16rpx;
}
.preview-label { font-size: 26rpx; color: #737373; }
.preview-amount { font-size: 32rpx; font-weight: 700; color: #171717; }
.methods { display: flex; flex-direction: column; }
.method {
  display: flex; align-items: center; gap: 16rpx; padding: 24rpx;
  border-radius: 16rpx; border: 4rpx solid transparent;
  &.on { background: #fffde6; border-color: #ffd60a; }
}
.m-icon { font-size: 40rpx; }
.m-name { flex: 1; font-size: 28rpx; color: #171717; }
.radio { width: 36rpx; height: 36rpx; border-radius: 9999rpx; border: 4rpx solid #d4d4d4; }
.radio.on { border-color: #ffd60a; background: #ffd60a; box-shadow: inset 0 0 0 6rpx #ffffff; }
.tips { padding: 8rpx 24rpx; display: flex; flex-direction: column; gap: 8rpx; }
.tips-title { font-size: 26rpx; font-weight: 600; color: #525252; margin-bottom: 8rpx; }
.tips-line { font-size: 24rpx; color: #a3a3a3; line-height: 1.6; }
.submit-btn {
  position: fixed; left: 32rpx; right: 32rpx; bottom: 48rpx;
  height: 96rpx; background: #ffd60a; color: #171717;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700;
  &:active { opacity: 0.85; }
  &.disabled { background: #e5e5e5; color: #a3a3a3; }
}
</style>
