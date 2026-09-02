<template>
  <view class="page-publish">
    <view class="form-block">
      <view class="label">组局标题</view>
      <input
        class="by-input"
        v-model="title"
        placeholder="例如：周六晚剧本杀，来 3 个靠谱搭子"
        placeholder-class="placeholder"
        maxlength="30"
      />
      <view class="count">{{ title.length }}/30</view>
    </view>

    <view class="form-block">
      <view class="label">组局类型</view>
      <view class="cat-grid">
        <view
          v-for="(c, i) in cats"
          :key="c.label"
          class="cat-item"
          :class="{ active: catIdx === i }"
          @click="catIdx = i"
        >{{ c.icon }} {{ c.label }}</view>
      </view>
    </view>

    <view class="form-block">
      <view class="label">活动介绍</view>
      <textarea
        class="by-textarea"
        v-model="description"
        placeholder="介绍一下玩法、地点、费用、要求等（最多 300 字）"
        placeholder-class="placeholder"
        maxlength="300"
        auto-height
      />
    </view>

    <view class="form-block">
      <view class="row">
        <view class="cell">
          <view class="label">城市</view>
          <picker mode="selector" :range="cityList" @change="onCity">
            <view class="by-picker">📍 {{ city }} ▾</view>
          </picker>
        </view>
        <view class="cell">
          <view class="label">活动日期</view>
          <picker mode="date" :start="today" :value="date" @change="onDate">
            <view class="by-picker">📅 {{ date || '请选择' }} ▾</view>
          </picker>
        </view>
      </view>
      <view class="row">
        <view class="cell">
          <view class="label">开始时间</view>
          <picker mode="time" :value="time" @change="onTime">
            <view class="by-picker">🕗 {{ time || '请选择' }} ▾</view>
          </picker>
        </view>
        <view class="cell">
          <view class="label">人数（最少 ~ 最多）</view>
          <view class="num-row">
            <view class="stepper">
              <view class="step-btn" @click="expectMin = Math.max(2, expectMin - 1)">−</view>
              <view class="step-val">{{ expectMin }}</view>
              <view class="step-btn" @click="expectMin = Math.min(expectMax, expectMin + 1)">＋</view>
            </view>
            <text class="tilde">~</text>
            <view class="stepper">
              <view class="step-btn" @click="expectMax = Math.max(expectMin, expectMax - 1)">−</view>
              <view class="step-val">{{ expectMax }}</view>
              <view class="step-btn" @click="expectMax = Math.min(20, expectMax + 1)">＋</view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="form-block">
      <view class="label">标签（空格或逗号分隔，最多 4 个）</view>
      <input
        class="by-input"
        v-model="tagsText"
        placeholder="例如：新手友好 不鸽 可拼车"
        placeholder-class="placeholder"
        maxlength="60"
      />
    </view>

    <view class="form-block tips">
      <view>· 组局信息请真实有效，恶意占坑将被限制发起组局</view>
      <view>· 线下见面请选择公共场所，注意人身与财产安全</view>
    </view>

    <view class="submit-bar">
      <button class="by-btn-gold" :disabled="!canSubmit || submitting" @click="onSubmit">
        发 起 组 局
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { groupApi } from '@/api/index.js';
import { useUserStore } from '@/store/user.js';

const userStore = useUserStore();

const cats = [
  { label: '剧本杀', icon: '🎭', code: 'game' },
  { label: '密室', icon: '🔐', code: 'escape' },
  { label: '电影', icon: '🎬', code: 'movie' },
  { label: '游戏', icon: '🎮', code: 'game' },
  { label: '饭局', icon: '🍲', code: 'dinner' },
  { label: '夜骑', icon: '🚴', code: 'ride' },
  { label: '旅行', icon: '🧳', code: 'travel' },
];
const catIdx = ref(0);

const cityList = ['深圳', '北京', '上海', '广州', '成都', '杭州', '武汉', '重庆'];
const city = ref('深圳');

const title = ref('');
const description = ref('');
const date = ref('');
const time = ref('');
const expectMin = ref(2);
const expectMax = ref(8);
const tagsText = ref('');
const submitting = ref(false);

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const canSubmit = computed(() => title.value.trim().length >= 2);

function onCity(e) { city.value = cityList[e.detail.value]; }
function onDate(e) { date.value = e.detail.value; }
function onTime(e) { time.value = e.detail.value; }

function parseTags(raw) {
  return String(raw || '')
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

async function onSubmit() {
  if (!userStore.isLoggedIn) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    setTimeout(() => uni.navigateTo({ url: '/pages/login/login' }), 600);
    return;
  }
  if (title.value.trim().length < 2) {
    uni.showToast({ title: '请填写组局标题', icon: 'none' });
    return;
  }
  submitting.value = true;
  uni.showLoading({ title: '发布中' });
  try {
    const activityAt = date.value ? new Date(`${date.value}T${time.value || '20:00'}:00`).toISOString() : null;
    await groupApi.create({
      title: title.value.trim(),
      description: description.value.trim(),
      tags: parseTags(tagsText.value),
      category: cats[catIdx.value].code,
      city: city.value,
      expectMin: expectMin.value,
      expectMax: expectMax.value,
      activityAt,
      location: { city: city.value },
    });
    try { uni.setStorageSync('group.dirty', 1); } catch (_) {}
    uni.hideLoading();
    uni.showToast({ title: '组局创建成功', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 800);
  } catch (e) {
    uni.hideLoading();
    const msg = (e && e.data && e.data.message) || (e && e.message) || '发起失败';
    uni.showToast({ title: msg.length > 12 ? msg.slice(0, 12) + '...' : msg, icon: 'none' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page-publish { min-height: 100vh; background: $by-bg; padding: 24rpx; padding-bottom: 200rpx; color: $by-text-1; }
.form-block { background: $by-surface; border-radius: 20rpx; padding: 28rpx; margin-bottom: 24rpx; }
.label { font-size: 28rpx; color: $by-text-3; margin-bottom: 20rpx; }
.by-input {
  width: 100%; height: 72rpx; padding: 0 20rpx; box-sizing: border-box;
  background: $by-bg; border-radius: 12rpx; font-size: 28rpx; color: $by-text-1;
}
.placeholder { color: $by-text-3; }
.count { text-align: right; color: $by-text-3; font-size: 24rpx; margin-top: 8rpx; }
.cat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16rpx; }
.cat-item {
  padding: 16rpx 0; text-align: center; font-size: 24rpx; color: $by-text-3;
  background: $by-bg; border-radius: 12rpx; border: 2rpx solid transparent;
  &.active { color: $by-gold; border-color: rgba(212,160,23,.6); background: rgba(212,160,23,.08); }
}
.by-textarea { width: 100%; min-height: 180rpx; font-size: 30rpx; line-height: 1.6; color: $by-text-1; }
.row { display: flex; gap: 24rpx; margin-bottom: 24rpx; &:last-child { margin-bottom: 0; } }
.cell { flex: 1; min-width: 0; }
.by-picker {
  padding: 16rpx 20rpx; background: $by-bg; border-radius: 12rpx;
  font-size: 26rpx; color: $by-text-1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.num-row { display: flex; align-items: center; gap: 12rpx; }
.stepper {
  display: flex; align-items: center; background: $by-bg; border-radius: 12rpx; overflow: hidden;
}
.step-btn {
  width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; color: $by-gold;
}
.step-val { width: 60rpx; text-align: center; font-size: 28rpx; color: $by-text-1; }
.tilde { color: $by-text-3; font-size: 26rpx; }
.tips { font-size: 24rpx; color: $by-text-3; line-height: 1.8; }
.submit-bar {
  position: fixed; left: 0; right: 0; bottom: 0; padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: $by-bg-soft; box-shadow: $by-shadow-2;
}
.by-btn-gold {
  width: 100%; height: 88rpx; line-height: 88rpx; border-radius: 44rpx; font-size: 30rpx;
  background: $by-gradient-gold; color: $by-bg; font-weight: 600; border: none;
  &[disabled] { opacity: .5; }
}
</style>
