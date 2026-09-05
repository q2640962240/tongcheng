<template>
  <div class="page">
    <div class="page-header">
      <h2 class="title">系统公告</h2>
    </div>

    <el-card class="card">
      <el-form :model="form" label-width="80px" style="max-width: 600px;">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="公告标题" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="4" placeholder="公告内容" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="发送范围">
          <el-radio-group v-model="form.scope">
            <el-radio value="all">全体用户</el-radio>
            <el-radio value="target">指定用户</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.scope === 'target'" label="用户 ID">
          <el-input v-model="form.targetIds" placeholder="多个 ID 用逗号分隔，如 1,2,3" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSend" :loading="sending">发送公告</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="card" style="margin-top: 16px;">
      <template #header>
        <span>发送历史</span>
      </template>
      <el-table :data="historyList" v-loading="historyLoading" stripe style="width: 100%;">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" min-width="150" />
        <el-table-column prop="content" label="内容" min-width="250" show-overflow-tooltip />
        <el-table-column prop="receiverId" label="接收用户ID" width="120" />
        <el-table-column label="发送时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { sendAnnouncement, getAnnouncements } from '../../api'

const form = reactive({ title: '', content: '', scope: 'all', targetIds: '' })
const sending = ref(false)

const historyList = ref([])
const historyLoading = ref(false)

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-'

const loadHistory = async () => {
  historyLoading.value = true
  try {
    const r = await getAnnouncements({ page: 1, pageSize: 50 })
    historyList.value = r.list || r.rows || r || []
  } catch (e) { ElMessage.error('加载历史失败') }
  finally { historyLoading.value = false }
}

const onSend = async () => {
  if (!form.title) return ElMessage.warning('请填写公告标题')
  if (!form.content) return ElMessage.warning('请填写公告内容')
  const payload = { title: form.title, content: form.content }
  if (form.scope === 'target') {
    const ids = form.targetIds.split(',').map(s => Number(s.trim())).filter(n => n > 0)
    if (!ids.length) return ElMessage.warning('请填写有效的用户 ID')
    payload.targetUsers = ids
  }
  sending.value = true
  try {
    const r = await sendAnnouncement(payload)
    ElMessage.success(r.message || '公告已发送')
    form.title = ''
    form.content = ''
    form.targetIds = ''
    loadHistory()
  } catch (e) { ElMessage.error('发送失败: ' + (e.message || '')) }
  finally { sending.value = false }
}

onMounted(loadHistory)
</script>

<style scoped>
.page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.title { margin: 0; font-size: 20px; }
.card { background: #fff; }
</style>
