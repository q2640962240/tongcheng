<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="nav-bar">
      <view class="nav-back" @tap="onBack">‹</view>
      <text class="nav-title">个人主页</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 封面区域 -->
    <view class="cover">
      <view class="cover-gradient"></view>
      <view class="cover-aurora"></view>
    </view>

    <!-- 头像 + 基本信息 -->
    <view class="profile-section">
      <image class="avatar" :src="safeAvatar" mode="aspectFill" />
      <view class="name-row">
        <text class="nickname">{{ safeNickname }}</text>
        <text v-if="isElite" class="badge badge-elite">E</text>
        <text v-if="isRealPerson" class="badge badge-real">真人</text>
      </view>
      <view class="meta-row">
        <text v-if="safeCity" class="meta-item">📍 {{ safeCity }}</text>
        <text v-if="genderText" class="meta-item">{{ genderText }}</text>
        <text v-if="safeAge" class="meta-item">{{ safeAge }}岁</text>
      </view>
      <text v-if="safeBio" class="bio">{{ safeBio }}</text>
    </view>

    <!-- 社交数据栏 -->
    <view class="stats-bar">
      <view class="stat-item" @tap="onGoFollow('following')">
        <text class="stat-num">{{ formatNum(followingCount) }}</text>
        <text class="stat-label">关注</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item" @tap="onGoFollow('followers')">
        <text class="stat-num">{{ formatNum(followersCount) }}</text>
        <text class="stat-label">粉丝</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-num">{{ formatNum(postsCount) }}</text>
        <text class="stat-label">动态</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="actions" v-if="!isSelf">
      <view class="action-btn action-greet" @tap="onGreet">
        <text class="action-icon">👋</text>
        <text class="action-text">打招呼</text>
      </view>
      <view
        class="action-btn"
        :class="isFollowing ? 'action-followed' : 'action-follow'"
        @tap="onToggleFollow"
      >
        <text class="action-icon">{{ isFollowing ? '✓' : '+' }}</text>
        <text class="action-text">{{ isFollowing ? '已关注' : '关注' }}</text>
      </view>
      <view class="action-btn action-chat" @tap="onChat">
        <text class="action-icon">💬</text>
        <text class="action-text">私聊</text>
      </view>
    </view>

    <!-- Tab 切换 -->
    <view class="tabs">
      <view
        class="tab-item"
        :class="{ active: activeTab === 'posts' }"
        @tap="activeTab = 'posts'"
      >
        <text class="tab-text">动态</text>
        <view v-if="activeTab === 'posts'" class="tab-indicator"></view>
      </view>
      <view
        class="tab-item"
        :class="{ active: activeTab === 'album' }"
        @tap="activeTab = 'album'"
      >
        <text class="tab-text">相册</text>
        <view v-if="activeTab === 'album'" class="tab-indicator"></view>
      </view>
    </view>

    <!-- Tab 内容 -->
    <view class="tab-content">
      <!-- 动态列表 -->
      <view v-if="activeTab === 'posts'" class="posts-list">
        <view v-if="postsLoading" class="loading-tip">
          <text class="loading-text">加载中...</text>
        </view>
        <view v-else-if="!posts.length" class="empty-tip">
          <text class="empty-icon">📝</text>
          <text class="empty-text">暂无动态</text>
        </view>
        <view v-else>
          <view
            v-for="(post, idx) in posts"
            :key="post.id || idx"
            class="post-card"
            @tap="onPostTap(post)"
          >
            <view class="post-header">
              <text class="post-time">{{ formatPostTime(post.createdAt) }}</text>
            </view>
            <text class="post-content">{{ truncateText(post.content) }}</text>
            <view v-if="post.images && post.images.length" class="post-images">
              <image
                v-for="(img, i) in post.images.slice(0, 3)"
                :key="i"
                class="post-img"
                :src="img"
                mode="aspectFill"
              />
              <view v-if="post.images.length > 3" class="post-img-more">
                <text class="img-more-text">+{{ post.images.length - 3 }}</text>
              </view>
            </view>
            <view class="post-stats">
              <text class="post-stat">❤ {{ post.likeCount || 0 }}</text>
              <text class="post-stat">💬 {{ post.commentCount || 0 }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 相册 -->
      <view v-if="activeTab === 'album'" class="empty-tip">
        <text class="empty-icon">📷</text>
        <text class="empty-text">暂无相册</text>
        <text class="empty-sub">敬请期待后续更新</text>
      </view>
    </view>

    <!-- 基本信息 -->
    <view class="info-section" v-if="safeBio || safeCity || safeCreatedAt">
      <view class="info-title-row">
        <text class="info-title">基本信息</text>
      </view>
      <view class="info-list">
        <view v-if="safeBio" class="info-row">
          <text class="info-label">简介</text>
          <text class="info-value">{{ safeBio }}</text>
        </view>
        <view v-if="safeCity" class="info-row">
          <text class="info-label">城市</text>
          <text class="info-value">{{ safeCity }}</text>
        </view>
        <view v-if="safeCreatedAt" class="info-row">
          <text class="info-label">注册时间</text>
          <text class="info-value">{{ safeCreatedAt }}</text>
        </view>
      </view>
    </view>

    <view class="bottom-safe"></view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { userApi, postApi } from '@/api'
import { useUserStore } from '@/store/user'
import { toStr, toNum, toObj, toList, toBool, guard, unwrap, avatarUrl, formatTime } from '@/utils/fallback'

const userStore = useUserStore()

// ---- 路由参数 ----
const userId = ref('')

// ---- 用户数据 ----
const profile = ref({})
const posts = ref([])
const postsLoading = ref(false)
const activeTab = ref('posts')
const isFollowing = ref(false)
const actionLoading = ref(false)

// ---- 字段收敛 ----
const safeNickname = computed(() => toStr(profile.value.nickname, '白夜用户'))
const safeAvatar = computed(() => avatarUrl(toStr(profile.value.avatar, '')))
const safeBio = computed(() => toStr(profile.value.bio, ''))
const safeCity = computed(() => toStr(profile.value.city, ''))
const safeAge = computed(() => {
  const age = toNum(profile.value.age, 0)
  return age > 0 ? age : ''
})
const safeCreatedAt = computed(() => {
  const raw = profile.value.createdAt
  if (!raw) return ''
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch (_) { return '' }
})
const genderText = computed(() => {
  const g = toStr(profile.value.gender, '')
  if (g === 'male' || g === '1' || g === 1) return '♂ 男'
  if (g === 'female' || g === '2' || g === 2) return '♀ 女'
  return ''
})
const isElite = computed(() => toBool(profile.value.isElite, false))
const isRealPerson = computed(() => {
  const cert = toObj(profile.value.certification, {})
  return toStr(cert.realPerson, '') === 'passed'
})
const followingCount = computed(() => toNum(profile.value.followingCount, 0))
const followersCount = computed(() => toNum(profile.value.followersCount, 0))
const postsCount = computed(() => toNum(profile.value.postsCount, posts.value.length))
const isSelf = computed(() => {
  const myId = toStr(userStore.userId, '')
  return myId && userId.value && String(myId) === String(userId.value)
})

// ---- 数据加载 ----
const loadProfile = async () => {
  if (!userId.value) return
  try {
    const data = await guard(userApi.publicProfile(userId.value).then(r => unwrap(r, null)), null)
    if (data) {
      profile.value = toObj(data, {})
      // 关注状态从 profile 里取
      isFollowing.value = toBool(profile.value.isFollowing, false)
    }
  } catch (_) {}
}

const loadPosts = async () => {
  if (!userId.value) return
  postsLoading.value = true
  try {
    const data = await guard(postApi.list({ userId: userId.value }).then(r => unwrap(r, null)), null)
    if (data) {
      posts.value = toList(data.list || data.rows || data)
    }
  } catch (_) {} finally {
    postsLoading.value = false
  }
}

// ---- 操作 ----
const onBack = () => uni.navigateBack()

const onGreet = async () => {
  if (actionLoading.value) return
  actionLoading.value = true
  try {
    await userApi.sendGreeting(userId.value, { message: '你好！' })
    uni.showToast({ title: '已发送招呼', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: '发送失败', icon: 'none' })
  } finally {
    actionLoading.value = false
  }
}

const onToggleFollow = async () => {
  if (actionLoading.value) return
  actionLoading.value = true
  try {
    if (isFollowing.value) {
      await userApi.unfollow(userId.value)
      isFollowing.value = false
      uni.showToast({ title: '已取消关注', icon: 'none' })
    } else {
      await userApi.follow(userId.value)
      isFollowing.value = true
      uni.showToast({ title: '已关注', icon: 'success' })
    }
  } catch (_) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  } finally {
    actionLoading.value = false
  }
}

const onChat = () => {
  uni.navigateTo({
    url: `/pages/chat/chat?userId=${userId.value}`
  })
}

const onGoFollow = (type) => {
  uni.navigateTo({
    url: `/pages/follow-list/follow-list?userId=${userId.value}&tab=${type}`
  })
}

const onPostTap = (post) => {
  // 动态详情暂不跳转
}

const formatNum = (n) => {
  const num = toNum(n, 0)
  if (num >= 10000) return (num / 10000).toFixed(1).replace(/\.0$/, '') + 'w'
  return String(num)
}

const formatPostTime = (t) => formatTime(t) || ''

const truncateText = (text) => {
  const s = toStr(text, '')
  if (!s) return ''
  return s.length > 120 ? s.slice(0, 120) + '…' : s
}

// ---- 生命周期 ----
onLoad((options) => {
  userId.value = toStr(options?.userId || options?.id, '')
})

onMounted(() => {
  if (userId.value) {
    loadProfile()
    loadPosts()
  }
})
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

/* ===== 封面 ===== */
.cover {
  position: relative; height: 300rpx; overflow: hidden;
}
.cover-gradient {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, #1A2238 0%, #0B0F1A 100%);
}
.cover-aurora {
  position: absolute; top: -80rpx; right: -40rpx;
  width: 320rpx; height: 320rpx; border-radius: 50%;
  background: $by-gradient-aurora;
  filter: blur(80rpx); opacity: 0.15;
  pointer-events: none;
}

/* ===== 头像 + 基本信息 ===== */
.profile-section {
  display: flex; flex-direction: column; align-items: center;
  padding: 0 $by-page-pad-x 24rpx;
  margin-top: -60rpx;
  position: relative; z-index: 5;
}
.avatar {
  width: 160rpx; height: 160rpx; border-radius: $by-radius-pill;
  border: 6rpx solid $by-bg;
  background: $by-surface;
  box-shadow: $by-shadow-2;
}
.name-row {
  display: flex; align-items: center; gap: 12rpx;
  margin-top: 20rpx;
}
.nickname {
  font-size: 40rpx; font-weight: 700; color: $by-text-1;
}
.badge {
  font-size: 20rpx; font-weight: 600;
  padding: 4rpx 16rpx; border-radius: $by-radius-pill;
}
.badge-elite {
  background: $by-gradient-gold; color: #0B0F1A;
  box-shadow: $by-shadow-gold;
}
.badge-real {
  background: color.adjust($by-success, $alpha: 0.16);
  color: $by-success;
  border: 1rpx solid color.adjust($by-success, $alpha: 0.3);
}
.meta-row {
  display: flex; align-items: center; gap: 16rpx;
  margin-top: 12rpx; flex-wrap: wrap; justify-content: center;
}
.meta-item {
  font-size: 24rpx; color: $by-text-2;
}
.bio {
  margin-top: 16rpx;
  font-size: 26rpx; color: $by-text-2;
  text-align: center; line-height: 1.6;
  max-width: 560rpx;
}

/* ===== 社交数据栏 ===== */
.stats-bar {
  display: flex; align-items: center;
  margin: 24rpx $by-page-pad-x;
  background: $by-surface;
  border-radius: $by-radius-lg;
  border: 1rpx solid $by-border;
  padding: 28rpx 0;
}
.stat-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  &:active { background: color.adjust(#FFFFFF, $alpha: 0.04); border-radius: $by-radius-md; }
}
.stat-num {
  font-size: 36rpx; font-weight: 700; color: $by-text-1;
}
.stat-label {
  font-size: 22rpx; color: $by-text-3;
}
.stat-divider {
  width: 2rpx; height: 56rpx;
  background: linear-gradient(180deg, transparent 0%, $by-border-strong 50%, transparent 100%);
  flex-shrink: 0;
}

/* ===== 操作按钮 ===== */
.actions {
  display: flex; gap: 16rpx;
  padding: 0 $by-page-pad-x;
  margin-bottom: 28rpx;
}
.action-btn {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 8rpx;
  height: 80rpx; border-radius: $by-radius-pill;
  font-size: 26rpx; font-weight: 600;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.97); }
}
.action-greet {
  background: $by-surface-2;
  border: 1rpx solid $by-border-strong;
  color: $by-text-1;
}
.action-follow {
  background: $by-gradient-gold;
  color: #0B0F1A;
  box-shadow: $by-shadow-gold;
}
.action-followed {
  background: $by-surface-2;
  border: 1rpx solid color.adjust($by-gold, $alpha: 0.3);
  color: $by-gold-soft;
}
.action-chat {
  background: linear-gradient(135deg, color.adjust($by-aurora-a, $alpha: 0.8), color.adjust($by-aurora-b, $alpha: 0.8));
  color: #FFFFFF;
}
.action-icon { font-size: 28rpx; }
.action-text { font-size: 26rpx; }

/* ===== Tab ===== */
.tabs {
  display: flex;
  padding: 0 $by-page-pad-x;
  border-bottom: 1rpx solid $by-border;
  margin-bottom: 16rpx;
}
.tab-item {
  position: relative;
  padding: 20rpx 32rpx;
  display: flex; flex-direction: column; align-items: center;
}
.tab-text {
  font-size: 28rpx; color: $by-text-3; font-weight: 500;
  .tab-item.active & { color: $by-text-1; font-weight: 700; }
}
.tab-indicator {
  position: absolute; bottom: -2rpx; left: 50%; transform: translateX(-50%);
  width: 48rpx; height: 4rpx; border-radius: 2rpx;
  background: $by-gold;
}

/* ===== 动态列表 ===== */
.tab-content {
  padding: 0 $by-page-pad-x;
}
.posts-list {
  display: flex; flex-direction: column; gap: 16rpx;
}
.post-card {
  background: $by-surface;
  border-radius: $by-radius-lg;
  padding: 24rpx;
  border: 1rpx solid $by-border;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.995); }
}
.post-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12rpx;
}
.post-time { font-size: 22rpx; color: $by-text-3; }
.post-content {
  font-size: 28rpx; color: $by-text-1; line-height: 1.7;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  overflow: hidden;
}
.post-images {
  display: flex; gap: 8rpx; margin-top: 16rpx;
}
.post-img {
  width: 180rpx; height: 180rpx; border-radius: $by-radius-md;
  background: $by-surface-2;
}
.post-img-more {
  width: 180rpx; height: 180rpx; border-radius: $by-radius-md;
  background: color.adjust(#000000, $alpha: 0.5);
  display: flex; align-items: center; justify-content: center;
}
.img-more-text { color: $by-text-1; font-size: 28rpx; font-weight: 600; }
.post-stats {
  display: flex; gap: 24rpx; margin-top: 16rpx;
}
.post-stat { font-size: 22rpx; color: $by-text-3; }

/* ===== 空/加载状态 ===== */
.loading-tip, .empty-tip {
  display: flex; flex-direction: column; align-items: center;
  padding: 80rpx 0;
  gap: 16rpx;
}
.loading-text { font-size: 26rpx; color: $by-text-3; }
.empty-icon { font-size: 64rpx; }
.empty-text { font-size: 28rpx; color: $by-text-3; }
.empty-sub { font-size: 24rpx; color: $by-text-mute; }

/* ===== 基本信息 ===== */
.info-section {
  margin: 32rpx $by-page-pad-x;
  background: $by-surface;
  border-radius: $by-radius-lg;
  padding: 28rpx;
  border: 1rpx solid $by-border;
}
.info-title-row { margin-bottom: 20rpx; }
.info-title {
  font-size: 30rpx; font-weight: 700; color: $by-text-1;
}
.info-list {
  display: flex; flex-direction: column; gap: 16rpx;
}
.info-row {
  display: flex; align-items: flex-start; gap: 16rpx;
}
.info-label {
  font-size: 24rpx; color: $by-text-3;
  min-width: 100rpx; flex-shrink: 0;
}
.info-value {
  font-size: 26rpx; color: $by-text-2; line-height: 1.6;
  flex: 1;
}

.bottom-safe {
  height: calc(64rpx + env(safe-area-inset-bottom));
}
</style>
