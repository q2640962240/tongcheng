<template>
  <view class="page">
    <view class="bg"></view>
    <view class="overlay"></view>

    <view class="content">
      <view class="brand">
        <view class="logo">白</view>
        <text class="brand-name">白夜</text>
      </view>
      <text class="slogan">白夜 · 陪你度过每一刻</text>

      <view class="form">
        <!-- Tab 切换 -->
        <view class="tabs">
          <view
            class="tab-item"
            :class="{ active: tab === 'code' }"
            @tap="tab = 'code'"
          >验证码登录</view>
          <view
            class="tab-item"
            :class="{ active: tab === 'pwd' }"
            @tap="tab = 'pwd'"
          >密码登录</view>
          <view class="tab-line"></view>
        </view>

        <view class="input-group">
          <text class="label">手机号</text>
          <input
            v-model="phone"
            class="input"
            type="number"
            maxlength="11"
            placeholder="请输入手机号"
          />
        </view>

        <!-- 验证码 Tab -->
        <block v-if="tab === 'code'">
          <view class="input-group">
            <text class="label">验证码</text>
            <view class="code-row">
              <input
                v-model="code"
                class="input code-input"
                type="number"
                maxlength="6"
                placeholder="请输入验证码"
              />
              <view
                class="code-btn"
                :class="{ disabled: counting > 0 }"
                @tap="onSendCode"
              >{{ counting > 0 ? `${counting}s` : '获取验证码' }}</view>
            </view>
          </view>
        </block>

        <!-- 密码 Tab -->
        <block v-else>
          <view class="input-group">
            <text class="label">密码</text>
            <view class="pwd-row">
              <input
                v-model="password"
                class="input code-input"
                :password="!showPwd"
                maxlength="32"
                placeholder="请输入登录密码"
              />
              <view class="code-btn toggle-pwd" @tap="showPwd = !showPwd">
                {{ showPwd ? '隐藏' : '显示' }}
              </view>
            </view>
          </view>
          <view class="forget-row">
            <text class="forget" @tap="onForgotPwd">忘记密码？短信找回</text>
          </view>
        </block>

        <view class="btn-login" @tap="tab === 'code' ? onLoginByCode() : onLoginByPwd()">
          {{ tab === 'code' ? '登录 / 注册' : '登录' }}
        </view>
      </view>

      <view class="agreement">
        <text>登录即代表同意</text>
        <text class="link">《用户协议》</text>
        <text>和</text>
        <text class="link">《隐私政策》</text>
      </view>
    </view>

    <!-- 注册后引导设置密码 -->
    <view class="modal-root" v-if="showSetPwd">
      <view class="modal-mask" @tap="showSetPwd = false"></view>
      <view class="modal-card">
        <view class="m-title">
          <text class="m-emoji">🎉</text>
          <text>欢迎加入白夜</text>
        </view>
        <text class="m-desc">
          为了您下次更快速、更安全地登录，建议立即设置独立登录密码；之后也可在「我的 → 设置 → 账号安全」中修改。
        </text>
        <view class="input-group m-input">
          <text class="label">登录密码（6-32 位）</text>
          <input v-model="newPwd" class="input" :password="!showNewPwd" maxlength="32" placeholder="请输入密码" />
        </view>
        <view class="input-group m-input">
          <text class="label">再次输入密码</text>
          <input v-model="newPwd2" class="input" :password="!showNewPwd" maxlength="32" placeholder="请再次输入密码" />
        </view>
        <view class="m-row">
          <view class="m-btn cancel" @tap="onCloseLater">稍后设置</view>
          <view class="m-btn confirm" @tap="onSavePwd">立即设置</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '../../store/user'
import { authApi } from '../../api'

const userStore = useUserStore()
const tab = ref('code')
const phone = ref('')
const code = ref('')
const password = ref('')
const showPwd = ref(false)
const counting = ref(0)
const showSetPwd = ref(false)
const newPwd = ref('')
const newPwd2 = ref('')
const showNewPwd = ref(false)
let lastLoginPhone = ''
const SKIP_SET_PWD_KEY = 'companion_skip_set_pwd'

const markPasswordSet = () => {
  // 兼容修复：设置密码成功后立即更新本地 user.hasPassword，避免退出后密码登录
  // 再被服务端误判（服务端是对的，但本地 refresh 前 user 快照可能仍是 false）
  try {
    const u = { ...(userStore.user || {}) }
    u.hasPassword = true
    u.needSetPassword = false
    userStore.user = u
    try {
      const USER_KEY = 'companion_user'
      uni.setStorageSync(USER_KEY, JSON.stringify(u))
    } catch (_) {}
  } catch (_) {}
}

const onSendCode = async (scene = 'login') => {
  if (counting.value > 0) return
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  try {
    const res = await userStore.sendCode(phone.value, scene)
    if (res && res.code) {
      code.value = res.code
      uni.showToast({ title: `验证码：${res.code}`, icon: 'none', duration: 3000 })
    } else {
      uni.showToast({ title: '验证码已发送', icon: 'success' })
    }
    counting.value = 60
    const timer = setInterval(() => {
      counting.value--
      if (counting.value <= 0) clearInterval(timer)
    }, 1000)
  } catch (_) {}
}

const goHome = (delayMs = 400) => {
  setTimeout(() => uni.switchTab({
    url: '/pages/home/home',
    fail: () => uni.reLaunch({ url: '/pages/home/home' })
  }), delayMs)
}

const onAfterLogin = async (loginData) => {
  lastLoginPhone = phone.value
  uni.showToast({ title: '登录成功', icon: 'success' })
  // 新注册或尚未设置密码 → 引导设置（但用户之前点过"稍后设置"就不再弹，避免烦扰）
  const user = loginData && loginData.user
  let skipLater = false
  try { skipLater = !!uni.getStorageSync(SKIP_SET_PWD_KEY) } catch (_) {}
  if (user && (user.needSetPassword || user.isNew || user.hasPassword === false) && !skipLater) {
    setTimeout(() => { showSetPwd.value = true }, 450)
  } else {
    goHome(500)
  }
}

const onLoginByCode = async () => {
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  if (code.value.length < 4) {
    uni.showToast({ title: '请输入验证码', icon: 'none' })
    return
  }
  try {
    const loginData = await userStore.loginByCode(phone.value, code.value)
    await onAfterLogin(loginData)
  } catch (_) {}
}

const onLoginByPwd = async () => {
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  if (!password.value) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return
  }
  try {
    const loginData = await userStore.loginByPassword(phone.value, password.value)
    await onAfterLogin(loginData)
  } catch (_) {}
}

const onForgotPwd = () => {
  uni.showModal({
    title: '重置密码',
    content: '将通过短信验证码重置密码，是否继续？',
    confirmText: '去重置',
    success: (r) => {
      if (r.confirm) {
        uni.navigateTo({ url: '/pages/reset-password/reset-password' })
      }
    }
  })
}

const onCloseLater = () => {
  // 用户点稍后设置 → 记住这个选择（下次登录不再弹）并直接进首页，**不能只是关遮罩**
  try { uni.setStorageSync(SKIP_SET_PWD_KEY, 1) } catch (_) {}
  showSetPwd.value = false
  goHome(200)
}

const onSavePwd = async () => {
  if (newPwd.value.length < 6 || newPwd.value.length > 32) {
    uni.showToast({ title: '密码长度 6-32 位', icon: 'none' })
    return
  }
  if (newPwd.value !== newPwd2.value) {
    uni.showToast({ title: '两次输入不一致', icon: 'none' })
    return
  }
  try {
    await authApi.setPassword({ newPassword: newPwd.value })
    markPasswordSet()
    try { uni.removeStorageSync(SKIP_SET_PWD_KEY) } catch (_) {}
    uni.showToast({ title: '密码已设置成功', icon: 'success' })
    showSetPwd.value = false
    goHome(400)
  } catch (_) {}
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
  padding: 180rpx 48rpx 80rpx;
  min-height: 100vh;
  justify-content: space-between;
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
.form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}
.tabs {
  position: relative;
  display: flex;
  border-radius: 18rpx;
  background: rgba(255,255,255,0.06);
  border: 1rpx solid rgba(255,255,255,0.08);
  padding: 6rpx;
}
.tab-item {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  font-size: 28rpx;
  color: rgba(255,255,255,0.7);
  font-weight: 500;
  position: relative;
  z-index: 1;
  transition: color 0.2s;
  &.active { color: #0B0F1A; font-weight: 700; }
}
.tab-line {
  position: absolute;
  top: 6rpx; bottom: 6rpx;
  width: calc(50% - 6rpx);
  border-radius: 14rpx;
  background: linear-gradient(135deg, #F5D583 0%, #D4AF37 100%);
  box-shadow: 0 10rpx 28rpx rgba(212,175,55,0.35);
  transition: transform 0.25s ease;
  transform: translateX(0);
  .tab-item:nth-child(2).active ~ & { transform: translateX(100%); }
  /* fallback：用 JS 的话再控制；此处通过父组件顺序 + ~ 无法完全对上，用 JS 样式控制更稳 */
}
.tabs .tab-item.active:nth-child(1) ~ .tab-line { transform: translateX(0); }
.tabs .tab-item.active:nth-child(2) ~ .tab-line { transform: translateX(calc(100% + 6rpx)); }
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
    background: #e5e5e5;
    color: #737373;
    box-shadow: none;
  }
}
.toggle-pwd {
  background: rgba(255,255,255,0.18);
  color: #fff;
  border: 1rpx solid rgba(255,255,255,0.2);
  box-shadow: none;
}
.forget-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -12rpx;
}
.forget {
  font-size: 24rpx;
  color: rgba(255,255,255,0.82);
}
.btn-login {
  height: 100rpx;
  background: linear-gradient(135deg, #F5D583 0%, #D4AF37 100%);
  color: #0B0F1A;
  border-radius: 9999rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 800;
  letter-spacing: 2rpx;
  margin-top: 24rpx;
  box-shadow: 0 18rpx 40rpx rgba(212,175,55,0.35);
  &:active { transform: scale(0.99); }
}
.agreement {
  font-size: 24rpx;
  color: rgba(255,255,255,0.7);
  text-align: center;
}
.link {
  color: #F5D583;
}

/* 引导设置密码 Modal */
.modal-root {
  position: fixed; inset: 0;
  z-index: 99;
}
.modal-mask {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.6);
}
.modal-card {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 620rpx;
  background: #fff;
  border-radius: 28rpx;
  padding: 40rpx 36rpx 32rpx;
  box-shadow: 0 24rpx 60rpx rgba(0,0,0,0.35);
}
.m-title {
  display: flex; align-items: center; justify-content: center;
  gap: 12rpx;
  font-size: 36rpx; font-weight: 700;
  color: #0B0F1A;
}
.m-emoji { font-size: 40rpx; }
.m-desc {
  display: block;
  margin-top: 20rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #555;
}
.m-input {
  margin-top: 24rpx;
}
.m-input .label {
  color: #333;
}
.m-input .input {
  background: #F5F6FA;
  border: 1rpx solid #E6E8EF;
}
.m-row {
  display: flex;
  gap: 20rpx;
  margin-top: 36rpx;
}
.m-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 9999rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: 700;
  &.cancel {
    background: #F1F2F7;
    color: #4B5066;
  }
  &.confirm {
    background: linear-gradient(135deg, #F5D583 0%, #D4AF37 100%);
    color: #0B0F1A;
    box-shadow: 0 14rpx 30rpx rgba(212,175,55,0.35);
  }
}
</style>
