<template>
  <view class="page">
    <!-- 顶部导航 -->
    <view class="nav-bar">
      <view class="nav-back" @tap="goBack">‹</view>
      <text class="nav-title">我的动态</text>
      <view class="nav-publish" @tap="goPublish">＋ 发布</view>
    </view>

    <!-- 下拉刷新容器 -->
    <scroll-view
      scroll-y
      class="scroll"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
    >
      <view v-if="loading && list.length === 0" class="state-wrap"><text class="state-text">加载中…</text></view>

      <view
        v-for="p in list"
        :key="p.id"
        class="post-card card"
        @tap="goPostDetail(p)"
      >
        <view class="post-head">
          <image class="post-avatar" :src="p.user && p.user.avatar" mode="aspectFill" />
          <view class="post-info">
            <view class="post-top">
              <text class="post-name">{{ (p.user && p.user.nickname) || '我' }}</text>
              <view v-if="p.user && p.user.isElite" class="tag tag-yellow">精英</view>
              <view v-if="p.user && p.user.realPersonStatus === 'passed'" class="tag tag-success">真人</view>
            </view>
            <text class="post-meta">{{ p.city || '同城' }} · {{ formatTime(p.createdAt) }}</text>
          </view>
        </view>
        <text class="post-text">{{ p.text }}</text>
        <view v-if="p.images && p.images.length" class="post-images" :class="'img-col-' + Math.min(3, p.images.length)">
          <image
            v-for="(img, i) in p.images.slice(0, 9)"
            :key="i"
            class="post-image"
            :src="img"
            mode="aspectFill"
            @tap.stop="previewImg(p.images, i)"
          />
        </view>
        <view class="post-tags" v-if="p.category">
          <text class="tag tag-blue">#{{ categoryLabel(p.category) }}</text>
        </view>
        <view class="post-actions">
          <view class="action" :class="{ active: p.liked }" @tap.stop="onLike(p)">
            <text class="a-icon">{{ p.liked ? '❤️' : '🤍' }}</text>
            <text class="a-text">{{ p.likeCount || 0 }}</text>
          </view>
          <view class="action" @tap.stop="goPostDetail(p)">
            <text class="a-icon">💬</text>
            <text class="a-text">{{ p.commentCount || 0 }}</text>
          </view>
          <view class="action action-del" @tap.stop="onDelete(p)">
            <text class="a-icon">🗑️</text>
            <text class="a-text">删除</text>
          </view>
        </view>
      </view>

      <view class="load-more">
        <text v-if="loading">加载中…</text>
        <text v-else-if="hasMore">加载更多 ↓</text>
        <text v-else-if="list.length > 0">— 到底了 —</text>
      </view>

      <view v-if="!loading && list.length === 0" class="empty">
        <text class="empty-emoji">🕊️</text>
        <text class="empty-text">还没有动态</text>
        <view class="btn-primary" @tap="goPublish">去发布第一条动态</view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { postApi } from '../../api'
import { useUserStore } from '../../store/user'
import {
  toList, toStr, toNum, toObj, toBool, getPath, unwrap, unwrapPage,
  guard, truncate, formatTime as ft, avatarUrl, coverUrl, requireLogin, safeMap
} from '@/utils/fallback'

const userStore = useUserStore()
const list = ref([])
const page = ref(1)
const pageSize = 10
const hasMore = ref(true)
const loading = ref(false)
const refreshing = ref(false)

const fmtTime = (t) => toStr(ft(t), '')
const formatTime = fmtTime

const categoryLabel = (c) => {
  const map = { dynamic: '日常', group: '组局', show: '新人秀', seek: '寻人' }
  return toStr(map[toStr(c)], toStr(c))
}

const loadList = async (reset = false) => {
  if (loading.value) return
  if (!requireLogin()) return
  loading.value = true
  try {
    if (reset) { page.value = 1; list.value = []; hasMore.value = true }
    const params = { page: page.value, pageSize, userId: userStore.userId }
    const resp = await guard(postApi.list(params), null)
    const pageData = unwrapPage(resp, { list: [], total: 0 })
    const rawList = toList(getPath(pageData, 'list'))
    const total = toNum(getPath(pageData, 'total'), 0)
    const rows = safeMap(rawList, (p) => {
      const userRaw = toObj(getPath(p, 'user'), {})
      return {
        id: getPath(p, 'id', ''),
        text: truncate(getPath(p, 'text'), 280),
        images: safeMap(toList(getPath(p, 'images')), (img) => coverUrl(img)),
        city: getPath(p, 'city'),
        createdAt: getPath(p, 'createdAt'),
        category: toStr(getPath(p, 'category'), ''),
        liked: toBool(getPath(p, 'liked'), false),
        user: {
          avatar: avatarUrl(getPath(userRaw, 'avatar')),
          nickname: toStr(getPath(userRaw, 'nickname'), '我'),
          isElite: toBool(getPath(userRaw, 'isElite'), false),
          realPersonStatus: toStr(getPath(userRaw, 'realPersonStatus'), '')
        },
        likeCount: toNum(getPath(p, 'likeCount'), 0),
        commentCount: toNum(getPath(p, 'commentCount'), 0)
      }
    })
    list.value = reset ? rows : list.value.concat(rows)
    hasMore.value = rows.length >= pageSize && total > list.value.length
    page.value += 1
  } catch (e) {
    // 静默失败
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const onRefresh = () => {
  refreshing.value = true
  loadList(true)
}

const loadMore = () => {
  if (hasMore.value && !loading.value) loadList(false)
}

const goPublish = () => {
  if (!requireLogin()) return
  uni.navigateTo({ url: '/pages/post/publish' })
}

const goPostDetail = (p) => uni.navigateTo({ url: `/pages/post/detail?id=${toStr(getPath(p, 'id'), '')}` })

const onLike = async (p) => {
  if (!requireLogin()) return
  const id = toStr(getPath(p, 'id'), '')
  if (!id) return
  const resp = await guard(postApi.like(id), null)
  const data = toObj(unwrap(resp, null), {})
  p.liked = toBool(getPath(data, 'liked'), false)
  p.likeCount = toNum(getPath(data, 'likeCount'), getPath(p, 'likeCount', 0))
}

const previewImg = (images, i) => {
  const imgs = safeMap(toList(images), (img) => coverUrl(img))
  if (!imgs.length) return
  uni.previewImage({ urls: imgs, current: toStr(imgs[toNum(i, 0)], imgs[0]) })
}

const onDelete = (p) => {
  uni.showModal({
    title: '删除动态',
    content: '确定删除这条动态吗？',
    success: async (res) => {
      if (!res.confirm) return
      const id = toStr(getPath(p, 'id'), '')
      await guard(postApi.remove(id), null)
      uni.showToast({ title: '已删除', icon: 'success' })
      loadList(true)
    }
  })
}

const goBack = () => uni.navigateBack({ delta: 1 })

let firstShow = true
onShow(() => {
  if (firstShow) { firstShow = false; return }
  loadList(true)
})

onMounted(() => loadList(true))
</script>

<style lang="scss" scoped>
.page { height: 100vh; background: $by-bg; display: flex; flex-direction: column; overflow: hidden; }

.nav-bar {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 20rpx 32rpx; background: $by-card-bg; border-bottom: 1rpx solid $by-border;
  position: relative; z-index: 20;
}
.nav-back { font-size: 48rpx; color: $by-text-1; width: 60rpx; }
.nav-title { font-size: 32rpx; font-weight: 700; color: $by-text-1; }
.nav-publish { font-size: 26rpx; color: $by-gold; font-weight: 600; padding: 8rpx 16rpx; }

.scroll { flex: 1; min-height: 0; }

.state-wrap { padding: 80rpx 0; text-align: center; }
.state-text { font-size: 28rpx; color: $by-text-3; }

.post-card { display: flex; flex-direction: column; gap: 16rpx; padding: 24rpx; margin: 20rpx 32rpx; background: $by-card-bg; border-radius: 24rpx; border: 1rpx solid $by-border; }
.post-head { display: flex; align-items: center; gap: 16rpx; }
.post-avatar { width: 84rpx; height: 84rpx; border-radius: 9999rpx; background: $by-surface-2; }
.post-info { flex: 1; }
.post-top { display: flex; align-items: center; gap: 12rpx; }
.post-name { font-size: 28rpx; font-weight: 600; color: $by-text-1; }
.post-meta { font-size: 22rpx; color: $by-text-3; margin-top: 4rpx; }
.tag { font-size: 20rpx; padding: 2rpx 12rpx; border-radius: 8rpx; }
.tag-yellow { background: rgba(212,175,55,0.15); color: $by-gold; }
.tag-success { background: rgba(82,196,26,0.15); color: #52c41a; }
.tag-blue { background: rgba(24,144,255,0.15); color: #1890ff; }
.post-text { font-size: 28rpx; color: $by-text-1; line-height: 1.6; white-space: pre-wrap; }
.post-images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; }
.post-images.img-col-1 { grid-template-columns: 1fr; }
.post-images.img-col-2 { grid-template-columns: repeat(2, 1fr); }
.post-image { width: 100%; aspect-ratio: 1; border-radius: 12rpx; background: $by-surface-2; }
.post-tags { display: flex; gap: 12rpx; }
.post-actions { display: flex; justify-content: space-around; padding-top: 12rpx; border-top: 1rpx solid $by-border; }
.action { display: flex; align-items: center; gap: 8rpx; padding: 12rpx 20rpx; border-radius: 12rpx; color: $by-text-2; font-size: 24rpx; }
.action.active { color: #ff4d4f; }
.action-del { color: $by-text-3; }
.a-icon { font-size: 28rpx; }

.load-more { padding: 32rpx; text-align: center; font-size: 26rpx; color: $by-text-3; }

.empty { display: flex; flex-direction: column; align-items: center; padding: 120rpx 0; gap: 20rpx; }
.empty-emoji { font-size: 96rpx; }
.empty-text { font-size: 30rpx; color: $by-text-2; }
.btn-primary {
  padding: 16rpx 48rpx; border-radius: 9999rpx;
  background: $by-gradient-gold; color: #0B0F1A; font-weight: 600; font-size: 28rpx;
}
</style>
