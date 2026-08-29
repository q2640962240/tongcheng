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
      <el-table :data="list" v-loading="loading" border>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getServices, auditService, serviceCategoriesApi } from '../../api'

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
