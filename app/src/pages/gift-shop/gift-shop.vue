<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="nav-bar">
      <view class="nav-back" @tap="onBack">‹</view>
      <text class="nav-title">礼物商城</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 钱包卡片 -->
    <view class="wallet-section">
      <view class="wallet-card">
        <view class="wallet-item">
          <view class="wallet-icon-wrap diamond-bg">
            <text class="wallet-icon">💎</text>
          </view>
          <view class="wallet-info">
            <text class="wallet-label">钻石余额</text>
            <text class="wallet-value">{{ diamond }}</text>
          </view>
          <view class="wallet-action" @tap="goRecharge">
            <text class="wallet-action-text">充值</text>
          </view>
        </view>
        <view class="wallet-divider"></view>
        <view class="wallet-item">
          <view class="wallet-icon-wrap income-bg">
            <text class="wallet-icon">🎁</text>
          </view>
          <view class="wallet-info">
            <text class="wallet-label">礼物收入</text>
            <text class="wallet-value">{{ giftIncomeYuan }}</text>
          </view>
          <view class="wallet-action" @tap="goWithdraw">
            <text class="wallet-action-text">提现</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 礼物列表 -->
    <view class="section">
      <text class="section-title">全部礼物</text>
      <view v-if="loading" class="loading-wrap">
        <text class="loading-text">加载中...</text>
      </view>
      <view v-else-if="gifts.length" class="gift-grid">
        <view
          v-for="gift in gifts"
          :key="gift.id"
          class="gift-card"
          @tap="onGiftTap(gift)"
        >
          <view class="gift-icon-wrap">
            <text v-if="isEmoji(gift.imageUrl)" class="gift-emoji">{{ gift.imageUrl }}</text>
            <image v-else class="gift-image" :src="gift.imageUrl" mode="aspectFit" />
          </view>
          <text class="gift-name">{{ gift.name }}</text>
          <view class="gift-price">
            <text class="gift-price-icon">💎</text>
            <text class="gift-price-num">{{ gift.price }}</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-wrap">
        <text class="empty-text">暂无礼物</text>
      </view>
    </view>

    <!-- 底部提示 -->
    <view class="bottom-tip">
      <text class="bottom-tip-icon">💡</text>
      <text class="bottom-tip-text">在聊天中点击 🎁 按钮即可给好友送礼物</text>
    </view>

    <!-- 礼物详情弹窗 -->
    <view v-if="showDetail" class="overlay" @tap.self="showDetail = false">
      <view class="detail-sheet">
        <view class="detail-close" @tap="showDetail = false">✕</view>
        <view v-if="isEmoji(selectedGift.imageUrl)" class="detail-emoji-wrap">
          <text class="detail-emoji">{{ selectedGift.imageUrl }}</text>
        </view>
        <image v-else class="detail-image" :src="selectedGift.imageUrl" mode="aspectFit" />
        <text class="detail-name">{{ selectedGift.name }}</text>
        <view class="detail-price-row">
          <text class="detail-price-icon">💎</text>
          <text class="detail-price-num">{{ selectedGift.price }}</text>
        </view>
        <view class="detail-hint">
          <text class="detail-hint-text">{{ receiverId ? '点击下方按钮直接在聊天中发送此礼物给TA' : '前往聊天页面，点击礼物按钮即可发送此礼物给好友' }}</text>
        </view>
        <view class="detail-btn" @tap="goChat">
          <text class="detail-btn-text">{{ receiverId ? '发送给TA' : '去聊天中发送' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { giftApi } from '@/api'
import { useWalletStore } from '@/store/wallet'

const walletStore = useWalletStore()

const diamond = computed(() => walletStore.diamond)
const giftIncome = ref(0)
const gifts = ref([])
const loading = ref(true)
const showDetail = ref(false)
const selectedGift = ref({})
const receiverId = ref('')

onLoad((options) => {
  if (options?.receiverId) {
    receiverId.value = options.receiverId
  }
})

/** 礼物收入转元显示（后端单位：分） */
const giftIncomeYuan = computed(() => {
  const fen = giftIncome.value || 0
  return (fen / 100).toFixed(2)
})

/** 返回 */
const onBack = () => {
  uni.navigateBack({ delta: 1 })
}

/** 加载礼物列表 */
const loadGifts = async () => {
  loading.value = true
  try {
    const res = await giftApi.list()
    gifts.value = res.data || []
  } catch (e) {
    console.warn('加载礼物列表失败', e)
  } finally {
    loading.value = false
  }
}

/** 加载礼物收入 */
const loadIncome = async () => {
  try {
    const res = await giftApi.income()
    giftIncome.value = res.data?.giftIncome || 0
  } catch (e) {
    console.warn('加载礼物收入失败', e)
  }
}

/** 点击礼物卡片 */
const onGiftTap = (gift) => {
  selectedGift.value = gift
  showDetail.value = true
}

/** 跳转充值 */
const goRecharge = () => {
  uni.navigateTo({ url: '/pages/recharge/recharge' })
}

/** 跳转提现 */
const goWithdraw = () => {
  uni.navigateTo({ url: '/pages/withdraw/withdraw' })
}

/** 判断是否为 emoji 字符串（非图片 URL） */
const isEmoji = (str) => {
  if (!str) return false
  return !str.startsWith('http') && !str.startsWith('/') && !str.startsWith('data:')
}

/** 跳转聊天 */
const goChat = () => {
  showDetail.value = false
  if (receiverId.value) {
    uni.navigateTo({ url: `/pages/chat/chat?userId=${receiverId.value}` })
  } else {
    uni.switchTab({ url: '/TUIKit/components/TUIConversation/index' })
  }
}

/** 页面显示时刷新数据 */
onShow(() => {
  walletStore.fetchBalance().catch(() => {})
  loadGifts()
  loadIncome()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: $by-bg;
  padding-bottom: env(safe-area-inset-bottom);
}

/* ===== 导航栏 ===== */
.nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: env(safe-area-inset-top) $by-page-pad-x 0;
  height: calc($by-topbar-h + env(safe-area-inset-top));
  position: sticky; top: 0; z-index: 20;
  background: $by-bg;
  border-bottom: 1rpx solid $by-border;
}
.nav-back {
  font-size: 56rpx; color: $by-text-1; font-weight: 300;
  width: 64rpx; text-align: center; line-height: 1;
}
.nav-title { font-size: 34rpx; font-weight: 700; color: $by-text-1; }
.nav-placeholder { width: 64rpx; }

/* ===== 钱包卡片 ===== */
.wallet-section {
  padding: 24rpx $by-page-pad-x 0;
}
.wallet-card {
  background: linear-gradient(135deg, $by-bg-soft 0%, $by-surface 100%);
  border-radius: 32rpx;
  padding: 36rpx 32rpx;
  border: 1rpx solid $by-border;
  box-shadow: $by-shadow-2;
}
.wallet-item {
  display: flex; align-items: center; gap: 20rpx;
}
.wallet-icon-wrap {
  width: 72rpx; height: 72rpx; border-radius: 20rpx;
  display: flex; align-items: center; justify-content: center;
}
.diamond-bg { background: color.adjust($by-aurora-c, $alpha: -0.75); }
.income-bg { background: color.adjust($by-gold, $alpha: -0.78); }
.wallet-icon { font-size: 36rpx; }
.wallet-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.wallet-label { font-size: 24rpx; color: $by-text-3; }
.wallet-value { font-size: 44rpx; font-weight: 700; color: $by-text-1; }
.wallet-action {
  background: $by-surface-2;
  border: 1rpx solid $by-border-strong;
  border-radius: $by-radius-pill;
  padding: 12rpx 32rpx;
}
.wallet-action:active { opacity: 0.7; }
.wallet-action-text { font-size: 26rpx; color: $by-gold-soft; font-weight: 600; }
.wallet-divider {
  height: 1rpx; background: $by-border;
  margin: 28rpx 0;
}

/* ===== 礼物列表 ===== */
.section {
  padding: 32rpx $by-page-pad-x 0;
}
.section-title {
  font-size: 30rpx; font-weight: 600; color: $by-text-1;
  margin-bottom: 24rpx; display: block;
}
.gift-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
}
.gift-card {
  background: $by-surface;
  border-radius: $by-radius-lg;
  padding: 24rpx 12rpx 20rpx;
  display: flex; flex-direction: column; align-items: center; gap: 12rpx;
  border: 1rpx solid $by-border;
  transition: all 0.15s ease;

  &:active {
    background: $by-surface-2;
    border-color: $by-border-strong;
    transform: scale(0.97);
  }
}
.gift-icon-wrap {
  width: 120rpx; height: 120rpx;
  border-radius: 50%;
  background: $by-surface-2;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.gift-emoji {
  font-size: 64rpx;
  line-height: 1;
}
.gift-image {
  width: 120rpx; height: 120rpx;
}
.gift-name {
  font-size: 26rpx; color: $by-text-1; font-weight: 500;
  text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 100%;
}
.gift-price {
  display: flex; align-items: center; gap: 4rpx;
}
.gift-price-icon { font-size: 22rpx; }
.gift-price-num { font-size: 26rpx; color: $by-gold-soft; font-weight: 600; }

/* ===== 加载/空态 ===== */
.loading-wrap, .empty-wrap {
  display: flex; justify-content: center; padding: 80rpx 0;
}
.loading-text, .empty-text {
  font-size: 28rpx; color: $by-text-3;
}

/* ===== 底部提示 ===== */
.bottom-tip {
  display: flex; align-items: center; justify-content: center;
  gap: 8rpx; padding: 48rpx $by-page-pad-x 40rpx;
}
.bottom-tip-icon { font-size: 28rpx; }
.bottom-tip-text { font-size: 24rpx; color: $by-text-3; }

/* ===== 礼物详情弹窗 ===== */
.overlay {
  position: fixed; inset: 0; z-index: 100;
  background: #000000AA;
  display: flex; align-items: flex-end; justify-content: center;
}
.detail-sheet {
  width: 100%;
  background: $by-surface;
  border-radius: 40rpx 40rpx 0 0;
  padding: 48rpx $by-page-pad-x calc(48rpx + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; align-items: center; gap: 20rpx;
  position: relative;
}
.detail-close {
  position: absolute; top: 24rpx; right: 32rpx;
  font-size: 36rpx; color: $by-text-3;
  width: 56rpx; height: 56rpx;
  display: flex; align-items: center; justify-content: center;
}
.detail-emoji-wrap {
  width: 240rpx; height: 240rpx;
  display: flex; align-items: center; justify-content: center;
  background: $by-surface-2;
  border-radius: 50%;
  margin-top: 12rpx;
}
.detail-emoji {
  font-size: 120rpx;
  line-height: 1;
}
.detail-image {
  width: 240rpx; height: 240rpx;
  margin-top: 12rpx;
}
.detail-name {
  font-size: 36rpx; font-weight: 700; color: $by-text-1;
}
.detail-price-row {
  display: flex; align-items: center; gap: 8rpx;
}
.detail-price-icon { font-size: 32rpx; }
.detail-price-num { font-size: 40rpx; font-weight: 700; color: $by-gold-soft; }
.detail-hint {
  background: $by-surface-2;
  border-radius: $by-radius-md;
  padding: 20rpx 28rpx;
  width: 100%;
}
.detail-hint-text {
  font-size: 24rpx; color: $by-text-3; line-height: 1.6;
  text-align: center;
}
.detail-btn {
  width: 100%;
  height: 88rpx;
  background: $by-gradient-gold;
  border-radius: $by-radius-pill;
  display: flex; align-items: center; justify-content: center;
  margin-top: 8rpx;
  box-shadow: $by-shadow-gold;

  &:active { opacity: 0.85; }
}
.detail-btn-text {
  font-size: 32rpx; font-weight: 700; color: $by-bg;
}
</style>
