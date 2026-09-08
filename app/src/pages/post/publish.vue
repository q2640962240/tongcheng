<template>
  <view class="page-publish">
    <view class="form-block">
      <textarea
        class="by-textarea"
        v-model="text"
        placeholder="这一刻，你想分享什么？（最多 500 字）"
        placeholder-class="placeholder"
        maxlength="500"
        auto-height
      />
      <view class="count">{{ text.length }}/500</view>
    </view>

    <view class="form-block">
      <view class="label">图片（最多 9 张）</view>
      <view class="img-grid">
        <view v-for="(img, i) in images" :key="i" class="img-cell">
          <image :src="img" mode="aspectFill" class="img" />
          <view class="img-del" @click="removeImage(i)">×</view>
        </view>
        <view v-if="images.length < 9" class="img-add" @click="chooseImage">
          <text class="plus">+</text>
          <text class="hint">添加图片</text>
        </view>
      </view>
    </view>

    <view class="form-block">
      <view class="label">位置</view>
      <picker mode="selector" :range="cityList" @change="onCity">
        <view class="by-picker">📍 {{ city }} ▾</view>
      </picker>
    </view>

    <view class="form-block tips">
      <view>· 请遵守平台规范，禁止发布违规/广告内容</view>
      <view>· 动态发布后将进行审核，违规内容将被删除</view>
    </view>

    <view class="submit-bar">
      <button class="by-btn-gold" :disabled="!canSubmit" @click="onSubmit">
        发 表 动 态
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { postApi, uploadApi } from '@/api/index.js';
import { useUserStore } from '@/store/user.js';
import { requireElite } from '@/utils/fallback.js';
const userStore = useUserStore();

const text = ref('');
const images = ref([]);
const submitting = ref(false);
const cityList = ['深圳', '北京', '上海', '广州', '成都', '杭州', '武汉', '重庆'];
const city = ref('深圳');

const canSubmit = computed(() => (text.value.trim().length > 0 || images.value.length > 0) && !submitting.value);

function onCity(e) { city.value = cityList[e.detail.value]; }
function chooseImage() {
  uni.chooseImage({
    count: 9 - images.value.length,
    success: (res) => { images.value = images.value.concat(res.tempFilePaths); },
  });
}
function removeImage(i) { images.value.splice(i, 1); }
async function onSubmit() {
  if (submitting.value) return;
  if (!requireElite()) return;
  submitting.value = true;
  uni.showLoading({ title: '发布中' });
  try {
    // A1: 先上传图片，拿到 URL 列表
    let uploadedUrls = [];
    if (images.value.length > 0) {
      const uploadRes = await uploadApi.files(images.value);
      const arr = Array.isArray(uploadRes) ? uploadRes : (uploadRes && uploadRes.data ? uploadRes.data : []);
      uploadedUrls = arr.map(f => (typeof f === 'string' ? f : (f && f.url) || ''));
      if (uploadedUrls.some(u => !u)) {
        throw new Error('部分图片上传失败');
      }
    }
    await postApi.create({
      text: text.value.trim(),
      images: uploadedUrls,
      location: { city: city.value },
    });
    uni.hideLoading();
    uni.showToast({ title: '发布成功，审核后展示', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 800);
  } catch (e) {
    uni.hideLoading();
    const msg = (e && e.data && e.data.message) || (e && e.message) || '发布失败';
    uni.showToast({ title: msg.length > 12 ? msg.slice(0, 12) + '...' : msg, icon: 'none' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page-publish { min-height: 100vh; background: $by-bg; padding: 24rpx; padding-bottom: 200rpx; color: $by-text-1; }
.form-block {
  background: $by-surface; border-radius: 20rpx; padding: 28rpx; margin-bottom: 24rpx;
}
.by-textarea {
  width: 100%; min-height: 260rpx; font-size: 30rpx; line-height: 1.6; color: $by-text-1;
}
.placeholder { color: $by-text-muted; }
.count { text-align: right; color: $by-text-muted; font-size: 24rpx; margin-top: 8rpx; }
.label { font-size: 28rpx; color: $by-text-2; margin-bottom: 20rpx; }
.img-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16rpx;
}
.img-cell { position: relative; width: 100%; padding-top: 100%; }
.img { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 16rpx; }
.img-del {
  position: absolute; top: -10rpx; right: -10rpx; width: 40rpx; height: 40rpx;
  background: rgba(239,68,68,.95); color: #fff; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 30rpx; line-height: 1;
}
.img-add {
  width: 100%; padding-top: 100%; position: relative;
  background: $by-bg-soft; border-radius: 16rpx;
  border: 2rpx dashed rgba(212,175,55,.4);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  .plus { position: absolute; top: 30%; left: 50%; transform: translateX(-50%); font-size: 60rpx; color: $by-gold; }
  .hint { position: absolute; bottom: 22%; left: 0; right: 0; text-align: center; font-size: 22rpx; color: $by-text-muted; }
}
.by-picker {
  padding: 20rpx 24rpx; background: $by-bg-soft; border-radius: 16rpx;
  color: $by-text-1; font-size: 28rpx;
}
.tips { font-size: 24rpx; color: $by-text-muted; line-height: 1.8; }
.submit-bar {
  position: fixed; left: 0; right: 0; bottom: 0; padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, transparent, $by-bg 20%);
}
.by-btn-gold {
  background: linear-gradient(135deg, $by-gold-soft 0%, $by-gold 100%);
  color: #1a1200 !important; font-weight: 700; border-radius: 999rpx; border: none;
  font-size: 32rpx; letter-spacing: 4rpx;
  &[disabled] { opacity: .5; }
}
</style>
