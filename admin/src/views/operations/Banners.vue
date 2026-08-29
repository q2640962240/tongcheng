<template>
  <div class="page">
    <div class="page-header">
      <h2 class="title">Banner 管理</h2>
      <div class="toolbar">
        <el-button type="primary" @click="onCreate">+ 新增 Banner</el-button>
      </div>
    </div>

    <el-card class="card">
      <el-table :data="list" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="预览" width="140">
          <template #default="{ row }">
            <el-image :src="row.image" fit="cover" style="width: 120px; height: 60px; border-radius: 6px" />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180" />
        <el-table-column prop="link" label="跳转链接" min-width="200" show-overflow-tooltip />
        <el-table-column prop="position" label="位置" width="100" />
        <el-table-column prop="sort" label="权重" width="80" />
        <el-table-column label="启用" width="80">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="onToggle(row)" active-color="#d4af37" />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="onEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="onRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dlgVisible" :title="isEdit ? '编辑 Banner' : '新增 Banner'" width="520px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="图片 URL"><el-input v-model="form.image" placeholder="https:// 或 /uploads/..." /></el-form-item>
        <el-form-item label="跳转链接"><el-input v-model="form.link" placeholder="/pages/... 或 https://..." /></el-form-item>
        <el-form-item label="位置"><el-input v-model="form.position" placeholder="如 home-top" /></el-form-item>
        <el-form-item label="权重"><el-input-number v-model="form.sort" :min="0" :max="999" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" active-color="#d4af37" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgVisible = false">取消</el-button>
        <el-button type="primary" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { bannersApi } from '../../api'

const list = ref([])
const loading = ref(false)
const dlgVisible = ref(false)
const isEdit = ref(false)
const form = reactive({ id: null, title: '', image: '', link: '', position: 'home-top', sort: 10, enabled: true })

const resetForm = () => Object.assign(form, { id: null, title: '', image: '', link: '', position: 'home-top', sort: 10, enabled: true })

const load = async () => {
  loading.value = true
  try {
    const r = await bannersApi.list({ page: 1, pageSize: 100 })
    list.value = r.list || r.rows || r || []
  } catch (e) { ElMessage.error('加载失败: ' + (e.message || '')) }
  finally { loading.value = false }
}

const onCreate = () => { isEdit.value = false; resetForm(); dlgVisible.value = true }
const onEdit = (row) => { isEdit.value = true; Object.assign(form, JSON.parse(JSON.stringify(row))); dlgVisible.value = true }

const onSave = async () => {
  if (!form.title) return ElMessage.warning('请填写标题')
  if (!form.image) return ElMessage.warning('请填写图片 URL')
  try {
    const payload = { ...form }
    if (isEdit.value) {
      await bannersApi.update(form.id, payload)
    } else {
      const { id, ...rest } = payload; // eslint-disable-line no-unused-vars
      await bannersApi.create(rest)
    }
    ElMessage.success('已保存'); dlgVisible.value = false; load()
  } catch (e) { ElMessage.error('保存失败: ' + (e.message || '')) }
}

const onToggle = async (row) => {
  try {
    await bannersApi.update(row.id, { enabled: !!row.enabled })
    ElMessage.success('已更新')
  } catch (e) { row.enabled = !row.enabled; ElMessage.error('更新失败') }
}

const onRemove = async (row) => {
  try {
    await ElMessageBox.confirm('确认删除该 Banner？', '删除确认', { type: 'error' })
    await bannersApi.del(row.id)
    ElMessage.success('已删除'); load()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败: ' + (e.message || '')) }
}

onMounted(load)
</script>

<style scoped>
.page { padding: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.title { margin: 0; font-size: 20px; }
.card { background: #fff; }
</style>
