<template>
  <view class="page">
    <!-- 余额 -->
    <view class="balance-card">
      <view class="bal-item">
        <text class="bal-num">{{ wallet.diamond }}</text>
        <text class="bal-label">钻石</text>
      </view>
      <view class="exchange-arrow">⇄</view>
      <view class="bal-item">
        <text class="bal-num">{{ wallet.starCoin }}</text>
        <text class="bal-label">星币</text>
      </view>
    </view>

    <!-- 兑换输入 -->
    <view class="card">
      <text class="card-title">钻石兑换星币</text>
      <view class="rate-tip">汇率：1 钻石 = 1 星币</view>
      <view class="input-row">
        <input
          v-model.number="amount"
          class="amount-input"
          type="number"
          placeholder="输入兑换数量"
        />
        <view class="max-btn" @tap="amount = wallet.diamond">全部</view>
      </view>
      <view class="preview">
        <text class="preview-label">兑换后获得</text>
        <text class="preview-amount">{{ amount || 0 }} 星币</text>
      </view>
    </view>

    <!-- 快捷金额 -->
    <view class="card">
      <text class="card-title">快捷兑换</text>
      <view class="quick-row">
        <view
          v-for="n in quickAmounts"
          :key="n"
          class="quick-item"
          :class="{ disabled: n > wallet.diamond }"
          @tap="onQuick(n)"
        >{{ n }}</view>
      </view>
    </view>

    <!-- 说明 -->
    <view class="tips">
      <text class="tips-title">说明</text>
      <text class="tips-line">· 钻石兑换星币即时到账，不可逆向</text>
      <text class="tips-line">· 兑换后可用于购买平台所有服务</text>
      <text class="tips-line">· 平台消费将按 20% 抽成计入服务者收入</text>
    </view>

    <!-- 提交 -->
    <view class="submit-btn" :class="{ disabled: !canSubmit }" @tap="onExchange">
      确认兑换
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useWalletStore } from '../../store/wallet'

const walletStore = useWalletStore()
const wallet = computed(() => ({
  diamond: walletStore.diamond,
  starCoin: walletStore.starCoin
}))

const amount = ref(null)
const quickAmounts = [10, 50, 100, 500, 1000, 3000]

const canSubmit = computed(() => {
  const a = Number(amount.value)
  return a > 0 && a <= wallet.value.diamond
})

const onQuick = (n) => {
  if (n > wallet.value.diamond) {
    uni.showToast({ title: '钻石余额不足', icon: 'none' })
    return
  }
  amount.value = n
}

const onExchange = async () => {
  if (!canSubmit.value) return
  uni.showModal({
    title: '确认兑换',
    content: `将 ${amount.value} 钻石兑换为 ${amount.value} 星币？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await walletStore.exchange(amount.value)
          uni.showToast({ title: '兑换成功', icon: 'success' })
          amount.value = null
          await walletStore.fetchBalance()
        } catch (e) {}
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
  display: flex; align-items: center; justify-content: space-around;
  background: linear-gradient(135deg, #171717 0%, #404040 100%);
  border-radius: 32rpx; padding: 48rpx 32rpx; margin-bottom: 32rpx;
}
.bal-item { display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.bal-num { font-size: 56rpx; font-weight: 700; color: #ffd60a; }
.bal-label { font-size: 24rpx; color: #a3a3a3; }
.exchange-arrow { font-size: 48rpx; color: #ffd60a; }
.card { background: #ffffff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 24rpx; }
.card-title { font-size: 30rpx; font-weight: 600; color: #171717; margin-bottom: 24rpx; display: block; }
.rate-tip { font-size: 24rpx; color: #737373; margin-bottom: 24rpx; }
.input-row { display: flex; align-items: center; gap: 16rpx; margin-bottom: 24rpx; }
.amount-input {
  flex: 1; height: 88rpx; background: #f5f5f5; border-radius: 16rpx;
  padding: 0 24rpx; font-size: 36rpx; font-weight: 700; color: #171717;
}
.max-btn {
  padding: 0 24rpx; height: 88rpx; background: #fff9c4; color: #b45309;
  border-radius: 16rpx; display: flex; align-items: center; font-size: 26rpx; font-weight: 600;
}
.preview {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24rpx; background: #fffde6; border-radius: 16rpx;
}
.preview-label { font-size: 26rpx; color: #737373; }
.preview-amount { font-size: 36rpx; font-weight: 700; color: #ef4444; }
.quick-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16rpx; }
.quick-item {
  height: 80rpx; background: #f5f5f5; border-radius: 16rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: 600; color: #171717;
  &:active { background: #e5e5e5; }
  &.disabled { color: #a3a3a3; background: #fafafa; }
}
.tips { background: #ffffff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 32rpx; display: flex; flex-direction: column; gap: 8rpx; }
.tips-title { font-size: 26rpx; font-weight: 600; color: #525252; margin-bottom: 8rpx; }
.tips-line { font-size: 24rpx; color: #737373; line-height: 1.6; }
.submit-btn {
  position: fixed; left: 32rpx; right: 32rpx; bottom: 48rpx;
  height: 96rpx; background: #ffd60a; color: #171717;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700;
  &:active { opacity: 0.85; }
  &.disabled { background: #e5e5e5; color: #a3a3a3; }
}
</style>
