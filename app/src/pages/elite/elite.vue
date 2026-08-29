<template>
  <view class="page">
    <view class="header">
      <text class="back" @tap="onBack">‹</text>
      <text class="title">精英认证</text>
      <view class="placeholder"></view>
    </view>

    <view class="content">
      <view class="hero">
        <view class="hero-icon">👑</view>
        <text class="hero-title">加入精英会员</text>
        <text class="hero-desc">立即加入体验高效邀约，解锁专属权益</text>
      </view>

      <view class="benefits">
        <view class="benefit">
          <text class="b-icon">✅</text>
          <text class="b-text">线下约玩权限</text>
        </view>
        <view class="benefit">
          <text class="b-icon">⚡</text>
          <text class="b-text">优先匹配特权</text>
        </view>
        <view class="benefit">
          <text class="b-icon">🌟</text>
          <text class="b-text">高阶服务解锁</text>
        </view>
        <view class="benefit">
          <text class="b-icon">💎</text>
          <text class="b-text">专属标识展示</text>
        </view>
      </view>

      <view class="form">
        <view class="form-title">填写认证信息</view>

        <view class="input-group">
          <text class="label">真实姓名</text>
          <input v-model="form.realName" class="input" placeholder="请输入真实姓名" />
        </view>
        <view class="input-group">
          <text class="label">身份证号</text>
          <input v-model="form.idCard" class="input" placeholder="请输入身份证号" maxlength="18" />
        </view>
        <view class="input-group">
          <text class="label">所在城市</text>
          <picker mode="region" @change="onRegionChange">
            <view class="picker">{{ form.city || '请选择所在城市' }}</view>
          </picker>
        </view>
        <view class="input-group">
          <text class="label">真人认证照片</text>
          <view class="upload-area" @tap="onUploadPhoto">
            <text v-if="!form.photo" class="upload-text">+ 点击上传照片</text>
            <image v-else class="preview" :src="form.photo" mode="aspectFill" />
          </view>
        </view>
      </view>

      <view class="btn-submit" @tap="onSubmit">立即加入</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { userApi } from '../../api'
import { useUserStore } from '../../store/user'

const userStore = useUserStore()
const form = ref({
  realName: '',
  idCard: '',
  city: '',
  photo: ''
})
const photoFile = ref('')  // 待上传的本地文件路径
const submitting = ref(false)

const onBack = () => uni.navigateBack()
const onRegionChange = (e) => {
  form.value.city = e.detail.value.map(v => v).join(' ')
}
const onUploadPhoto = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: (res) => {
      photoFile.value = res.tempFilePaths[0]
      form.value.photo = res.tempFilePaths[0]
    }
  })
}
const onSubmit = async () => {
  if (!form.value.realName || !form.value.idCard) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }
  if (!photoFile.value) {
    uni.showToast({ title: '请上传真人认证照片', icon: 'none' })
    return
  }
  submitting.value = true
  uni.showLoading({ title: '提交中...' })
  try {
    // 通过 multipart 接口上传照片 + 表单
    await userApi.applyElite(photoFile.value, {
      realName: form.value.realName,
      idCard: form.value.idCard,
      city: form.value.city
    })
    // 刷新用户状态
    try { await userStore.fetchProfile() } catch (_) {}
    uni.showToast({ title: '认证申请已提交', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
  } catch (e) {} finally {
    submitting.value = false
    uni.hideLoading()
  }
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24rpx; height: 88rpx; position: sticky; top: 0;
  background: rgba(255,255,255,0.95); backdrop-filter: blur(20rpx);
  border-bottom: 2rpx solid #e5e5e5; z-index: 10;
}
.back { font-size: 56rpx; line-height: 1; }
.title { font-size: 34rpx; font-weight: 600; }
.placeholder { width: 56rpx; }
.content { padding: 32rpx; }
.hero {
  background: linear-gradient(135deg, #ffd60a 0%, #ffcc00 100%);
  border-radius: 32rpx; padding: 56rpx 32rpx;
  display: flex; flex-direction: column; align-items: center; gap: 12rpx;
}
.hero-icon { font-size: 88rpx; }
.hero-title { font-size: 40rpx; font-weight: 700; color: #171717; }
.hero-desc { font-size: 26rpx; color: rgba(23,23,23,0.7); }
.benefits {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 16rpx; margin: 32rpx 0;
}
.benefit {
  background: #ffffff; border-radius: 24rpx; padding: 24rpx;
  display: flex; flex-direction: column; align-items: center; gap: 8rpx;
}
.b-icon { font-size: 44rpx; }
.b-text { font-size: 26rpx; font-weight: 500; }
.form {
  background: #ffffff; border-radius: 32rpx; padding: 32rpx;
  display: flex; flex-direction: column; gap: 24rpx; margin-bottom: 32rpx;
}
.form-title { font-size: 32rpx; font-weight: 600; }
.input-group { display: flex; flex-direction: column; gap: 12rpx; }
.label { font-size: 26rpx; color: #525252; }
.input {
  height: 88rpx; background: #f5f5f5; border-radius: 16rpx;
  padding: 0 24rpx; font-size: 28rpx;
}
.picker {
  height: 88rpx; background: #f5f5f5; border-radius: 16rpx;
  padding: 0 24rpx; line-height: 88rpx; font-size: 28rpx; color: #737373;
}
.upload-area {
  height: 240rpx; background: #f5f5f5; border-radius: 16rpx;
  display: flex; align-items: center; justify-content: center;
  border: 4rpx dashed #d4d4d4;
}
.upload-text { font-size: 28rpx; color: #737373; }
.preview { width: 100%; height: 100%; border-radius: 16rpx; }
.btn-submit {
  height: 96rpx; background: #ffd60a; color: #171717;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700;
  &:active { opacity: 0.9; }
}
</style>
