<template>
  <view class="page-group">
    <!-- 组局不存在 / 加载失败 -->
    <view v-if="loadFailed" class="state-wrap">
      <text class="state-emoji">🫧</text>
      <text class="state-text">组局不存在或已删除</text>
      <view class="state-actions">
        <view class="btn-ghost" @click="goBack">返回</view>
        <view class="btn-gold" @click="goDiscover">看看其他组局</view>
      </view>
    </view>

    <view v-else-if="!group.id" class="state-wrap">
      <text class="state-text">加载中…</text>
    </view>

    <template v-else>
      <!-- 顶部大图 -->
      <view class="hero">
        <view class="hero__cover">
          <view class="hero__mask" />
          <view class="hero__title">{{ group.title }}</view>
          <view class="hero__meta">
            <view v-for="tag in group.tags" :key="tag" class="hero__tag">#{{ tag }}</view>
          </view>
        </view>
      </view>

      <view class="container">
        <!-- 信息卡 -->
        <view class="card">
          <view class="row">
            <text class="row__label">🎯 活动类型</text>
            <text class="row__value">{{ categoryLabel }}</text>
          </view>
          <view class="row">
            <text class="row__label">⏰ 活动时间</text>
            <text class="row__value">{{ activityText }}</text>
          </view>
          <view class="row">
            <text class="row__label">📍 集合城市</text>
            <text class="row__value">{{ group.city || '未填写' }}</text>
          </view>
          <view class="row">
            <text class="row__label">👥 期望人数</text>
            <text class="row__value">{{ peopleText }}</text>
          </view>
          <view class="progress">
            <view class="progress__fill" :style="{ width: progressPct + '%' }" />
          </view>
        </view>

        <!-- 描述 -->
        <view class="card" v-if="group.description">
          <view class="card__title">组局详情</view>
          <view class="desc">{{ group.description }}</view>
        </view>

        <!-- 报名列表 -->
        <view class="card">
          <view class="card__title">已报名 · {{ joins.length }} 人</view>
          <view v-if="joins.length" class="avatars">
            <view v-for="u in joins" :key="u.id" class="avatar-wrap">
              <view class="avatar" :style="{ background: u.color }">{{ u.n[0] }}</view>
              <view class="avatar-name">{{ u.n }}</view>
            </view>
          </view>
          <view v-else class="joins-empty">还没有人报名，来做第一个吧</view>
        </view>

        <view style="height: 200rpx" />
      </view>

      <!-- 底部操作条 -->
      <view class="bottom-bar">
        <button class="by-btn-outline" size="mini" @click="contactHost">联系发起人</button>
        <button class="by-btn-gold" @click="onJoin">{{ joined ? '已报名·等待确认' : '报名进群' }}</button>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { groupApi } from '@/api/index.js';
import { useUserStore } from '@/store/user.js';
import { requireElite } from '@/utils/fallback.js';
const userStore = useUserStore();

const COLORS = [
  'linear-gradient(135deg,#7B61FF,#B57BFF)',
  'linear-gradient(135deg,#D4AF37,#F5D583)',
  'linear-gradient(135deg,#4FB8FF,#7B61FF)',
  'linear-gradient(135deg,#22C55E,#4FB8FF)',
  'linear-gradient(135deg,#EF4444,#F59E0B)',
  'linear-gradient(135deg,#EC4899,#8B5CF6)',
];

const CAT_LABELS = {
  game: '游戏 / 剧本杀', escape: '密室', movie: '电影',
  dinner: '饭局', ride: '夜骑', travel: '旅行',
};

const group = reactive({
  id: '',
  title: '',
  tags: [],
  category: '',
  activityAt: null,
  city: '',
  expectMax: 0,
  expectMin: 0,
  joinCount: 0,
  description: '',
  userId: '',
  status: 'open',
  hot: false,
});
const joins = ref([]);
const joined = ref(false);
const loadFailed = ref(false);

const categoryLabel = computed(() => CAT_LABELS[group.category] || group.category || '未分类');
const activityText = computed(() => {
  if (!group.activityAt) return '时间待定';
  const d = new Date(group.activityAt);
  if (Number.isNaN(d.getTime())) return '时间待定';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
});
const peopleText = computed(() => {
  const max = Number(group.expectMax) || 0;
  const cur = Number(group.joinCount) || 0;
  if (!max) return `${cur} 人`;
  const lack = Math.max(0, max - cur);
  return `${cur} / ${max} 人${lack > 0 ? `（还缺 ${lack} 位）` : '（已满）'}`;
});
const progressPct = computed(() => {
  const max = Number(group.expectMax) || 0;
  if (!max) return 0;
  return Math.min(100, Math.round(((Number(group.joinCount) || 0) / max) * 100));
});

function getQuery() {
  try {
    const pages = getCurrentPages();
    const cur = pages && pages[pages.length - 1];
    if (!cur) return {};
    return (cur.options) || (cur.$page && cur.$page.options) || {};
  } catch { return {}; }
}

function goBack() {
  const pages = getCurrentPages();
  if (pages && pages.length > 1) uni.navigateBack();
  else goDiscover();
}
function goDiscover() {
  uni.switchTab({
    url: '/pages/discover/discover',
    fail: () => uni.reLaunch({ url: '/pages/discover/discover' }),
  });
}

onMounted(async () => {
  const opt = getQuery();
  const gid = opt.id || '';
  // 动态详情已迁到 /pages/post/detail，旧链接（含缓存/分享出去的 mode=post）在这里纠正
  if (String(opt.mode || '') === 'post' && gid) {
    uni.redirectTo({ url: `/pages/post/detail?id=${gid}` });
    return;
  }
  if (!gid) { loadFailed.value = true; return; }
  group.id = gid;
  try {
    const gd = await groupApi.detail(gid).catch(() => null);
    const g = gd && gd.data;
    if (!g || !g.id) { loadFailed.value = true; group.id = ''; return; }
    Object.assign(group, {
      id: g.id,
      title: g.title || '',
      tags: Array.isArray(g.tags) ? g.tags : [],
      category: g.category || '',
      activityAt: g.activityAt || null,
      city: g.city || '',
      expectMax: Number(g.expectMax) || 0,
      expectMin: Number(g.expectMin) || 0,
      joinCount: Number(g.joinCount) || 0,
      description: g.description || '',
      userId: g.userId || '',
      status: g.status || 'open',
      hot: !!g.hot,
    });
    // A4: 从 detail 返回的 g.joins 读取，不再单独调 groupApi.joins()
    const joinArr = Array.isArray(g.joins) ? g.joins : [];
    joins.value = joinArr.map((j, i) => {
      const u = j.user || {};
      const nickname = u.nickname || u.name || ('用户' + (i + 1));
      return {
        id: u.id || j.userId || ('j' + i),
        n: nickname,
        avatar: u.avatar || '',
        color: COLORS[i % COLORS.length],
        status: j.status || 'pending',
      };
    });
    group.joinCount = joinArr.length || group.joinCount;
    const myUid = (userStore.userInfo && userStore.userInfo.id) || userStore.userId;
    // x.id 是映射时存的 u.id || j.userId（用户 id），直接比 myUid
    if (myUid && joinArr.some(x => String(x.id) === String(myUid) && (x.status === 'approved' || x.status === 'pending'))) {
      joined.value = true;
    }
  } catch (e) {
    console.warn('[groupDetail] load fail', e);
    loadFailed.value = true;
    group.id = '';
  }
});

function contactHost() {
  if (!requireElite()) return;
  if (!group.userId) {
    uni.showToast({ title: '发起人信息缺失', icon: 'none' });
    return;
  }
  uni.navigateTo({ url: '/pages/chat/chat?userId=' + group.userId });
}
async function onJoin() {
  if (joined.value) return;
  if (group.status && group.status !== 'open') {
    uni.showToast({ title: '组局已关闭/已满', icon: 'none' });
    return;
  }
  if (!requireElite()) return;
  uni.showModal({
    title: '报名确认',
    content: '报名后发起人将看到你的资料，确认参加本次组局？',
    confirmColor: '#D4AF37',
    success: async (r) => {
      if (!r.confirm) return;
      uni.showLoading({ title: '报名中' });
      try {
        await groupApi.join(group.id, '想一起参加');
        joins.value.push({ id: 'me-' + Date.now(), n: '我', color: COLORS[3], status: 'pending' });
        joined.value = true;
        group.joinCount = joins.value.length;
        uni.hideLoading();
        uni.showToast({ title: '报名成功，等待发起人确认', icon: 'none' });
      } catch (e) {
        uni.hideLoading();
        const msg = (e && e.data && e.data.message) || (e && e.message) || '报名失败';
        uni.showToast({ title: msg.length > 14 ? msg.slice(0, 14) + '...' : msg, icon: 'none' });
      }
    },
  });
}
</script>

<style lang="scss" scoped>
.page-group { min-height: 100vh; background: $by-bg; color: $by-text-1; padding-bottom: 180rpx; }

.state-wrap {
  min-height: 70vh; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 20rpx; padding: 0 48rpx;
}
.state-emoji { font-size: 88rpx; }
.state-text { font-size: 28rpx; color: $by-text-3; }
.state-actions { display: flex; gap: 20rpx; margin-top: 20rpx; }
.btn-ghost {
  padding: 18rpx 44rpx; border-radius: 999rpx; font-size: 26rpx;
  border: 2rpx solid $by-border; color: $by-text-2;
}
.btn-gold {
  padding: 18rpx 44rpx; border-radius: 999rpx; font-size: 26rpx; font-weight: 700;
  background: $by-gradient-gold; color: $by-bg;
}

.hero {
  height: 560rpx; position: relative;
  background: linear-gradient(160deg, $by-aurora-a 0%, $by-aurora-b 45%, $by-gold 140%);
  &__cover { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 48rpx 32rpx; }
  &__mask { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba($by-bg, .65) 100%); }
  &__title { position: relative; font-size: 48rpx; font-weight: 800; color: #fff; letter-spacing: 1rpx; }
  &__meta { position: relative; margin-top: 20rpx; display: flex; gap: 16rpx; flex-wrap: wrap; }
  &__tag {
    padding: 8rpx 20rpx; border-radius: 999rpx;
    background: rgba(255,255,255,.18); color: #fff; font-size: 22rpx;
  }
}
.container { padding: 0 24rpx; margin-top: -40rpx; position: relative; }
.card {
  background: $by-surface; border-radius: 24rpx; padding: 28rpx;
  margin-bottom: 24rpx;
  &__title { font-size: 30rpx; font-weight: 700; color: $by-gold; margin-bottom: 20rpx; }
}
.row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx solid $by-border;
  &:last-child { border-bottom: none; }
  &__label { color: $by-text-3; font-size: 26rpx; }
  &__value { color: $by-text-1; font-size: 28rpx; text-align: right; max-width: 60%; }
}
.progress {
  margin-top: 16rpx; height: 12rpx; background: $by-bg-soft; border-radius: 999rpx; overflow: hidden;
  &__fill { height: 100%; background: $by-gradient-gold; border-radius: 999rpx; transition: all .3s; }
}
.desc { color: $by-text-3; font-size: 28rpx; line-height: 1.8; white-space: pre-wrap; }
.avatars { display: flex; gap: 24rpx; flex-wrap: wrap; }
.avatar-wrap { display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.avatar {
  width: 96rpx; height: 96rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 32rpx;
  border: 3rpx solid rgba(212,160,23,.3);
}
.avatar-name { font-size: 22rpx; color: $by-text-3; }
.joins-empty { font-size: 26rpx; color: $by-text-3; padding: 12rpx 0; }

.bottom-bar {
  position: fixed; left: 0; right: 0; bottom: 0; padding: 20rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  background: $by-bg-soft; display: flex; gap: 20rpx; align-items: center;
  border-top: 1rpx solid $by-border;
}
.by-btn-outline {
  flex: 0 0 200rpx; border: 2rpx solid $by-gold; color: $by-gold !important;
  border-radius: 999rpx; background: transparent !important; font-size: 26rpx;
}
.by-btn-gold {
  flex: 1;
  background: $by-gradient-gold;
  color: $by-bg !important; font-weight: 700; border-radius: 999rpx; border: none;
  font-size: 30rpx;
}
</style>
