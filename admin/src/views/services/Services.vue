<template>
  <div class="services">
    <div class="page-card">
      <div class="filter-bar">
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 140px">
          <el-option label="待审核" value="pending" />
          <el-option label="已上线" value="online" />
          <el-option label="已下线" value="offline" />
          <el-option label="已拒绝" value="rejected" />
        </el-select>
        <el-select
          v-model="filters.category"
          placeholder="顶级分类"
          clearable
          style="width: 160px"
        >
          <el-option
            v-for="t in topCategories"
            :key="t.key"
            :label="`${t.name}${t.visible ? '' : '（已下架）'}`"
            :value="t.key"
          />
        </el-select>
        <el-select
          v-model="filters.subCategory"
          placeholder="子分类"
          clearable
          :disabled="!filters.category"
          style="width: 160px"
        >
          <el-option
            v-for="c in currentSubCategories"
            :key="c.key"
            :label="`${c.name}${c.visible ? '' : '（已下架）'}`"
            :value="c.key"
          />
        </el-select>
        <el-button type="primary" @click="loadData">查询</el-button>
        <div style="flex:1" />
        <el-button type="success" @click="openCreateDialog">+ 指定用户上架服务</el-button>
        <el-button link type="primary" @click="router.push('/services/categories')">前往分类管理 →</el-button>
      </div>
      <el-alert
        v-if="catLoading && !topCategories.length"
        type="info"
        :closable="false"
        show-icon
        title="正在加载服务分类…"
        style="margin-top: 12px;"
      />
      <el-alert
        v-else-if="!topCategories.length"
        type="warning"
        :closable="false"
        show-icon
        title="服务分类尚未初始化，筛选下拉使用内置兜底数据。建议前往分类管理初始化。"
        style="margin-top: 12px;"
      />
    </div>

    <div class="page-card">
      <el-table :data="list" v-loading="loading" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="服务标题" min-width="160" show-overflow-tooltip />
        <el-table-column label="顶级分类" width="120">
          <template #default="{ row }">
            <el-tag size="small" type="warning" effect="plain">{{ topName(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="子分类" width="120">
          <template #default="{ row }">
            <span>{{ subName(row.category, row.subCategory) || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="价格" width="140">
          <template #default="{ row }">
            <span class="price">¥{{ Number(row.price || 0).toFixed(0) }}</span>
            <span class="price-unit"> / {{ row.priceUnit || '单' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="服务者" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.provider?.nickname || `ID:${row.providerId}` }}
          </template>
        </el-table-column>
        <el-table-column prop="orderCount" label="订单数" width="90" />
        <el-table-column prop="ratingAvg" label="评分" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusMap[row.status] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button size="small" type="success" @click="onAudit(row, 'online')">通过</el-button>
              <el-button size="small" type="danger" @click="onAudit(row, 'rejected')">拒绝</el-button>
            </template>
            <el-button size="small" @click="onToggleOnline(row)">
              {{ row.status === 'online' ? '下线' : '上线' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadData"
        @current-change="loadData"
        style="margin-top: 16px; justify-content: flex-end"
      />
    </div>

    <!-- 指定用户上架服务 对话框 -->
    <el-dialog
      v-model="createDialog.visible"
      title="为指定用户上架服务"
      width="640px"
      :close-on-click-modal="false"
      @close="resetCreateForm"
    >
      <el-form :model="createForm" label-width="100px" ref="createFormRef" :rules="createRules">
        <el-form-item label="服务者" prop="userId">
          <el-select
            v-model="createForm.userId"
            filterable
            remote
            reserve-keyword
            placeholder="输入昵称或手机号搜索用户"
            :remote-method="remoteSearchUsers"
            :loading="createDialog.userLoading"
            style="width: 100%"
          >
            <el-option
              v-for="u in createDialog.userOptions"
              :key="u.id"
              :label="`${u.nickname || '-'}  (${u.phone || 'ID:' + u.id})${u.isElite ? '  ✨精英' : ''}`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="服务标题" prop="title">
          <el-input v-model="createForm.title" maxlength="80" show-word-limit placeholder="例如：王者荣耀钻石上分陪玩" />
        </el-form-item>
        <el-form-item label="服务分类" prop="category">
          <el-select v-model="createForm.category" placeholder="顶级分类" style="width: 48%" @change="createForm.subCategory = ''">
            <el-option v-for="t in topCategories" :key="t.key" :label="t.name" :value="t.key" />
          </el-select>
          <el-select
            v-model="createForm.subCategory"
            placeholder="子分类（可选）"
            :disabled="!createForm.category"
            style="width: 48%; margin-left: 4%"
          >
            <el-option v-for="c in subOptionsByCat(createForm.category)" :key="c.key" :label="c.name" :value="c.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="价格" prop="price">
          <el-input-number v-model="createForm.price" :min="0" :step="10" style="width: 180px" />
          <span style="margin-left: 12px; color: #909399;">单位：</span>
          <el-select v-model="createForm.priceUnit" style="width: 140px">
            <el-option label="次" value="次" />
            <el-option label="局" value="局" />
            <el-option label="小时" value="小时" />
            <el-option label="天" value="天" />
            <el-option label="单" value="单" />
          </el-select>
        </el-form-item>
        <el-form-item label="时长(分钟)" prop="duration">
          <el-input-number v-model="createForm.duration" :min="0" :step="15" placeholder="可选" style="width: 200px" />
        </el-form-item>
        <el-form-item label="服务封面" prop="coverImage">
          <el-input v-model="createForm.coverImage" placeholder="图片URL，留空则使用默认封面" clearable />
        </el-form-item>
        <el-form-item label="服务描述" prop="description">
          <el-input type="textarea" v-model="createForm.description" :rows="4" maxlength="500" show-word-limit placeholder="服务介绍、亮点、下单须知等" />
        </el-form-item>
        <el-form-item label="标签" prop="tagsText">
          <el-input v-model="createForm.tagsText" placeholder="多个标签用英文逗号分隔，如：开黑,上分,温柔声线" />
        </el-form-item>
        <el-form-item label="排序权重" prop="sort">
          <el-input-number v-model="createForm.sort" :min="0" :step="1" />
          <span style="margin-left: 12px; color: #909399;">数值越大越靠前</span>
        </el-form-item>
        <el-form-item label="初始状态" prop="status">
          <el-select v-model="createForm.status" style="width: 200px">
            <el-option label="直接上线（推荐）" value="online" />
            <el-option label="待审核" value="pending" />
            <el-option label="草稿" value="draft" />
            <el-option label="已下线" value="offline" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="createDialog.submitting" @click="submitCreateForm">确认上架</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getServices, auditService, serviceCategoriesApi, createServiceForUser, searchUsers } from '../../api'

const router = useRouter()
const loading = ref(false)
const catLoading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ status: '', category: '', subCategory: '' })

const LEGACY_TOP = [
  { key: 'warm', name: '暖心服务', visible: true },
  { key: 'game', name: '游戏陪玩', visible: true },
  { key: 'offline', name: '兴趣约玩', visible: true }
]
const LEGACY_SUB = {
  warm: [
    { key: 'virtual-lover', name: '虚拟恋人' },
    { key: 'sing', name: '给你唱歌' },
    { key: 'sleep', name: '哄睡电台' },
    { key: 'wake', name: '叫醒服务' }
  ],
  game: [
    { key: 'wzry', name: '王者荣耀' },
    { key: 'hpjy', name: '和平精英' },
    { key: 'lol', name: '英雄联盟' },
    { key: 'other-game', name: '其他游戏' }
  ],
  offline: [
    { key: 'sport', name: '运动健身' },
    { key: 'date', name: '同城约会' },
    { key: 'offline-game', name: '线下开黑' }
  ]
}

const categoryTree = ref([])
const topCategories = computed(() => {
  if (categoryTree.value && categoryTree.value.length) return categoryTree.value
  return LEGACY_TOP
})
const currentSubCategories = computed(() => {
  if (!filters.category) return []
  const t = categoryTree.value.find(t => t.key === filters.category)
  if (t && t.children) return t.children
  return LEGACY_SUB[filters.category] || []
})
const subOptionsByCat = (cat) => {
  if (!cat) return []
  const t = categoryTree.value.find(x => x.key === cat)
  if (t && t.children) return t.children
  return LEGACY_SUB[cat] || []
}

const topName = (key) => {
  const t = topCategories.value.find(t => t.key === key)
  return t ? t.name : (LEGACY_TOP.find(l => l.key === key)?.name || key)
}
const subName = (topKey, subKey) => {
  if (!subKey) return ''
  const t = categoryTree.value.find(t => t.key === topKey)
  if (t && t.children) {
    const s = t.children.find(s => s.key === subKey)
    if (s) return s.name
  }
  const list = LEGACY_SUB[topKey] || []
  const s = list.find(s => s.key === subKey)
  return s ? s.name : subKey
}

const statusMap = { pending: '待审核', online: '已上线', offline: '已下线', rejected: '已拒绝' }
const statusType = (s) => ({ pending: 'warning', online: 'success', offline: 'info', rejected: 'danger' })[s] || 'info'

const loadCategories = async () => {
  catLoading.value = true
  try {
    const res = await serviceCategoriesApi.list()
    categoryTree.value = (res.data?.tree) || []
  } catch (e) {
    categoryTree.value = []
  } finally {
    catLoading.value = false
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const payload = {
      status: filters.status || undefined,
      category: filters.category || undefined,
      subCategory: filters.subCategory || undefined,
      page: page.value,
      pageSize: pageSize.value
    }
    const res = await getServices(payload)
    list.value = res.data.list || []
    total.value = res.data.total || 0
  } catch (e) {
    ElMessage.error('加载服务列表失败')
  } finally {
    loading.value = false
  }
}

const onAudit = async (row, status) => {
  try {
    await auditService(row.id, { status, rejectReason: status === 'rejected' ? '平台审核未通过' : undefined })
    ElMessage.success(status === 'online' ? '已通过审核' : '已拒绝')
    loadData()
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

const onToggleOnline = async (row) => {
  const status = row.status === 'online' ? 'offline' : 'online'
  try {
    await auditService(row.id, { status })
    ElMessage.success('操作成功')
    loadData()
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

// ==================== 指定用户上架服务 ====================
const createDialog = reactive({
  visible: false,
  submitting: false,
  userLoading: false,
  userOptions: []
})
const createFormRef = ref(null)
const defaultCreateForm = () => ({
  userId: null,
  title: '',
  category: '',
  subCategory: '',
  price: 50,
  priceUnit: '次',
  duration: 60,
  coverImage: '',
  description: '',
  tagsText: '',
  sort: 0,
  status: 'online'
})
const createForm = reactive(defaultCreateForm())
const createRules = {
  userId: [{ required: true, message: '请选择服务者用户', trigger: 'change' }],
  title: [
    { required: true, message: '请输入服务标题', trigger: 'blur' },
    { min: 2, max: 80, message: '标题长度 2~80', trigger: 'blur' }
  ],
  category: [{ required: true, message: '请选择顶级分类', trigger: 'change' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }]
}

const openCreateDialog = () => {
  if (!topCategories.value || !topCategories.value.length) {
    ElMessage.warning('服务分类尚未初始化，请先前往分类管理初始化')
    return
  }
  createDialog.visible = true
  // 预加载用户列表前 20 个
  remoteSearchUsers('')
}

const resetCreateForm = () => {
  const df = defaultCreateForm()
  Object.keys(df).forEach(k => { createForm[k] = df[k] })
  createDialog.userOptions = []
  nextTick(() => createFormRef.value?.clearValidate())
}

let _userSearchTimer = null
const remoteSearchUsers = (query) => {
  clearTimeout(_userSearchTimer)
  _userSearchTimer = setTimeout(async () => {
    createDialog.userLoading = true
    try {
      const res = await searchUsers((query || '').trim(), 20)
      createDialog.userOptions = ((res.data && res.data.list) || []).map(u => ({
        id: u.id,
        nickname: u.nickname,
        phone: u.phone,
        isElite: !!u.isElite
      }))
    } catch (e) {
      createDialog.userOptions = []
    } finally {
      createDialog.userLoading = false
    }
  }, 300)
}

const submitCreateForm = async () => {
  if (!createFormRef.value) return
  try {
    await createFormRef.value.validate()
  } catch (_) { return }

  createDialog.submitting = true
  try {
    const tags = (createForm.tagsText || '')
      .split(/[,，]/)
      .map(s => s.trim())
      .filter(Boolean)
    const payload = {
      userId: Number(createForm.userId),
      title: createForm.title.trim(),
      description: createForm.description || '',
      category: createForm.category,
      subCategory: createForm.subCategory || null,
      coverImage: createForm.coverImage || null,
      price: Number(createForm.price) || 0,
      priceUnit: createForm.priceUnit || '次',
      duration: createForm.duration ? Number(createForm.duration) : null,
      tags: tags.length ? tags : null,
      sort: Number(createForm.sort) || 0,
      status: createForm.status
    }
    await createServiceForUser(payload)
    ElMessage.success('服务已成功上架')
    createDialog.visible = false
    resetCreateForm()
    loadData()
  } catch (e) {
    ElMessage.error(e?.message || '上架失败')
  } finally {
    createDialog.submitting = false
  }
}

onMounted(() => {
  loadCategories()
  loadData()
})
</script>

<style lang="scss" scoped>
.filter-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.price { color: #d4af37; font-weight: 700; font-size: 14px; }
.price-unit { color: #7b7e93; font-size: 12px; margin-left: 2px; }
</style>
