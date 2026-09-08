<template>
  <div class="page-card">
    <div class="card-title">评论管理</div>
    <div class="filter-bar">
      <el-input v-model="filters.keyword" placeholder="搜索评论内容" clearable style="width: 200px" @clear="loadData" @keyup.enter="loadData" />
      <el-input v-model="filters.postId" placeholder="动态ID" clearable style="width: 120px" @clear="loadData" />
      <el-input v-model="filters.userId" placeholder="用户ID" clearable style="width: 120px" @clear="loadData" />
      <el-button type="primary" @click="loadData">搜索</el-button>
    </div>
    <el-table :data="list" v-loading="loading" border style="margin-top: 16px">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="评论者" width="140">
        <template #default="{ row }">
          <div>{{ row.author?.nickname || '-' }}</div>
          <div class="muted">ID: {{ row.author?.id || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="text" label="评论内容" min-width="250" show-overflow-tooltip />
      <el-table-column label="所属动态" width="120">
        <template #default="{ row }">
          <span>{{ row.post?.id || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="回复对象" width="120">
        <template #default="{ row }">
          <span v-if="row.replyToUserId">用户 {{ row.replyToUserId }}</span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="时间" width="180">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-popconfirm title="确定删除此评论？" @confirm="deleteComment(row.id)">
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
import { commentsApi } from '@/api'

const list = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filters = ref({ keyword: '', postId: '', userId: '' })

const formatDate = (d) => d ? new Date(d).toLocaleString('zh-CN') : '-'

const loadData = async () => {
  loading.value = true
  try {
    const params = { page: page.value, pageSize }
    if (filters.value.keyword) params.keyword = filters.value.keyword
    if (filters.value.postId) params.postId = filters.value.postId
    if (filters.value.userId) params.userId = filters.value.userId
    const res = await commentsApi.list(params)
    const data = res.data?.data || res.data || {}
    list.value = data.rows || data.list || []
    total.value = data.count || data.total || 0
  } catch (e) {
    ElMessage.error('加载评论失败')
  } finally {
    loading.value = false
  }
}

const deleteComment = async (id) => {
  try {
    await commentsApi.del(id)
    ElMessage.success('评论已删除')
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
