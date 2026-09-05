<template>
  <div class="service-categories">
    <div class="page-card">
      <div class="filter-bar">
        <div class="page-title">
          <el-icon size="18" color="#d4af37"><Menu /></el-icon>
          <span class="t1">约玩分类管理</span>
          <span class="sub">控制用户端 App 首页、发布约玩页、筛选器展示的分类列表；支持二级结构、上下架、排序、价格默认值。</span>
        </div>
        <div style="flex:1" />
        <el-button type="primary" :icon="Refresh" @click="loadData" :loading="loading">刷新</el-button>
        <el-button type="success" :icon="Plus" @click="openCreateTop">+ 新增顶级分类</el-button>
      </div>
    </div>

    <div class="page-card">
      <el-table
        :data="tree"
        v-loading="loading"
        row-key="key"
        border
        :expand-row-keys="expandRowKeys"
        default-expand-all
      >
        <el-table-column prop="name" label="分类名称" min-width="180">
          <template #default="{ row }">
            <div class="name-cell">
              <el-tag
                v-if="!row.parentKey"
                size="small"
                type="warning"
                effect="dark"
                style="margin-right: 8px;"
              >顶级</el-tag>
              <el-tag
                v-else
                size="small"
                type="info"
                effect="plain"
                style="margin-right: 8px;"
              >二级</el-tag>
              <span class="name">{{ row.name }}</span>
              <el-tooltip content="业务唯一 key">
                <span class="key-tag">{{ row.key }}</span>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="默认价格" width="150" align="center">
          <template #default="{ row }">
            <span v-if="row.parentKey">¥{{ Number(row.price || 0) }} <span class="unit">/ {{ row.priceUnit || '-' }}</span></span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" align="center" />
        <el-table-column label="展示状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.visible === false ? 'info' : 'success'">
              {{ row.visible === false ? '已下架' : '已上架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布审核" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.requireAudit === false ? 'info' : 'warning'">
              {{ row.requireAudit === false ? '免审' : '需审' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="简介" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              v-if="!row.parentKey"
              size="small"
              link
              type="success"
              @click="openCreateChild(row)"
            >添加子项</el-button>
            <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              size="small"
              link
              :type="row.visible === false ? 'success' : 'warning'"
              @click="onToggleVisible(row)"
            >{{ row.visible === false ? '上架' : '下架' }}</el-button>
            <el-button size="small" link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新建 / 编辑 Dialog -->
    <el-dialog
      v-model="formVisible"
      :title="formMode === 'createTop' ? '新增顶级分类' : formMode === 'createChild' ? `新增子分类（父级：${parentInfo.name}）` : `编辑分类：${form.name}`"
      width="560px"
      destroy-on-close
      @close="resetForm"
    >
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="110px">
        <el-form-item label="父级分类" v-if="formMode !== 'createTop'">
          <el-select v-model="form.parentKey" :disabled="formMode === 'edit' || formMode === 'createChild'" style="width:100%">
            <el-option label="顶级分类（无父级）" value="" />
            <el-option v-for="t in topCategories" :key="t.key" :label="`${t.name}（${t.key}）`" :value="t.key" />
          </el-select>
          <div v-if="formMode === 'createChild'" style="font-size: 12px; color:#909399; margin-top:4px;">
            已锁定父级：{{ parentInfo.name }}
          </div>
        </el-form-item>
        <el-form-item label="分类 Key" prop="key">
          <el-input
            v-model="form.key"
            placeholder="例：virtual-lover（英文/数字/短横线/下划线，2-64 位，唯一）"
            :disabled="formMode === 'edit'"
            maxlength="64"
          />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="例：虚拟恋人" maxlength="30" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" placeholder="图标 URL 或 iconfont class（可选）" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="200" placeholder="简短介绍（可选）" />
        </el-form-item>
        <template v-if="form.parentKey">
          <el-divider content-position="left">子分类专属属性（顶级分类无需填写）</el-divider>
          <el-form-item label="默认价格">
            <el-input-number v-model="form.price" :min="0" :max="999999" />
            <span style="margin-left: 12px;">（分/钻石/整数，按价格单位解读）</span>
          </el-form-item>
          <el-form-item label="价格单位">
            <el-select v-model="form.priceUnit" clearable filterable allow-create style="width: 240px">
              <el-option label="20分钟" value="20分钟" />
              <el-option label="局" value="局" />
              <el-option label="首" value="首" />
              <el-option label="按分钟" value="按分钟" />
              <el-option label="按次" value="按次" />
              <el-option label="小时" value="小时" />
            </el-select>
          </el-form-item>
          <el-form-item label="自定义价格">
            <el-switch v-model="form.allowCustomPrice" />
            <span style="margin-left: 8px; color:#909399;">开启：发布者发布约玩时可自定义价格；关闭则强制使用默认价</span>
          </el-form-item>
        </template>
        <el-divider content-position="left">公共属性</el-divider>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="-9999" :max="9999" />
          <span style="margin-left: 8px; color:#909399;">数值越大越靠前（默认 0）</span>
        </el-form-item>
        <el-form-item label="展示状态">
          <el-switch v-model="form.visible" />
          <span style="margin-left: 8px;">关闭后用户端分类筛选/首页将不再展示</span>
        </el-form-item>
        <el-form-item label="发布审核">
          <el-switch v-model="form.requireAudit" />
          <span style="margin-left: 8px;">关闭后用户发布到该分类下的约玩直接上线，无需后台审核</span>
        </el-form-item>
        <el-form-item label="推荐标签">
          <el-select
            v-model="tagsArr"
            filterable
            allow-create
            default-first-option
            multiple
            style="width: 100%;"
            placeholder="可自由添加（回车）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          {{ formMode === 'edit' ? '保存修改' : '创建分类' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Menu } from '@element-plus/icons-vue'
import { serviceCategoriesApi } from '../../api'

const loading = ref(false)
const tree = ref([])
const expandRowKeys = ref([])
const flat = ref([])

const topCategories = computed(() => flat.value.filter(f => !f.parentKey))

const loadData = async () => {
  loading.value = true
  try {
    const res = await serviceCategoriesApi.list()
    tree.value = (res.data?.tree) || []
    flat.value = (res.data?.flat) || []
    expandRowKeys.value = tree.value.map(t => t.key)
  } catch (e) {
    ElMessage.error('加载分类失败')
  } finally {
    loading.value = false
  }
}

/* ============== Dialog ============== */
const formVisible = ref(false)
const formMode = ref('createTop') // createTop | createChild | edit
const parentInfo = ref({})
const formRef = ref(null)
const submitting = ref(false)
const tagsArr = ref([])

const defaultForm = () => ({
  key: '',
  name: '',
  parentKey: '',
  icon: '',
  description: '',
  price: 0,
  priceUnit: '',
  allowCustomPrice: true,
  visible: true,
  sort: 0,
  requireAudit: true
})
const form = reactive(defaultForm())

const resetForm = () => {
  Object.assign(form, defaultForm())
  tagsArr.value = []
  if (formRef.value) formRef.value.clearValidate()
}

const openCreateTop = () => {
  formMode.value = 'createTop'
  parentInfo.value = {}
  resetForm()
  nextTick(() => (formVisible.value = true))
}
const openCreateChild = (row) => {
  formMode.value = 'createChild'
  parentInfo.value = { key: row.key, name: row.name }
  resetForm()
  form.parentKey = row.key
  nextTick(() => (formVisible.value = true))
}
const openEdit = (row) => {
  formMode.value = 'edit'
  parentInfo.value = {}
  resetForm()
  form.key = row.key
  form.name = row.name || ''
  form.parentKey = row.parentKey || ''
  form.icon = row.icon || ''
  form.description = row.description || ''
  form.price = Number(row.price) || 0
  form.priceUnit = row.priceUnit || ''
  form.allowCustomPrice = row.allowCustomPrice !== false
  form.visible = row.visible !== false
  form.sort = Number(row.sort) || 0
  form.requireAudit = row.requireAudit !== false
  tagsArr.value = Array.isArray(row.tags) ? [...row.tags] : []
  nextTick(() => (formVisible.value = true))
}

const formRules = {
  key: [
    { required: true, message: '分类 Key 必填（英文字母/数字/短横线/下划线）', trigger: 'blur' },
    {
      validator: (_r, v, cb) => {
        if (v && !/^[a-zA-Z0-9_-]{2,64}$/.test(String(v))) {
          return cb(new Error('2-64 位英文/数字/短横线/下划线'))
        }
        cb()
      },
      trigger: 'blur'
    }
  ],
  name: [{ required: true, message: '分类名称必填', trigger: 'blur' }]
}

const submitForm = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch (_) {
    return
  }
  submitting.value = true
  try {
    const payload = {
      ...form,
      parentKey: form.parentKey || null,
      tags: tagsArr.value && tagsArr.value.length ? tagsArr.value : null,
      icon: form.icon || null,
      description: form.description || null,
      priceUnit: form.priceUnit || null
    }
    if (formMode.value === 'edit') {
      // 编辑时不允许修改 key 与 parentKey（避免主键冲突）
      const { key: _k, parentKey: _p, ...rest } = payload
      await serviceCategoriesApi.update(form.key, rest)
      ElMessage.success('分类已更新')
    } else {
      await serviceCategoriesApi.create(payload)
      ElMessage.success('分类已创建')
    }
    formVisible.value = false
    loadData()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

/* ============== 操作行 ============== */
const onToggleVisible = async (row) => {
  try {
    await serviceCategoriesApi.toggle(row.key)
    ElMessage.success(row.visible === false ? '已上架' : '已下架')
    loadData()
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

const onDelete = async (row) => {
  const hasChild = row.parentKey ? false : tree.value.find(t => t.key === row.key)?.children?.length > 0
  const msg = hasChild
    ? `顶级分类「${row.name}」仍包含子分类，是否同时删除全部子项？`
    : `确认删除分类「${row.name}」？删除后用户端发布约玩的对应分类会被归为兜底。`
  try {
    await ElMessageBox.confirm(msg, '提示', {
      type: 'warning',
      confirmButtonText: hasChild ? '删除全部' : '确认删除',
      cancelButtonText: '取消'
    })
    await serviceCategoriesApi.del(row.key, !!hasChild)
    ElMessage.success('已删除')
    loadData()
  } catch (_) {}
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
.filter-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.page-title { display: flex; align-items: center; gap: 10px; }
.t1 { font-size: 16px; font-weight: 700; color: #0e1020; }
.sub { font-size: 12px; color: #7b7e93; }
.name-cell { display: flex; align-items: center; }
.name-cell .name { font-weight: 600; color: #0e1020; }
.name-cell .key-tag {
  margin-left: 8px;
  font-size: 11px;
  color: #7b7e93;
  background: #f1f3fb;
  padding: 2px 6px;
  border-radius: 4px;
}
.unit { color: #7b7e93; font-size: 12px; }
.muted { color: #b5b9c9; }
</style>
