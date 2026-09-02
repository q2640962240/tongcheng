<template>
  <view class="page">
    <!-- 加载中 / 空态：service 为 null -->
    <view v-if="!service" class="state-wrap">
      <view class="state-aurora"></view>
      <!-- 加载骨架 -->
      <template v-if="serviceLoading">
        <view class="cover-placeholder sk-cover"></view>
        <view class="info-card sk-card">
          <view class="sk-line sk-line-price"></view>
          <view class="sk-line sk-line-title"></view>
          <view class="sk-tags">
            <view class="sk-tag" v-for="i in 3" :key="i"></view>
          </view>
          <view class="sk-line sk-line-desc"></view>
          <view class="sk-line sk-line-desc-2"></view>
        </view>
        <view class="card sk-card">
          <view class="sk-line sk-line-sm"></view>
          <view class="sk-provider">
            <view class="sk-avatar"></view>
            <view class="sk-provider-info">
              <view class="sk-line sk-line-md"></view>
              <view class="sk-line sk-line-sm"></view>
            </view>
          </view>
        </view>
      </template>
      <!-- 空态：已加载但无数据 -->
      <template v-else>
        <text class="state-icon">🌙</text>
        <text class="state-title">暂无</text>
        <text class="state-sub">服务信息加载失败或不存在</text>
        <view class="state-btn" @tap="onBack">返回上一页</view>
      </template>
    </view>

    <!-- 正常渲染 -->
    <template v-else>
      <!-- 封面 -->
      <view class="cover-wrap">
        <image v-if="service.coverImage" class="cover" :src="service.coverImage" mode="aspectFill" />
        <view v-else class="cover cover-placeholder">
          <text class="cover-icon">{{ categoryIcon(service.category) }}</text>
        </view>
        <view class="back-btn" @tap="onBack">‹</view>
        <view class="cover-gradient"></view>
      </view>

      <!-- 标题与价格 -->
      <view class="info-card">
        <view class="price-row">
          <view class="price-info">
            <text class="price-num">{{ service.price }}</text>
            <text class="price-unit">星币/{{ service.priceUnit }}</text>
          </view>
          <view class="stats">
            <text class="stat-item">👁 {{ formatCount(service.viewCount) }}</text>
            <text class="stat-item">📦 {{ formatCount(service.orderCount) }}</text>
            <text class="stat-item">⭐ {{ service.ratingAvg.toFixed(1) }}</text>
          </view>
        </view>
        <text class="title">{{ service.title }}</text>
        <view class="tags" v-if="service.tags && service.tags.length">
          <text v-for="(t, i) in service.tags" :key="i" class="tag">{{ t }}</text>
        </view>
        <text class="desc">{{ service.description }}</text>
      </view>

      <!-- 服务者信息 -->
      <view class="card">
        <text class="card-title">服务者</text>
        <view class="provider-row">
          <image class="avatar" :src="service.provider.avatar" mode="aspectFill" @tap="onProvider" />
          <view class="provider-info" @tap="onProvider">
            <view class="name-row">
              <text class="name">{{ service.provider.nickname }}</text>
              <text v-if="service.provider.isElite" class="elite-badge">精英</text>
            </view>
            <text class="bio">{{ service.provider.bio || '这个人很懒，还没写简介' }}</text>
            <text class="view-more">查看主页 ›</text>
          </view>
          <view class="chat-btn" @tap="onChat">💬</view>
        </view>
      </view>

      <!-- 评价区 -->
      <view class="card">
        <view class="reviews-header">
          <text class="card-title">用户评价</text>
          <view class="rating-summary" v-if="reviewMeta.totalReviews > 0">
            <text class="big-rating">{{ reviewMeta.ratingAvg.toFixed(1) }}</text>
            <view class="stars-row">
              <text class="rs-star" v-for="i in 5" :key="i" :class="{ on: i <= Math.round(reviewMeta.ratingAvg) }">★</text>
            </view>
            <text class="rs-count">{{ reviewMeta.totalReviews }} 条</text>
          </view>
        </view>

        <!-- 评价列表 -->
        <view v-if="reviews.length" class="reviews-list">
          <view v-for="r in reviews" :key="r.id" class="review-item">
            <view class="rv-top">
              <image class="rv-avatar" :src="r.reviewer.avatar" mode="aspectFill" />
              <text class="rv-name">{{ r.isAnonymous ? '匿名用户' : r.reviewer.nickname }}</text>
              <view class="rv-stars">
                <text class="rv-star" v-for="i in 5" :key="i" :class="{ on: i <= r.rating }">★</text>
              </view>
            </view>
            <text v-if="r.content" class="rv-content">{{ r.content }}</text>
            <view v-if="r.images && r.images.length" class="rv-images">
              <image v-for="(img, i) in r.images" :key="i" class="rv-img" :src="img" mode="aspectFill" @tap="previewImage(r.images, i)" />
            </view>
            <text class="rv-time">{{ formatTime(r.createdAt) }}</text>
          </view>
          <view v-if="reviews.length < reviewMeta.totalReviews" class="rv-more" @tap="loadMoreReviews">
            {{ reviewsLoading ? '加载中…' : '查看更多评价' }}
          </view>
        </view>

        <!-- 加载中评价 -->
        <view v-else-if="reviewsLoading" class="rv-loading">
          <view class="rv-loading-spinner"></view>
          <text class="rv-loading-text">评价加载中…</text>
        </view>

        <!-- 空评价 -->
        <view v-else class="rv-empty">
          <text class="rv-empty-icon">✨</text>
          <text class="rv-empty-text">暂无评价，快来成为第一个评价的人吧</text>
        </view>
      </view>

      <!-- 购买选项 -->
      <view class="card">
        <text class="card-title">购买数量</text>
        <view class="quantity-row">
          <view class="qty-btn" @tap="onQty(-1)">-</view>
          <text class="qty-num">{{ quantity }}</text>
          <view class="qty-btn" @tap="onQty(1)">+</view>
          <view class="qty-summary">
            <text class="qty-total">合计</text>
            <text class="qty-amount">{{ totalAmount }} 星币</text>
          </view>
        </view>
        <view v-if="remark !== null" class="remark-wrap">
          <input v-model="remark" class="remark-input" placeholder="备注（选填）" placeholder-class="remark-placeholder" maxlength="200" />
        </view>
        <view v-else class="remark-toggle" @tap="remark = ''">+ 添加备注</view>
      </view>

      <view class="bottom-pad"></view>
    </template>

    <!-- 底部下单栏 -->
    <view class="bottom-bar" :class="{ disabled: !service }">
      <view class="bottom-left">
        <text class="bottom-label">合计</text>
        <text class="bottom-amount">{{ totalAmount }} 星币</text>
      </view>
      <view class="bottom-btn" :class="{ loading: !service }" @tap="onOrder">
        {{ service ? '立即下单' : '加载中…' }}
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { serviceApi, orderApi } from '../../api'
import {
  guard, unwrap, unwrapPage, safeMap, getPath,
  toStr, toNum, toBool, toObj, toList,
  avatarUrl, coverUrl, pickTags,
  requireLogin, requireElite, formatTime, formatCount
} from '../../utils/fallback'

const service = ref(null)
const serviceLoading = ref(true)
const quantity = ref(1)
const remark = ref(null)

const totalAmount = computed(() => {
  const p = toNum(getPath(service.value, 'price'), 0)
  const q = toNum(quantity.value, 1)
  const result = p * q
  return Number.isFinite(result) ? result : 0
})

// 评价数据
const reviews = ref([])
const reviewMeta = ref({ totalReviews: 0, ratingAvg: 0, distribution: {} })
const reviewPage = ref(1)
const reviewsLoading = ref(false)

const categoryIcon = (c) => ({ warm: '❤', game: '🎮', offline: '🎨' }[toStr(c, '')] || '📦')

const previewImage = (urls, current) => {
  const list = toList(urls)
  if (!list.length) return
  const idx = toNum(current, 0)
  uni.previewImage({ urls: list, current: list[idx] || list[0] })
}

// ===== service 字段收敛 =====
const normalizeService = (raw) => {
  const provider = toObj(getPath(raw, 'provider'), {})
  return {
    id: getPath(raw, 'id', ''),
    title: toStr(getPath(raw, 'title'), '服务详情'),
    price: toNum(getPath(raw, 'price'), 0),
    priceUnit: toStr(getPath(raw, 'priceUnit', getPath(raw, 'price_unit')), '次'),
    coverImage: coverUrl(getPath(raw, 'coverImage', getPath(raw, 'cover_image'))),
    category: toStr(getPath(raw, 'category'), ''),
    description: toStr(getPath(raw, 'description'), '暂无介绍'),
    viewCount: toNum(getPath(raw, 'viewCount', getPath(raw, 'view_count')), 0),
    orderCount: toNum(getPath(raw, 'orderCount', getPath(raw, 'order_count')), 0),
    ratingAvg: toNum(getPath(raw, 'ratingAvg', getPath(raw, 'rating_avg')), 5.0),
    tags: pickTags(getPath(raw, 'tags'), 5),
    provider: {
      ...provider,
      nickname: toStr(getPath(provider, 'nickname'), '匿名服务者'),
      avatar: avatarUrl(getPath(provider, 'avatar')),
      bio: toStr(getPath(provider, 'bio'), ''),
      isElite: toBool(getPath(provider, 'isElite', getPath(provider, 'is_elite')), false)
    }
  }
}

// ===== reviews 字段收敛 =====
const normalizeReview = (raw) => {
  const reviewer = toObj(getPath(raw, 'reviewer'), {})
  const imagesRaw = toList(getPath(raw, 'images'))
  return {
    id: getPath(raw, 'id', toStr(Math.random())),
    rating: toNum(getPath(raw, 'rating'), 5),
    content: toStr(getPath(raw, 'content'), ''),
    images: imagesRaw.map(img => coverUrl(img)),
    createdAt: getPath(raw, 'createdAt', getPath(raw, 'created_at')),
    reviewer: {
      ...reviewer,
      avatar: avatarUrl(getPath(reviewer, 'avatar')),
      nickname: toStr(getPath(reviewer, 'nickname'), '匿名用户')
    },
    isAnonymous: toBool(getPath(raw, 'isAnonymous', getPath(raw, 'is_anonymous')), false)
  }
}

// ===== loadReviews：异常全部吞，重置 safe 值 =====
const loadReviews = async (id, reset = true) => {
  if (reviewsLoading.value) return
  const sid = toStr(id, '')
  if (!sid) {
    reviews.value = []
    reviewMeta.value = { totalReviews: 0, ratingAvg: 0, distribution: {} }
    return
  }
  if (reset) { reviewPage.value = 1; reviews.value = [] }
  reviewsLoading.value = true
  try {
    const pageData = await guard(
      serviceApi.reviews(sid, { page: reviewPage.value, pageSize: 10 })
        .then(r => unwrapPage(r, { list: [], total: 0 })),
      { list: [], total: 0 }
    )
    const list = safeMap(pageData.list, normalizeReview)
    reviews.value = reset ? list : reviews.value.concat(list)

    // 同时从响应或 pageData 提取 meta
    const totalReviews = toNum(getPath(pageData, 'total', getPath(pageData, 'totalReviews')), reviews.value.length)
    const ratingAvg = toNum(getPath(pageData, 'ratingAvg', getPath(pageData, 'rating_avg')), 5.0)
    const distribution = toObj(getPath(pageData, 'distribution'), {})
    reviewMeta.value = { totalReviews, ratingAvg, distribution }
  } catch (_) {
    if (reset) {
      reviews.value = []
      reviewMeta.value = { totalReviews: 0, ratingAvg: 0, distribution: {} }
    }
  } finally {
    reviewsLoading.value = false
  }
}

const loadMoreReviews = () => {
  const sid = toStr(getPath(service.value, 'id'), '')
  if (!sid) return
  reviewPage.value++
  loadReviews(sid, false)
}

// ===== loadService：异常全部吞 =====
const loadService = async (id) => {
  const sid = toStr(id, '')
  if (!sid) {
    service.value = null
    serviceLoading.value = false
    return
  }
  serviceLoading.value = true
  try {
    const data = await guard(
      serviceApi.detail(sid).then(r => unwrap(r, null)),
      null
    )
    if (data) {
      service.value = normalizeService(data)
    } else {
      service.value = null
    }
  } catch (_) {
    service.value = null
  } finally {
    serviceLoading.value = false
  }
}

// ===== 并行加载：service + reviews =====
const loadAll = async (id) => {
  serviceLoading.value = true
  reviewsLoading.value = true
  reviews.value = []
  reviewMeta.value = { totalReviews: 0, ratingAvg: 0, distribution: {} }
  try {
    await Promise.all([
      loadService(id),
      loadReviews(id, true)
    ])
  } catch (_) {
    /* 并行异常全部吞 */
  } finally {
    serviceLoading.value = false
    reviewsLoading.value = false
  }
}

const onBack = () => uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/home/home' }) })

const onQty = (delta) => {
  const next = toNum(quantity.value, 1) + toNum(delta, 0)
  if (next < 1) return
  if (next > 99) return
  quantity.value = next
}

const onChat = () => {
  if (!service.value) return
  const provider = toObj(getPath(service.value, 'provider'), {})
  const pid = toStr(getPath(provider, 'id'), '')
  const pname = toStr(getPath(provider, 'nickname'), '匿名服务者')
  if (!pid) return
  uni.navigateTo({
    url: `/pages/chat/chat?userId=${pid}&name=${encodeURIComponent(pname)}`
  })
}

const onProvider = () => {
  if (!service.value) return
  const provider = toObj(getPath(service.value, 'provider'), {})
  const pid = toStr(getPath(provider, 'id'), '')
  if (!pid) return
  uni.navigateTo({ url: `/pages/provider/provider?id=${pid}` })
}

// ===== onOrder：requireElite + guard + unwrap + toObj + 判 id =====
const onOrder = () => {
  if (!service.value) return
  if (!requireElite()) return
  const sid = toStr(getPath(service.value, 'id'), '')
  const title = toStr(getPath(service.value, 'title'), '服务订单')
  const qty = toNum(quantity.value, 1)
  const amount = totalAmount.value
  if (!sid) {
    uni.showToast({ title: '服务信息异常', icon: 'none' })
    return
  }
  uni.showModal({
    title: '确认下单',
    content: `购买「${title}」x${qty}，共 ${amount} 星币？`,
    confirmText: '确认下单',
    success: async (res) => {
      if (!res.confirm) return
      try {
        const orderData = await guard(
          orderApi.create({
            serviceId: sid,
            quantity: qty,
            remark: toStr(remark.value, '') || undefined
          }).then(r => unwrap(r, null)),
          null
        )
        const obj = toObj(orderData, {})
        const oid = toStr(getPath(obj, 'id'), '')
        if (oid) {
          uni.showToast({ title: '下单成功', icon: 'success' })
          setTimeout(() => {
            uni.redirectTo({ url: `/pages/order-detail/order-detail?id=${oid}` })
          }, 800)
        } else {
          uni.showToast({ title: '下单失败，请重试', icon: 'none' })
        }
      } catch (_) {
        uni.showToast({ title: '下单失败，请重试', icon: 'none' })
      }
    }
  })
}

onLoad((q) => {
  const id = toStr(getPath(q, 'id'), '')
  if (id) {
    loadAll(id)
  } else {
    service.value = null
    serviceLoading.value = false
  }
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: $by-bg; padding-bottom: 200rpx; }

/* ===== State Wrap (null service) ===== */
.state-wrap {
  min-height: 100vh;
  padding: 0 0 200rpx;
  position: relative;
}
.state-aurora {
  position: absolute; top: 120rpx; left: 50%; transform: translateX(-50%);
  width: 400rpx; height: 400rpx; border-radius: 50%;
  background: $by-gradient-aurora;
  filter: blur(80rpx); opacity: 0.18;
  pointer-events: none;
}
.sk-cover {
  width: 100%; height: 480rpx;
  background: linear-gradient(135deg, $by-soft-card 0%, $by-surface-2 100%);
  background-size: 200% 200%;
  animation: shimmer 2s infinite ease-in-out;
}
.sk-card {
  margin-bottom: 16rpx;
}
.sk-line {
  border-radius: $by-radius-sm;
  background: linear-gradient(90deg, $by-soft-card 0%, $by-surface-2 50%, $by-soft-card 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}
.sk-line-price { height: 56rpx; width: 40%; margin-bottom: 24rpx; }
.sk-line-title { height: 36rpx; width: 80%; margin-bottom: 16rpx; }
.sk-tags { display: flex; gap: 8rpx; margin-bottom: 20rpx; }
.sk-tag {
  width: 80rpx; height: 32rpx; border-radius: $by-radius-pill;
  background: linear-gradient(90deg, $by-soft-card 0%, $by-surface-2 50%, $by-soft-card 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}
.sk-line-desc { height: 28rpx; width: 100%; margin-bottom: 10rpx; }
.sk-line-desc-2 { height: 28rpx; width: 70%; }
.sk-line-sm { height: 30rpx; width: 30%; margin-bottom: 24rpx; }
.sk-provider { display: flex; align-items: center; gap: 20rpx; }
.sk-avatar {
  width: 96rpx; height: 96rpx; border-radius: $by-radius-pill;
  background: linear-gradient(90deg, $by-soft-card 0%, $by-surface-2 50%, $by-soft-card 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}
.sk-provider-info { flex: 1; display: flex; flex-direction: column; gap: 12rpx; }
.sk-line-md { height: 28rpx; width: 50%; }
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.state-icon {
  display: block; text-align: center;
  font-size: 120rpx; padding-top: 300rpx;
  position: relative; z-index: 1;
}
.state-title {
  display: block; text-align: center;
  font-size: 36rpx; font-weight: 700; color: $by-text-1;
  margin-top: 24rpx; position: relative; z-index: 1;
}
.state-sub {
  display: block; text-align: center;
  font-size: 26rpx; color: $by-text-3;
  margin-top: 12rpx; position: relative; z-index: 1;
}
.state-btn {
  margin: 48rpx auto 0;
  width: 320rpx; height: 88rpx;
  background: $by-gradient-gold;
  color: #0B0F1A; font-weight: 600; font-size: 28rpx;
  border-radius: $by-radius-pill;
  display: flex; align-items: center; justify-content: center;
  box-shadow: $by-shadow-gold;
  position: relative; z-index: 1;
}

/* ===== Cover ===== */
.cover-wrap { position: relative; width: 100%; height: 480rpx; }
.cover { width: 100%; height: 100%; }
.cover-placeholder {
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, $by-soft-card 0%, $by-surface-2 100%);
}
.cover-icon { font-size: 120rpx; }
.cover-gradient {
  position: absolute; bottom: 0; left: 0; right: 0; height: 180rpx;
  background: linear-gradient(180deg, transparent 0%, $by-bg 100%);
  pointer-events: none;
}
.back-btn {
  position: absolute; top: calc(env(safe-area-inset-top) + 24rpx); left: 24rpx;
  width: 72rpx; height: 72rpx; border-radius: $by-radius-pill;
  background: color.adjust(#000000, $alpha: 0.5);
  color: $by-text-1; font-size: 48rpx;
  display: flex; align-items: center; justify-content: center;
}

/* ===== Info Card ===== */
.info-card {
  background: $by-card-bg;
  padding: 32rpx; margin: -40rpx $by-page-pad-x 16rpx;
  border-radius: 28rpx;
  border: 1rpx solid $by-border;
  position: relative; z-index: 2;
}
.price-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.price-info { display: flex; align-items: baseline; gap: 6rpx; }
.price-num {
  font-size: 56rpx; font-weight: 700;
  background: $by-gradient-gold;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.price-unit { font-size: 26rpx; color: $by-text-3; }
.stats { display: flex; gap: 16rpx; }
.stat-item { font-size: 22rpx; color: $by-text-3; }
.title { font-size: 36rpx; font-weight: 700; color: $by-text-1; display: block; margin-bottom: 16rpx; }
.tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-bottom: 20rpx; }
.tag {
  font-size: 22rpx; padding: 6rpx 18rpx;
  background: color.adjust($by-gold, $alpha: 0.16);
  color: $by-gold;
  border-radius: $by-radius-pill;
  border: 1rpx solid color.adjust($by-gold, $alpha: 0.28);
}
.desc { font-size: 28rpx; color: $by-text-2; line-height: 1.7; }

/* ===== Generic Card ===== */
.card {
  background: $by-card-bg;
  padding: 32rpx; margin: 0 $by-page-pad-x 16rpx;
  border-radius: 28rpx;
  border: 1rpx solid $by-border;
}
.card-title {
  font-size: 30rpx; font-weight: 600; color: $by-text-1;
  margin-bottom: 24rpx; display: block;
}

/* ===== Provider ===== */
.provider-row { display: flex; align-items: center; gap: 20rpx; }
.avatar {
  width: 96rpx; height: 96rpx; border-radius: $by-radius-pill;
  background: $by-soft-card;
  border: 2rpx solid $by-border;
}
.provider-info { flex: 1; min-width: 0; }
.name-row { display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.name { font-size: 30rpx; font-weight: 600; color: $by-text-1; }
.elite-badge {
  background: $by-gradient-gold; color: #0B0F1A;
  font-size: 20rpx; font-weight: 600;
  padding: 2rpx 12rpx; border-radius: $by-radius-pill;
}
.bio {
  font-size: 24rpx; color: $by-text-3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.view-more {
  display: block; font-size: 22rpx; color: $by-info;
  margin-top: 8rpx;
}
.chat-btn {
  width: 72rpx; height: 72rpx; border-radius: $by-radius-pill;
  background: color.adjust($by-gold, $alpha: 0.16);
  border: 1rpx solid color.adjust($by-gold, $alpha: 0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 34rpx;
}

/* ===== Reviews ===== */
.reviews-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
.reviews-header .card-title { margin-bottom: 0; }
.rating-summary { display: flex; align-items: center; gap: 8rpx; }
.big-rating {
  font-size: 36rpx; font-weight: 700;
  color: $by-gold;
}
.stars-row { display: flex; gap: 2rpx; }
.rs-star { font-size: 24rpx; color: $by-text-muted; }
.rs-star.on { color: $by-gold; }
.rs-count { font-size: 22rpx; color: $by-text-3; }
.reviews-list { display: flex; flex-direction: column; gap: 24rpx; }
.review-item {
  border-top: 1rpx solid $by-border;
  padding-top: 24rpx;
}
.review-item:first-child { border-top: none; padding-top: 0; }
.rv-top { display: flex; align-items: center; gap: 12rpx; margin-bottom: 14rpx; }
.rv-avatar {
  width: 56rpx; height: 56rpx; border-radius: $by-radius-pill;
  background: $by-soft-card;
  border: 1rpx solid $by-border;
}
.rv-name { font-size: 26rpx; color: $by-text-2; flex: 1; }
.rv-stars { display: flex; gap: 2rpx; }
.rv-star { font-size: 22rpx; color: $by-text-muted; }
.rv-star.on { color: $by-gold; }
.rv-content {
  display: block; font-size: 26rpx; color: $by-text-1;
  line-height: 1.7; margin-bottom: 14rpx;
}
.rv-images { display: flex; gap: 10rpx; flex-wrap: wrap; margin-bottom: 14rpx; }
.rv-img {
  width: 144rpx; height: 144rpx; border-radius: 16rpx;
  background: $by-soft-card;
  border: 1rpx solid $by-border;
}
.rv-time { font-size: 22rpx; color: $by-text-muted; }
.rv-more {
  text-align: center; font-size: 26rpx; color: $by-info;
  padding: 20rpx 0;
}
.rv-loading {
  padding: 32rpx 0; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12rpx;
}
.rv-loading-spinner {
  width: 40rpx; height: 40rpx;
  border: 4rpx solid $by-border-strong;
  border-top-color: $by-gold;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.rv-loading-text { font-size: 24rpx; color: $by-text-3; }
@keyframes spin {
  to { transform: rotate(360deg); }
}
.rv-empty {
  padding: 48rpx 0; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12rpx;
}
.rv-empty-icon { font-size: 48rpx; }
.rv-empty-text { font-size: 26rpx; color: $by-text-3; }

/* ===== Quantity ===== */
.quantity-row { display: flex; align-items: center; gap: 24rpx; }
.qty-btn {
  width: 64rpx; height: 64rpx; border-radius: 20rpx;
  background: $by-soft-card;
  border: 1rpx solid $by-border;
  display: flex; align-items: center; justify-content: center;
  font-size: 36rpx; color: $by-text-1;
  transition: background 0.15s ease;
  &:active { background: $by-surface-2; }
}
.qty-num { font-size: 32rpx; font-weight: 600; min-width: 48rpx; text-align: center; color: $by-text-1; }
.qty-summary { flex: 1; text-align: right; display: flex; align-items: baseline; justify-content: flex-end; gap: 12rpx; }
.qty-total { font-size: 24rpx; color: $by-text-3; }
.qty-amount {
  font-size: 32rpx; font-weight: 700;
  background: $by-gradient-gold;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.remark-wrap { margin-top: 24rpx; }
.remark-input {
  width: 100%; height: 80rpx;
  background: $by-soft-card;
  border-radius: 20rpx;
  padding: 0 24rpx; font-size: 26rpx;
  color: $by-text-1;
  border: 1rpx solid $by-border;
  box-sizing: border-box;
}
.remark-placeholder { color: $by-text-3; }
.remark-toggle {
  margin-top: 24rpx; font-size: 26rpx;
  color: $by-info;
}

.bottom-pad { height: 32rpx; }

/* ===== Bottom Bar ===== */
.bottom-bar {
  position: fixed; left: 0; right: 0; bottom: 0;
  padding: 16rpx $by-page-pad-x;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: $by-card-bg;
  border-top: 1rpx solid $by-border;
  display: flex; align-items: center; justify-content: space-between;
  z-index: 100;
  &.disabled .bottom-btn {
    background: $by-soft-card !important;
    color: $by-text-muted !important;
    box-shadow: none !important;
    pointer-events: none;
  }
}
.bottom-left { display: flex; flex-direction: column; gap: 4rpx; }
.bottom-label { font-size: 22rpx; color: $by-text-3; }
.bottom-amount {
  font-size: 36rpx; font-weight: 700;
  background: $by-gradient-gold;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.bottom-btn {
  padding: 0 64rpx; height: 88rpx;
  background: $by-gradient-gold;
  color: #0B0F1A;
  border-radius: $by-radius-pill;
  display: flex; align-items: center; justify-content: center;
  font-size: 30rpx; font-weight: 700;
  box-shadow: $by-shadow-gold;
  transition: opacity 0.15s ease;
  &:active { opacity: 0.85; }
  &.loading {
    background: $by-soft-card;
    color: $by-text-muted;
    box-shadow: none;
  }
}
</style>
