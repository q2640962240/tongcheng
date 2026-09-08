<template>
  <div class="page-card">
    <div class="card-title">签到记录</div>
    <div class="stats-bar" v-if="stats">
      <el-tag type="success">今日签到: {{ stats.todayCount }} 人</el-tag>
      <el-tag>累计签到用户: {{ stats.totalUsers }} 人</el-tag>
    </div>
    <div class="filter-bar">
      <el-input v-model="filters.userId" placeholder="用户ID" clearable style="width: 120px" @clear="loadData" />
      <el-date-picker v-model="filters.date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" clearable @change="loadData" style="width: 160px" />
      <el-button type="primary" @click="loadData">搜索</el-button>
    </div>
    <el-table :data="list" v-loading="loading" border style="margin-top: 16px">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="用户" width="160">
        <template #default="{ row }">
          <div>{{ row.user?.nickname || '-' }}</div>
          <div class="muted">ID: {{ row.user?.id || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="date" label="签到日期" width="120" />
      <el-table-column prop="rewardDiamond" label="奖励钻石" width="100" />
      <el-table-column prop="streakDays" label="连续天数" width="100" />
      <el-table-column prop="createdAt" label="签到时间" width="180">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="total > 0"
      style="margin-top: 16px; justify-content: flex-end"
      background layout="total, prev, pager, next"
      :total="total" :page-size="pageSize" v-model:current-page="page"
      @current-change="loadData"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { signInApi } from '@/api'

const list = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const stats = ref(null)
const filters = ref({ userId: '', date: '' })

const formatDate = (d) => d ? new Date(d).toLocaleString('zh-CN') : '-'

const loadStats = async () => {
  try {
    const res = await signInApi.stats()
    stats.value = res.data?.data || res.data || {}
  } catch (_) {}
}

const loadData = async () => {
  loading.value = true
  try {
    const params = { page: page.value, pageSize }
    if (filters.value.userId) params.userId = filters.value.userId
    if (filters.value.date) params.date = filters.value.date
    const res = await signInApi.list(params)
    const data = res.data?.data || res.data || {}
    list.value = data.rows || data.list || []
    total.value = data.count || data.total || 0
  } catch (e) {
    ElMessage.error('加载签到记录失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
  loadStats()
})
</script>

<style scoped>
.page-card { background: transparent; border-radius: 8px; padding: 20px; }
.card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: var(--by-text-1); }
.stats-bar { display: flex; gap: 12px; margin-bottom: 16px; }
.filter-bar { display: flex; gap: 12px; flex-wrap: wrap; }
.muted { color: var(--by-text-3); font-size: 12px; }
</style>
