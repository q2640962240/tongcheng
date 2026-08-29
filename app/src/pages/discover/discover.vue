<template>
  <view class="page-discover">
    <!-- 顶部 Header -->
    <view class="by-header">
      <view class="by-header-row">
        <view>
          <view class="by-header__title">白夜 · 发现</view>
          <view class="by-header__subtitle">🌙 让陪伴在夜晚发生</view>
        </view>
        <view class="by-header-publish" @tap="goPublish">
          <text class="plus">+</text>
          <text class="publish-text">发布</text>
        </view>
      </view>
    </view>

    <!-- 4 Tab 切换 -->
    <scroll-view scroll-x class="by-tabs-scroll hide-scrollbar">
      <view class="by-tabs">
        <view
          v-for="tab in tabs"
          :key="tab.key"
          class="by-tab__item"
          :class="{ active: currentTab === tab.key }"
          @tap="currentTab = tab.key"
        >
          <text class="by-tab__label">{{ tab.label }}</text>
          <view class="by-tab__meta" v-if="tab.meta">{{ tab.meta }}</view>
          <view v-if="currentTab === tab.key" class="by-tab__bar" />
        </view>
      </view>
    </scroll-view>

    <!-- 网络异常诊断条（避免"全空像黑屏"的错觉） -->
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
        <view class="btn-primary nt-btn" @tap="onReloadAll">🔄 全部重试</view>
      </view>
      <view class="nt-tips">
        <text>提示：本地 WiFi 真机调试时，地址须写成「http://电脑局域网IP:3000/api」，手机与电脑须连同一 WiFi。</text>
      </view>
    </view>

    <!-- 寻人大厅 -->
    <view v-if="currentTab === 'finder'" class="by-panel">
      <view class="finder-banner card">
        <view class="finder-bg"></view>
        <view class="finder-body">
          <view class="finder-left">
            <view class="finder-badge">✨ 寻人大厅</view>
            <text class="finder-title">精英特权解锁发布 · 10 秒被 TA 看见</text>
            <text class="finder-desc">自定义条件 · 精准匹配 · 真实认证</text>
          </view>
          <view class="btn-primary finder-btn" @tap="goElite">立即解锁</view>
        </view>
      </view>

      <view class="filter-row">
        <view class="filter-chip" @tap="showGender = !showGender">{{ genderText }} ▾</view>
        <view class="filter-chip">年龄 ▾</view>
        <view class="filter-chip">星座 ▾</view>
        <view class="filter-chip filter-chip--ghost" @tap="goPublishFilter">🎯 发布需求</view>
      </view>

      <view v-if="finderLoading" class="state-wrap"><text class="state-text">加载中…</text></view>
      <view v-else class="finder-list">
        <view
          v-for="u in finderList"
          :key="u.id"
          class="finder-card card"
          @tap="goUser(u)"
        >
          <image class="finder-avatar" :src="u.avatar" mode="aspectFill" />
          <view class="finder-info">
            <view class="finder-top">
              <text class="finder-name">{{ u.nickname }}</text>
              <view v-if="u.isElite" class="tag tag-yellow">精英</view>
              <view v-if="u.realPersonStatus === 'passed'" class="tag tag-success">真人</view>
            </view>
            <text class="finder-bio">{{ u.bio || '这个人很神秘，什么也没留下～' }}</text>
            <view class="finder-tags">
              <text v-for="(t, i) in u.tags" :key="i" class="tag" :class="tagColor(t, i)">{{ t }}</text>
            </view>
          </view>
          <view class="finder-cta" @tap.stop="onFinderContact(u)">聊聊</view>
        </view>
      </view>

      <view v-if="!finderLoading && finderList.length === 0" class="empty">
        <text class="empty-emoji">{{ finderFailed ? '📡' : '🌌' }}</text>
        <text class="empty-text">{{ finderFailed ? '连接服务器失败，请先设置服务器地址' : '暂无符合条件的 TA' }}</text>
        <view v-if="finderFailed" class="empty-actions">
          <view class="btn-outline" @tap="onFixServerUrl">🛠 设置服务器地址</view>
          <view class="btn-primary" @tap="loadFinder">🔄 重试</view>
        </view>
        <text class="empty-hint" v-if="finderFailed">本地 WiFi 真机调试 → 地址格式：http://电脑IP:3000/api</text>
      </view>
    </view>

    <!-- 动态广场 -->
    <view v-if="currentTab === 'posts'" class="by-panel">
      <view class="posts-toolbar">
        <view class="posts-toolbar__left">
          <picker mode="selector" :range="['全国', '附近', '关注']" @change="onRangeChange">
            <view class="filter-chip">{{ rangeText }} ▾</view>
          </picker>
          <view class="filter-chip filter-chip--ghost">📍 {{ cityText }}</view>
        </view>
        <view class="btn-primary by-btn-mini" @tap="goPublish">＋ 发布动态</view>
      </view>

      <view v-if="postsLoading && postsList.length === 0" class="state-wrap"><text class="state-text">加载中…</text></view>

      <view
        v-for="p in postsList"
        :key="p.id"
        class="post-card card"
      >
        <view class="post-head">
          <image class="post-avatar" :src="p.user && p.user.avatar" mode="aspectFill" />
          <view class="post-info">
            <view class="post-top">
              <text class="post-name">{{ (p.user && p.user.nickname) || '匿名用户' }}</text>
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
            @tap="previewImg(p.images, i)"
          />
        </view>
        <view class="post-tags" v-if="p.category">
          <text class="tag tag-blue">#{{ categoryLabel(p.category) }}</text>
        </view>
        <view class="post-actions">
          <view class="action" :class="{ active: p.liked }" @tap="onLike(p)">
            <text class="a-icon">{{ p.liked ? '❤️' : '🤍' }}</text>
            <text class="a-text">{{ p.likeCount || 0 }}</text>
          </view>
          <view class="action" @tap="goPostDetail(p)">
            <text class="a-icon">💬</text>
            <text class="a-text">{{ p.commentCount || 0 }}</text>
          </view>
          <view class="action" @tap="onShare(p)">
            <text class="a-icon">↗️</text>
            <text class="a-text">分享</text>
          </view>
        </view>
      </view>

      <view class="load-more" @tap="loadMorePosts">
        <text v-if="!postsLoading">{{ postsHasMore ? '加载更多 ↓' : '— 到底了 —' }}</text>
        <text v-else>加载中…</text>
      </view>
      <view v-if="!postsLoading && postsList.length === 0" class="empty">
        <text class="empty-emoji">{{ postsFailed ? '📡' : '🕊' }}</text>
        <text class="empty-text">{{ postsFailed ? '连接服务器失败，请先设置服务器地址' : '还没有动态，来发第一条吧～' }}</text>
        <view v-if="postsFailed" class="empty-actions">
          <view class="btn-outline" @tap="onFixServerUrl">🛠 设置服务器地址</view>
          <view class="btn-primary" @tap="loadPosts(true)">🔄 重试</view>
        </view>
        <text class="empty-hint" v-if="postsFailed">本地 WiFi 真机调试 → 地址格式：http://电脑IP:3000/api</text>
      </view>
    </view>

    <!-- 同城组局 -->
    <view v-if="currentTab === 'groups'" class="by-panel">
      <view class="groups-banner card" @tap="goElite">
        <view class="gb-bg"></view>
        <view class="gb-body">
          <view>
            <view class="gb-title">🎬 组局新玩法</view>
            <view class="gb-desc">观影 · 旅行 · 密室 · 剧本杀 · 夜骑</view>
          </view>
          <view class="btn-aurora gb-btn">精英优先 ›</view>
        </view>
      </view>

      <view class="posts-toolbar">
        <view class="posts-toolbar__left">
          <picker mode="selector" :range="groupCities" :value="groupCityIdx" @change="onGroupCityChange">
            <view class="filter-chip">{{ groupCities[groupCityIdx] }} ▾</view>
          </picker>
          <picker mode="selector" :range="groupCats" :value="groupCatIdx" @change="onGroupCatChange">
            <view class="filter-chip filter-chip--ghost">{{ groupCats[groupCatIdx] }} ▾</view>
          </picker>
        </view>
        <view class="btn-primary by-btn-mini" @tap="goCreateGroup">＋ 发起组局</view>
      </view>

      <view v-if="groupsLoading && groupsList.length === 0" class="state-wrap"><text class="state-text">加载中…</text></view>

      <view
        v-for="g in groupsList"
        :key="g.id"
        class="group-card card"
        @tap="goGroupDetail(g)"
      >
        <view v-if="g.cover" class="group-cover">
          <image class="group-cover-img" :src="g.cover" mode="aspectFill" />
        </view>
        <view class="group-body">
          <view class="group-status-row">
            <text class="group-status" :class="'status-' + g.status">
              {{ groupStatusText(g.status) }}
            </text>
            <text class="group-hot" v-if="g.hot">🔥 热门</text>
          </view>
          <text class="group-title">{{ g.title }}</text>
          <text class="group-desc" v-if="g.description">{{ truncate(g.description, 50) }}</text>
          <view class="group-meta-row">
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
              <text class="meta-text">{{ g.activityAt ? formatDate(g.activityAt) : '时间待定' }}</text>
            </view>
          </view>
          <view class="group-tags" v-if="g.tags && g.tags.length">
            <text v-for="(t, i) in g.tags.slice(0, 4)" :key="i" class="tag" :class="tagColor(t, i)">{{ t }}</text>
          </view>
          <view class="group-footer">
            <view class="group-creator" v-if="g.user">
              <image class="gc-avatar" :src="g.user.avatar" mode="aspectFill" />
              <text class="gc-name">{{ g.user.nickname }}</text>
              <text v-if="g.user.isElite" class="tag tag-yellow tag-sm">精英</text>
            </view>
            <view class="group-join-btn" @tap.stop="onJoinGroup(g)">立即报名</view>
          </view>
        </view>
      </view>

      <view v-if="!groupsLoading && groupsList.length === 0" class="empty">
        <text class="empty-emoji">{{ groupsFailed ? '📡' : '🎭' }}</text>
        <text class="empty-text">{{ groupsFailed ? '连接服务器失败，请先设置服务器地址' : '暂无组局，来发起第一个吧～' }}</text>
        <view v-if="groupsFailed" class="empty-actions">
          <view class="btn-outline" @tap="onFixServerUrl">🛠 设置服务器地址</view>
          <view class="btn-primary" @tap="loadGroups(true)">🔄 重试</view>
        </view>
        <text class="empty-hint" v-if="groupsFailed">本地 WiFi 真机调试 → 地址格式：http://电脑IP:3000/api</text>
      </view>
    </view>

    <!-- 红包专区 -->
    <view v-if="currentTab === 'redpack'" class="by-panel">
      <view class="redpack-card card">
        <view class="redpack-glow"></view>
        <view class="redpack-body">
          <view class="redpack-head">
            <text class="redpack-title">💎 每日签到领钻石</text>
            <text class="redpack-sub">连续签到 7 天，额外赠送 50 钻石</text>
          </view>
          <view class="sign-week">
            <view v-for="(d, i) in signDays" :key="i" class="sign-day" :class="{ done: d.done, today: d.today }">
              <text class="sign-w">{{ d.label }}</text>
              <text class="sign-v">+{{ d.v }}</text>
              <view v-if="d.done" class="sign-check">✓</view>
            </view>
          </view>
          <view class="btn-primary sign-btn" @tap="onSign" :class="{ disabled: signedToday || signLoading }">
            {{ signLoading ? '签到中…' : (signedToday ? '今日已签到 ✓' : `签到 +10 💎`) }}
          </view>
        </view>
      </view>

      <view class="act-card card">
        <view class="act-title-row">
          <text class="act-title">🎉 限时活动</text>
          <text class="act-more">更多 ›</text>
        </view>
        <view class="act-grid">
          <view class="act-item ai-1">
            <text class="act-emoji">📣</text>
            <text class="act-label">新人专享礼</text>
            <text class="act-reward">领 100 钻石</text>
          </view>
          <view class="act-item ai-2">
            <text class="act-emoji">🎁</text>
            <text class="act-label">邀请好友</text>
            <text class="act-reward">返 20% 佣金</text>
          </view>
          <view class="act-item ai-3">
            <text class="act-emoji">🎯</text>
            <text class="act-label">每日任务</text>
            <text class="act-reward">最高 50 钻</text>
          </view>
          <view class="act-item ai-4">
            <text class="act-emoji">🏆</text>
            <text class="act-label">周榜争霸</text>
            <text class="act-reward">实物大奖</text>
          </view>
        </view>
      </view>

      <view class="act-card card">
        <view class="act-title-row">
          <text class="act-title">💰 红包雨预告</text>
        </view>
        <view class="rain-row">
          <view class="rain-icon">🌧️</view>
          <view class="rain-info">
            <text class="rain-next">下一场：今晚 21:00</text>
            <text class="rain-desc">每轮 1000 钻石奖池，手慢无！</text>
          </view>
          <view class="btn-outline rain-btn" @tap="onRainRemind">提醒我</view>
        </view>
      </view>
    </view>

    <view class="bottom-safe"></view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { postApi, groupApi, userApi, walletApi, locationApi } from '../../api'
import { getCurrentBaseURL, openServerUrlModal } from '../../utils/request'
import {
  toList, toStr, toNum, toObj, toBool, pickCity, getPath, unwrap, unwrapPage,
  guard, truncate, formatTime as ft, avatarUrl, coverUrl, pickTags,
  debounce, requireLogin, resolveCityViaPipeline, safeMap
} from '@/utils/fallback'

const CITY_KEY = 'baiye_city'

/* 城市定位请求包装：对接 locationApi.reverse / guessByIp，供 4 级流水线使用 */
const cityRequestFn = async (opts) => {
  const o = toObj(opts, {})
  const url = toStr(getPath(o, 'url'), '')
  if (url === '/location/reverse') {
    const d = toObj(getPath(o, 'data'), {})
    return guard(locationApi.reverse({ lat: toNum(getPath(d, 'lat')), lng: toNum(getPath(d, 'lng')) }), null)
  }
  if (url === '/location/guess-by-ip') {
    return guard(locationApi.guessByIp(), null)
  }
  return null
}

const applyCityToState = (city) => {
  const c = toStr(city, '')
  if (!c) return
  cityText.value = c
  const idx = safeMap(groupCities.value, (x) => toStr(x, '')).indexOf(c)
  if (idx >= 0) groupCityIdx.value = idx
}

const readCity = async () => {
  // 先尝试读本地缓存（同步，立即渲染），然后启动 4 级流水线（异步，后台刷新）
  try {
    const saved = toStr(uni.getStorageSync(CITY_KEY), '')
    if (saved) applyCityToState(saved)
  } catch (_) { /* ignore */ }
  const r = await guard(resolveCityViaPipeline({ requestFn: cityRequestFn }), { city: '', source: '' })
  const rc = toStr(getPath(toObj(r, {}), 'city'), '')
  if (rc) applyCityToState(rc)
}

const tabs = [
  { key: 'finder', label: toStr('寻人大厅'), meta: toStr('') },
  { key: 'posts', label: toStr('动态'), meta: toStr('Hot') },
  { key: 'groups', label: toStr('同城组局'), meta: toStr('New') },
  { key: 'redpack', label: toStr('红包专区'), meta: toStr('') }
]
const currentTab = ref('posts')

const cityText = ref(toStr('北京'))
const rangeText = ref(toStr('全国'))
const postsPage = ref(1)
const postsLoading = ref(false)
const postsHasMore = ref(true)
const postsList = ref([])

const groupCities = ref([
  '全国', '北京', '上海', '广州', '深圳', '成都', '杭州', '武汉',
  '西安', '重庆', '南京', '苏州', '长沙', '天津', '郑州', '青岛', '厦门', '宁波'
])
const groupCityIdx = ref(1)
const groupCats = ['全部', '剧本杀', '密室', '电影', '游戏', '饭局', '夜骑', '旅行']
const groupCatIdx = ref(0)
const groupsPage = ref(1)
const groupsLoading = ref(false)
const groupsList = ref([])

const showGender = ref(true)
const genderText = computed(() => showGender.value ? toStr('全部性别') : toStr('小姐姐'))
const finderLoading = ref(false)
const finderList = ref([])

/* ---- 黑屏友好：连接失败追踪 + 快捷入口 ---- */
const postsFailed = ref(false)
const groupsFailed = ref(false)
const finderFailed = ref(false)
const signFailed = ref(false)
const currentBaseURL = computed(() => getCurrentBaseURL())
const onFixServerUrl = () => openServerUrlModal({
  title: '设置服务器地址',
  onSaved: () => onReloadAll(),
  onReset: () => onReloadAll()
})
const onReloadAll = () => {
  Promise.all([
    loadPosts(true).catch(() => {}),
    loadGroups(true).catch(() => {}),
    loadFinder(true).catch(() => {}),
    updateSignState().catch(() => {})
  ])
}
/* 顶栏诊断条：仅当所有数据为空白且至少一个 tab 加载失败时显示，避免正常页面的视觉干扰 */
const showNetTrouble = computed(() => {
  const allEmpty = postsList.value.length === 0 && groupsList.value.length === 0 && finderList.value.length === 0
  const anyFailed = postsFailed.value || groupsFailed.value || finderFailed.value || signFailed.value
  return allEmpty && anyFailed
})

/* 签到（真实 API） */
const signedToday = ref(false)
const signDays = ref([
  { label: toStr('第1天'), v: 10, done: false, today: false },
  { label: toStr('第2天'), v: 10, done: false, today: false },
  { label: toStr('第3天'), v: 15, done: false, today: false },
  { label: toStr('第4天'), v: 15, done: false, today: false },
  { label: toStr('第5天'), v: 20, done: false, today: false },
  { label: toStr('第6天'), v: 20, done: false, today: false },
  { label: toStr('第7天'), v: 80, done: false, today: false }
])
const signLoading = ref(false)

const updateSignState = async () => {
  signFailed.value = false
  // 未登录走本地兜底（保留交互感）
  const hasToken = !!(uni.getStorageSync && toStr(uni.getStorageSync('baiye_token'), ''))
  if (!hasToken) {
    let history = {}
    try { history = toObj(uni.getStorageSync('sign_history'), {}) } catch (_) { history = {} }
    const today = new Date().toDateString()
    signedToday.value = toBool(history[today], false)
    const d = new Date()
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(d.getTime() - i * 86400000).toDateString()
      const day = signDays.value[6 - i]
      day.done = toBool(history[dt], false)
      day.today = toStr(dt) === toStr(today)
    }
    return
  }
  try {
    const resp = await guard(walletApi.signInStatus(), null)
    if (resp === null || resp === undefined) throw new Error('empty response')
    const info = toObj(unwrap(resp, null), {})
    signedToday.value = toBool(getPath(info, 'signedToday'), false)
    const streak = Math.max(0, Math.min(7, toNum(getPath(info, 'streakDays'), 0)))
    const d = new Date()
    const todayStr = d.toDateString()
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(d.getTime() - i * 86400000)
      const dayIdx = 6 - i
      const day = signDays.value[dayIdx]
      const dayRel = 7 - i
      day.done = dayRel <= streak
      day.today = toStr(dt.toDateString()) === toStr(todayStr)
    }
    const nr = getPath(info, 'nextReward')
    if (nr !== undefined && nr !== null) signDays.value[6].v = toNum(nr, 80)
  } catch (e) {
    signFailed.value = true
  }
}

/* Posts */
const loadPosts = async (reset = false) => {
  if (postsLoading.value) return
  postsLoading.value = true
  postsFailed.value = false
  try {
    if (reset) { postsPage.value = 1; postsList.value = []; postsHasMore.value = true }
    const params = { page: toNum(postsPage.value, 1), pageSize: 10 }
    if (toStr(rangeText.value) === '附近' && toStr(cityText.value)) params.city = toStr(cityText.value)
    const pageResp = await guard(unwrapPage(postApi.list(params), { list: [], total: 0 }), null)
    if (pageResp === null || pageResp === undefined) throw new Error('empty response')
    const pr = toObj(pageResp, { list: [], total: 0 })
    const rawList = toList(getPath(pr, 'list'))
    const total = toNum(getPath(pr, 'total'), 0)
    const rows = safeMap(rawList, (p) => {
      const userRaw = toObj(getPath(p, 'user'), {})
      return {
        id: getPath(p, 'id', ''),
        text: truncate(getPath(p, 'text'), 280),
        images: safeMap(toList(getPath(p, 'images')), (img) => coverUrl(img)),
        city: pickCity(getPath(p, 'city'), '同城'),
        createdAt: getPath(p, 'createdAt'),
        category: toStr(getPath(p, 'category'), ''),
        liked: toBool(getPath(p, 'liked'), false),
        user: {
          avatar: avatarUrl(getPath(userRaw, 'avatar')),
          nickname: toStr(getPath(userRaw, 'nickname'), '匿名用户'),
          isElite: toBool(getPath(userRaw, 'isElite'), false),
          realPersonStatus: toStr(getPath(userRaw, 'realPersonStatus'), '')
        },
        likeCount: toNum(getPath(p, 'likeCount'), 0),
        commentCount: toNum(getPath(p, 'commentCount'), 0)
      }
    })
    postsList.value = reset ? rows : postsList.value.concat(rows)
    postsHasMore.value = rows.length >= 10 && total > postsList.value.length
    postsPage.value = toNum(postsPage.value, 1) + 1
  } catch (e) {
    postsFailed.value = true
  } finally {
    postsLoading.value = false
  }
}

/* Groups */
const catMap = { '剧本杀':'game', '密室':'escape', '电影':'movie', '游戏':'game', '饭局':'dinner', '夜骑':'ride', '旅行':'travel' }
const loadGroups = async (reset = false) => {
  if (groupsLoading.value) return
  groupsLoading.value = true
  groupsFailed.value = false
  try {
    if (reset) { groupsPage.value = 1; groupsList.value = [] }
    const params = { page: toNum(groupsPage.value, 1), pageSize: 8 }
    const city = toStr(groupCities.value[toNum(groupCityIdx.value, 0)], '')
    if (city && city !== '全国') params.city = city
    const cat = toStr(groupCats[toNum(groupCatIdx.value, 0)], '')
    if (cat && cat !== '全部') params.category = toStr(catMap[cat], cat)
    const pageResp = await guard(unwrapPage(groupApi.list(params), { list: [], total: 0 }), null)
    if (pageResp === null || pageResp === undefined) throw new Error('empty response')
    const pr = toObj(pageResp, { list: [], total: 0 })
    const rawList = toList(getPath(pr, 'list'))
    const rows = safeMap(rawList, (g) => {
      const uRaw = toObj(getPath(g, 'user'), {})
      return {
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
        user: {
          avatar: avatarUrl(getPath(uRaw, 'avatar')),
          nickname: toStr(getPath(uRaw, 'nickname'), ''),
          isElite: toBool(getPath(uRaw, 'isElite'), false)
        }
      }
    })
    groupsList.value = reset ? rows : groupsList.value.concat(rows)
    groupsPage.value = toNum(groupsPage.value, 1) + 1
  } catch (e) {
    groupsFailed.value = true
  } finally {
    groupsLoading.value = false
  }
}

/* Finder (真实 userApi.discover) */
const loadFinder = async () => {
  finderLoading.value = true
  finderFailed.value = false
  try {
    const params = {
      page: 1,
      pageSize: 15,
      city: toStr(cityText.value) === '全国' ? '' : toStr(cityText.value)
    }
    if (toStr(genderText.value) === '小姐姐') params.gender = 2
    const pageResp = await guard(unwrapPage(userApi.discover(params), { list: [], total: 0 }), null)
    if (pageResp === null || pageResp === undefined) throw new Error('empty response')
    const pr = toObj(pageResp, { list: [], total: 0 })
    const rawList = toList(getPath(pr, 'list'))
    const rows = safeMap(rawList, (u) => ({
      id: getPath(u, 'id', ''),
      nickname: toStr(getPath(u, 'nickname'), '匿名'),
      avatar: avatarUrl(getPath(u, 'avatar')),
      bio: toStr(getPath(u, 'bio'), '这个人很神秘，什么也没留下～'),
      tags: pickTags(getPath(u, 'tags') || (getPath(u, 'city') ? [getPath(u, 'city')] : []), 3),
      isElite: toBool(getPath(u, 'isElite'), false),
      realPersonStatus: toStr(getPath(u, 'realPersonStatus'), '')
    }))
    finderList.value = rows
  } catch (e) {
    finderFailed.value = true
  } finally {
    finderLoading.value = false
  }
}

/* Tab 切换：避免瀑布，必要时 Promise.all */
watch(currentTab, async (t) => {
  const tasks = []
  if (t === 'posts' && postsList.value.length === 0) tasks.push(loadPosts(true))
  if (t === 'groups' && groupsList.value.length === 0) tasks.push(loadGroups(true))
  if (t === 'finder' && finderList.value.length === 0) tasks.push(loadFinder())
  if (t === 'redpack') tasks.push(updateSignState())
  if (tasks.length > 0) await Promise.all(tasks)
})

watch([groupCityIdx, groupCatIdx], debounce(() => loadGroups(true), 180))

onShow(async () => {
  // onShow 时：异步流水线解析城市 + 首次展示并行加载当前 tab 所需资源
  const bootTasks = [readCity(), updateSignState()]
  if (toStr(currentTab.value) === 'posts' && postsList.value.length === 0) bootTasks.push(loadPosts(true))
  if (toStr(currentTab.value) === 'groups' && groupsList.value.length === 0) bootTasks.push(loadGroups(true))
  if (toStr(currentTab.value) === 'finder' && finderList.value.length === 0) bootTasks.push(loadFinder())
  await Promise.all(bootTasks)
})

onMounted(() => {
  // 首屏兜底：先取本地缓存城市，onShow 再流水线刷新
  try {
    const saved = toStr(uni.getStorageSync(CITY_KEY), '')
    if (saved) applyCityToState(saved)
    else readCity()
  } catch (_) { readCity() }
})

/* --- helpers --- */
/* 原 formatTime 重命名为本地别名 fmtTime（避免与 fallback.formatTime 别名 ft 语义混淆） */
const fmtTime = (t) => {
  const s = ft(t)
  return toStr(s, '')
}
/* 暴露给 template 继续使用旧名 formatTime（指向 fallback.ft 的包装） */
const formatTime = fmtTime
const formatDate = (t) => {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  return `${toNum(d.getMonth() + 1)}月${toNum(d.getDate())}日`
}
const categoryLabel = (c) => {
  const map = { dynamic:'日常', group:'组局', show:'新人秀', seek:'寻人' }
  return toStr(map[toStr(c)], toStr(c))
}
const groupStatusText = (s) => {
  const map = { open:'招募中', full:'人已满', closed:'已结束', canceled:'已取消' }
  return toStr(map[toStr(s)], '招募中')
}
const tagColor = (_, i) => ['tag-yellow','tag-purple','tag-blue','tag-pink'][toNum(i, 0) % 4]

/* --- actions --- */
const goPublish = () => uni.navigateTo({ url: '/pages/post/publish' })
const goPublishFilter = () => {
  if (!requireLogin()) return
  uni.showToast({ title: toStr('请先开通精英'), icon: 'none' })
  setTimeout(() => uni.navigateTo({ url: '/pages/elite-pay/elite-pay' }), 800)
}
const goElite = () => uni.navigateTo({ url: '/pages/elite-pay/elite-pay' })
const goCreateGroup = () => uni.navigateTo({ url: '/pages/post/publish?mode=group' })
const goGroupDetail = (g) => uni.navigateTo({ url: `/pages/group/detail?id=${toStr(getPath(g, 'id'), '')}` })
const goPostDetail = (p) => uni.navigateTo({ url: `/pages/group/detail?id=${toStr(getPath(p, 'id'), '')}&mode=post` })
const goUser = (u) => uni.navigateTo({ url: `/pages/provider/provider?id=${toStr(getPath(u, 'id'), '')}` })
const onRangeChange = (e) => {
  const ranges = ['全国', '附近', '关注']
  rangeText.value = toStr(ranges[toNum(getPath(e, 'detail.value'), 0)], '全国')
  loadPosts(true)
}
const onGroupCityChange = (e) => { groupCityIdx.value = toNum(getPath(e, 'detail.value'), 0) }
const onGroupCatChange = (e) => { groupCatIdx.value = toNum(getPath(e, 'detail.value'), 0) }
const loadMorePosts = () => loadPosts(false)

const onLike = async (p) => {
  if (!requireLogin()) return
  const id = toStr(getPath(p, 'id'), '')
  if (!id) return
  const resp = await guard(postApi.like(id), null)
  const data = toObj(unwrap(resp, null), {})
  const liked = toBool(getPath(data, 'liked'), false)
  const likeCount = toNum(getPath(data, 'likeCount'), getPath(p, 'likeCount', 0))
  p.liked = liked
  p.likeCount = likeCount
  uni.showToast({ title: liked ? toStr('已点赞') : toStr('已取消'), icon: 'none' })
}
const previewImg = (images, i) => {
  const imgs = safeMap(toList(images), (img) => coverUrl(img))
  if (!imgs.length) return
  uni.previewImage({ urls: imgs, current: toStr(imgs[toNum(i, 0)], imgs[0]) })
}
const onShare = (p) => {
  if (!requireLogin()) return
  const text = truncate(getPath(p, 'text'), 80)
  uni.setClipboardData({
    data: toStr(`白夜 · ${text}`),
    success: () => uni.showToast({ title: toStr('链接已复制'), icon: 'none' })
  })
}
const onJoinGroup = (g) => {
  if (!requireLogin()) return
  uni.navigateTo({ url: `/pages/group/detail?id=${toStr(getPath(g, 'id'), '')}&autoJoin=1` })
}
const onFinderContact = (u) => {
  if (!requireLogin()) return
  uni.navigateTo({ url: `/pages/chat/chat?to=${toStr(getPath(u, 'id'), '')}` })
}
const onSign = async () => {
  if (!requireLogin()) return
  if (signLoading.value) return
  if (signedToday.value) return uni.showToast({ title: toStr('今日已签到'), icon: 'none' })
  signLoading.value = true
  const resp = await guard(walletApi.signIn(), null)
  const info = toObj(unwrap(resp, null), {})
  if (resp === null || Object.keys(info).length === 0) {
    // 异常：吞错误，不抛控制台
    signLoading.value = false
    return
  }
  signedToday.value = true
  const reward = toNum(getPath(info, 'rewardDiamond') || getPath(info, 'reward'), 10)
  uni.showToast({ title: toStr(`签到成功 +${reward} 💎`), icon: 'none' })
  try {
    let history = {}
    try { history = toObj(uni.getStorageSync('sign_history'), {}) } catch (_) { history = {} }
    history[new Date().toDateString()] = Date.now()
    uni.setStorageSync('sign_history', history)
  } catch (_) { /* ignore */ }
  await updateSignState()
  signLoading.value = false
}
const onRainRemind = () => uni.showToast({ title: toStr('已开启开播提醒'), icon: 'none' })
</script>

<style lang="scss" scoped>
/* uni.scss 会自动注入到本 style 块顶部，已加载 sass:color 和 $by-* 全局变量。
 * ✅ 直接用 color.adjust / $by-*；❌ 不要再写 @use "sass:color"（冲突）或 @use theme-baiye.scss。
 */
.page-discover { min-height: 100vh; background: $by-bg; }
.bottom-safe { height: calc(160rpx + env(safe-area-inset-bottom)); }

.by-header {
  padding: 60rpx 32rpx 20rpx;
  background: linear-gradient(160deg, $by-bg-soft 0%, $by-bg 100%);
  border-bottom: 1rpx solid $by-border;
}
.by-header-row { display: flex; align-items: center; justify-content: space-between; }
.by-header__title { font-size: 44rpx; font-weight: 800;
  background: $by-gradient-aurora; -webkit-background-clip: text; background-clip: text; color: transparent; }
.by-header__subtitle { margin-top: 6rpx; font-size: 24rpx; color: $by-text-3; }
.by-header-publish {
  display: flex; align-items: center; gap: 8rpx;
  padding: 14rpx 24rpx; border-radius: 9999rpx;
  background: $by-gradient-gold; color: #0B0F1A;
  box-shadow: $by-shadow-gold; font-weight: 700;
}
.plus { font-size: 28rpx; line-height: 1; }
.publish-text { font-size: 26rpx; }

.by-tabs-scroll { white-space: nowrap; background: $by-bg-soft; position: sticky; top: 0; z-index: 15; border-bottom: 1rpx solid $by-border; }
.by-tabs { display: inline-flex; padding: 20rpx 24rpx 16rpx; gap: 12rpx; }
.by-tab__item {
  position: relative; display: inline-flex; align-items: center; gap: 10rpx;
  padding: 14rpx 28rpx; border-radius: 9999rpx;
  background: color.change(#FFFFFF, $alpha: .04); color: $by-text-3; font-size: 28rpx; font-weight: 500;
}
.by-tab__item.active {
  background: linear-gradient(135deg, color.change($by-gold, $alpha: .2), color.change($by-aurora-a, $alpha: .18));
  color: $by-text-1; font-weight: 700;
  border: 1rpx solid color.change($by-gold, $alpha: .35);
}
.by-tab__meta {
  font-size: 18rpx; padding: 2rpx 10rpx; border-radius: 9999rpx;
  background: $by-gradient-gold; color: #0B0F1A; font-weight: 800;
}
.by-tab__bar {
  position: absolute; bottom: 2rpx; left: 50%; transform: translateX(-50%);
  width: 36rpx; height: 4rpx; border-radius: 4rpx; background: $by-gradient-gold;
}
.by-panel { padding: 24rpx 32rpx; }

/* ==== Finder ==== */
.finder-banner { position: relative; overflow: hidden; padding: 28rpx !important; margin-bottom: 24rpx; }
.finder-bg { position: absolute; inset: 0;
  background:
    radial-gradient(circle at 0% 0%, color.change($by-aurora-b, $alpha: .35), transparent 50%),
    radial-gradient(circle at 100% 100%, color.change($by-gold, $alpha: .25), transparent 50%); }
.finder-body { position: relative; display: flex; align-items: center; gap: 16rpx; }
.finder-left { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.finder-badge { align-self: flex-start; padding: 4rpx 18rpx; border-radius: 9999rpx;
  background: $by-gradient-gold; color: #0B0F1A; font-size: 22rpx; font-weight: 700; }
.finder-title { font-size: 30rpx; font-weight: 700; color: $by-text-1; }
.finder-desc { font-size: 22rpx; color: $by-text-3; }
.finder-btn { padding: 16rpx 28rpx !important; font-size: 26rpx !important; }

.filter-row { display: flex; flex-wrap: wrap; gap: 14rpx; margin-bottom: 20rpx; }
.filter-chip {
  padding: 12rpx 22rpx; border-radius: 9999rpx;
  background: color.change($by-gold, $alpha: .12); color: $by-gold-soft;
  font-size: 24rpx; font-weight: 500;
  border: 1rpx solid color.change($by-gold, $alpha: .25);
}
.filter-chip--ghost { background: $by-surface; color: $by-text-2; border-color: $by-border; }

.finder-list { display: flex; flex-direction: column; gap: 20rpx; }
.finder-card { display: flex; align-items: center; gap: 20rpx; padding: 20rpx !important; }
.finder-avatar { width: 120rpx; height: 120rpx; border-radius: 32rpx; flex-shrink: 0; background: $by-surface-2; }
.finder-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.finder-top { display: flex; align-items: center; gap: 10rpx; flex-wrap: wrap; }
.finder-name { font-size: 30rpx; font-weight: 700; color: $by-text-1; }
.finder-bio { font-size: 24rpx; color: $by-text-3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.finder-tags { display: flex; flex-wrap: wrap; gap: 8rpx; }
.finder-cta {
  padding: 14rpx 24rpx; border-radius: 9999rpx;
  background: color.change($by-gold, $alpha: .18); color: $by-gold-soft;
  font-weight: 700; font-size: 24rpx; flex-shrink: 0;
  border: 1rpx solid color.change($by-gold, $alpha: .3);
}
.finder-cta:active { background: color.change($by-gold, $alpha: .28); }

/* ==== Posts ==== */
.posts-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.posts-toolbar__left { display: flex; gap: 14rpx; }
.by-btn-mini { padding: 12rpx 24rpx !important; font-size: 24rpx !important; display: inline-flex; }

.post-card { display: flex; flex-direction: column; gap: 16rpx; padding: 24rpx !important; margin-bottom: 20rpx; }
.post-head { display: flex; align-items: center; gap: 16rpx; }
.post-avatar { width: 84rpx; height: 84rpx; border-radius: 9999rpx; background: $by-surface-2; }
.post-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.post-top { display: flex; align-items: center; gap: 8rpx; flex-wrap: wrap; }
.post-name { font-size: 28rpx; font-weight: 700; color: $by-text-1; }
.post-meta { font-size: 22rpx; color: $by-text-3; }
.post-text { font-size: 28rpx; color: $by-text-1; line-height: 1.6; white-space: pre-wrap; }
.post-images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; }
.post-images.img-col-1 { grid-template-columns: 1fr; }
.post-images.img-col-2 { grid-template-columns: repeat(2, 1fr); }
.post-image { width: 100%; aspect-ratio: 1; border-radius: $by-radius-md; background: $by-surface-2; }
.post-tags { display: flex; gap: 10rpx; }
.post-actions { display: flex; justify-content: space-around; padding-top: 12rpx; border-top: 1rpx solid $by-border; }
.action { display: flex; align-items: center; gap: 8rpx; padding: 12rpx 20rpx; border-radius: $by-radius-md; }
.action:active { background: color.change(#FFFFFF, $alpha: .05); }
.action.active .a-icon { filter: brightness(1.1); }
.a-icon { font-size: 30rpx; }
.a-text { font-size: 24rpx; color: $by-text-2; }

.load-more { padding: 40rpx 0 10rpx; text-align: center; font-size: 26rpx; color: $by-text-3; }

/* ==== Groups ==== */
.groups-banner { position: relative; overflow: hidden; padding: 28rpx !important; margin-bottom: 24rpx; }
.gb-bg { position: absolute; inset: 0;
  background:
    linear-gradient(135deg, color.change($by-aurora-a, $alpha: .45), color.change($by-aurora-b, $alpha: .35) 45%, color.change($by-gold, $alpha: .3) 100%); }
.gb-body { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }
.gb-title { font-size: 32rpx; font-weight: 800; color: #fff; }
.gb-desc { font-size: 24rpx; color: color.change(#FFFFFF, $alpha: .85); margin-top: 4rpx; }
.gb-btn { padding: 14rpx 24rpx !important; font-size: 24rpx !important; }

.group-card { display: flex; flex-direction: column; padding: 0 !important; overflow: hidden; margin-bottom: 24rpx; }
.group-cover { width: 100%; height: 280rpx; position: relative; }
.group-cover-img { width: 100%; height: 100%; }
.group-body { padding: 24rpx; display: flex; flex-direction: column; gap: 14rpx; }
.group-status-row { display: flex; align-items: center; gap: 14rpx; }
.group-status {
  align-self: flex-start;
  padding: 4rpx 16rpx; border-radius: 9999rpx;
  font-size: 22rpx; font-weight: 700;
}
.group-status.status-open { background: color.change($by-success, $alpha: .18); color: $by-success; }
.group-status.status-full { background: color.change($by-warning, $alpha: .18); color: $by-warning; }
.group-status.status-closed, .group-status.status-canceled { background: color.change($by-error, $alpha: .18); color: $by-error; }
.group-hot { font-size: 22rpx; color: $by-error; }
.group-title { font-size: 32rpx; font-weight: 800; color: $by-text-1; }
.group-desc { font-size: 24rpx; color: $by-text-3; line-height: 1.5; }
.group-meta-row { display: flex; flex-wrap: wrap; gap: 20rpx; }
.meta-item { display: flex; align-items: center; gap: 6rpx; }
.meta-icon { font-size: 24rpx; }
.meta-text { font-size: 24rpx; color: $by-text-2; }
.group-tags { display: flex; flex-wrap: wrap; gap: 8rpx; }
.tag-sm { padding: 2rpx 12rpx; font-size: 20rpx; }
.group-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 12rpx; border-top: 1rpx solid $by-border; }
.group-creator { display: flex; align-items: center; gap: 10rpx; }
.gc-avatar { width: 48rpx; height: 48rpx; border-radius: 9999rpx; }
.gc-name { font-size: 24rpx; color: $by-text-2; }
.group-join-btn {
  padding: 14rpx 28rpx; border-radius: 9999rpx;
  background: $by-gradient-gold; color: #0B0F1A;
  font-weight: 700; font-size: 24rpx;
  box-shadow: $by-shadow-gold;
}
.group-join-btn:active { filter: brightness(1.08); }

/* ==== Redpack ==== */
.redpack-card { position: relative; overflow: hidden; padding: 0 !important; margin-bottom: 24rpx; }
.redpack-glow { position: absolute; inset: 0;
  background:
    radial-gradient(circle at 50% 0%, color.change(#FFFFFF, $alpha: .25), transparent 60%),
    linear-gradient(160deg, color.change($by-gold-gradient-a, $alpha: 1) -10%, color.change($by-gold-gradient-b, $alpha: 1) 50%, color.change($by-gold-gradient-c, $alpha: 1) 110%);
}
.redpack-body { position: relative; padding: 36rpx 32rpx; }
.redpack-head { margin-bottom: 24rpx; }
.redpack-title { display: block; font-size: 40rpx; font-weight: 800; color: #1a1200; }
.redpack-sub { display: block; margin-top: 8rpx; font-size: 26rpx; color: color.change($by-gold-deep, $alpha: .85); }
.sign-week { display: flex; justify-content: space-between; gap: 10rpx; margin-bottom: 24rpx; }
.sign-day {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6rpx;
  padding: 18rpx 4rpx; border-radius: $by-radius-md;
  background: color.change(#FFFFFF, $alpha: .35); position: relative;
}
.sign-day.done { background: color.change($by-gold-deep, $alpha: .35); }
.sign-day.today { background: #fff; box-shadow: 0 8rpx 20rpx color.change($by-gold-deep, $alpha: .35); transform: translateY(-4rpx); }
.sign-w { font-size: 20rpx; color: $by-gold-deep; font-weight: 600; }
.sign-v { font-size: 22rpx; font-weight: 700; color: #1a1200; }
.sign-check { position: absolute; top: 4rpx; right: 6rpx; font-size: 20rpx; color: $by-success; font-weight: 800; }
.sign-btn { width: 100%; font-size: 30rpx !important; }
.sign-btn.disabled { opacity: .6; }

.act-card { padding: 24rpx !important; margin-bottom: 24rpx; }
.act-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.act-title { font-size: 30rpx; font-weight: 700; color: $by-text-1; }
.act-more { font-size: 24rpx; color: $by-text-3; }
.act-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16rpx; }
.act-item {
  position: relative; padding: 24rpx; border-radius: $by-radius-lg;
  display: flex; flex-direction: column; gap: 8rpx; overflow: hidden;
  background: $by-surface; border: 1rpx solid $by-border;
}
.act-emoji { font-size: 44rpx; }
.act-label { font-size: 26rpx; font-weight: 700; color: $by-text-1; }
.act-reward { font-size: 22rpx; color: $by-gold-soft; }
.ai-1 { background: linear-gradient(135deg, color.change($by-info, $alpha: .22), color.change($by-aurora-a, $alpha: .18)); }
.ai-2 { background: linear-gradient(135deg, color.change($by-gold, $alpha: .22), color.change($by-gold-deep, $alpha: .12)); }
.ai-3 { background: linear-gradient(135deg, color.change($by-aurora-b, $alpha: .22), color.change($by-aurora-a, $alpha: .14)); }
.ai-4 { background: linear-gradient(135deg, color.change($by-success, $alpha: .22), color.change($by-info, $alpha: .12)); }

.rain-row { display: flex; align-items: center; gap: 20rpx; }
.rain-icon { font-size: 60rpx; }
.rain-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.rain-next { font-size: 28rpx; font-weight: 700; color: $by-text-1; }
.rain-desc { font-size: 22rpx; color: $by-text-3; }
.rain-btn { flex-shrink: 0; padding: 14rpx 24rpx !important; font-size: 24rpx !important; }

/* ==== 公共 ==== */
.state-wrap { padding: 80rpx 0; text-align: center; }
.state-text { color: $by-text-3; font-size: 26rpx; }
.empty { padding: 80rpx 32rpx; display: flex; flex-direction: column; align-items: center; gap: 16rpx; text-align: center; }
.empty-emoji { font-size: 80rpx; }
.empty-text { color: $by-text-3; font-size: 26rpx; }
.empty-hint { color: $by-text-muted; font-size: 24rpx; }
.empty-actions { display: flex; gap: 16rpx; margin-top: 8rpx; flex-wrap: wrap; justify-content: center; }
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
</style>
