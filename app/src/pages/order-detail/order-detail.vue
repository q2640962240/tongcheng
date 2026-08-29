<template>
  <view class="page" v-if="order">
    <!-- 状态横幅 -->
    <view class="banner" :class="order.status">
      <text class="banner-status">{{ statusMap[order.status] || order.status }}</text>
      <text class="banner-desc">{{ statusDesc[order.status] || '' }}</text>
    </view>

    <!-- 服务信息 -->
    <view class="card">
      <text class="card-title">服务信息</text>
      <view class="service-row">
        <image v-if="order.service?.coverImage" class="cover" :src="order.service.coverImage" mode="aspectFill" />
        <view class="service-meta">
          <text class="service-title">{{ order.serviceTitle }}</text>
          <text class="service-price">{{ order.service?.price || 0 }} 星币 / {{ order.service?.priceUnit || '次' }}</text>
        </view>
      </view>
    </view>

    <!-- 交易对方 -->
    <view class="card">
      <text class="card-title">{{ isProvider ? '买家信息' : '服务者信息' }}</text>
      <view class="user-row">
        <image class="avatar" :src="counterpart.avatar || '/static/avatar-user.png'" mode="aspectFill" />
        <view class="user-meta">
          <view class="user-name-row">
            <text class="user-name">{{ counterpart.nickname || '-' }}</text>
            <text v-if="counterpart.isElite" class="elite-badge">精英</text>
          </view>
          <text class="user-action" @tap="onChat">💬 发消息</text>
        </view>
      </view>
    </view>

    <!-- 订单详情 -->
    <view class="card">
      <text class="card-title">订单详情</text>
      <view class="detail-row">
        <text class="d-label">订单号</text>
        <text class="d-value">{{ order.orderNo }}</text>
      </view>
      <view class="detail-row">
        <text class="d-label">数量</text>
        <text class="d-value">x{{ order.quantity }}</text>
      </view>
      <view class="detail-row">
        <text class="d-label">金额</text>
        <text class="d-value amount">{{ order.amount }} 星币</text>
      </view>
      <view class="detail-row">
        <text class="d-label">支付方式</text>
        <text class="d-value">{{ payMethodMap[order.payMethod] || '-' }}</text>
      </view>
      <view class="detail-row">
        <text class="d-label">下单时间</text>
        <text class="d-value">{{ formatDateTime(order.createdAt) }}</text>
      </view>
      <view v-if="order.paidAt" class="detail-row">
        <text class="d-label">支付时间</text>
        <text class="d-value">{{ formatDateTime(order.paidAt) }}</text>
      </view>
      <view v-if="order.completedAt" class="detail-row">
        <text class="d-label">完成时间</text>
        <text class="d-value">{{ formatDateTime(order.completedAt) }}</text>
      </view>
      <view v-if="order.remark" class="detail-row">
        <text class="d-label">备注</text>
        <text class="d-value">{{ order.remark }}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="actions" v-if="hasActions">
      <view v-if="order.status === 'pending' && !isProvider" class="act-btn primary" @tap="onPay">立即支付</view>
      <view v-if="order.status === 'paid' && isProvider" class="act-btn primary" @tap="onStart">开始服务</view>
      <view v-if="order.status === 'serving' && isProvider" class="act-btn primary" @tap="onConfirm">完成服务</view>
      <view v-if="order.status === 'completed' && !isProvider" class="act-btn primary" @tap="onReview">{{ hasReviewed ? '查看评价' : '写评价' }}</view>
      <view v-if="['pending', 'paid'].includes(order.status) && !isProvider" class="act-btn ghost" @tap="onCancel">取消订单</view>
      <view v-if="order.status === 'refunding'" class="act-btn ghost" @tap="onContactService">联系客服</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { orderApi } from '../../api'
import { useUserStore } from '../../store/user'
import { formatDateTime } from '../../utils/format'
import { get } from '../../utils/request'

const userStore = useUserStore()
const order = ref(null)
const hasReviewed = ref(false)

const statusMap = {
  pending: '待支付', paid: '已支付', serving: '服务中',
  completed: '已完成', cancelled: '已取消', refunding: '退款中', refunded: '已退款'
}
const statusDesc = {
  pending: '请尽快完成支付',
  paid: '等待服务者开始服务',
  serving: '服务进行中',
  completed: '订单已完成，期待你的评价',
  cancelled: '订单已取消',
  refunding: '退款处理中，请耐心等待',
  refunded: '退款已完成'
}
const payMethodMap = { star_coin: '星币支付', wechat: '微信支付', alipay: '支付宝' }

const isProvider = computed(() => order.value?.providerId === userStore.userId)
const counterpart = computed(() => {
  if (!order.value) return {}
  return isProvider.value ? order.value.user : order.value.provider
})
const hasActions = computed(() => {
  const s = order.value?.status
  if (!s) return false
  if (s === 'pending' && !isProvider.value) return true
  if (s === 'paid' && isProvider.value) return true
  if (s === 'serving' && isProvider.value) return true
  if (s === 'completed' && !isProvider.value) return true
  if (['pending', 'paid'].includes(s) && !isProvider.value) return true
  if (s === 'refunding') return true
  return false
})

const loadOrder = async (id) => {
  try {
    const res = await orderApi.detail(id)
    order.value = res.data
    // 查询是否已评价
    if (order.value.status === 'completed' && !isProvider.value) {
      try {
        const rv = await orderApi.getReview(id)
        hasReviewed.value = !!rv.data
      } catch (e) {}
    }
  } catch (e) {}
}

const onReview = () => {
  uni.navigateTo({ url: `/pages/review/review?orderId=${order.value.id}` })
}

const onPay = async () => {
  try {
    await orderApi.pay(order.value.id)
    uni.showToast({ title: '支付成功', icon: 'success' })
    loadOrder(order.value.id)
  } catch (e) {}
}

const onStart = async () => {
  try {
    await orderApi.start(order.value.id)
    uni.showToast({ title: '已开始服务', icon: 'success' })
    loadOrder(order.value.id)
  } catch (e) {}
}

const onConfirm = () => {
  uni.showModal({
    title: '确认完成', content: '确认已完成该订单服务？完成后将结算收入。',
    success: async (res) => {
      if (res.confirm) {
        try {
          await orderApi.confirm(order.value.id)
          uni.showToast({ title: '订单已完成', icon: 'success' })
          loadOrder(order.value.id)
        } catch (e) {}
      }
    }
  })
}

const onCancel = () => {
  uni.showModal({
    title: '取消订单', content: '确认取消？已支付订单将退还星币',
    success: async (res) => {
      if (res.confirm) {
        try {
          await orderApi.cancel(order.value.id)
          uni.showToast({ title: '已取消', icon: 'success' })
          loadOrder(order.value.id)
        } catch (e) {}
      }
    }
  })
}

const onChat = () => {
  const otherId = isProvider.value ? order.value.userId : order.value.providerId
  uni.navigateTo({ url: `/pages/chat/chat?userId=${otherId}` })
}
const onContactService = async () => {
  try {
    const res = await get('/user/kefu')
    const wechat = res.data && res.data.wechat
    if (wechat) {
      uni.showModal({
        title: '联系客服',
        content: `客服微信号：${wechat}\n点击确定复制微信号`,
        confirmText: '复制',
        success: (r) => {
          if (r.confirm) {
            uni.setClipboardData({
              data: wechat,
              success: () => uni.showToast({ title: '微信号已复制', icon: 'success' })
            })
          }
        }
      })
    } else {
      uni.showModal({
        title: '联系客服',
        content: '暂未配置客服微信，请通过「意见反馈」联系我们',
        showCancel: false,
        confirmText: '去反馈',
        success: () => uni.navigateTo({ url: '/pages/feedback/feedback' })
      })
    }
  } catch (e) {
    uni.showToast({ title: '获取客服信息失败', icon: 'none' })
  }
}

onLoad((q) => {
  if (q.id) loadOrder(q.id)
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fffbeb; padding: 32rpx; padding-bottom: 200rpx; }
.banner {
  background: linear-gradient(135deg, #ffd60a 0%, #ffcc00 100%); color: #171717;
  border-radius: 32rpx; padding: 40rpx 32rpx; margin-bottom: 24rpx;
  display: flex; flex-direction: column; gap: 8rpx;
}
.banner.refunding { background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); color: #ffffff; }
.banner.refunded, .banner.cancelled { background: linear-gradient(135deg, #737373 0%, #a3a3a3 100%); color: #ffffff; }
.banner-status { font-size: 40rpx; font-weight: 700; }
.banner-desc { font-size: 26rpx; opacity: 0.8; }
.card { background: #ffffff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 24rpx; }
.card-title { font-size: 30rpx; font-weight: 600; color: #171717; margin-bottom: 24rpx; display: block; }
.service-row { display: flex; gap: 20rpx; }
.cover { width: 120rpx; height: 120rpx; border-radius: 16rpx; background: #f5f5f5; }
.service-meta { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 12rpx; }
.service-title { font-size: 30rpx; font-weight: 600; color: #171717; }
.service-price { font-size: 26rpx; color: #ef4444; }
.user-row { display: flex; gap: 20rpx; align-items: center; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 9999rpx; background: #f5f5f5; }
.user-meta { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.user-name-row { display: flex; align-items: center; gap: 12rpx; }
.user-name { font-size: 30rpx; font-weight: 600; color: #171717; }
.elite-badge { background: #ffd60a; color: #171717; font-size: 20rpx; font-weight: 600; padding: 2rpx 12rpx; border-radius: 9999rpx; }
.user-action { font-size: 26rpx; color: #0ea5e9; align-self: flex-start; }
.detail-row { display: flex; justify-content: space-between; padding: 16rpx 0; border-bottom: 2rpx solid #fafafa; &:last-child { border-bottom: none; } }
.d-label { font-size: 28rpx; color: #737373; }
.d-value { font-size: 28rpx; color: #171717; }
.d-value.amount { font-weight: 700; color: #ef4444; }
.actions { position: fixed; left: 32rpx; right: 32rpx; bottom: 48rpx; display: flex; gap: 16rpx; }
.act-btn {
  flex: 1; height: 96rpx; border-radius: 9999rpx; display: flex; align-items: center; justify-content: center;
  font-size: 30rpx; font-weight: 600;
  &.primary { background: #ffd60a; color: #171717; }
  &.ghost { background: #ffffff; color: #525252; border: 2rpx solid #e5e5e5; }
  &:active { opacity: 0.85; }
}
</style>
