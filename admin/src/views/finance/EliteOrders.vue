<template>
  <div class="page">
    <div class="page-header">
      <h2 class="title">精英订单</h2>
      <div class="toolbar">
        <el-input v-model="kw" placeholder="搜索UID/订单号" clearable style="width: 260px" @keyup.enter="onSearch" />
        <el-select v-model="channelFilter" clearable placeholder="支付渠道" style="width: 140px">
          <el-option label="微信" value="wxpay" />
          <el-option label="支付宝" value="alipay" />
          <el-option label="开发环境" value="dev" />
        </el-select>
        <el-select v-model="statusFilter" clearable placeholder="订单状态" style="width: 140px">
          <el-option label="待支付" value="pending" />
          <el-option label="已支付" value="paid" />
          <el-option label="已取消" value="canceled" />
          <el-option label="已退款" value="refunded" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="onExport">导出 CSV</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="stat-row">
      <el-col :span="6"><el-card class="stat-card"><div class="stat-label">总订单数</div><div class="stat-value">{{ stats.total }}</div></el-card></el-col>
      <el-col :span="6"><el-card class="stat-card"><div class="stat-label">已支付</div><div class="stat-value gold">{{ stats.paidCount }}</div></el-card></el-col>
      <el-col :span="6"><el-card class="stat-card"><div class="stat-label">收入总额（元）</div><div class="stat-value gold">¥ {{ stats.revenue.toFixed(2) }}</div></el-card></el-col>
      <el-col :span="6"><el-card class="stat-card"><div class="stat-label">今日新增</div><div class="stat-value">{{ stats.today }}</div></el-card></el-col>
    </el-row>

    <el-card class="card">
      <el-table :data="list" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="outTradeNo" label="商户订单号" min-width="200" show-overflow-tooltip />
        <el-table-column label="用户" width="140">
          <template #default="{ row }">
            <div>
              <div class="u-name">{{ row.userName || ('U' + row.userId) }}</div>
              <div class="u-sub">UID: {{ row.userId }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额(元)" width="100">
          <template #default="{ row }">¥ {{ (Number(row.amount) / 100).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="channel" label="渠道" width="110">
          <template #default="{ row }">
            <el-tag size="small">{{ channelText(row.channel) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status || 'pending')" size="small">{{ statusText(row.status || 'pending') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="transactionId" label="第三方单号" min-width="180" show-overflow-tooltip />
        <el-table-column prop="paidAt" label="支付时间" width="170" />
        <el-table-column prop="createdAt" label="下单时间" width="170" />
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { eliteOrdersApi } from '../../api'

const list = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const kw = ref('')
const channelFilter = ref('')
const statusFilter = ref('')
const stats = reactive({ total: 0, paidCount: 0, revenue: 0, today: 0 })

const statusText = (s) => ({ pending: '待支付', paid: '已支付', canceled: '已取消', refunded: '已退款' }[s] || s)
const statusTag = (s) => ({ pending: 'warning', paid: 'success', canceled: 'info', refunded: 'danger' }[s] || 'info')
const channelText = (c) => ({ wxpay: '微信', alipay: '支付宝', dev: 'Dev', mock: '模拟' }[c] || (c || '-'))

const load = async () => {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (kw.value) params.kw = kw.value
    if (channelFilter.value) params.channel = channelFilter.value
    if (statusFilter.value) params.status = statusFilter.value
    const r = await eliteOrdersApi.list(params)
    list.value = r.list || r.rows || []
    total.value = Number(r.total || 0)
    const st = r.stats || {}
    stats.total = st.total || 0
    stats.paidCount = st.paidCount || 0
    stats.revenue = (st.revenueFen || 0) / 100
    stats.today = st.today || 0
  } catch (e) { ElMessage.error('加载失败: ' + (e.message || '')) }
  finally { loading.value = false }
}
const onSearch = () => { page.value = 1; load() }

const onExport = () => {
  // 前端简易 CSV 导出（筛选当前页即可，最低要求）
  const head = ['ID', '订单号', 'UID', '金额(分)', '渠道', '状态', '支付时间', '下单时间']
  const rows = list.value.map(o => [o.id, o.outTradeNo, o.userId, o.amount, o.channel, o.status, o.paidAt || '', o.createdAt || ''])
  const csv = [head, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `elite-orders-${Date.now()}.csv`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  ElMessage.success('CSV 已导出（当前页）')
}

onMounted(load)
</script>

<style scoped>
.page { padding: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.title { margin: 0; font-size: 20px; }
.toolbar { display: flex; gap: 8px; align-items: center; }
.card { background: #fff; }
.stat-row { margin-bottom: 16px; }
.stat-card { text-align: center; }
.stat-label { color: #909399; font-size: 13px; margin-bottom: 6px; }
.stat-value { font-size: 24px; font-weight: 700; }
.stat-value.gold { color: #d4af37; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.u-name { font-weight: 600; }
.u-sub { font-size: 12px; color: #909399; }
</style>
