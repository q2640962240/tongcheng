<template>
  <view class="gift-panel">
    <view class="gift-header">
      <text class="gift-title">送礼物</text>
      <text class="gift-balance">💎 {{ balance }}</text>
    </view>
    <scroll-view scroll-y class="gift-grid">
      <view
        v-for="gift in giftList"
        :key="gift.id"
        class="gift-item"
        :class="{ selected: selectedGift?.id === gift.id }"
        @click="selectGift(gift)"
      >
        <view class="gift-icon-wrap">
          <text v-if="isEmoji(gift.imageUrl)" class="gift-emoji">{{ gift.imageUrl }}</text>
          <image v-else class="gift-image" :src="gift.imageUrl" mode="aspectFit" />
        </view>
        <text class="gift-name">{{ gift.name }}</text>
        <text class="gift-price">{{ gift.price }}💎</text>
      </view>
      <view v-if="giftList.length === 0 && !loading" class="gift-empty">
        <text class="gift-empty-text">暂无礼物</text>
      </view>
    </scroll-view>
    <view class="gift-actions" v-if="selectedGift">
      <view
        class="gift-confirm"
        :class="{ disabled: balance < selectedGift.price }"
        @click="sendGift"
      >
        <text class="gift-confirm-text">
          送给TA {{ selectedGift.name }}（{{ selectedGift.price }}💎）
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from '../../../adapter-vue'
import TUIChatEngine, { TUIChatService, TUIStore, StoreName } from '@tencentcloud/chat-uikit-engine-lite'
import { giftApi, walletApi } from '@/api'
import { CHAT_MSG_CUSTOM_TYPE } from '../../../constant'

const props = defineProps({
  receiverId: { type: [String, Number], required: true }
})
const emit = defineEmits(['close', 'sent'])

const giftList = ref([])
const balance = ref(0)
const selectedGift = ref(null)
const loading = ref(true)
const currentUserProfile = ref(null)

onMounted(async () => {
  currentUserProfile.value = TUIStore.getData(StoreName.USER, 'userProfile')
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
})

const isEmoji = (str) => {
  if (!str) return false
  return !str.startsWith('http') && !str.startsWith('/') && !str.startsWith('data:')
}

const selectGift = (gift) => {
  selectedGift.value = selectedGift.value?.id === gift.id ? null : gift
}

const sendGift = async () => {
  if (!selectedGift.value) return
  if (balance.value < selectedGift.value.price) {
    uni.showToast({ title: '钻石不足，请充值', icon: 'none' })
    return
  }
  const gift = selectedGift.value
  try {
    const sendRes = await giftApi.send({
      receiverId: props.receiverId,
      giftId: gift.id,
      viaIM: true
    })
    balance.value -= gift.price

    const giftData = (sendRes && sendRes.data) || {}
    const payload = {
      data: JSON.stringify({
        businessID: CHAT_MSG_CUSTOM_TYPE.GIFT,
        giftName: gift.name,
        giftImage: gift.imageUrl,
        diamondAmount: gift.price,
        animationLevel: giftData.animationLevel || gift.animationLevel || 1,
        senderName: currentUserProfile.value?.nick || currentUserProfile.value?.userID || '',
      }),
      description: `送出了${gift.name}`,
      extension: `送出了${gift.name}`,
    }
    const options = {
      to: String(props.receiverId),
      conversationType: TUIChatEngine.TYPES.CONV_C2C,
      payload,
      needReadReceipt: false,
    }
    try {
      await TUIChatService.sendCustomMessage(options)
    } catch (imErr) {
      console.warn('[Gift] IM消息发送失败，礼物已扣费', imErr)
    }

    uni.showToast({ title: '礼物已送出', icon: 'success' })
    selectedGift.value = null
    emit('sent', { ...gift, animationLevel: giftData.animationLevel || gift.animationLevel || 1 })
  } catch (e) {
    uni.showToast({ title: e.message || '发送失败', icon: 'none' })
  }
}
</script>

<style scoped lang="scss">
.gift-panel {
  display: flex;
  flex-direction: column;
  height: 60vh;
  background: #1A2238;
  border-radius: 16px 16px 0 0;
  overflow: hidden;
}

.gift-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.gift-title {
  font-size: 17px;
  font-weight: 600;
  color: #F5F7FF;
}

.gift-balance {
  font-size: 15px;
  color: #FFD700;
  font-weight: 500;
}

.gift-grid {
  flex: 1;
  padding: 12px 12px 0;
  overflow-y: auto;
}

.gift-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}

.gift-empty-text {
  color: #7E88AA;
  font-size: 14px;
}

/* 用 flex wrap 模拟网格，每行4个 */
.gift-grid {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px;
}

.gift-item {
  width: calc(25% - 3px);
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

.gift-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  overflow: hidden;
}

.gift-emoji {
  font-size: 28px;
  line-height: 1;
}

.gift-image {
  width: 40px;
  height: 40px;
}

.gift-name {
  font-size: 12px;
  color: #F5F7FF;
  text-align: center;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.gift-price {
  font-size: 11px;
  color: #7E88AA;
  margin-top: 2px;
}

.gift-actions {
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, transparent, rgba(11, 15, 26, 0.6) 30%);
}

.gift-confirm {
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

.gift-confirm-text {
  font-size: 15px;
  font-weight: 600;
  color: #1A1A2E;
}
</style>
