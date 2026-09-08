<template>
  <div class="page-card">
    <div class="card-title">评价管理</div>
    <div class="filter-bar">
      <el-input v-model="filters.serviceId" placeholder="服务ID" clearable style="width: 120px" @clear="loadData" />
      <el-input v-model="filters.userId" placeholder="评价者ID" clearable style="width: 120px" @clear="loadData" />
      <el-select v-model="filters.rating" placeholder="评分" clearable style="width: 120px" @change="loadData">
        <el-option v-for="n in 5" :key="n" :label="`${n} 星`" :value="n" />
      </el-select>
      <el-button type="primary" @click="loadData">搜索</el-button>
    </div>
    <el-table :data="list" v-loading="loading" border style="margin-top: 16px">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="评价者" width="140">
        <template #default="{ row }">
          <div>{{ row.reviewer?.nickname || '-' }}</div>
          <div class="muted">ID: {{ row.reviewer?.id || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="所属服务" min-width="150">
        <template #default="{ row }">
          <div>{{ row.service?.title || '-' }}</div>
          <div class="muted">ID: {{ row.service?.id || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="评分" width="120">
        <template #default="{ row }">
          <el-rate v-model="row.rating" disabled />
        </template>
      </el-table-column>
      <el-table-column prop="content" label="评价内容" min-width="200" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="时间" width="180">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-popconfirm title="确定删除此评价？" @confirm="deleteReview(row.id)">
            <template #reference>
              <el-button type="danger" size="small" link>删除</el-button>
            </template>
          </el-popconfirm>
        </template>
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
import { reviewsApi } from '@/api'

const list = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filters = ref({ serviceId: '', userId: '', rating: '' })

const formatDate = (d) => d ? new Date(d).toLocaleString('zh-CN') : '-'

const loadData = async () => {
  loading.value = true
  try {
    const params = { page: page.value, pageSize }
    if (filters.value.serviceId) params.serviceId = filters.value.serviceId
    if (filters.value.userId) params.userId = filters.value.userId
    if (filters.value.rating) params.rating = filters.value.rating
    const res = await reviewsApi.list(params)
    const data = res.data?.data || res.data || {}
    list.value = data.rows || data.list || []
    total.value = data.count || data.total || 0
  } catch (e) {
    ElMessage.error('加载评价失败')
  } finally {
    loading.value = false
  }
}

const deleteReview = async (id) => {
  try {
    await reviewsApi.del(id)
    ElMessage.success('评价已删除')
    loadData()
  } catch (e) {
    ElMessage.error('删除失败')
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.page-card { background: transparent; border-radius: 8px; padding: 20px; }
.card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: var(--by-text-1); }
.filter-bar { display: flex; gap: 12px; flex-wrap: wrap; }
.muted { color: var(--by-text-3); font-size: 12px; }
</style>
