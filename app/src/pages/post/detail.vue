<template>
  <view class="page-post">
    <!-- 动态不存在 / 加载失败 -->
    <view v-if="loadFailed" class="state-wrap">
      <text class="state-emoji">🫧</text>
      <text class="state-text">动态不存在或已删除</text>
      <view class="btn-ghost" @click="goBack">返回</view>
    </view>

    <view v-else-if="!post.id" class="state-wrap">
      <text class="state-text">加载中…</text>
    </view>

    <template v-else>
      <!-- 动态主体 -->
      <view class="post-card">
        <view class="post-head">
          <image class="post-avatar" :src="post.user.avatar" mode="aspectFill" @tap="goUser(post.user.id)" />
          <view class="post-info">
            <view class="post-top">
              <text class="post-name" @tap="goUser(post.user.id)">{{ post.user.nickname }}</text>
              <view v-if="post.user.isElite" class="tag tag-yellow">精英</view>
              <view v-if="post.user.realPersonStatus === 'passed'" class="tag tag-success">真人</view>
            </view>
            <text class="post-meta">{{ post.city }} · {{ formatTime(post.createdAt) }}</text>
          </view>
        </view>

        <text class="post-text">{{ post.text }}</text>

        <view v-if="post.images.length" class="post-images" :class="'img-col-' + Math.min(3, post.images.length)">
          <image
            v-for="(img, i) in post.images"
            :key="i"
            class="post-image"
            :src="img"
            mode="aspectFill"
            @tap="previewImg(i)"
          />
        </view>

        <view class="post-tags" v-if="post.category">
          <text class="tag tag-blue">#{{ categoryLabel(post.category) }}</text>
        </view>

        <view class="post-actions">
          <view class="action" :class="{ active: post.liked }" @tap="onLike">
            <text class="a-icon">{{ post.liked ? '❤️' : '🤍' }}</text>
            <text class="a-text">{{ post.likeCount }}</text>
          </view>
          <view class="action" @tap="focusInput">
            <text class="a-icon">💬</text>
            <text class="a-text">{{ post.commentCount }}</text>
          </view>
          <view class="action" @tap="onShare">
            <text class="a-icon">↗️</text>
            <text class="a-text">分享</text>
          </view>
          <view v-if="canDeletePost" class="action" @tap="onDeletePost">
            <text class="a-icon">🗑</text>
            <text class="a-text">删除</text>
          </view>
        </view>
      </view>

      <!-- 评论 -->
      <view class="comment-block">
        <view class="cb-title">评论 {{ post.commentCount }}</view>

        <view v-if="!comments.length && !commentsLoading" class="cb-empty">
          还没有评论，来说两句～
        </view>

        <view v-for="c in comments" :key="c.id" class="comment">
          <image class="c-avatar" :src="c.user.avatar" mode="aspectFill" @tap="goUser(c.user.id)" />
          <view class="c-body">
            <view class="c-top">
              <text class="c-name">{{ c.user.nickname }}</text>
              <view v-if="c.user.isElite" class="tag tag-yellow tag-sm">精英</view>
              <text class="c-time">{{ formatTime(c.createdAt) }}</text>
              <text
                v-if="canDeleteComment(c)"
                class="c-del"
                @tap.stop="onDeleteComment(c)"
              >删除</text>
            </view>
            <text class="c-text">{{ c.text }}</text>
          </view>
        </view>

        <view v-if="commentsLoading" class="cb-more">加载中…</view>
        <view v-else-if="commentsHasMore" class="cb-more" @tap="loadComments(false)">查看更多评论 ↓</view>
        <view v-else-if="comments.length" class="cb-more">— 到底了 —</view>
      </view>

      <view class="bottom-space" />
    </template>

    <!-- 底部评论输入条 -->
    <view class="input-bar" v-if="post.id">
      <input
        class="input"
        v-model="draft"
        :focus="inputFocus"
        placeholder="说点什么…"
        placeholder-class="input-ph"
        confirm-type="send"
        :maxlength="500"
        @confirm="submitComment"
        @blur="inputFocus = false"
      />
      <view class="send" :class="{ disabled: !draft.trim() || sending }" @tap="submitComment">
        {{ sending ? '发送中' : '发送' }}
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, nextTick, computed } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { postApi } from '@/api/index.js'
import { useUserStore } from '@/store/user.js'
import {
  toList, toStr, toNum, toObj, toBool, getPath, unwrap, unwrapPage,
  guard, truncate, formatTime as ft, avatarUrl, coverUrl, pickCity,
  requireLogin, safeMap
} from '@/utils/fallback'

const userStore = useUserStore()
const myUserId = computed(() => toStr(userStore.userId, ''))

const PAGE_SIZE = 20

const postId = ref('')
const loadFailed = ref(false)

const post = reactive({
  id: '',
  text: '',
  images: [],
  city: '',
  category: '',
  createdAt: null,
  liked: false,
  likeCount: 0,
  commentCount: 0,
  user: { id: '', nickname: '匿名用户', avatar: '', isElite: false, realPersonStatus: '' }
})

const comments = ref([])
const commentsPage = ref(1)
const commentsHasMore = ref(false)
const commentsLoading = ref(false)

const draft = ref('')
const sending = ref(false)
const liking = ref(false)
const inputFocus = ref(false)

const formatTime = (t) => toStr(ft(t), '')
const categoryLabel = (c) => {
  const map = { dynamic: '日常', group: '组局', show: '新人秀', seek: '寻人' }
  return toStr(map[toStr(c)], toStr(c))
}

const normalizeComment = (c) => {
  const o = toObj(c, {})
  const id = toStr(getPath(o, 'id'), '')
  if (!id) return undefined
  const u = toObj(getPath(o, 'user'), {})
  return {
    id,
    text: toStr(getPath(o, 'text'), ''),
    createdAt: getPath(o, 'createdAt'),
    userId: toStr(getPath(o, 'userId'), ''),
    user: {
      id: toStr(getPath(u, 'id'), ''),
      nickname: toStr(getPath(u, 'nickname'), '匿名用户'),
      avatar: avatarUrl(getPath(u, 'avatar')),
      isElite: toBool(getPath(u, 'isElite'), false)
    }
  }
}

const loadDetail = async () => {
  const resp = await guard(postApi.detail(postId.value), null)
  const data = toObj(unwrap(resp, null), {})
  if (!resp || !getPath(data, 'id')) { loadFailed.value = true; return }
  const u = toObj(getPath(data, 'user'), {})
  Object.assign(post, {
    id: toStr(getPath(data, 'id'), ''),
    text: toStr(getPath(data, 'text'), ''),
    images: safeMap(toList(getPath(data, 'images')), (img) => coverUrl(img)),
    city: pickCity(getPath(data, 'city'), '同城'),
    category: toStr(getPath(data, 'category'), ''),
    createdAt: getPath(data, 'createdAt'),
    liked: toBool(getPath(data, 'liked'), false),
    likeCount: toNum(getPath(data, 'likeCount'), 0),
    // commentCount 不从这里取：loadDetail 与 loadComments 并发，详情返回的存量计数
    // 可能后到并覆盖评论接口的真实 total（存量数据里有伪造的 commentCount）
    user: {
      id: toStr(getPath(u, 'id'), ''),
      nickname: toStr(getPath(u, 'nickname'), '匿名用户'),
      avatar: avatarUrl(getPath(u, 'avatar')),
      isElite: toBool(getPath(u, 'isElite'), false),
      realPersonStatus: toStr(getPath(u, 'realPersonStatus'), '')
    }
  })
}

const loadComments = async (reset = false) => {
  if (commentsLoading.value) return
  commentsLoading.value = true
  try {
    if (reset) { commentsPage.value = 1; comments.value = []; commentsHasMore.value = false }
    const resp = await guard(
      postApi.commentList(postId.value, { page: toNum(commentsPage.value, 1), pageSize: PAGE_SIZE })
        .then((r) => unwrapPage(r, { list: [], total: 0 })),
      null
    )
    if (!resp) throw new Error('empty response')
    const rows = safeMap(toList(getPath(resp, 'list')), normalizeComment)
    const total = toNum(getPath(resp, 'total'), 0)
    comments.value = reset ? rows : comments.value.concat(rows)
    // 以评论接口的真实 total 覆盖 post.commentCount：存量数据里有伪造的计数
    post.commentCount = total
    commentsHasMore.value = rows.length > 0 && comments.value.length < total
    commentsPage.value = toNum(commentsPage.value, 1) + 1
  } catch (e) {
    commentsHasMore.value = false
  } finally {
    commentsLoading.value = false
  }
}

/* 点赞：先本地翻转，接口失败再回滚，避免用户等一个来回才看到反馈 */
const onLike = async () => {
  if (liking.value) return
  if (!requireLogin()) return
  liking.value = true
  const prevLiked = post.liked
  const prevCount = toNum(post.likeCount, 0)
  post.liked = !prevLiked
  post.likeCount = Math.max(0, prevCount + (post.liked ? 1 : -1))
  const resp = await guard(postApi.like(postId.value), null)
  const data = toObj(unwrap(resp, null), {})
  if (!resp || getPath(data, 'liked') === undefined) {
    post.liked = prevLiked
    post.likeCount = prevCount
    uni.showToast({ title: '操作失败，请重试', icon: 'none' })
  } else {
    post.liked = toBool(getPath(data, 'liked'), post.liked)
    post.likeCount = toNum(getPath(data, 'likeCount'), post.likeCount)
  }
  liking.value = false
}

const submitComment = async () => {
  const text = toStr(draft.value, '').trim()
  if (!text) return
  if (sending.value) return
  if (!requireLogin()) return
  sending.value = true
  try {
    const resp = await postApi.comment(postId.value, { text })
    const data = toObj(unwrap(resp, null), {})
    const row = normalizeComment(data)
    if (!row) throw new Error('bad response')
    // 后端按 id DESC 排序，新评论排在最前
    comments.value = [row].concat(comments.value)
    post.commentCount = toNum(post.commentCount, 0) + 1
    draft.value = ''
    uni.showToast({ title: '评论成功', icon: 'none' })
  } catch (e) {
    const msg = (e && e.data && e.data.message) || (e && e.message) || '评论失败'
    uni.showToast({ title: msg.length > 14 ? msg.slice(0, 14) + '…' : msg, icon: 'none' })
  } finally {
    sending.value = false
  }
}

const previewImg = (i) => {
  const imgs = toList(post.images)
  if (!imgs.length) return
  uni.previewImage({ urls: imgs, current: toStr(imgs[toNum(i, 0)], imgs[0]) })
}
const goUser = (id) => {
  const uid = toStr(id, '')
  if (!uid) return
  uni.navigateTo({ url: `/pages/user-profile/user-profile?id=${uid}` })
}
const goBack = () => {
  const pages = getCurrentPages()
  if (pages && pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/discover/discover' })
}
const focusInput = () => {
  inputFocus.value = false
  nextTick(() => { inputFocus.value = true })
}
const onShare = () => {
  if (!requireLogin()) return
  uni.setClipboardData({
    data: toStr(`白夜 · ${truncate(post.text, 80)}`),
    success: () => uni.showToast({ title: '链接已复制', icon: 'none' })
  })
}

// A13/A14: 删除评论 — 评论作者或帖主可删（Discourse 语义，服务端已校验）
const canDeleteComment = (c) => {
  if (!myUserId.value) return false
  // 评论作者或帖主
  return String(c.userId) === String(myUserId.value) || String(post.user.id) === String(myUserId.value)
}
const onDeleteComment = (c) => {
  uni.showModal({
    title: '删除评论',
    content: '确认删除这条评论？',
    confirmColor: '#D4AF37',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await postApi.removeComment(postId.value, c.id)
        comments.value = comments.value.filter(x => x.id !== c.id)
        post.commentCount = Math.max(0, toNum(post.commentCount, 0) - 1)
        uni.showToast({ title: '已删除', icon: 'none' })
      } catch (e) {
        const msg = (e && e.data && e.data.message) || (e && e.message) || '删除失败'
        uni.showToast({ title: msg, icon: 'none' })
      }
    }
  })
}

// A14: 删除自己的动态
const canDeletePost = computed(() => {
  if (!myUserId.value || !post.user.id) return false
  return String(post.user.id) === String(myUserId.value)
})
const onDeletePost = () => {
  uni.showModal({
    title: '删除动态',
    content: '确认删除这条动态？删除后不可恢复。',
    confirmColor: '#ef4444',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await postApi.remove(postId.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 800)
      } catch (e) {
        const msg = (e && e.data && e.data.message) || (e && e.message) || '删除失败'
        uni.showToast({ title: msg, icon: 'none' })
      }
    }
  })
}

onLoad((opt) => {
  postId.value = toStr(getPath(toObj(opt, {}), 'id'), '')
  if (!postId.value) { loadFailed.value = true; return }
  loadDetail()
  loadComments(true)
})

onReachBottom(() => {
  if (post.id && commentsHasMore.value && !commentsLoading.value) loadComments(false)
})
</script>

<style lang="scss" scoped>
.page-post { min-height: 100vh; background: $by-bg; color: $by-text-1; padding: 24rpx; }

.state-wrap {
  min-height: 60vh; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 20rpx;
}
.state-emoji { font-size: 88rpx; }
.state-text { font-size: 28rpx; color: $by-text-3; }
.btn-ghost {
  margin-top: 16rpx; padding: 18rpx 44rpx; border-radius: 999rpx; font-size: 26rpx;
  border: 2rpx solid $by-border; color: $by-text-2;
}

.post-card {
  display: flex; flex-direction: column; gap: 16rpx;
  background: $by-surface; border-radius: 24rpx; padding: 24rpx; margin-bottom: 20rpx;
}
.post-head { display: flex; align-items: center; gap: 16rpx; }
.post-avatar { width: 84rpx; height: 84rpx; border-radius: 9999rpx; background: $by-surface-2; }
.post-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.post-top { display: flex; align-items: center; gap: 8rpx; flex-wrap: wrap; }
.post-name { font-size: 28rpx; font-weight: 700; color: $by-text-1; }
.post-meta { font-size: 22rpx; color: $by-text-3; }
.post-text { font-size: 30rpx; color: $by-text-1; line-height: 1.7; white-space: pre-wrap; }
.post-images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; }
.post-images.img-col-1 { grid-template-columns: 1fr; }
.post-images.img-col-2 { grid-template-columns: repeat(2, 1fr); }
.post-image { width: 100%; aspect-ratio: 1; border-radius: $by-radius-md; background: $by-surface-2; }
.post-tags { display: flex; gap: 10rpx; }
.tag-sm { padding: 2rpx 12rpx; font-size: 20rpx; }
.post-actions { display: flex; justify-content: space-around; padding-top: 12rpx; border-top: 1rpx solid $by-border; }
.action { display: flex; align-items: center; gap: 8rpx; padding: 12rpx 20rpx; border-radius: $by-radius-md; }
.action:active { background: rgba(255, 255, 255, .05); }
.a-icon { font-size: 30rpx; }
.a-text { font-size: 24rpx; color: $by-text-2; }

.comment-block {
  background: $by-surface; border-radius: 24rpx; padding: 24rpx;
}
.cb-title { font-size: 28rpx; font-weight: 700; color: $by-gold; margin-bottom: 16rpx; }
.cb-empty { font-size: 26rpx; color: $by-text-3; padding: 24rpx 0; text-align: center; }
.cb-more { font-size: 24rpx; color: $by-text-3; text-align: center; padding: 24rpx 0 4rpx; }
.comment { display: flex; gap: 16rpx; padding: 20rpx 0; border-bottom: 1rpx solid $by-border; }
.comment:last-of-type { border-bottom: none; }
.c-avatar { width: 64rpx; height: 64rpx; border-radius: 9999rpx; background: $by-surface-2; flex: 0 0 auto; }
.c-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.c-top { display: flex; align-items: center; gap: 10rpx; flex-wrap: wrap; }
.c-name { font-size: 24rpx; color: $by-text-2; font-weight: 600; }
.c-time { font-size: 20rpx; color: $by-text-3; }
.c-del { font-size: 20rpx; color: $by-danger; margin-left: auto; padding: 4rpx 12rpx; border-radius: 8rpx; }
.c-del:active { opacity: 0.6; }
.c-text { font-size: 28rpx; color: $by-text-1; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }

.bottom-space { height: 160rpx; }

.input-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
  box-sizing: border-box;
  display: flex; align-items: center; gap: 16rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: $by-bg-soft; border-top: 1rpx solid $by-border;
}
.input {
  flex: 1; min-width: 0; height: 72rpx; box-sizing: border-box;
  padding: 0 24rpx; border-radius: 999rpx;
  background: $by-surface-2; color: $by-text-1; font-size: 28rpx;
}
.input-ph { color: $by-text-3; }
.send {
  flex: 0 0 auto; padding: 0 32rpx; height: 72rpx; line-height: 72rpx;
  border-radius: 999rpx; font-size: 26rpx; font-weight: 700;
  background: $by-gradient-gold; color: $by-bg;
  &.disabled { opacity: .45; }
}
</style>
