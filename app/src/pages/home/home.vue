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
          <text class="s-placeholder">搜服务 / 大神 / 组局主题</text>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="scroll" :refresher-enabled="true" :refresher-triggered="refreshing" @refresherrefresh="onRefresh">
      <!-- 网络异常诊断条（真机本地 WiFi 场景最常见：BASE_URL 指向了电脑 IP 不正确 → 看上去像黑屏） -->
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

      <!-- 快捷入口 6 宫格（暖心/游戏/线下/唱歌/哄睡/精英） -->
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
          <view v-if="q.tag" class="quick-tag">{{ q.tag }}</view>
        </view>
      </view>

      <!-- 精英开通 CTA -->
      <view class="elite-cta card" @tap="onElite">
        <view class="elite-bg"></view>
        <view class="elite-body">
          <view class="elite-left">
            <view class="elite-badge">✨ 白夜精英</view>
            <text class="elite-title">{{ eliteInfo.totalJoinedApprox || 12876 }} 人已解锁特权</text>
            <text class="elite-desc">无限聊天 · 精英徽章 · 优先匹配 · 解锁微信号</text>
          </view>
          <view class="elite-btn">
            <text class="elite-price">¥{{ eliteInfo.priceYuan || '30.00' }}</text>
            <text class="elite-plan">终身</text>
          </view>
        </view>
      </view>

      <!-- 分类 chips -->
      <view class="chips">
        <scroll-view scroll-x class="hide-scrollbar">
          <view class="chips-inner">
            <text
              v-for="(c, i) in categories"
              :key="i"
              class="chip"
              :class="{ active: activeCategory === c.key }"
              @tap="activeCategory = c.key"
            >{{ c.label }}</text>
          </view>
        </scroll-view>
      </view>

      <!-- 为你推荐（服务卡） -->
      <view class="section">
        <view class="section-head">
          <text class="section-title">🔥 为你推荐</text>
          <text class="section-more" @tap="onMoreService">查看更多 ›</text>
        </view>
        <view v-if="loading" class="loading-wrap">
          <text class="loading">加载中…</text>
        </view>
        <view v-else-if="recommendList.length === 0" class="empty">
          <text class="empty-emoji">{{ anyLoadFailed ? '📡' : '🌙' }}</text>
          <text class="empty-text">{{ anyLoadFailed ? '无法连接到服务器，先检查一下服务器地址吧' : '暂无服务，稍后再来看看' }}</text>
          <view v-if="anyLoadFailed" class="empty-actions">
            <view class="btn-outline" @tap="onFixServerUrl">🛠 设置服务器地址</view>
            <view class="btn-primary" @tap="onRefreshRetry">🔄 重试加载</view>
          </view>
          <text class="empty-hint" v-if="anyLoadFailed">本地 WiFi 真机调试 → 地址格式：http://电脑IP:3000/api</text>
        </view>
        <ServiceCard
          v-for="item in recommendList"
          :key="item.id"
          :item="item"
          @tap="onCardTap"
          @contact="onContact"
        />
      </view>

      <view class="bottom-safe"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import ServiceCard from '../../components/ServiceCard.vue'
import { serviceApi, bannerApi, eliteApi, locationApi } from '../../api'
import { useUserStore } from '../../store/user'
import {
  toList, toStr, toNum, pickCity, getPath, guard, unwrap, requireLogin, resolveCityViaPipeline
} from '../../utils/fallback'
import { getCurrentBaseURL, openServerUrlModal } from '../../utils/request'

const userStore = useUserStore()
const CITY_KEY = 'baiye_city'
const CITY_AT_KEY = 'baiye_city_at'
const DEFAULT_CITY = '北京'
const city = ref(DEFAULT_CITY)
const tryLocateRef = ref(0) // 防止重复自动定位
const banners = ref([])
const eliteInfo = ref({})
const msgBadge = ref(true)
const refreshing = ref(false)
const loading = ref(false)
/* ---- 服务器连接异常追踪（用于"黑屏友好"提示） ---- */
const bannerLoadFailed = ref(false)
const listLoadFailed = ref(false)
const eliteLoadFailed = ref(false)
const currentBaseURL = computed(() => getCurrentBaseURL())
const anyLoadFailed = computed(() => bannerLoadFailed.value || listLoadFailed.value || eliteLoadFailed.value)
// 仅当所有核心卡片都"无数据 + 至少一次加载失败"时才顶栏显示诊断条，避免正常数据页面视觉干扰
const showNetTrouble = computed(() => anyLoadFailed.value && banners.value.length === 0 && recommendList.value.length === 0)

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
 * 4 级定位流水线（首页版，兼容缓存 + 逆地理 + IP 粗定位 + 默认）
 * 异常均不抛出，页面保持可用；失败时保留上次城市或默认值
 */
const tryAutoLocate = async () => {
  if (tryLocateRef.value++) return
  readCity()
  // L1：24 小时内已更新过定位的不再自动触发
  const at = Number(uni.getStorageSync(CITY_AT_KEY) || 0)
  if (Date.now() - at < 24 * 3600 * 1000) return

  try {
    const result = await resolveCityViaPipeline({
      requestFn: async ({ url, method, data }) => {
        if (method === 'POST' && url === '/location/reverse') return locationApi.reverse(data)
        if (method === 'GET' && url === '/location/guess-by-ip') return locationApi.guessByIp()
        return null
      },
      preferCacheMs: 0 // 这里 L1 已经判断，进入流水线直接从 L2 开始
    })
    if (result && result.city) {
      city.value = result.city
      try { uni.setStorageSync(CITY_KEY, result.city) } catch (_) {}
    }
  } catch (_) {
    // 任何异常：保留上次 city.value，不影响页面
  }
}

const categories = [
  { key: '', label: '全部' },
  { key: 'warm', label: '暖心陪伴' },
  { key: 'game', label: '游戏陪玩' },
  { key: 'offline', label: '线下约玩' },
  { key: 'sing', label: '唱歌' },
  { key: 'sleep', label: '哄睡叫醒' },
  { key: 'chat', label: '连麦聊天' }
]
const activeCategory = ref('')
const recommendList = ref([])

const quickEntries = [
  { key: 'warm', label: '暖心陪伴', emoji: '🤍', path: '/pages/warm/warm' },
  { key: 'game', label: '游戏陪玩', emoji: '🎮', path: '/pages/game/game' },
  { key: 'offline', label: '线下约玩', emoji: '🍻', path: '/pages/offline/offline' },
  { key: 'sing', label: '唱歌', emoji: '🎤' },
  { key: 'sleep', label: '哄睡叫醒', emoji: '🌙' },
  { key: 'elite', label: '精英特权', emoji: '👑', tag: 'NEW', path: '/pages/elite-pay/elite-pay' }
]

const loadBanners = async () => {
  bannerLoadFailed.value = false
  try {
    const res = await guard(bannerApi.list({ position: 'home_top', pageSize: 10 }), null)
    banners.value = toList(getPath(unwrap(res, null), 'list', []))
  } catch (e) { banners.value = []; bannerLoadFailed.value = true }
  if (banners.value.length === 0) {
    banners.value = [
      { id: -1, title: '净化网络环境 · 传播正能量', image: '/static/sucai/07db62c02f72d99581cffc375c02969e.jpg', link: '/pages/feedback/feedback' },
      { id: -2, title: '精英优先报名 · 组局新玩法', image: '/static/sucai/378849617002ad354923701552859204.jpg', link: '/pages/elite-pay/elite-pay' }
    ]
  }
}

const loadEliteInfo = async () => {
  eliteLoadFailed.value = false
  try {
    const res = await guard(eliteApi.rights(), null)
    eliteInfo.value = unwrap(res, {}) || {}
  } catch (e) { eliteInfo.value = { priceYuan: '30.00', totalJoinedApprox: 12876 }; eliteLoadFailed.value = true }
  if (!eliteInfo.value || typeof eliteInfo.value !== 'object') {
    eliteInfo.value = { priceYuan: '30.00', totalJoinedApprox: 12876 }
  }
}

const loadList = async () => {
  loading.value = true
  listLoadFailed.value = false
  try {
    const params = { page: 1, pageSize: 20 }
    if (activeCategory.value) params.category = activeCategory.value
    if (city.value && city.value !== '全国') params.city = city.value
    const res = await guard(serviceApi.list(params), null)
    const rows = toList(getPath(unwrap(res, null), 'list', []))
    recommendList.value = rows.map((s) => ({
      id: s.id,
      nickname: toStr(s.providerName || s.provider?.nickname || '匿名服务者', '匿名服务者'),
      avatar: toStr(s.coverImage || s.providerAvatar || s.provider?.avatar || '/assets/avatar-provider-01.jpg', '/assets/avatar-provider-01.jpg'),
      intro: toStr(s.title, '暂无标题'),
      tags: toList(s.tags).slice(0, 3).map((t, i) => ({
        label: toStr(t, ''),
        color: ['yellow', 'purple', 'blue', 'pink'][i % 4] || 'yellow'
      })).filter((t) => t.label),
      price: toNum(s.price, 0),
      priceUnit: toStr(s.priceUnit, '次'),
      _raw: s
    }))
  } catch (e) {
    recommendList.value = []
    listLoadFailed.value = true
  } finally {
    loading.value = false
  }
}

watch(activeCategory, loadList)

const onRefresh = async () => {
  refreshing.value = true
  await Promise.all([loadBanners(), loadEliteInfo(), loadList()])
  refreshing.value = false
}

onShow(() => {
  readCity()
  loadBanners()
  loadEliteInfo()
  loadList()
  if (userStore.token) msgBadge.value = true
})
onMounted(() => tryAutoLocate())

/* -------- 事件 -------- */
const onSearch = () => uni.navigateTo({ url: '/pages/search/search' })
const onPickCity = () => uni.navigateTo({ url: '/pages/city/city' })
const onMessage = () => uni.navigateTo({ url: '/pages/chat-list/chat-list' })
const onBannerTap = (b) => {
  if (!b.link) return
  if (b.link.startsWith('http')) return uni.navigateTo({ url: '/pages/webview?url=' + encodeURIComponent(b.link) })
  uni.navigateTo({ url: b.link })
}
const onQuickTap = (q) => {
  if (q.path) return uni.navigateTo({ url: q.path })
  activeCategory.value = q.key
  uni.pageScrollTo({ scrollTop: 400, duration: 300 })
}
const onElite = () => uni.navigateTo({ url: '/pages/elite-pay/elite-pay' })
const onMoreService = () => uni.showToast({ title: '上滑查看更多', icon: 'none' })
const onCardTap = (item) => uni.navigateTo({ url: `/pages/service-detail/service-detail?id=${item.id}` })
const onContact = (item) => {
  if (!requireLogin()) return
  const providerId = getPath(item, '_raw.providerId', '')
  if (providerId) uni.navigateTo({ url: `/pages/chat/chat?to=${providerId}` })
  else uni.showToast({ title: `已向 ${toStr(item.nickname, '服务者')} 发起联系`, icon: 'none' })
}
</script>

<style lang="scss" scoped>
/* uni.scss 会自动注入到本 style 块顶部，已加载 sass:color 和 $by-* 全局变量。
 * ✅ 直接用 color.adjust / $by-*；❌ 不要再写 @use "sass:color"（冲突）或 @use theme-baiye.scss。
 */
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
  padding: 20rpx 32rpx 12rpx;
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
  min-height: 0; /* 关键：防止 flex 子项撑破父容器，导致下滑滑不回来 */
  height: 0; /* 配合 flex:1 让内容区域完全由父布局决定，避免高度抖动 */
  -webkit-overflow-scrolling: touch; /* iOS 惯性滚动，保证流畅 */
  overscroll-behavior: contain; /* 防止整页 pull-refresh 干扰内部滚 */
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

/* -------- Quick entries -------- */
.quick-wrap {
  margin: 24rpx 32rpx 0;
  padding: 28rpx 16rpx !important;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  row-gap: 24rpx;
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
.qi-warm    { background: linear-gradient(135deg, color.change($by-gold, $alpha: .25), color.change($by-gold-deep, $alpha: .08)); border-color: color.change($by-gold, $alpha: .3); }
.qi-game    { background: linear-gradient(135deg, color.change($by-info, $alpha: .25), color.change($by-aurora-a, $alpha: .12)); border-color: color.change($by-info, $alpha: .3); }
.qi-offline { background: linear-gradient(135deg, color.change($by-success, $alpha: .25), color.change($by-info, $alpha: .1)); border-color: color.change($by-success, $alpha: .3); }
.qi-sing    { background: linear-gradient(135deg, color.change($by-aurora-b, $alpha: .3), color.change($by-aurora-a, $alpha: .12)); border-color: color.change($by-aurora-b, $alpha: .3); }
.qi-sleep   { background: linear-gradient(135deg, color.change($by-aurora-a, $alpha: .3), color.change($by-aurora-c, $alpha: .1)); border-color: color.change($by-aurora-a, $alpha: .3); }
.qi-elite   { background: $by-gradient-aurora; border-color: transparent; box-shadow: 0 8rpx 24rpx color.change($by-aurora-a, $alpha: .35); }
.quick-label { font-size: 24rpx; color: $by-text-2; font-weight: 500; }
.quick-tag {
  position: absolute; top: -2rpx; right: 16rpx;
  font-size: 18rpx; padding: 2rpx 10rpx; border-radius: 9999rpx;
  background: $by-gradient-gold; color: #0B0F1A; font-weight: 700;
}

/* -------- Elite CTA -------- */
.elite-cta {
  position: relative; overflow: hidden;
  margin: 24rpx 32rpx 0;
  padding: 28rpx 28rpx !important;
}
.elite-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 100% 0%, color.change($by-aurora-b, $alpha: .35), transparent 55%),
    radial-gradient(circle at 0% 100%, color.change($by-gold, $alpha: .25), transparent 55%);
  pointer-events: none;
}
.elite-body { position: relative; display: flex; align-items: center; gap: 20rpx; }
.elite-left { flex: 1; display: flex; flex-direction: column; gap: 8rpx; min-width: 0; }
.elite-badge {
  align-self: flex-start;
  padding: 4rpx 18rpx; border-radius: 9999rpx;
  background: $by-gradient-aurora; color: #fff;
  font-size: 22rpx; font-weight: 700;
}
.elite-title { font-size: 30rpx; font-weight: 700; color: $by-text-1; }
.elite-desc { font-size: 22rpx; color: $by-text-3; line-height: 1.4; }
.elite-btn {
  flex-shrink: 0; padding: 14rpx 22rpx;
  background: $by-gradient-gold;
  border-radius: $by-radius-md;
  display: flex; flex-direction: column; align-items: center;
  box-shadow: $by-shadow-gold;
}
.elite-price { color: #0B0F1A; font-weight: 800; font-size: 30rpx; }
.elite-plan { color: #0B0F1A; font-size: 20rpx; opacity: .8; }

/* -------- Chips -------- */
.chips { padding: 28rpx 0 12rpx; }
.chips-inner { display: inline-flex; gap: 16rpx; padding: 0 32rpx; }
.chip {
  padding: 14rpx 28rpx; border-radius: 9999rpx;
  background: color.change(#FFFFFF, $alpha: .05);
  border: 1rpx solid $by-border;
  color: $by-text-2; font-size: 26rpx; font-weight: 500;
  white-space: nowrap;
}
.chip.active {
  background: $by-gradient-gold; color: #0B0F1A;
  border-color: transparent; font-weight: 700;
  box-shadow: $by-shadow-gold;
}

/* -------- Section -------- */
.section { padding: 12rpx 32rpx 0; }
.section-head { display: flex; align-items: center; justify-content: space-between; padding: 20rpx 0 16rpx; }
.section-title { font-size: 32rpx; font-weight: 700; color: $by-text-1; }
.section-more { font-size: 24rpx; color: $by-text-3; }

.loading-wrap { padding: 40rpx 0; text-align: center; }
.loading { color: $by-text-3; font-size: 26rpx; }
.empty { padding: 80rpx 32rpx; display: flex; flex-direction: column; align-items: center; gap: 16rpx; text-align: center; }
.empty-emoji { font-size: 80rpx; }
.empty-text { color: $by-text-3; }
.empty-hint { color: $by-text-muted; font-size: 24rpx; margin-top: 8rpx; }
.empty-actions { display: flex; gap: 16rpx; margin-top: 16rpx; flex-wrap: wrap; justify-content: center; }
.empty-actions .btn-outline,
.empty-actions .btn-primary { padding: 18rpx 28rpx; font-size: 26rpx; }

/* 网络异常诊断条（黑屏友好） */
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
