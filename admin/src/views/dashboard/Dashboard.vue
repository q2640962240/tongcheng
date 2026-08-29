<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6" v-for="card in statCards.slice(0,4)" :key="card.label">
        <div class="stat-card">
          <div class="stat-icon" :style="{ background: card.bg, color: card.color }">
            <el-icon :size="28"><component :is="card.icon" /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- T11 新增：广场化 3 指标 + 精英收入 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6" v-for="card in statCards.slice(4)" :key="card.label">
        <div class="stat-card v2">
          <div class="stat-icon" :style="{ background: card.bg, color: card.color }">
            <el-icon :size="28"><component :is="card.icon" /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value gold" v-if="card.gold">{{ card.value }}</div>
            <div class="stat-value" v-else>{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 待办 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="12">
        <div class="page-card">
          <div class="card-title">待处理事项</div>
          <div class="todo-list">
            <div class="todo-item" v-for="todo in todos" :key="todo.label">
              <span class="todo-label">{{ todo.label }}</span>
              <el-tag :type="todo.count > 0 ? 'warning' : 'success'">{{ todo.count }}</el-tag>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="page-card">
          <div class="card-title">收入概览</div>
          <div class="income-info">
            <div class="income-item">
              <div class="income-label">今日收入</div>
              <div class="income-value">¥{{ stats.todayIncome }}</div>
            </div>
            <div class="income-item">
              <div class="income-label">本月收入</div>
              <div class="income-value">¥{{ stats.monthIncome }}</div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getDashboard } from '../../api'

const stats = ref({
  userCount: 0,
  orderCount: 0,
  serviceCount: 0,
  pendingFeedback: 0,
  pendingServices: 0,
  todayIncome: 0,
  monthIncome: 0,
  postCount: 0,
  groupCount: 0,
  bannerCount: 0,
  elitePaidCount: 0,
  eliteRevenueFen: 0,
})

const statCards = ref([
  { label: '总用户数', value: 0, icon: 'User', bg: '#fff9c4', color: '#b45309' },
  { label: '总订单数', value: 0, icon: 'List', bg: '#e0f2fe', color: '#0ea5e9' },
  { label: '服务总数', value: 0, icon: 'Goods', bg: '#f3e8ff', color: '#a855f7' },
  { label: '反馈待处理', value: 0, icon: 'ChatDotRound', bg: '#fce7f3', color: '#f472b6' },
  { label: '动态总数', value: 0, icon: 'ChatLineSquare', bg: '#eef2ff', color: '#6366f1' },
  { label: '组局总数', value: 0, icon: 'UserFilled', bg: '#ecfeff', color: '#06b6d4' },
  { label: '精英付费会员', value: 0, icon: 'Medal', bg: '#fff7ed', color: '#ea580c' },
  { label: '精英累计收入', value: '¥0', icon: 'WalletFilled', bg: '#fef3c7', color: '#b45309', gold: true },
])

const todos = ref([
  { label: '待审核服务', count: 0 },
  { label: '待处理反馈', count: 0 },
  { label: '退款待处理', count: 0 }
])

const fetchDashboard = async () => {
  try {
    const res = await getDashboard()
    stats.value = res.data
    statCards.value[0].value = res.data.userCount
    statCards.value[1].value = res.data.orderCount
    statCards.value[2].value = res.data.serviceCount
    statCards.value[3].value = res.data.pendingFeedback
    statCards.value[4].value = res.data.postCount || 0
    statCards.value[5].value = res.data.groupCount || 0
    statCards.value[6].value = res.data.elitePaidCount || 0
    statCards.value[7].value = '¥' + ((res.data.eliteRevenueFen || 0) / 100).toFixed(2)
    todos.value[0].count = res.data.pendingServices
    todos.value[1].count = res.data.pendingFeedback
  } catch (e) {}
}

onMounted(fetchDashboard)
</script>

<style lang="scss" scoped>
.stat-row { margin-bottom: 16px; }
.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stat-value { font-size: 28px; font-weight: 700; }
.stat-value.gold {
  background: linear-gradient(135deg, #f5d583 0%, #d4af37 60%, #b8941f 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.stat-card.v2 {
  border: 1px solid rgba(212,175,55,.15);
  box-shadow: 0 4px 20px rgba(11,15,26,.05);
}
.stat-label { font-size: 14px; color: #737373; }
.card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
.todo-list { display: flex; flex-direction: column; gap: 12px; }
.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
}
.todo-label { font-size: 14px; }
.income-info { display: flex; gap: 32px; }
.income-item { flex: 1; }
.income-label { font-size: 14px; color: #737373; margin-bottom: 8px; }
.income-value { font-size: 28px; font-weight: 700; color: #ef4444; }
</style>
