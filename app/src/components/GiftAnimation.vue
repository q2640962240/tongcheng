<template>
  <view class="gift-anim-layer" v-if="current.id">
    <view class="gift-anim-content" :key="current.id" :class="'gift-anim-l' + current.level">
      <view v-if="current.level >= 2" class="gift-bg-overlay"></view>

      <view v-if="current.level >= 1" class="gift-l1">
        <view class="gift-l1-banner">
          <view class="gift-l1-shimmer"></view>
          <text v-if="current.isEmoji" class="gift-l1-emoji">{{ current.image }}</text>
          <image v-else class="gift-l1-img" :src="current.image" mode="aspectFit" />
          <view class="gift-l1-info">
            <text class="gift-l1-sender">{{ current.senderName || '神秘人' }}</text>
            <text class="gift-l1-action">送出 {{ current.giftName }}{{ current.quantity > 1 ? ' ×' + current.quantity : '' }}</text>
          </view>
        </view>
      </view>

      <view v-if="current.level >= 2" class="gift-l2">
        <view class="gift-l2-pillar"></view>
        <view class="gift-l2-ring"></view>
        <view v-for="i in 8" :key="'s'+i" class="gift-l2-star" :style="starStyle(i, 8)"></view>
        <view class="gift-l2-center">
          <text v-if="current.isEmoji" class="gift-l2-emoji">{{ current.image }}</text>
          <image v-else class="gift-l2-img" :src="current.image" mode="aspectFit" />
        </view>
      </view>

      <view v-if="current.level >= 3" class="gift-l3">
        <view class="gift-l3-flash"></view>
        <view v-for="i in 24" :key="'p'+i" class="gift-l3-particle" :style="particleStyle(i)"></view>
        <view v-for="i in 6" :key="'f'+i" class="gift-l3-firework" :style="fireworkStyle(i)"></view>
        <view class="gift-l3-center">
          <view class="gift-l3-halo"></view>
          <text v-if="current.isEmoji" class="gift-l3-emoji">{{ current.image }}</text>
          <image v-else class="gift-l3-img" :src="current.image" mode="aspectFit" />
        </view>
        <view class="gift-l3-bottom-banner">
          <view class="gift-l3-bottom-shimmer"></view>
          <text class="gift-l3-bottom-text">{{ current.senderName || '神秘人' }} 送出 {{ current.giftName }}{{ current.quantity > 1 ? ' ×' + current.quantity : '' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'

const queue = ref([])
const current = ref({})
const playing = ref(false)
let timerId = null
const MAX_QUEUE = 5

const durations = { 0: 0, 1: 2500, 2: 3500, 3: 5000 }

const isEmojiStr = (s) => {
  if (!s) return true
  return !s.startsWith('http') && !s.startsWith('/') && !s.startsWith('data:')
}

const play = (gift) => {
  const level = gift.animationLevel || 1
  if (level <= 0) return
  const imgUrl = gift.imageUrl || gift.giftImage || '🎁'
  if (queue.value.length >= MAX_QUEUE) {
    queue.value.shift()
  }
  queue.value.push({
    id: Date.now() + Math.random(),
    level,
    image: imgUrl,
    isEmoji: isEmojiStr(imgUrl),
    giftName: gift.giftName || gift.name || '礼物',
    senderName: gift.senderName || '',
    quantity: gift.quantity || 1
  })
}

const starStyle = (i, total) => {
  const angle = ((i - 1) / total) * 360
  const delay = ((i - 1) * 0.15).toFixed(2)
  return {
    '--star-angle': `${angle}deg`,
    '--star-delay': `${delay}s`,
  }
}

const particleStyle = (i) => {
  const angle = ((i - 1) / 24) * 360
  const delay = ((i - 1) * 0.06).toFixed(2)
  const distance = 120 + Math.floor((i % 5) * 30)
  const size = 4 + (i % 4) * 2
  return {
    '--p-angle': `${angle}deg`,
    '--p-delay': `${delay}s`,
    '--p-distance': `${distance}px`,
    '--p-size': `${size}px`,
  }
}

const fireworkStyle = (i) => {
  const x = 10 + ((i - 1) % 3) * 35
  const y = 10 + Math.floor((i - 1) / 3) * 40
  const delay = ((i - 1) * 0.3).toFixed(1)
  return {
    '--fw-x': `${x}%`,
    '--fw-y': `${y}%`,
    '--fw-delay': `${delay}s`,
  }
}

const clearTimer = () => {
  if (timerId) {
    clearTimeout(timerId)
    timerId = null
  }
}

watch(queue, (q) => {
  if (q.length > 0 && !playing.value) {
    playNext()
  }
}, { deep: true })

const playNext = () => {
  clearTimer()
  if (queue.value.length === 0) {
    playing.value = false
    current.value = {}
    return
  }
  playing.value = true
  current.value = queue.value[0]
  const dur = durations[current.value.level] || 2500
  timerId = setTimeout(() => {
    queue.value.shift()
    if (queue.value.length > 0) {
      playNext()
    } else {
      playing.value = false
      current.value = {}
    }
  }, dur)
}

onUnmounted(() => {
  clearTimer()
  queue.value = []
  current.value = {}
  playing.value = false
})

defineExpose({ play })
</script>

<style scoped lang="scss">
.gift-anim-layer {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
}

.gift-anim-content {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  animation: giftContainerIn 0.35s ease-out;
}

@keyframes giftContainerIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.gift-bg-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(ellipse at center, rgba(11, 15, 26, 0.6) 0%, rgba(11, 15, 26, 0.3) 60%, transparent 100%);
  animation: bgFadeIn 0.5s ease-out;
}

@keyframes bgFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ========== L1: 左侧滑入信息条 ========== */
.gift-l1 {
  position: absolute;
  bottom: 140px;
  left: 16px;
  animation: l1BannerIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.gift-l1-banner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px 10px 12px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.95), rgba(255, 165, 0, 0.9), rgba(255, 140, 0, 0.85));
  border-radius: 28px;
  box-shadow:
    0 4px 24px rgba(255, 165, 0, 0.5),
    0 0 0 1px rgba(255, 215, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  overflow: hidden;
  animation: l1BannerFloat 2.5s ease-in-out 3;
}

.gift-l1-shimmer {
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  animation: shimmerSweep 2s ease-in-out 1;
  pointer-events: none;
}

@keyframes shimmerSweep {
  0% { left: -60%; }
  50% { left: 120%; }
  100% { left: 120%; }
}

@keyframes l1BannerIn {
  from { transform: translateX(-120%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes l1BannerFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.gift-l1-emoji {
  font-size: 32px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.gift-l1-img {
  width: 40px;
  height: 40px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.gift-l1-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.gift-l1-sender {
  font-size: 13px;
  font-weight: 700;
  color: #1A1A2E;
  line-height: 1.2;
}

.gift-l1-action {
  font-size: 11px;
  font-weight: 500;
  color: rgba(26, 26, 46, 0.7);
  line-height: 1.2;
}

/* ========== L2: 光柱 + 弹性礼物 + 旋转光圈 ========== */
.gift-l2 {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gift-l2-pillar {
  position: absolute;
  top: 0; left: 50%;
  width: 80px;
  height: 100%;
  margin-left: -40px;
  background: linear-gradient(180deg,
    transparent 0%,
    rgba(255, 215, 0, 0.08) 20%,
    rgba(255, 215, 0, 0.2) 40%,
    rgba(255, 215, 0, 0.2) 60%,
    rgba(255, 215, 0, 0.08) 80%,
    transparent 100%);
  animation: pillarPulse 3.5s ease-in-out 1;
}

@keyframes pillarPulse {
  0% { opacity: 0; transform: scaleX(0.5); }
  15% { opacity: 1; transform: scaleX(1); }
  85% { opacity: 1; transform: scaleX(1.2); }
  100% { opacity: 0; transform: scaleX(0.5); }
}

.gift-l2-ring {
  position: absolute;
  top: 35%;
  left: 50%;
  width: 200px;
  height: 200px;
  margin-left: -100px;
  margin-top: -100px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    rgba(255, 215, 0, 0.6),
    rgba(255, 165, 0, 0.1),
    rgba(255, 215, 0, 0.6),
    rgba(255, 165, 0, 0.1),
    rgba(255, 215, 0, 0.6)
  );
  animation: ringRotate 3s linear 2;
  filter: blur(8px);
}

@keyframes ringRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.gift-l2-star {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  margin: -3px;
  border-radius: 50%;
  background: #FFD700;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.8);
  animation: starOrbit 2s ease-out 1;
  animation-delay: var(--star-delay, 0s);
  transform: rotate(var(--star-angle, 0deg)) translateY(0);
  opacity: 0;
}

@keyframes starOrbit {
  0% {
    transform: rotate(var(--star-angle, 0deg)) translateY(0);
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  100% {
    transform: rotate(var(--star-angle, 0deg)) translateY(-100px);
    opacity: 0;
  }
}

.gift-l2-center {
  position: relative;
  z-index: 2;
  animation: l2Bounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes l2Bounce {
  0% { transform: scale(0.1); opacity: 0; }
  50% { transform: scale(1.3); opacity: 1; }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}

.gift-l2-emoji {
  font-size: 64px;
  filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.7)) brightness(1.1);
  animation: l2GiftGlow 1.5s ease-in-out 2 alternate;
}

@keyframes l2GiftGlow {
  from { filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.7)) brightness(1.1); }
  to { filter: drop-shadow(0 0 35px rgba(255, 215, 0, 0.9)) brightness(1.2); }
}

.gift-l2-img {
  width: 80px;
  height: 80px;
  filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.7)) brightness(1.1);
  animation: l2GiftGlow 1.5s ease-in-out 2 alternate;
}

/* ========== L3: 全屏豪华特效 ========== */
.gift-l3 {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gift-l3-flash {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: white;
  animation: l3Flash 0.8s ease-out 1 forwards;
  pointer-events: none;
}

@keyframes l3Flash {
  0% { opacity: 0.8; }
  20% { opacity: 0.6; }
  100% { opacity: 0; }
}

.gift-l3-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--p-size, 6px);
  height: var(--p-size, 6px);
  margin: calc(var(--p-size, 6px) / -2);
  border-radius: 50%;
  background: #FFD700;
  box-shadow: 0 0 6px rgba(255, 215, 0, 0.8);
  animation: l3Particle 3s ease-out 1;
  animation-delay: var(--p-delay, 0s);
  transform: rotate(var(--p-angle, 0deg)) translateY(0);
  opacity: 0;
}

@keyframes l3Particle {
  0% {
    transform: rotate(var(--p-angle, 0deg)) translateY(0);
    opacity: 1;
  }
  60% {
    opacity: 0.8;
  }
  100% {
    transform: rotate(var(--p-angle, 0deg)) translateY(var(--p-distance, 150px));
    opacity: 0;
  }
}

.gift-l3-firework {
  position: absolute;
  top: var(--fw-y, 30%);
  left: var(--fw-x, 30%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  animation: l3Firework 2s ease-out 1;
  animation-delay: var(--fw-delay, 0s);
  opacity: 0;
}

.gift-l3-firework::before,
.gift-l3-firework::after {
  content: '';
  position: absolute;
  border-radius: 50%;
}

.gift-l3-firework::before {
  width: 80px;
  height: 80px;
  top: -38px;
  left: -38px;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.6) 0%, rgba(255, 100, 50, 0.3) 40%, transparent 70%);
  animation: fwBurst 1.5s ease-out 1;
  animation-delay: inherit;
}

.gift-l3-firework::after {
  width: 40px;
  height: 40px;
  top: -18px;
  left: -18px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, transparent 60%);
  animation: fwCore 1s ease-out 1;
  animation-delay: inherit;
}

@keyframes l3Firework {
  0% { opacity: 0; transform: scale(0); }
  10% { opacity: 1; transform: scale(0.5); }
  50% { opacity: 0.8; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(0.8); }
}

@keyframes fwBurst {
  0% { transform: scale(0); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}

@keyframes fwCore {
  0% { transform: scale(0); opacity: 1; }
  100% { transform: scale(3); opacity: 0; }
}

.gift-l3-center {
  position: relative;
  z-index: 3;
  animation: l3CenterIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes l3CenterIn {
  0% { transform: scale(0.1) rotate(-30deg); opacity: 0; }
  50% { transform: scale(1.3) rotate(10deg); opacity: 1; }
  70% { transform: scale(0.9) rotate(-5deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

.gift-l3-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 180px;
  height: 180px;
  margin-top: -90px;
  margin-left: -90px;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(255, 215, 0, 0.4) 0%,
    rgba(255, 165, 0, 0.2) 40%,
    transparent 70%);
  animation: l3HaloPulse 2s ease-in-out 2 alternate;
}

@keyframes l3HaloPulse {
  from { transform: scale(1); opacity: 0.6; }
  to { transform: scale(1.4); opacity: 0.3; }
}

.gift-l3-emoji {
  font-size: 100px;
  filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.8)) brightness(1.2);
  animation: l3GiftFloat 2s ease-in-out 2 alternate;
}

@keyframes l3GiftFloat {
  from { filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.8)) brightness(1.2); transform: translateY(0); }
  to { filter: drop-shadow(0 0 50px rgba(255, 215, 0, 1)) brightness(1.4); transform: translateY(-8px); }
}

.gift-l3-img {
  width: 120px;
  height: 120px;
  filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.8)) brightness(1.2);
  animation: l3GiftFloat 2s ease-in-out 2 alternate;
}

.gift-l3-bottom-banner {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 32px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.95), rgba(255, 140, 0, 0.9));
  border-radius: 24px;
  box-shadow:
    0 4px 30px rgba(255, 165, 0, 0.6),
    0 0 0 1px rgba(255, 215, 0, 0.4);
  animation: l3BannerIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
  overflow: hidden;
  white-space: nowrap;
}

.gift-l3-bottom-shimmer {
  position: absolute;
  top: 0; left: -100%; width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: l3Shimmer 2.5s ease-in-out 1;
}

@keyframes l3Shimmer {
  0% { left: -50%; }
  40% { left: 120%; }
  100% { left: 120%; }
}

@keyframes l3BannerIn {
  from { transform: translateX(-50%) translateY(30px); opacity: 0; }
  to { transform: translateX(-50%) translateY(0); opacity: 1; }
}

.gift-l3-bottom-text {
  position: relative;
  z-index: 1;
  font-size: 15px;
  font-weight: 700;
  color: #1A1A2E;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
}
</style>
