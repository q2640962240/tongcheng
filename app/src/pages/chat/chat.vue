<template>
  <view class="page">
    <!-- 消息列表 -->
    <scroll-view scroll-y class="msg-scroll" :scroll-top="scrollTop" :scroll-into-view="scrollAnchor">
      <view class="msg-list">
        <view
          v-for="(m, idx) in messages"
          :key="m.id || idx"
          :id="`msg-${idx}`"
          class="msg-row"
          :class="m.senderId === myId ? 'mine' : 'other'"
        >
          <image v-if="m.senderId !== myId" class="avatar" :src="otherAvatar" mode="aspectFill" />
          <view class="bubble" :class="m.senderId === myId ? 'bubble-mine' : 'bubble-other'">
            <text v-if="m.type === 'text'" class="msg-text">{{ m.content }}</text>
            <view v-else-if="m.type === 'voice'" class="voice-msg" @tap="onPlayVoice(m)">
              <text class="voice-icon">🔊</text>
              <text class="voice-dur">{{ m.duration }}"</text>
            </view>
          </view>
          <image v-if="m.senderId === myId" class="avatar" :src="myAvatar" mode="aspectFill" />
        </view>
        <view v-if="typing" class="typing-row">
          <image class="avatar" :src="otherAvatar" mode="aspectFill" />
          <view class="bubble bubble-other"><text class="typing-dots">对方正在输入...</text></view>
        </view>
      </view>
    </scroll-view>

    <!-- 输入栏 -->
    <view class="input-bar">
      <view class="voice-btn" @tap="toggleVoice">
        <text>{{ isVoiceMode ? '⌨️' : '🎤' }}</text>
      </view>
      <view v-if="!isVoiceMode" class="input-wrap">
        <input
          v-model="inputText"
          class="text-input"
          placeholder="说点什么..."
          confirm-type="send"
          @confirm="onSend"
          @input="onTyping"
        />
      </view>
      <view
        v-else
        class="voice-press"
        :class="{ recording: isRecording }"
        @touchstart="onRecordStart"
        @touchend="onRecordEnd"
        @touchcancel="onRecordCancel"
      >
        <text>{{ isRecording ? '松开发送' : '按住说话' }}</text>
      </view>
      <view v-if="isRecording" class="recording-tip">
        <text class="recording-icon">🎤</text>
        <text class="recording-text">正在录制...{{ recordingSeconds }}"</text>
      </view>
      <view v-if="inputText.trim()" class="send-btn" @tap="onSend">发送</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { onLoad, onUnload, onShow, onHide } from '@dcloudio/uni-app'
import { chatApi } from '../../api'
import { uploadFile } from '../../utils/upload'
import { useUserStore } from '../../store/user'
import { getToken } from '../../utils/auth'

const userStore = useUserStore()
const myId = computed(() => userStore.userId)
const myAvatar = computed(() => userStore.avatar || '/static/avatar-user.png')

const otherId = ref(null)
const otherAvatar = ref('/static/avatar-user.png')
const otherName = ref('')

const messages = ref([])
const inputText = ref('')
const typing = ref(false)
const isVoiceMode = ref(false)
const scrollTop = ref(0)
const scrollAnchor = ref('')
const socket = ref(null)
const typingTimer = ref(null)

// 语音录制相关
const isRecording = ref(false)
const recordingSeconds = ref(0)
const recorderManager = ref(null)
const recordingTempPath = ref('')
const recordingTimer = ref(null)
const recordingStartTime = ref(0)

// 语音播放相关
const innerAudio = ref(null)
const playingVoiceId = ref(null)

// WebSocket 地址
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

const loadHistory = async () => {
  try {
    const res = await chatApi.history(otherId.value, { page: 1, pageSize: 100 })
    messages.value = res.data.list || []
    scrollToBottom()
  } catch (e) {}
}

const connectSocket = () => {
  const token = getToken()
  if (!token) return
  try {
    const sk = uni.connectSocket({
      url: `${WS_URL}?token=${encodeURIComponent(token)}`,
      complete: () => {}
    })
    sk.onOpen(() => {
      console.log('[WS] connected')
    })
    sk.onMessage((res) => {
      try {
        const evt = JSON.parse(res.data)
        if (evt.type === 'message' && evt.data) {
          const m = evt.data
          if (Number(m.senderId) === Number(otherId.value) || Number(m.receiverId) === Number(otherId.value)) {
            if (Number(m.senderId) === Number(otherId.value)) {
              messages.value.push(m)
              scrollToBottom()
              markRead()
            }
          }
        } else if (evt.type === 'typing' && Number(evt.from) === Number(otherId.value)) {
          typing.value = true
          clearTimeout(typingTimer.value)
          typingTimer.value = setTimeout(() => { typing.value = false }, 2000)
        }
      } catch (e) {}
    })
    sk.onClose(() => { console.log('[WS] closed') })
    sk.onError(() => { console.log('[WS] error') })
    socket.value = sk
  } catch (e) {
    console.error('[WS] connect fail', e)
  }
}

const closeSocket = () => {
  if (socket.value) {
    try { socket.value.close({}) } catch (e) {}
    socket.value = null
  }
}

const onSend = async () => {
  const content = inputText.value.trim()
  if (!content) return
  // T10 聊天守卫：未精英且历史消息仅 0 条（即我主动发起）→ 弹精英门槛
  const hasHistory = messages.value.length > 0 && messages.value.some(m => String(m.senderId) === String(otherId.value))
  if (!userStore.isElite && !hasHistory) {
    uni.showModal({
      title: '开通精英后畅聊',
      content: '为保障用户体验，首次主动私聊需开通白夜精英会员。',
      confirmText: '立即开通',
      cancelText: '再逛逛',
      confirmColor: '#D4AF37',
      success: (r) => { if (r.confirm) uni.navigateTo({ url: '/pages/elite-pay/elite-pay' }); },
    });
    return;
  }
  const msg = {
    receiverId: otherId.value,
    type: 'text',
    content
  }
  // 乐观更新
  const tempMsg = { ...msg, senderId: myId.value, id: `temp_${Date.now()}`, isRead: false, createdAt: new Date().toISOString() }
  messages.value.push(tempMsg)
  inputText.value = ''
  scrollToBottom()

  try {
    // WebSocket 发送
    if (socket.value) {
      socket.value.send({ data: JSON.stringify({ event: 'message', ...msg }) })
    } else {
      // HTTP 回退
      await chatApi.send(msg)
      await loadHistory()
    }
  } catch (e) {
    uni.showToast({ title: '发送失败', icon: 'none' })
  }
}

const onTyping = () => {
  if (socket.value) {
    try {
      socket.value.send({ data: JSON.stringify({ event: 'typing', receiverId: otherId.value }) })
    } catch (e) {}
  }
}

const markRead = async () => {
  if (socket.value) {
    try {
      socket.value.send({ data: JSON.stringify({ event: 'read', receiverId: otherId.value }) })
    } catch (e) {}
  }
}

const toggleVoice = () => { isVoiceMode.value = !isVoiceMode.value }

/** 初始化录音管理器 */
const initRecorder = () => {
  if (recorderManager.value) return
  try {
    const rm = uni.getRecorderManager()
    rm.onStart(() => {
      isRecording.value = true
      recordingSeconds.value = 0
      recordingStartTime.value = Date.now()
      recordingTimer.value = setInterval(() => {
        recordingSeconds.value = Math.floor((Date.now() - recordingStartTime.value) / 1000)
      }, 1000)
    })
    rm.onStop((res) => {
      clearInterval(recordingTimer.value)
      isRecording.value = false
      if (res && res.tempFilePath) {
        recordingTempPath.value = res.tempFilePath
        // 自动上传并发送
        uploadAndSendVoice(res.tempFilePath, recordingSeconds.value || 1)
      }
    })
    rm.onError((err) => {
      clearInterval(recordingTimer.value)
      isRecording.value = false
      uni.showToast({ title: '录音失败', icon: 'none' })
    })
    recorderManager.value = rm
  } catch (e) {
    // H5 环境可能不支持
  }
}

/** 开始录音 */
const onRecordStart = () => {
  initRecorder()
  if (!recorderManager.value) {
    uni.showToast({ title: '当前环境不支持语音录制', icon: 'none' })
    return
  }
  try {
    recorderManager.value.start({
      format: 'mp3',
      duration: 60000,  // 最长 60 秒
      sampleRate: 16000,
      numberOfChannels: 1
    })
  } catch (e) {
    uni.showToast({ title: '录音启动失败', icon: 'none' })
  }
}

/** 结束录音（松开发送） */
const onRecordEnd = () => {
  if (!recorderManager.value || !isRecording.value) return
  try {
    recorderManager.value.stop()
  } catch (e) {}
}

/** 取消录音（手指移出取消） */
const onRecordCancel = () => {
  if (!recorderManager.value || !isRecording.value) return
  clearInterval(recordingTimer.value)
  isRecording.value = false
  try {
    recorderManager.value.stop()
  } catch (e) {}
  uni.showToast({ title: '已取消', icon: 'none' })
  recordingTempPath.value = ''  // 标记取消
}

/** 上传并发送语音消息 */
const uploadAndSendVoice = async (filePath, duration) => {
  if (!filePath) return
  uni.showLoading({ title: '发送中...' })
  try {
    // 上传语音文件
    const uploadRes = await uploadFile(filePath, 'voice')
    const voiceUrl = uploadRes.url || uploadRes.data?.url || ''
    if (!voiceUrl) throw new Error('上传失败')

    // 构造语音消息
    const msg = {
      receiverId: otherId.value,
      type: 'voice',
      content: voiceUrl,
      duration
    }
    const tempMsg = {
      ...msg,
      senderId: myId.value,
      id: `temp_${Date.now()}`,
      isRead: false,
      createdAt: new Date().toISOString()
    }
    messages.value.push(tempMsg)
    scrollToBottom()

    // WebSocket 发送
    if (socket.value) {
      socket.value.send({ data: JSON.stringify({ event: 'message', ...msg }) })
    } else {
      await chatApi.send(msg)
    }
  } catch (e) {
    uni.showToast({ title: '语音发送失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

/** 播放语音 */
const onPlayVoice = (m) => {
  // 同一条语音切换播放/暂停
  if (playingVoiceId.value === m.id) {
    if (innerAudio.value) {
      innerAudio.value.stop()
      playingVoiceId.value = null
    }
    return
  }

  // 停止之前的播放
  if (innerAudio.value) {
    innerAudio.value.stop()
    innerAudio.value.destroy()
  }

  const audio = uni.createInnerAudioContext()
  audio.src = m.content
  audio.onPlay(() => { playingVoiceId.value = m.id })
  audio.onEnded(() => { playingVoiceId.value = null })
  audio.onError(() => {
    playingVoiceId.value = null
    uni.showToast({ title: '播放失败', icon: 'none' })
  })
  audio.play()
  innerAudio.value = audio
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messages.value.length > 0) {
      scrollAnchor.value = `msg-${messages.value.length - 1}`
    }
    scrollTop.value = 99999
    nextTick(() => { scrollTop.value = 99999 + 1 })
  })
}

onLoad(async (q) => {
  otherId.value = Number(q.userId)
  uni.setNavigationBarTitle({ title: q.name || '聊天' })
  await loadHistory()
  markRead()
  connectSocket()
})

onShow(() => {
  if (otherId.value) markRead()
})

onHide(() => {
  typing.value = false
})

onUnload(() => {
  closeSocket()
  if (innerAudio.value) {
    innerAudio.value.destroy()
    innerAudio.value = null
  }
  if (recordingTimer.value) clearInterval(recordingTimer.value)
})
</script>

<style lang="scss" scoped>
.page { display: flex; flex-direction: column; height: 100vh; background: #f5f5f5; }
.msg-scroll { flex: 1; }
.msg-list { padding: 24rpx; display: flex; flex-direction: column; gap: 24rpx; }
.msg-row { display: flex; align-items: flex-start; gap: 16rpx; }
.msg-row.mine { flex-direction: row-reverse; }
.avatar { width: 72rpx; height: 72rpx; border-radius: 9999rpx; background: #ffffff; flex-shrink: 0; }
.bubble { max-width: 480rpx; padding: 20rpx 28rpx; border-radius: 24rpx; }
.bubble-mine { background: #ffd60a; color: #171717; border-bottom-right-radius: 8rpx; }
.bubble-other { background: #ffffff; color: #171717; border-bottom-left-radius: 8rpx; }
.msg-text { font-size: 30rpx; line-height: 1.5; }
.voice-msg { display: flex; align-items: center; gap: 12rpx; min-width: 160rpx; }
.voice-icon { font-size: 36rpx; }
.voice-dur { font-size: 26rpx; }
.typing-row { display: flex; align-items: flex-start; gap: 16rpx; }
.typing-dots { font-size: 26rpx; color: #737373; }
.input-bar {
  display: flex; align-items: center; gap: 16rpx; padding: 16rpx 24rpx;
  background: #ffffff; border-top: 2rpx solid #e5e5e5; padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}
.voice-btn {
  width: 72rpx; height: 72rpx; border-radius: 9999rpx; background: #f5f5f5;
  display: flex; align-items: center; justify-content: center; font-size: 36rpx;
}
.input-wrap { flex: 1; }
.text-input {
  width: 100%; height: 72rpx; background: #f5f5f5; border-radius: 16rpx; padding: 0 24rpx;
  font-size: 30rpx;
}
.voice-press {
  flex: 1; height: 72rpx; background: #f5f5f5; border-radius: 16rpx;
  display: flex; align-items: center; justify-content: center; font-size: 28rpx; color: #525252;
  &.recording { background: #ffd60a; color: #171717; font-weight: 600; }
}
.recording-tip {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.7); border-radius: 24rpx; padding: 32rpx 48rpx;
  display: flex; flex-direction: column; align-items: center; gap: 16rpx; z-index: 999;
}
.recording-icon { font-size: 64rpx; }
.recording-text { font-size: 26rpx; color: #ffffff; }
.send-btn {
  padding: 0 32rpx; height: 72rpx; background: #ffd60a; color: #171717;
  border-radius: 16rpx; display: flex; align-items: center; justify-content: center;
  font-size: 30rpx; font-weight: 600;
}
</style>
