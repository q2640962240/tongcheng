<template>
  <view class="page">
    <view class="header">
      <text class="title">我的</text>
      <view class="icon-btn" @tap="onSettings">⚙</view>
    </view>

    <view class="content">
      <!-- 用户信息 -->
      <view class="user-card" @tap="onUserCardTap">
        <view class="user-aurora"></view>
        <image class="avatar" :src="safeAvatar" mode="aspectFill" />
        <view class="user-info">
          <view class="name-row">
            <text class="name">{{ safeNickname }}</text>
            <text v-if="safeIsElite" class="elite-badge">精英</text>
          </view>
          <view class="auth-row" v-if="isLoggedIn">
            <text class="auth-tag" :class="cert.realPerson === 'passed' ? 'passed' : 'pending'">
              真人{{ cert.realPerson === 'passed' ? '已认证' : '未认证' }}
            </text>
            <text class="auth-tag" :class="cert.identity === 'passed' ? 'passed' : 'pending'">
              身份{{ cert.identity === 'passed' ? '已认证' : '未认证' }}
            </text>
          </view>
          <view class="auth-row" v-else>
            <text class="auth-tag login-tag">点击登录 / 注册白夜账号</text>
          </view>
        </view>
        <view class="arrow" v-if="isLoggedIn">›</view>
      </view>

      <!-- 钱包 -->
      <view class="wallet-card">
        <view class="wallet-glow"></view>
        <view class="wallet-head">
          <text class="wallet-title">我的钱包</text>
          <view class="wallet-head-actions">
            <view class="exchange-btn" @tap="onNavWithLogin('/pages/exchange/exchange')">兑换</view>
            <view class="recharge-btn" @tap="onRecharge">充值</view>
          </view>
        </view>
        <view class="wallet-row">
          <view class="wallet-item" @tap="onRecharge">
            <text class="wallet-num">{{ safeDiamond }}</text>
            <text class="wallet-label">💎 钻石</text>
          </view>
          <view class="wallet-divider"></view>
          <view class="wallet-item" @tap="onRecharge">
            <text class="wallet-num">{{ safeStarCoin }}</text>
            <text class="wallet-label">⭐ 星币</text>
          </view>
          <view class="wallet-divider"></view>
          <view class="wallet-item" @tap="onIncome">
            <text class="wallet-num income">{{ incomeYuan }}</text>
            <text class="wallet-label">¥ 可提现</text>
          </view>
        </view>
      </view>

      <!-- 功能模块（4 列 × 3 行 = 12 格，补齐 12 项避免最后一行缺 1 个造成视觉错位） -->
      <view class="modules">
        <view class="module-item" @tap="onNavWithLogin('/pages/profile-edit/profile-edit')">
          <view class="m-icon-wrap gold"><text class="m-icon">✎</text></view>
          <text class="m-label">编辑资料</text>
        </view>
        <view class="module-item elite-item" :class="{ 'elite-on': safeIsElite }" @tap="onElite">
          <view class="m-icon-wrap aurora"><text class="m-icon">👑</text></view>
          <text class="m-label">{{ safeIsElite ? '精英特权' : '开通精英' }}</text>
        </view>
        <view class="module-item" @tap="onNavWithLogin('/pages/invite/invite')">
          <view class="m-icon-wrap aurora"><text class="m-icon">🎁</text></view>
          <text class="m-label">邀请股东</text>
        </view>
        <view class="module-item" @tap="onNavWithLogin('/pages/order-list/order-list')">
          <view class="m-icon-wrap gold"><text class="m-icon">📦</text></view>
          <text class="m-label">我的订单</text>
        </view>

        <view class="module-item" @tap="onTransactions">
          <view class="m-icon-wrap gold"><text class="m-icon">💰</text></view>
          <text class="m-label">交易记录</text>
        </view>
        <view class="module-item" @tap="onNavWithLogin('/pages/my-services/my-services')">
          <view class="m-icon-wrap gold"><text class="m-icon">📋</text></view>
          <text class="m-label">我的服务</text>
        </view>
        <view class="module-item" @tap="onNavWithLogin('/pages/service-publish/service-publish')">
          <view class="m-icon-wrap aurora"><text class="m-icon">✏️</text></view>
          <text class="m-label">发布服务</text>
        </view>
        <view class="module-item" @tap="onGoMessage">
          <view class="m-icon-wrap"><text class="m-icon">💬</text></view>
          <text class="m-label">消息中心</text>
        </view>

        <view class="module-item" @tap="onCustomerService">
          <view class="m-icon-wrap aurora"><text class="m-icon">🎧</text></view>
          <text class="m-label">联系客服</text>
        </view>
        <view class="module-item" @tap="onNav('/pages/feedback/feedback')">
          <view class="m-icon-wrap"><text class="m-icon">📝</text></view>
          <text class="m-label">反馈问题</text>
        </view>
        <view class="module-item" @tap="onNav('/pages/settings/settings')">
          <view class="m-icon-wrap"><text class="m-icon">⚙️</text></view>
          <text class="m-label">设置</text>
        </view>
        <view class="module-item" @tap="onRecharge">
          <view class="m-icon-wrap gold"><text class="m-icon">💳</text></view>
          <text class="m-label">充值中心</text>
        </view>
      </view>

      <!-- 退出登录 -->
      <view v-if="isLoggedIn" class="logout-btn" @tap="onLogout">退出登录</view>
    </view>
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
const safeStarCoin = computed(() => toNum(walletStore.starCoin, 0))

const incomeYuan = computed(() => {
  const fen = toNum(walletStore.income, 0)
  // fenToYuan 内部再判一次
  const n = Number(fen)
  if (!Number.isFinite(n)) return '0.00'
  return (n / 100).toFixed(2)
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

// ---- 并行加载：profile + balance + certifications ----
const loadAll = async () => {
  if (!isLoggedIn.value) return
  try {
    await Promise.all([
      guard(userStore.fetchProfile().catch(() => null), null),
      guard(walletStore.fetchBalance().catch(() => null), null),
      refreshCert()
    ])
  } catch (_) {
    /* 并行异常全部吞 */
  }
}

// ---- 导航与守卫 ----
const onNav = (url) => uni.navigateTo({ url })

const onNavWithLogin = (url) => {
  if (!requireLogin()) return
  // 精英专属页面（服务发布/我的服务/交易记录/提现等）再叠加 requireElite 守卫，避免 401 → 重复登录死循环
  const eliteOnly = /\/(service-publish|my-services|transactions|withdraw|exchange|elite-pay)\//.test(url)
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

const onSettings = () => uni.navigateTo({ url: '/pages/settings/settings' })

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

const onGoMessage = () => {
  if (!requireLogin()) return
  uni.switchTab({ url: '/TUIKit/components/TUIConversation/index' })
}

const onMyServices = () => onNavWithLogin('/pages/my-services/my-services')
const onTransactions = () => onNavWithLogin('/pages/transactions/transactions')

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
.page { min-height: 100vh; background: $by-bg; padding-bottom: 64rpx; }

.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 $by-page-pad-x; height: $by-topbar-h; position: sticky; top: 0;
  background: $by-bg;
  border-bottom: 1rpx solid $by-border; z-index: 10;
}
.title { font-size: 36rpx; font-weight: 700; color: $by-text-1; }
.icon-btn {
  font-size: 40rpx; color: $by-text-2;
  width: 64rpx; height: 64rpx;
  display: flex; align-items: center; justify-content: center;
  border-radius: $by-radius-pill;
  background: $by-soft-card;
  border: 1rpx solid $by-border;
}

.content { padding: 24rpx $by-page-pad-x; }

/* ===== User Card ===== */
.user-card {
  display: flex; align-items: center; gap: 24rpx;
  background: $by-card-bg;
  border-radius: 32rpx; padding: 32rpx; margin-bottom: 24rpx;
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
  width: 128rpx; height: 128rpx; border-radius: $by-radius-pill;
  background: $by-soft-card;
  border: 3rpx solid color.adjust($by-gold, $alpha: 0.4);
  position: relative; z-index: 1;
}
.user-info { flex: 1; min-width: 0; position: relative; z-index: 1; }
.name-row { display: flex; align-items: center; gap: 12rpx; }
.name { font-size: 36rpx; font-weight: 700; color: $by-text-1; }
.elite-badge {
  background: $by-gradient-gold; color: #0B0F1A;
  font-size: 20rpx; font-weight: 600;
  padding: 6rpx 18rpx; border-radius: $by-radius-pill;
  box-shadow: $by-shadow-gold;
}
.auth-row { display: flex; gap: 12rpx; margin-top: 14rpx; flex-wrap: wrap; }
.auth-tag {
  font-size: 22rpx; padding: 6rpx 16rpx; border-radius: $by-radius-sm;
}
.auth-tag.passed {
  background: color.adjust($by-success, $alpha: 0.16);
  color: $by-success;
  border: 1rpx solid color.adjust($by-success, $alpha: 0.3);
}
.auth-tag.pending {
  background: $by-soft-card; color: $by-text-3;
  border: 1rpx solid $by-border;
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

/* ===== Wallet Card ===== */
.wallet-card {
  position: relative;
  background: linear-gradient(135deg, $by-bg-soft 0%, $by-surface 100%);
  border-radius: 32rpx;
  padding: 28rpx 28rpx 28rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid $by-border;
  overflow: hidden;
}
.wallet-glow {
  position: absolute; top: 0; left: 0; right: 0; height: 4rpx;
  background: $by-gradient-gold;
  box-shadow: 0 0 30rpx color.adjust($by-gold, $alpha: 0.5);
}
.wallet-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.wallet-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $by-text-1;
  letter-spacing: 2rpx;
}
.wallet-head-actions {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.wallet-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
}
.wallet-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10rpx;
  position: relative; z-index: 1;
  padding: 16rpx 0;
}
.wallet-item:active { background: rgba(255,255,255,0.04); border-radius: 20rpx; }
.wallet-num {
  font-size: 44rpx; font-weight: 700;
  color: $by-gold;
  &.income {
    background: $by-gradient-gold;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}
.wallet-label { font-size: 22rpx; color: $by-text-2; }
.wallet-divider {
  width: 2rpx; height: 64rpx;
  background: linear-gradient(180deg, transparent 0%, $by-border-strong 50%, transparent 100%);
  flex-shrink: 0;
}
.recharge-btn {
  background: $by-gradient-gold; color: #0B0F1A;
  font-size: 24rpx; font-weight: 700;
  padding: 12rpx 28rpx; border-radius: $by-radius-pill;
  box-shadow: $by-shadow-gold;
}
.recharge-btn:active { transform: scale(0.97); }
.exchange-btn {
  background: color.adjust($by-gold, $alpha: 0.15);
  color: $by-gold-soft; font-size: 24rpx; font-weight: 600;
  padding: 10rpx 26rpx; border-radius: $by-radius-pill;
  border: 1rpx solid color.adjust($by-gold, $alpha: 0.35);
}
.exchange-btn:active { background: color.adjust($by-gold, $alpha: 0.25); }

/* ===== Modules (4 列 × 3 行 = 12，避免末尾缺项视觉错位) ===== */
.modules {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  row-gap: 8rpx;
  column-gap: 4rpx;
  background: $by-card-bg;
  border-radius: 32rpx;
  padding: 28rpx 12rpx;
  margin-bottom: 32rpx;
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
  &.gold {
    background: color.adjust($by-gold, $alpha: 0.14);
    border-color: color.adjust($by-gold, $alpha: 0.3);
  }
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
  &:active { background: color.adjust($by-error, $alpha: 0.08); }
}
</style>
