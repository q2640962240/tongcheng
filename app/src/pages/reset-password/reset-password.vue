<template>
  <view class="page">
    <view class="bg"></view>
    <view class="overlay"></view>

    <view class="content">
      <view class="brand">
        <view class="logo">白</view>
        <text class="brand-name">白夜</text>
      </view>
      <text class="slogan">重置登录密码</text>

      <view class="form">
        <!-- 步骤指示 -->
        <view class="steps">
          <view class="step" :class="{ active: step >= 1, done: step > 1 }">
            <view class="step-dot">1</view>
            <text class="step-label">验证手机</text>
          </view>
          <view class="step-line" :class="{ active: step > 1 }"></view>
          <view class="step" :class="{ active: step >= 2, done: step > 2 }">
            <view class="step-dot">2</view>
            <text class="step-label">输入验证码</text>
          </view>
          <view class="step-line" :class="{ active: step > 2 }"></view>
          <view class="step" :class="{ active: step >= 3 }">
            <view class="step-dot">3</view>
            <text class="step-label">设置新密码</text>
          </view>
        </view>

        <!-- Step 1: 输入手机号 -->
        <view v-if="step === 1" class="step-content">
          <view class="input-group">
            <text class="label">手机号</text>
            <input
              v-model="phone"
              class="input"
              type="number"
              maxlength="11"
              placeholder="请输入注册时的手机号"
            />
          </view>
          <view class="btn-primary" @tap="onSendCode">
            获取验证码
          </view>
        </view>

        <!-- Step 2: 输入验证码 -->
        <view v-if="step === 2" class="step-content">
          <view class="phone-hint">
            <text>验证码已发送至 </text>
            <text class="phone-num">{{ phone }}</text>
          </view>
          <view class="input-group">
            <text class="label">验证码</text>
            <view class="code-row">
              <input
                v-model="code"
                class="input code-input"
                type="number"
                maxlength="6"
                placeholder="请输入6位验证码"
              />
              <view
                class="code-btn"
                :class="{ disabled: counting > 0 }"
                @tap="onResendCode"
              >{{ counting > 0 ? `${counting}s` : '重新发送' }}</view>
            </view>
          </view>
          <view class="btn-primary" @tap="onVerifyCode">
            下一步
          </view>
          <view class="back-link" @tap="step = 1">
            <text>← 更换手机号</text>
          </view>
        </view>

        <!-- Step 3: 设置新密码 -->
        <view v-if="step === 3" class="step-content">
          <view class="input-group">
            <text class="label">新密码</text>
            <view class="pwd-row">
              <input
                v-model="password"
                class="input code-input"
                :password="!showPwd"
                maxlength="32"
                placeholder="请输入新密码（6位以上）"
              />
              <view class="code-btn toggle-pwd" @tap="showPwd = !showPwd">
                {{ showPwd ? '隐藏' : '显示' }}
              </view>
            </view>
          </view>
          <view class="input-group">
            <text class="label">确认密码</text>
            <view class="pwd-row">
              <input
                v-model="password2"
                class="input code-input"
                :password="!showPwd2"
                maxlength="32"
                placeholder="请再次输入新密码"
              />
              <view class="code-btn toggle-pwd" @tap="showPwd2 = !showPwd2">
                {{ showPwd2 ? '隐藏' : '显示' }}
              </view>
            </view>
          </view>
          <view class="btn-primary" @tap="onResetPassword">
            重置密码
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { authApi } from '../../api'

const step = ref(1)
const phone = ref('')
const code = ref('')
const password = ref('')
const password2 = ref('')
const showPwd = ref(false)
const showPwd2 = ref(false)
const counting = ref(0)
let countdownTimer = null

const startCountdown = () => {
  counting.value = 60
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    counting.value--
    if (counting.value <= 0) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

const onSendCode = async () => {
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  try {
    const res = await authApi.sendSms(phone.value, 'reset')
    if (res && res.code) {
      code.value = res.code
      uni.showToast({ title: `验证码：${res.code}`, icon: 'none', duration: 3000 })
    } else {
      uni.showToast({ title: '验证码已发送', icon: 'success' })
    }
    startCountdown()
    step.value = 2
  } catch (e) {
    const msg = (e && e.data && e.data.message) || '发送失败，请稍后重试'
    uni.showToast({ title: msg, icon: 'none' })
  }
}

const onResendCode = async () => {
  if (counting.value > 0) return
  try {
    const res = await authApi.sendSms(phone.value, 'reset')
    if (res && res.code) {
      code.value = res.code
      uni.showToast({ title: `验证码：${res.code}`, icon: 'none', duration: 3000 })
    } else {
      uni.showToast({ title: '验证码已重新发送', icon: 'success' })
    }
    startCountdown()
  } catch (e) {
    uni.showToast({ title: '发送失败，请稍后重试', icon: 'none' })
  }
}

const onVerifyCode = () => {
  if (code.value.length < 6) {
    uni.showToast({ title: '请输入6位验证码', icon: 'none' })
    return
  }
  step.value = 3
}

const onResetPassword = async () => {
  if (password.value.length < 6) {
    uni.showToast({ title: '密码长度至少6位', icon: 'none' })
    return
  }
  if (password.value !== password2.value) {
    uni.showToast({ title: '两次密码输入不一致', icon: 'none' })
    return
  }
  try {
    await authApi.setPassword({
      phone: phone.value,
      password: password.value,
      code: code.value
    })
    uni.showToast({ title: '密码重置成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1200)
  } catch (e) {
    const msg = (e && e.data && e.data.message) || '重置失败，请稍后重试'
    uni.showToast({ title: msg, icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}
.bg {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 20% 10%, rgba(212,175,55,0.35), transparent 55%),
    radial-gradient(circle at 80% 30%, rgba(123,97,255,0.35), transparent 60%),
    linear-gradient(160deg, #0A0C18 0%, #141A36 50%, #1F1338 100%);
}
.overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.35) 100%);
}
.content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 48rpx 80rpx;
  min-height: 100vh;
}
.brand {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.logo {
  width: 80rpx; height: 80rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #F5D583 0%, #D4AF37 100%);
  color: #0B0F1A;
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx; font-weight: 800;
  box-shadow: 0 12rpx 32rpx rgba(212,175,55,0.35);
}
.brand-name {
  font-size: 56rpx;
  font-weight: 800;
  color: #fff;
  letter-spacing: 4rpx;
  background: linear-gradient(90deg, #F5D583 0%, #D4AF37 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.slogan {
  margin-top: 16rpx;
  font-size: 28rpx;
  color: rgba(255,255,255,0.8);
}

/* Steps indicator */
.steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-bottom: 48rpx;
  width: 100%;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.step-dot {
  width: 56rpx; height: 56rpx;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  border: 2rpx solid rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 26rpx; font-weight: 700;
  color: rgba(255,255,255,0.4);
  transition: all 0.3s ease;
}
.step.active .step-dot {
  background: linear-gradient(135deg, #F5D583 0%, #D4AF37 100%);
  border-color: #D4AF37;
  color: #0B0F1A;
  box-shadow: 0 8rpx 24rpx rgba(212,175,55,0.35);
}
.step.done .step-dot {
  background: rgba(34,197,94,0.2);
  border-color: #22C55E;
  color: #22C55E;
}
.step-label {
  font-size: 22rpx;
  color: rgba(255,255,255,0.4);
  transition: color 0.3s ease;
}
.step.active .step-label { color: rgba(255,255,255,0.9); }
.step-line {
  width: 80rpx; height: 2rpx;
  background: rgba(255,255,255,0.15);
  margin: 0 12rpx;
  margin-bottom: 32rpx;
  transition: background 0.3s ease;
  &.active { background: linear-gradient(90deg, #D4AF37, #F5D583); }
}

.form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}
.step-content {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}
.input-group {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.label {
  font-size: 26rpx;
  color: rgba(255,255,255,0.92);
}
.input {
  height: 96rpx;
  background: rgba(255,255,255,0.96);
  border-radius: 18rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: #171717;
}
.code-row, .pwd-row {
  display: flex;
  gap: 16rpx;
}
.code-input { flex: 1; }
.code-btn {
  width: 220rpx;
  height: 96rpx;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #F5D583 0%, #D4AF37 100%);
  color: #0B0F1A;
  border-radius: 18rpx;
  font-size: 26rpx; font-weight: 700;
  box-shadow: 0 10rpx 26rpx rgba(212,175,55,0.3);
  &.disabled {
    background: rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.4);
    box-shadow: none;
  }
}
.toggle-pwd {
  background: rgba(255,255,255,0.18);
  color: #fff;
  border: 1rpx solid rgba(255,255,255,0.2);
  box-shadow: none;
  width: 160rpx;
}

.btn-primary {
  height: 100rpx;
  background: linear-gradient(135deg, #F5D583 0%, #D4AF37 100%);
  color: #0B0F1A;
  border-radius: 9999rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 800;
  letter-spacing: 2rpx;
  box-shadow: 0 18rpx 40rpx rgba(212,175,55,0.35);
  &:active { transform: scale(0.99); }
}

.phone-hint {
  font-size: 26rpx;
  color: rgba(255,255,255,0.7);
  .phone-num {
    color: #F5D583;
    font-weight: 600;
  }
}

.back-link {
  align-self: center;
  font-size: 26rpx;
  color: rgba(255,255,255,0.6);
  &:active { opacity: 0.7; }
}
</style>
