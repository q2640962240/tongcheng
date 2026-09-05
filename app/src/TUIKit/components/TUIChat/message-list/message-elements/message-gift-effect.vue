<template>
  <view v-if="visible" class="gift-effect-overlay" @click="dismiss">
    <view class="gift-effect-content" :class="{ 'gift-effect-animate': animate }">
      <image class="gift-effect-image" :src="giftData.giftImage" mode="aspectFit" />
      <text class="gift-effect-label">{{ giftData.giftName }}</text>
      <text class="gift-effect-sub">收到礼物 💎 {{ giftData.diamondAmount }}</text>
    </view>
    <!-- 粒子光效 -->
    <view class="gift-particles">
      <view v-for="i in 8" :key="i" class="gift-particle" :style="particleStyle(i)"></view>
    </view>
  </view>
</template>

<script setup>
import { ref, onUnmounted } from '../../../../adapter-vue'

const visible = ref(false)
const animate = ref(false)
const giftData = ref({ giftName: '', giftImage: '', diamondAmount: 0 })
let hideTimer = null

const show = (data) => {
  giftData.value = data
  visible.value = true
  requestAnimationFrame(() => {
    animate.value = true
  })
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    dismiss()
  }, 2200)
}

const dismiss = () => {
  animate.value = false
  setTimeout(() => {
    visible.value = false
  }, 300)
}

const particleStyle = (i) => {
  const angle = (i - 1) * 45
  const delay = (i - 1) * 0.08
  return {
    '--angle': `${angle}deg`,
    '--delay': `${delay}s`,
  }
}

onUnmounted(() => {
  clearTimeout(hideTimer)
})

defineExpose({ show })
</script>

<style scoped lang="scss">
.gift-effect-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: rgba(11, 15, 26, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlay-in 0.3s ease;
}

@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.gift-effect-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: scale(0.3);
  opacity: 0;
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

  &.gift-effect-animate {
    transform: scale(1);
    opacity: 1;
  }
}

.gift-effect-image {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  box-shadow:
    0 0 40px rgba(255, 215, 0, 0.6),
    0 0 80px rgba(255, 215, 0, 0.3);
  animation: glow-pulse 1.2s ease-in-out infinite alternate;
}

@keyframes glow-pulse {
  from {
    box-shadow:
      0 0 40px rgba(255, 215, 0, 0.6),
      0 0 80px rgba(255, 215, 0, 0.3);
  }
  to {
    box-shadow:
      0 0 60px rgba(255, 215, 0, 0.8),
      0 0 120px rgba(255, 215, 0, 0.4);
  }
}

.gift-effect-label {
  margin-top: 16px;
  font-size: 22px;
  font-weight: 700;
  color: #FFD700;
  text-shadow: 0 2px 12px rgba(255, 215, 0, 0.5);
}

.gift-effect-sub {
  margin-top: 8px;
  font-size: 15px;
  color: #F5F7FF;
  opacity: 0.85;
}

/* 粒子光效 */
.gift-particles {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
}

.gift-particle {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #FFD700;
  animation: particle-fly 1.5s ease-out forwards;
  animation-delay: var(--delay, 0s);
  transform: rotate(var(--angle, 0deg)) translateX(0);
  opacity: 0;
}

@keyframes particle-fly {
  0% {
    transform: rotate(var(--angle, 0deg)) translateX(0);
    opacity: 1;
  }
  100% {
    transform: rotate(var(--angle, 0deg)) translateX(160px);
    opacity: 0;
  }
}
</style>
