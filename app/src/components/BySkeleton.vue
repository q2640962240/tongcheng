<template>
  <view class="by-skeleton" :style="{ width, height }">
    <view class="by-skeleton-shimmer"></view>
  </view>
</template>

<script>
export default {
  name: 'BySkeleton',
  props: {
    width: { type: String, default: '100%' },
    height: { type: String, default: '32rpx' }
  }
}
</script>

<style lang="scss" scoped>
.by-skeleton {
  position: relative;
  overflow: hidden;
  background: $by-surface;
  border-radius: $by-radius-sm;
}
.by-skeleton-shimmer {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
</style>
