<template>
  <view class="page-search">
    <!-- 顶部搜索条 -->
    <view class="search-header">
      <view class="back-btn" @tap="onBack"><text class="arrow">‹</text></view>
      <view class="search-bar">
        <text class="s-icon">🔎</text>
        <input
          v-model="keyword"
          class="s-input"
          type="text"
          placeholder="搜用户 / 动态 / 组局"
          confirm-type="search"
          :focus="autoFocus"
          @confirm="onSubmit"
          @input="onInput"
        />
        <text v-if="keyword" class="s-clear" @tap="clearKeyword">✕</text>
      </view>
      <view class="submit-btn" @tap="onSubmit">搜索</view>
    </view>

    <!-- 结果 Tab 切换（仅在有提交/历史时显示） -->
    <view v-if="submitted" class="tabs-bar">
      <scroll-view scroll-x class="tabs-scroll hide-scrollbar">
        <view class="tabs">
          <view
            v-for="t in tabs"
            :key="t.key"
            class="tab-item"
            :class="{ active: activeTab === t.key }"
            @tap="activeTab = t.key"
          >
            <text class="tab-label">{{ t.label }}</text>
            <view v-if="activeTab === t.key" class="tab-bar" />
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 空态：热词 + 历史 -->
    <view v-if="!submitted" class="idle">
      <!-- 历史 -->
      <view v-if="history.length" class="card-wrap">
        <view class="card">
          <view class="head-row">
            <text class="head-title">🕒 最近搜索</text>
            <text class="head-clear" @tap="clearHistory">清空</text>
          </view>
          <view class="chips">
            <text
              v-for="(w, i) in history"
              :key="i"
              class="chip"
              @tap="pickKeyword(w)"
            >{{ w }}</text>
          </view>
        </view>
      </view>
      <!-- 热词 -->
      <view class="card-wrap">
        <view class="card">
          <view class="head-row">
            <text class="head-title">🔥 今日热榜</text>
          </view>
          <view class="hot-list">
            <view
              v-for="(h, i) in hotList"
              :key="h.keyword"
              class="hot-item"
              @tap="pickKeyword(h.keyword)"
            >
              <text class="hot-rank" :class="'r-' + Math.min(3, i + 1)">{{ i + 1 }}</text>
              <text class="hot-text">{{ h.keyword }}</text>
              <text v-if="h.hot" class="hot-num">{{ h.hot }}</text>
              <text v-if="h.tag" class="hot-tag" :class="h.tag">{{ h.tag === 'new' ? 'NEW' : 'HOT' }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 搜索结果：用户 -->
    <view v-if="submitted && activeTab === 'user'" class="result">
      <view v-if="userLoading && userList.length === 0" class="state-wrap"><text class="state-text">搜索中…</text></view>
      <view v-else-if="userList.length === 0" class="empty">
        <text class="empty-emoji">🌠</text>
        <text class="empty-text">没有找到相关用户</text>
      </view>
      <view
        v-for="u in userList"
        :key="u.id"
        class="user-row card"
        @tap="goUser(u)"
      >
        <image class="u-av" :src="u.avatar" mode="aspectFill" />
        <view class="u-body">
          <view class="u-top">
            <text class="u-name">{{ u.nickname }}</text>
            <view v-if="u.isElite" class="tag tag-yellow">精英</view>
            <view v-if="u.realPersonStatus === 'passed'" class="tag tag-success">真人</view>
          </view>
          <text class="u-bio">{{ u.bio || '这个人很神秘，什么也没留下～' }}</text>
          <view class="u-tags">
            <text v-for="(t, i) in (u.tags || []).slice(0, 3)" :key="i" class="tag t-tag" :class="'tc-' + (i % 4)">{{ t }}</text>
          </view>
        </view>
        <view class="u-btn" @tap.stop="onChat(u)">聊聊</view>
      </view>
    </view>

    <!-- 搜索结果：动态 -->
    <view v-if="submitted && activeTab === 'post'" class="result">
      <view v-if="postLoading && postList.length === 0" class="state-wrap"><text class="state-text">搜索中…</text></view>
      <view v-else-if="postList.length === 0" class="empty">
        <text class="empty-emoji">🕳️</text>
        <text class="empty-text">没有找到相关动态</text>
      </view>
      <view v-for="p in postList" :key="p.id" class="post-row card">
        <view class="post-head">
          <image class="p-av" :src="p.user?.avatar" mode="aspectFill" />
          <view class="p-info">
            <view class="p-top">
              <text class="p-name">{{ p.user?.nickname || '匿名用户' }}</text>
              <view v-if="p.user?.isElite" class="tag tag-yellow">精英</view>
            </view>
            <text class="p-meta">{{ p.city || '同城' }} · {{ formatTime(p.createdAt) }}</text>
          </view>
        </view>
        <text class="p-text" @tap="goPost(p)">{{ p.text }}</text>
        <view v-if="p.images && p.images.length" class="p-imgs" :class="'img-col-' + Math.min(3, p.images.length)">
          <image
            v-for="(img, i) in p.images.slice(0, 9)"
            :key="i"
            class="p-img"
            :src="img"
            mode="aspectFill"
            @tap="preview(p.images, i)"
          />
        </view>
      </view>
    </view>

    <!-- 搜索结果：组局 -->
    <view v-if="submitted && activeTab === 'group'" class="result">
      <view v-if="groupLoading && groupList.length === 0" class="state-wrap"><text class="state-text">搜索中…</text></view>
      <view v-else-if="groupList.length === 0" class="empty">
        <text class="empty-emoji">🎭</text>
        <text class="empty-text">没有找到相关组局</text>
      </view>
      <view v-for="g in groupList" :key="g.id" class="group-row card" @tap="goGroup(g)">
        <view v-if="g.cover" class="g-cover">
          <image class="g-cover-img" :src="g.cover" mode="aspectFill" />
        </view>
        <view class="g-body">
          <view class="g-status-row">
            <text class="g-status" :class="'status-' + g.status">{{ groupStatusText(g.status) }}</text>
          </view>
          <text class="g-title">{{ g.title }}</text>
          <view class="g-meta-row">
            <view class="meta-item">
              <text class="meta-icon">👥</text>
              <text class="meta-text">{{ g.joinCount || 0 }}/{{ g.expectMax || 8 }} 人</text>
            </view>
            <view class="meta-item">
              <text class="meta-icon">📍</text>
              <text class="meta-text">{{ g.city || '同城' }}</text>
            </view>
            <view class="meta-item">
              <text class="meta-icon">📅</text>
              <text class="meta-text">{{ g.activityAt ? formatDate(g.activityAt) : '待定' }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="bottom-safe" />
  </view>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { postApi, groupApi, userApi } from '../../api'
import {
  toList, toStr, toNum, toObj, toBool, unwrap, unwrapPage, guard,
  getPath, avatarUrl, coverUrl, pickTags, formatTime, truncate,
  debounce, requireLogin, requireElite, safeMap, pickCity
} from '@/utils/fallback'

const HISTORY_KEY = 'baiye_search_history'

const autoFocus = ref(true)
const keyword = ref('')
const submitted = ref(false)
const activeTab = ref('user')

const tabs = [
  { key: 'user', label: '搜用户' },
  { key: 'post', label: '搜动态' },
  { key: 'group', label: '搜组局' }
]

const hotList = [
  { keyword: toStr('王者荣耀'), hot: toStr('12.4w'), tag: toStr('hot') },
  { keyword: toStr('陪你聊天'), hot: toStr('8.1w'), tag: toStr('hot') },
  { keyword: toStr('密室逃脱'), hot: toStr('3.6w'), tag: toStr('new') },
  { keyword: toStr('剧本杀拼车'), hot: toStr('2.9w'), tag: toStr('') },
  { keyword: toStr('和平精英'), hot: toStr('2.5w'), tag: toStr('') },
  { keyword: toStr('哄睡电台'), hot: toStr('2.1w'), tag: toStr('new') },
  { keyword: toStr('夜骑同城'), hot: toStr('1.6w'), tag: toStr('') },
  { keyword: toStr('线下观影'), hot: toStr('1.1w'), tag: toStr('') }
]

const history = ref([])
const loadHistory = () => {
  const raw = toStr(uni.getStorageSync(HISTORY_KEY), '[]')
  try { history.value = safeMap(JSON.parse(raw), (w) => toStr(w, '')).slice(0, 12) } catch (_) { history.value = [] }
}
const pushHistory = (w) => {
  const kw = toStr(w, '').trim()
  if (!kw) return
  const next = [kw, ...safeMap(history.value.filter(x => toStr(x, '') !== kw), (x) => toStr(x, ''))].slice(0, 12)
  history.value = next
  try { uni.setStorageSync(HISTORY_KEY, JSON.stringify(next)) } catch (_) { /* ignore */ }
}
const clearHistory = () => {
  try { uni.removeStorageSync(HISTORY_KEY) } catch (_) { /* ignore */ }
  history.value = []
  uni.showToast({ title: toStr('历史已清空'), icon: 'none' })
}
const pickKeyword = (w) => { keyword.value = toStr(w, ''); onSubmit() }
const clearKeyword = () => { keyword.value = ''; submitted.value = false }
const onBack = () => uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/home/home' }) })

/* ---- 搜索状态 ---- */
const userPage = ref(1), userList = ref([]), userLoading = ref(false)
const postPage = ref(1), postList = ref([]), postLoading = ref(false)
const groupPage = ref(1), groupList = ref([]), groupLoading = ref(false)

const loadUsers = async (reset = false) => {
  if (userLoading.value) return
  userLoading.value = true
  if (reset) { userPage.value = 1; userList.value = [] }
  const kw = toStr(keyword.value, '').trim()
  const pageResp = await guard(
    userApi.discover({ page: toNum(userPage.value, 1), pageSize: 15, keyword: kw }).then((r) => unwrapPage(r, { list: [], total: 0 })),
    { list: [], total: 0 }
  )
  const { list: rawList } = toObj(pageResp, { list: [], total: 0 })
  const rows = safeMap(toList(rawList), (u) => ({
    id: getPath(u, 'id', ''),
    nickname: toStr(getPath(u, 'nickname'), '匿名'),
    avatar: avatarUrl(getPath(u, 'avatar')),
    bio: toStr(getPath(u, 'bio'), '这个人很神秘，什么也没留下～'),
    tags: pickTags(getPath(u, 'tags'), 3),
    isElite: toBool(getPath(u, 'isElite'), false),
    realPersonStatus: toStr(getPath(u, 'realPersonStatus'), '')
  }))
  userList.value = reset ? rows : userList.value.concat(rows)
  userPage.value = toNum(userPage.value, 1) + 1
  userLoading.value = false
}

const loadPosts = async (reset = false) => {
  if (postLoading.value) return
  postLoading.value = true
  if (reset) { postPage.value = 1; postList.value = [] }
  const kw = toStr(keyword.value, '').trim()
  const pageResp = await guard(
    postApi.list({ page: toNum(postPage.value, 1), pageSize: 10, keyword: kw }).then((r) => unwrapPage(r, { list: [], total: 0 })),
    { list: [], total: 0 }
  )
  const { list: rawList } = toObj(pageResp, { list: [], total: 0 })
  const rows = safeMap(toList(rawList), (p) => {
    const userRaw = toObj(getPath(p, 'user'), {})
    return {
      id: getPath(p, 'id', ''),
      text: truncate(getPath(p, 'text'), 280),
      images: safeMap(toList(getPath(p, 'images')), (img) => coverUrl(img)),
      city: pickCity(getPath(p, 'city'), '同城'),
      createdAt: getPath(p, 'createdAt'),
      user: {
        avatar: avatarUrl(getPath(userRaw, 'avatar')),
        nickname: toStr(getPath(userRaw, 'nickname'), '匿名用户'),
        isElite: toBool(getPath(userRaw, 'isElite'), false)
      },
      likeCount: toNum(getPath(p, 'likeCount'), 0),
      commentCount: toNum(getPath(p, 'commentCount'), 0)
    }
  })
  postList.value = reset ? rows : postList.value.concat(rows)
  postPage.value = toNum(postPage.value, 1) + 1
  postLoading.value = false
}

const loadGroups = async (reset = false) => {
  if (groupLoading.value) return
  groupLoading.value = true
  if (reset) { groupPage.value = 1; groupList.value = [] }
  const kw = toStr(keyword.value, '').trim()
  const pageResp = await guard(
    groupApi.list({ page: toNum(groupPage.value, 1), pageSize: 10, keyword: kw }).then((r) => unwrapPage(r, { list: [], total: 0 })),
    { list: [], total: 0 }
  )
  const { list: rawList } = toObj(pageResp, { list: [], total: 0 })
  const rows = safeMap(toList(rawList), (g) => ({
    id: getPath(g, 'id', ''),
    title: toStr(getPath(g, 'title'), ''),
    cover: coverUrl(getPath(g, 'cover')),
    status: toStr(getPath(g, 'status'), 'open'),
    joinCount: toNum(getPath(g, 'joinCount'), 0),
    expectMax: toNum(getPath(g, 'expectMax'), 8),
    city: pickCity(getPath(g, 'city'), '同城'),
    activityAt: getPath(g, 'activityAt'),
    description: toStr(getPath(g, 'description'), ''),
    tags: pickTags(getPath(g, 'tags'), 4),
    hot: toBool(getPath(g, 'hot'), false),
    user: toObj(getPath(g, 'user'), {})
  }))
  groupList.value = reset ? rows : groupList.value.concat(rows)
  groupPage.value = toNum(groupPage.value, 1) + 1
  groupLoading.value = false
}

const runSearchAll = async (kw) => {
  keyword.value = toStr(kw, '').trim()
  const w = toStr(keyword.value, '').trim()
  if (!w) {
    submitted.value = false
    return
  }
  pushHistory(w)
  submitted.value = true
  await Promise.all([
    loadUsers(true),
    loadPosts(true),
    loadGroups(true)
  ])
}

const onSubmit = () => {
  const w = toStr(keyword.value, '').trim()
  if (!w) { uni.showToast({ title: toStr('请输入关键词'), icon: 'none' }); return }
  runSearchAll(w)
}

/* 防抖实时搜索，同步 4 个 tab */
const onInput = debounce(() => {
  const w = toStr(keyword.value, '').trim()
  if (!w) {
    submitted.value = false
    userList.value = []; postList.value = []; groupList.value = []
    return
  }
  runSearchAll(w)
}, 300)

/* helpers */
const formatDate = (t) => {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  return `${toNum(d.getMonth() + 1)}月${toNum(d.getDate())}日`
}
const groupStatusText = (s) => {
  const map = { open: '招募中', full: '人已满', closed: '已结束', canceled: '已取消' }
  return toStr(map[toStr(s)], '招募中')
}

/* actions */
const goUser = (u) => uni.navigateTo({ url: `/pages/user-profile/user-profile?id=${toStr(getPath(u, 'id'), '')}` })
const goPost = (p) => uni.navigateTo({ url: `/pages/group/detail?id=${toStr(getPath(p, 'id'), '')}&mode=post` })
const goGroup = (g) => uni.navigateTo({ url: `/pages/group/detail?id=${toStr(getPath(g, 'id'), '')}` })
const preview = (images, i) => {
  const imgs = safeMap(toList(images), (img) => coverUrl(img))
  if (!imgs.length) return
  uni.previewImage({ urls: imgs, current: toStr(imgs[toNum(i, 0)], imgs[0]) })
}
const onChat = (u) => {
  if (!requireElite()) return
  uni.navigateTo({ url: `/pages/chat/chat?to=${toStr(getPath(u, 'id'), '')}` })
}

watch(activeTab, () => {
  if (!submitted.value) return
  if (activeTab.value === 'user' && userList.value.length === 0) loadUsers(true)
  if (activeTab.value === 'post' && postList.value.length === 0) loadPosts(true)
  if (activeTab.value === 'group' && groupList.value.length === 0) loadGroups(true)
})

onLoad((q) => {
  const qObj = toObj(q, {})
  const kw = toStr(getPath(qObj, 'keyword'), '')
  if (kw) {
    keyword.value = decodeURIComponent(kw)
    onSubmit()
  }
})
onMounted(loadHistory)
</script>

<style lang="scss" scoped>
.page-search { min-height: 100vh; background: $by-bg; }

.search-header {
  position: sticky; top: 0; z-index: 20;
  padding: 60rpx 24rpx 20rpx;
  background: linear-gradient(180deg, $by-bg-soft 0%, rgba($by-bg-soft, 0.88) 80%, transparent 100%);
  display: flex; align-items: center; gap: 16rpx;
}
.back-btn {
  width: 60rpx; height: 60rpx; display: flex; align-items: center; justify-content: center;
  color: $by-text-1; font-weight: 700;
  .arrow { font-size: 48rpx; line-height: 48rpx; }
}
.search-bar {
  flex: 1; display: flex; align-items: center; gap: 12rpx;
  height: 72rpx; padding: 0 24rpx;
  background: $by-surface; border: 1rpx solid $by-border;
  border-radius: 9999rpx;
}
.s-icon { font-size: 28rpx; }
.s-input {
  flex: 1; height: 68rpx; font-size: 28rpx; color: $by-text-1;
  background: transparent;
}
.s-clear {
  padding: 6rpx 12rpx; border-radius: 9999rpx;
  background: $by-bg-soft; color: $by-text-3; font-size: 22rpx;
}
.submit-btn {
  padding: 0 28rpx; height: 68rpx; line-height: 68rpx;
  border-radius: 9999rpx;
  background: $by-gradient-gold; color: $by-bg;
  font-weight: 700; font-size: 28rpx;
  box-shadow: $by-shadow-1;
}

.tabs-bar {
  background: $by-bg-soft;
  position: sticky; top: 132rpx; z-index: 15;
  border-bottom: 1rpx solid $by-border;
}
.tabs-scroll { white-space: nowrap; }
.tabs { display: inline-flex; gap: 32rpx; padding: 18rpx 32rpx 14rpx; }
.tab-item {
  position: relative; display: inline-block;
  color: $by-text-3; font-size: 30rpx; font-weight: 600;
  padding: 0 6rpx 10rpx;
  &.active { color: $by-gold; }
}
.tab-bar {
  position: absolute; left: 10%; right: 10%; bottom: 0;
  height: 6rpx; border-radius: 4rpx;
  background: $by-gradient-gold;
}

.idle, .result { padding: 20rpx 24rpx 40rpx; }
.card-wrap + .card-wrap { margin-top: 24rpx; }
.card {
  background: $by-surface; border: 1rpx solid $by-border;
  border-radius: 20rpx; padding: 28rpx;
}
.head-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18rpx; }
.head-title { font-size: 30rpx; font-weight: 700; color: $by-text-1; }
.head-clear { font-size: 24rpx; color: $by-text-3; }

.chips { display: flex; flex-wrap: wrap; gap: 16rpx; }
.chip {
  padding: 12rpx 24rpx;
  border-radius: 9999rpx;
  background: $by-bg-soft;
  color: $by-text-3;
  border: 1rpx solid $by-border;
  font-size: 26rpx;
  &:active { background: color.adjust($by-gold, $alpha: -0.88); color: $by-gold; }
}

.hot-list { display: flex; flex-direction: column; }
.hot-item {
  display: flex; align-items: center; gap: 16rpx;
  padding: 20rpx 8rpx;
  border-bottom: 1rpx solid $by-border;
  &:last-child { border-bottom: none; }
}
.hot-rank {
  width: 40rpx; text-align: center; font-weight: 800; font-size: 28rpx; color: $by-text-3;
  &.r-1 { color: #DC2626; }
  &.r-2 { color: #EA580C; }
  &.r-3 { color: #D97706; }
}
.hot-text { flex: 1; color: $by-text-1; font-size: 28rpx; }
.hot-num { color: $by-text-3; font-size: 22rpx; }
.hot-tag {
  font-size: 20rpx; padding: 4rpx 10rpx; border-radius: 8rpx; font-weight: 700;
  &.hot { background: rgba(220,38,38,0.10); color: #DC2626; }
  &.new { background: color.adjust($by-aurora-a, $alpha: -0.88); color: $by-aurora-a; }
}

/* ---- 用户结果 ---- */
.t-tag {
  padding: 6rpx 16rpx; border-radius: 9999rpx; font-size: 22rpx;
  &.tc-0 { background: color.adjust($by-gold, $alpha: -0.88); color: $by-gold; }
  &.tc-1 { background: color.adjust($by-aurora-a, $alpha: -0.88); color: $by-aurora-a; }
  &.tc-2 { background: color.adjust($by-aurora-c, $alpha: -0.88); color: $by-aurora-c; }
  &.tc-3 { background: color.adjust($by-aurora-b, $alpha: -0.88); color: $by-aurora-b; }
}
.user-row {
  display: flex; gap: 20rpx; align-items: center;
  padding: 20rpx; margin-bottom: 20rpx;
}
.u-av { width: 110rpx; height: 110rpx; border-radius: 50%; background: $by-bg-soft; }
.u-body { flex: 1; display: flex; flex-direction: column; gap: 6rpx; }
.u-top { display: flex; align-items: center; gap: 10rpx; }
.u-name { font-weight: 700; color: $by-text-1; font-size: 30rpx; }
.u-bio { color: $by-text-3; font-size: 24rpx; }
.u-tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 4rpx; }
.tag {
  padding: 4rpx 12rpx; border-radius: 8rpx; font-size: 22rpx; font-weight: 600;
  &.tag-yellow { background: color.adjust($by-gold, $alpha: -0.86); color: $by-gold; }
  &.tag-success { background: color.adjust($by-success, $alpha: -0.86); color: $by-success; }
}
.u-btn {
  padding: 12rpx 24rpx; border-radius: 9999rpx;
  background: linear-gradient(135deg, $by-aurora-a 0%, $by-aurora-b 100%);
  color: #fff; font-size: 24rpx; font-weight: 700;
}

/* ---- 动态结果 ---- */
.post-row { padding: 20rpx; margin-bottom: 20rpx; }
.post-head { display: flex; gap: 14rpx; align-items: center; margin-bottom: 14rpx; }
.p-av { width: 70rpx; height: 70rpx; border-radius: 50%; background: $by-bg-soft; }
.p-info { flex: 1; }
.p-top { display: flex; align-items: center; gap: 10rpx; }
.p-name { font-weight: 700; color: $by-text-1; font-size: 26rpx; }
.p-meta { color: $by-text-3; font-size: 22rpx; margin-top: 2rpx; }
.p-text { color: $by-text-1; font-size: 28rpx; line-height: 1.55; white-space: pre-wrap; }
.p-imgs { margin-top: 14rpx; display: grid; gap: 8rpx; }
.p-imgs.img-col-1 { grid-template-columns: 1fr; }
.p-imgs.img-col-2 { grid-template-columns: repeat(2, 1fr); }
.p-imgs.img-col-3 { grid-template-columns: repeat(3, 1fr); }
.p-img { width: 100%; aspect-ratio: 1/1; border-radius: 10rpx; background: $by-bg-soft; }

/* ---- 组局结果 ---- */
.group-row { padding: 20rpx; margin-bottom: 20rpx; display: flex; gap: 20rpx; }
.g-cover { width: 200rpx; height: 200rpx; border-radius: 16rpx; overflow: hidden; flex-shrink: 0; }
.g-cover-img { width: 100%; height: 100%; }
.g-body { flex: 1; display: flex; flex-direction: column; gap: 10rpx; }
.g-status-row { display: flex; align-items: center; gap: 10rpx; }
.g-status {
  padding: 4rpx 12rpx; border-radius: 8rpx; font-size: 22rpx; font-weight: 700;
  &.status-open { background: rgba(34,197,94,0.12); color: #22C55E; }
  &.status-full { background: rgba(245,158,11,0.12); color: #F59E0B; }
  &.status-closed, &.status-canceled { background: color.adjust($by-text-3, $alpha: -0.88); color: $by-text-3; }
}
.g-title { font-weight: 700; color: $by-text-1; font-size: 30rpx; }
.g-meta-row { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 4rpx; }
.meta-item { display: inline-flex; align-items: center; gap: 6rpx; color: $by-text-3; font-size: 22rpx; }

.state-wrap { padding: 60rpx 0; text-align: center; }
.state-text { color: $by-text-3; font-size: 26rpx; }
.empty { padding: 80rpx 0; display: flex; flex-direction: column; align-items: center; gap: 14rpx; }
.empty-emoji { font-size: 72rpx; }
.empty-text { color: $by-text-3; font-size: 26rpx; }
.load-more { padding: 30rpx 0 10rpx; text-align: center; color: $by-text-3; font-size: 26rpx; }
.bottom-safe { height: calc(40rpx + env(safe-area-inset-bottom)); }
</style>
