<template>
  <view class="page">
    <!-- 已绑定状态 -->
    <view v-if="binding && !editing" class="bound-card">
      <view class="bound-header">
        <text class="bound-icon">{{ binding.type === 'alipay' ? 'U0001f535' : 'U0001f49a' }}</text>
        <text class="bound-type">{{ binding.type === 'alipay' ? '支付宝' : '微信' }}</text>
      </view>
      <view class="bound-row">
        <text class="bound-label">账号</text>
        <text class="bound-value">{{ maskedAccount }}</text>
      </view>
      <view class="bound-row">
        <text class="bound-label">姓名</text>
        <text class="bound-value">{{ binding.realName }}</text>
      </view>
      <view v-if="binding.qrCode" class="bound-row">
        <text class="bound-label">收款码</text>
        <image class="qr-preview" :src="binding.qrCode" mode="aspectFill" @tap="previewQr" />
      </view>
      <view class="bound-row">
        <text class="bound-label">绑定时间</text>
        <text class="bound-value">{{ formatTime(binding.boundAt) }}</text>
      </view>
      <view class="rebind-btn" @tap="startRebind">修改绑定</view>
    </view>

    <!-- 未绑定 / 修改绑定表单 -->
    <view v-if="!binding || editing" class="form-card">
      <text class="form-title">{{ binding ? '修改收款账号' : '绑定收款账号' }}</text>
      <text class="form-desc">用于提现时接收款项，绑定后修改需验证手机号</text>

      <!-- 收款方式 -->
      <view class="field">
        <text class="field-label">收款方式</text>
        <view class="type-selector">
          <view class="type-opt" :class="{ on: form.type === 'alipay' }" @tap="form.type = 'alipay'">
            <text class="type-icon">U0001f535</text>
            <text class="type-name">支付宝</text>
          </view>
          <view class="type-opt" :class="{ on: form.type === 'wechat' }" @tap="form.type = 'wechat'">
            <text class="type-icon">U0001f49a</text>
            <text class="type-name">微信</text>
          </view>
        </view>
      </view>

      <!-- 账号 -->
      <view class="field">
        <text class="field-label">{{ form.type === 'alipay' ? '支付宝账号' : '微信号' }}</text>
        <input class="field-input" v-model="form.account" :placeholder="form.type === 'alipay' ? '手机号/邮箱' : '微信号'" />
      </view>

      <!-- 真实姓名 -->
      <view class="field">
        <text class="field-label">真实姓名</text>
        <input class="field-input" v-model="form.realName" placeholder="请输入姓名" />
      </view>

      <!-- 收款二维码 -->
      <view class="field">
        <text class="field-label">收款二维码（可选）</text>
        <view class="qr-upload" @tap="chooseQr">
          <image v-if="form.qrCode" class="qr-img" :src="form.qrCode" mode="aspectFill" />
          <view v-else class="qr-placeholder">
            <text class="qr-plus">+</text>
            <text class="qr-hint">点击上传</text>
          </view>
        </view>
      </view>

      <!-- 修改绑定需要验证码 -->
      <view v-if="binding && editing" class="field">
        <text class="field-label">手机验证</text>
        <view class="sms-row">
          <input class="sms-input" v-model="smsCode" placeholder="请输入验证码" maxlength="6" />
          <view class="sms-btn" :class="{ disabled: smsCooldown > 0 }" @tap="sendCode">
            {{ smsCooldown > 0 ? smsCooldown + 's' : '发送验证码' }}
          </view>
        </view>
      </view>

      <!-- 提交 -->
      <view class="submit-btn" :class="{ disabled: !canSubmit || submitting }" @tap="onSubmit">
        {{ submitting ? '提交中...' : '确认绑定' }}
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { paymentApi } from '../../api'

const binding = ref(null)
const editing = ref(false)
const submitting = ref(false)
const smsCode = ref('')
const smsCooldown = ref(0)
let smsTimer = null

const form = ref({
  type: 'alipay',
  account: '',
  realName: '',
  qrCode: ''
})

const maskedAccount = computed(() => {
  if (!binding.value?.account) return ''
  const acc = binding.value.account
  if (acc.length <= 4) return acc
  return acc.slice(0, 2) + '****' + acc.slice(-2)
})

const canSubmit = computed(() => {
  if (!form.value.account.trim() || !form.value.realName.trim()) return false
  if (binding.value && editing.value && !smsCode.value.trim()) return false
  return true
})

const formatTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const fetchBinding = async () => {
  try {
    const r = await paymentApi.getInfo()
    binding.value = r.data?.bound ? r.data : null
  } catch (e) {
    binding.value = null
  }
}

const chooseQr = () => {
  uni.chooseImage({
    count: 1,
    success: (res) => {
      const tempPath = res.tempFilePaths[0]
      uni.uploadFile({
        url: '/api/user/upload-qr',
        filePath: tempPath,
        name: 'file',
        success: (uploadRes) => {
          try {
            const data = JSON.parse(uploadRes.data)
            if (data.code === 0) {
              form.value.qrCode = data.data?.url || tempPath
            }
          } catch (e) {
            form.value.qrCode = tempPath
          }
        },
        fail: () => {
          form.value.qrCode = tempPath
        }
      })
    }
  })
}

const previewQr = () => {
  if (binding.value?.qrCode) {
    uni.previewImage({ urls: [binding.value.qrCode] })
  }
}

const startRebind = () => {
  editing.value = true
  form.value = { type: binding.value?.type || 'alipay', account: '', realName: '', qrCode: '' }
  smsCode.value = ''
}

const sendCode = async () => {
  if (smsCooldown.value > 0) return
  try {
    await paymentApi.sendRebindCode()
    uni.showToast({ title: '验证码已发送', icon: 'success' })
    smsCooldown.value = 60
    smsTimer = setInterval(() => {
      smsCooldown.value--
      if (smsCooldown.value <= 0) clearInterval(smsTimer)
    }, 1000)
  } catch (e) {}
}

const onSubmit = async () => {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    if (!binding.value) {
      await paymentApi.bind({
        type: form.value.type,
        account: form.value.account,
        realName: form.value.realName,
        qrCode: form.value.qrCode || undefined
      })
      uni.showToast({ title: '绑定成功', icon: 'success' })
    } else {
      await paymentApi.rebind({
        code: smsCode.value,
        type: form.value.type,
        account: form.value.account,
        realName: form.value.realName,
        qrCode: form.value.qrCode || undefined
      })
      uni.showToast({ title: '修改成功', icon: 'success' })
    }
    editing.value = false
    await fetchBinding()
  } catch (e) {} finally {
    submitting.value = false
  }
}

onShow(() => {
  fetchBinding()
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; padding: 32rpx; }
.bound-card {
  background: #ffffff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 32rpx;
}
.bound-header { display: flex; align-items: center; gap: 12rpx; margin-bottom: 24rpx; }
.bound-icon { font-size: 40rpx; }
.bound-type { font-size: 32rpx; font-weight: 700; color: #171717; }
.bound-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5;
}
.bound-label { font-size: 26rpx; color: #737373; }
.bound-value { font-size: 28rpx; color: #171717; font-weight: 500; }
.qr-preview { width: 80rpx; height: 80rpx; border-radius: 12rpx; }
.rebind-btn {
  margin-top: 24rpx; text-align: center; padding: 20rpx;
  background: #fff9c4; color: #b45309; border-radius: 16rpx;
  font-size: 28rpx; font-weight: 600;
}
.form-card {
  background: #ffffff; border-radius: 24rpx; padding: 32rpx;
}
.form-title { font-size: 32rpx; font-weight: 700; color: #171717; display: block; margin-bottom: 8rpx; }
.form-desc { font-size: 24rpx; color: #a3a3a3; display: block; margin-bottom: 32rpx; }
.field { margin-bottom: 28rpx; }
.field-label { font-size: 26rpx; color: #525252; display: block; margin-bottom: 12rpx; }
.field-input {
  box-sizing: border-box;
  width: 100%; height: 88rpx; background: #f5f5f5; border-radius: 16rpx;
  padding: 0 24rpx; font-size: 28rpx; color: #171717;
}
.type-selector { display: flex; gap: 16rpx; }
.type-opt {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8rpx;
  padding: 20rpx; border-radius: 16rpx; border: 4rpx solid #e5e5e5;
  &.on { border-color: #ffd60a; background: #fffde6; }
}
.type-icon { font-size: 32rpx; }
.type-name { font-size: 26rpx; color: #171717; }
.qr-upload { width: 160rpx; height: 160rpx; border-radius: 16rpx; overflow: hidden; }
.qr-img { width: 160rpx; height: 160rpx; }
.qr-placeholder {
  width: 160rpx; height: 160rpx; background: #f5f5f5; border-radius: 16rpx;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.qr-plus { font-size: 48rpx; color: #a3a3a3; line-height: 1; }
.qr-hint { font-size: 22rpx; color: #a3a3a3; margin-top: 4rpx; }
.sms-row { display: flex; gap: 16rpx; }
.sms-input {
  flex: 1; height: 88rpx; background: #f5f5f5; border-radius: 16rpx;
  padding: 0 24rpx; font-size: 28rpx; color: #171717;
}
.sms-btn {
  padding: 0 24rpx; height: 88rpx; background: #ffd60a; color: #171717;
  border-radius: 16rpx; display: flex; align-items: center;
  font-size: 26rpx; font-weight: 600; white-space: nowrap;
  &.disabled { background: #e5e5e5; color: #a3a3a3; }
}
.submit-btn {
  margin-top: 32rpx; height: 96rpx; background: #ffd60a; color: #171717;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700;
  &:active { opacity: 0.85; }
  &.disabled { background: #e5e5e5; color: #a3a3a3; }
}
</style>
