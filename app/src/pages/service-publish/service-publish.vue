<template>
  <view class="page">
    <view class="header">
      <text class="back" @tap="onBack">‹</text>
      <text class="title">发布服务</text>
      <view class="placeholder"></view>
    </view>

    <view class="form">
      <!-- 分类 -->
      <view class="form-item">
        <text class="label">服务分类</text>
        <view class="cat-row">
          <view
            v-for="c in categories"
            :key="c.key"
            class="cat-chip"
            :class="{ on: form.category === c.key }"
            @tap="onCategory(c.key)"
          >{{ c.label }}</view>
        </view>
      </view>

      <!-- 子分类 -->
      <view class="form-item" v-if="subCategories.length">
        <text class="label">服务类型</text>
        <view class="cat-row">
          <view
            v-for="s in subCategories"
            :key="s.key"
            class="cat-chip"
            :class="{ on: form.subCategory === s.key }"
            @tap="form.subCategory = s.key"
          >{{ s.name }}</view>
        </view>
      </view>

      <!-- 标题 -->
      <view class="form-item">
        <text class="label">服务标题</text>
        <input
          v-model="form.title"
          class="input"
          placeholder="例：温柔陪玩，陪你度过每一个夜晚"
          maxlength="50"
        />
      </view>

      <!-- 封面图 -->
      <view class="form-item">
        <text class="label">封面图</text>
        <view class="cover-upload">
          <view v-if="form.coverImage" class="cover-preview">
            <image class="cover-img" :src="form.coverImage" mode="aspectFill" />
            <view class="cover-actions">
              <text class="cover-act" @tap="onChooseCover">更换</text>
              <text class="cover-act del" @tap="form.coverImage = ''">删除</text>
            </view>
          </view>
          <view v-else class="cover-add" @tap="onChooseCover">
            <text class="cover-add-icon">+</text>
            <text class="cover-add-text">{{ uploading ? '上传中...' : '上传封面' }}</text>
          </view>
        </view>
        <text class="cover-tip">建议尺寸 750×480，大小不超过 10MB</text>
      </view>

      <!-- 描述 -->
      <view class="form-item">
        <text class="label">服务描述</text>
        <textarea
          v-model="form.description"
          class="textarea"
          placeholder="详细介绍你的服务内容、风格、特色"
          maxlength="500"
        />
        <text class="counter">{{ (form.description || '').length }}/500</text>
      </view>

      <!-- 价格 -->
      <view class="form-item">
        <text class="label">价格（星币）</text>
        <view class="price-row">
          <input
            v-model.number="form.price"
            class="input price-input"
            type="number"
            placeholder="0"
          />
          <input
            v-model="form.priceUnit"
            class="input unit-input"
            placeholder="单位：次/局/首/20分钟"
            maxlength="20"
          />
        </view>
      </view>

      <!-- 时长 -->
      <view class="form-item">
        <text class="label">服务时长（分钟，选填）</text>
        <input
          v-model.number="form.duration"
          class="input"
          type="number"
          placeholder="例：20"
        />
      </view>

      <!-- 标签 -->
      <view class="form-item">
        <text class="label">标签（最多5个）</text>
        <view class="tags-input">
          <view class="tags-list">
            <view v-for="(t, i) in form.tags" :key="i" class="tag-item">
              <text>{{ t }}</text>
              <text class="tag-del" @tap="removeTag(i)">×</text>
            </view>
          </view>
          <input
            v-if="form.tags.length < 5"
            v-model="tagInput"
            class="input tag-input"
            placeholder="输入后回车"
            @confirm="onAddTag"
          />
        </view>
      </view>

      <!-- 提示 -->
      <view class="tips">
        <text class="tips-title">发布说明</text>
        <text class="tips-line">· 服务发布后将进入审核，1-3 个工作日内出结果</text>
        <text class="tips-line">· 严重违规内容将被永久下架，账号封禁</text>
        <text class="tips-line">· 价格、单位请如实填写，避免纠纷</text>
      </view>

      <!-- 提交 -->
      <view class="submit-btn" :class="{ disabled: !canSubmit }" @tap="onSubmit">
        {{ submitting ? '提交中...' : '提交发布' }}
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { serviceApi, uploadApi } from '../../api'

const categories = [
  { key: 'warm', label: '暖心服务' },
  { key: 'game', label: '游戏陪玩' },
  { key: 'offline', label: '线下约玩' }
]
const subCategoryMap = {
  warm: [
    { key: 'virtual-lover', name: '虚拟恋人' },
    { key: 'sing', name: '给你唱歌' },
    { key: 'sleep', name: '哄睡电台' },
    { key: 'wake', name: '叫醒服务' }
  ],
  game: [
    { key: 'wzry', name: '王者荣耀' },
    { key: 'hpjy', name: '和平精英' },
    { key: 'lol', name: '英雄联盟' },
    { key: 'other', name: '其他游戏' }
  ],
  offline: [
    { key: 'sport', name: '运动健身' },
    { key: 'date', name: '同城约会' },
    { key: 'offline-game', name: '线下开黑' }
  ]
}

const form = reactive({
  category: 'warm',
  subCategory: '',
  title: '',
  coverImage: '',
  description: '',
  price: null,
  priceUnit: '次',
  duration: null,
  tags: []
})
const tagInput = ref('')
const submitting = ref(false)
const uploading = ref(false)

const subCategories = computed(() => subCategoryMap[form.category] || [])
const canSubmit = computed(() => form.title && form.category && form.price != null && form.price >= 0)

const onCategory = (key) => {
  form.category = key
  form.subCategory = ''
}

const onChooseCover = () => {
  if (uploading.value) return
  uni.chooseImage({
    count: 1,
    success: async (res) => {
      uploading.value = true
      try {
        const result = await uploadApi.file(res.tempFilePaths[0])
        form.coverImage = result.url
        uni.showToast({ title: '封面已上传', icon: 'success' })
      } catch (e) {} finally {
        uploading.value = false
      }
    }
  })
}

const onAddTag = () => {
  const t = tagInput.value.trim()
  if (!t) return
  if (form.tags.length >= 5) {
    uni.showToast({ title: '最多 5 个标签', icon: 'none' })
    return
  }
  if (form.tags.includes(t)) {
    tagInput.value = ''
    return
  }
  form.tags.push(t)
  tagInput.value = ''
}

const removeTag = (i) => form.tags.splice(i, 1)

const onSubmit = async () => {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    await serviceApi.publish({
      ...form,
      price: Number(form.price) || 0,
      duration: form.duration ? Number(form.duration) : undefined
    })
    uni.showToast({ title: '发布成功，等待审核', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e) {} finally {
    submitting.value = false
  }
}

const onBack = () => uni.navigateBack()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; padding-bottom: 80rpx; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 32rpx; height: 88rpx; background: #ffffff;
  border-bottom: 2rpx solid #f5f5f5; position: sticky; top: 0; z-index: 10;
  padding-top: env(safe-area-inset-top);
}
.back { font-size: 48rpx; color: #171717; }
.title { font-size: 32rpx; font-weight: 700; }
.placeholder { width: 48rpx; }
.form { padding: 32rpx; }
.form-item { background: #ffffff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 16rpx; position: relative; }
.label { font-size: 28rpx; font-weight: 600; color: #171717; margin-bottom: 16rpx; display: block; }
.cat-row { display: flex; flex-wrap: wrap; gap: 16rpx; }
.cat-chip {
  padding: 12rpx 28rpx; border-radius: 9999rpx; background: #f5f5f5;
  font-size: 26rpx; color: #525252;
  &.on { background: #ffd60a; color: #171717; font-weight: 600; }
}
.input {
  width: 100%; height: 88rpx; background: #f5f5f5; border-radius: 16rpx;
  padding: 0 24rpx; font-size: 28rpx; color: #171717;
}
.textarea {
  width: 100%; min-height: 200rpx; background: #f5f5f5; border-radius: 16rpx;
  padding: 24rpx; font-size: 28rpx; color: #171717;
}
.counter { position: absolute; right: 28rpx; bottom: 16rpx; font-size: 22rpx; color: #a3a3a3; }
.cover-upload { margin-top: 8rpx; }
.cover-preview { position: relative; width: 100%; height: 360rpx; border-radius: 16rpx; overflow: hidden; }
.cover-img { width: 100%; height: 100%; }
.cover-actions { position: absolute; bottom: 0; left: 0; right: 0; display: flex; background: rgba(0,0,0,0.5); }
.cover-act { flex: 1; text-align: center; padding: 16rpx 0; font-size: 26rpx; color: #ffffff; }
.cover-act.del { color: #fca5a5; }
.cover-add {
  width: 100%; height: 240rpx; background: #f5f5f5; border-radius: 16rpx;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx;
  border: 4rpx dashed #d4d4d4;
}
.cover-add-icon { font-size: 56rpx; color: #a3a3a3; }
.cover-add-text { font-size: 24rpx; color: #a3a3a3; }
.cover-tip { display: block; font-size: 22rpx; color: #a3a3a3; margin-top: 12rpx; }
.price-row { display: flex; gap: 16rpx; }
.price-input { flex: 1; }
.unit-input { flex: 1; }
.tags-input { display: flex; flex-wrap: wrap; gap: 12rpx; align-items: center; }
.tags-list { display: contents; }
.tag-item {
  display: flex; align-items: center; gap: 8rpx; padding: 8rpx 16rpx;
  background: #fff9c4; color: #b45309; border-radius: 9999rpx; font-size: 24rpx;
}
.tag-del { font-size: 28rpx; color: #b45309; }
.tag-input { flex: 1; min-width: 200rpx; }
.tips { padding: 24rpx 0; display: flex; flex-direction: column; gap: 8rpx; }
.tips-title { font-size: 24rpx; font-weight: 600; color: #525252; }
.tips-line { font-size: 22rpx; color: #a3a3a3; line-height: 1.6; }
.submit-btn {
  height: 96rpx; background: #ffd60a; color: #171717;
  border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700; margin-top: 32rpx;
  &.disabled { background: #e5e5e5; color: #a3a3a3; }
  &:active { opacity: 0.85; }
}
</style>
