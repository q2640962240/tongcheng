<template>
  <div class="page">
    <div class="page-header">
      <h2 class="title">动态管理</h2>
      <div class="toolbar">
        <el-input v-model="kw" placeholder="搜索内容/作者" clearable style="width: 260px" @keyup.enter="onSearch" />
        <el-select v-model="statusFilter" clearable placeholder="审核状态" style="width: 140px">
          <el-option label="待审核" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已拒绝" value="rejected" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
      </div>
    </div>

    <el-card class="card">
      <el-table :data="list" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="作者" width="160">
          <template #default="{ row }">
            <div>
              <div class="u-name">{{ row.userName || row.nickname || ('U' + row.userId) }}</div>
              <div class="u-sub">UID: {{ row.userId }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="内容预览" min-width="260">
          <template #default="{ row }">
            <div class="post-preview">
              <div class="post-text">{{ (row.text || '').slice(0, 60) }}{{ (row.text||'').length > 60 ? '...' : '' }}</div>
              <div v-if="row.images && row.images.length" class="post-imgs">
                <span class="pill">🖼 {{ row.images.length }} 图</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="city" label="城市" width="100" />
        <el-table-column prop="likeCount" label="点赞" width="80" />
        <el-table-column prop="commentCount" label="评论" width="80" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="tagType(row.auditStatus || 'approved')" size="small">
              {{ statusText(row.auditStatus || 'approved') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.auditStatus !== 'approved'" size="small" type="success" @click="onAudit(row, 'approved')">通过</el-button>
            <el-button v-if="row.auditStatus === 'pending'" size="small" type="warning" @click="onAudit(row, 'rejected')">拒绝</el-button>
            <el-button size="small" type="danger" @click="onRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @size-change="load"
        @current-change="load"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { postsApi } from '../../api'

const list = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const kw = ref('')
const statusFilter = ref('')

const statusText = (s) => ({ pending: '待审核', approved: '已通过', rejected: '已拒绝' }[s] || '已通过')
const tagType = (s) => ({ pending: 'warning', approved: 'success', rejected: 'danger' }[s] || 'info')

const load = async () => {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (kw.value) params.kw = kw.value
    if (statusFilter.value) params.auditStatus = statusFilter.value
    const r = await postsApi.list(params)
    list.value = r.list || r.rows || []
    total.value = Number(r.total || 0)
  } catch (e) {
    ElMessage.error('加载失败: ' + (e.message || '网络错误'))
  } finally {
    loading.value = false
  }
}

const onSearch = () => { page.value = 1; load() }

const onAudit = async (row, status) => {
  try {
    await ElMessageBox.confirm(`确认将该动态状态变更为「${statusText(status)}」？`, '审核确认', { type: 'warning' })
    await postsApi.audit(row.id, status)
    ElMessage.success('已更新'); load()
  } catch (e) { if (e !== 'cancel') ElMessage.error('操作失败: ' + (e.message || '')) }
}

const onRemove = async (row) => {
  try {
    await ElMessageBox.confirm('确认删除该动态？删除后不可恢复', '删除确认', { type: 'error' })
    await postsApi.del(row.id)
    ElMessage.success('已删除'); load()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败: ' + (e.message || '')) }
}

onMounted(load)
</script>

<style scoped>
.page { padding: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.title { margin: 0; font-size: 20px; }
.toolbar { display: flex; gap: 8px; align-items: center; }
.card { background: #fff; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.u-name { font-weight: 600; }
.u-sub { font-size: 12px; color: #909399; }
.post-preview { line-height: 1.5; }
.post-text { color: #303133; }
.post-imgs { margin-top: 4px; }
.pill { display: inline-block; padding: 2px 8px; background: #ecf5ff; color: #409eff; border-radius: 10px; font-size: 12px; }
</style>
