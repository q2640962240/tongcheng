<template>
  <div class="orders">
    <div class="page-card">
      <div class="filter-bar">
        <el-input v-model="filters.keyword" placeholder="订单号" clearable style="width: 240px" @keyup.enter="loadData" />
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 140px">
          <el-option v-for="(label, val) in statusMap" :key="val" :label="label" :value="val" />
        </el-select>
        <el-button type="primary" @click="loadData">查询</el-button>
      </div>
    </div>

    <div class="page-card">
      <el-table :data="list" v-loading="loading" border>
        <el-table-column prop="orderNo" label="订单号" width="220" />
        <el-table-column prop="serviceTitle" label="约玩" min-width="160" />
        <el-table-column prop="amount" label="金额(星币)" width="120" />
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusMap[row.status] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下单时间" width="180">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'refunding'"
              size="small"
              type="warning"
              @click="onRefund(row)"
            >退款</el-button>
            <el-button size="small" @click="onDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadData"
        @current-change="loadData"
        style="margin-top: 16px; justify-content: flex-end"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOrders, refundOrder } from '../../api'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', status: '' })

const statusMap = {
  pending: '待支付', paid: '已支付', serving: '服务中',
  completed: '已完成', cancelled: '已取消', refunding: '退款中', refunded: '已退款'
}
const statusType = (s) => ({
  pending: 'info', paid: '', serving: 'warning',
  completed: 'success', cancelled: 'info', refunding: 'warning', refunded: 'danger'
})[s] || 'info'

const formatTime = (ts) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await getOrders({ ...filters, page: page.value, pageSize: pageSize.value })
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally { loading.value = false }
}

const onRefund = async (row) => {
  try {
    await ElMessageBox.confirm(`确认退款订单 ${row.orderNo}?`, '退款确认', { type: 'warning' })
    await refundOrder(row.id)
    ElMessage.success('退款已完成')
    loadData()
  } catch (e) {}
}

const onDetail = (row) => ElMessage.info(`订单详情开发中：${row.orderNo}`)

onMounted(loadData)
</script>

<style lang="scss" scoped>
.filter-bar { display: flex; gap: 12px; align-items: center; }
</style>
