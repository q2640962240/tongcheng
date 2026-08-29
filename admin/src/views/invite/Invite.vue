<template>
  <div class="invite-admin">
    <el-row :gutter="16">
      <el-col :span="8">
        <div class="page-card stat">
          <div class="stat-label">总邀请人数</div>
          <div class="stat-value">{{ stats.totalInvitees }}</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="page-card stat">
          <div class="stat-label">总分红支出</div>
          <div class="stat-value">¥{{ formatNum(stats.totalReward) }}</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="page-card stat">
          <div class="stat-label">活跃邀请人</div>
          <div class="stat-value">{{ stats.activeInviters }}</div>
        </div>
      </el-col>
    </el-row>

    <div class="page-card">
      <div class="card-title">奖励排行榜</div>
      <el-table :data="leaderboard" v-loading="loading" border>
        <el-table-column type="index" label="排名" width="80" />
        <el-table-column label="邀请人" min-width="160">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="32" :src="row.avatar">{{ row.nickname?.[0] }}</el-avatar>
              <span>{{ row.nickname }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="邀请人数" prop="count" width="120" />
        <el-table-column label="累计分红" width="140">
          <template #default="{ row }">¥{{ formatNum(row.reward) }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && leaderboard.length === 0" description="暂无数据" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getInviteLeaderboard } from '../../api'

const loading = ref(false)
const stats = ref({ totalInvitees: 0, totalReward: 0, activeInviters: 0 })
const leaderboard = ref([])

const formatNum = (n) => (Number(n) / 100).toFixed(2)

const loadData = async () => {
  loading.value = true
  try {
    const res = await getInviteLeaderboard()
    const list = res.data || []
    leaderboard.value = list
    stats.value = {
      totalInvitees: list.reduce((s, i) => s + (i.count || 0), 0),
      totalReward: list.reduce((s, i) => s + Number(i.reward || 0), 0),
      activeInviters: list.length
    }
  } catch (e) {} finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
.stat { text-align: center; }
.stat-label { font-size: 14px; color: #737373; margin-bottom: 8px; }
.stat-value { font-size: 32px; font-weight: 700; color: #a855f7; }
.card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
.user-cell { display: flex; align-items: center; gap: 8px; }
</style>
