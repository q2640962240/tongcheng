<template>
  <z-paging
    ref="paging"
    v-model="list"
    class="page"
    :default-page-size="PAGE_SIZE"
    @query="queryList"
  >
    <!-- 类型筛选：#top 是 z-paging 的吸顶区，本身就在滚动容器之外，
         所以原来那套 position:sticky 可以删掉（也顺带消除了坑点 22 里 sticky 计入
         scrollable overflow 的那处隐患） -->
    <template #top>
      <scroll-view scroll-x class="type-bar">
        <view class="type-item" :class="{ on: type === '' }" @tap="switchType('')">全部</view>
        <view
          v-for="(label, val) in typeMap"
          :key="val"
          class="type-item"
          :class="{ on: type === val }"
          @tap="switchType(val)"
        >
          {{ label }}
        </view>
      </scroll-view>
    </template>

    <!-- 首屏骨架：z-paging 的 #loading 只在「第一页且还没数据」时出现 -->
    <template #loading>
      <view class="loading-wrap">
        <view class="loading-skeleton" v-for="i in 5" :key="i">
          <view class="sk-avatar"></view>
          <view class="sk-body">
            <view class="sk-line sk-line-sm"></view>
            <view class="sk-line sk-line-md"></view>
          </view>
          <view class="sk-amount"></view>
        </view>
      </view>
    </template>

    <view class="tx-list">
      <view v-for="t in list" :key="t.id" class="tx-item">
        <view class="tx-icon" :class="t.type">{{ typeIcon(t.type) }}</view>
        <view class="tx-info">
          <text class="tx-title">{{ getTypeLabel(t.type) }}</text>
          <text class="tx-remark" v-if="t.remark && t.remark !== '-'">{{ t.remark }}</text>
          <text class="tx-time">
            {{ formatTime(t.createdAt) }}
            <text v-if="t.orderNo" class="tx-order"> · 订单 {{ t.orderNo }}</text>
          </text>
        </view>
        <text class="tx-amount" :class="isIncome(t.type) ? 'in' : 'out'">
          {{ isIncome(t.type) ? '+' : '-' }}{{ formatCurrency(t) }}
        </text>
      </view>
    </view>

    <!-- 用了自定义 #empty 就等于顶掉 z-paging 内置的 empty-view（「加载失败，点击重试」
         那个载体），所以必须自己接住插槽作用域参数 isLoadFailed，否则网络失败时会谎报
         「暂无交易记录」 -->
    <template #empty="{ isLoadFailed }">
      <view class="empty" @tap="isLoadFailed && reload()">
        <view class="empty-aurora"></view>
        <text class="empty-icon">{{ isLoadFailed ? '⚠️' : '💰' }}</text>
        <text class="empty-text">{{ isLoadFailed ? '加载失败' : '暂无交易记录' }}</text>
        <text class="empty-sub">{{ isLoadFailed ? '点击重试' : '首次交易将在这里显示' }}</text>
      </view>
    </template>
  </z-paging>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { walletApi } from '../../api'
import {
  unwrapPage, safeMap, getPath, toStr, toNum,
  requireLogin, formatTime
} from '../../utils/fallback'

const PAGE_SIZE = 20

const paging = ref(null)
const list = ref([])
const type = ref('')

const typeMap = {
  recharge: '充值', exchange: '兑换', consume: '消费',
  income: '收入', withdraw: '提现', refund: '退款', reward: '奖励',
  gift_send: '送礼', gift_income: '礼物收入',
  gift_withdraw: '礼物提现', elite_pay: '精英开通', diamond_unlock_wechat: '解锁微信',
  admin_adjustment: '管理员调整'
}

const INCOME_TYPES = ['recharge', 'income', 'gift_income', 'refund', 'reward']

const getTypeLabel = (t) => toStr(typeMap[t], '其他交易')

const typeIcon = (t) => ({
  recharge: '💎', exchange: '⇄', consume: '🛒',
  income: '💼', withdraw: '🏧', refund: '↩️', reward: '🎁',
  gift_send: '🎁', gift_income: '💰',
  gift_withdraw: '🎁', elite_pay: '🌟', diamond_unlock_wechat: '🔓',
  admin_adjustment: '⚙️'
}[t] || '💰')

// 收入类（金额为正显示）
const isIncome = (t) => INCOME_TYPES.includes(toStr(t, ''))

// 全局统一：所有交易以钻石为单位显示（1钻石=1角=10分）
const formatCurrency = (t) => {
  const amt = toNum(getPath(t, 'amount'), 0)
  const currency = toStr(getPath(t, 'currency'), 'diamond')
  let diamondAmt
  if (currency === 'fen') {
    diamondAmt = Math.floor(Math.abs(amt) / 10) // 10分 = 1钻石
  } else {
    diamondAmt = Math.abs(amt) // diamond / starCoin 都按钻石计
  }
  return `${diamondAmt} 钻石`
}

const normalizeTx = (raw) => {
  const extra = getPath(raw, 'extra') || {}
  return {
    id: getPath(raw, 'id', toStr(Math.random())),
    type: toStr(getPath(raw, 'type', getPath(raw, 'tx_type')), 'consume'),
    remark: toStr(getPath(raw, 'remark'), ''),
    orderNo: toStr(getPath(raw, 'orderId') || extra.outTradeNo || extra.orderNo || ''),
    createdAt: getPath(raw, 'createdAt', getPath(raw, 'created_at')),
    amount: toNum(getPath(raw, 'amount'), 0),
    currency: toStr(getPath(raw, 'currency'), 'diamond')
  }
}

/**
 * z-paging 的分页回调。pageNo/pageSize 由组件内部管理，页面不再持有 page/total/loading。
 * 成功走 completeByTotal（后端返回真实 total，比「本页条数 < pageSize」的推断更准），
 * 失败走 complete(false) —— 这会让组件展示「加载失败，点击重试」而不是静默停在空列表。
 */
const queryList = async (pageNo, pageSize) => {
  if (!requireLogin()) {
    paging.value && paging.value.complete([])
    return
  }
  try {
    const res = await walletApi.transactions({ type: type.value, page: pageNo, pageSize })
    const pageData = unwrapPage(res, { list: [], total: 0 })
    paging.value.completeByTotal(safeMap(pageData.list, normalizeTx), toNum(pageData.total, 0))
  } catch (_) {
    paging.value.complete(false)
  }
}

// reload() 会把 pageNo 重置回 1 并重新触发 @query
const reload = () => { paging.value && paging.value.reload() }

const switchType = (t) => {
  if (type.value === t) return
  type.value = t
  reload()
}

/**
 * uni-app 首次进页面本来就会触发 onShow，而 z-paging 的 auto 又会在 mounted 时自己发一次
 * @query —— 两者叠加就是「同一端点两次请求」（坑点 28 的那一类）。所以首次 onShow 跳过，
 * 只在「从别的页面返回」时才 reload。
 */
let firstShow = true
onShow(() => {
  if (firstShow) { firstShow = false; return }
  reload()
})
</script>

<style lang="scss" scoped>
/* z-paging 在 fixed 模式下自己算高度与 windowTop（原生导航栏偏移），
   所以这里只给背景色，不要再写 min-height:100vh / padding-bottom 去和它抢布局 */
.page { background: $by-bg; }

/* Type bar */
.type-bar {
  box-sizing: border-box;
  white-space: nowrap; padding: 20rpx $by-page-pad-x;
  background: $by-card-bg; border-bottom: 1rpx solid $by-border;
}
.type-item {
  display: inline-block; padding: 12rpx 28rpx; margin-right: 16rpx;
  background: $by-soft-card; border-radius: $by-radius-pill; font-size: 26rpx; color: $by-text-2;
  border: 1rpx solid $by-border; transition: all 0.2s ease;
  &.on {
    background: color.adjust($by-gold, $alpha: 0.25);
    color: $by-gold; font-weight: 600;
    border-color: color.adjust($by-gold, $alpha: 0.4);
  }
}

/* Loading skeleton */
.loading-wrap { padding: 24rpx $by-page-pad-x; display: flex; flex-direction: column; gap: 16rpx; }
.loading-skeleton {
  display: flex; align-items: center; gap: 20rpx;
  background: $by-card-bg; border-radius: 24rpx; padding: 24rpx;
  border: 1rpx solid $by-border;
}
.sk-avatar {
  width: 80rpx; height: 80rpx; border-radius: $by-radius-pill;
  background: linear-gradient(90deg, $by-soft-card 0%, $by-surface-2 50%, $by-soft-card 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
  flex-shrink: 0;
}
.sk-body { flex: 1; display: flex; flex-direction: column; gap: 12rpx; }
.sk-line {
  height: 24rpx; border-radius: $by-radius-sm;
  background: linear-gradient(90deg, $by-soft-card 0%, $by-surface-2 50%, $by-soft-card 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}
.sk-line-sm { width: 40%; height: 28rpx; }
.sk-line-md { width: 65%; height: 20rpx; }
.sk-amount {
  width: 120rpx; height: 36rpx; border-radius: $by-radius-sm;
  background: linear-gradient(90deg, $by-soft-card 0%, $by-surface-2 50%, $by-soft-card 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Transaction list */
.tx-list { padding: 24rpx $by-page-pad-x; }
.tx-item {
  display: flex; align-items: center; gap: 20rpx;
  background: $by-card-bg; border-radius: 24rpx; padding: 24rpx;
  margin-bottom: 16rpx; border: 1rpx solid $by-border;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.99); }
}
.tx-icon {
  width: 80rpx; height: 80rpx; border-radius: $by-radius-pill;
  background: $by-soft-card;
  display: flex; align-items: center; justify-content: center; font-size: 40rpx; flex-shrink: 0;
  border: 1rpx solid $by-border;
  &.recharge {
    background: color.adjust($by-gold, $alpha: 0.16);
    border-color: color.adjust($by-gold, $alpha: 0.3);
  }
  &.income, &.reward {
    background: color.adjust($by-success, $alpha: 0.16);
    border-color: color.adjust($by-success, $alpha: 0.3);
  }
  &.consume, &.gift_send {
    background: color.adjust($by-aurora-a, $alpha: 0.16);
    border-color: color.adjust($by-aurora-a, $alpha: 0.3);
  }
  &.gift_income {
    background: color.adjust($by-success, $alpha: 0.16);
    border-color: color.adjust($by-success, $alpha: 0.3);
  }
  &.withdraw {
    background: color.adjust($by-info, $alpha: 0.16);
    border-color: color.adjust($by-info, $alpha: 0.3);
  }
  &.exchange {
    background: color.adjust($by-aurora-b, $alpha: 0.16);
    border-color: color.adjust($by-aurora-b, $alpha: 0.3);
  }
  &.refund {
    background: color.adjust($by-warning, $alpha: 0.16);
    border-color: color.adjust($by-warning, $alpha: 0.3);
  }
}
.tx-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.tx-title { font-size: 28rpx; font-weight: 600; color: $by-text-1; }
.tx-remark {
  font-size: 24rpx; color: $by-text-3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tx-time { font-size: 22rpx; color: $by-text-muted; }
.tx-order { font-size: 20rpx; color: $by-text-3; font-family: Menlo, Consolas, monospace; }
.tx-amount { font-size: 30rpx; font-weight: 700; flex-shrink: 0; }
.tx-amount.in {
  background: $by-gradient-gold;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.tx-amount.out {
  color: $by-text-2;
}

/* Empty state */
.empty {
  display: flex; flex-direction: column; align-items: center;
  padding: 160rpx 0 80rpx; gap: 16rpx; position: relative;
}
.empty-aurora {
  position: absolute; top: 60rpx; left: 50%; transform: translateX(-50%);
  width: 320rpx; height: 320rpx; border-radius: 50%;
  background: $by-gradient-aurora;
  filter: blur(80rpx); opacity: 0.15;
  pointer-events: none;
}
.empty-icon { font-size: 96rpx; position: relative; z-index: 1; }
.empty-text { font-size: 30rpx; color: $by-text-1; font-weight: 600; position: relative; z-index: 1; }
.empty-sub { font-size: 24rpx; color: $by-text-3; position: relative; z-index: 1; }
</style>
