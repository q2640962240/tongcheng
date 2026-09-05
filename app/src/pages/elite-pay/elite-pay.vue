<template>
  <view class="page-elite">
    <!-- 顶部英雄区 -->
    <view class="hero">
      <view class="hero__crown">👑</view>
      <view class="hero__title">开通精英 · 终身会员</view>
      <view class="hero__sub">累计已有 {{ totalJoined }} 位用户加入</view>
      <view class="hero__badge"><text class="e">E</text> 白夜精英 · 专属 E 标</view>
    </view>

    <view class="wrap">
      <!-- 权益 6 项 -->
      <view class="section">
        <view class="section-title">🎁 6 项精英专属权益</view>
        <view class="rights-grid">
          <view v-for="r in rights" :key="r.t" class="right-card">
            <view class="right-card__icon">{{ r.icon }}</view>
            <view class="right-card__t">{{ r.t }}</view>
            <view class="right-card__d">{{ r.d }}</view>
          </view>
        </view>
      </view>

      <!-- 平台保障 -->
      <view class="section">
        <view class="section-title">🛡 平台三大保证</view>
        <view class="guarantee">
          <view v-for="g in guarantees" :key="g" class="guarantee__item">✓ {{ g }}</view>
        </view>
      </view>

      <!-- 为什么需要精英认证 -->
      <view class="section" @click="whyOpen = !whyOpen">
        <view class="section-title row-between">
          <text>💡 为什么需要精英认证？一定要看！</text>
          <text>{{ whyOpen ? '▲' : '▼' }}</text>
        </view>
        <view v-if="whyOpen" class="why-box">
          <text>1. 我们不是婚介平台，不赚差价。精英认证 30 元用于平台安全审核 + 真人认证成本。</text>
          <text>2. 认证门槛过滤掉 90% 的骚扰、机器人、广告账号，社区质量更好。</text>
          <text>3. 终身权益：后续所有新功能（语音房/匹配算法/VIP 标识）都不再额外收费。</text>
          <text>4. 7 天无理由退款：开通后联系客服可全额退（未使用联系 TA 权益的前提下）。</text>
        </view>
      </view>

      <view style="height: 220rpx" />
    </view>

    <!-- 底部支付栏 -->
    <view class="pay-bar">
      <view class="pay-bar__left">
        <text class="pay-bar__label">合计</text>
        <text class="pay-bar__price">¥{{ price }}<text class="pay-bar__unit"> / 终身</text></text>
      </view>
      <view class="pay-bar__btns">
        <view class="btn-ghost" @click="goBack">再逛逛</view>
        <button class="btn-pay" :disabled="paying" @click="onPay">
          {{ paying ? '开通中...' : '点击加入精英' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { eliteApi } from '@/api/index.js';
import { useUserStore } from '@/store/user.js';
const userStore = useUserStore();

const price = ref(30);
const totalJoined = ref(12876);
const paying = ref(false);
const whyOpen = ref(false);
const rights = ref([
  { icon: '💖', t: '聊天交友特权', d: '查看所有达人社交详情与联系方式' },
  { icon: '🔍', t: '寻人大厅发布', d: '在寻人大厅发布个人邀约信息，精准匹配' },
  { icon: '🎯', t: '兴趣交友赠10次', d: '每日额外 10 次"超级喜欢"匹配机会' },
  { icon: '💬', t: '聊天无限聊', d: '私聊无次数上限，每天 50 次联系 TA 额度' },
  { icon: '⚡', t: '快速邂逅', d: '资料/动态置顶曝光，优先推荐给同城异性' },
  { icon: '🏅', t: '专属 E 标', d: '头像 E 金标、极光渐变边框、真人已认证徽章' },
]);
const guarantees = ['开通即时生效，无需审核', '100% 真人保障', '机器人/冒充全额退款'];

onMounted(async () => {
  try {
    const r = await eliteApi.rights();
    if (r && r.data) {
      if (typeof r.data.price === 'number') price.value = r.data.price;
      if (typeof r.data.totalJoined === 'number') totalJoined.value = r.data.totalJoined;
      if (Array.isArray(r.data.rights) && r.data.rights.length) {
        rights.value = r.data.rights.map(x => ({
          icon: x.icon || '✨',
          t: x.title || x.t || '',
          d: x.desc || x.d || '',
        }));
      }
    }
  } catch (e) { /* ignore, keep defaults */ }
});

function goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/home/home' }) }); }
async function onPay() {
  if (paying.value) return;
  if (!userStore.isLoggedIn) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    setTimeout(() => uni.navigateTo({ url: '/pages/login/login' }), 600);
    return;
  }
  paying.value = true;
  uni.showLoading({ title: '支付处理中' });
  try {
    try {
      await eliteApi.devPay();
    } catch (devErr) {
      await eliteApi.order('dev');
    }
    try { if (typeof userStore.fetchProfile === 'function') await userStore.fetchProfile(); } catch {}
    uni.hideLoading();
    paying.value = false;
    uni.showToast({ title: '已成功开通精英！', icon: 'success' });
    setTimeout(() => {
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
    }, 900);
  } catch (e) {
    uni.hideLoading();
    paying.value = false;
    const msg = (e && e.data && e.data.message) || (e && e.message) || '支付失败，请稍后重试';
    uni.showToast({ title: msg.length > 14 ? msg.slice(0, 14) + '...' : msg, icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.page-elite { min-height: 100vh; background: $by-bg; color: $by-text-1; padding-bottom: 200rpx; }
.hero {
  padding: 120rpx 32rpx 80rpx;
  background:
    radial-gradient(ellipse at top left, rgba(123,97,255,.35) 0%, transparent 55%),
    radial-gradient(ellipse at bottom right, rgba(212,175,55,.28) 0%, transparent 55%),
    linear-gradient(160deg, $by-night-bg 0%, $by-bg-soft 100%);
  text-align: center;
  border-bottom: 1rpx solid rgba(212,175,55,.15);
  &__crown { font-size: 80rpx; margin-bottom: 16rpx; }
  &__title { font-size: 44rpx; font-weight: 800; letter-spacing: 2rpx;
    background: linear-gradient(135deg, $by-gold-soft 0%, $by-gold 60%, $by-aurora-pink 120%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  &__sub { margin-top: 12rpx; color: $by-text-2; font-size: 24rpx; }
  &__badge {
    display: inline-flex; align-items: center; gap: 10rpx;
    margin-top: 24rpx; padding: 10rpx 24rpx;
    background: rgba(212,175,55,.12); color: $by-gold; font-size: 24rpx;
    border-radius: 999rpx; border: 1rpx solid rgba(212,175,55,.3);
    .e { font-weight: 800; background: $by-gold; color: #1a1200; width: 34rpx; height: 34rpx; line-height: 34rpx; border-radius: 8rpx; text-align: center; font-size: 24rpx; }
  }
}
.wrap { padding: 0 24rpx; margin-top: -30rpx; position: relative; }
.section {
  background: $by-surface; border-radius: 24rpx; padding: 28rpx; margin-bottom: 24rpx;
}
.section-title {
  font-size: 30rpx; font-weight: 700; color: $by-text-1; margin-bottom: 24rpx;
  &.row-between { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
}
.rights-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16rpx; }
.right-card {
  padding: 24rpx 20rpx; border-radius: 20rpx;
  background: linear-gradient(160deg, $by-bg-soft 0%, $by-bg 100%);
  border: 1rpx solid rgba(212,175,55,.12);
  &__icon { font-size: 44rpx; margin-bottom: 10rpx; }
  &__t { font-size: 28rpx; font-weight: 600; color: $by-gold; margin-bottom: 8rpx; }
  &__d { font-size: 22rpx; color: $by-text-muted; line-height: 1.5; }
}
.guarantee {
  display: flex; flex-direction: column; gap: 14rpx;
  &__item {
    padding: 18rpx 24rpx; border-radius: 16rpx;
    background: rgba(34,197,94,.08); color: $by-text-1; font-size: 26rpx;
    border: 1rpx solid rgba(34,197,94,.2);
  }
}
.why-box {
  display: flex; flex-direction: column; gap: 14rpx;
  text { color: $by-text-2; font-size: 26rpx; line-height: 1.7; }
}

.pay-bar {
  position: fixed; left: 0; right: 0; bottom: 0;
  padding: 20rpx 32rpx calc(32rpx + env(safe-area-inset-bottom)); background: $by-bg-soft;
  display: flex; justify-content: space-between; align-items: center;
  border-top: 1rpx solid rgba(212,175,55,.12);
  &__label { color: $by-text-muted; font-size: 24rpx; margin-right: 12rpx; }
  &__price {
    color: $by-gold; font-weight: 800; font-size: 44rpx;
  }
  &__unit { font-size: 22rpx; color: $by-text-muted; font-weight: 400; }
  &__btns { display: flex; align-items: center; gap: 16rpx; }
}
.btn-ghost {
  padding: 18rpx 28rpx; border-radius: 999rpx;
  border: 1rpx solid rgba(126,136,170,.4); color: $by-text-2; font-size: 26rpx;
}
.btn-pay {
  padding: 22rpx 40rpx; border-radius: 999rpx; border: none; color: #1a1200 !important;
  background: linear-gradient(135deg, $by-gold-soft 0%, $by-gold 100%);
  font-weight: 800; font-size: 28rpx; letter-spacing: 2rpx;
  box-shadow: 0 10rpx 30rpx rgba(212,175,55,.35);
  &[disabled] { opacity: .6; }
}
</style>
