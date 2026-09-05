<template>
  <div class="users">
    <div class="page-card">
      <div class="filter-bar">
        <el-input
          v-model="filters.keyword"
          placeholder="搜索昵称/手机号"
          clearable
          style="width: 240px"
          @keyup.enter="loadData"
        />
        <el-select v-model="filters.isElite" placeholder="精英认证" clearable style="width: 140px">
          <el-option label="精英" :value="true" />
          <el-option label="普通" :value="false" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 120px">
          <el-option label="正常" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-select v-model="filters.userType" placeholder="用户类型" clearable style="width: 140px">
          <el-option label="真人用户" value="real" />
          <el-option label="AI 用户" value="ai" />
        </el-select>
        <el-button type="primary" @click="loadData">查询</el-button>
        <div style="flex: 1" />
        <el-button type="warning" @click="openCreate">+ 新增用户</el-button>
      </div>
    </div>

    <div class="page-card">
      <el-table :data="list" v-loading="loading" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.userType === 'ai'" type="danger" size="small" effect="plain">AI</el-tag>
            <el-tag v-else type="success" size="small" effect="plain">真人</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="头像" width="70" align="center">
          <template #default="{ row }">
            <el-avatar :size="36" :src="row.avatar">{{ row.nickname?.[0] }}</el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="phone" label="手机号" width="135" />
        <el-table-column label="性别" width="70" align="center">
          <template #default="{ row }">
            {{ ['未知', '男', '女'][row.gender] || '未知' }}
          </template>
        </el-table-column>
        <el-table-column label="精英" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isElite" type="warning" size="small">精英</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="city" label="城市" width="100" show-overflow-tooltip />
        <el-table-column prop="inviteCode" label="邀请码" width="120" />
        <el-table-column label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="onDetail(row)">详情</el-button>
            <el-button
              size="small"
              link
              :type="row.status === 1 ? 'danger' : 'success'"
              @click="onToggleStatus(row)"
            >{{ row.status === 1 ? '封禁' : '解封' }}</el-button>
            <el-button
              v-if="!row.isElite"
              size="small"
              link
              type="warning"
              @click="onApproveElite(row)"
            >通过精英</el-button>
            <el-button
              size="small"
              link
              type="info"
              @click="openEdit(row)"
            >编辑</el-button>
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

    <!-- ================= 用户详情 Dialog ================= -->
    <el-dialog
      v-model="detailVisible"
      :title="detailLoading ? '加载详情…' : `用户详情 · ${detail.nickname || ''}`"
      width="680px"
      destroy-on-close
    >
      <div v-loading="detailLoading" class="detail">
        <template v-if="!detailLoading && detail.id">
          <!-- 基本信息 -->
          <div class="detail-section">
            <div class="section-title">基础信息</div>
            <el-descriptions :column="2" border size="default">
              <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
              <el-descriptions-item label="类型">
                <el-tag v-if="detail.userType === 'ai'" type="danger" effect="plain" size="small">AI 用户</el-tag>
                <el-tag v-else type="success" effect="plain" size="small">真人用户</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="昵称">{{ detail.nickname || '-' }}</el-descriptions-item>
              <el-descriptions-item label="手机号">{{ detail.phone || '-' }}</el-descriptions-item>
              <el-descriptions-item label="性别">
                {{ ['未知', '男', '女'][detail.gender] || '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="城市">{{ detail.city || '-' }}</el-descriptions-item>
              <el-descriptions-item label="精英">
                <el-tag v-if="detail.isElite" type="warning" size="small">精英</el-tag>
                <span v-else>普通</span>
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="detail.status === 1 ? 'success' : 'danger'" size="small">
                  {{ detail.status === 1 ? '正常' : '禁用' }}
                </el-tag>
                <span v-if="detail.status !== 1 && detail.meta?.banReason" style="margin-left: 8px; color: #f56c6c; font-size: 13px;">
                  原因：{{ detail.meta.banReason }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="简介" :span="2">{{ detail.bio || '-' }}</el-descriptions-item>
              <el-descriptions-item label="邀请码">{{ detail.inviteCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="注册时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
              <el-descriptions-item label="最近登录">{{ formatTime(detail.lastLoginAt) || '-' }}</el-descriptions-item>
              <el-descriptions-item label="实名认证">
                {{ certLabel(detail.realPersonStatus) }}
              </el-descriptions-item>
              <el-descriptions-item label="身份认证">
                {{ certLabel(detail.identityStatus) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 钱包 -->
          <div class="detail-section">
            <div class="section-title">钱包信息</div>
            <div v-if="detail.wallet" class="wallet-grid">
              <div class="w-card">
                <div class="w-num">💎 {{ detail.wallet.diamond || 0 }}</div>
                <div class="w-label">钻石</div>
              </div>
              <div class="w-card">
                <div class="w-num">⭐ {{ detail.wallet.starCoin || 0 }}</div>
                <div class="w-label">星币</div>
              </div>
              <div class="w-card">
                <div class="w-num">¥ {{ yuan(detail.wallet.income) }}</div>
                <div class="w-label">可提现</div>
              </div>
              <div class="w-card">
                <div class="w-num">¥ {{ yuan(detail.wallet.totalWithdraw) }}</div>
                <div class="w-label">累计提现</div>
              </div>
            </div>
            <el-empty v-else description="暂无钱包数据" :image-size="80" />
          </div>

          <!-- 统计 -->
          <div class="detail-section">
            <div class="section-title">业务统计</div>
            <el-row :gutter="16">
              <el-col :span="8">
                <div class="stat-card">
                  <div class="stat-num">{{ detail.inviteeCount || 0 }}</div>
                  <div class="stat-label">邀请用户</div>
                </div>
              </el-col>
              <el-col :span="8">
                <div class="stat-card">
                  <div class="stat-num">{{ detail.orderCount || 0 }}</div>
                  <div class="stat-label">订单总数</div>
                </div>
              </el-col>
              <el-col :span="8">
                <div class="stat-card">
                  <div class="stat-num">{{ detail.hasPassword ? '已设置' : '未设置' }}</div>
                  <div class="stat-label">登录密码</div>
                </div>
              </el-col>
            </el-row>
          </div>

          <!-- 礼物数据 -->
          <div class="detail-section">
            <div class="section-title">礼物数据</div>
            <el-row :gutter="16">
              <el-col :span="8">
                <div class="stat-card">
                  <div class="stat-num">{{ detail.sentCount || 0 }}</div>
                  <div class="stat-label">送出礼物</div>
                </div>
              </el-col>
              <el-col :span="8">
                <div class="stat-card">
                  <div class="stat-num">{{ detail.receivedCount || 0 }}</div>
                  <div class="stat-label">收到礼物</div>
                </div>
              </el-col>
              <el-col :span="8">
                <div class="stat-card">
                  <div class="stat-num">🌟 {{ detail.charmValue || 0 }}</div>
                  <div class="stat-label">魅力值</div>
                </div>
              </el-col>
            </el-row>
            <el-row :gutter="16" style="margin-top: 12px;">
              <el-col :span="12">
                <div class="stat-card">
                  <div class="stat-num">💎 {{ detail.totalSentDiamond || 0 }}</div>
                  <div class="stat-label">累计送出钻石</div>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="stat-card">
                  <div class="stat-num">💰 {{ yuan(detail.totalReceivedDiamond) }}</div>
                  <div class="stat-label">累计收到钻石</div>
                </div>
              </el-col>
            </el-row>
          </div>

          <!-- 余额调整 -->
          <div class="detail-section">
            <div class="section-title">余额调整</div>
            <el-form :inline="true" size="default" style="margin-bottom: 12px;">
              <el-form-item label="货币">
                <el-select v-model="adjustForm.currency" style="width: 140px;">
                  <el-option label="钻石" value="diamond" />
                  <el-option label="礼物收入" value="giftIncome" />
                </el-select>
              </el-form-item>
              <el-form-item label="金额">
                <el-input-number v-model="adjustForm.delta" :precision="0" style="width: 160px;" placeholder="正数增加，负数扣减" />
              </el-form-item>
              <el-form-item label="备注">
                <el-input v-model="adjustForm.remark" placeholder="调整原因" style="width: 180px;" />
              </el-form-item>
              <el-form-item>
                <el-button type="warning" :loading="adjustSubmitting" @click="onAdjustBalance">确认调整</el-button>
              </el-form-item>
            </el-form>
            <el-table :data="balanceHistory" size="small" border v-loading="historyLoading" style="width: 100%;">
              <el-table-column prop="createdAt" label="时间" width="170">
                <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column label="货币" width="100">
                <template #default="{ row }">{{ row.extra?.currency === 'diamond' ? '钻石' : '礼物收入' }}</template>
              </el-table-column>
              <el-table-column label="变动" width="120">
                <template #default="{ row }">
                  <span :style="{ color: row.amount > 0 ? '#67c23a' : '#f56c6c' }">
                    {{ row.amount > 0 ? '+' : '' }}{{ row.amount }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="balanceAfter" label="调整后" width="120" />
              <el-table-column prop="remark" label="备注" show-overflow-tooltip />
            </el-table>
          </div>

          <!-- AI 用户专属配置 -->
          <div v-if="detail.userType === 'ai'" class="detail-section">
            <div class="section-title">AI 接入配置</div>
            <el-descriptions :column="1" border size="default">
              <el-descriptions-item label="接入厂商">
                {{ { none: '未接入', deepseek: 'DeepSeek（官方默认）', openai: 'OpenAI 兼容', custom: '自定义 API' }[detail.aiProvider] || detail.aiProvider }}
              </el-descriptions-item>
              <el-descriptions-item label="API 地址">{{ aiCfg.apiUrl || '-' }}</el-descriptions-item>
              <el-descriptions-item label="Model">{{ aiCfg.model || '-' }}</el-descriptions-item>
              <el-descriptions-item label="Temperature">{{ aiCfg.temperature || '0.8' }}</el-descriptions-item>
              <el-descriptions-item label="API Key">
                {{ aiCfg.apiKey ? maskSecret(aiCfg.apiKey) : '未配置' }}
              </el-descriptions-item>
              <el-descriptions-item label="System Prompt">
                <div style="white-space: pre-wrap; line-height: 1.6;">
                  {{ aiCfg.systemPrompt || '（未设置，将使用默认聊天角色）' }}
                </div>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </template>
        <el-empty v-if="!detailLoading && !detail.id" description="用户不存在" />
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="detail.id" @click="openEdit(detail)">编辑用户</el-button>
        <el-button
          v-if="detail.id && detail.status === 1"
          type="danger"
          @click="onToggleStatus(detail); detailVisible = false"
        >封禁</el-button>
        <el-button
          v-if="detail.id && detail.status !== 1"
          type="success"
          @click="onToggleStatus(detail); detailVisible = false"
        >解封</el-button>
        <el-button
          v-if="detail.id && !detail.isElite"
          type="warning"
          @click="onApproveElite(detail); detailVisible = false"
        >通过精英</el-button>
      </template>
    </el-dialog>

    <!-- ================= 新建 / 编辑用户 Dialog ================= -->
    <el-dialog
      v-model="formVisible"
      :title="formMode === 'create' ? '新增用户' : '编辑用户'"
      width="620px"
      destroy-on-close
      @close="resetForm"
    >
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="120px">
        <el-form-item label="用户类型" prop="userType">
          <el-radio-group v-model="form.userType" :disabled="formMode === 'edit'">
            <el-radio value="real">真人用户</el-radio>
            <el-radio value="ai">AI 用户（可接入 LLM API 自动聊天）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" maxlength="20" placeholder="用户昵称" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" maxlength="11" :placeholder="form.userType === 'ai' ? '可留空（自动生成）' : '真人手机号 11 位'" />
          <div style="font-size: 12px; color: #909399; margin-top: 4px;">
            真人用户必填；AI 用户不填时系统将自动生成唯一占位手机号
          </div>
        </el-form-item>
        <el-form-item label="头像">
          <el-input v-model="form.avatar" placeholder="头像 URL（可选）" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio :value="0">未知</el-radio>
            <el-radio :value="1">男</el-radio>
            <el-radio :value="2">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="所在城市">
          <el-input v-model="form.city" placeholder="如：北京" maxlength="20" />
        </el-form-item>
        <el-form-item label="个人简介">
          <el-input v-model="form.bio" type="textarea" :rows="2" maxlength="200" placeholder="一句话介绍" />
        </el-form-item>

        <!-- 密码字段：real / ai 用户都能设置（管理员可使用 AI 账号登录用户端测试/运营） -->
        <el-form-item label="登录密码">
          <el-input
            v-model="form.password"
            :type="showPwd ? 'text' : 'password'"
            :placeholder="formMode === 'create' ? (form.userType === 'real' ? '设置登录密码（6-32 位）' : '可选：为 AI 用户设置管理员登录密码（6-32 位）') : '不填则不修改密码（AI 用户也可填写 6-32 位新密码直接设置）'"
            maxlength="32"
            show-password
          >
            <template #append>
              <el-button @click="showPwd = !showPwd">{{ showPwd ? '隐藏' : '显示' }}</el-button>
            </template>
          </el-input>
          <div style="font-size: 12px; color: #909399; margin-top: 4px;">
            为 AI 用户设置密码后，管理员可在用户端以「手机号 + 密码」登录该账号，用于测试或运营模拟
          </div>
        </el-form-item>

        <el-form-item label="业务标签">
          <el-checkbox v-model="form.isProvider">发布者（可接单）</el-checkbox>
          <el-checkbox v-model="form.isElite" style="margin-left: 16px;">精英认证</el-checkbox>
        </el-form-item>

        <!-- AI 用户专属：API 接入 -->
        <template v-if="form.userType === 'ai'">
          <el-divider content-position="left">AI 接入配置（留空则不自动回复）</el-divider>
          <el-form-item label="接入厂商" prop="aiProvider">
            <el-select v-model="form.aiProvider" style="width: 260px;">
              <el-option label="DeepSeek（推荐，国内稳定）" value="deepseek" />
              <el-option label="OpenAI" value="openai" />
              <el-option label="自定义 API（兼容 OpenAI 协议）" value="custom" />
            </el-select>
          </el-form-item>
          <el-form-item label="API 地址">
            <el-input
              v-model="form.aiConfig.apiUrl"
              :placeholder="form.aiProvider === 'deepseek' ? 'https://api.deepseek.com/v1/chat/completions（推荐：可留空自动填充）' : 'https://api.openai.com/v1/chat/completions'"
            />
          </el-form-item>
          <el-form-item label="API Key">
            <el-input
              v-model="form.aiConfig.apiKey"
              type="password"
              show-password
              placeholder="sk-xxxxxxxxxxxxxxxx （DeepSeek 只填 Key 即可自动生效）"
            />
          </el-form-item>
          <el-form-item label="Model">
            <el-input
              v-model="form.aiConfig.model"
              :placeholder="form.aiProvider === 'deepseek' ? 'deepseek-chat（默认）' : 'gpt-3.5-turbo / gpt-4o-mini / deepseek-chat'"
            />
          </el-form-item>
          <el-form-item label="Temperature">
            <el-slider
              v-model="form.aiConfig.temperature"
              :min="0" :max="2" :step="0.1"
              style="width: 360px;"
            />
            <span style="margin-left: 16px; color: #606266;">{{ form.aiConfig.temperature }}</span>
          </el-form-item>
          <el-form-item label="System Prompt">
            <el-input
              v-model="form.aiConfig.systemPrompt"
              type="textarea"
              :rows="4"
              maxlength="1000"
              placeholder="AI 的角色设定，例如：你是白夜平台的陪伴聊天用户小葵，性格温柔可爱..."
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="formSubmitting" @click="submitForm">
          {{ formMode === 'create' ? '创建用户' : '保存修改' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getUsers, getUserDetail, createUser, updateUser,
  updateUserStatus, auditElite, adjustBalance, getBalanceHistory
} from '../../api'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', isElite: '', status: '', userType: '' })

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
const yuan = (fen) => (Number(fen) / 100).toFixed(2)
const maskSecret = (s) => {
  s = String(s || '')
  if (s.length <= 6) return s
  return `${s.slice(0, 3)}****${s.slice(-3)}`
}
const certLabel = (s) => ({
  none: '未提交', pending: '审核中', passed: '已通过', rejected: '已拒绝'
}[s] || '未提交')

/* -------- 列表加载 + 筛选（兼容 userType 字段） -------- */
const loadData = async () => {
  loading.value = true
  try {
    const res = await getUsers({ ...filters, page: page.value, pageSize: pageSize.value })
    const rows = res.data.list || []
    // 本地再按 userType 过滤（后端 JSON 驱动在 JSON 模式下未建立该字段索引时，直接返回；这里再兜底一层）
    const filtered = filters.userType
      ? rows.filter(r => (r.userType || 'real') === filters.userType)
      : rows
    list.value = filtered
    total.value = filters.userType ? filtered.length : (res.data.total || rows.length)
  } catch (e) {} finally {
    loading.value = false
  }
}

onMounted(loadData)

const onToggleStatus = async (row) => {
  const isBanning = row.status === 1
  try {
    await ElMessageBox.confirm(`确认${isBanning ? '封禁' : '解封'}用户 ${row.nickname}?`, '提示', { type: 'warning' })
    let reason = ''
    if (isBanning) {
      try {
        const { value } = await ElMessageBox.prompt('请输入封禁原因（可选）', '封禁原因', {
          confirmButtonText: '确定', cancelButtonText: '跳过', inputPlaceholder: '封禁原因', type: 'warning'
        })
        reason = value || ''
      } catch (_) { /* 跳过 */ }
    }
    await updateUserStatus(row.id, isBanning ? 0 : 1, reason)
    ElMessage.success('操作成功')
    loadData()
    if (detail.value && Number(detail.value.id) === Number(row.id)) {
      detail.value.status = isBanning ? 0 : 1
    }
  } catch (e) {}
}

const onApproveElite = async (row) => {
  try {
    await ElMessageBox.confirm(`确认通过 ${row.nickname} 的精英认证?`, '精英认证审核', { type: 'warning' })
    await auditElite(row.id, true)
    ElMessage.success('已通过精英认证')
    loadData()
    if (detail.value && Number(detail.value.id) === Number(row.id)) {
      detail.value.isElite = true
    }
  } catch (e) {}
}

/* ================= 用户详情 ================= */
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref({})
const aiCfg = computed(() => {
  const c = detail.value && detail.value.aiConfig
  return c && typeof c === 'object' ? c : {}
})

const onDetail = async (row) => {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = {}
  try {
    const res = await getUserDetail(row.id)
    detail.value = (res.data) || {}
    loadBalanceHistory(row.id)
  } catch (e) {
    ElMessage.error('加载用户详情失败')
  } finally {
    detailLoading.value = false
  }
}

const adjustForm = reactive({ currency: 'diamond', delta: 0, remark: '' })
const adjustSubmitting = ref(false)
const balanceHistory = ref([])
const historyLoading = ref(false)

const loadBalanceHistory = async (userId) => {
  historyLoading.value = true
  try {
    const res = await getBalanceHistory(userId || detail.value.id)
    balanceHistory.value = res.data?.list || []
  } catch (e) { balanceHistory.value = [] } finally {
    historyLoading.value = false
  }
}

const onAdjustBalance = async () => {
  if (!adjustForm.delta) return ElMessage.warning('请输入调整金额')
  const label = adjustForm.currency === 'diamond' ? '钻石' : '礼物收入'
  const action = adjustForm.delta > 0 ? '增加' : '扣减'
  try {
    await ElMessageBox.confirm(`确认${action} ${Math.abs(adjustForm.delta)} ${label}？`, '余额调整', { type: 'warning' })
    adjustSubmitting.value = true
    await adjustBalance(detail.value.id, { ...adjustForm })
    ElMessage.success('余额调整成功')
    adjustForm.delta = 0
    adjustForm.remark = ''
    await loadBalanceHistory()
    const res = await getUserDetail(detail.value.id)
    detail.value = (res.data) || {}
  } catch (e) {} finally {
    adjustSubmitting.value = false
  }
}

/* ================= 新建 / 编辑用户 ================= */
const formVisible = ref(false)
const formMode = ref('create') // create | edit
const formSubmitting = ref(false)
const showPwd = ref(false)
const formRef = ref(null)
// 编辑模式 target id 跟踪（用于提交）
const currentEditingId = ref(null)

const defaultForm = () => ({
  userType: 'real',
  phone: '',
  nickname: '',
  avatar: '',
  gender: 0,
  city: '',
  bio: '',
  isProvider: false,
  isElite: false,
  aiProvider: 'deepseek',
  password: '',
  aiConfig: {
    apiKey: '',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    temperature: 0.8,
    systemPrompt: '你是"白夜"伴玩平台的一位用户，正在与用户进行自然聊天回复。请保持友善、温柔、有趣的语气，回复控制在 50-200 字之间，不要透露自己是 AI。'
  }
})
const form = reactive(defaultForm())

const resetForm = () => {
  Object.assign(form, defaultForm())
  showPwd.value = false
  if (formRef.value) formRef.value.clearValidate()
}

const openCreate = () => {
  formMode.value = 'create'
  resetForm()
  nextTick(() => { formVisible.value = true })
}

const openEdit = async (row) => {
  const id = row && row.id ? row.id : null
  if (!id) {
    ElMessage.error('目标用户 ID 缺失')
    return
  }
  currentEditingId.value = id
  formMode.value = 'edit'
  resetForm()
  // 编辑时先拉最新详情（含 wallet / aiConfig 全量信息）
  try {
    const res = await getUserDetail(id)
    const d = res.data || {}
    form.userType = d.userType || 'real'
    form.phone = d.phone || ''
    form.nickname = d.nickname || ''
    form.avatar = d.avatar || ''
    form.gender = d.gender ?? 0
    form.city = d.city || ''
    form.bio = d.bio || ''
    form.isProvider = !!d.isProvider
    form.isElite = !!d.isElite
    // provider 默认值按当前数据，不存在则回落到 deepseek（国内优先）
    const provider = d.aiProvider || 'deepseek'
    form.aiProvider = provider
    const cfg = (d.aiConfig && typeof d.aiConfig === 'object') ? d.aiConfig : {}
    const isDeepSeek = provider === 'deepseek'
    const DEFAULT_URL = isDeepSeek
      ? 'https://api.deepseek.com/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions'
    const DEFAULT_MODEL = isDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini'
    form.aiConfig = {
      apiKey: cfg.apiKey || '',
      apiUrl: cfg.apiUrl || DEFAULT_URL,
      model: cfg.model || DEFAULT_MODEL,
      temperature: Number(cfg.temperature) || 0.8,
      systemPrompt: cfg.systemPrompt || '你是"白夜"伴玩平台的一位用户，正在与用户进行自然聊天回复。请保持友善、温柔、有趣的语气，回复控制在 50-200 字之间，不要透露自己是 AI。'
    }
    // 密码留空 = 不修改
    form.password = ''
    detailVisible.value = false
    nextTick(() => (formVisible.value = true))
  } catch (e) {
    ElMessage.error('加载用户信息失败')
  }
}

const formRules = {
  nickname: [{ required: true, message: '请填写昵称', trigger: 'blur' }],
  phone: [
    {
      validator: (_r, v, cb) => {
        if (form.userType === 'real' && !/^1\d{10}$/.test(v || '')) {
          return cb(new Error('真人用户手机号格式不正确'))
        }
        cb()
      },
      trigger: 'blur'
    }
  ],
  password: [
    {
      validator: (_r, v, cb) => {
        // 创建：真人用户必填密码；AI 用户可选（管理员后续也能补）
        if (formMode.value === 'create' && form.userType === 'real') {
          if (!v || String(v).length < 6 || String(v).length > 32) {
            return cb(new Error('新建真人用户请填写密码（6-32 位）'))
          }
        }
        // 填写了则必须 6-32 位（AI 用户编辑时也要求）
        if (v && (String(v).length < 6 || String(v).length > 32)) {
          return cb(new Error('密码长度需 6-32 位'))
        }
        cb()
      },
      trigger: 'blur'
    }
  ]
}

const submitForm = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch (_) {
    return
  }
  formSubmitting.value = true
  try {
    const payload = {
      userType: form.userType,
      phone: form.phone,
      nickname: form.nickname,
      avatar: form.avatar,
      gender: Number(form.gender) || 0,
      city: form.city,
      bio: form.bio,
      isProvider: !!form.isProvider,
      isElite: !!form.isElite,
      aiProvider: form.aiProvider,
      password: form.password || undefined,
      aiConfig: form.userType === 'ai' ? form.aiConfig : undefined
    }
    if (formMode.value === 'create') {
      await createUser(payload)
      ElMessage.success('用户已创建')
    } else {
      const id = currentEditingId.value
      if (!id) throw new Error('目标用户 ID 缺失，请重新打开编辑')
      await updateUser(id, payload)
      ElMessage.success('用户已更新')
    }
    formVisible.value = false
    loadData()
  } catch (e) {
    ElMessage.error(e && e.message ? e.message : '保存失败，请检查字段')
  } finally {
    formSubmitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.filter-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }

.detail { min-height: 360px; }
.detail-section { margin-bottom: 24px; }
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #0e1020;
  padding-left: 10px;
  border-left: 3px solid #d4af37;
  margin-bottom: 12px;
}
.wallet-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.w-card {
  background: linear-gradient(135deg, #f6f8ff 0%, #fffaf0 100%);
  border: 1px solid #ececf3;
  border-radius: 12px;
  padding: 16px 12px;
  text-align: center;
}
.w-num {
  font-size: 20px;
  font-weight: 800;
  color: #d4af37;
  letter-spacing: 0.5px;
}
.w-label {
  margin-top: 4px;
  font-size: 12px;
  color: #7b7e93;
}
.stat-card {
  background: #fafbff;
  border: 1px solid #ececf3;
  border-radius: 12px;
  padding: 20px 12px;
  text-align: center;
}
.stat-num {
  font-size: 22px;
  font-weight: 800;
  color: #0e1020;
}
.stat-label {
  margin-top: 6px;
  font-size: 13px;
  color: #7b7e93;
}
</style>
