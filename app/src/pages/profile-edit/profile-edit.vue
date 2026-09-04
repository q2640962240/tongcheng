<template>
  <view class="page">
    <view class="header">
      <text class="back" @tap="onBack">‹</text>
      <text class="title">编辑资料</text>
      <view class="placeholder"></view>
    </view>

    <view class="content" v-if="form">
      <!-- 头像 -->
      <view class="card">
        <view class="row" @tap="onUploadAvatar">
          <text class="row-label">头像</text>
          <view class="row-value avatar-row">
            <image class="avatar" :src="avatarFull || '/static/avatar-user.png'" mode="aspectFill" />
            <text class="arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 昵称/性别/城市/简介 -->
      <view class="card">
        <view class="row">
          <text class="row-label">昵称</text>
          <input v-model="form.nickname" class="row-input" placeholder="请输入昵称" maxlength="20" />
        </view>
        <view class="divider"></view>
        <view class="row" @tap="showGenderPicker = true">
          <text class="row-label">性别</text>
          <view class="row-value">
            <text class="row-text">{{ genderText }}</text>
            <text class="arrow">›</text>
          </view>
        </view>
        <view class="divider"></view>
        <view class="row" @tap="onChooseCity">
          <text class="row-label">城市</text>
          <view class="row-value">
            <text class="row-text">{{ form.city || '请选择' }}</text>
            <text class="arrow">›</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="bio-wrap">
          <text class="row-label">个人简介</text>
          <textarea
            v-model="form.bio"
            class="bio-input"
            placeholder="介绍一下你自己吧～"
            maxlength="200"
            :auto-height="true"
          />
        </view>
        <view class="bio-count">{{ (form.bio || '').length }}/200</view>
      </view>

      <!-- 不可编辑信息 -->
      <view class="card">
        <view class="row">
          <text class="row-label">手机号</text>
          <view class="row-value">
            <text class="row-text muted">{{ maskPhone(form.phone) }}</text>
          </view>
        </view>
        <view class="divider"></view>
        <view class="row">
          <text class="row-label">精英认证</text>
          <view class="row-value">
            <text class="row-text" :class="form.isElite ? 'success' : 'muted'">
              {{ form.isElite ? '已认证' : '未认证' }}
            </text>
          </view>
        </view>
        <view class="divider"></view>
        <view class="row">
          <text class="row-label">真人认证</text>
          <view class="row-value">
            <text class="row-text" :class="certClass(form.realPersonStatus)">
              {{ certText(form.realPersonStatus) }}
            </text>
          </view>
        </view>
      </view>

      <view class="btn-save" :class="{ disabled: saving }" @tap="onSave">保存</view>
    </view>

    <!-- 性别选择弹层 -->
    <view v-if="showGenderPicker" class="mask" @tap="showGenderPicker = false">
      <view class="picker-sheet" @tap.stop>
        <view class="picker-item" @tap="onPickGender(0)">保密</view>
        <view class="picker-item" @tap="onPickGender(1)">男</view>
        <view class="picker-item" @tap="onPickGender(2)">女</view>
        <view class="picker-cancel" @tap="showGenderPicker = false">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { userApi } from '../../api'
import { useUserStore } from '../../store/user'
import { getCurrentBaseURL } from '../../utils/request'

const userStore = useUserStore()
const form = ref(null)
const avatarFull = ref('')
const saving = ref(false)
const showGenderPicker = ref(false)

const fullUrl = (url) => {
  const s = String(url || '')
  if (!s) return ''
  if (/^(https?:)?\/\//.test(s) || s.startsWith('data:')) return s
  const base = getCurrentBaseURL() || ''
  let host = base.replace(/\/api\/?$/i, '')
  if (!/^https?:\/\//i.test(host)) {
    try {
      if (typeof window !== 'undefined' && window.location) host = window.location.origin
    } catch (_) { host = '' }
  }
  return host + (s.startsWith('/') ? s : '/' + s)
}

const genderText = computed(() => {
  const g = form.value?.gender
  if (g === 1) return '男'
  if (g === 2) return '女'
  return '保密'
})

const certText = (s) => ({ none: '未认证', pending: '审核中', passed: '已认证', rejected: '已拒绝' }[s] || '未认证')
const certClass = (s) => s === 'passed' ? 'success' : s === 'pending' ? 'warn' : s === 'rejected' ? 'danger' : 'muted'

const maskPhone = (p) => {
  if (!p) return '-'
  return p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

const loadProfile = async () => {
  try {
    const res = await userApi.profile()
    form.value = {
      nickname: res.data.nickname || '',
      avatar: res.data.avatar || '',
      gender: res.data.gender || 0,
      city: res.data.city || '',
      bio: res.data.bio || '',
      phone: res.data.phone || '',
      isElite: res.data.isElite,
      realPersonStatus: res.data.realPersonStatus
    }
    avatarFull.value = fullUrl(res.data.avatar)
  } catch (e) {}
}

const onUploadAvatar = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0]
      uni.showLoading({ title: '上传中...' })
      try {
        const data = await userApi.uploadAvatar(filePath)
        avatarFull.value = fullUrl(data.url)
        form.value.avatar = data.url
        uni.showToast({ title: '头像已更新', icon: 'success' })
      } catch (e) {} finally {
        uni.hideLoading()
      }
    }
  })
}

const onChooseCity = () => {
  uni.chooseLocation({
    success: (res) => {
      // 简化：使用城市名作为字符串
      form.value.city = res.address || res.name
    },
    fail: () => {
      // 降级：直接 input
      uni.showModal({
        title: '所在城市',
        editable: true,
        placeholderText: '请输入所在城市',
        content: form.value.city || '',
        success: (r) => {
          if (r.confirm && r.content) form.value.city = r.content
        }
      })
    }
  })
}

const onPickGender = (g) => {
  form.value.gender = g
  showGenderPicker.value = false
}

const onSave = async () => {
  if (saving.value) return
  if (!form.value.nickname.trim()) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return
  }
  saving.value = true
  try {
    await userApi.updateProfile({
      nickname: form.value.nickname.trim(),
      avatar: form.value.avatar,
      gender: form.value.gender,
      city: form.value.city,
      bio: form.value.bio
    })
    // 同步本地用户信息
    try { await userStore.fetchProfile() } catch (_) {}
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e) {} finally {
    saving.value = false
  }
}

const onBack = () => uni.navigateBack()

onLoad(() => {
  loadProfile()
})
onShow(() => {
  // 从其他页面返回时刷新认证状态
  if (form.value) loadProfile()
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24rpx; height: 88rpx; position: sticky; top: 0;
  background: #fffbeb;
  border-bottom: 2rpx solid #e5e5e5; z-index: 10;
}
.back { font-size: 56rpx; line-height: 1; }
.title { font-size: 34rpx; font-weight: 600; }
.placeholder { width: 56rpx; }
.content { padding: 24rpx; }
.card {
  background: #ffffff; border-radius: 24rpx; padding: 0 32rpx;
  margin-bottom: 24rpx;
}
.row {
  display: flex; align-items: center; justify-content: space-between;
  min-height: 96rpx;
}
.row-label { font-size: 28rpx; color: #404040; flex-shrink: 0; }
.row-value { display: flex; align-items: center; gap: 12rpx; min-width: 0; }
.row-text { font-size: 28rpx; color: #171717; }
.row-input { flex: 1; text-align: right; font-size: 28rpx; color: #171717; }
.arrow { color: #a3a3a3; font-size: 40rpx; line-height: 1; }
.avatar-row { gap: 16rpx; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 9999rpx; background: #f5f5f5; }
.divider { height: 2rpx; background: #f5f5f5; }
.bio-wrap { padding: 24rpx 0 8rpx; }
.bio-input {
  width: 100%; margin-top: 12rpx; font-size: 28rpx; color: #171717;
  line-height: 1.6; min-height: 120rpx;
}
.bio-count { text-align: right; font-size: 22rpx; color: #a3a3a3; padding-bottom: 16rpx; }
.muted { color: #a3a3a3; }
.success { color: #10b981; }
.warn { color: #f59e0b; }
.danger { color: #ef4444; }
.btn-save {
  height: 96rpx; background: #ffd60a; color: #171717;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700; margin: 32rpx 0;
  &:active { opacity: 0.9; }
  &.disabled { opacity: 0.5; }
}
.mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100;
  display: flex; align-items: flex-end;
}
.picker-sheet {
  width: 100%; background: #ffffff; border-radius: 32rpx 32rpx 0 0;
  padding: 16rpx 0 calc(16rpx + env(safe-area-inset-bottom));
}
.picker-item {
  height: 96rpx; line-height: 96rpx; text-align: center; font-size: 30rpx; color: #171717;
  border-bottom: 2rpx solid #f5f5f5;
  &:active { background: #f5f5f5; }
}
.picker-cancel {
  height: 96rpx; line-height: 96rpx; text-align: center; font-size: 30rpx; color: #737373;
  margin-top: 16rpx;
}
</style>
