<template>
  <div class="page-card">
    <div class="card-title">关注关系</div>
    <div class="filter-bar">
      <el-input v-model="filters.userId" placeholder="用户ID" clearable style="width: 120px" @clear="loadData" />
      <el-input v-model="filters.keyword" placeholder="搜索用户名" clearable style="width: 200px" @clear="loadData" @keyup.enter="loadData" />
      <el-button type="primary" @click="loadData">搜索</el-button>
    </div>
    <el-table :data="list" v-loading="loading" border style="margin-top: 16px">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="关注者和被关注">
        <template #default="{ row }">
          <div class="follow-row">
            <div class="user-cell">
              <el-avatar :size="32" :src="row.followerUser?.avatar" />
              <div>
                <div>{{ row.followerUser?.nickname || '-' }}</div>
                <div class="muted">ID: {{ row.followerUser?.id || '-' }}</div>
              </div>
            </div>
            <span class="arrow">→</span>
            <div class="user-cell">
              <el-avatar :size="32" :src="row.followingUser?.avatar" />
              <div>
                <div>{{ row.followingUser?.nickname || '-' }}</div>
                <div class="muted">ID: {{ row.followingUser?.id || '-' }}</div>
              </div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="关注时间" width="180">
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
import { followsApi } from '@/api'

const list = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filters = ref({ userId: '', keyword: '' })

const formatDate = (d) => d ? new Date(d).toLocaleString('zh-CN') : '-'

const loadData = async () => {
  loading.value = true
  try {
    const params = { page: page.value, pageSize }
    if (filters.value.userId) params.userId = filters.value.userId
    if (filters.value.keyword) params.keyword = filters.value.keyword
    const res = await followsApi.list(params)
    const data = res.data?.data || res.data || {}
    list.value = data.rows || data.list || []
    total.value = data.count || data.total || 0
  } catch (e) {
    ElMessage.error('加载关注关系失败')
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
.follow-row { display: flex; align-items: center; gap: 12px; }
.user-cell { display: flex; align-items: center; gap: 8px; }
.arrow { font-size: 18px; color: #999; }
</style>
