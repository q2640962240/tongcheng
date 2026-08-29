<template>
  <div class="page">
    <div class="page-header">
      <h2 class="title">认证管理</h2>
      <div class="toolbar">
        <el-select v-model="statusFilter" clearable placeholder="认证状态" style="width: 140px">
          <el-option label="待审核" value="pending" />
          <el-option label="已通过" value="passed" />
          <el-option label="已拒绝" value="rejected" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
      </div>
    </div>

    <el-card class="card">
      <el-table :data="list" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="申请人" width="220">
          <template #default="{ row }">
            <div class="u-box">
              <el-avatar :size="40" :src="row.user?.avatar" class="u-av">
                {{ (row.user?.nickname || 'U').slice(0, 1) }}
              </el-avatar>
              <div class="u-info">
                <div class="u-name">{{ row.user?.nickname || ('U' + row.userId) }}</div>
                <div class="u-sub">
                  <span class="u-phone">{{ row.user?.phone || '-' }}</span>
                  <span class="u-uid">UID: {{ row.userId }}</span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="realName" label="真实姓名" width="120" />
        <el-table-column label="证件信息" width="220">
          <template #default="{ row }">
            <div>
              <div class="cell-line">{{ row.idCard || '-' }}</div>
              <el-image
                v-if="row.photo"
                class="cell-thumb"
                :src="row.photo"
                :preview-src-list="[row.photo]"
                fit="cover"
                preview-teleported
              />
              <span v-else class="cell-line dim">无证件照</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.type === 'identity' ? '实名认证' : row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="tagType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rejectedReason" label="拒绝原因" min-width="160">
          <template #default="{ row }">{{ row.rejectedReason || '-' }}</template>
        </el-table-column>
        <el-table-column prop="submittedAt" label="提交时间" width="170" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'passed'" size="small" type="success" @click="onAudit(row, 'passed')">通过</el-button>
            <el-button v-if="row.status !== 'rejected'" size="small" type="danger" @click="openReject(row)">拒绝</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          :total="total"
          @current-change="load"
          @size-change="onSizeChange"
        />
      </div>
    </el-card>

    <!-- 拒绝弹窗 -->
    <el-dialog v-model="rejectVisible" title="拒绝认证" width="460px">
      <el-form :model="rejectForm" label-width="90px">
        <el-form-item label="拒绝原因">
          <el-input v-model="rejectForm.reason" type="textarea" :rows="4" placeholder="请填写拒绝原因（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="primary" @click="onConfirmReject">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { certificationsApi } from '../../api'

const list = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const statusFilter = ref('')

const rejectVisible = ref(false)
const currentRow = ref(null)
const rejectForm = reactive({ reason: '' })

const tagType = (s) =>
  s === 'passed' ? 'success' : s === 'pending' ? 'warning' : s === 'rejected' ? 'danger' : 'info'

const statusText = (s) =>
  s === 'passed' ? '已通过' : s === 'pending' ? '待审核' : s === 'rejected' ? '已拒绝' : '未提交'

async function load() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (statusFilter.value) params.status = statusFilter.value
    const { data } = await certificationsApi.list(params)
    list.value = data?.data?.list || data?.list || []
    total.value = data?.data?.total || data?.total || 0
  } catch (err) {
    ElMessage.error(err?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onSizeChange(size) {
  pageSize.value = size
  page.value = 1
  load()
}

async function onAudit(row, status) {
  const action = status === 'passed' ? '通过' : '拒绝'
  try {
    await ElMessageBox.confirm(`确认${action}用户「${row.user?.nickname || 'U' + row.userId}」的实名认证？`, '提示', {
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await certificationsApi.audit(row.userId || row.id, status)
    ElMessage.success(`已${action}`)
    load()
  } catch (err) {
    ElMessage.error(err?.message || `${action}失败`)
  }
}

function openReject(row) {
  currentRow.value = row
  rejectForm.reason = ''
  rejectVisible.value = true
}

async function onConfirmReject() {
  if (!currentRow.value) return
  try {
    await certificationsApi.audit(currentRow.value.userId || currentRow.value.id, 'rejected', rejectForm.reason)
    ElMessage.success('已拒绝')
    rejectVisible.value = false
    load()
  } catch (err) {
    ElMessage.error(err?.message || '操作失败')
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px;
}
.title { font-size: 20px; font-weight: 700; color: #0e1020; margin: 0; }
.toolbar { display: flex; gap: 10px; align-items: center; }
.card { border: none; border-radius: 12px; }
.pager { margin-top: 20px; display: flex; justify-content: flex-end; }
.u-box { display: flex; align-items: center; gap: 10px; }
.u-av { background: linear-gradient(135deg, #d4af37, #7b61ff); color: #fff; }
.u-info { display: flex; flex-direction: column; gap: 2px; }
.u-name { font-weight: 600; color: #0e1020; }
.u-sub { font-size: 12px; color: #8a8fa3; display: flex; gap: 10px; }
.u-phone { color: #555; }
.cell-line { color: #0e1020; font-size: 13px; }
.cell-line.dim { color: #8a8fa3; }
.cell-thumb { width: 48px; height: 48px; border-radius: 8px; margin-top: 6px; border: 1px solid #eee; }
</style>
