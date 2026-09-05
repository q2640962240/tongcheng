<template>
  <div class="page">
    <div class="page-header">
      <h2 class="title">礼物管理</h2>
    </div>

    <el-tabs v-model="activeTab" type="border-card" class="gift-tabs">
      <!-- Tab 1: 礼物列表管理 -->
      <el-tab-pane label="礼物列表" name="gifts">
        <div class="tab-toolbar">
          <el-button type="primary" @click="onCreateGift">+ 新增礼物</el-button>
        </div>

        <el-card class="card">
          <el-table :data="giftList" v-loading="giftLoading" stripe style="width: 100%">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column label="图片预览" width="120">
              <template #default="{ row }">
                <el-image
                  :src="row.imageUrl"
                  fit="contain"
                  style="width: 60px; height: 60px; border-radius: 8px"
                  :preview-src-list="[row.imageUrl]"
                  preview-teleported
                />
              </template>
            </el-table-column>
            <el-table-column prop="name" label="名称" min-width="150" />
            <el-table-column prop="price" label="钻石价格" width="120">
              <template #default="{ row }">
                <span class="diamond-text">💎 {{ row.price }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="sort" label="排序" width="80" />
            <el-table-column label="动画等级" width="120">
              <template #default="{ row }">
                <el-tag :type="['info','success','warning','danger'][row.animationLevel || 0]" size="small">
                  {{ ['无动画','小飘动','中横幅','全屏特效'][row.animationLevel || 0] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.active ? 'success' : 'info'" size="small">
                  {{ row.active ? '上架' : '下架' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="onEditGift(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="onDeleteGift(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 新增/编辑礼物弹窗 -->
        <el-dialog v-model="giftDlgVisible" :title="isEditGift ? '编辑礼物' : '新增礼物'" width="500px">
          <el-form :model="giftForm" label-width="100px">
            <el-form-item label="礼物名称">
              <el-input v-model="giftForm.name" placeholder="请输入礼物名称" maxlength="50" show-word-limit />
            </el-form-item>
            <el-form-item label="图片 URL">
              <el-input v-model="giftForm.imageUrl" placeholder="https:// 或 /uploads/..." />
            </el-form-item>
            <el-form-item label="钻石价格">
              <el-input-number v-model="giftForm.price" :min="1" :max="99999" />
            </el-form-item>
            <el-form-item label="排序权重">
              <el-input-number v-model="giftForm.sort" :min="0" :max="999" />
            </el-form-item>
            <el-form-item label="动画等级">
              <el-select v-model="giftForm.animationLevel" style="width: 100%">
                <el-option :value="0" label="0 - 无动画" />
                <el-option :value="1" label="1 - 小飘动（~2s）" />
                <el-option :value="2" label="2 - 中型横幅+光效" />
                <el-option :value="3" label="3 - 全屏特效" />
              </el-select>
            </el-form-item>
            <el-form-item label="上架状态">
              <el-switch v-model="giftForm.active" active-color="#d4af37" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="giftDlgVisible = false">取消</el-button>
            <el-button type="primary" @click="onSaveGift">保存</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <!-- Tab 2: 提现审核 -->
      <el-tab-pane label="提现审核" name="withdraw">
        <div class="tab-toolbar">
          <el-select v-model="withdrawStatus" placeholder="状态筛选" clearable style="width: 160px" @change="loadWithdrawals">
            <el-option label="待审核" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已拒绝" value="rejected" />
            <el-option label="全部" value="" />
          </el-select>
        </div>

        <el-card class="card">
          <el-table :data="withdrawList" v-loading="withdrawLoading" stripe style="width: 100%">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column label="用户" min-width="150">
              <template #default="{ row }">
                <div class="user-cell">
                  <el-avatar :size="28" :src="row.user?.avatar">{{ row.user?.nickname?.[0] || 'U' }}</el-avatar>
                  <span>{{ row.user?.nickname || `用户${row.userId}` }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="金额(钻石)" width="120">
              <template #default="{ row }">
                <span class="diamond-text">💎 {{ row.amount }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="申请时间" width="170" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.extra?.status)" size="small">
                  {{ statusLabel(row.extra?.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <template v-if="(row.extra?.status || 'pending') === 'pending'">
                  <el-button size="small" type="success" @click="onAuditWithdraw(row, 'approve')">通过</el-button>
                  <el-button size="small" type="danger" @click="onAuditWithdraw(row, 'reject')">拒绝</el-button>
                </template>
                <span v-else class="text-muted">已处理</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- Tab 3: 礼物记录 -->
      <el-tab-pane label="礼物记录" name="records">
        <div class="tab-toolbar">
          <el-input v-model="recordFilter.userId" placeholder="用户 ID" clearable style="width: 120px" />
          <el-date-picker v-model="recordFilter.dateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width: 260px" />
          <el-button type="primary" @click="loadRecords">查询</el-button>
        </div>

        <el-card class="card">
          <el-table :data="recordList" v-loading="recordLoading" stripe style="width: 100%">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column label="送礼人" min-width="120">
              <template #default="{ row }">
                <div class="user-cell">
                  <el-avatar :size="24" :src="row.sender?.avatar">{{ (row.sender?.nickname || 'U')[0] }}</el-avatar>
                  <span>{{ row.sender?.nickname || `用户${row.senderId}` }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="收礼人" min-width="120">
              <template #default="{ row }">
                <div class="user-cell">
                  <el-avatar :size="24" :src="row.receiver?.avatar">{{ (row.receiver?.nickname || 'U')[0] }}</el-avatar>
                  <span>{{ row.receiver?.nickname || `用户${row.receiverId}` }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="giftName" label="礼物" width="120" />
            <el-table-column prop="quantity" label="数量" width="70" />
            <el-table-column label="钻石" width="100">
              <template #default="{ row }">
                <span class="diamond-text">💎 {{ row.diamondAmount }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="时间" width="170" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- Tab 4: 系统配置 -->
      <el-tab-pane label="系统配置" name="config">
        <el-card class="card config-card">
          <el-form :model="configForm" label-width="140px" style="max-width: 500px">
            <el-form-item label="提现比例">
              <el-input-number v-model="configForm.withdrawRatio" :min="0" :max="1" :step="0.05" :precision="2" />
              <span class="config-hint">{{ Math.round((configForm.withdrawRatio || 0) * 100) }}%（用户实际到手比例）</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="onSaveConfig" :loading="configSaving">保存配置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { giftManageApi } from '../../api'

// ==================== 礼物列表 ====================
const activeTab = ref('gifts')
const giftList = ref([])
const giftLoading = ref(false)
const giftDlgVisible = ref(false)
const isEditGift = ref(false)
const giftForm = reactive({ id: null, name: '', imageUrl: '', price: 10, sort: 0, active: true, animationLevel: 1 })

const resetGiftForm = () => Object.assign(giftForm, { id: null, name: '', imageUrl: '', price: 10, sort: 0, active: true, animationLevel: 1 })

const loadGifts = async () => {
  giftLoading.value = true
  try {
    const r = await giftManageApi.list()
    giftList.value = r.list || r.rows || r || []
  } catch (e) { ElMessage.error('加载礼物列表失败: ' + (e.message || '')) }
  finally { giftLoading.value = false }
}

const onCreateGift = () => { isEditGift.value = false; resetGiftForm(); giftDlgVisible.value = true }
const onEditGift = (row) => { isEditGift.value = true; Object.assign(giftForm, JSON.parse(JSON.stringify(row))); giftDlgVisible.value = true }

const onSaveGift = async () => {
  if (!giftForm.name) return ElMessage.warning('请填写礼物名称')
  if (!giftForm.imageUrl) return ElMessage.warning('请填写图片 URL')
  if (!giftForm.price || giftForm.price < 1) return ElMessage.warning('钻石价格至少为 1')
  try {
    const payload = { ...giftForm }
    if (isEditGift.value) {
      await giftManageApi.update(giftForm.id, payload)
    } else {
      const { id, ...rest } = payload; // eslint-disable-line no-unused-vars
      await giftManageApi.create(rest)
    }
    ElMessage.success('已保存'); giftDlgVisible.value = false; loadGifts()
  } catch (e) { ElMessage.error('保存失败: ' + (e.message || '')) }
}

const onDeleteGift = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除礼物「${row.name}」？`, '删除确认', { type: 'warning' })
    await giftManageApi.delete(row.id)
    ElMessage.success('已删除'); loadGifts()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败: ' + (e.message || '')) }
}

// ==================== 提现审核 ====================
const withdrawList = ref([])
const withdrawLoading = ref(false)
const withdrawStatus = ref('pending')

const statusLabel = (s) => ({ pending: '待审核', approved: '已通过', rejected: '已拒绝' }[s] || '待审核')
const statusTagType = (s) => ({ pending: 'warning', approved: 'success', rejected: 'danger' }[s] || 'warning')

const loadWithdrawals = async () => {
  withdrawLoading.value = true
  try {
    const params = { page: 1, pageSize: 100 }
    if (withdrawStatus.value) params.status = withdrawStatus.value
    const r = await giftManageApi.withdrawList(params)
    withdrawList.value = r.list || r.rows || r || []
  } catch (e) { ElMessage.error('加载提现列表失败: ' + (e.message || '')) }
  finally { withdrawLoading.value = false }
}

const onAuditWithdraw = async (row, action) => {
  const label = action === 'approve' ? '通过' : '拒绝'
  try {
    await ElMessageBox.confirm(`确认${label}该提现申请？`, '审核确认', { type: action === 'approve' ? 'success' : 'warning' })
    await giftManageApi.withdrawAudit(row.id, { action })
    ElMessage.success(`已${label}`); loadWithdrawals()
  } catch (e) { if (e !== 'cancel') ElMessage.error('审核失败: ' + (e.message || '')) }
}

// ==================== 礼物记录 ====================
const recordList = ref([])
const recordLoading = ref(false)
const recordFilter = reactive({ userId: '', dateRange: null })

const loadRecords = async () => {
  recordLoading.value = true
  try {
    const params = { page: 1, pageSize: 100 }
    if (recordFilter.userId) params.userId = recordFilter.userId
    if (recordFilter.dateRange && recordFilter.dateRange.length === 2) {
      params.startDate = recordFilter.dateRange[0]
      params.endDate = recordFilter.dateRange[1]
    }
    const r = await giftManageApi.records(params)
    recordList.value = r.list || r.rows || r || []
  } catch (e) { ElMessage.error('加载礼物记录失败: ' + (e.message || '')) }
  finally { recordLoading.value = false }
}

// ==================== 系统配置 ====================
const configForm = reactive({ withdrawRatio: 0.7 })
const configSaving = ref(false)

const loadConfig = async () => {
  try {
    const r = await giftManageApi.getConfig()
    if (r && r.withdrawRatio !== undefined) configForm.withdrawRatio = Number(r.withdrawRatio)
  } catch (e) { /* 首次可能为空，保持默认 */ }
}

const onSaveConfig = async () => {
  configSaving.value = true
  try {
    await giftManageApi.updateConfig({ withdrawRatio: configForm.withdrawRatio })
    ElMessage.success('配置已保存')
  } catch (e) { ElMessage.error('保存失败: ' + (e.message || '')) }
  finally { configSaving.value = false }
}

// ==================== Tab 切换时按需加载 ====================
const tabLoadMap = { gifts: false, withdraw: false, records: false, config: false }

const loadByTab = (tab) => {
  if (tab === 'gifts' && !tabLoadMap.gifts) { loadGifts(); tabLoadMap.gifts = true }
  if (tab === 'withdraw' && !tabLoadMap.withdraw) { loadWithdrawals(); tabLoadMap.withdraw = true }
  if (tab === 'records' && !tabLoadMap.records) { loadRecords(); tabLoadMap.records = true }
  if (tab === 'config' && !tabLoadMap.config) { loadConfig(); tabLoadMap.config = true }
}

onMounted(() => { loadByTab('gifts') })

// 监听 tab 切换
watch(activeTab, (val) => loadByTab(val))
</script>

<style scoped>
.page { padding: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.title { margin: 0; font-size: 20px; }
.gift_tabs { background: transparent; border: none; }
.gift_tabs :deep(.el-tabs__content) { padding: 16px 0 0; }
.tab-toolbar { margin-bottom: 12px; display: flex; gap: 12px; align-items: center; }
.card { background: #fff; }
.diamond-text { color: #d4af37; font-weight: 600; }
.user-cell { display: flex; align-items: center; gap: 8px; }
.text-muted { color: #999; font-size: 13px; }
.config-card { max-width: 600px; }
.config-hint { margin-left: 12px; color: #666; font-size: 13px; }
</style>
