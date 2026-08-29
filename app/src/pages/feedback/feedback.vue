<template>
  <view class="page">
    <view class="card">
      <text class="card-title">选择问题类型</text>
      <view class="types">
        <view
          v-for="t in types"
          :key="t.key"
          class="type-chip"
          :class="{ active: form.type === t.key }"
          @tap="form.type = t.key"
        >{{ t.label }}</view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">问题描述</text>
      <textarea
        v-model="form.content"
        class="textarea"
        placeholder="请详细描述你遇到的问题..."
        maxlength="500"
        :auto-height="false"
      />
      <text class="counter">{{ form.content.length }}/500</text>
    </view>

    <view class="card">
      <text class="card-title">上传截图（可选）</text>
      <view class="images">
        <view v-for="(img, i) in form.images" :key="i" class="img-item">
          <image class="img" :src="img" mode="aspectFill" />
          <view class="img-del" @tap="form.images.splice(i, 1)">✕</view>
        </view>
        <view v-if="form.images.length < 3" class="upload" @tap="onUpload">+</view>
      </view>
    </view>

    <view v-if="isReport" class="card">
      <text class="card-title">{{ reportLabel }} ID（可选，便于快速定位）</text>
      <input
        v-model="form.targetId"
        class="target-input"
        placeholder="请输入对应ID（没有可不填）"
      />
    </view>

    <view class="tip">
      <text class="tip-icon">💎</text>
      <text class="tip-text">反馈被采纳可获得钻石奖励</text>
    </view>

    <view class="submit-btn" :class="{ disabled: submitting }" @tap="onSubmit">
      {{ submitting ? '提交中...' : '提交反馈' }}
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { feedbackApi, uploadApi } from '../../api'

const types = ref([
  { key: 'bug', label: '功能异常' },
  { key: 'suggest', label: '功能建议' },
  { key: 'complaint', label: '投诉举报' },
  { key: 'report-post', label: '举报动态' },
  { key: 'report-group', label: '举报组局' },
  { key: 'report-user', label: '举报用户' },
  { key: 'other', label: '其他问题' }
])
const form = ref({ type: 'bug', content: '', images: [], targetId: '' })
const submitting = ref(false)
const uploading = ref(false)

const isReport = computed(() => ['report-post', 'report-group', 'report-user', 'complaint'].includes(form.value.type))
const reportLabel = computed(() => {
  const map = { 'report-post': '动态', 'report-group': '组局', 'report-user': '用户', 'complaint': '举报对象' }
  return map[form.value.type] || '对象'
})

const loadTypes = async () => {
  try {
    const res = await feedbackApi.types()
    if (res.data && res.data.length) types.value = res.data
  } catch (e) {}
}

const onUpload = () => {
  if (uploading.value) return
  uni.chooseImage({
    count: 3 - form.value.images.length,
    success: async (res) => {
      uploading.value = true
      uni.showLoading({ title: '上传中...' })
      try {
        const results = await uploadApi.files(res.tempFilePaths)
        form.value.images.push(...results.map(r => r.url))
      } catch (e) {} finally {
        uploading.value = false
        uni.hideLoading()
      }
    }
  })
}

const onSubmit = async () => {
  if (!form.value.content.trim()) {
    uni.showToast({ title: '请填写问题描述', icon: 'none' })
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    const payload = {
      type: form.value.type,
      content: form.value.content.trim(),
      images: form.value.images,
    }
    if (form.value.targetId) payload.targetId = form.value.targetId
    await feedbackApi.submit(payload)
    uni.showToast({ title: '反馈已提交，感谢您的支持', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
  } catch (e) {} finally {
    submitting.value = false
  }
}

loadTypes()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; padding: 32rpx; }
.card {
  background: #ffffff; border-radius: 32rpx; padding: 32rpx; margin-bottom: 24rpx;
}
.card-title { display: block; font-size: 30rpx; font-weight: 600; margin-bottom: 24rpx; }
.types { display: flex; flex-wrap: wrap; gap: 16rpx; }
.type-chip {
  padding: 12rpx 28rpx; border-radius: 9999rpx; background: #f5f5f5;
  font-size: 26rpx; color: #525252;
  &.active { background: #ffd60a; color: #171717; font-weight: 600; }
}
.textarea {
  width: 100%; height: 240rpx; background: #f5f5f5; border-radius: 16rpx;
  padding: 24rpx; font-size: 28rpx; box-sizing: border-box;
}
.counter { display: block; text-align: right; font-size: 22rpx; color: #a3a3a3; margin-top: 8rpx; }
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
  display: flex; align-items: center; justify-content: center; font-size: 56rpx; color: #a3a3a3;
  border: 4rpx dashed #d4d4d4;
}
.tip {
  display: flex; align-items: center; gap: 12rpx; padding: 24rpx;
  background: #fff9c4; border-radius: 16rpx; margin-bottom: 32rpx;
}
.tip-icon { font-size: 32rpx; }
.tip-text { font-size: 26rpx; color: #b45309; }
.target-input {
  width: 100%; height: 88rpx; background: #f5f5f5; border-radius: 16rpx;
  padding: 0 24rpx; font-size: 28rpx; box-sizing: border-box; color: #171717;
}
.submit-btn {
  height: 96rpx; background: #ffd60a; color: #171717;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700;
  &.disabled { background: #e5e5e5; color: #a3a3a3; }
  &:active { opacity: 0.9; }
}
</style>
