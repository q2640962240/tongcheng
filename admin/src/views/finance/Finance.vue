<template>
  <div class="finance">
    <el-row :gutter="16">
      <el-col :span="8">
        <div class="page-card stat">
          <div class="stat-label">累计充值</div>
          <div class="stat-value">¥{{ formatNum(stats.totalRecharge) }}</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="page-card stat">
          <div class="stat-label">累计提现</div>
          <div class="stat-value">¥{{ formatNum(stats.totalWithdraw) }}</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="page-card stat">
          <div class="stat-label">平台收入</div>
          <div class="stat-value">¥{{ formatNum(stats.platformIncome) }}</div>
        </div>
      </el-col>
    </el-row>

    <el-tabs v-model="activeTab" class="page-card">
      <!-- 收支明细 -->
      <el-tab-pane label="收支明细" name="transactions">
        <el-table :data="transactions" v-loading="loading" border>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column label="用户" min-width="120">
            <template #default="{ row }">{{ row.user?.nickname || '-' }}</template>
          </el-table-column>
          <el-table-column label="类型" width="120">
            <template #default="{ row }">
              <el-tag :type="typeTag(row.type)" size="small">{{ typeMap[row.type] || row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="140">
            <template #default="{ row }">
              {{ row.currency === 'fen' ? '¥' + formatNum(row.amount) : row.amount + ' 星币' }}
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.remark || '-' }}</template>
          </el-table-column>
          <el-table-column label="时间" width="180">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!loading && transactions.length === 0" description="暂无数据" />
      </el-tab-pane>

      <!-- 提现审核 -->
      <el-tab-pane name="withdrawals">
        <template #label>
          提现审核
          <el-badge v-if="pendingCount > 0" :value="pendingCount" class="tab-badge" />
        </template>
        <div class="filter-bar">
          <el-radio-group v-model="withdrawFilter.status" @change="loadWithdrawals">
            <el-radio-button label="pending">待审核</el-radio-button>
            <el-radio-button label="approved">待打款</el-radio-button>
            <el-radio-button label="paid">已打款</el-radio-button>
            <el-radio-button label="rejected">已拒绝</el-radio-button>
            <el-radio-button label="all">全部</el-radio-button>
          </el-radio-group>
        </div>
        <el-table :data="withdrawals" v-loading="withdrawLoading" border style="margin-top: 16px">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column label="用户" min-width="140">
            <template #default="{ row }">
              <div>{{ row.user?.nickname || '-' }}</div>
              <div class="muted">{{ row.user?.phone || '' }}</div>
            </template>
          </el-table-column>
          <el-table-column label="提现金额" width="140">
            <template #default="{ row }">
              <span class="amount-warn">¥{{ formatNum(row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="可提现余额" width="120">
            <template #default="{ row }">¥{{ formatNum(row.walletBalance || 0) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="withdrawStatusType(row.extra?.status || 'pending')" size="small">
                {{ withdrawStatusMap[row.extra?.status || 'pending'] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="备注/审核说明" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              <div>{{ row.remark || '-' }}</div>
              <div v-if="row.extra?.note" class="muted">审核备注：{{ row.extra.note }}</div>
            </template>
          </el-table-column>
          <el-table-column label="申请时间" width="180">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <template v-if="(row.extra?.status || 'pending') === 'pending'">
                <el-button size="small" type="primary" :loading="row._loading" @click="onAudit(row, 'approved')">通过</el-button>
                <el-button size="small" type="danger" :loading="row._loading" @click="onAudit(row, 'rejected')">拒绝</el-button>
              </template>
              <el-button v-else-if="row.extra?.status === 'approved'" size="small" type="success" :loading="row._loading" @click="onAudit(row, 'paid')">标记已打款</el-button>
              <span v-else class="muted">已处理</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!withdrawLoading && withdrawals.length === 0" description="暂无提现申请" />
      </el-tab-pane>
    </el-tabs>

    <!-- 提现审核弹窗（拒绝时填写理由） -->
    <el-dialog v-model="auditDialog.visible" :title="auditDialogTitle" width="480px" :close-on-click-modal="false">
      <div class="audit-body">
        <div class="audit-row">
          <span class="audit-label">用户</span>
          <span>{{ auditDialog.row?.user?.nickname || '-' }}（{{ auditDialog.row?.user?.phone || '-' }}）</span>
        </div>
        <div class="audit-row">
          <span class="audit-label">提现金额</span>
          <span class="amount-warn">¥{{ formatNum(auditDialog.row?.amount || 0) }}</span>
        </div>
        <div class="audit-row" v-if="auditDialog.status === 'rejected'">
          <span class="audit-label">拒绝理由</span>
          <el-input
            v-model="auditDialog.note"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请填写拒绝理由（用户可见）"
          />
        </div>
        <div class="audit-row" v-else-if="auditDialog.status === 'paid'">
          <span class="audit-label">打款备注</span>
          <el-input
            v-model="auditDialog.note"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="可填写打款流水号或备注（选填）"
          />
        </div>
        <el-alert
          v-if="auditDialog.status === 'rejected'"
          type="warning"
          title="拒绝后将自动退还用户可提现金额"
          :closable="false"
          style="margin-top: 12px"
        />
      </div>
      <template #footer>
        <el-button @click="auditDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="auditDialog.saving" @click="onSubmitAudit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getDashboard, getFinanceTransactions, getWithdrawals, auditWithdrawal } from '../../api'

const activeTab = ref('transactions')

// 收支明细
const loading = ref(false)
const stats = ref({ totalRecharge: 0, totalWithdraw: 0, platformIncome: 0 })
const transactions = ref([])

const typeMap = {
  recharge: '充值', exchange: '兑换', consume: '消费', income: '收入',
  withdraw: '提现', refund: '退款', reward: '奖励'
}
const typeTag = (t) => ({
  recharge: 'success', income: 'success', reward: 'success',
  withdraw: 'warning', consume: 'info', refund: 'danger', exchange: ''
})[t] || 'info'

// 提现审核
const withdrawLoading = ref(false)
const withdrawals = ref([])
const pendingCount = ref(0)
const withdrawFilter = reactive({ status: 'pending' })

const withdrawStatusMap = { pending: '待审核', approved: '待打款', paid: '已打款', rejected: '已拒绝' }
const withdrawStatusType = (s) => ({ pending: 'warning', approved: 'primary', paid: 'success', rejected: 'danger' })[s] || 'info'

const auditDialog = reactive({
  visible: false,
  saving: false,
  row: null,
  status: 'approved',
  note: ''
})

const auditDialogTitle = computed(() => {
  const map = { approved: '通过提现申请', rejected: '拒绝提现申请', paid: '标记已打款' }
  return map[auditDialog.status] || '提现审核'
})

const formatNum = (n) => (Number(n) / 100).toFixed(2)
const formatTime = (ts) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const loadData = async () => {
  loading.value = true
  try {
    const [dash, tx] = await Promise.all([
      getDashboard(),
      getFinanceTransactions({ page: 1, pageSize: 50 })
    ])
    stats.value = {
      totalRecharge: dash.data.totalRecharge || 0,
      totalWithdraw: dash.data.totalWithdraw || 0,
      platformIncome: dash.data.platformIncome || 0
    }
    transactions.value = tx.data.list
  } catch (e) {} finally {
    loading.value = false
  }
}

const loadWithdrawals = async () => {
  withdrawLoading.value = true
  try {
    const res = await getWithdrawals({ status: withdrawFilter.status, page: 1, pageSize: 50 })
    withdrawals.value = (res.data.list || []).map(t => ({ ...t, _loading: false }))
  } catch (e) {} finally {
    withdrawLoading.value = false
  }
}

const loadPendingCount = async () => {
  try {
    const res = await getWithdrawals({ status: 'pending', page: 1, pageSize: 1 })
    pendingCount.value = res.data.total || 0
  } catch (e) {}
}

const onAudit = (row, status) => {
  auditDialog.row = row
  auditDialog.status = status
  auditDialog.note = ''
  // 通过/已打款 无需弹窗输入理由，直接二次确认即可
  if (status === 'approved') {
    ElMessageBox.confirm(`确认通过「${row.user?.nickname || ''}」的提现申请 ¥${formatNum(row.amount)}？`, '提现审核', {
      type: 'warning',
      confirmButtonText: '确认通过',
      cancelButtonText: '取消'
    }).then(async () => {
      await doAudit(row, status, '')
    }).catch(() => {})
  } else {
    auditDialog.visible = true
  }
}

const onSubmitAudit = async () => {
  if (auditDialog.status === 'rejected' && !auditDialog.note) {
    ElMessage.warning('请填写拒绝理由')
    return
  }
  await doAudit(auditDialog.row, auditDialog.status, auditDialog.note)
  auditDialog.visible = false
}

const doAudit = async (row, status, note) => {
  row._loading = true
  try {
    await auditWithdrawal(row.id, { status, note })
    ElMessage.success(status === 'approved' ? '已通过，待打款' : status === 'paid' ? '已标记打款' : '已拒绝并退款')
    loadWithdrawals()
    loadPendingCount()
  } catch (e) {} finally {
    row._loading = false
  }
}

onMounted(() => {
  loadData()
  loadWithdrawals()
  loadPendingCount()
})
</script>

<style lang="scss" scoped>
.stat { text-align: center; }
.stat-label { font-size: 14px; color: #737373; margin-bottom: 8px; }
.stat-value { font-size: 32px; font-weight: 700; color: #ef4444; }
.filter-bar { display: flex; gap: 12px; margin-bottom: 12px; }
.muted { color: #737373; font-size: 12px; }
.amount-warn { color: #ef4444; font-weight: 600; }
.tab-badge { margin-left: 6px; }
.audit-body { padding: 0 4px; }
.audit-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
.audit-label { width: 80px; color: #737373; font-size: 14px; flex-shrink: 0; }
</style>
