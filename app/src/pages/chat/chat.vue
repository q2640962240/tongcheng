<template>
  <view class="page chat-page">
    <!-- 顶部导航（微信风格：中间昵称，右侧 ···） -->
    <view class="nav-bar">
      <view class="nav-left" @tap="onBack">
        <text class="back-icon">‹</text>
      </view>
      <view class="nav-center">
        <text class="nav-title">{{ displayName || '聊天' }}</text>
        <text v-if="useTIM" class="nav-sub">IM 实时</text>
        <text v-else class="nav-sub bad">自建实时</text>
      </view>
      <view class="nav-right" @tap="onMoreTap">
        <text class="more-icon">⋯</text>
      </view>
    </view>

    <!-- 消息列表（微信色 #ededed 背景） -->
    <scroll-view
      scroll-y
      class="msg-scroll"
      :scroll-top="scrollTop"
      :scroll-into-view="scrollAnchor"
      :scroll-with-animation="true"
      @scrolltoupper="onLoadMore"
    >
      <view class="msg-list">
        <!-- 顶部加载更多 -->
        <view v-if="loadingHistory" class="load-more"><text>加载中...</text></view>
        <!-- 时间分隔 -->
        <view
          v-for="(block, bi) in blockList"
          :key="'b_' + bi"
          class="msg-block"
        >
          <view v-if="block.timeLabel" class="time-split">
            <text>{{ block.timeLabel }}</text>
          </view>

          <view
            v-for="(m, idx) in block.msgs"
            :key="m.id || ('m_' + bi + '_' + idx)"
            :id="'msg-' + block.start + idx"
            class="msg-row"
            :class="m.senderId === myId ? 'mine' : 'other'"
            @longpress="onMsgLongPress(m, bi, idx)"
          >
            <!-- 头像（对方左 / 自己右） -->
            <image
              v-if="m.senderId !== myId"
              class="avatar"
              :src="displayAvatar(otherAvatar, m)"
              mode="aspectFill"
            />
            <!-- 气泡 -->
            <view class="bubble-wrap" :class="m.senderId === myId ? 'wrap-mine' : 'wrap-other'">
              <!-- 名字（群聊时或需要显示时；单聊省略） -->
              <text v-if="showName && m.senderId !== myId" class="sender-name">{{ m.nick || displayName }}</text>
              <view
                class="bubble"
                :class="[
                  m.senderId === myId ? 'bubble-mine' : 'bubble-other',
                  m.isRevoked ? 'bubble-revoked' : '',
                  sending(m) ? 'bubble-sending' : '',
                  failed(m)  ? 'bubble-failed' : ''
                ]"
              >
                <!-- 撤回 -->
                <text v-if="m.isRevoked" class="revoke-text">
                  {{ m.senderId === myId ? '你' : (displayName || '对方') }}撤回了一条消息
                </text>

                <!-- 文本 -->
                <text v-else-if="m.type === 'text'" class="msg-text">{{ m.content }}</text>

                <!-- 图片 -->
                <image
                  v-else-if="m.type === 'image'"
                  class="msg-image"
                  :src="m.content"
                  mode="widthFix"
                  @tap="onPreviewImg(m)"
                />

                <!-- 语音 -->
                <view
                  v-else-if="m.type === 'voice'"
                  class="voice-bubble"
                  @tap="onPlayVoice(m)"
                  :class="{ playing: playingVoiceId === m.id }"
                  :style="{ minWidth: voiceWidth(m) + 'rpx' }"
                >
                  <text class="voice-icon">{{ playingVoiceId === m.id ? '🔊' : '🔈' }}</text>
                  <text class="voice-dur">{{ m.duration }}″</text>
                </view>

                <!-- 文件 / 自定义 / 其它 -->
                <view v-else class="msg-other">
                  <text v-if="m.type === 'file'">[文件]</text>
                  <text v-else-if="m.type === 'custom'">[自定义消息]</text>
                  <text v-else>[暂不支持的消息类型]</text>
                </view>
              </view>

              <!-- 发送状态：发送中 / 失败重发 -->
              <view v-if="m.senderId === myId" class="send-status">
                <text v-if="sending(m)" class="status-sending">···</text>
                <view v-else-if="failed(m)" class="status-fail" @tap.stop="onResend(m, bi, idx)">
                  <text class="fail-icon">!</text>
                </view>
              </view>
            </view>

            <image
              v-if="m.senderId === myId"
              class="avatar"
              :src="displayAvatar(myAvatar, m)"
              mode="aspectFill"
            />
          </view>
        </view>

        <!-- 对方正在输入 -->
        <view v-if="typing" class="typing-row">
          <image class="avatar" :src="otherAvatar || '/static/avatar-user.png'" mode="aspectFill" />
          <view class="bubble bubble-other typing-bubble">
            <text class="typing-dot">·</text>
            <text class="typing-dot">·</text>
            <text class="typing-dot">·</text>
          </view>
        </view>

        <view style="height: 40rpx;" />
      </view>
    </scroll-view>

    <!-- 输入栏（微信风格：语音切换 + 输入框 + 表情 + "+" 面板） -->
    <view class="input-panel">
      <!-- 工具栏1（输入条） -->
      <view class="input-bar">
        <view class="bar-btn" @tap="toggleVoiceMode">
          <text class="bar-icon">{{ inputMode === 'voice' ? '⌨️' : '🎤' }}</text>
        </view>

        <view
          v-if="inputMode === 'voice'"
          class="voice-press"
          :class="{ recording: isRecording }"
          @touchstart="onRecordStart"
          @touchend="onRecordEnd"
          @touchcancel="onRecordCancel"
        >
          <text>{{ isRecording ? '松开 发送' : '按住 说话' }}</text>
        </view>

        <input
          v-else
          class="text-input"
          v-model="inputText"
          placeholder=""
          confirm-type="send"
          :adjust-position="true"
          @confirm="onSendText"
          @input="onTyping"
          @focus="closePanels"
        />

        <view class="bar-btn" @tap="toggleEmoji">
          <text class="bar-icon">{{ emojiOpen ? '⌨️' : '😊' }}</text>
        </view>

        <view class="bar-btn" @tap="togglePlus">
          <text class="bar-icon">{{ plusOpen ? '⌨️' : '＋' }}</text>
        </view>

        <view v-if="inputText.trim()" class="send-btn" @tap="onSendText">
          <text>发送</text>
        </view>
      </view>

      <!-- 表情面板 -->
      <view v-if="emojiOpen" class="emoji-panel">
        <scroll-view scroll-x class="emoji-scroll" show-scrollbar="false">
          <view class="emoji-row">
            <view
              v-for="(e, i) in emojis"
              :key="i"
              class="emoji-item"
              @tap="onPickEmoji(e)"
            >
              <text>{{ e }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="emoji-actions">
          <view class="del-btn" @tap="onEmojiDel">
            <text>⌫</text>
          </view>
        </view>
      </view>

      <!-- "+" 功能面板 -->
      <view v-if="plusOpen" class="plus-panel">
        <view class="plus-grid">
          <view class="plus-item" @tap="onPickImage">
            <view class="plus-icon album">🖼️</view>
            <text class="plus-label">相册</text>
          </view>
          <view class="plus-item" @tap="onTakePhoto">
            <view class="plus-icon camera">📷</view>
            <text class="plus-label">拍摄</text>
          </view>
          <view class="plus-item" @tap="onLocation">
            <view class="plus-icon location">📍</view>
            <text class="plus-label">位置</text>
          </view>
          <view class="plus-item" @tap="onRedPacket">
            <view class="plus-icon redpacket">🧧</view>
            <text class="plus-label">红包</text>
          </view>
          <view class="plus-item" @tap="onCall('audio')">
            <view class="plus-icon call">📞</view>
            <text class="plus-label">语音通话</text>
          </view>
          <view class="plus-item" @tap="onCall('video')">
            <view class="plus-icon video">📹</view>
            <text class="plus-label">视频通话</text>
          </view>
        </view>
      </view>

      <!-- 录音悬浮窗 -->
      <view v-if="isRecording" class="recording-mask">
        <view class="recording-box">
          <text class="rec-wave">
            <text v-for="i in 7" :key="i" :class="'bar b' + i" />
          </text>
          <text class="rec-sec">{{ recordingSeconds }}″</text>
          <text class="rec-hint">松开 发送，手指上滑 取消</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { onLoad, onUnload, onShow, onHide } from '@dcloudio/uni-app'
import tim from '../../utils/im'
import { chatApi } from '../../api'
import { uploadFile } from '../../utils/upload'
import { useUserStore } from '../../store/user'
import { getToken } from '../../utils/auth'

const userStore = useUserStore()
const myId = computed(() => String(userStore.userId || ''))
const myAvatar = computed(() => userStore.avatar || '/static/avatar-user.png')

/* ========== 参数 & 状态 ========== */
const otherId = ref('')
const otherAvatar = ref('/static/avatar-user.png')
const otherName = ref('')
const displayName = computed(() => otherName.value || '聊天')

const convID = computed(() => `C2C${otherId.value}`)

const useTIM = ref(false)
const messages = ref([])
const loadingHistory = ref(false)
const hasMore = ref(true)

const inputMode = ref('text')       // 'text' | 'voice'
const inputText = ref('')
const emojiOpen = ref(false)
const plusOpen = ref(false)

const scrollTop = ref(0)
const scrollAnchor = ref('')
const typing = ref(false)

// 录音
const isRecording = ref(false)
const recordingSeconds = ref(0)
let recTimer = null
let recStart = 0
let recorderManager = null

// 语音播放
const playingVoiceId = ref(null)
let innerAudio = null

// 表情包（小黄脸 Unicode 版，无版权问题；若需使用腾讯官方表情包，升级 IM 企业版后直接用 TIM SDK 表情消息）
const emojis = [
  '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗',
  '🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪',
  '😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️',
  '🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵',
  '🥶','😳','🤪','😵','🥴','😠','😡','🤬','😷','🤒','🤕','🤢','🤮','🤧','😇','🥳',
  '🥺','🤠','🤡','🤫','🤭','🧐','🤓','😈','👿','👹','👺','💀','👻','👽','🤖','💩',
  '😺','😸','😹','😻','😼','😽','🙀','😿','😾','❤️','💕','💖','💗','💘','💝','💟',
  '👍','👎','👌','✌️','🤞','🤟','🤘','👏','🙌','👐','🤲','🤝','🙏','💪','🎉','🌹'
]

const showName = ref(false)
let timOffs = []

/* ========== 自建 WS 兜底 ========== */
let socket = null
let typingTimer = null
const WS_URL = (() => {
  // #ifdef H5
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = location.hostname
  const port = 3000
  return `${proto}//${host}:${port}`
  // #endif
  // #ifndef H5
  return 'ws://localhost:3000'
  // #endif
})()

/* ========== 工具：归一化 + 块化（按时间间隔 5 分钟 + 前后） ========== */
function normalizeLocalMsg(m) {
  if (!m) return null
  return {
    id: m.id || `l_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    senderId: String(m.senderId ?? m.from ?? ''),
    receiverId: String(m.receiverId ?? m.to ?? ''),
    type: m.type || 'text',
    content: (m.content ?? m.text ?? '') + '',
    duration: Number(m.duration || 0),
    isRead: !!m.isRead,
    isRevoked: !!m.isRevoked,
    createdAt: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
    status: m.status || 'success',
    source: 'LOCAL',
    nick: m.nick || ''
  }
}

function computeBlocks(list) {
  // 按 5 分钟分块（超过 5 分钟插入时间分隔）
  const blocks = []
  let current = null
  let start = 0
  for (let i = 0; i < list.length; i++) {
    const m = list[i]
    const t = m.createdAt || Date.now()
    if (!current || t - current.lastT > 5 * 60 * 1000) {
      if (current) blocks.push(current)
      current = { timeLabel: labelTime(t), lastT: t, msgs: [m], start: i }
    } else {
      current.msgs.push(m)
      current.lastT = t
    }
  }
  if (current) blocks.push(current)
  return blocks
}
function labelTime(t) {
  const d = new Date(t)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay) return `${hh}:${mm}`
  const yd = new Date(now.getTime() - 86400000).toDateString()
  if (d.toDateString() === yd) return `昨天 ${hh}:${mm}`
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth()+1}月${d.getDate()}日 ${hh}:${mm}`
  }
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${hh}:${mm}`
}

const blockList = computed(() => computeBlocks(messages.value))

const sending = (m) => m && m.status === 'sending'
const failed  = (m) => m && m.status === 'failed'

function voiceWidth(m) {
  const d = Math.min(60, Math.max(1, Number(m.duration) || 1))
  return 160 + Math.floor(d * 8)
}

function displayAvatar(fallback, m) {
  return (m && m.avatar) || fallback || '/static/avatar-user.png'
}

/* ========== 滚动到底部 ========== */
function scrollToBottom(forceAnchor = false) {
  nextTick(() => {
    if (messages.value.length === 0) return
    scrollTop.value = 999999
    if (forceAnchor) {
      // 计算最后一个块 + 最后一条 id
      const blocks = blockList.value
      if (!blocks.length) return
      const last = blocks[blocks.length - 1]
      const idx = last.start + (last.msgs.length - 1)
      scrollAnchor.value = ''
      nextTick(() => { scrollAnchor.value = `msg-${idx}` })
    }
  })
}

/* ========== 主流程初始化 ========== */
onLoad(async (q) => {
  otherId.value = String(q.userId || q.id || q.uid || '')
  otherName.value = q.name || ''
  otherAvatar.value = q.avatar || '/static/avatar-user.png'
  uni.setNavigationBarTitle({ title: otherName.value || '聊天' })

  // 先确保 TIM（如果 IM 未启用会返回 reason）
  const r = await tim.ensureReady()
  useTIM.value = !!r.ok
  if (!useTIM.value) connectSocket()   // 兜底走自建 WS

  await loadHistory(true)
  // 标记已读
  markRead()

  // 订阅事件
  timOffs.push(tim.on('MESSAGE', (msgs) => {
    if (!useTIM.value) return
    let hit = false
    for (const m of msgs || []) {
      const norm = m
      if (String(norm.senderId) === otherId.value || String(norm.receiverId) === otherId.value || (norm.convID && norm.convID === convID.value)) {
        if (String(norm.senderId) !== myId.value) {
          messages.value.push(norm)
          hit = true
        }
      }
    }
    if (hit) { scrollToBottom(true); markRead() }
  }))
  timOffs.push(tim.on('READY', () => {
    useTIM.value = true
    if (socket) { try { socket.close({}) } catch (_) {} socket = null }
    loadHistory(true)
  }))
  timOffs.push(tim.on('ERROR', (e) => { console.warn('[chat] TIM err', e) }))
})

onShow(() => {
  if (otherId.value) markRead()
})
onHide(() => { typing.value = false })
onUnload(() => {
  while (timOffs.length) { const fn = timOffs.pop(); if (typeof fn === 'function') fn() }
  if (socket) { try { socket.close({}) } catch (_) {} socket = null }
  if (innerAudio) { try { innerAudio.destroy() } catch (_) {} innerAudio = null; playingVoiceId.value = null }
  if (recTimer) clearInterval(recTimer)
})

/* ========== 加载历史（TIM 优先 + 本地兜底） ========== */
async function loadHistory(first = false) {
  loadingHistory.value = true
  try {
    if (useTIM.value) {
      const r = await tim.getMessageList(convID.value, { count: 50 })
      if (r.ok) {
        messages.value = (r.list || []).map(m => ({
          ...m,
          senderId: String(m.senderId),
          receiverId: String(m.receiverId)
        }))
        hasMore.value = !(r.isCompleted !== true ? false : true)
        hasMore.value = !r.isCompleted
        scrollToBottom(true)
      }
    } else {
      // 兜底：自建 REST
      try {
        const r = await chatApi.history(otherId.value, { page: 1, pageSize: 100 })
        messages.value = (r.data && r.data.list || []).map(normalizeLocalMsg)
        scrollToBottom(true)
      } catch (_) { messages.value = [] }
    }
  } finally {
    loadingHistory.value = false
  }
}

async function onLoadMore() {
  if (!useTIM.value || !hasMore.value) return
  // 简单实现：暂不实现分页；正式 Chat UIKit 分页可在此追加
}

/* ========== 标记已读 ========== */
async function markRead() {
  if (useTIM.value) {
    await tim.setMessageRead(convID.value)
    return
  }
  if (socket) {
    try { socket.send({ data: JSON.stringify({ event: 'read', receiverId: otherId.value }) }) } catch (_) {}
  }
}

/* ========== 发送文本 ========== */
const onSendText = async () => {
  const text = (inputText.value || '').trim()
  if (!text) return
  // 白夜精英首次私聊门槛
  const hasHistory = messages.value.length > 0 && messages.value.some(m => String(m.senderId) === String(otherId.value))
  if (!userStore.isElite && !hasHistory) {
    const r = await new Promise(resolve => {
      uni.showModal({
        title: '开通精英后畅聊',
        content: '为保障用户体验，首次主动私聊需开通白夜精英会员。',
        confirmText: '立即开通', cancelText: '再逛逛', confirmColor: '#D4AF37',
        success: (x) => resolve(x && x.confirm ? 'ok' : 'cancel')
      })
    })
    if (r === 'ok') uni.navigateTo({ url: '/pages/elite-pay/elite-pay' })
    return
  }
  inputText.value = ''
  closePanels()

  // 构造临时消息
  const temp = {
    id: `tmp_${Date.now()}`,
    senderId: myId.value,
    receiverId: otherId.value,
    type: 'text',
    content: text,
    createdAt: Date.now(),
    status: 'sending',
    convID: convID.value
  }
  messages.value.push(temp)
  scrollToBottom(true)

  if (useTIM.value) {
    const r = await tim.sendText(otherId.value, text)
    const idx = messages.value.findIndex(x => x.id === temp.id)
    if (idx < 0) return
    if (r.ok) {
      messages.value.splice(idx, 1, { ...r.message, status: 'success' })
    } else {
      messages.value[idx] = { ...temp, status: 'failed', _failReason: r.reason }
    }
    scrollToBottom(true)
  } else {
    // 自建 WS 发送 / HTTP 回退
    try {
      if (socket) socket.send({ data: JSON.stringify({ event: 'message', receiverId: otherId.value, type: 'text', content: text }) })
      else await chatApi.send({ receiverId: otherId.value, type: 'text', content: text })
      const idx = messages.value.findIndex(x => x.id === temp.id)
      if (idx >= 0) messages.value[idx] = { ...temp, status: 'success' }
    } catch (e) {
      const idx = messages.value.findIndex(x => x.id === temp.id)
      if (idx >= 0) messages.value[idx] = { ...temp, status: 'failed' }
    }
  }
}

function onTyping() {
  if (!useTIM.value && socket) {
    try { socket.send({ data: JSON.stringify({ event: 'typing', receiverId: otherId.value }) }) } catch (_) {}
  }
}

/* ========== 发送图片 ========== */
async function onPickImage() {
  closePanels()
  try {
    const res = await new Promise((resolve, reject) => {
      uni.chooseImage({
        count: 9, sourceType: ['album'], sizeType: ['compressed'],
        success: resolve, fail: reject
      })
    })
    const paths = res.tempFilePaths || res.tempFiles.map(f => f.path) || []
    for (const p of paths) await sendImageOne(p)
  } catch (_) {}
}
async function onTakePhoto() {
  closePanels()
  try {
    const res = await new Promise((resolve, reject) => {
      uni.chooseImage({
        count: 1, sourceType: ['camera'], sizeType: ['compressed'],
        success: resolve, fail: reject
      })
    })
    const p = (res.tempFilePaths || [])[0] || (res.tempFiles && res.tempFiles[0] && res.tempFiles[0].path)
    if (p) await sendImageOne(p)
  } catch (_) {}
}
async function sendImageOne(filePath) {
  uni.showLoading({ title: '上传中', mask: true })
  try {
    const up = await uploadFile(filePath, 'image')
    const url = up.url || (up.data && up.data.url) || ''
    if (!url) throw new Error('上传失败')
    const temp = {
      id: `tmp_${Date.now()}_i`,
      senderId: myId.value, receiverId: otherId.value,
      type: 'image', content: url, createdAt: Date.now(),
      status: 'sending', convID: convID.value
    }
    messages.value.push(temp); scrollToBottom(true)
    if (useTIM.value) {
      const r = await tim.sendImage(otherId.value, url)
      const idx = messages.value.findIndex(x => x.id === temp.id)
      if (idx >= 0) messages.value[idx] = (r.ok ? { ...r.message, status: 'success' } : { ...temp, status: 'failed' })
    } else {
      try {
        await chatApi.send({ receiverId: otherId.value, type: 'image', content: url })
        const idx = messages.value.findIndex(x => x.id === temp.id)
        if (idx >= 0) messages.value[idx] = { ...temp, status: 'success' }
      } catch (_) {
        const idx = messages.value.findIndex(x => x.id === temp.id)
        if (idx >= 0) messages.value[idx] = { ...temp, status: 'failed' }
      }
    }
  } finally {
    uni.hideLoading()
    scrollToBottom(true)
  }
}

/* ========== 录音 & 发送语音 ========== */
function initRecorder() {
  if (recorderManager) return
  try {
    recorderManager = uni.getRecorderManager()
    recorderManager.onStart(() => {
      isRecording.value = true
      recordingSeconds.value = 0
      recStart = Date.now()
      recTimer = setInterval(() => {
        recordingSeconds.value = Math.floor((Date.now() - recStart) / 1000)
      }, 500)
    })
    recorderManager.onStop((res) => {
      clearInterval(recTimer); isRecording.value = false
      if (res && res.tempFilePath) {
        const dur = Math.max(1, Math.min(60, Math.round((recordingSeconds.value || (Date.now() - recStart) / 1000))))
        uploadAndSendVoice(res.tempFilePath, dur)
      }
    })
    recorderManager.onError(() => { clearInterval(recTimer); isRecording.value = false })
  } catch (_) {}
}
function onRecordStart() {
  initRecorder()
  if (!recorderManager) { uni.showToast({ title: '当前环境不支持录音', icon: 'none' }); return }
  try {
    recorderManager.start({ format: 'mp3', duration: 60000, sampleRate: 16000, numberOfChannels: 1 })
  } catch (_) { uni.showToast({ title: '录音启动失败', icon: 'none' }) }
}
function onRecordEnd() {
  if (!recorderManager || !isRecording.value) return
  if (recordingSeconds.value < 1) { uni.showToast({ title: '说话时间太短', icon: 'none' }) }
  try { recorderManager.stop() } catch (_) {}
}
function onRecordCancel() {
  clearInterval(recTimer); isRecording.value = false
  try { recorderManager.stop() } catch (_) {}
  recordingSeconds.value = 0
}
async function uploadAndSendVoice(filePath, dur) {
  uni.showLoading({ title: '发送中', mask: true })
  try {
    const up = await uploadFile(filePath, 'voice')
    const url = up.url || (up.data && up.data.url) || ''
    if (!url) throw new Error('上传失败')
    const temp = {
      id: `tmp_${Date.now()}_v`,
      senderId: myId.value, receiverId: otherId.value,
      type: 'voice', content: url, duration: dur,
      createdAt: Date.now(), status: 'sending', convID: convID.value
    }
    messages.value.push(temp); scrollToBottom(true)
    if (useTIM.value) {
      const r = await tim.sendVoice(otherId.value, url, dur)
      const idx = messages.value.findIndex(x => x.id === temp.id)
      if (idx >= 0) messages.value[idx] = r.ok ? { ...r.message, status: 'success' } : { ...temp, status: 'failed' }
    } else {
      try {
        await chatApi.send({ receiverId: otherId.value, type: 'voice', content: url, duration: dur })
        const idx = messages.value.findIndex(x => x.id === temp.id)
        if (idx >= 0) messages.value[idx] = { ...temp, status: 'success' }
      } catch (_) {
        const idx = messages.value.findIndex(x => x.id === temp.id)
        if (idx >= 0) messages.value[idx] = { ...temp, status: 'failed' }
      }
    }
  } catch (e) {
    uni.showToast({ title: '语音发送失败', icon: 'none' })
  } finally {
    uni.hideLoading()
    scrollToBottom(true)
  }
}

/* ========== 播放语音 ========== */
function onPlayVoice(m) {
  if (m.type !== 'voice') return
  if (playingVoiceId.value === m.id) {
    if (innerAudio) { try { innerAudio.stop() } catch (_) {} innerAudio = null; playingVoiceId.value = null }
    return
  }
  if (innerAudio) { try { innerAudio.stop(); innerAudio.destroy() } catch (_) {} }
  const audio = uni.createInnerAudioContext()
  audio.src = m.content
  audio.onPlay(() => { playingVoiceId.value = m.id })
  audio.onEnded(() => { playingVoiceId.value = null })
  audio.onError(() => { playingVoiceId.value = null; uni.showToast({ title: '播放失败', icon: 'none' }) })
  try { audio.play() } catch (_) {}
  innerAudio = audio
}

/* ========== 表情 / + 面板 ========== */
function closePanels() { emojiOpen.value = false; plusOpen.value = false }
function toggleEmoji() { emojiOpen.value = !emojiOpen.value; plusOpen.value = false }
function togglePlus()  { plusOpen.value  = !plusOpen.value;  emojiOpen.value = false }
function toggleVoiceMode() {
  inputMode.value = inputMode.value === 'voice' ? 'text' : 'voice'
  closePanels()
}
function onPickEmoji(e) { inputText.value = (inputText.value || '') + e }
function onEmojiDel() { inputText.value = (inputText.value || '').slice(0, -1) }
function onLocation()   { uni.showToast({ title: '位置功能即将上线', icon: 'none' }) }
function onRedPacket()  { uni.showToast({ title: '红包功能即将上线', icon: 'none' }) }
function onCall(type)   { uni.showToast({ title: `${type === 'audio' ? '语音' : '视频'}通话即将上线`, icon: 'none' }) }

/* ========== 长按消息（撤回/删除/复制） ========== */
function onMsgLongPress(m, bi, idx) {
  const canRevoke = m.senderId === myId.value && !m.isRevoked
  const items = ['复制', '删除']
  if (m.type === 'text') items[0] = '复制文本'
  if (canRevoke) items.unshift('撤回')
  uni.showActionSheet({
    itemList: items,
    success: async (r) => {
      let offset = 0
      if (canRevoke) {
        if (r.tapIndex === 0) {
          if (useTIM.value) await tim.revokeMessage(m)
          m.isRevoked = true
          return
        }
        offset = 1
      }
      const real = r.tapIndex - offset
      if (real === 0 && m.type === 'text') {
        uni.setClipboardData({ data: String(m.content || '') })
      } else if (real === 1) {
        // 删除
        const absIdx = (blockList.value[bi]?.start || 0) + idx
        messages.value.splice(absIdx, 1)
      }
    }
  })
}

/* ========== 重发 ========== */
async function onResend(m, bi, idx) {
  if (!m || m.status !== 'failed') return
  m.status = 'sending'
  let r = { ok: false }
  if (useTIM.value) {
    if (m.type === 'text') r = await tim.sendText(otherId.value, m.content)
    else if (m.type === 'image') r = await tim.sendImage(otherId.value, m.content)
    else if (m.type === 'voice') r = await tim.sendVoice(otherId.value, m.content, m.duration || 1)
  } else {
    try {
      await chatApi.send({ receiverId: otherId.value, type: m.type, content: m.content, duration: m.duration })
      r = { ok: true }
    } catch (_) { r = { ok: false } }
  }
  if (r.ok) m.status = 'success'
  else m.status = 'failed'
}

/* ========== 图片预览 ========== */
function onPreviewImg(m) {
  const all = messages.value.filter(x => x.type === 'image').map(x => x.content).filter(Boolean)
  uni.previewImage({ current: m.content, urls: all.length ? all : [m.content] })
}

/* ========== 顶部 & 更多 ========== */
function onBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/message/message' }) }) }
function onMoreTap() {
  uni.showActionSheet({
    itemList: ['查看资料', '清空聊天记录'],
    success: async (r) => {
      if (r.tapIndex === 0) {
        uni.navigateTo({ url: `/pages/provider/provider?id=${otherId.value}` })
      } else if (r.tapIndex === 1) {
        const ok = await new Promise(resolve => uni.showModal({ title: '清空聊天记录', content: '清空后无法恢复', success: (m) => resolve(!!m.confirm) }))
        if (ok) {
          messages.value = []
          if (useTIM.value) await tim.deleteConversation(convID.value)
        }
      }
    }
  })
}

/* ========== 自建 WS 连接（兜底） ========== */
function connectSocket() {
  const token = getToken()
  if (!token) return
  try {
    const sk = uni.connectSocket({ url: `${WS_URL}?token=${encodeURIComponent(token)}`, complete: () => {} })
    sk.onOpen(() => { /* noop */ })
    sk.onMessage((res) => {
      try {
        const evt = JSON.parse(res.data)
        if (evt.type === 'message' && evt.data) {
          const m = normalizeLocalMsg(evt.data)
          if (!m) return
          if (String(m.senderId) === String(otherId.value) || String(m.receiverId) === String(otherId.value)) {
            if (String(m.senderId) === String(otherId.value)) {
              messages.value.push(m); scrollToBottom(true); markRead()
            }
          }
        } else if (evt.type === 'typing' && Number(evt.from) === Number(otherId.value)) {
          typing.value = true
          clearTimeout(typingTimer)
          typingTimer = setTimeout(() => { typing.value = false }, 2000)
        }
      } catch (_) {}
    })
    sk.onClose(() => { socket = null })
    sk.onError(() => { socket = null })
    socket = sk
  } catch (_) {}
}
</script>

<style lang="scss" scoped>
.chat-page { background: #ededed; display: flex; flex-direction: column; height: 100vh; }

/* 顶部导航 */
.nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24rpx; height: 88rpx; padding-top: env(safe-area-inset-top);
  background: #ededed; border-bottom: 2rpx solid #dcdcdc;
  flex-shrink: 0;
}
.nav-left, .nav-right { width: 72rpx; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 60rpx; color: #07c160; line-height: 1; }
.more-icon { font-size: 48rpx; color: #07c160; line-height: 1; letter-spacing: 2rpx; }
.nav-center { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2rpx; }
.nav-title { font-size: 32rpx; font-weight: 600; color: #111; }
.nav-sub   { font-size: 20rpx; color: #07c160; }
.nav-sub.bad { color: #ad6800; }

/* 消息列表 */
.msg-scroll { flex: 1; background: #ededed; }
.msg-list { padding: 16rpx 0; }
.load-more { text-align: center; color: #888; font-size: 24rpx; padding: 20rpx 0; }
.time-split { text-align: center; margin: 28rpx 0; }
.time-split text {
  display: inline-block; padding: 6rpx 20rpx;
  background: rgba(0,0,0,0.08); color: #ffffff;
  font-size: 22rpx; border-radius: 8rpx;
}

.msg-row {
  display: flex; align-items: flex-start; gap: 14rpx;
  padding: 10rpx 24rpx;
}
.msg-row.mine { flex-direction: row-reverse; }

.avatar { width: 72rpx; height: 72rpx; border-radius: 8rpx; background: #ffffff; flex-shrink: 0; }

.bubble-wrap { max-width: 70%; display: flex; flex-direction: column; gap: 6rpx; }
.wrap-mine  { align-items: flex-end; }
.wrap-other { align-items: flex-start; }

.sender-name { font-size: 22rpx; color: #888; padding: 0 8rpx; }

.bubble {
  padding: 18rpx 22rpx;
  border-radius: 8rpx;
  word-break: break-all;
  position: relative;
  max-width: 100%;
}
.bubble-mine   { background: #95ec69; color: #111; border-top-right-radius: 2rpx; }
.bubble-other  { background: #ffffff; color: #111; border-top-left-radius: 2rpx; }
.bubble-revoked{ background: transparent !important; color: #b2b2b2; box-shadow: none; padding: 10rpx 16rpx; }
.bubble-sending { opacity: .65; }
.bubble-failed  { border: 2rpx dashed #fa5151; opacity: .85; }

/* 气泡三角 */
.bubble-mine::after {
  content: ''; position: absolute; right: -10rpx; top: 22rpx;
  width: 0; height: 0;
  border: 10rpx solid transparent;
  border-left-color: #95ec69;
  border-right: 0;
}
.bubble-other::before {
  content: ''; position: absolute; left: -10rpx; top: 22rpx;
  width: 0; height: 0;
  border: 10rpx solid transparent;
  border-right-color: #ffffff;
  border-left: 0;
}

.msg-text { font-size: 30rpx; line-height: 1.45; }
.msg-image {
  max-width: 380rpx; max-height: 500rpx; border-radius: 6rpx; display: block;
  background: #fff;
}
.voice-bubble {
  display: flex; align-items: center; gap: 12rpx;
  min-width: 140rpx;
}
.voice-bubble.playing .voice-icon { animation: shake 0.9s infinite steps(2); }
@keyframes shake {
  0% { transform: scale(1); }
  50% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
.voice-icon { font-size: 32rpx; }
.voice-dur { font-size: 26rpx; color: #222; }
.msg-other { font-size: 28rpx; color: #555; }
.revoke-text { font-size: 24rpx; color: #999; }

.send-status { display: flex; align-items: center; padding: 0 8rpx; }
.status-sending { color: #999; font-size: 28rpx; letter-spacing: -4rpx; }
.status-fail {
  width: 36rpx; height: 36rpx; border-radius: 9999rpx; background: #fa5151;
  color: #ffffff; display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: 700;
}

/* 正在输入 */
.typing-row { display: flex; align-items: center; gap: 14rpx; padding: 10rpx 24rpx; }
.typing-bubble { padding: 20rpx 24rpx; display: inline-flex; gap: 6rpx; align-items: center; }
.typing-dot {
  color: #95a0aa; font-size: 36rpx; line-height: 1;
  animation: dot 1.2s infinite;
}
.typing-dot:nth-child(2) { animation-delay: .2s; }
.typing-dot:nth-child(3) { animation-delay: .4s; }
@keyframes dot {
  0%,60%,100% { transform: translateY(0); opacity: .4; }
  30% { transform: translateY(-6rpx); opacity: 1; }
}

/* =================== 输入面板 =================== */
.input-panel {
  background: #f7f7f7;
  border-top: 2rpx solid #dcdcdc;
  padding-bottom: env(safe-area-inset-bottom);
  flex-shrink: 0;
}

/* 输入条 */
.input-bar {
  display: flex; align-items: center; gap: 12rpx;
  padding: 16rpx 20rpx;
  background: #f7f7f7;
}
.bar-btn {
  width: 68rpx; height: 68rpx;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.bar-icon { font-size: 44rpx; color: #555; line-height: 1; }

.text-input {
  flex: 1; height: 68rpx;
  background: #ffffff;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 30rpx;
}

.voice-press {
  flex: 1; height: 68rpx;
  background: #ffffff;
  border-radius: 8rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; color: #333;
  font-weight: 500;
}
.voice-press.recording { background: #d8d8d8; }

.send-btn {
  height: 68rpx; padding: 0 28rpx;
  background: #07c160; color: #ffffff;
  border-radius: 8rpx; font-size: 30rpx; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}

/* 表情面板 */
.emoji-panel {
  padding: 20rpx 16rpx 10rpx;
  background: #f2f2f2;
  display: flex; flex-direction: column;
  border-top: 2rpx solid #e0e0e0;
}
.emoji-scroll { width: 100%; }
.emoji-row {
  display: flex; flex-wrap: wrap; gap: 6rpx; padding: 10rpx 6rpx;
}
.emoji-item {
  width: 68rpx; height: 68rpx;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8rpx;
}
.emoji-item:active { background: #e6e6e6; }
.emoji-item text { font-size: 40rpx; }
.emoji-actions { display: flex; justify-content: flex-end; padding: 8rpx 12rpx; }
.del-btn {
  padding: 10rpx 22rpx; background: #ffffff;
  border-radius: 8rpx; font-size: 28rpx;
  border: 2rpx solid #e0e0e0;
}

/* "+" 面板 */
.plus-panel {
  background: #f2f2f2;
  border-top: 2rpx solid #e0e0e0;
  padding: 28rpx 16rpx calc(28rpx + env(safe-area-inset-bottom));
}
.plus-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24rpx 12rpx;
}
.plus-item {
  display: flex; flex-direction: column; align-items: center; gap: 10rpx;
}
.plus-icon {
  width: 104rpx; height: 104rpx; border-radius: 20rpx;
  background: #ffffff;
  display: flex; align-items: center; justify-content: center;
  font-size: 52rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.plus-label { font-size: 24rpx; color: #555; }

/* 录音悬浮 */
.recording-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.35);
  display: flex; align-items: center; justify-content: center;
  z-index: 999;
}
.recording-box {
  min-width: 420rpx; padding: 40rpx 48rpx;
  background: rgba(0,0,0,0.72); color: #fff;
  border-radius: 24rpx;
  display: flex; flex-direction: column; align-items: center; gap: 20rpx;
}
.rec-wave { display: inline-flex; align-items: flex-end; gap: 4rpx; height: 80rpx; }
.rec-wave .bar { width: 10rpx; background: #ffffff; display: inline-block; border-radius: 4rpx; animation: wave 1s infinite; }
.rec-wave .b1 { height: 20rpx; animation-delay: 0s; }
.rec-wave .b2 { height: 40rpx; animation-delay: .1s; }
.rec-wave .b3 { height: 60rpx; animation-delay: .2s; }
.rec-wave .b4 { height: 80rpx; animation-delay: .3s; }
.rec-wave .b5 { height: 50rpx; animation-delay: .4s; }
.rec-wave .b6 { height: 30rpx; animation-delay: .5s; }
.rec-wave .b7 { height: 20rpx; animation-delay: .6s; }
@keyframes wave {
  0%,100% { transform: scaleY(0.5); opacity: .6; }
  50%     { transform: scaleY(1);   opacity: 1; }
}
.rec-sec { font-size: 56rpx; font-weight: 700; }
.rec-hint { font-size: 24rpx; opacity: .75; }
</style>
