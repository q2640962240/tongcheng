<template>
  <view class="page">
    <view class="header">
      <text class="title">我的</text>
    </view>

    <scroll-view scroll-y class="content-scroll">
      <!-- 1. 用户信息卡 -->
      <view class="user-card" @tap="onUserCardTap">
        <view class="user-aurora"></view>
        <image class="avatar" :src="safeAvatar" mode="aspectFill" />
        <view class="user-info">
          <view class="name-row">
            <text class="name">{{ safeNickname }}</text>
            <text v-if="safeIsElite" class="badge elite-badge">精英</text>
            <text v-if="cert.realPerson === 'passed'" class="badge real-badge">真人</text>
          </view>
          <view class="auth-row" v-if="isLoggedIn">
            <text class="uid-text">ID: {{ userStore.userId || '-' }}</text>
          </view>
          <view class="auth-row" v-else>
            <text class="auth-tag login-tag">点击登录 / 注册白夜账号</text>
          </view>
        </view>
        <view class="arrow" v-if="isLoggedIn">›</view>
      </view>

      <!-- 2. 社交数据栏 -->
      <view class="social-bar" v-if="isLoggedIn">
        <view class="social-item" @tap="onNavWithLogin('/pages/follow-list/follow-list?tab=following')">
          <text class="social-num">{{ socialStats.followingCount }}</text>
          <text class="social-label">关注</text>
        </view>
        <view class="social-divider"></view>
        <view class="social-item" @tap="onNavWithLogin('/pages/follow-list/follow-list?tab=followers')">
          <text class="social-num">{{ socialStats.followersCount }}</text>
          <text class="social-label">粉丝</text>
        </view>
        <view class="social-divider"></view>
        <view class="social-item" @tap="onNav('/pages/discover/discover?tab=posts')">
          <text class="social-num">{{ socialStats.postsCount }}</text>
          <text class="social-label">动态</text>
        </view>
      </view>

      <!-- 3. 认证状态条 -->
      <view class="cert-card" @tap="onNavWithLogin('/pages/verification-hub/verification-hub')" v-if="isLoggedIn">
        <view class="cert-row">
          <view class="cert-left">
            <text class="cert-icon">👑</text>
            <text class="cert-name">精英认证</text>
          </view>
          <view class="cert-status" :class="safeIsElite ? 'active' : 'inactive'">
            <text v-if="safeIsElite" class="cert-badge elite-tag">精英会员</text>
            <text v-else class="cert-action">去认证 →</text>
          </view>
        </view>
        <view class="cert-divider"></view>
        <view class="cert-row">
          <view class="cert-left">
            <text class="cert-icon">✓</text>
            <text class="cert-name">真人认证</text>
          </view>
          <view class="cert-status" :class="cert.realPerson === 'passed' ? 'active' : 'inactive'">
            <text v-if="cert.realPerson === 'passed'" class="cert-badge real-tag">已认证</text>
            <text v-else class="cert-action">去认证 →</text>
          </view>
        </view>
      </view>

      <!-- 4. 简化钱包模块 -->
      <view class="wallet-card" v-if="isLoggedIn">
        <view class="wallet-glow"></view>
        <view class="wallet-head">
          <text class="wallet-title">我的钱包</text>
        </view>
        <view class="wallet-row">
          <view class="wallet-item">
            <text class="wallet-num">{{ safeDiamond }}</text>
            <text class="wallet-label">💎 钻石</text>
            <view class="wallet-action recharge-btn" @tap="onRecharge">充值</view>
          </view>
          <view class="wallet-divider"></view>
          <view class="wallet-item">
            <text class="wallet-num income">{{ incomeYuan }}</text>
            <text class="wallet-label">¥ 礼物收入</text>
            <view class="wallet-action withdraw-btn" @tap="onIncome">提现</view>
          </view>
        </view>
      </view>

      <!-- 5. 功能入口 8 宫格 (2行×4列) -->
      <view class="modules">
        <view class="module-item" @tap="onNav('/pages/discover/discover?tab=posts')">
          <view class="m-icon-wrap"><text class="m-icon">📝</text></view>
          <text class="m-label">我的动态</text>
        </view>
        <view class="module-item" @tap="onNav('/pages/discover/discover?tab=groups')">
          <view class="m-icon-wrap"><text class="m-icon">🎯</text></view>
          <text class="m-label">我的组局</text>
        </view>
        <view class="module-item" @tap="onNavWithLogin('/pages/follow-list/follow-list')">
          <view class="m-icon-wrap"><text class="m-icon">👥</text></view>
          <text class="m-label">关注/粉丝</text>
        </view>
        <view class="module-item" @tap="onNavWithLogin('/pages/invite/invite')">
          <view class="m-icon-wrap"><text class="m-icon">🎁</text></view>
          <text class="m-label">邀请好友</text>
        </view>
        <view class="module-item" :class="{ 'elite-on': safeIsElite }" @tap="onElite">
          <view class="m-icon-wrap aurora"><text class="m-icon">👑</text></view>
          <text class="m-label">精英特权</text>
        </view>
        <view class="module-item" @tap="onCustomerService">
          <view class="m-icon-wrap"><text class="m-icon">🎧</text></view>
          <text class="m-label">联系客服</text>
        </view>
        <view class="module-item" @tap="onNav('/pages/feedback/feedback')">
          <view class="m-icon-wrap"><text class="m-icon">📋</text></view>
          <text class="m-label">反馈问题</text>
        </view>
        <view class="module-item" @tap="onNav('/pages/settings/settings')">
          <view class="m-icon-wrap"><text class="m-icon">⚙️</text></view>
          <text class="m-label">设置</text>
        </view>
      </view>

      <!-- 退出登录 -->
      <view v-if="isLoggedIn" class="logout-btn" @tap="onLogout">退出登录</view>

      <view class="bottom-safe"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../store/user'
import { useWalletStore } from '../../store/wallet'
import { userApi } from '../../api'
import {
  guard, unwrap, toObj, toStr, toNum, toBool,
  requireLogin, requireElite, avatarUrl
} from '../../utils/fallback'

const userStore = useUserStore()
const walletStore = useWalletStore()

// ---- 字段收敛：userStore ----
const isLoggedIn = computed(() => toBool(userStore.isLoggedIn, false))

const safeAvatar = computed(() => {
  const raw = toStr(userStore.avatar, '')
  return avatarUrl(raw)
})

const safeNickname = computed(() => {
  if (!isLoggedIn.value) return '登录/注册'
  const raw = toStr(userStore.nickname, '')
  return raw || '白夜用户'
})

const safeIsElite = computed(() => toBool(userStore.isElite, false))

// ---- 字段收敛：wallet ----
const safeDiamond = computed(() => toNum(walletStore.diamond, 0))

const incomeYuan = computed(() => {
  const fen = toNum(walletStore.income, 0)
  const n = Number(fen)
  if (!Number.isFinite(n)) return '0.00'
  return (n / 100).toFixed(2)
})

// ---- 社交统计 ----
const socialStats = ref({
  followingCount: 0,
  followersCount: 0,
  postsCount: 0
})

// ---- 字段收敛：cert ----
const cert = ref({ realPerson: 'none', identity: 'none' })

const refreshCert = async () => {
  if (!isLoggedIn.value) {
    cert.value = toObj({ realPerson: 'none', identity: 'none' }, { realPerson: 'none', identity: 'none' })
    return
  }
  try {
    const data = await guard(
      userApi.certifications().then(r => unwrap(r, null)),
      null
    )
    const obj = toObj(data, { realPerson: 'none', identity: 'none' })
    cert.value = {
      realPerson: toStr(obj.realPerson, 'none'),
      identity: toStr(obj.identity, 'none')
    }
  } catch (_) {
    cert.value = toObj({ realPerson: 'none', identity: 'none' }, { realPerson: 'none', identity: 'none' })
  }
}

// ---- 刷新社交统计 ----
const refreshSocialStats = async () => {
  if (!isLoggedIn.value) return
  try {
    const profile = await guard(
      userApi.profile().then(r => unwrap(r, null)),
      null
    )
    const obj = toObj(profile, {})
    socialStats.value = {
      followingCount: toNum(obj.followingCount, 0),
      followersCount: toNum(obj.followersCount, 0),
      postsCount: toNum(obj.postsCount, 0)
    }
  } catch (_) {
    /* 静默 */
  }
}

// ---- 并行加载：profile + balance + certifications + socialStats ----
const loadAll = async () => {
  if (!isLoggedIn.value) return
  try {
    await Promise.all([
      guard(userStore.fetchProfile().catch(() => null), null),
      guard(walletStore.fetchBalance().catch(() => null), null),
      refreshCert(),
      refreshSocialStats()
    ])
  } catch (_) {
    /* 并行异常全部吞 */
  }
}

// ---- 导航与守卫 ----
const onNav = (url) => uni.navigateTo({ url })

const onNavWithLogin = (url) => {
  if (!requireLogin()) return
  const eliteOnly = /\/(elite-pay)\//.test(url)
  if (eliteOnly && !requireElite()) return
  uni.navigateTo({ url })
}

const onUserCardTap = () => {
  if (!isLoggedIn.value) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  uni.navigateTo({ url: '/pages/profile-edit/profile-edit' })
}

const onRecharge = () => {
  if (!requireLogin()) return
  uni.navigateTo({ url: '/pages/recharge/recharge' })
}

const onIncome = () => {
  if (!requireElite()) return
  uni.navigateTo({ url: '/pages/withdraw/withdraw' })
}

const onElite = () => {
  if (!requireLogin()) return
  if (safeIsElite.value) {
    uni.showModal({
      title: '白夜精英',
      content: '您已开通精英特权，享受 6 大专属权益。',
      confirmText: '查看权益',
      cancelText: '知道了',
      success: (r) => { if (r.confirm) uni.navigateTo({ url: '/pages/elite-pay/elite-pay' }); },
    });
  } else {
    uni.navigateTo({ url: '/pages/elite-pay/elite-pay' });
  }
}

const onCustomerService = async () => {
  try {
    const respData = await guard(
      userApi.kefu().then(r => unwrap(r, null)),
      null
    )
    const obj = toObj(respData, {})
    const wechat = toStr(obj.wechat, '')
    if (wechat) {
      uni.showModal({
        title: '联系客服',
        content: `客服微信号：${wechat}\n点击确定复制微信号`,
        confirmText: '复制',
        success: (r) => {
          if (r.confirm) {
            uni.setClipboardData({
              data: wechat,
              success: () => uni.showToast({ title: '微信号已复制', icon: 'success' })
            })
          }
        }
      })
    } else {
      uni.showModal({
        title: '联系客服',
        content: '暂未配置客服微信，请通过「意见反馈」联系我们',
        showCancel: false,
        confirmText: '去反馈',
        success: () => uni.navigateTo({ url: '/pages/feedback/feedback' })
      })
    }
  } catch (_) {
    uni.showModal({
      title: '联系客服',
      content: '获取客服信息失败，请通过「意见反馈」联系我们',
      showCancel: false,
      confirmText: '去反馈',
      success: () => uni.navigateTo({ url: '/pages/feedback/feedback' })
    })
  }
}

const onLogout = () => {
  uni.showModal({
    title: '退出登录',
    content: '确认退出当前账号？',
    confirmText: '确认退出',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) userStore.logout()
    }
  })
}

onMounted(() => {
  if (isLoggedIn.value) loadAll()
})
onShow(() => {
  userStore.restoreSession()
  if (isLoggedIn.value) loadAll()
  else cert.value = toObj({ realPerson: 'none', identity: 'none' }, { realPerson: 'none', identity: 'none' })
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: $by-bg; }

.header {
  display: flex; align-items: center; justify-content: center;
  padding: env(safe-area-inset-top) $by-page-pad-x 0;
  height: calc($by-topbar-h + env(safe-area-inset-top));
  position: sticky; top: 0;
  background: $by-bg;
  border-bottom: 1rpx solid $by-border; z-index: 10;
}
.title { font-size: 36rpx; font-weight: 700; color: $by-text-1; }

.content-scroll {
  height: calc(100vh - #{$by-topbar-h} - env(safe-area-inset-top));
  padding: 24rpx $by-page-pad-x;
}

/* ===== User Card ===== */
.user-card {
  display: flex; align-items: center; gap: 24rpx;
  background: $by-card-bg;
  border-radius: 32rpx; padding: 32rpx; margin-bottom: 20rpx;
  border: 1rpx solid $by-border;
  position: relative; overflow: hidden;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.995); }
}
.user-aurora {
  position: absolute; top: -60rpx; right: -60rpx;
  width: 240rpx; height: 240rpx; border-radius: 50%;
  background: $by-gradient-aurora;
  filter: blur(60rpx); opacity: 0.18;
  pointer-events: none;
}
.avatar {
  width: 140rpx; height: 140rpx; border-radius: $by-radius-pill;
  background: $by-soft-card;
  border: 3rpx solid color.adjust($by-gold, $alpha: 0.4);
  position: relative; z-index: 1;
}
.user-info { flex: 1; min-width: 0; position: relative; z-index: 1; }
.name-row { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
.name { font-size: 38rpx; font-weight: 700; color: $by-text-1; }
.badge {
  font-size: 20rpx; font-weight: 600;
  padding: 4rpx 16rpx; border-radius: $by-radius-pill;
}
.elite-badge {
  background: $by-gradient-gold; color: #0B0F1A;
  box-shadow: $by-shadow-gold;
}
.real-badge {
  background: color.adjust($by-success, $alpha: 0.16);
  color: $by-success;
  border: 1rpx solid color.adjust($by-success, $alpha: 0.3);
}
.auth-row { margin-top: 12rpx; }
.uid-text { font-size: 24rpx; color: $by-text-3; }
.auth-tag {
  font-size: 22rpx; padding: 6rpx 16rpx; border-radius: $by-radius-sm;
}
.auth-tag.login-tag {
  background: color.adjust($by-gold, $alpha: 0.12);
  color: $by-gold-soft;
  border: 1rpx solid color.adjust($by-gold, $alpha: 0.25);
}
.arrow {
  color: $by-text-3; font-size: 44rpx; font-weight: 300;
  padding-left: 8rpx;
}

/* ===== Social Bar ===== */
.social-bar {
  display: flex; align-items: center;
  background: $by-card-bg;
  border-radius: 24rpx; padding: 28rpx 0;
  margin-bottom: 20rpx;
  border: 1rpx solid $by-border;
}
.social-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  &:active { background: rgba(255,255,255,0.03); border-radius: 16rpx; }
}
.social-num {
  font-size: 40rpx; font-weight: 700; color: $by-text-1;
}
.social-label {
  font-size: 22rpx; color: $by-text-3;
}
.social-divider {
  width: 2rpx; height: 56rpx;
  background: linear-gradient(180deg, transparent 0%, $by-border-strong 50%, transparent 100%);
  flex-shrink: 0;
}

/* ===== Cert Card ===== */
.cert-card {
  background: $by-card-bg;
  border-radius: 24rpx; padding: 8rpx 28rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid $by-border;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.995); }
}
.cert-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 22rpx 0;
}
.cert-left {
  display: flex; align-items: center; gap: 16rpx;
}
.cert-icon { font-size: 32rpx; }
.cert-name { font-size: 28rpx; color: $by-text-1; font-weight: 500; }
.cert-status {
  display: flex; align-items: center;
}
.cert-badge {
  font-size: 22rpx; font-weight: 600;
  padding: 6rpx 20rpx; border-radius: $by-radius-pill;
}
.elite-tag {
  background: $by-gradient-gold; color: #0B0F1A;
  box-shadow: $by-shadow-gold;
}
.real-tag {
  background: color.adjust($by-success, $alpha: 0.16);
  color: $by-success;
  border: 1rpx solid color.adjust($by-success, $alpha: 0.3);
}
.cert-action {
  font-size: 24rpx; color: $by-gold-soft; font-weight: 500;
}
.cert-divider {
  height: 1rpx;
  background: $by-border;
}

/* ===== Wallet Card ===== */
.wallet-card {
  position: relative;
  background: linear-gradient(135deg, $by-bg-soft 0%, $by-surface 100%);
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid $by-border;
  overflow: hidden;
}
.wallet-glow {
  position: absolute; top: 0; left: 0; right: 0; height: 4rpx;
  background: $by-gradient-gold;
  box-shadow: 0 0 30rpx color.adjust($by-gold, $alpha: 0.5);
}
.wallet-head {
  position: relative; z-index: 1;
  margin-bottom: 20rpx;
}
.wallet-title {
  font-size: 28rpx; font-weight: 700; color: $by-text-1;
  letter-spacing: 2rpx;
}
.wallet-row {
  position: relative; z-index: 1;
  display: flex; align-items: stretch;
}
.wallet-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  padding: 16rpx 0;
}
.wallet-num {
  font-size: 44rpx; font-weight: 700; color: $by-gold;
  &.income {
    background: $by-gradient-gold;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}
.wallet-label { font-size: 22rpx; color: $by-text-2; }
.wallet-action {
  margin-top: 8rpx;
  font-size: 22rpx; font-weight: 600;
  padding: 8rpx 28rpx; border-radius: $by-radius-pill;
}
.recharge-btn {
  background: $by-gradient-gold; color: #0B0F1A;
  box-shadow: $by-shadow-gold;
}
.recharge-btn:active { transform: scale(0.97); }
.withdraw-btn {
  background: color.adjust($by-gold, $alpha: 0.15);
  color: $by-gold-soft;
  border: 1rpx solid color.adjust($by-gold, $alpha: 0.35);
}
.withdraw-btn:active { background: color.adjust($by-gold, $alpha: 0.25); }
.wallet-divider {
  width: 2rpx;
  background: linear-gradient(180deg, transparent 0%, $by-border-strong 50%, transparent 100%);
  flex-shrink: 0;
}

/* ===== Modules (4 列 × 2 行 = 8 格) ===== */
.modules {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  row-gap: 8rpx;
  column-gap: 4rpx;
  background: $by-card-bg;
  border-radius: 24rpx;
  padding: 24rpx 12rpx;
  margin-bottom: 28rpx;
  border: 1rpx solid $by-border;
}
.module-item {
  display: flex; flex-direction: column; align-items: center; gap: 12rpx;
  padding: 20rpx 4rpx;
  border-radius: 20rpx;
  transition: background 0.15s ease;
  &:active { background: $by-soft-card; }
  &.elite-on .m-icon-wrap.aurora {
    box-shadow: 0 0 20rpx color.adjust($by-aurora-b, $alpha: 0.55);
  }
}
.m-icon-wrap {
  width: 76rpx; height: 76rpx;
  border-radius: 22rpx;
  background: $by-soft-card;
  display: flex; align-items: center; justify-content: center;
  border: 1rpx solid $by-border;
  &.aurora {
    background: linear-gradient(135deg,
      color.adjust($by-aurora-a, $alpha: 0.20) 0%,
      color.adjust($by-aurora-b, $alpha: 0.20) 100%);
    border-color: color.adjust($by-aurora-b, $alpha: 0.32);
  }
}
.m-icon { font-size: 34rpx; }
.m-label {
  font-size: 22rpx;
  color: $by-text-2;
  font-weight: 500;
  text-align: center;
  line-height: 1.3;
  white-space: nowrap;
}

/* ===== Logout ===== */
.logout-btn {
  height: 96rpx;
  background: $by-card-bg;
  color: $by-error;
  border-radius: $by-radius-pill;
  display: flex; align-items: center; justify-content: center;
  font-size: 30rpx; font-weight: 600;
  border: 1rpx solid color.adjust($by-error, $alpha: 0.25);
  transition: background 0.15s ease;
  margin-bottom: 20rpx;
  &:active { background: color.adjust($by-error, $alpha: 0.08); }
}

.bottom-safe {
  height: calc(#{$by-safe-bottom} + 40rpx);
}
</style>
