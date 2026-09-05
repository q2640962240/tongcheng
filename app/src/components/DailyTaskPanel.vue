<template>
  <view v-if="visible" class="task-overlay" @tap.self="close">
    <view class="task-panel">
      <view class="panel-head">
        <text class="panel-title">每日任务</text>
        <text class="panel-close" @tap="close">✕</text>
      </view>

      <view v-if="loading" class="panel-loading">
        <text class="loading-text">加载中…</text>
      </view>

      <view v-else class="task-list">
        <view v-for="t in tasks" :key="t.id" class="task-row">
          <view class="task-left">
            <text class="task-icon">{{ taskIcon(t.id) }}</text>
            <view class="task-info">
              <text class="task-name">{{ t.title }}</text>
              <view v-if="t.progress !== undefined" class="task-progress">
                <view class="progress-bar">
                  <view class="progress-fill" :style="{ width: Math.min(100, (t.progress / t.target) * 100) + '%' }"></view>
                </view>
                <text class="progress-text">{{ t.progress }}/{{ t.target }}</text>
              </view>
            </view>
          </view>
          <view class="task-right">
            <text class="task-reward">+{{ t.reward }}💎</text>
            <view
              v-if="t.claimed"
              class="claim-btn claimed"
            ><text>已领取</text></view>
            <view
              v-else-if="t.done"
              class="claim-btn active"
              @tap="onClaim(t)"
            ><text>领取</text></view>
            <view v-else class="claim-btn disabled"><text>未完成</text></view>
          </view>
        </view>

        <view class="all-done-row" v-if="allDone">
          <view class="all-done-left">
            <text class="all-done-icon">🎉</text>
            <text class="all-done-label">全部完成奖励</text>
            <text class="task-reward">+{{ allDoneReward }}💎</text>
          </view>
          <view
            v-if="allDoneClaimed"
            class="claim-btn claimed"
          ><text>已领取</text></view>
          <view
            v-else
            class="claim-btn active"
            @tap="onClaimAllDone"
          ><text>领取</text></view>
        </view>
      </view>

      <view class="panel-footer">
        <text class="footer-text">每日 0:00 刷新 · 钻石即时到账</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { taskApi } from '../api'
import { guard, unwrap, toObj, toNum, toBool, toList, requireLogin } from '../utils/fallback'

const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible'])

const loading = ref(false)
const tasks = ref([])
const allDone = ref(false)
const allDoneReward = ref(10)
const allDoneClaimed = ref(false)

const close = () => emit('update:visible', false)

const taskIcon = (id) => {
  const map = { login: '📱', chat: '💬', gift: '🎁', post: '📝', share: '↗️' }
  return map[id] || '📌'
}

const loadData = async () => {
  if (!requireLogin()) { close(); return }
  loading.value = true
  try {
    const data = await guard(taskApi.today().then(r => unwrap(r, null)), null)
    const obj = toObj(data, {})
    tasks.value = toList(obj.tasks).map(t => ({
      id: toObj(t, {}).id || '',
      title: toObj(t, {}).title || '',
      reward: toNum(toObj(t, {}).reward, 0),
      done: toBool(toObj(t, {}).done, false),
      claimed: toBool(toObj(t, {}).claimed, false),
      progress: toObj(t, {}).progress,
      target: toObj(t, {}).target
    }))
    allDone.value = toBool(obj.allDone, false)
    allDoneReward.value = toNum(obj.allDoneReward, 10)
    allDoneClaimed.value = toBool(obj.allDoneClaimed, false)
  } catch (_) {}
  loading.value = false
}

const onClaim = async (t) => {
  try {
    const data = await guard(taskApi.claim(t.id).then(r => unwrap(r, null)), null)
    const reward = toNum(toObj(data, {}).reward, t.reward)
    uni.showToast({ title: `+${reward} 💎`, icon: 'none' })
    t.claimed = true
    await loadData()
  } catch (_) {
    uni.showToast({ title: '领取失败', icon: 'none' })
  }
}

const onClaimAllDone = async () => {
  try {
    const data = await guard(taskApi.claimAllDone().then(r => unwrap(r, null)), null)
    const reward = toNum(toObj(data, {}).reward, allDoneReward.value)
    uni.showToast({ title: `全部完成！+${reward} 💎`, icon: 'none' })
    allDoneClaimed.value = true
    await loadData()
  } catch (_) {
    uni.showToast({ title: '领取失败', icon: 'none' })
  }
}

watch(() => props.visible, (v) => {
  if (v) loadData()
})
</script>

<style lang="scss" scoped>
.task-overlay {
  position: fixed; inset: 0; z-index: 999;
  background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: flex-end; justify-content: center;
}
.task-panel {
  width: 100%; max-height: 80vh;
  background: $by-card-bg;
  border-radius: 32rpx 32rpx 0 0;
  padding: 0 0 env(safe-area-inset-bottom);
  display: flex; flex-direction: column;
  animation: slideUp 0.25s ease-out;
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.panel-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 32rpx 32rpx 16rpx;
  border-bottom: 1rpx solid $by-border;
}
.panel-title { font-size: 34rpx; font-weight: 700; color: $by-text-1; }
.panel-close {
  font-size: 32rpx; color: $by-text-3;
  padding: 8rpx 16rpx;
  &:active { color: $by-text-1; }
}

.panel-loading {
  padding: 80rpx 0; text-align: center;
}
.loading-text { font-size: 26rpx; color: $by-text-3; }

.task-list {
  flex: 1; overflow-y: auto;
  padding: 16rpx 32rpx;
}
.task-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid color.adjust($by-border, $alpha: 0.5);
}
.task-left {
  display: flex; align-items: center; gap: 20rpx; flex: 1; min-width: 0;
}
.task-icon { font-size: 40rpx; flex-shrink: 0; }
.task-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.task-name { font-size: 28rpx; font-weight: 600; color: $by-text-1; }
.task-progress { display: flex; align-items: center; gap: 12rpx; }
.progress-bar {
  width: 160rpx; height: 10rpx;
  background: color.adjust($by-border, $alpha: 0.5);
  border-radius: 10rpx; overflow: hidden;
}
.progress-fill {
  height: 100%; border-radius: 10rpx;
  background: $by-gradient-gold;
  transition: width 0.3s ease;
}
.progress-text { font-size: 22rpx; color: $by-text-3; }

.task-right {
  display: flex; align-items: center; gap: 16rpx; flex-shrink: 0;
}
.task-reward {
  font-size: 24rpx; font-weight: 700; color: $by-gold;
}
.claim-btn {
  padding: 10rpx 28rpx; border-radius: $by-radius-pill;
  font-size: 24rpx; font-weight: 600;
  &.active {
    background: $by-gradient-gold; color: #0B0F1A;
    box-shadow: $by-shadow-gold;
    &:active { transform: scale(0.96); }
  }
  &.claimed {
    background: color.adjust($by-text-3, $alpha: 0.15);
    color: $by-text-3;
  }
  &.disabled {
    background: color.adjust($by-border, $alpha: 0.3);
    color: $by-text-3;
  }
}

.all-done-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 20rpx; padding: 24rpx;
  background: linear-gradient(135deg, color.adjust($by-gold, $alpha: 0.1), color.adjust($by-aurora-a, $alpha: 0.08));
  border-radius: $by-radius-lg;
  border: 1rpx solid color.adjust($by-gold, $alpha: 0.25);
}
.all-done-left {
  display: flex; align-items: center; gap: 12rpx;
}
.all-done-icon { font-size: 36rpx; }
.all-done-label { font-size: 28rpx; font-weight: 700; color: $by-gold; }

.panel-footer {
  padding: 20rpx 32rpx;
  text-align: center;
  border-top: 1rpx solid $by-border;
}
.footer-text { font-size: 22rpx; color: $by-text-muted; }
</style>
