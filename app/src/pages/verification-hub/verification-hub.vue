<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="nav-bar">
      <view class="nav-back" @tap="onBack">‹</view>
      <text class="nav-title">认证中心</text>
      <view class="nav-placeholder"></view>
    </view>

    <view class="content">
      <!-- 页面头部 -->
      <view class="page-header">
        <text class="page-header-icon">🛡️</text>
        <text class="page-header-title">认证中心</text>
        <text class="page-header-desc">完成认证，解锁全部社交功能</text>
      </view>

      <!-- 精英认证卡片 -->
      <view class="cert-card" :class="'status-' + eliteStatus">
        <view class="cert-card-header">
          <view class="cert-icon-wrap elite-bg">
            <text class="cert-icon">👑</text>
          </view>
          <view class="cert-header-info">
            <text class="cert-title">精英认证</text>
            <view class="cert-status-tag" :class="'tag-' + eliteStatus">
              <text class="cert-status-text">{{ statusLabel(eliteStatus) }}</text>
            </view>
          </view>
        </view>

        <text class="cert-desc">完成身份验证，解锁发布动态、发起组局、寻人广场展示等功能</text>

        <!-- 权益列表 -->
        <view class="benefits">
          <view class="benefit-item">
            <text class="benefit-check">✓</text>
            <text class="benefit-text">发布动态</text>
          </view>
          <view class="benefit-item">
            <text class="benefit-check">✓</text>
            <text class="benefit-text">发起组局</text>
          </view>
          <view class="benefit-item">
            <text class="benefit-check">✓</text>
            <text class="benefit-text">寻人广场展示</text>
          </view>
          <view class="benefit-item">
            <text class="benefit-check">✓</text>
            <text class="benefit-text">专属 E 标</text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view
          v-if="eliteStatus === 'none'"
          class="cert-btn elite-btn"
          @tap="onApplyElite"
        >
          <text class="cert-btn-text">申请精英认证</text>
        </view>
        <view v-else-if="eliteStatus === 'pending'" class="cert-status-hint pending-hint">
          <text class="hint-icon">⏳</text>
          <text class="hint-text">认证审核中，请耐心等待</text>
        </view>
        <view v-else-if="eliteStatus === 'passed'" class="cert-status-hint passed-hint">
          <text class="hint-icon">✅</text>
          <text class="hint-text">已认证，享受全部精英权益</text>
        </view>
        <view v-else-if="eliteStatus === 'rejected'" class="cert-status-hint rejected-hint">
          <text class="hint-icon">❌</text>
          <text class="hint-text">认证被拒绝，请重新申请</text>
        </view>
        <view
          v-if="eliteStatus === 'rejected'"
          class="cert-btn elite-btn"
          @tap="onApplyElite"
        >
          <text class="cert-btn-text">重新申请</text>
        </view>
      </view>

      <!-- 真人认证卡片 -->
      <view class="cert-card" :class="'status-' + realPersonStatus">
        <view class="cert-card-header">
          <view class="cert-icon-wrap real-bg">
            <text class="cert-icon">📸</text>
          </view>
          <view class="cert-header-info">
            <text class="cert-title">真人认证</text>
            <view class="cert-status-tag" :class="'tag-' + realPersonStatus">
              <text class="cert-status-text">{{ statusLabel(realPersonStatus) }}</text>
            </view>
          </view>
        </view>

        <text class="cert-desc">上传真人照片验证，解锁私聊和打招呼功能</text>

        <!-- 权益列表 -->
        <view class="benefits">
          <view class="benefit-item">
            <text class="benefit-check">✓</text>
            <text class="benefit-text">发起私聊</text>
          </view>
          <view class="benefit-item">
            <text class="benefit-check">✓</text>
            <text class="benefit-text">打招呼</text>
          </view>
          <view class="benefit-item">
            <text class="benefit-check">✓</text>
            <text class="benefit-text">真人标识</text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view
          v-if="realPersonStatus === 'none' || realPersonStatus === 'rejected'"
          class="cert-btn real-btn"
          @tap="onShowRealForm"
        >
          <text class="cert-btn-text">{{ realPersonStatus === 'rejected' ? '重新申请' : '申请真人认证' }}</text>
        </view>
        <view v-else-if="realPersonStatus === 'pending'" class="cert-status-hint pending-hint">
          <text class="hint-icon">⏳</text>
          <text class="hint-text">认证审核中，请耐心等待</text>
        </view>
        <view v-else-if="realPersonStatus === 'passed'" class="cert-status-hint passed-hint">
          <text class="hint-icon">✅</text>
          <text class="hint-text">已认证，真人标识已点亮</text>
        </view>
      </view>

      <!-- 真人认证提交表单（折叠） -->
      <view v-if="showRealForm" class="real-form">
        <view class="form-title">真人认证申请</view>

        <view class="form-group">
          <text class="form-label">真实姓名</text>
          <input
            v-model="realForm.realName"
            class="form-input"
            placeholder="请输入真实姓名"
            placeholder-class="form-placeholder"
          />
        </view>

        <view class="form-group">
          <text class="form-label">真人照片</text>
          <view class="upload-area" @tap="onChoosePhoto">
            <view v-if="!realForm.photo" class="upload-placeholder">
              <text class="upload-icon">📷</text>
              <text class="upload-text">点击上传真人照片</text>
              <text class="upload-hint">请上传清晰的正面免冠照片</text>
            </view>
            <image v-else class="upload-preview" :src="realForm.photo" mode="aspectFill" />
          </view>
        </view>

        <view class="form-actions">
          <view class="form-btn cancel-btn" @tap="showRealForm = false">
            <text class="form-btn-text cancel-text">取消</text>
          </view>
          <view
            class="form-btn submit-btn"
            :class="{ disabled: realSubmitting }"
            @tap="onSubmitReal"
          >
            <text class="form-btn-text submit-text">{{ realSubmitting ? '提交中...' : '提交申请' }}</text>
          </view>
        </view>
      </view>

      <!-- 底部提示 -->
      <view class="bottom-tip">
        <text class="bottom-tip-text">完成认证后即可解锁全部社交功能</text>
        <text v-if="!allVerified" class="bottom-tip-sub">还有认证未完成，快去完成吧 ✨</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { userApi } from '@/api'
import { useUserStore } from '@/store/user'
import { toStr, toObj, toBool, guard, unwrap } from '@/utils/fallback'

const userStore = useUserStore()

// ---- 认证状态 ----
const eliteStatus = ref('none')     // none | pending | passed | rejected
const realPersonStatus = ref('none')

// ---- 真人认证表单 ----
const showRealForm = ref(false)
const realForm = ref({ realName: '', photo: '' })
const realPhotoFile = ref('')
const realSubmitting = ref(false)

// ---- 计算 ----
const allVerified = computed(() =>
  eliteStatus.value === 'passed' && realPersonStatus.value === 'passed'
)

// ---- 数据加载 ----
const loadCertStatus = async () => {
  try {
    // 先尝试从 certifications 接口取
    const data = await guard(userApi.certifications().then(r => unwrap(r, null)), null)
    if (data) {
      const obj = toObj(data, {})
      eliteStatus.value = normalizeStatus(toStr(obj.identity, 'none'))
      realPersonStatus.value = normalizeStatus(toStr(obj.realPerson, 'none'))
      return
    }
  } catch (_) {}

  // 兜底：从 profile 取
  try {
    const profile = await guard(userApi.profile().then(r => unwrap(r, null)), null)
    if (profile) {
      const obj = toObj(profile, {})
      eliteStatus.value = toBool(obj.isElite, false) ? 'passed' : 'none'
      const cert = toObj(obj.certification, {})
      realPersonStatus.value = normalizeStatus(toStr(cert.realPerson, 'none'))
    }
  } catch (_) {}
}

const normalizeStatus = (raw) => {
  const s = toStr(raw, 'none').toLowerCase()
  if (s === 'passed' || s === 'verified' || s === 'approved') return 'passed'
  if (s === 'pending' || s === 'reviewing' || s === 'processing') return 'pending'
  if (s === 'rejected' || s === 'denied' || s === 'failed') return 'rejected'
  return 'none'
}

const statusLabel = (status) => {
  const map = { none: '未认证', pending: '审核中', passed: '已认证', rejected: '已拒绝' }
  return map[status] || '未认证'
}

// ---- 操作 ----
const onBack = () => uni.navigateBack()

const onApplyElite = () => {
  uni.navigateTo({ url: '/pages/elite/elite' })
}

const onShowRealForm = () => {
  showRealForm.value = true
  realForm.value = { realName: '', photo: '' }
  realPhotoFile.value = ''
}

const onChoosePhoto = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: (res) => {
      realPhotoFile.value = res.tempFilePaths[0]
      realForm.value.photo = res.tempFilePaths[0]
    }
  })
}

const onSubmitReal = async () => {
  if (realSubmitting.value) return
  if (!realForm.value.realName.trim()) {
    uni.showToast({ title: '请输入真实姓名', icon: 'none' })
    return
  }
  if (!realPhotoFile.value) {
    uni.showToast({ title: '请上传真人照片', icon: 'none' })
    return
  }
  realSubmitting.value = true
  uni.showLoading({ title: '提交中...' })
  try {
    await userApi.applyElite(realPhotoFile.value, {
      realName: realForm.value.realName,
      type: 'realPerson'
    })
    uni.showToast({ title: '申请已提交', icon: 'success' })
    showRealForm.value = false
    realPersonStatus.value = 'pending'
    // 刷新用户状态
    try { await userStore.fetchProfile() } catch (_) {}
  } catch (_) {
    uni.showToast({ title: '提交失败，请重试', icon: 'none' })
  } finally {
    realSubmitting.value = false
    uni.hideLoading()
  }
}

// ---- 生命周期 ----
onMounted(() => { loadCertStatus() })
onShow(() => { loadCertStatus() })
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: $by-bg;
  padding-bottom: env(safe-area-inset-bottom);
}

/* ===== 导航栏 ===== */
.nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: env(safe-area-inset-top) $by-page-pad-x 0;
  height: calc($by-topbar-h + env(safe-area-inset-top));
  position: sticky; top: 0; z-index: 20;
  background: $by-bg;
  border-bottom: 1rpx solid $by-border;
}
.nav-back {
  font-size: 56rpx; color: $by-text-1; font-weight: 300;
  width: 64rpx; text-align: center; line-height: 1;
}
.nav-title { font-size: 34rpx; font-weight: 700; color: $by-text-1; }
.nav-placeholder { width: 64rpx; }

.content {
  padding: 24rpx $by-page-pad-x;
}

/* ===== 页面头部 ===== */
.page-header {
  display: flex; flex-direction: column; align-items: center;
  padding: 32rpx 0 40rpx;
  gap: 12rpx;
}
.page-header-icon { font-size: 72rpx; }
.page-header-title {
  font-size: 40rpx; font-weight: 700; color: $by-text-1;
}
.page-header-desc {
  font-size: 26rpx; color: $by-text-2;
}

/* ===== 认证卡片 ===== */
.cert-card {
  background: $by-surface;
  border-radius: 32rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border: 2rpx solid $by-border;
  transition: border-color 0.2s ease;

  &.status-none { border-color: $by-border; }
  &.status-pending { border-color: color.adjust($by-warning, $alpha: 0.4); }
  &.status-passed { border-color: color.adjust($by-success, $alpha: 0.4); }
  &.status-rejected { border-color: color.adjust($by-error, $alpha: 0.4); }
}

.cert-card-header {
  display: flex; align-items: center; gap: 20rpx;
  margin-bottom: 20rpx;
}

.cert-icon-wrap {
  width: 88rpx; height: 88rpx; border-radius: 24rpx;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.elite-bg {
  background: linear-gradient(135deg, color.adjust($by-gold, $alpha: 0.2), color.adjust($by-gold-deep, $alpha: 0.2));
  border: 1rpx solid color.adjust($by-gold, $alpha: 0.35);
}
.real-bg {
  background: linear-gradient(135deg, color.adjust($by-aurora-a, $alpha: 0.2), color.adjust($by-aurora-b, $alpha: 0.2));
  border: 1rpx solid color.adjust($by-aurora-b, $alpha: 0.35);
}
.cert-icon { font-size: 40rpx; }

.cert-header-info {
  flex: 1; display: flex; align-items: center; justify-content: space-between;
}
.cert-title {
  font-size: 32rpx; font-weight: 700; color: $by-text-1;
}

.cert-status-tag {
  padding: 6rpx 20rpx; border-radius: $by-radius-pill;
  &.tag-none {
    background: $by-surface-2; border: 1rpx solid $by-border;
  }
  &.tag-pending {
    background: color.adjust($by-warning, $alpha: 0.14);
    border: 1rpx solid color.adjust($by-warning, $alpha: 0.35);
  }
  &.tag-passed {
    background: color.adjust($by-success, $alpha: 0.14);
    border: 1rpx solid color.adjust($by-success, $alpha: 0.35);
  }
  &.tag-rejected {
    background: color.adjust($by-error, $alpha: 0.14);
    border: 1rpx solid color.adjust($by-error, $alpha: 0.35);
  }
}
.cert-status-text {
  font-size: 22rpx; font-weight: 600;
  .tag-none & { color: $by-text-3; }
  .tag-pending & { color: $by-warning; }
  .tag-passed & { color: $by-success; }
  .tag-rejected & { color: $by-error; }
}

.cert-desc {
  font-size: 26rpx; color: $by-text-2; line-height: 1.6;
  margin-bottom: 24rpx;
  display: block;
}

/* ===== 权益列表 ===== */
.benefits {
  display: flex; flex-wrap: wrap; gap: 12rpx;
  margin-bottom: 28rpx;
}
.benefit-item {
  display: flex; align-items: center; gap: 8rpx;
  background: $by-bg-soft;
  padding: 12rpx 20rpx;
  border-radius: $by-radius-md;
  border: 1rpx solid $by-border;
}
.benefit-check {
  font-size: 24rpx; color: $by-success; font-weight: 700;
}
.benefit-text {
  font-size: 24rpx; color: $by-text-2;
}

/* ===== 按钮 ===== */
.cert-btn {
  height: 88rpx; border-radius: $by-radius-pill;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.98); }
}
.elite-btn {
  background: $by-gradient-gold;
  box-shadow: $by-shadow-gold;
}
.elite-btn .cert-btn-text {
  font-size: 28rpx; font-weight: 700; color: #0B0F1A;
}
.real-btn {
  background: linear-gradient(135deg, $by-aurora-a, $by-aurora-b);
}
.real-btn .cert-btn-text {
  font-size: 28rpx; font-weight: 700; color: #FFFFFF;
}

/* ===== 状态提示 ===== */
.cert-status-hint {
  display: flex; align-items: center; gap: 12rpx;
  padding: 20rpx 24rpx;
  border-radius: $by-radius-md;
}
.pending-hint {
  background: color.adjust($by-warning, $alpha: 0.08);
  border: 1rpx solid color.adjust($by-warning, $alpha: 0.2);
}
.passed-hint {
  background: color.adjust($by-success, $alpha: 0.08);
  border: 1rpx solid color.adjust($by-success, $alpha: 0.2);
}
.rejected-hint {
  background: color.adjust($by-error, $alpha: 0.08);
  border: 1rpx solid color.adjust($by-error, $alpha: 0.2);
}
.hint-icon { font-size: 28rpx; }
.hint-text {
  font-size: 26rpx;
  .pending-hint & { color: $by-warning; }
  .passed-hint & { color: $by-success; }
  .rejected-hint & { color: $by-error; }
}

/* ===== 真人认证表单 ===== */
.real-form {
  background: $by-surface;
  border-radius: 32rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid $by-border;
}
.form-title {
  font-size: 30rpx; font-weight: 700; color: $by-text-1;
  margin-bottom: 28rpx;
}
.form-group {
  margin-bottom: 24rpx;
}
.form-label {
  font-size: 26rpx; color: $by-text-2;
  margin-bottom: 12rpx; display: block;
}
.form-input {
  height: 88rpx;
  background: $by-bg-soft;
  border-radius: $by-radius-md;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: $by-text-1;
  border: 1rpx solid $by-border;
}
.form-placeholder {
  color: $by-text-3;
}

.upload-area {
  height: 280rpx;
  background: $by-bg-soft;
  border-radius: $by-radius-lg;
  border: 3rpx dashed $by-border-strong;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  transition: border-color 0.2s ease;
  &:active { border-color: $by-gold; }
}
.upload-placeholder {
  display: flex; flex-direction: column; align-items: center; gap: 10rpx;
}
.upload-icon { font-size: 56rpx; }
.upload-text { font-size: 28rpx; color: $by-text-2; }
.upload-hint { font-size: 22rpx; color: $by-text-3; }
.upload-preview {
  width: 100%; height: 100%;
}

.form-actions {
  display: flex; gap: 16rpx; margin-top: 28rpx;
}
.form-btn {
  flex: 1; height: 88rpx; border-radius: $by-radius-pill;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.98); }
}
.cancel-btn {
  background: $by-surface-2;
  border: 1rpx solid $by-border-strong;
}
.cancel-text { font-size: 28rpx; color: $by-text-2; font-weight: 600; }
.submit-btn {
  background: linear-gradient(135deg, $by-aurora-a, $by-aurora-b);
  &.disabled { opacity: 0.6; }
}
.submit-text { font-size: 28rpx; color: #FFFFFF; font-weight: 700; }

/* ===== 底部提示 ===== */
.bottom-tip {
  display: flex; flex-direction: column; align-items: center;
  padding: 48rpx 0 32rpx;
  gap: 10rpx;
}
.bottom-tip-text {
  font-size: 26rpx; color: $by-text-3;
}
.bottom-tip-sub {
  font-size: 24rpx; color: $by-text-mute;
}
</style>
