<template>
  <div class="content">
  <div class="page-card">
    <div class="card-title">意见反馈</div>
    <div class="filter-bar">
      <el-select v-model="filters.status" placeholder="状态" clearable style="width: 140px" @change="loadData">
        <el-option label="待处理" value="pending" />
        <el-option label="处理中" value="processing" />
        <el-option label="已解决" value="resolved" />
        <el-option label="已拒绝" value="rejected" />
      </el-select>
      <el-select v-model="filters.refType" placeholder="举报细分类型" clearable style="width: 180px" @change="loadData">
        <el-option label="举报动态" value="report_post" />
        <el-option label="举报组局" value="report_group" />
        <el-option label="举报用户" value="report_user" />
      </el-select>
    </div>
    <el-table :data="list" v-loading="loading" border style="margin-top: 16px">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="type" label="类型" width="100">
        <template #default="{ row }">
          <el-tag size="small">{{ typeMap[row.type] || row.type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="refType" label="举报类型" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.refType && reportTypeMap[row.refType]" size="small" type="danger">
            {{ reportTypeMap[row.refType] }}
          </el-tag>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="目标 ID" width="120">
        <template #default="{ row }">
          <span v-if="row.targetId">{{ row.targetId }}</span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="用户" min-width="120">
        <template #default="{ row }">
          <div>{{ row.user?.nickname || '-' }}</div>
          <div class="muted">{{ row.user?.phone || '' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ statusMap[row.status] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="回复/奖励" min-width="160">
        <template #default="{ row }">
          <div v-if="row.reply" class="ellipsis">{{ row.reply }}</div>
          <div v-if="Number(row.reward) > 0" class="reward">+{{ formatNum(row.reward) }} 钻石</div>
          <span v-if="!row.reply && Number(row.reward) === 0" class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="提交时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="onHandle(row)">处理</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && list.length === 0" description="暂无数据" />
  </div>

    <!-- 反馈处理弹窗 -->
    <el-dialog v-model="dialog.visible" title="处理反馈" width="560px" :close-on-click-modal="false">
      <div class="dialog-body" v-if="dialog.row">
        <div class="meta-row">
          <span class="meta-label">反馈类型</span>
          <el-tag size="small">{{ typeMap[dialog.row.type] || dialog.row.type }}</el-tag>
        </div>
        <div class="meta-row">
          <span class="meta-label">提交用户</span>
          <span>{{ dialog.row.user?.nickname || '-' }}（{{ dialog.row.user?.phone || '-' }}）</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">反馈内容</span>
          <div class="meta-content">{{ dialog.row.content }}</div>
        </div>
        <el-form label-width="100px" class="handle-form">
          <el-form-item label="处理状态">
            <el-select v-model="dialog.form.status" style="width: 200px">
              <el-option label="处理中" value="processing" />
              <el-option label="已解决" value="resolved" />
              <el-option label="已拒绝" value="rejected" />
            </el-select>
          </el-form-item>
          <el-form-item label="回复内容">
            <el-input
              v-model="dialog.form.reply"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              placeholder="请填写回复内容（用户可见）"
            />
          </el-form-item>
          <el-form-item label="奖励钻石">
            <el-input-number
              v-model="dialog.form.reward"
              :min="0"
              :max="100000"
              :step="100"
              style="width: 200px"
            />
            <span class="muted" style="margin-left: 12px">单位：个（采纳建议可奖励）</span>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.saving" @click="onSubmit">确认处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getFeedbacks, handleFeedback } from '../../api'

const loading = ref(false)
const list = ref([])
const filters = reactive({ status: '', refType: '' })

const typeMap = { bug: '功能异常', suggest: '功能建议', complaint: '投诉举报', other: '其他' }
const reportTypeMap = { report_post: '举报动态', report_group: '举报组局', report_user: '举报用户' }
const statusMap = { pending: '待处理', processing: '处理中', resolved: '已解决', rejected: '已拒绝' }
const statusType = (s) => ({ pending: 'warning', processing: '', resolved: 'success', rejected: 'danger' })[s] || 'info'

const formatNum = (n) => Number(n || 0)
const formatTime = (ts) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const dialog = reactive({
  visible: false,
  saving: false,
  row: null,
  form: { status: 'processing', reply: '', reward: 0 }
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await getFeedbacks({ ...filters, page: 1, pageSize: 20 })
    list.value = res.data.list
  } catch (e) {} finally { loading.value = false }
}

const onHandle = (row) => {
  dialog.row = row
  dialog.form = {
    status: row.status === 'pending' ? 'processing' : row.status,
    reply: row.reply || '',
    reward: Number(row.reward) || 0
  }
  dialog.visible = true
}

const onSubmit = async () => {
  if (!dialog.form.reply && dialog.form.status !== 'rejected') {
    ElMessage.warning('请填写回复内容')
    return
  }
  dialog.saving = true
  try {
    await handleFeedback(dialog.row.id, {
      status: dialog.form.status,
      reply: dialog.form.reply,
      reward: Number(dialog.form.reward) || 0
    })
    ElMessage.success('处理完成')
    dialog.visible = false
    loadData()
  } catch (e) {} finally {
    dialog.saving = false
  }
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
.card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
.filter-bar { display: flex; gap: 12px; }
.muted { color: #737373; font-size: 12px; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reward { color: #ef4444; font-size: 12px; }
.dialog-body { padding: 0 4px; }
.meta-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.meta-label { width: 80px; color: #737373; font-size: 14px; flex-shrink: 0; }
.meta-content { flex: 1; padding: 8px 12px; background: #f5f5f5; border-radius: 6px; font-size: 14px; color: #171717; line-height: 1.6; word-break: break-all; }
.handle-form { margin-top: 20px; }
</style>
