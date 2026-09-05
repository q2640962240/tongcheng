<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="nav-bar">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">‹</view>
        <text class="nav-title">关注与粉丝</text>
      </view>
      <!-- Tab 栏 -->
      <view class="tab-bar">
        <view
          class="tab-item"
          :class="{ active: currentTab === 'following' }"
          @tap="switchTab('following')"
        >
          <text>关注</text>
        </view>
        <view
          class="tab-item"
          :class="{ active: currentTab === 'followers' }"
          @tap="switchTab('followers')"
        >
          <text>粉丝</text>
        </view>
      </view>
    </view>

    <!-- 用户列表 -->
    <scroll-view scroll-y class="user-list" @scrolltolower="loadMore">
      <view
        v-for="user in userList"
        :key="user.id"
        class="user-item"
        @tap="goUserProfile(user.id)"
      >
        <image
          class="avatar"
          :src="user.avatar || '/static/default-avatar.png'"
          mode="aspectFill"
        />
        <view class="user-info">
          <text class="nickname">{{ user.nickname }}</text>
          <text class="bio" v-if="user.bio">{{ user.bio }}</text>
        </view>
        <view
          class="follow-btn"
          :class="{ followed: user.isFollowed }"
          @tap.stop="toggleFollow(user)"
        >
          <text>{{ user.isFollowed ? '已关注' : '+关注' }}</text>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="!loading && userList.length === 0" class="empty-state">
        <text class="empty-text">{{ currentTab === 'following' ? '暂无关注' : '暂无粉丝' }}</text>
      </view>

      <!-- 加载中 -->
      <view v-if="loading" class="loading-state">
        <text class="loading-text">加载中...</text>
      </view>

      <!-- 没有更多 -->
      <view v-if="!loading && userList.length > 0 && noMore" class="no-more">
        <text class="no-more-text">— 没有更多了 —</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { userApi } from '@/api'

// ===== 状态 =====
const currentTab = ref('following')
const followingList = ref([])
const followersList = ref([])
const loading = ref(false)
const noMore = ref(false)
const page = ref(1)
const pageSize = 20
const currentUserId = ref(null)

// 当前显示列表
const userList = computed(() => {
  return currentTab.value === 'following' ? followingList.value : followersList.value
})

// ===== 生命周期 =====
onMounted(async () => {
  // 读取页面参数
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const query = currentPage?.$page?.options || currentPage?.options || {}
  if (query.tab === 'followers') {
    currentTab.value = 'followers'
  }
  if (query.userId) {
    currentUserId.value = query.userId
  }

  try {
    if (!currentUserId.value) {
      const profile = await userApi.profile()
      currentUserId.value = profile.id || profile.userId
    }
    fetchList()
  } catch (e) {
    console.error('获取用户信息失败', e)
    uni.showToast({ title: '请先登录', icon: 'none' })
  }
})

// ===== 方法 =====
function goBack() {
  uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/index/index' }) })
}

async function switchTab(tab) {
  if (currentTab.value === tab) return
  currentTab.value = tab
  page.value = 1
  noMore.value = false
  // 如果已有缓存数据则不重新请求
  const list = tab === 'following' ? followingList.value : followersList.value
  if (list.length === 0) {
    await fetchList()
  }
}

async function fetchList() {
  if (!currentUserId.value || loading.value) return
  loading.value = true
  noMore.value = false
  try {
    const fn = currentTab.value === 'following' ? userApi.following : userApi.followers
    const res = await fn(currentUserId.value, { page: page.value, pageSize })
    const items = Array.isArray(res) ? res : (res.list || res.rows || res.data || [])
    const mapped = items.map(u => ({
      ...u,
      isFollowed: !!u.isFollowed
    }))

    if (currentTab.value === 'following') {
      followingList.value = page.value === 1 ? mapped : [...followingList.value, ...mapped]
    } else {
      followersList.value = page.value === 1 ? mapped : [...followersList.value, ...mapped]
    }

    if (items.length < pageSize) {
      noMore.value = true
    }
  } catch (e) {
    console.error('获取列表失败', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (loading.value || noMore.value) return
  page.value++
  fetchList()
}

async function toggleFollow(user) {
  try {
    if (user.isFollowed) {
      await userApi.unfollow(user.id)
      user.isFollowed = false
      // 取消关注后从关注列表移除（仅在关注 tab 下）
      if (currentTab.value === 'following') {
        followingList.value = followingList.value.filter(u => u.id !== user.id)
      }
      uni.showToast({ title: '已取消关注', icon: 'none' })
    } else {
      await userApi.follow(user.id)
      user.isFollowed = true
      uni.showToast({ title: '关注成功', icon: 'none' })
    }
  } catch (e) {
    console.error('关注操作失败', e)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

function goUserProfile(id) {
  uni.navigateTo({ url: `/pages/user-profile/user-profile?id=${id}` })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: $by-bg;
  display: flex;
  flex-direction: column;
}

/* ===== 导航栏 ===== */
.nav-bar {
  padding: env(safe-area-inset-top) $by-page-pad-x 0;
  background: $by-bg;
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-content {
  display: flex;
  align-items: center;
  height: $by-topbar-h;
}

.nav-back {
  font-size: 48rpx;
  color: $by-text-1;
  width: 60rpx;
  text-align: center;
}

.nav-title {
  flex: 1;
  font-size: 34rpx;
  font-weight: 600;
  color: $by-text-1;
  margin-left: 8rpx;
}

/* ===== Tab 栏 ===== */
.tab-bar {
  display: flex;
  height: 80rpx;
  border-bottom: 1rpx solid $by-border;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  font-size: 30rpx;
  color: $by-text-3;
  transition: color 0.25s;

  &.active {
    color: $by-gold;
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 48rpx;
      height: 4rpx;
      border-radius: 2rpx;
      background: $by-gold;
    }
  }
}

/* ===== 用户列表 ===== */
.user-list {
  flex: 1;
  height: 0;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 24rpx $by-page-pad-x;
  border-bottom: 1rpx solid $by-divider;
  transition: background 0.15s;

  &:active {
    background: $by-surface;
  }
}

.avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  flex-shrink: 0;
  background: $by-surface-2;
}

.user-info {
  flex: 1;
  margin-left: 20rpx;
  overflow: hidden;
}

.nickname {
  font-size: 28rpx;
  color: $by-text-1;
  font-weight: 500;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bio {
  font-size: 24rpx;
  color: $by-text-3;
  margin-top: 6rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.follow-btn {
  flex-shrink: 0;
  margin-left: 16rpx;
  padding: 10rpx 28rpx;
  border-radius: $by-radius-pill;
  font-size: 24rpx;
  background: $by-gold;
  color: $by-bg;
  font-weight: 600;
  transition: opacity 0.2s;

  &:active {
    opacity: 0.75;
  }

  &.followed {
    background: $by-surface-2;
    color: $by-text-3;
    font-weight: 400;
  }
}

/* ===== 空状态 / 加载 ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: $by-text-3;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 40rpx 0;
}

.loading-text {
  font-size: 26rpx;
  color: $by-text-3;
}

.no-more {
  display: flex;
  justify-content: center;
  padding: 32rpx 0 60rpx;
}

.no-more-text {
  font-size: 24rpx;
  color: $by-text-mute;
}
</style>
