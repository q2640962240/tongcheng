<template>
  <view class="by-confirm-mask" v-if="visible" @tap.stop="onCancel">
    <view class="by-confirm-dialog" @tap.stop>
      <text class="by-confirm-title" v-if="title">{{ title }}</text>
      <text class="by-confirm-content">{{ content }}</text>
      <view class="by-confirm-actions">
        <view class="by-confirm-btn by-confirm-cancel" v-if="showCancel" @tap="onCancel">
          <text>{{ cancelText }}</text>
        </view>
        <view class="by-confirm-btn by-confirm-ok" @tap="onConfirm">
          <text>{{ confirmText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'ByConfirm',
  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    confirmText: { type: String, default: '确定' },
    cancelText: { type: String, default: '取消' },
    showCancel: { type: Boolean, default: true }
  },
  emits: ['confirm', 'cancel', 'update:visible'],
  methods: {
    onConfirm() {
      this.$emit('confirm')
      this.$emit('update:visible', false)
    },
    onCancel() {
      this.$emit('cancel')
      this.$emit('update:visible', false)
    }
  }
}
</script>

<style lang="scss" scoped>
.by-confirm-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.by-confirm-dialog {
  width: 560rpx;
  background: $by-surface;
  border-radius: $by-radius-lg;
  padding: 40rpx;
  border: 1rpx solid $by-border;
}
.by-confirm-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $by-text-1;
  text-align: center;
  margin-bottom: 20rpx;
}
.by-confirm-content {
  font-size: 28rpx;
  color: $by-text-2;
  text-align: center;
  margin-bottom: 40rpx;
  line-height: 1.6;
}
.by-confirm-actions {
  display: flex;
  gap: 20rpx;
}
.by-confirm-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $by-radius-pill;
  font-size: 28rpx;
  font-weight: 600;
}
.by-confirm-cancel {
  background: $by-bg-soft;
  color: $by-text-2;
  border: 1rpx solid $by-border;
}
.by-confirm-ok {
  background: $by-gradient-gold;
  color: $by-bg;
}
</style>
