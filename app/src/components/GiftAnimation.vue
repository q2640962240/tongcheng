<template>
  <view class="gift-anim-layer" v-if="queue.length > 0">
    <transition name="gift-fade">
      <view :key="current.id" class="gift-anim-content" :class="'gift-anim-l' + current.level">
        <!-- L1: 小飘动 + 横幅 -->
        <view v-if="current.level >= 1" class="gift-anim-l1">
          <view class="gift-anim-l1-banner">
            <text class="gift-anim-l1-emoji">{{ current.image }}</text>
            <text class="gift-anim-l1-text">{{ current.senderName }} 送出 {{ current.giftName }}{{ current.quantity > 1 ? ' ×' + current.quantity : '' }}</text>
          </view>
        </view>
        <!-- L2: 中型横幅 + 光效 -->
        <view v-if="current.level >= 2" class="gift-anim-l2">
          <view class="gift-anim-l2-glow"></view>
        </view>
        <!-- L3: 全屏特效 -->
        <view v-if="current.level >= 3" class="gift-anim-l3">
          <view v-for="i in 12" :key="i" class="gift-anim-l3-particle" :style="particleStyle(i)"></view>
          <view class="gift-anim-l3-center">
            <text class="gift-anim-l3-emoji">{{ current.image }}</text>
          </view>
        </view>
      </view>
    </transition>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'

const queue = ref([])
const current = ref({})
const playing = ref(false)

const durations = { 0: 0, 1: 2500, 2: 3500, 3: 5000 }

const play = (gift) => {
  const level = gift.animationLevel || 1
  if (level <= 0) return
  queue.value.push({
    id: Date.now() + Math.random(),
    level,
    image: gift.imageUrl || gift.giftImage || '🎁',
    giftName: gift.giftName || gift.name || '礼物',
    senderName: gift.senderName || '',
    quantity: gift.quantity || 1
  })
}

const particleStyle = (i) => {
  const angle = (i / 12) * 360
  const delay = (i * 0.1).toFixed(1)
  return {
    transform: `rotate(${angle}deg)`,
    animationDelay: `${delay}s`
  }
}

watch(queue, (q) => {
  if (q.length > 0 && !playing.value) {
    playNext()
  }
}, { deep: true })

const playNext = async () => {
  if (queue.value.length === 0) {
    playing.value = false
    current.value = {}
    return
  }
  playing.value = true
  current.value = queue.value[0]
  const dur = durations[current.value.level] || 2500
  await new Promise(r => setTimeout(r, dur))
  queue.value.shift()
  if (queue.value.length > 0) {
    playNext()
  } else {
    playing.value = false
    current.value = {}
  }
}

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
}

.gift-fade-enter-active {
  animation: giftIn 0.4s ease-out;
}
.gift-fade-leave-active {
  animation: giftOut 0.3s ease-in forwards;
}

@keyframes giftIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes giftOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* L1: 底部横幅飘动 */
.gift-anim-l1 {
  position: absolute;
  bottom: 120px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  animation: l1Slide 0.5s ease-out;
}

.gift-anim-l1-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.9), rgba(255, 165, 0, 0.9));
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(255, 165, 0, 0.4);
  animation: l1Float 2s ease-in-out infinite;
}

.gift-anim-l1-emoji {
  font-size: 28px;
}

.gift-anim-l1-text {
  font-size: 14px;
  font-weight: 600;
  color: #1A1A2E;
  white-space: nowrap;
}

@keyframes l1Slide {
  from { transform: translateY(40px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes l1Float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* L2: 光效 */
.gift-anim-l2 {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
}

.gift-anim-l2-glow {
  position: absolute;
  top: 30%;
  left: 50%;
  width: 300px;
  height: 300px;
  margin-left: -150px;
  margin-top: -150px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
  animation: l2Pulse 1.5s ease-in-out infinite;
}

@keyframes l2Pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 0.3; }
}

/* L3: 全屏粒子 */
.gift-anim-l3 {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gift-anim-l3-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  margin: -4px;
  border-radius: 50%;
  background: #FFD700;
  animation: l3Burst 2s ease-out infinite;
}

@keyframes l3Burst {
  0% { transform: rotate(var(--r, 0deg)) translateY(0); opacity: 1; }
  100% { transform: rotate(var(--r, 0deg)) translateY(-200px); opacity: 0; }
}

.gift-anim-l3-center {
  position: relative;
  z-index: 1;
  animation: l3Bounce 0.6s ease-out;
}

.gift-anim-l3-emoji {
  font-size: 80px;
  filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.6));
}

@keyframes l3Bounce {
  0% { transform: scale(0); }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
</style>
