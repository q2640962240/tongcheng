<template>
  <view class="gift-panel-mask" v-if="visible" @click.self="$emit('close')">
    <view class="gift-panel">
      <view class="gift-panel-header">
        <text class="gift-panel-title">送礼物</text>
        <view class="gift-panel-right">
          <view class="gift-panel-balance-wrap">
            <text class="gift-panel-balance-icon">💎</text>
            <text class="gift-panel-balance">{{ balance }}</text>
          </view>
          <text class="gift-panel-close" @click="$emit('close')">✕</text>
        </view>
      </view>

      <scroll-view scroll-y class="gift-panel-body">
        <view v-for="section in giftSections" :key="section.key" class="gift-section">
          <view class="gift-section-header">
            <text class="gift-section-icon">{{ section.icon }}</text>
            <text class="gift-section-title">{{ section.title }}</text>
          </view>
          <view class="gift-panel-grid">
            <view
              v-for="gift in section.items"
              :key="gift.id"
              class="gift-panel-item"
              :class="{ selected: selectedGift?.id === gift.id }"
              @click="selectGift(gift)"
            >
              <view class="gift-panel-icon-wrap" :class="'tier-' + giftTier(gift)">
                <text v-if="isEmoji(gift.imageUrl)" class="gift-panel-emoji">{{ gift.imageUrl }}</text>
                <image v-else class="gift-panel-img" :src="gift.imageUrl" mode="aspectFit" />
              </view>
              <text class="gift-panel-name">{{ gift.name }}</text>
              <text class="gift-panel-price">{{ gift.price }}💎</text>
            </view>
          </view>
        </view>

        <view v-if="giftList.length === 0 && !loading" class="gift-panel-empty">
          <text class="gift-panel-empty-text">暂无礼物</text>
        </view>
      </scroll-view>

      <view class="gift-panel-footer">
        <view class="gift-panel-qty-row" v-if="selectedGift">
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
          <text v-if="quantity >= 10" class="gift-panel-combo-hint">连击有特效加成!</text>
        </view>
        <view
          class="gift-panel-send"
          :class="{ disabled: !selectedGift || sending || balance < selectedGift.price * quantity }"
          @click="sendGift"
        >
          <text class="gift-panel-send-text">
            {{ selectedGift ? '送给TA ' + selectedGift.name + (quantity > 1 ? ' ×' + quantity : '') + '（' + selectedGift.price * quantity + '💎）' : (sending ? '正在送出…' : '请先选择礼物') }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
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
const sending = ref(false)
const qtyOptions = [1, 5, 10, 66]

const isEmoji = (str) => {
  if (!str) return false
  return !str.startsWith('http') && !str.startsWith('/') && !str.startsWith('data:')
}

const giftTier = (gift) => {
  const p = gift.price || 0
  if (p >= 500) return 'luxury'
  if (p >= 100) return 'hot'
  return 'normal'
}

const giftSections = computed(() => {
  const sections = []
  const luxury = giftList.value.filter(g => g.price >= 500)
  const hot = giftList.value.filter(g => g.price >= 100 && g.price < 500)
  const normal = giftList.value.filter(g => g.price < 100)
  if (normal.length) sections.push({ key: 'normal', title: '心意小礼', icon: '🎀', items: normal })
  if (hot.length) sections.push({ key: 'hot', title: '人气好礼', icon: '🔥', items: hot })
  if (luxury.length) sections.push({ key: 'luxury', title: '豪华臻礼', icon: '👑', items: luxury })
  return sections
})

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

onMounted(() => {
  if (props.visible) loadData()
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
  if (!selectedGift.value || sending.value) return
  const total = selectedGift.value.price * quantity.value
  if (balance.value < total) {
    uni.showToast({ title: '钻石不足，请充值', icon: 'none' })
    setTimeout(() => uni.navigateTo({ url: '/pages/recharge/recharge' }), 1500)
    return
  }
  sending.value = true
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
  } finally {
    sending.value = false
  }
}
</script>

<style scoped lang="scss">
.gift-panel-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}

.gift-panel {
  width: 100%;
  max-height: 68vh;
  background: linear-gradient(180deg, #1E2845 0%, #1A2238 100%);
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.gift-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.gift-panel-title {
  font-size: 18px;
  font-weight: 700;
  color: #F5F7FF;
}

.gift-panel-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gift-panel-balance-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 14px;
  border: 1px solid rgba(255, 215, 0, 0.2);
}

.gift-panel-balance-icon {
  font-size: 14px;
}

.gift-panel-balance {
  font-size: 15px;
  color: #FFD700;
  font-weight: 600;
}

.gift-panel-close {
  font-size: 18px;
  color: #7E88AA;
  padding: 4px 8px;
}

.gift-panel-body {
  box-sizing: border-box;
  flex: 1;
  /* 不能用 max-height 钉死：footer 出现时总高会超出面板 max-height 而被裁掉赠送按钮。
     min-height:0 让 flex 在 footer 出现时自动压缩滚动区，内部滚动才生效 */
  min-height: 0;
  padding: 0 16px 12px;
}

.gift-section {
  padding-top: 14px;
}

.gift-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.gift-section-icon {
  font-size: 16px;
}

.gift-section-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(245, 247, 255, 0.7);
}

.gift-panel-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
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
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 4px 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 2px solid transparent;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);

  &.selected {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.1);
    box-shadow: 0 0 16px rgba(255, 215, 0, 0.25);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.93);
  }
}

.gift-panel-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  overflow: hidden;
  transition: all 0.25s ease;

  &.tier-normal {
    background: rgba(255, 255, 255, 0.06);
  }

  &.tier-hot {
    background: rgba(255, 140, 0, 0.12);
    box-shadow: 0 0 8px rgba(255, 140, 0, 0.15);
  }

  &.tier-luxury {
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(180, 100, 255, 0.12));
    box-shadow: 0 0 12px rgba(255, 215, 0, 0.2);
  }

  .selected & {
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
  }
}

.gift-panel-emoji {
  font-size: 30px;
  line-height: 1;
}

.gift-panel-img {
  width: 44px;
  height: 44px;
}

.gift-panel-name {
  font-size: 12px;
  color: #F5F7FF;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  font-weight: 500;
}

.gift-panel-price {
  font-size: 11px;
  color: rgba(255, 215, 0, 0.72);
  margin-top: 3px;
  font-weight: 600;
}

.gift-panel-footer {
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(11, 15, 26, 0.4);
}

.gift-panel-qty-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.gift-panel-qty {
  display: flex;
  gap: 8px;
}

.gift-panel-qty-chip {
  padding: 5px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid transparent;
  transition: all 0.2s ease;

  &.active {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.12);
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.15);
  }
}

.gift-panel-qty-text {
  font-size: 13px;
  color: #F5F7FF;
  font-weight: 500;
}

.gift-panel-combo-hint {
  font-size: 12px;
  color: #FF6B6B;
  font-weight: 600;
  animation: hintPulse 1s ease-in-out infinite;
}

@keyframes hintPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.gift-panel-send {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  border-radius: 23px;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  box-shadow: 0 4px 16px rgba(255, 165, 0, 0.35);
  transition: all 0.2s ease;

  &.disabled {
    opacity: 0.4;
    box-shadow: none;
  }

  &:active {
    transform: scale(0.97);
  }
}

.gift-panel-send-text {
  font-size: 15px;
  font-weight: 700;
  color: #1A1A2E;
}
</style>
