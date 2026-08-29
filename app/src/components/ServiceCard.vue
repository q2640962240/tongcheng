<template>
  <view class="service-card" @tap="onTap">
    <image class="avatar" :src="item.avatar || '/static/default-avatar.png'" mode="aspectFill" />
    <view class="info">
      <view class="top">
        <text class="name">{{ item.nickname }}</text>
        <view class="tags">
          <text v-for="(t, i) in item.tags" :key="i" class="tag" :class="tagClass(t)">{{ t.label }}</text>
        </view>
      </view>
      <text class="desc">{{ item.intro }}</text>
      <view v-if="item.price" class="price">
        <text class="amount">{{ item.price }}</text>
        <text class="unit">{{ item.priceUnit || '星币' }}</text>
      </view>
    </view>
    <view class="cta" @tap.stop="onContact">{{ ctaText }}</view>
  </view>
</template>

<script setup>
const props = defineProps({
  item: { type: Object, default: () => ({}) },
  ctaText: { type: String, default: '联系TA' }
})
const emit = defineEmits(['tap', 'contact'])

const tagClass = (t) => {
  const map = { pink: 'tag-pink', purple: 'tag-purple', blue: 'tag-blue' }
  return map[t.color] || 'tag-yellow'
}

const onTap = () => emit('tap', props.item)
const onContact = () => emit('contact', props.item)
</script>

<style lang="scss" scoped>
.service-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: #ffffff;
  border-radius: 32rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 4rpx rgba(23, 23, 23, 0.05);

  &:active { transform: scale(0.99); }
}
.avatar {
  width: 128rpx;
  height: 128rpx;
  border-radius: 32rpx;
  flex-shrink: 0;
  background: #f5f5f5;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.top {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}
.name {
  font-size: 30rpx;
  font-weight: 600;
  color: #171717;
}
.tags {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
}
.tag {
  padding: 2rpx 16rpx;
  border-radius: 9999rpx;
  font-size: 20rpx;
  font-weight: 500;
}
.tag-pink { background: #fce7f3; color: #f472b6; }
.tag-purple { background: #f3e8ff; color: #a855f7; }
.tag-blue { background: #e0f2fe; color: #0ea5e9; }
.tag-yellow { background: #fff9c4; color: #b45309; }
.desc {
  font-size: 26rpx;
  color: #737373;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.price {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}
.amount {
  font-size: 32rpx;
  font-weight: 700;
  color: #ef4444;
}
.unit {
  font-size: 22rpx;
  color: #737373;
}
.cta {
  flex-shrink: 0;
  background: #ffd60a;
  color: #171717;
  font-size: 26rpx;
  font-weight: 600;
  padding: 16rpx 28rpx;
  border-radius: 9999rpx;
  white-space: nowrap;
}
</style>
