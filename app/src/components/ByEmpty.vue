<template>
  <view class="by-empty">
    <text class="by-empty-icon" v-if="icon">{{ icon }}</text>
    <text class="by-empty-title" v-if="title">{{ title }}</text>
    <text class="by-empty-desc" v-if="description">{{ description }}</text>
    <slot></slot>
  </view>
</template>

<script>
export default {
  name: 'ByEmpty',
  props: {
    icon: { type: String, default: '📭' },
    title: { type: String, default: '暂无数据' },
    description: { type: String, default: '' }
  }
}
</script>

<style lang="scss" scoped>
.by-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
}
.by-empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}
.by-empty-title {
  font-size: 30rpx;
  color: $by-text-2;
  margin-bottom: 12rpx;
}
.by-empty-desc {
  font-size: 26rpx;
  color: $by-text-3;
  text-align: center;
}
</style>
