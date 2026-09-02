<template>
  <div class="chat-records">
    <div class="page-head">
      <h3>聊天记录</h3>
      <div class="head-actions">
        <el-input
          v-model.trim="filterUserId"
          placeholder="按用户 ID 过滤"
          clearable
          style="width: 180px"
          @keyup.enter="loadSessions"
          @clear="loadSessions"
        />
        <el-button type="primary" @click="loadSessions">刷新</el-button>
      </div>
    </div>

    <div class="records-body">
      <!-- 会话列表 -->
      <div class="session-pane">
        <div v-if="sessionLoading" class="pane-tip">加载中…</div>
        <div v-else-if="sessions.length === 0" class="pane-tip">暂无会话记录</div>
        <div
          v-for="s in sessions"
          :key="s.sessionId"
          class="session-item"
          :class="{ active: s.sessionId === activeSessionId }"
          @click="selectSession(s)"
        >
          <div class="session-avatars">
            <el-avatar
              v-for="p in s.participants"
              :key="p.id"
              :size="32"
              :src="validAvatar(p.avatar)"
            >{{ (p.nickname || '').slice(0, 1) }}</el-avatar>
          </div>
          <div class="session-info">
            <div class="session-names">
              {{ s.participants.map((p) => `${p.nickname || '用户' + p.id}${p.userType === 'ai' ? '(AI)' : ''}`).join(' ↔ ') || s.sessionId }}
            </div>
            <div class="session-last">{{ s.lastMessage.content || '[非文本消息]' }}</div>
          </div>
          <div class="session-meta">
            <div class="session-count">{{ s.count }} 条</div>
            <div class="session-time">{{ fmtTime(s.lastMessage.createdAt) }}</div>
          </div>
        </div>
      </div>

      <!-- 消息流 -->
      <div class="message-pane">
        <template v-if="activeSessionId">
          <div class="message-head">
            <span>{{ activeTitle }}</span>
            <span class="message-total">共 {{ messageTotal }} 条</span>
          </div>
          <div ref="msgScrollRef" class="message-scroll">
            <div v-if="messageLoading" class="pane-tip">加载中…</div>
            <template v-else>
              <div v-if="messagePage > 1" class="load-more" @click="loadMoreOlder">加载更早的消息</div>
              <div
                v-for="m in messages"
                :key="m.id"
                class="msg-row"
                :class="{ right: m.senderId === rightAnchorId }"
              >
                <el-avatar :size="30" :src="validAvatar(m.sender.avatar)">{{ (m.sender.nickname || '').slice(0, 1) }}</el-avatar>
                <div class="msg-main">
                  <div class="msg-meta">
                    <span class="msg-name">{{ m.sender.nickname || '用户' + m.senderId }}{{ m.sender.userType === 'ai' ? ' (AI)' : '' }}</span>
                    <span class="msg-time">{{ fmtTime(m.createdAt) }}</span>
                  </div>
                  <div class="msg-bubble">
                    <img v-if="m.type === 'image' && isHttpUrl(m.content)" :src="m.content" class="msg-img" />
                    <span v-else>{{ m.type === 'text' ? m.content : `[${m.type}] ${m.content || ''}` }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </template>
        <div v-else class="pane-tip center">选择左侧会话查看聊天记录</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import http from '../../api/http'

const filterUserId = ref('')
const sessions = ref([])
const sessionLoading = ref(false)

const activeSessionId = ref('')
const messages = ref([])
const messageTotal = ref(0)
const messageLoading = ref(false)
const messagePage = ref(1)
const msgScrollRef = ref(null)

const pageSize = 100

const rightAnchorId = computed(() => {
  const parts = String(activeSessionId.value).split('-').map(Number)
  return parts.length === 2 ? parts[1] : 0
})

const activeTitle = computed(() => {
  const s = sessions.value.find((x) => x.sessionId === activeSessionId.value)
  if (!s) return activeSessionId.value
  return s.participants.map((p) => p.nickname || '用户' + p.id).join(' ↔ ')
})

const validAvatar = (u) => (/^https?:\/\//.test(String(u || '')) ? u : '')

const fmtTime = (t) => {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return String(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const isHttpUrl = (s) => /^https?:\/\//.test(String(s || ''))

const loadSessions = async () => {
  sessionLoading.value = true
  try {
    const params = {}
    if (filterUserId.value) params.userId = filterUserId.value
    const res = await http.get('/admin/chat-sessions', { params })
    sessions.value = (res.data && res.data.list) || []
  } catch (e) {
    sessions.value = []
  } finally {
    sessionLoading.value = false
  }
}

const selectSession = async (s) => {
  activeSessionId.value = s.sessionId
  messages.value = []
  messageTotal.value = s.count
  messagePage.value = 1
  messageLoading.value = true
  try {
    const res = await http.get(`/admin/chat-messages/${s.sessionId}`, { params: { page: 1, pageSize } })
    messages.value = (res.data && res.data.list) || []
    messageTotal.value = (res.data && res.data.total) || messages.value.length
  } catch (e) {
    messages.value = []
  } finally {
    messageLoading.value = false
  }
}

const loadMoreOlder = async () => {
  if (!activeSessionId.value || messageLoading.value) return
  messageLoading.value = true
  try {
    const nextPage = messagePage.value + 1
    const res = await http.get(`/admin/chat-messages/${activeSessionId.value}`, { params: { page: nextPage, pageSize } })
    const older = (res.data && res.data.list) || []
    if (older.length) {
      messages.value = older.concat(messages.value)
      messagePage.value = nextPage
    }
  } catch (e) { /* 保持现状 */ } finally {
    messageLoading.value = false
  }
}

onMounted(loadSessions)
</script>

<style scoped>
.chat-records { padding: 20px; }
.page-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.page-head h3 { margin: 0; font-size: 18px; }
.head-actions { display: flex; gap: 10px; }

.records-body {
  display: flex; gap: 16px;
  height: calc(100vh - 160px);
}
.session-pane {
  width: 340px; flex-shrink: 0;
  background: #fff; border-radius: 8px;
  overflow-y: auto; padding: 8px;
}
.message-pane {
  flex: 1; background: #fff; border-radius: 8px;
  display: flex; flex-direction: column; overflow: hidden;
}
.pane-tip { color: #999; padding: 24px; text-align: center; }
.pane-tip.center { margin: auto; }

.session-item {
  display: flex; gap: 10px; padding: 10px;
  border-radius: 8px; cursor: pointer;
}
.session-item:hover { background: #f5f6fa; }
.session-item.active { background: #eef1ff; }
.session-avatars { display: flex; flex-direction: column; gap: 2px; }
.session-info { flex: 1; min-width: 0; }
.session-names { font-size: 13px; font-weight: 600; color: #303133; }
.session-last {
  font-size: 12px; color: #909399; margin-top: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.session-meta { text-align: right; flex-shrink: 0; }
.session-count { font-size: 12px; color: #606266; }
.session-time { font-size: 11px; color: #c0c4cc; margin-top: 4px; }

.message-head {
  padding: 12px 16px; border-bottom: 1px solid #ebeef5;
  display: flex; align-items: center; justify-content: space-between;
  font-weight: 600; font-size: 14px;
}
.message-total { font-weight: 400; font-size: 12px; color: #909399; }
.message-scroll {
  flex: 1; overflow-y: auto; padding: 16px;
  background: #f5f6fa;
}
.load-more {
  text-align: center; color: #409eff; font-size: 12px;
  cursor: pointer; padding: 6px 0;
}
.msg-row { display: flex; gap: 8px; margin-bottom: 14px; }
.msg-row.right { flex-direction: row-reverse; }
.msg-main { max-width: 70%; }
.msg-row.right .msg-main { display: flex; flex-direction: column; align-items: flex-end; }
.msg-meta { font-size: 11px; color: #909399; margin-bottom: 3px; }
.msg-name { margin-right: 6px; }
.msg-bubble {
  background: #fff; border-radius: 8px; padding: 8px 12px;
  font-size: 13px; color: #303133; word-break: break-all;
  display: inline-block;
}
.msg-row.right .msg-bubble { background: #d9e5ff; }
.msg-img { max-width: 180px; max-height: 180px; border-radius: 6px; display: block; }
</style>
