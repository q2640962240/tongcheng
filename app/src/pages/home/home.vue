<template>
  <view class="page">
    <!-- 顶部渐变 Brand Bar -->
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-row">
        <view class="brand">
          <view class="logo-wrap">
            <text class="logo">白</text>
            <view class="logo-ring"></view>
          </view>
          <view class="brand-text">
            <text class="brand-title">白夜</text>
            <text class="brand-sub">BaiYe · 遇见有温度的黑夜</text>
          </view>
        </view>
        <view class="actions">
          <view class="icon-btn" @tap="onSearch">
            <text class="icon-svg">🔍</text>
          </view>
          <view class="icon-btn" @tap="onMessage">
            <text class="icon-svg">💬</text>
            <view v-if="msgBadge" class="badge"></view>
          </view>
        </view>
      </view>

      <!-- 城市 + 搜索入口 -->
      <view class="search-row">
        <view class="city" @tap="onPickCity">
          <text class="city-icon">📍</text>
          <text class="city-name">{{ city || '定位中…' }}</text>
          <text class="city-arrow">▾</text>
        </view>
        <view class="search-input" @tap="onSearch">
          <text class="s-icon">🔎</text>
          <text class="s-placeholder">搜用户 / 动态 / 组局</text>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="scroll" :refresher-enabled="true" :refresher-triggered="refreshing" @refresherrefresh="onRefresh">
      <!-- 网络异常诊断条 -->
      <view class="net-troubleshoot card" v-if="showNetTrouble">
        <view class="nt-head">
          <text class="nt-icon">📡</text>
          <view class="nt-info">
            <text class="nt-title">内容加载失败？先检查服务器地址</text>
            <text class="nt-desc mono">当前：{{ currentBaseURL }}</text>
          </view>
        </view>
        <view class="nt-actions">
          <view class="btn-outline nt-btn" @tap="onFixServerUrl">🛠 设置服务器地址</view>
          <view class="btn-primary nt-btn" @tap="onRefreshRetry">🔄 下拉重试</view>
        </view>
        <view class="nt-tips">
          <text>提示：本地 WiFi 真机调试时，地址须写成「http://电脑局域网IP:3000/api」，手机与电脑须连同一 WiFi。</text>
        </view>
      </view>

      <!-- Banner 轮播 -->
      <view class="banner-wrap" v-if="banners.length">
        <swiper class="banner-swiper" circular autoplay :interval="4500" :duration="500" indicator-dots indicator-color="rgba(255,255,255,.35)" indicator-active-color="#F5D583">
          <swiper-item v-for="(b, i) in banners" :key="b.id || i" @tap="onBannerTap(b)">
            <view class="banner">
              <image class="banner-img" :src="b.image" mode="aspectFill" />
              <view class="banner-aurora"></view>
              <view class="banner-info">
                <text class="banner-title">{{ b.title }}</text>
              </view>
            </view>
          </swiper-item>
        </swiper>
      </view>

      <!-- 快捷入口 4 宫格 -->
      <view class="quick-wrap card">
        <view
          v-for="q in quickEntries"
          :key="q.key"
          class="quick-item"
          @tap="onQuickTap(q)"
        >
          <view class="quick-icon" :class="'qi-' + q.key">
            <text class="qi-emoji">{{ q.emoji }}</text>
          </view>
          <text class="quick-label">{{ q.label }}</text>
        </view>
      </view>

      <!-- 认证引导条（未认证时显示） -->
      <view class="verify-bar card" v-if="showVerifyBar" @tap="onGoVerify">
        <view class="verify-bar-bg"></view>
        <view class="verify-bar-body">
          <view class="verify-bar-left">
            <text class="verify-bar-icon">🛡️</text>
            <text class="verify-bar-text">完成精英认证，解锁全部社交功能</text>
          </view>
          <view class="verify-bar-btn">
            <text class="verify-bar-btn-text">去认证</text>
          </view>
        </view>
      </view>

      <!-- 推荐好友 -->
      <view class="section">
        <view class="section-head">
          <text class="section-title">👋 推荐好友</text>
          <text class="section-more" @tap="onNavDiscover">查看更多 ›</text>
        </view>
        <view v-if="userLoading" class="loading-wrap"><text class="loading">加载中…</text></view>
        <scroll-view v-else-if="recommendUsers.length > 0" scroll-x class="hide-scrollbar user-scroll">
          <view class="user-row">
            <view
              v-for="u in recommendUsers"
              :key="u.id"
              class="user-card"
              @tap="onUserTap(u)"
            >
              <image class="user-avatar" :src="u.avatar" mode="aspectFill" />
              <view class="user-info">
                <view class="user-name-row">
                  <text class="user-name" :numberOfLines="1">{{ u.nickname }}</text>
                  <view class="user-gender" :class="'g-' + u.gender">
                    <text class="user-gender-icon">{{ u.gender === 'female' ? '♀' : '♂' }}</text>
                  </view>
                </view>
                <text class="user-age-city" :numberOfLines="1">{{ u.age ? u.age + '岁 · ' : '' }}{{ u.city || '未知' }}</text>
                <text class="user-bio" :numberOfLines="1">{{ u.bio || '这个人很懒，什么都没写~' }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
        <view v-else class="empty">
          <text class="empty-emoji">🌟</text>
          <text class="empty-text">暂无推荐用户，下拉刷新试试</text>
        </view>
      </view>

      <!-- 最新动态 -->
      <view class="section">
        <view class="section-head">
          <text class="section-title">📰 最新动态</text>
          <text class="section-more" @tap="onMorePosts">查看更多 ›</text>
        </view>
        <view v-if="postLoading" class="loading-wrap"><text class="loading">加载中…</text></view>
        <view v-else-if="latestPosts.length === 0" class="empty">
          <text class="empty-emoji">📝</text>
          <text class="empty-text">暂无动态，快来发布第一条吧</text>
        </view>
        <view
          v-else
          v-for="p in latestPosts"
          :key="p.id"
          class="post-card card"
          @tap="onPostTap(p)"
        >
          <view class="post-head">
            <image class="post-avatar" :src="p.avatar" mode="aspectFill" />
            <view class="post-meta">
              <text class="post-nickname" :numberOfLines="1">{{ p.nickname }}</text>
              <text class="post-time">{{ p.timeAgo }}</text>
            </view>
          </view>
          <text class="post-content" :numberOfLines="2">{{ p.content }}</text>
          <view class="post-images" v-if="p.images.length">
            <image
              v-for="(img, idx) in p.images.slice(0, 3)"
              :key="idx"
              class="post-thumb"
              :src="img"
              mode="aspectFill"
            />
            <view v-if="p.images.length > 3" class="post-more-img">
              <text class="post-more-img-text">+{{ p.images.length - 3 }}</text>
            </view>
          </view>
          <view class="post-stats">
            <text class="post-stat">❤️ {{ p.likeCount || 0 }}</text>
            <text class="post-stat">💬 {{ p.commentCount || 0 }}</text>
          </view>
        </view>
      </view>

      <view class="bottom-safe"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { userApi, postApi, bannerApi, locationApi } from '../../api'
import { useUserStore } from '../../store/user'
import {
  toList, toStr, toNum, pickCity, getPath, guard, unwrap, resolveCityViaPipeline
} from '../../utils/fallback'
import { getCurrentBaseURL, openServerUrlModal } from '../../utils/request'

const userStore = useUserStore()
const CITY_KEY = 'baiye_city'
const CITY_AT_KEY = 'baiye_city_at'
const DEFAULT_CITY = '北京'
const city = ref(DEFAULT_CITY)
const tryLocateRef = ref(0)
const banners = ref([])
const msgBadge = ref(true)
const refreshing = ref(false)

/* ---- 服务器连接异常追踪 ---- */
const bannerLoadFailed = ref(false)
const userLoadFailed = ref(false)
const postLoadFailed = ref(false)
const currentBaseURL = computed(() => getCurrentBaseURL())
const anyLoadFailed = computed(() => bannerLoadFailed.value || userLoadFailed.value || postLoadFailed.value)
const showNetTrouble = computed(() => anyLoadFailed.value && banners.value.length === 0 && recommendUsers.value.length === 0 && latestPosts.value.length === 0)

const onFixServerUrl = () => openServerUrlModal({
  title: '设置服务器地址',
  onSaved: () => onRefreshRetry(),
  onReset: () => onRefreshRetry()
})
const onRefreshRetry = () => { refreshing.value = true; onRefresh() }

const readCity = () => {
  try {
    const saved = uni.getStorageSync(CITY_KEY)
    if (saved) city.value = pickCity(saved, DEFAULT_CITY)
  } catch (_) { city.value = DEFAULT_CITY }
}

/**
 * 4 级定位流水线
 */
const tryAutoLocate = async () => {
  if (tryLocateRef.value++) return
  readCity()
  const at = Number(uni.getStorageSync(CITY_AT_KEY) || 0)
  if (Date.now() - at < 24 * 3600 * 1000) return
  try {
    const result = await resolveCityViaPipeline({
      requestFn: async ({ url, method, data }) => {
        if (method === 'POST' && url === '/location/reverse') return locationApi.reverse(data)
        if (method === 'GET' && url === '/location/guess-by-ip') return locationApi.guessByIp()
        return null
      },
      preferCacheMs: 0
    })
    if (result && result.city) {
      city.value = result.city
      try { uni.setStorageSync(CITY_KEY, result.city) } catch (_) {}
    }
  } catch (_) {}
}

/* ---- 快捷入口 ---- */
const quickEntries = [
  { key: 'finder', label: '寻人大厅', emoji: '🔍', path: '/pages/discover/discover?tab=finder' },
  { key: 'posts', label: '动态广场', emoji: '📝', path: '/pages/discover/discover?tab=posts' },
  { key: 'groups', label: '同城组局', emoji: '🎯', path: '/pages/discover/discover?tab=groups' },
  { key: 'redpack', label: '红包专区', emoji: '🧧', path: '/pages/discover/discover?tab=redpack' }
]

/* ---- 认证引导条 ---- */
const showVerifyBar = computed(() => {
  const u = userStore.user || {}
  return !u.isElite && u.realPersonStatus !== 'passed'
})

/* ---- 数据 ---- */
const recommendUsers = ref([])
const userLoading = ref(false)
const latestPosts = ref([])
const postLoading = ref(false)

const loadBanners = async () => {
  bannerLoadFailed.value = false
  try {
    const res = await guard(bannerApi.list({ position: 'home_top', pageSize: 10 }), null)
    banners.value = toList(getPath(unwrap(res, null), 'list', []))
  } catch (e) { banners.value = []; bannerLoadFailed.value = true }
  if (banners.value.length === 0) {
    banners.value = [
      { id: -1, title: '净化网络环境 · 传播正能量', image: '/static/sucai/07db62c02f72d99581cffc375c02969e.jpg', link: '/pages/feedback/feedback' },
      { id: -2, title: '加入白夜，遇见有温度的黑夜', image: '/static/sucai/378849617002ad354923701552859204.jpg', link: '/pages/discover/discover' }
    ]
  }
}

const loadRecommendUsers = async () => {
  userLoading.value = true
  userLoadFailed.value = false
  try {
    const params = { page: 1, pageSize: 10 }
    if (city.value && city.value !== '全国') params.city = city.value
    const res = await guard(userApi.discover(params), null)
    const data = unwrap(res, null)
    const rows = toList(getPath(data, 'list', []) || getPath(data, 'rows', []) || getPath(data, 'items', []))
    recommendUsers.value = rows
      .filter((u) => u && u.id)
      .map((u) => ({
        id: u.id,
        nickname: toStr(u.nickname, '匿名用户'),
        avatar: toStr(u.avatar || u.avatarUrl || '', '/static/sucai/profile-ziqing.jpg'),
        age: toNum(u.age, 0) || null,
        gender: toStr(u.gender, 'male'),
        city: toStr(u.city || city.value || ''),
        bio: toStr(u.bio || u.intro || '')
      }))
  } catch (_) { recommendUsers.value = []; userLoadFailed.value = true }
  finally { userLoading.value = false }
}

const loadLatestPosts = async () => {
  postLoading.value = true
  postLoadFailed.value = false
  try {
    const res = await guard(postApi.list({ page: 1, pageSize: 5 }), null)
    const data = unwrap(res, null)
    const rows = toList(getPath(data, 'list', []) || getPath(data, 'rows', []) || getPath(data, 'items', []))
    latestPosts.value = rows
      .filter((p) => p && p.id)
      .map((p) => ({
        id: p.id,
        nickname: toStr(p.user?.nickname || p.nickname || '匿名用户'),
        avatar: toStr(p.user?.avatar || p.avatar || '/static/sucai/profile-ziqing.jpg'),
        content: toStr(p.content || p.text || ''),
        images: toList(p.images || p.pics || []).slice(0, 6),
        likeCount: toNum(p.likeCount || p.likes, 0),
        commentCount: toNum(p.commentCount || p.comments, 0),
        timeAgo: formatTimeAgo(p.createdAt || p.createTime || '')
      }))
  } catch (_) { latestPosts.value = []; postLoadFailed.value = true }
  finally { postLoading.value = false }
}

/** 简单时间格式化 */
const formatTimeAgo = (ts) => {
  if (!ts) return '刚刚'
  try {
    const diff = Date.now() - new Date(ts).getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
    return new Date(ts).toLocaleDateString('zh-CN')
  } catch (_) { return '刚刚' }
}

const onRefresh = async () => {
  refreshing.value = true
  await Promise.all([loadBanners(), loadRecommendUsers(), loadLatestPosts()])
  refreshing.value = false
}

onShow(() => {
  readCity()
  loadBanners()
  loadRecommendUsers()
  loadLatestPosts()
  if (userStore.token) msgBadge.value = true
})
onMounted(() => tryAutoLocate())

/* -------- 事件 -------- */
const onSearch = () => uni.navigateTo({ url: '/pages/search/search' })
const onNavDiscover = () => uni.navigateTo({ url: '/pages/discover/discover' })
const onPickCity = () => uni.navigateTo({ url: '/pages/city/city' })
const onMessage = () => uni.switchTab({ url: '/TUIKit/components/TUIConversation/index' })
const onBannerTap = (b) => {
  if (!b.link) return
  if (b.link.startsWith('http')) return uni.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(b.link) })
  uni.navigateTo({ url: b.link })
}
const onQuickTap = (q) => {
  if (q.path) return uni.navigateTo({ url: q.path })
}
const onGoVerify = () => uni.navigateTo({ url: '/pages/verification-hub/verification-hub' })
const onUserTap = (u) => uni.navigateTo({ url: `/pages/user-profile/user-profile?id=${u.id}` })
const onMorePosts = () => uni.navigateTo({ url: '/pages/discover/discover?tab=posts' })
const onPostTap = (p) => uni.navigateTo({ url: `/pages/discover/discover?tab=posts&postId=${p.id}` })
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  height: 100vh;
  background: $by-bg;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* -------- Header -------- */
.header { position: relative; z-index: 20; }
.header-bg {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, color.change($by-aurora-a, $alpha: .55) 0%, color.change($by-bg, $alpha: 0) 100%),
              linear-gradient(180deg, $by-bg-soft 0%, $by-bg 100%);
}
.header-row {
  position: relative;
  display: flex; align-items: center; justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 20rpx) 32rpx 12rpx;
}
.brand { display: flex; align-items: center; gap: 16rpx; }
.logo-wrap { position: relative; width: 72rpx; height: 72rpx; }
.logo {
  width: 72rpx; height: 72rpx; border-radius: 22rpx;
  background: $by-gradient-gold;
  color: #0B0F1A; font-weight: 800; font-size: 36rpx;
  display: flex; align-items: center; justify-content: center;
  box-shadow: $by-shadow-gold;
}
.logo-ring {
  position: absolute; inset: -6rpx;
  border-radius: 26rpx;
  border: 2rpx solid color.change($by-gold, $alpha: .35);
  pointer-events: none;
}
.brand-text { display: flex; flex-direction: column; }
.brand-title {
  font-size: 40rpx; font-weight: 800;
  background: $by-gradient-gold;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  letter-spacing: 2rpx;
}
.brand-sub { font-size: 20rpx; color: $by-text-3; margin-top: 2rpx; }
.actions { display: flex; gap: 12rpx; }
.icon-btn {
  width: 72rpx; height: 72rpx;
  border-radius: 9999rpx;
  background: color.change(#FFFFFF, $alpha: .06);
  border: 1rpx solid $by-border;
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
.icon-btn:active { background: color.change(#FFFFFF, $alpha: .12); }
.icon-svg { font-size: 32rpx; }
.badge {
  position: absolute; top: 14rpx; right: 14rpx;
  width: 16rpx; height: 16rpx; border-radius: 9999rpx;
  background: $by-error; border: 3rpx solid $by-bg;
}

.search-row {
  position: relative;
  display: flex; align-items: center; gap: 16rpx;
  padding: 8rpx 32rpx 20rpx;
}
.city { display: flex; align-items: center; gap: 6rpx; flex-shrink: 0;
  padding: 10rpx 20rpx; border-radius: 9999rpx;
  background: color.change(#FFFFFF, $alpha: .06); border: 1rpx solid $by-border; }
.city-icon { font-size: 24rpx; }
.city-name { font-size: 26rpx; color: $by-text-1; font-weight: 600; }
.city-arrow { font-size: 20rpx; color: $by-text-3; }
.search-input {
  flex: 1; display: flex; align-items: center; gap: 10rpx;
  padding: 18rpx 24rpx;
  border-radius: 9999rpx;
  background: color.change(#FFFFFF, $alpha: .06);
  border: 1rpx solid $by-border;
}
.s-icon { font-size: 26rpx; opacity: .8; }
.s-placeholder { font-size: 26rpx; color: $by-text-3; }

/* -------- Scroll -------- */
.scroll {
  flex: 1;
  min-height: 0;
  height: 0;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* -------- Banner -------- */
.banner-wrap { padding: 10rpx 32rpx 0; }
.banner-swiper { height: 300rpx; border-radius: $by-radius-lg; overflow: hidden; }
.banner {
  position: relative;
  height: 300rpx; border-radius: $by-radius-lg; overflow: hidden;
  box-shadow: $by-shadow-2;
}
.banner-img { width: 100%; height: 100%; }
.banner-aurora {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 50%, color.change($by-bg, $alpha: .92) 100%);
}
.banner-info {
  position: absolute; left: 28rpx; right: 28rpx; bottom: 24rpx;
}
.banner-title {
  font-size: 30rpx; font-weight: 700; color: $by-text-1;
  text-shadow: 0 2rpx 12rpx color.change(#000000, $alpha: .6);
}

/* -------- Quick entries 4 宫格 -------- */
.quick-wrap {
  margin: 24rpx 32rpx 0;
  padding: 28rpx 16rpx !important;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx 0;
}
.quick-item {
  display: flex; flex-direction: column; align-items: center; gap: 10rpx;
  position: relative;
  padding: 8rpx 0;
  border-radius: $by-radius-md;
}
.quick-item:active { background: color.change(#FFFFFF, $alpha: .04); }
.quick-icon {
  width: 96rpx; height: 96rpx; border-radius: $by-radius-lg;
  display: flex; align-items: center; justify-content: center;
  background: color.change(#FFFFFF, $alpha: .06);
  border: 1rpx solid $by-border;
}
.qi-emoji { font-size: 44rpx; }
.qi-finder  { background: linear-gradient(135deg, color.change($by-info, $alpha: .25), color.change($by-aurora-c, $alpha: .12)); border-color: color.change($by-info, $alpha: .3); }
.qi-posts   { background: linear-gradient(135deg, color.change($by-aurora-b, $alpha: .3), color.change($by-aurora-a, $alpha: .12)); border-color: color.change($by-aurora-b, $alpha: .3); }
.qi-groups  { background: linear-gradient(135deg, color.change($by-success, $alpha: .25), color.change($by-info, $alpha: .1)); border-color: color.change($by-success, $alpha: .3); }
.qi-redpack { background: linear-gradient(135deg, color.change($by-gold, $alpha: .25), color.change($by-gold-deep, $alpha: .08)); border-color: color.change($by-gold, $alpha: .3); }
.quick-label { font-size: 24rpx; color: $by-text-2; font-weight: 500; }

/* -------- 认证引导条 -------- */
.verify-bar {
  position: relative; overflow: hidden;
  margin: 24rpx 32rpx 0;
  padding: 24rpx 28rpx !important;
}
.verify-bar-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 100% 0%, color.change($by-aurora-b, $alpha: .3), transparent 55%),
    radial-gradient(circle at 0% 100%, color.change($by-gold, $alpha: .2), transparent 55%);
  pointer-events: none;
}
.verify-bar-body { position: relative; display: flex; align-items: center; gap: 16rpx; }
.verify-bar-left { flex: 1; display: flex; align-items: center; gap: 12rpx; min-width: 0; }
.verify-bar-icon { font-size: 36rpx; flex-shrink: 0; }
.verify-bar-text { font-size: 26rpx; color: $by-text-1; font-weight: 600; }
.verify-bar-btn {
  flex-shrink: 0; padding: 14rpx 28rpx;
  background: $by-gradient-gold;
  border-radius: $by-radius-md;
  box-shadow: $by-shadow-gold;
}
.verify-bar-btn-text { color: #0B0F1A; font-size: 24rpx; font-weight: 700; white-space: nowrap; }

/* -------- Section -------- */
.section { padding: 12rpx 32rpx 0; }
.section-head { display: flex; align-items: center; justify-content: space-between; padding: 20rpx 0 16rpx; }
.section-title { font-size: 32rpx; font-weight: 700; color: $by-text-1; }
.section-more { font-size: 24rpx; color: $by-text-3; }

/* -------- 推荐用户卡片 -------- */
.user-scroll { width: 100%; }
.user-row {
  display: inline-flex; gap: 20rpx;
  padding: 4rpx 0 24rpx;
}
.user-card {
  width: 240rpx; flex-shrink: 0;
  border-radius: $by-radius-lg;
  background: $by-surface;
  border: 1rpx solid $by-border;
  padding: 20rpx 16rpx;
  display: flex; flex-direction: column; align-items: center; gap: 14rpx;
}
.user-card:active { background: $by-surface-2; }
.user-avatar {
  width: 110rpx; height: 110rpx; border-radius: 9999rpx;
  border: 3rpx solid color.change($by-aurora-a, $alpha: .4);
  box-shadow: 0 4rpx 20rpx color.change($by-aurora-a, $alpha: .2);
}
.user-info { width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6rpx; }
.user-name-row { display: flex; align-items: center; gap: 8rpx; justify-content: center; width: 100%; }
.user-name { font-size: 26rpx; font-weight: 700; color: $by-text-1; max-width: 140rpx; }
.user-gender {
  width: 28rpx; height: 28rpx; border-radius: 9999rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 18rpx;
}
.g-male { background: color.change($by-info, $alpha: .2); color: $by-info; }
.g-female { background: color.change($by-aurora-b, $alpha: .2); color: $by-aurora-b; }
.user-gender-icon { font-size: 18rpx; }
.user-age-city { font-size: 22rpx; color: $by-text-3; }
.user-bio {
  font-size: 22rpx; color: $by-text-2;
  line-height: 1.35; height: 30rpx; overflow: hidden;
  width: 100%;
}

/* -------- 最新动态 -------- */
.post-card {
  margin: 0 0 16rpx;
  padding: 24rpx !important;
}
.post-card:active { background: $by-surface-2; }
.post-head { display: flex; align-items: center; gap: 16rpx; margin-bottom: 16rpx; }
.post-avatar {
  width: 64rpx; height: 64rpx; border-radius: 9999rpx;
  flex-shrink: 0;
  border: 2rpx solid $by-border;
}
.post-meta { flex: 1; display: flex; flex-direction: column; gap: 4rpx; min-width: 0; }
.post-nickname { font-size: 28rpx; font-weight: 600; color: $by-text-1; }
.post-time { font-size: 22rpx; color: $by-text-3; }
.post-content {
  font-size: 28rpx; color: $by-text-2; line-height: 1.55;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 16rpx;
}
.post-images { display: flex; gap: 12rpx; margin-bottom: 16rpx; flex-wrap: wrap; }
.post-thumb {
  width: 180rpx; height: 180rpx; border-radius: $by-radius-md;
  border: 1rpx solid $by-border;
}
.post-more-img {
  width: 180rpx; height: 180rpx; border-radius: $by-radius-md;
  background: color.change(#000000, $alpha: .5);
  display: flex; align-items: center; justify-content: center;
}
.post-more-img-text { color: #FFFFFF; font-size: 28rpx; font-weight: 700; }
.post-stats { display: flex; gap: 32rpx; }
.post-stat { font-size: 24rpx; color: $by-text-3; }

/* -------- Common -------- */
.loading-wrap { padding: 40rpx 0; text-align: center; }
.loading { color: $by-text-3; font-size: 26rpx; }
.empty { padding: 60rpx 32rpx; display: flex; flex-direction: column; align-items: center; gap: 16rpx; text-align: center; }
.empty-emoji { font-size: 80rpx; }
.empty-text { color: $by-text-3; }

/* 网络异常诊断条 */
.net-troubleshoot {
  margin: 16rpx 32rpx 0;
  background: linear-gradient(180deg, color.adjust($by-info, $alpha: 0.12), color.adjust($by-aurora-a, $alpha: 0.08));
  border: 1rpx solid color.adjust($by-info, $alpha: 0.35);
}
.nt-head { display: flex; align-items: center; gap: 16rpx; }
.nt-icon { font-size: 44rpx; }
.nt-info { display: flex; flex-direction: column; flex: 1; gap: 6rpx; min-width: 0; }
.nt-title { color: $by-text-1; font-weight: 700; font-size: 28rpx; }
.nt-desc { color: $by-text-2; font-size: 24rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nt-actions { display: flex; gap: 16rpx; margin-top: 20rpx; }
.nt-btn { flex: 1; padding: 18rpx 0; font-size: 26rpx; }
.nt-tips { margin-top: 16rpx; color: $by-text-muted; font-size: 22rpx; line-height: 1.6; }
.mono { font-family: Menlo, Consolas, monospace; }

.bottom-safe { height: calc(140rpx + env(safe-area-inset-bottom)); }
</style>
