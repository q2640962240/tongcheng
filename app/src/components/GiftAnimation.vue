<template>
  <view class="gift-anim-layer" v-if="current.id" :class="'gift-anim-l' + current.level">
    <!-- #ifdef H5 || APP-PLUS -->
    <SvgaStage
      v-if="current.effectSvga"
      :key="'svga-' + current.uid"
      :src="current.effectSvga"
      :level="current.level"
      :uid="current.uid"
      @fail="onSvgaFail"
      @end="onSvgaEnd"
    />
    <!-- #endif -->

    <view
      v-if="!current.effectSvga && current.level >= 2 && current.effectImage"
      class="gift-effect-bg"
      :class="'gift-effect-bg-l' + current.level"
      :style="{ backgroundImage: 'url(' + current.effectImage + ')' }"
    ></view>

    <view v-if="!current.effectSvga && current.level >= 3" class="gift-bg-overlay"></view>

    <view v-if="!current.effectSvga && current.level >= 1" class="gift-banner" :class="'gift-banner-l' + current.level">
      <view class="gift-banner-shimmer"></view>
      <text v-if="current.isEmoji" class="gift-banner-emoji">{{ current.image }}</text>
      <image v-else class="gift-banner-img" :src="current.image" mode="aspectFit" />
      <view class="gift-banner-info">
        <text class="gift-banner-sender">{{ current.senderName || '神秘人' }}</text>
        <text class="gift-banner-action">送出 {{ current.giftName }}{{ current.quantity > 1 ? ' ×' + current.quantity : '' }}</text>
      </view>
    </view>

    <view v-if="!current.effectSvga && current.level >= 2" class="gift-center" :class="'gift-center-l' + current.level">
      <view class="gift-center-glow"></view>
      <text v-if="current.isEmoji" class="gift-center-emoji">{{ current.image }}</text>
      <image v-else class="gift-center-img" :src="current.image" mode="aspectFit" />
    </view>

    <view v-if="!current.effectSvga && current.level >= 3" class="gift-bottom-banner">
      <view class="gift-bottom-shimmer"></view>
      <text class="gift-bottom-text">{{ current.senderName || '神秘人' }} 送出 {{ current.giftName }}{{ current.quantity > 1 ? ' ×' + current.quantity : '' }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { getCurrentBaseURL } from '@/utils/request'
// #ifdef H5 || APP-PLUS
import SvgaStage from './SvgaStage.vue'
// #endif

// renderjs 只在 H5 / App-vue 可用，小程序端保持 CSS 特效
let SVGA_SUPPORTED = false
// #ifdef H5 || APP-PLUS
SVGA_SUPPORTED = true
// #endif

const queue = ref([])
const current = ref({})
const playing = ref(false)
let timerId = null
let uidSeq = 0
const MAX_QUEUE = 5
const durations = { 0: 0, 1: 2500, 2: 4000, 3: 6000 }
// SVGA 由 onFinished 驱动切换，这里只是「结束事件丢失」时的兜底。
// 最长的素材（心动）本身 8s，计时又从下载前就开始，所以留到 15s
const SVGA_MAX = 15000

const isEmojiStr = (s) => {
  if (!s) return true
  return !s.startsWith('http') && !s.startsWith('/') && !s.startsWith('data:')
}

// App 端 webview 源是 file://，相对路径取不到站点静态资源
function siteOrigin() {
  // #ifdef H5
  return ''
  // #endif
  // #ifndef H5
  return String(getCurrentBaseURL() || '').replace(/\/api\/?$/, '') || 'https://zyb001.cn'
  // #endif
}

const resolveSvga = (effectImage) => {
  if (!SVGA_SUPPORTED || !effectImage || !/\.svga$/i.test(effectImage)) return ''
  return /^https?:\/\//i.test(effectImage) ? effectImage : siteOrigin() + effectImage
}

const play = (gift) => {
  const level = gift.animationLevel || 1
  if (level <= 0) return
  const imgUrl = gift.imageUrl || gift.giftImage || '🎁'
  if (queue.value.length >= MAX_QUEUE) queue.value.shift()
  queue.value.push({
    id: Date.now() + Math.random(),
    uid: ++uidSeq,
    level,
    image: imgUrl,
    isEmoji: isEmojiStr(imgUrl),
    giftName: gift.giftName || gift.name || '礼物',
    senderName: gift.senderName || '',
    quantity: gift.quantity || 1,
    effectImage: gift.effectImage || '',
    effectSvga: resolveSvga(gift.effectImage)
  })
}

const clearTimer = () => {
  if (timerId) {
    clearTimeout(timerId)
    timerId = null
  }
}

watch(queue, (q) => {
  if (q.length > 0 && !playing.value) playNext()
}, { deep: true })

const advance = () => {
  clearTimer()
  queue.value.shift()
  if (queue.value.length > 0) {
    playNext()
  } else {
    playing.value = false
    current.value = {}
  }
}

const playNext = () => {
  clearTimer()
  if (queue.value.length === 0) {
    playing.value = false
    current.value = {}
    return
  }
  playing.value = true
  current.value = queue.value[0]

  const dur = current.value.effectSvga ? SVGA_MAX : (durations[current.value.level] || 2500)
  timerId = setTimeout(advance, dur)
}

// SVGA 播完（或兜底超时已到）就切下一个
const onSvgaEnd = () => {
  if (playing.value && current.value.effectSvga) advance()
}

// 加载/解码失败：退回 CSS 特效，别让整条队列卡住
const onSvgaFail = () => {
  if (!playing.value) return
  current.value.effectSvga = ''
  current.value.effectImage = ''
  clearTimer()
  timerId = setTimeout(advance, durations[current.value.level] || 2500)
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

/* ========== 全屏特效背景 (L2/L3) ========== */
.gift-effect-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 1;
}

.gift-effect-bg-l2 {
  animation: effectBgL2 4s ease-out forwards;
}

.gift-effect-bg-l3 {
  animation: effectBgL3 6s ease-out forwards;
}

@keyframes effectBgL2 {
  0% {
    opacity: 0;
    transform: scale(1.3);
    filter: brightness(2) blur(8px);
  }
  15% {
    opacity: 1;
    transform: scale(1.05);
    filter: brightness(1.3) blur(0);
  }
  50% {
    opacity: 1;
    transform: scale(1);
    filter: brightness(1.1);
  }
  85% {
    opacity: 1;
    transform: scale(1.02);
    filter: brightness(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.05);
    filter: brightness(0.8);
  }
}

@keyframes effectBgL3 {
  0% {
    opacity: 0;
    transform: scale(1.5) rotate(-2deg);
    filter: brightness(2.5) blur(12px) saturate(0.5);
  }
  10% {
    opacity: 1;
    filter: brightness(1.8) blur(0) saturate(1.2);
  }
  25% {
    transform: scale(1.05) rotate(0deg);
    filter: brightness(1.3) saturate(1.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.08) rotate(0.5deg);
    filter: brightness(1.15) saturate(1.2);
  }
  75% {
    opacity: 1;
    transform: scale(1.03) rotate(-0.3deg);
    filter: brightness(1.1) saturate(1.1);
  }
  90% {
    opacity: 0.8;
    transform: scale(1.06);
    filter: brightness(0.9) saturate(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.1);
    filter: brightness(0.6);
  }
}

.gift-bg-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 50%, transparent 80%);
  z-index: 2;
  animation: bgFadeIn 0.5s ease-out;
}

@keyframes bgFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ========== Banner (L1/L2/L3 共用) ========== */
.gift-banner {
  position: absolute;
  z-index: 10;
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
  animation: bannerSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.gift-banner-l1 {
  bottom: 140px;
  left: 16px;
}

.gift-banner-l2 {
  bottom: 160px;
  left: 16px;
}

.gift-banner-l3 {
  bottom: 120px;
  left: 16px;
}

.gift-banner-shimmer {
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shimmerSweep 2s ease-in-out 1;
  pointer-events: none;
}

@keyframes shimmerSweep {
  0% { left: -60%; }
  50% { left: 120%; }
  100% { left: 120%; }
}

@keyframes bannerSlideIn {
  from { transform: translateX(-120%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.gift-banner-emoji {
  font-size: 32px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.gift-banner-img {
  width: 40px;
  height: 40px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.gift-banner-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.gift-banner-sender {
  font-size: 13px;
  font-weight: 700;
  color: #1A1A2E;
  line-height: 1.2;
}

.gift-banner-action {
  font-size: 11px;
  font-weight: 500;
  color: rgba(26, 26, 46, 0.7);
  line-height: 1.2;
}

/* ========== 中心礼物 (L2/L3) ========== */
.gift-center {
  position: absolute;
  top: 32%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gift-center-l2 {
  animation: centerBounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.gift-center-l3 {
  animation: centerDramatic 1s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes centerBounce {
  0% { transform: translate(-50%, -50%) scale(0.1); opacity: 0; }
  50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
  70% { transform: translate(-50%, -50%) scale(0.9); }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

@keyframes centerDramatic {
  0% { transform: translate(-50%, -50%) scale(0.1) rotate(-30deg); opacity: 0; }
  40% { transform: translate(-50%, -50%) scale(1.5) rotate(10deg); opacity: 1; }
  60% { transform: translate(-50%, -50%) scale(0.85) rotate(-5deg); }
  80% { transform: translate(-50%, -50%) scale(1.05) rotate(2deg); }
  100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
}

.gift-center-glow {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, rgba(255, 165, 0, 0.15) 40%, transparent 70%);
  animation: glowPulse 2s ease-in-out infinite alternate;
}

@keyframes glowPulse {
  from { transform: scale(1); opacity: 0.6; }
  to { transform: scale(1.3); opacity: 0.3; }
}

.gift-center-emoji {
  font-size: 80px;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 0 25px rgba(255, 215, 0, 0.8)) brightness(1.2);
  animation: giftFloat 2s ease-in-out infinite alternate;
}

.gift-center-img {
  width: 100px;
  height: 100px;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 0 25px rgba(255, 215, 0, 0.8)) brightness(1.2);
  animation: giftFloat 2s ease-in-out infinite alternate;
}

.gift-center-l3 .gift-center-emoji {
  font-size: 120px;
}

.gift-center-l3 .gift-center-img {
  width: 140px;
  height: 140px;
}

@keyframes giftFloat {
  from { transform: translateY(0); }
  to { transform: translateY(-8px); }
}

/* ========== L3 底部横幅 ========== */
.gift-bottom-banner {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  padding: 12px 36px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.95), rgba(255, 140, 0, 0.9));
  border-radius: 28px;
  box-shadow:
    0 6px 40px rgba(255, 165, 0, 0.7),
    0 0 0 2px rgba(255, 215, 0, 0.4);
  animation: bottomBannerIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
  overflow: hidden;
  white-space: nowrap;
}

.gift-bottom-shimmer {
  position: absolute;
  top: 0; left: -100%; width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
  animation: bottomShimmer 3s ease-in-out 1;
}

@keyframes bottomShimmer {
  0% { left: -50%; }
  40% { left: 120%; }
  100% { left: 120%; }
}

@keyframes bottomBannerIn {
  from { transform: translateX(-50%) translateY(40px); opacity: 0; }
  to { transform: translateX(-50%) translateY(0); opacity: 1; }
}

.gift-bottom-text {
  position: relative;
  z-index: 1;
  font-size: 16px;
  font-weight: 700;
  color: #1A1A2E;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
}
</style>
