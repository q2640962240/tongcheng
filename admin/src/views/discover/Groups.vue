<template>
  <div class="page">
    <div class="page-header">
      <h2 class="title">组局管理</h2>
      <div class="toolbar">
        <el-input v-model="kw" placeholder="搜索标题/发起人" clearable style="width: 260px" @keyup.enter="onSearch" />
        <el-select v-model="statusFilter" clearable placeholder="组局状态" style="width: 140px">
          <el-option label="招募中" value="open" />
          <el-option label="草稿" value="draft" />
          <el-option label="已满" value="full" />
          <el-option label="已关闭" value="closed" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
      </div>
    </div>

    <el-card class="card">
      <el-table :data="list" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="发起人" width="140">
          <template #default="{ row }">
            <div>
              <div class="u-name">{{ row.userName || ('U' + row.userId) }}</div>
              <div class="u-sub">UID: {{ row.userId }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="标签" min-width="180">
          <template #default="{ row }">
            <el-tag v-for="t in (row.tags || []).slice(0,4)" :key="t" size="small" style="margin-right: 4px;">#{{ t }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="city" label="城市" width="90" />
        <el-table-column label="人数" width="110">
          <template #default="{ row }">{{ row.joinCount || 0 }} / {{ row.expectMax || '-' }}</template>
        </el-table-column>
        <el-table-column prop="activityAt" label="活动时间" width="170" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="tagType(row.status || 'open')" size="small">{{ statusText(row.status || 'open') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'open'" size="small" type="warning" @click="onClose(row)">关闭</el-button>
            <el-button v-if="row.status === 'closed'" size="small" type="success" @click="onReopen(row)">开启</el-button>
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
import { groupsApi } from '../../api'

const list = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const kw = ref('')
const statusFilter = ref('')

const statusText = (s) => ({ draft: '草稿', open: '招募中', full: '已满', closed: '已关闭' }[s] || '-')
const tagType = (s) => ({ draft: 'info', open: 'success', full: 'warning', closed: 'danger' }[s] || 'info')

const load = async () => {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (kw.value) params.kw = kw.value
    if (statusFilter.value) params.status = statusFilter.value
    const r = await groupsApi.list(params)
    list.value = r.list || r.rows || []
    total.value = Number(r.total || 0)
  } catch (e) {
    ElMessage.error('加载失败: ' + (e.message || '网络错误'))
  } finally { loading.value = false }
}
const onSearch = () => { page.value = 1; load() }

const onClose = async (row) => {
  try {
    await ElMessageBox.confirm('确认关闭该组局招募？', '操作确认', { type: 'warning' })
    await groupsApi.del(row.id)
    ElMessage.success('已关闭'); load()
  } catch (e) { if (e !== 'cancel') ElMessage.error('失败: ' + (e.message || '')) }
}
const onReopen = async (row) => {
  try {
    // 复用 /groups/:id 更新接口，经管理员代理传递 status
    const { default: axios } = await import('axios')
    const http = axios.create({ baseURL: '/api', timeout: 15000 })
    const token = localStorage.getItem('admin_token') || ''
    http.interceptors.request.use(cfg => {
      cfg.headers = cfg.headers || {}
      if (token) cfg.headers['x-admin-token'] = token
      return cfg
    })
    const { data: payload } = await http.put(`/admin/groups/${row.id}`, { status: 'open' })
    if (payload.code === 0) { ElMessage.success('已开启'); load() }
    else ElMessage.error(payload.message || '失败')
  } catch (e) { ElMessage.error('失败: ' + (e.message || '')) }
}
const onRemove = async (row) => {
  try {
    await ElMessageBox.confirm('确认删除该组局？删除后不可恢复', '删除确认', { type: 'error' })
    await groupsApi.del(row.id)
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
</style>
