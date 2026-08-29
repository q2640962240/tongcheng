<template>
  <view class="page">
    <!-- 服务信息 -->
    <view class="order-card" v-if="order">
      <text class="order-title">{{ order.serviceTitle }}</text>
      <text class="order-no">订单号 {{ order.orderNo }}</text>
    </view>

    <!-- 星级评分 -->
    <view class="card">
      <text class="card-title">服务评分</text>
      <view class="stars">
        <text
          v-for="i in 5"
          :key="i"
          class="star"
          :class="{ on: i <= rating }"
          @tap="rating = i"
        >★</text>
      </view>
      <text class="rating-text">{{ ratingText[rating] || '' }}</text>
    </view>

    <!-- 评价内容 -->
    <view class="card">
      <text class="card-title">评价内容</text>
      <textarea
        v-model="content"
        class="content-input"
        placeholder="说说本次服务的感受吧（服务态度、专业技能等）"
        maxlength="300"
      />
      <text class="counter">{{ (content || '').length }}/300</text>
    </view>

    <!-- 评价图片 -->
    <view class="card" v-if="!reviewed">
      <text class="card-title">添加图片（可选）</text>
      <view class="images">
        <view v-for="(img, i) in images" :key="i" class="img-item">
          <image class="img" :src="img" mode="aspectFill" />
          <view class="img-del" @tap="images.splice(i, 1)">✕</view>
        </view>
        <view v-if="images.length < 6" class="upload" @tap="onUpload">
          <text class="upload-icon">+</text>
          <text class="upload-text">{{ uploading ? '上传中' : '添加图片' }}</text>
        </view>
      </view>
    </view>

    <!-- 匿名开关 -->
    <view class="card anon-card" @tap="isAnonymous = !isAnonymous">
      <text class="anon-label">匿名评价</text>
      <text class="anon-tip">开启后其他用户看不到你的昵称头像</text>
      <view class="switch" :class="{ on: isAnonymous }">
        <view class="switch-dot"></view>
      </view>
    </view>

    <!-- 提交 -->
    <view class="submit-btn" :class="{ disabled: !rating }" @tap="onSubmit">
      {{ submitting ? '提交中...' : '提交评价' }}
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { orderApi, uploadApi } from '../../api'

const orderId = ref(null)
const order = ref(null)
const rating = ref(5)
const content = ref('')
const images = ref([])
const isAnonymous = ref(false)
const submitting = ref(false)
const uploading = ref(false)
const reviewed = ref(false)

const ratingText = {
  1: '非常差', 2: '较差', 3: '一般', 4: '满意', 5: '超赞'
}

const loadOrder = async () => {
  try {
    const res = await orderApi.detail(orderId.value)
    order.value = res.data
    // 查询是否已评价
    const rv = await orderApi.getReview(orderId.value)
    if (rv.data) {
      reviewed.value = true
      rating.value = rv.data.rating
      content.value = rv.data.content || ''
      isAnonymous.value = !!rv.data.isAnonymous
      uni.showToast({ title: '已评价过该订单', icon: 'none' })
    }
  } catch (e) {}
}

const onUpload = () => {
  if (uploading.value) return
  uni.chooseImage({
    count: 6 - images.value.length,
    success: async (res) => {
      uploading.value = true
      uni.showLoading({ title: '上传中...' })
      try {
        const results = await uploadApi.files(res.tempFilePaths)
        images.value.push(...results.map(r => r.url))
      } catch (e) {} finally {
        uploading.value = false
        uni.hideLoading()
      }
    }
  })
}

const onSubmit = async () => {
  if (!rating.value || submitting.value) return
  if (reviewed.value) {
    uni.showToast({ title: '已评价过该订单', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await orderApi.review(orderId.value, {
      rating: rating.value,
      content: content.value.trim() || undefined,
      images: images.value.length ? images.value : undefined,
      isAnonymous: isAnonymous.value
    })
    uni.showToast({ title: '评价提交成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e) {} finally {
    submitting.value = false
  }
}

onLoad((q) => {
  if (q.orderId) {
    orderId.value = q.orderId
    loadOrder()
  }
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; padding: 32rpx; padding-bottom: 200rpx; }
.order-card {
  background: #ffffff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 24rpx;
  display: flex; flex-direction: column; gap: 8rpx;
}
.order-title { font-size: 32rpx; font-weight: 600; color: #171717; }
.order-no { font-size: 24rpx; color: #a3a3a3; }
.card { background: #ffffff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 24rpx; position: relative; }
.card-title { font-size: 30rpx; font-weight: 600; color: #171717; margin-bottom: 24rpx; display: block; }
.stars { display: flex; justify-content: center; gap: 24rpx; margin-bottom: 16rpx; }
.star {
  font-size: 72rpx; color: #e5e5e5; transition: all 0.15s;
  &.on { color: #ffd60a; transform: scale(1.1); }
}
.rating-text { text-align: center; font-size: 28rpx; color: #525252; display: block; }
.content-input {
  width: 100%; min-height: 240rpx; background: #f5f5f5; border-radius: 16rpx;
  padding: 24rpx; font-size: 28rpx; color: #171717;
}
.counter { position: absolute; right: 32rpx; bottom: 16rpx; font-size: 22rpx; color: #a3a3a3; }
.images { display: flex; gap: 16rpx; flex-wrap: wrap; }
.img-item { position: relative; width: 160rpx; height: 160rpx; }
.img { width: 100%; height: 100%; border-radius: 16rpx; }
.img-del {
  position: absolute; top: -8rpx; right: -8rpx; width: 40rpx; height: 40rpx;
  background: rgba(0,0,0,0.6); color: #ffffff; border-radius: 9999rpx;
  display: flex; align-items: center; justify-content: center; font-size: 20rpx;
}
.upload {
  width: 160rpx; height: 160rpx; background: #f5f5f5; border-radius: 16rpx;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4rpx; border: 4rpx dashed #d4d4d4;
}
.upload-icon { font-size: 48rpx; color: #a3a3a3; }
.upload-text { font-size: 22rpx; color: #a3a3a3; }
.anon-card {
  display: flex; align-items: center; gap: 16rpx; flex-wrap: wrap;
}
.anon-label { font-size: 30rpx; font-weight: 600; color: #171717; }
.anon-tip { flex: 1; font-size: 22rpx; color: #a3a3a3; }
.switch {
  width: 88rpx; height: 48rpx; border-radius: 9999rpx; background: #e5e5e5;
  position: relative; transition: background 0.2s;
  &.on { background: #ffd60a; }
}
.switch-dot {
  position: absolute; top: 4rpx; left: 4rpx; width: 40rpx; height: 40rpx;
  background: #ffffff; border-radius: 9999rpx; transition: left 0.2s;
}
.switch.on .switch-dot { left: 44rpx; }
.submit-btn {
  position: fixed; left: 32rpx; right: 32rpx; bottom: 48rpx;
  height: 96rpx; background: #ffd60a; color: #171717;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700;
  &:active { opacity: 0.85; }
  &.disabled { background: #e5e5e5; color: #a3a3a3; }
}
</style>
