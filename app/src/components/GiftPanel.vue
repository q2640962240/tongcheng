<template>
  <view class="gift-panel-mask" v-if="visible" @click.self="$emit('close')">
    <view class="gift-panel">
      <view class="gift-panel-header">
        <text class="gift-panel-title">送礼物</text>
        <view class="gift-panel-right">
          <text class="gift-panel-balance">💎 {{ balance }}</text>
          <text class="gift-panel-close" @click="$emit('close')">✕</text>
        </view>
      </view>

      <scroll-view scroll-y class="gift-panel-grid">
        <view
          v-for="gift in giftList"
          :key="gift.id"
          class="gift-panel-item"
          :class="{ selected: selectedGift?.id === gift.id }"
          @click="selectGift(gift)"
        >
          <view class="gift-panel-icon-wrap">
            <text v-if="isEmoji(gift.imageUrl)" class="gift-panel-emoji">{{ gift.imageUrl }}</text>
            <image v-else class="gift-panel-img" :src="gift.imageUrl" mode="aspectFit" />
          </view>
          <text class="gift-panel-name">{{ gift.name }}</text>
          <text class="gift-panel-price">{{ gift.price }}💎</text>
        </view>
        <view v-if="giftList.length === 0 && !loading" class="gift-panel-empty">
          <text class="gift-panel-empty-text">暂无礼物</text>
        </view>
      </scroll-view>

      <view class="gift-panel-footer" v-if="selectedGift">
        <view class="gift-panel-qty">
          <view
            v-for="q in qtyOptions"
            :key="q"
            class="gift-panel-qty-chip"
            :class="{ active: quantity === q }"
            @click="quantity = q"
          >
            <text class="gift-panel-qty-text">×{{ q }}</text>
          </view>
        </view>
        <view
          class="gift-panel-send"
          :class="{ disabled: balance < selectedGift.price * quantity }"
          @click="sendGift"
        >
          <text class="gift-panel-send-text">
            送给TA {{ selectedGift.name }}{{ quantity > 1 ? ' ×' + quantity : '' }}（{{ selectedGift.price * quantity }}💎）
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { giftApi, walletApi } from '@/api'

const props = defineProps({
  receiverId: { type: [String, Number], required: true },
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'sent'])

const giftList = ref([])
const balance = ref(0)
const selectedGift = ref(null)
const loading = ref(false)
const quantity = ref(1)
const qtyOptions = [1, 5, 10, 66]

const isEmoji = (str) => {
  if (!str) return false
  return !str.startsWith('http') && !str.startsWith('/') && !str.startsWith('data:')
}

const loadData = async () => {
  loading.value = true
  try {
    const [giftsRes, balanceRes] = await Promise.all([
      giftApi.list(),
      walletApi.balance()
    ])
    giftList.value = giftsRes.data?.list || giftsRes.data || []
    balance.value = balanceRes.data?.diamond || 0
  } catch (e) {
    console.error('加载礼物失败', e)
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (v) => {
  if (v) loadData()
})

const selectGift = (gift) => {
  if (selectedGift.value?.id === gift.id) {
    selectedGift.value = null
  } else {
    selectedGift.value = gift
    quantity.value = 1
  }
}

const sendGift = async () => {
  if (!selectedGift.value) return
  const total = selectedGift.value.price * quantity.value
  if (balance.value < total) {
    uni.showToast({ title: '钻石不足，请充值', icon: 'none' })
    setTimeout(() => uni.navigateTo({ url: '/pages/recharge/recharge' }), 1500)
    return
  }
  try {
    const res = await giftApi.send({
      receiverId: props.receiverId,
      giftId: selectedGift.value.id,
      quantity: quantity.value,
      viaIM: false
    })
    balance.value -= total
    const data = res.data || {}
    emit('sent', {
      ...selectedGift.value,
      quantity: quantity.value,
      totalDiamond: data.diamondAmount || total,
      animationLevel: data.animationLevel || selectedGift.value.animationLevel || 1,
      messageId: data.messageId
    })
    uni.showToast({ title: '礼物已送出', icon: 'success' })
    selectedGift.value = null
  } catch (e) {
    uni.showToast({ title: e.message || '发送失败', icon: 'none' })
  }
}
</script>

<style scoped lang="scss">
.gift-panel-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}

.gift-panel {
  width: 100%;
  max-height: 65vh;
  background: #1A2238;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.gift-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.gift-panel-title {
  font-size: 17px;
  font-weight: 600;
  color: #F5F7FF;
}

.gift-panel-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gift-panel-balance {
  font-size: 15px;
  color: #FFD700;
  font-weight: 500;
}

.gift-panel-close {
  font-size: 18px;
  color: #7E88AA;
  padding: 4px 8px;
}

.gift-panel-grid {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
  max-height: 45vh;
}

.gift-panel-empty {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.gift-panel-empty-text {
  color: #7E88AA;
  font-size: 14px;
}

.gift-panel-item {
  width: calc(25% - 6px);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 2px solid transparent;
  transition: all 0.2s ease;

  &.selected {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.08);
  }

  &:active {
    transform: scale(0.95);
  }
}

.gift-panel-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  overflow: hidden;
}

.gift-panel-emoji {
  font-size: 26px;
  line-height: 1;
}

.gift-panel-img {
  width: 36px;
  height: 36px;
}

.gift-panel-name {
  font-size: 12px;
  color: #F5F7FF;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.gift-panel-price {
  font-size: 11px;
  color: #7E88AA;
  margin-top: 2px;
}

.gift-panel-footer {
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.gift-panel-qty {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.gift-panel-qty-chip {
  padding: 4px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid transparent;
  transition: all 0.15s;

  &.active {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.1);
  }
}

.gift-panel-qty-text {
  font-size: 13px;
  color: #F5F7FF;
}

.gift-panel-send {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border-radius: 22px;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  transition: all 0.2s ease;

  &.disabled {
    opacity: 0.5;
  }

  &:active {
    transform: scale(0.97);
  }
}

.gift-panel-send-text {
  font-size: 15px;
  font-weight: 600;
  color: #1A1A2E;
}
</style>
