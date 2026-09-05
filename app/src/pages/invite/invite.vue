<template>
  <view class="page-invite">
    <!-- 顶部 -->
    <view class="inv-header">
      <view class="inv-back" @tap="onBack"><text class="arrow">‹</text></view>
      <text class="inv-title">邀请好友</text>
      <view class="inv-placeholder"></view>
    </view>

    <view class="inv-content">
      <!-- 主视觉卡片 -->
      <view class="hero-card">
        <view class="hero-glow"></view>
        <view class="hero-body">
          <text class="hero-emoji">🌙</text>
          <text class="hero-title">邀请好友，一起社交</text>
          <text class="hero-desc">邀请好友注册，双方获得特权体验奖励</text>
          <view class="hero-reward-row">
            <view class="hero-reward-chip">
              <text class="hrc-icon">✨</text>
              <text class="hrc-text">每成功邀请1位好友，双方各获得3天精英体验</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 邀请码卡片 -->
      <view class="code-card">
        <view class="code-label">我的邀请码</view>
        <view class="code-value">{{ inviteCode || '——' }}</view>
        <view class="code-actions">
          <view class="btn-outline code-btn" @tap="copyCode">复制邀请码</view>
          <view class="btn-primary code-btn" @tap="copyLink">复制邀请链接</view>
        </view>
      </view>

      <!-- 统计 -->
      <view class="stats-card">
        <view class="stat-item">
          <text class="stat-num">{{ stats.totalInvitees }}</text>
          <text class="stat-label">已邀请好友</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num">{{ stats.totalDays || stats.totalInvitees * 3 }}</text>
          <text class="stat-label">累计获得体验天数</text>
        </view>
      </view>

      <!-- 已邀请列表 -->
      <view v-if="invitees.length" class="invitees-card">
        <view class="inv-section-title">已邀请的好友</view>
        <view
          v-for="(u, i) in invitees"
          :key="i"
          class="inv-item"
        >
          <image class="inv-avatar" :src="u.avatar" mode="aspectFill" />
          <view class="inv-info">
            <text class="inv-name">{{ u.nickname }}</text>
            <text class="inv-time">{{ u.createdAt }}</text>
          </view>
          <view class="inv-badge">+3天</view>
        </view>
      </view>
    </view>

    <!-- 底部按钮 -->
    <view class="inv-footer">
      <view class="inv-share-btn" @tap="onInvite">
        <text class="isb-icon">📤</text>
        <text class="isb-text">邀请好友</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { inviteApi } from '../../api'
import {
  toStr, toNum, toObj, toList, getPath, safeMap, avatarUrl
} from '@/utils/fallback'

const onBack = () => uni.navigateBack()

const stats = ref({ totalInvitees: 0, totalDays: 0 })
const invitees = ref([])
const inviteCode = ref('')
const shareInfoData = ref({})

const loadData = async () => {
  try {
    const [si, inv] = await Promise.all([
      inviteApi.shareInfo(),
      inviteApi.invitees()
    ])
    const siData = toObj(getPath(si, 'data'), {})
    shareInfoData.value = siData
    inviteCode.value = toStr(getPath(siData, 'inviteCode'), '')

    const invList = toList(getPath(inv, 'data'))
    invitees.value = safeMap(invList, (item) => ({
      nickname: toStr(getPath(item, 'nickname'), '匿名用户'),
      avatar: avatarUrl(getPath(item, 'avatar')),
      createdAt: toStr(getPath(item, 'createdAt'), '')
    }))
    stats.value = {
      totalInvitees: invitees.value.length,
      totalDays: invitees.value.length * 3
    }
  } catch (e) {}
}

const copyCode = () => {
  const code = inviteCode.value
  if (!code) return uni.showToast({ title: '暂无邀请码', icon: 'none' })
  uni.setClipboardData({
    data: code,
    success: () => uni.showToast({ title: '邀请码已复制', icon: 'success' })
  })
}

const copyLink = () => {
  const code = inviteCode.value
  if (!code) return uni.showToast({ title: '暂无邀请码', icon: 'none' })
  const link = `${window.location.origin}/#/pages/login/login?inviteCode=${code}`
  uni.setClipboardData({
    data: link,
    success: () => uni.showToast({ title: '邀请链接已复制', icon: 'success' })
  })
}

const onInvite = () => {
  uni.showActionSheet({
    itemList: ['分享给微信好友', '分享到朋友圈', '复制邀请码', '复制邀请链接'],
    success: (res) => {
      const code = inviteCode.value
      if (res.tapIndex === 2) {
        copyCode()
      } else if (res.tapIndex === 3) {
        copyLink()
      } else {
        // #ifdef MP-WEIXIN || APP-PLUS
        uni.share({
          provider: 'weixin',
          scene: res.tapIndex === 0 ? 'WXSceneSession' : 'WXSceneTimeline',
          type: 0,
          title: shareInfoData.value.shareTitle || '来白夜，一起社交',
          summary: shareInfoData.value.shareDesc || '邀请好友注册，双方各获3天精英体验',
          href: `${window.location.origin}/#/pages/login/login?inviteCode=${code}`,
          imageUrl: '',
          success: () => uni.showToast({ title: '分享成功', icon: 'success' }),
          fail: () => uni.showToast({ title: '分享取消', icon: 'none' })
        })
        // #endif
        // #ifdef H5
        uni.showToast({
          title: 'H5 暂不支持微信分享，请复制邀请码或链接',
          icon: 'none',
          duration: 2500
        })
        // #endif
      }
    }
  })
}

onShow(loadData)
</script>

<style lang="scss" scoped>
.page-invite { min-height: 100vh; background: $by-bg; padding-bottom: 180rpx; }

.inv-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24rpx; height: 88rpx; position: sticky; top: 0;
  background: $by-bg-soft; border-bottom: 1rpx solid $by-border; z-index: 10;
}
.inv-back {
  width: 60rpx; height: 60rpx; display: flex; align-items: center; justify-content: center;
  color: $by-text-1;
  .arrow { font-size: 48rpx; line-height: 48rpx; }
}
.inv-title { font-size: 34rpx; font-weight: 700; color: $by-text-1; }
.inv-placeholder { width: 60rpx; }

.inv-content { padding: 32rpx; display: flex; flex-direction: column; gap: 24rpx; }

/* Hero */
.hero-card {
  position: relative; overflow: hidden;
  border-radius: 32rpx; padding: 0;
}
.hero-glow {
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 20% 0%, color.change($by-aurora-b, $alpha: .4), transparent 55%),
    radial-gradient(circle at 80% 100%, color.change($by-gold, $alpha: .3), transparent 55%),
    linear-gradient(160deg, $by-bg-soft 0%, $by-surface 100%);
}
.hero-body {
  position: relative; padding: 48rpx 36rpx;
  display: flex; flex-direction: column; align-items: center; gap: 16rpx; text-align: center;
}
.hero-emoji { font-size: 72rpx; }
.hero-title { font-size: 40rpx; font-weight: 800; color: $by-text-1; }
.hero-desc { font-size: 26rpx; color: $by-text-3; }
.hero-reward-row { margin-top: 8rpx; }
.hero-reward-chip {
  display: inline-flex; align-items: center; gap: 10rpx;
  padding: 12rpx 24rpx; border-radius: 9999rpx;
  background: color.change($by-gold, $alpha: .15);
  border: 1rpx solid color.change($by-gold, $alpha: .3);
}
.hrc-icon { font-size: 24rpx; }
.hrc-text { font-size: 24rpx; color: $by-gold-soft; font-weight: 600; }

/* Code card */
.code-card {
  background: $by-surface; border: 1rpx solid $by-border;
  border-radius: 24rpx; padding: 32rpx;
  display: flex; flex-direction: column; align-items: center; gap: 20rpx;
}
.code-label { font-size: 24rpx; color: $by-text-3; }
.code-value {
  font-size: 56rpx; font-weight: 800; letter-spacing: 8rpx;
  color: $by-gold; font-family: Menlo, Consolas, monospace;
}
.code-actions { display: flex; gap: 16rpx; width: 100%; }
.code-btn { flex: 1; text-align: center; padding: 18rpx 0 !important; font-size: 26rpx !important; }

/* Stats */
.stats-card {
  background: $by-surface; border: 1rpx solid $by-border;
  border-radius: 24rpx; padding: 36rpx 32rpx;
  display: flex; align-items: center;
}
.stat-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.stat-num {
  font-size: 48rpx; font-weight: 800;
  background: $by-gradient-aurora; -webkit-background-clip: text; background-clip: text; color: transparent;
}
.stat-label { font-size: 22rpx; color: $by-text-3; }
.stat-divider { width: 2rpx; height: 64rpx; background: $by-border; }

/* Invitees */
.invitees-card {
  background: $by-surface; border: 1rpx solid $by-border;
  border-radius: 24rpx; padding: 28rpx;
}
.inv-section-title { font-size: 28rpx; font-weight: 700; color: $by-text-1; margin-bottom: 20rpx; }
.inv-item {
  display: flex; align-items: center; gap: 16rpx;
  padding: 16rpx 0; border-bottom: 1rpx solid $by-border;
  &:last-child { border-bottom: none; }
}
.inv-avatar { width: 72rpx; height: 72rpx; border-radius: 9999rpx; background: $by-surface-2; }
.inv-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.inv-name { font-size: 28rpx; font-weight: 600; color: $by-text-1; }
.inv-time { font-size: 22rpx; color: $by-text-3; }
.inv-badge {
  padding: 6rpx 16rpx; border-radius: 9999rpx;
  background: color.change($by-success, $alpha: .15); color: $by-success;
  font-size: 22rpx; font-weight: 700;
}

/* Footer */
.inv-footer {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: color.change($by-bg, $alpha: .95);
  border-top: 1rpx solid $by-border;
  backdrop-filter: blur(20rpx);
}
.inv-share-btn {
  height: 96rpx;
  background: $by-gradient-gold; color: #0B0F1A;
  border-radius: 9999rpx;
  display: flex; align-items: center; justify-content: center; gap: 10rpx;
  font-size: 32rpx; font-weight: 700;
  box-shadow: $by-shadow-gold;
}
.isb-icon { font-size: 30rpx; }
.isb-text { font-size: 32rpx; }
</style>
