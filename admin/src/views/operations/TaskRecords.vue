<template>
  <div class="page-card">
    <div class="card-title">每日任务记录</div>
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
      <el-table-column prop="date" label="日期" width="120" />
      <el-table-column label="登录" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.loginDone ? 'success' : 'info'" size="small">{{ row.loginDone ? '✓' : '✗' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="聊天" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.chatDone ? 'success' : 'info'" size="small">{{ row.chatDone ? '✓' : '✗' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="送礼" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.giftSent ? 'success' : 'info'" size="small">{{ row.giftSent ? '✓' : '✗' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="发动态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.postCreated ? 'success' : 'info'" size="small">{{ row.postCreated ? '✓' : '✗' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="分享" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.shareDone ? 'success' : 'info'" size="small">{{ row.shareDone ? '✓' : '✗' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="totalClaimed" label="已领取" width="80" align="center" />
      <el-table-column prop="createdAt" label="创建时间" width="180">
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
import { taskRecordsApi } from '@/api'

const list = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filters = ref({ userId: '', date: '' })

const formatDate = (d) => d ? new Date(d).toLocaleString('zh-CN') : '-'

const loadData = async () => {
  loading.value = true
  try {
    const params = { page: page.value, pageSize }
    if (filters.value.userId) params.userId = filters.value.userId
    if (filters.value.date) params.date = filters.value.date
    const res = await taskRecordsApi.list(params)
    const data = res.data?.data || res.data || {}
    list.value = data.rows || data.list || []
    total.value = data.count || data.total || 0
  } catch (e) {
    ElMessage.error('加载任务记录失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.page-card { background: #fff; border-radius: 8px; padding: 20px; }
.card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
.filter-bar { display: flex; gap: 12px; flex-wrap: wrap; }
.muted { color: #999; font-size: 12px; }
</style>
