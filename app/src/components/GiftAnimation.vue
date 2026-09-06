<template>
  <view class="gift-anim-layer" v-if="current.id">
    <canvas
      v-if="current.level >= 2"
      class="gift-canvas"
      ref="canvasRef"
      :style="{ width: screenW + 'px', height: screenH + 'px' }"
    ></canvas>

    <view class="gift-bg-overlay" v-if="current.level >= 3"></view>

    <view v-if="current.level >= 1" class="gift-banner" :class="'gift-banner-l' + current.level">
      <view class="gift-banner-shimmer"></view>
      <text v-if="current.isEmoji" class="gift-banner-emoji">{{ current.image }}</text>
      <image v-else class="gift-banner-img" :src="current.image" mode="aspectFit" />
      <view class="gift-banner-info">
        <text class="gift-banner-sender">{{ current.senderName || '神秘人' }}</text>
        <text class="gift-banner-action">送出 {{ current.giftName }}{{ current.quantity > 1 ? ' ×' + current.quantity : '' }}</text>
      </view>
    </view>

    <view v-if="current.level >= 2" class="gift-center" :class="'gift-center-l' + current.level">
      <view class="gift-center-glow"></view>
      <text v-if="current.isEmoji" class="gift-center-emoji">{{ current.image }}</text>
      <image v-else class="gift-center-img" :src="current.image" mode="aspectFit" />
    </view>

    <view v-if="current.level >= 3" class="gift-bottom-banner">
      <view class="gift-bottom-shimmer"></view>
      <text class="gift-bottom-text">{{ current.senderName || '神秘人' }} 送出 {{ current.giftName }}{{ current.quantity > 1 ? ' ×' + current.quantity : '' }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'

const queue = ref([])
const current = ref({})
const playing = ref(false)
const canvasRef = ref(null)
const screenW = ref(375)
const screenH = ref(667)
let timerId = null
let animId = null
let particles = []
let beams = []
let shocks = []
let sparkles = []
let startTime = 0
let canvasCtx = null
const MAX_QUEUE = 5
const durations = { 0: 0, 1: 2500, 2: 4000, 3: 6000 }

const COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FF69B4',
  '#FFA500', '#96CEB4', '#DDA0DD', '#FF4500', '#00CED1',
  '#FF1493', '#7B68EE', '#FFD700', '#FF6347', '#00FA9A'
]

const isEmojiStr = (s) => {
  if (!s) return true
  return !s.startsWith('http') && !s.startsWith('/') && !s.startsWith('data:')
}

const play = (gift) => {
  const level = gift.animationLevel || 1
  if (level <= 0) return
  const imgUrl = gift.imageUrl || gift.giftImage || '🎁'
  if (queue.value.length >= MAX_QUEUE) queue.value.shift()
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

const initCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas) return null
  try {
    const dpr = uni.getSystemInfoSync().pixelRatio || 2
    screenW.value = uni.getSystemInfoSync().windowWidth
    screenH.value = uni.getSystemInfoSync().windowHeight
    canvas.width = screenW.value * dpr
    canvas.height = screenH.value * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    canvasCtx = ctx
    return ctx
  } catch (e) {
    return null
  }
}

const addParticles = (cx, cy, count, opts = {}) => {
  const {
    speedMin = 2, speedMax = 10,
    sizeMin = 2, sizeMax = 7,
    gravity = 0.12, friction = 0.98,
    lifeMin = 50, lifeMax = 110,
    trails = true, colorSet = null
  } = opts
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = speedMin + Math.random() * (speedMax - speedMin)
    const colors = colorSet || COLORS
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: sizeMin + Math.random() * (sizeMax - sizeMin),
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      life: lifeMin + Math.random() * (lifeMax - lifeMin),
      maxLife: 0,
      gravity, friction,
      trails,
      history: []
    })
    const p = particles[particles.length - 1]
    p.maxLife = p.life
  }
}

const addShockwave = (cx, cy, opts = {}) => {
  const { color = '#FFD700', maxRadius = 200, width = 4, speed = 6 } = opts
  shocks.push({ x: cx, y: cy, radius: 5, maxRadius, alpha: 0.9, color, width, speed })
}

const addBeams = (cx, cy, count = 12) => {
  for (let i = 0; i < count; i++) {
    beams.push({
      x: cx, y: cy,
      angle: (i / count) * Math.PI * 2,
      length: 120 + Math.random() * 180,
      width: 1.5 + Math.random() * 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 0.5 + Math.random() * 0.4,
      rotSpeed: (Math.random() - 0.5) * 0.04
    })
  }
}

const addSparkles = (cx, cy, count = 5) => {
  for (let i = 0; i < count; i++) {
    sparkles.push({
      x: cx + (Math.random() - 0.5) * 80,
      y: cy + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 3,
      vy: -2 - Math.random() * 4,
      size: 1.5 + Math.random() * 3,
      color: '#FFD700',
      alpha: 0.8 + Math.random() * 0.2,
      life: 25 + Math.random() * 35
    })
  }
}

const render = () => {
  const ctx = canvasCtx
  if (!ctx) { animId = requestAnimationFrame(render); return }
  const w = screenW.value
  const h = screenH.value
  const cx = w / 2
  const cy = h * 0.38
  const elapsed = Date.now() - startTime

  ctx.clearRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'

  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i]
    const fadeOut = elapsed > 3000 ? Math.max(0, 1 - (elapsed - 3000) / 1500) : 1
    b.angle += b.rotSpeed
    const grad = ctx.createLinearGradient(
      b.x, b.y,
      b.x + Math.cos(b.angle) * b.length,
      b.y + Math.sin(b.angle) * b.length
    )
    grad.addColorStop(0, b.color)
    grad.addColorStop(1, 'transparent')
    ctx.globalAlpha = b.alpha * fadeOut
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(
      b.x + Math.cos(b.angle) * b.length,
      b.y + Math.sin(b.angle) * b.length
    )
    ctx.lineWidth = b.width
    ctx.strokeStyle = grad
    ctx.stroke()
    if (fadeOut <= 0) beams.splice(i, 1)
  }

  for (let i = shocks.length - 1; i >= 0; i--) {
    const s = shocks[i]
    s.radius += s.speed
    s.alpha *= 0.96
    ctx.globalAlpha = s.alpha
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
    ctx.lineWidth = s.width
    ctx.strokeStyle = s.color
    ctx.stroke()
    if (s.radius > s.maxRadius || s.alpha < 0.01) shocks.splice(i, 1)
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    if (p.trails && p.history.length > 1) {
      for (let j = 1; j < p.history.length; j++) {
        const t = j / p.history.length
        ctx.globalAlpha = t * p.alpha * 0.4
        ctx.beginPath()
        ctx.arc(p.history[j].x, p.history[j].y, p.size * t * 0.6, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      }
    }
    p.vx *= p.friction
    p.vy *= p.friction
    p.vy += p.gravity
    p.x += p.vx
    p.y += p.vy
    p.life--
    p.alpha = Math.max(0, p.life / p.maxLife)
    if (p.trails) {
      p.history.push({ x: p.x, y: p.y })
      if (p.history.length > 8) p.history.shift()
    }
    ctx.globalAlpha = p.alpha
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = p.alpha * 0.15
    ctx.fill()
    if (p.life <= 0) particles.splice(i, 1)
  }

  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i]
    s.x += s.vx
    s.y += s.vy
    s.vy += 0.06
    s.life--
    s.alpha *= 0.96
    ctx.globalAlpha = s.alpha
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
    ctx.fillStyle = s.color
    ctx.fill()
    if (s.life <= 0) sparkles.splice(i, 1)
  }

  if (current.value.level >= 3 && elapsed < 4500) {
    addSparkles(cx, cy, 3)
  }

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  animId = requestAnimationFrame(render)
}

const startEffects = (level) => {
  const ctx = initCanvas()
  if (!ctx && level >= 2) return
  const w = screenW.value
  const h = screenH.value
  const cx = w / 2
  const cy = h * 0.38
  startTime = Date.now()
  particles = []
  beams = []
  shocks = []
  sparkles = []

  if (level >= 2) {
    addParticles(cx, cy, 60, { speedMax: 8, sizeMax: 5, gravity: 0.1, lifeMax: 80 })
    addShockwave(cx, cy, { color: '#FFD700', maxRadius: Math.max(w, h) * 0.5, speed: 5 })
    setTimeout(() => addShockwave(cx, cy, { color: '#FF69B4', maxRadius: Math.max(w, h) * 0.4, speed: 4 }), 150)
  }

  if (level >= 3) {
    setTimeout(() => {
      addParticles(cx, cy, 100, { speedMin: 3, speedMax: 14, sizeMin: 2, sizeMax: 8, gravity: 0.08, lifeMin: 60, lifeMax: 130 })
      addShockwave(cx, cy, { color: '#4ECDC4', maxRadius: Math.max(w, h) * 0.7, width: 5, speed: 7 })
      addBeams(cx, cy, 16)
    }, 200)
    setTimeout(() => {
      addParticles(cx, cy, 50, { speedMin: 1, speedMax: 6, sizeMin: 3, sizeMax: 9, gravity: 0.15, lifeMin: 40, lifeMax: 90 })
      addShockwave(cx, cy, { color: '#FF6B6B', maxRadius: Math.max(w, h) * 0.5, speed: 4 })
    }, 600)
    setTimeout(() => {
      addParticles(cx * 0.5, cy * 0.7, 35, { speedMax: 6, lifeMax: 70 })
      addParticles(cx * 1.5, cy * 0.7, 35, { speedMax: 6, lifeMax: 70 })
    }, 1000)
    setTimeout(() => {
      addParticles(cx, cy, 40, { speedMin: 4, speedMax: 12, sizeMax: 7, gravity: 0.06, lifeMax: 100 })
      addShockwave(cx, cy, { color: '#DDA0DD', maxRadius: Math.max(w, h) * 0.6, speed: 5 })
    }, 1500)
  }

  animId = requestAnimationFrame(render)
}

const stopEffects = () => {
  if (animId) {
    cancelAnimationFrame(animId)
    animId = null
  }
  particles = []
  beams = []
  shocks = []
  sparkles = []
  canvasCtx = null
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

const playNext = async () => {
  clearTimer()
  stopEffects()
  if (queue.value.length === 0) {
    playing.value = false
    current.value = {}
    return
  }
  playing.value = true
  current.value = queue.value[0]

  if (current.value.level >= 2) {
    await nextTick()
    setTimeout(() => startEffects(current.value.level), 50)
  }

  const dur = durations[current.value.level] || 2500
  timerId = setTimeout(() => {
    queue.value.shift()
    if (queue.value.length > 0) {
      playNext()
    } else {
      playing.value = false
      current.value = {}
      stopEffects()
    }
  }, dur)
}

onUnmounted(() => {
  clearTimer()
  stopEffects()
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

.gift-canvas {
  position: absolute;
  top: 0; left: 0;
  z-index: 1;
}

.gift-bg-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.2) 50%, transparent 80%);
  z-index: 0;
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
