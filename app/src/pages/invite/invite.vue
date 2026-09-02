<template>
  <view class="page">
    <view class="header">
      <text class="back" @tap="onBack">‹</text>
      <text class="title">邀请股东</text>
      <view class="placeholder"></view>
    </view>

    <view class="content">
      <!-- 规则 -->
      <view class="rules-card">
        <view class="rule-row">
          <text class="rule-emoji">👨</text>
          <view class="rule-info">
            <text class="rule-title">邀请男性好友</text>
            <text class="rule-desc">获得其消费 10% 现金分红</text>
          </view>
        </view>
        <view class="rule-divider"></view>
        <view class="rule-row">
          <text class="rule-emoji">👩</text>
          <view class="rule-info">
            <text class="rule-title">邀请女性好友</text>
            <text class="rule-desc">获得其收入 10% 现金分红</text>
          </view>
        </view>
      </view>

      <!-- 邀请成绩 -->
      <view class="stats-card">
        <view class="stat-item">
          <text class="stat-num">{{ stats.totalInvitees }}</text>
          <text class="stat-label">累计邀请</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num">¥{{ fenToYuan(stats.totalReward) }}</text>
          <text class="stat-label">累计奖励</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num">¥{{ fenToYuan(stats.monthlyReward) }}</text>
          <text class="stat-label">本月奖励</text>
        </view>
      </view>

      <!-- 排行榜 -->
      <view class="leaderboard">
        <view class="lb-header">
          <text class="lb-title">奖励排行榜</text>
          <text class="lb-more">查看全部</text>
        </view>
        <view v-for="(u, i) in leaderboard" :key="i" class="lb-item">
          <text class="lb-rank" :class="rankClass(i)">{{ i + 1 }}</text>
          <image class="lb-avatar" :src="u.avatar" mode="aspectFill" />
          <text class="lb-name">{{ u.nickname }}</text>
          <text class="lb-reward">¥{{ fenToYuan(u.reward) }}</text>
        </view>
      </view>
    </view>

    <!-- 底部邀请按钮 -->
    <view class="footer-cta">
      <view class="footer-btn" @tap="onInvite">立即邀请</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { inviteApi } from '../../api'
import { fenToYuan } from '../../utils/format'

const onBack = () => uni.navigateBack()

const stats = ref({ totalInvitees: 0, totalReward: 0, monthlyReward: 0 })
const leaderboard = ref([])
const shareInfo = ref({})

const loadData = async () => {
  try {
    const [s, lb, si] = await Promise.all([
      inviteApi.stats(),
      inviteApi.leaderboard(),
      inviteApi.shareInfo()
    ])
    stats.value = s.data || {}
    leaderboard.value = (lb.data || []).map(item => ({
      nickname: item.nickname || '匿名用户',
      avatar: item.avatar || '/static/avatar-user.png',
      reward: item.reward || 0
    }))
    shareInfo.value = si.data || {}
  } catch (e) {}
}

const rankClass = (i) => {
  if (i === 0) return 'rank-1'
  if (i === 1) return 'rank-2'
  if (i === 2) return 'rank-3'
  return ''
}

const onInvite = () => {
  uni.showActionSheet({
    itemList: ['分享给微信好友', '分享到朋友圈', '复制邀请码', '复制邀请链接'],
    success: (res) => {
      const code = shareInfo.value.inviteCode || ''
      if (res.tapIndex === 2) {
        // 复制邀请码
        uni.setClipboardData({
          data: code,
          success: () => uni.showToast({ title: '邀请码已复制', icon: 'success' })
        })
      } else if (res.tapIndex === 3) {
        // 复制邀请链接（H5 友好）
        const link = `${window.location.origin}/#/pages/login/login?inviteCode=${code}`
        uni.setClipboardData({
          data: link,
          success: () => uni.showToast({ title: '邀请链接已复制', icon: 'success' })
        })
      } else {
        // 微信分享（小程序/App）
        // #ifdef MP-WEIXIN || APP-PLUS
        uni.share({
          provider: 'weixin',
          scene: res.tapIndex === 0 ? 'WXSceneSession' : 'WXSceneTimeline',
          type: 0,
          title: shareInfo.value.shareTitle || '来白夜，找到你的专属陪伴',
          summary: shareInfo.value.shareDesc || '白夜 + 陪玩陪聊，注册填写邀请码有惊喜',
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
.page { min-height: 100vh; background: #fffbeb; padding-bottom: 160rpx; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24rpx; height: 88rpx; position: sticky; top: 0;
  background: #fffbeb;
  border-bottom: 2rpx solid #e5e5e5; z-index: 10;
}
.back { font-size: 56rpx; line-height: 1; }
.title { font-size: 34rpx; font-weight: 600; }
.placeholder { width: 56rpx; }
.content { padding: 32rpx; }
.rules-card {
  background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
  border-radius: 32rpx; padding: 32rpx; margin-bottom: 24rpx;
}
.rule-row { display: flex; align-items: center; gap: 24rpx; }
.rule-emoji {
  width: 80rpx; height: 80rpx; background: rgba(255,255,255,0.2);
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 44rpx;
}
.rule-info { display: flex; flex-direction: column; gap: 8rpx; }
.rule-title { font-size: 30rpx; font-weight: 600; color: #ffffff; }
.rule-desc { font-size: 26rpx; color: rgba(255,255,255,0.8); }
.rule-divider { height: 2rpx; background: rgba(255,255,255,0.2); margin: 24rpx 0; }
.stats-card {
  background: #ffffff; border-radius: 32rpx; padding: 40rpx 32rpx; margin-bottom: 24rpx;
  display: flex; align-items: center;
}
.stat-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.stat-num { font-size: 40rpx; font-weight: 700; color: #171717; }
.stat-label { font-size: 22rpx; color: #737373; }
.stat-divider { width: 2rpx; height: 64rpx; background: #e5e5e5; }
.leaderboard { background: #ffffff; border-radius: 32rpx; padding: 32rpx; }
.lb-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx;
}
.lb-title { font-size: 32rpx; font-weight: 600; }
.lb-more { font-size: 24rpx; color: #737373; }
.lb-item {
  display: flex; align-items: center; gap: 16rpx; padding: 16rpx 0;
  border-bottom: 2rpx solid #f5f5f5;
  &:last-child { border-bottom: none; }
}
.lb-rank {
  width: 48rpx; text-align: center; font-size: 30rpx; font-weight: 700; color: #737373;
}
.rank-1 { color: #ef4444; }
.rank-2 { color: #f59e0b; }
.rank-3 { color: #0ea5e9; }
.lb-avatar { width: 64rpx; height: 64rpx; border-radius: 9999rpx; background: #f5f5f5; }
.lb-name { flex: 1; font-size: 28rpx; }
.lb-reward { font-size: 30rpx; font-weight: 700; color: #ef4444; }
.footer-cta {
  position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: rgba(255,255,255,0.95);
  border-top: 2rpx solid #e5e5e5;
}
.footer-btn {
  height: 96rpx; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
  color: #ffffff; border-radius: 9999rpx; display: flex; align-items: center;
  justify-content: center; font-size: 32rpx; font-weight: 700;
}
</style>
