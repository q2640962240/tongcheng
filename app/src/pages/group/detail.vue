<template>
  <view class="page-group">
    <!-- 顶部大图 -->
    <view class="hero">
      <view class="hero__cover">
        <view class="hero__mask" />
        <view class="hero__title">{{ group.title || '三亚 7 日游 · 等你同行' }}</view>
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
          <text class="row__value">{{ group.category || '旅行 · 三亚' }}</text>
        </view>
        <view class="row">
          <text class="row__label">⏰ 活动时间</text>
          <text class="row__value">{{ group.activityAt || '2026-09-30 出发（7 天）' }}</text>
        </view>
        <view class="row">
          <text class="row__label">📍 集合城市</text>
          <text class="row__value">{{ group.city || '深圳 · 宝安机场' }}</text>
        </view>
        <view class="row">
          <text class="row__label">👥 期望人数</text>
          <text class="row__value">{{ group.joinCount || 3 }} / {{ group.expectMax || 8 }} 人（还缺 {{ (group.expectMax||8) - (group.joinCount||3) }} 位）</text>
        </view>
        <view class="progress">
          <view class="progress__fill" :style="{ width: ((group.joinCount||3)/(group.expectMax||8)*100)+'%' }" />
        </view>
      </view>

      <!-- 描述 -->
      <view class="card">
        <view class="card__title">组局详情</view>
        <view class="desc">
          {{ group.description || '三亚 7 日 6 晚自由行，行程已排好：蜈支洲岛潜水 + 后海冲浪 + 亚特兰蒂斯水世界 + 海鲜夜市。男女不限，AA 制，预计人均 4500。发起人：小葵（白夜精英，真人已认证）。' }}
        </view>
      </view>

      <!-- 报名列表 -->
      <view class="card">
        <view class="card__title">已报名 · {{ joins.length }} 人</view>
        <view class="avatars">
          <view v-for="u in joins" :key="u.id" class="avatar-wrap">
            <view class="avatar" :style="{ background: u.color }">{{ u.n[0] }}</view>
            <view class="avatar-name">{{ u.n }}</view>
          </view>
        </view>
      </view>

      <view style="height: 200rpx" />
    </view>

    <!-- 底部操作条 -->
    <view class="bottom-bar">
      <button class="by-btn-outline" size="mini" @click="contactHost">联系发起人</button>
      <button class="by-btn-gold" @click="onJoin">{{ joined ? '已报名·等待确认' : '报名进群' }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { groupApi } from '@/api/index.js';
import { useUserStore } from '@/store/user.js';
const userStore = useUserStore();

const COLORS = [
  'linear-gradient(135deg,#7B61FF,#B57BFF)',
  'linear-gradient(135deg,#D4AF37,#F5D583)',
  'linear-gradient(135deg,#4FB8FF,#7B61FF)',
  'linear-gradient(135deg,#22C55E,#4FB8FF)',
  'linear-gradient(135deg,#EF4444,#F59E0B)',
  'linear-gradient(135deg,#EC4899,#8B5CF6)',
];

const group = reactive({
  id: '',
  title: '三亚 7 日游 · 等你同行',
  tags: ['三亚', '海岛', 'AA制', '精英优先'],
  category: '旅行 · 三亚7日',
  activityAt: '2026-09-30 出发',
  city: '深圳 · 宝安机场集合',
  expectMax: 8,
  expectMin: 2,
  joinCount: 0,
  description: '',
  userId: '',
  status: 'open',
  hot: true,
});
const joins = ref([]);
const joined = ref(false);

function getGroupId() {
  try {
    const pages = getCurrentPages();
    const cur = pages && pages[pages.length - 1];
    if (!cur) return '';
    const opt = (cur.options) || (cur.$page && cur.$page.options) || {};
    return opt.id || '';
  } catch { return ''; }
}

onMounted(async () => {
  const gid = getGroupId();
  group.id = gid;
  try {
    if (gid) {
      const gd = await groupApi.detail(gid).catch(() => null);
      if (gd && gd.data) {
        const g = gd.data;
        Object.assign(group, {
          id: g.id || gid,
          title: g.title || group.title,
          tags: Array.isArray(g.tags) ? g.tags : group.tags,
          category: g.category || group.category,
          activityAt: g.activityAt || group.activityAt,
          city: g.city || group.city,
          expectMax: g.expectMax || group.expectMax,
          expectMin: g.expectMin || 2,
          joinCount: g.joinCount || 0,
          description: g.description || '',
          userId: g.userId || '',
          status: g.status || 'open',
          hot: !!g.hot,
        });
      }
      const jn = await groupApi.joins(gid).catch(() => ({ data: [] }));
      if (jn && Array.isArray(jn.data)) {
        joins.value = jn.data.map((u, i) => {
          const nickname = u.nickname || u.name || u.userName || ('用户' + (i + 1));
          return {
            id: u.id || u.userId || ('j' + i),
            n: nickname,
            color: COLORS[i % COLORS.length],
            status: u.status || 'pending',
          };
        });
        group.joinCount = joins.value.length || group.joinCount;
        const myUid = (userStore.userInfo && userStore.userInfo.id) || userStore.userId;
        if (myUid && joins.value.some(x => String(x.id) === String(myUid) || x.n === '我')) {
          joined.value = true;
        }
      }
    }
    if (!joins.value.length) {
      joins.value = [
        { id: 1, n: '梓晴', color: COLORS[0], status: 'approved' },
        { id: 2, n: '小葵', color: COLORS[1], status: 'approved' },
        { id: 3, n: '夜航星', color: COLORS[2], status: 'approved' },
      ];
      group.joinCount = 3;
    }
  } catch (e) {
    console.warn('[groupDetail] load fail', e);
  }
});

function contactHost() {
  const hostId = group.userId || 'host_demo';
  uni.navigateTo({ url: '/pages/chat/chat?userId=' + hostId });
}
async function onJoin() {
  if (joined.value) return;
  if (group.status && group.status !== 'open') {
    uni.showToast({ title: '组局已关闭/已满', icon: 'none' });
    return;
  }
  if (!userStore.isLogin) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    setTimeout(() => uni.navigateTo({ url: '/pages/login/login' }), 600);
    return;
  }
  uni.showModal({
    title: '报名确认',
    content: '报名后发起人将看到你的资料，确认参加本次组局？',
    confirmColor: '#D4AF37',
    success: async (r) => {
      if (!r.confirm) return;
      uni.showLoading({ title: '报名中' });
      try {
        if (group.id) {
          await groupApi.join(group.id, '想一起参加');
        }
        joins.value.push({ id: Date.now(), n: '我', color: COLORS[3], status: 'pending' });
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
.hero {
  height: 560rpx; position: relative;
  background: linear-gradient(160deg, $by-aurora-purple 0%, $by-aurora-pink 45%, $by-gold 140%);
  &__cover { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 48rpx 32rpx; }
  &__mask { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(11,15,26,.85) 100%); }
  &__title { position: relative; font-size: 48rpx; font-weight: 800; color: #fff; letter-spacing: 1rpx; }
  &__meta { position: relative; margin-top: 20rpx; display: flex; gap: 16rpx; flex-wrap: wrap; }
  &__tag {
    padding: 8rpx 20rpx; border-radius: 999rpx;
    background: rgba(255,255,255,.18); color: #fff; font-size: 22rpx;
    backdrop-filter: blur(6px);
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
  border-bottom: 1rpx solid rgba(255,255,255,.04);
  &:last-child { border-bottom: none; }
  &__label { color: $by-text-2; font-size: 26rpx; }
  &__value { color: $by-text-1; font-size: 28rpx; text-align: right; max-width: 60%; }
}
.progress {
  margin-top: 16rpx; height: 12rpx; background: $by-bg-soft; border-radius: 999rpx; overflow: hidden;
  &__fill { height: 100%; background: linear-gradient(90deg, $by-gold-soft, $by-gold); border-radius: 999rpx; transition: all .3s; }
}
.desc { color: $by-text-2; font-size: 28rpx; line-height: 1.8; }
.avatars { display: flex; gap: 24rpx; flex-wrap: wrap; }
.avatar-wrap { display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.avatar {
  width: 96rpx; height: 96rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 32rpx;
  border: 3rpx solid rgba(212,175,55,.3);
}
.avatar-name { font-size: 22rpx; color: $by-text-muted; }

.bottom-bar {
  position: fixed; left: 0; right: 0; bottom: 0; padding: 20rpx 32rpx 32rpx;
  background: $by-bg-soft; display: flex; gap: 20rpx; align-items: center;
  border-top: 1rpx solid rgba(212,175,55,.1);
}
.by-btn-outline {
  flex: 0 0 200rpx; border: 2rpx solid $by-gold; color: $by-gold !important;
  border-radius: 999rpx; background: transparent !important; font-size: 26rpx;
}
.by-btn-gold {
  flex: 1;
  background: linear-gradient(135deg, $by-gold-soft 0%, $by-gold 100%);
  color: #1a1200 !important; font-weight: 700; border-radius: 999rpx; border: none;
  font-size: 30rpx;
}
</style>
