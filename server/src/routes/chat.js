const express = require('express')
const router = express.Router()
const { Message, User, Op } = require('../models')
const { auth } = require('../middleware/auth')
const { success, paginate, fail } = require('../utils/response')

// ============================================================
// LLM 调用层：支持 deepseek / openai / custom，带 3 层兜底与重试
//   - 第 1 优先级：用户 aiProvider + aiConfig 显式配置
//   - 第 2 优先级：配置中心 ai 模块的备用（backupProvider/backupKey/backupUrl/backupModel）
//   - 第 3 优先级：本地"策略兜底回复"（避免 500/空回复影响用户体验）
// ============================================================

const AI_FALLBACK_SENTENCES = [
  '刚刚在忙别的呢，不好意思～再说一下好吗？',
  '哈哈，我刚才走神啦，你刚刚说的是……？',
  '嗯嗯，我在听，你继续说呀～',
  '感觉你今天心情不错呀，要不要再多聊两句？',
  '收到啦～让我想想怎么回答你比较好😊',
  '这个问题问得好，容我组织一下语言~',
  '我也有同样的感觉，我们真的很合拍呢！',
  '好啊好啊，那我们就这么说定啦！'
]

function _pickLocalFallback(lastContent) {
  const txt = String(lastContent || '').trim()
  if (!txt) return AI_FALLBACK_SENTENCES[0]
  if (/[?？]$/.test(txt)) {
    return '嗯……这个问题我需要想想呢，你可以换个角度再问问我吗？😊'
  }
  if (/你好|hi|hello|在吗|在不|在么/i.test(txt)) {
    return '我在呀～很高兴认识你，今天过得怎么样？'
  }
  if (/晚安|睡觉|睡了/.test(txt)) {
    return '晚安呀～做个好梦，明天再聊！🌙'
  }
  const idx = Math.floor(Math.random() * AI_FALLBACK_SENTENCES.length)
  return AI_FALLBACK_SENTENCES[idx]
}

/** 读取配置中心 AI 备用配置（provider 没填时的兜底） */
async function _loadAiBackupConfig() {
  try {
    const { getModuleConfig } = require('../utils/config')
    const mod = await getModuleConfig('ai')
    if (mod && typeof mod === 'object' && mod.backupApiKey) {
      const provider = String(mod.backupProvider || 'deepseek').toLowerCase()
      const defaultUrl = provider === 'deepseek'
        ? 'https://api.deepseek.com/v1/chat/completions'
        : (provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : '')
      return {
        provider,
        apiKey: String(mod.backupApiKey || '').trim(),
        apiUrl: String(mod.backupApiUrl || defaultUrl).trim(),
        model: String(mod.backupModel || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini')).trim(),
        timeoutMs: Math.max(3000, Number(mod.timeoutMs) || 15000)
      }
    }
  } catch (_) {}
  return null
}

/** 规范化单个 provider 的配置（apiUrl/model 默认值按 provider 填） */
function _normalizeProviderCfg({ provider, apiKey, apiUrl, model, temperature }) {
  const p = String(provider || 'custom').toLowerCase()
  let url = String(apiUrl || '').trim()
  let mdl = String(model || '').trim()
  if (!url) {
    if (p === 'deepseek') url = 'https://api.deepseek.com/v1/chat/completions'
    else if (p === 'openai') url = 'https://api.openai.com/v1/chat/completions'
    else if (p === 'custom') url = 'https://api.openai.com/v1/chat/completions'
  }
  if (!mdl) {
    if (p === 'deepseek') mdl = 'deepseek-chat'
    else if (p === 'openai') mdl = 'gpt-4o-mini'
    else mdl = 'gpt-4o-mini'
  }
  const temp = Math.max(0, Math.min(2, Number(temperature) || 0.8))
  return { provider: p, apiKey: String(apiKey || '').trim(), apiUrl: url, model: mdl, temperature: temp }
}

function _requestOnce({ apiUrl, apiKey, model, temperature, messages, timeoutMs }) {
  return new Promise((resolve, reject) => {
    if (!apiKey) return reject(new Error('API Key 未配置'))
    const { URL } = require('url')
    const https = require('https')
    const http = require('http')
    let parsed
    try { parsed = new URL(apiUrl) } catch (e) { return reject(new Error('AI 接口 URL 不合法: ' + String(apiUrl).slice(0, 60))) }
    const lib = parsed.protocol === 'https:' ? https : http
    const body = JSON.stringify({
      model,
      temperature,
      messages,
      stream: false
    })
    const req2 = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: timeoutMs
    }, (res2) => {
      let chunks = ''
      res2.setEncoding('utf8')
      res2.on('data', (c) => { chunks += c })
      res2.on('end', () => {
        try {
          if (res2.statusCode >= 400) {
            return reject(new Error(`HTTP ${res2.statusCode}: ${String(chunks || '').slice(0, 200)}`))
          }
          const json = JSON.parse(chunks)
          const choice = json && json.choices && json.choices[0]
          const content = (choice && choice.message && choice.message.content) ||
                          (choice && choice.text) ||
                          (json && json.data && (json.data.reply || json.data.content)) || ''
          const out = String(content || '').trim()
          if (!out) return reject(new Error('AI 返回为空'))
          resolve(out.slice(0, 2000))
        } catch (e) {
          reject(new Error('AI parse error: ' + String(chunks || '').slice(0, 200)))
        }
      })
    })
    req2.on('error', (e) => reject(e))
    req2.on('timeout', () => { req2.destroy(new Error(`AI timeout (${timeoutMs}ms)`)) })
    req2.write(body)
    req2.end()
  })
}

/** 多候选顺序尝试：主 provider -> 备份 provider -> 本地兜底 */
async function _callAiWithFallback(aiUser, messages, lastContent) {
  const cfg = (aiUser.aiConfig && typeof aiUser.aiConfig === 'object') ? aiUser.aiConfig : {}
  const providerRaw = String(aiUser.aiProvider || cfg.provider || (cfg.apiKey ? 'custom' : 'none')).toLowerCase()
  const primary = providerRaw === 'none' ? null : _normalizeProviderCfg({
    provider: providerRaw,
    apiKey: cfg.apiKey,
    apiUrl: cfg.apiUrl,
    model: cfg.model,
    temperature: cfg.temperature
  })
  const backupCfg = await _loadAiBackupConfig()
  const backup = backupCfg ? _normalizeProviderCfg({
    provider: backupCfg.provider,
    apiKey: backupCfg.apiKey,
    apiUrl: backupCfg.apiUrl,
    model: backupCfg.model,
    temperature: Number(cfg.temperature) || 0.8
  }) : null

  const candidates = []
  if (primary && primary.apiKey) {
    candidates.push({ label: `primary/${primary.provider}`, cfg: primary, timeoutMs: 25000 })
  }
  if (backup && backup.apiKey && (!primary || backup.provider !== primary.provider || backup.apiUrl !== primary.apiUrl)) {
    candidates.push({ label: `backup/${backup.provider}`, cfg: backup, timeoutMs: backup.timeoutMs || 15000 })
  }

  const errors = []
  for (const cand of candidates) {
    // 每候选最多 1 次重试（总计 2 次调用/候选），失败即切下一个
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const reply = await _requestOnce({
          apiUrl: cand.cfg.apiUrl,
          apiKey: cand.cfg.apiKey,
          model: cand.cfg.model,
          temperature: cand.cfg.temperature,
          messages,
          timeoutMs: cand.timeoutMs
        })
        if (reply) return { reply, source: `${cand.label}#${attempt + 1}` }
      } catch (e) {
        errors.push(`[${cand.label}#${attempt + 1}] ${e && e.message ? e.message : String(e)}`)
      }
    }
  }
  // 本地兜底：避免真实用户收到空/错误
  return {
    reply: _pickLocalFallback(lastContent),
    source: 'local-fallback',
    errors: errors.slice(0, 6)
  }
}

/** 会话 ID：两个用户 ID 排序后拼接 */
const sessionId = (a, b) => [Number(a), Number(b)].sort((x, y) => x - y).join('-')

// ============================================================
// 腾讯云 IM 桥接：自建通道（HTTP/WS）保存的消息，在 IM 启用时
// 同时经老版 REST(v4) 转发到腾讯 IM，保证使用官方 TUIKit 的接收方实时收到。
// 反向（TIM 发出的消息）由前端 /chat/im-sync 回报，无需在此转发。
// ============================================================
const _imImportedUsers = new Set()

async function _loadImCfg() {
  try {
    const { getModuleConfig } = require('../utils/config')
    const cfg = await getModuleConfig('im')
    if (cfg && cfg.enabled && cfg.sdkAppId && cfg.secretKey) return cfg
  } catch (_) {}
  return null
}

async function _ensureImAccount(imCfg, userId, nick, faceUrl) {
  const key = String(userId)
  if (_imImportedUsers.has(key)) return
  try {
    const { importIMAccountV4 } = require('../utils/im')
    const r = await importIMAccountV4({ cfg: imCfg, userId: key, nick, faceUrl })
    if (r && (r.ActionStatus === 'OK' || r.noop)) _imImportedUsers.add(key)
  } catch (e) {
    console.warn('[IM] account_import fail:', key, e && e.message)
  }
}

/**
 * 把一条业务消息经腾讯云 IM 以发送者身份转发给接收者（仅文本；媒体转占位文本）
 */
async function forwardToIM(fromUserId, toUserId, type, content) {
  try {
    const imCfg = await _loadImCfg()
    if (!imCfg) return
    const sender = await User.findByPk(fromUserId)
    await _ensureImAccount(imCfg, fromUserId, sender && sender.nickname, sender && sender.avatar)
    const text = type === 'text' ? String(content)
      : type === 'image' ? '[图片]'
      : type === 'voice' ? '[语音]'
      : String(content)
    const { sendIMC2CTextV4 } = require('../utils/im')
    const r = await sendIMC2CTextV4({ cfg: imCfg, fromUserId, toUserId, text })
    if (r && r.ActionStatus !== 'OK' && !r.noop) {
      console.warn('[IM-forward] fail:', r.ErrorCode, r.ErrorInfo)
    }
  } catch (e) {
    console.warn('[IM-forward] error:', e && e.message)
  }
}

/** 会话列表 */
router.get('/sessions', auth, async (req, res, next) => {
  try {
    const all = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.userId },
          { receiverId: req.userId }
        ]
      },
      order: [['createdAt', 'DESC']]
    })

    const sessionMap = new Map()
    for (const m of all) {
      const otherId = m.senderId === req.userId ? m.receiverId : m.senderId
      const sid = sessionId(req.userId, otherId)
      if (!sessionMap.has(sid)) {
        const other = await User.findByPk(otherId)
        let preview = m.content
        if (m.type === 'gift') {
          try {
            const gc = JSON.parse(m.content || '{}')
            preview = `[礼物] ${gc.giftName || '礼物'}`
          } catch (_) { preview = '[礼物]' }
        }
        sessionMap.set(sid, {
          sessionId: sid,
          otherUser: other ? {
            id: other.id, nickname: other.nickname, avatar: other.avatar, isElite: other.isElite
          } : null,
          lastMessage: preview,
          lastMessageType: m.type,
          lastMessageTime: m.createdAt,
          unreadCount: 0
        })
      }
      if (m.receiverId === req.userId && !m.isRead) {
        sessionMap.get(sid).unreadCount++
      }
    }
    success(res, [...sessionMap.values()])
  } catch (err) { next(err) }
})

/** 历史消息 */
router.get('/history/:userId', auth, async (req, res, next) => {
  try {
    const otherId = req.params.userId
    const sid = sessionId(req.userId, otherId)
    const { page = 1, pageSize = 50 } = req.query
    const { rows, count } = await Message.findAndCountAll({
      where: {
        [Op.or]: [
          { senderId: req.userId, receiverId: otherId },
          { senderId: otherId, receiverId: req.userId }
        ]
      },
      order: [['createdAt', 'ASC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })

    // 标记已读
    for (const m of rows) {
      if (m.receiverId === req.userId && !m.isRead) {
        await m.update({ isRead: true })
      }
    }

    paginate(res, rows, count, page, pageSize)
  } catch (err) { next(err) }
})

/**
 * AI 自动回复：根据 AI 用户的 aiConfig 调用外部 LLM，生成一条回复消息并保存、推送
 * 失败不影响主消息返回，但会在日志里记录（避免真实用户看到 500）
 * 新架构：主用户配置 -> 配置中心 AI 备份 -> 本地策略兜底，三层出错全部降级
 */
async function tryAiAutoReply({ app, senderId, aiUser, lastContent }) {
  try {
    if (!aiUser || aiUser.userType !== 'ai') return

    const cfg = (aiUser.aiConfig && typeof aiUser.aiConfig === 'object') ? aiUser.aiConfig : {}
    const systemPrompt = String(cfg.systemPrompt || '你是"白夜"伴玩平台的聊天伙伴，正在与用户进行自然聊天回复。请保持友善、温柔、有趣的语气，回复控制在 50-200 字之间，不要透露自己是 AI。').trim()

    // 拉取最近 15 条上下文（仅文本），更准确理解对话
    const sid = sessionId(senderId, aiUser.id)
    const recent = await Message.findAll({
      where: { sessionId: sid, type: 'text' },
      order: [['createdAt', 'DESC']],
      limit: 15
    })
    const msgs = []
    msgs.push({ role: 'system', content: systemPrompt })
    const reversed = [...recent].reverse()
    for (const m of reversed) {
      const role = (String(m.senderId) === String(aiUser.id)) ? 'assistant' : 'user'
      msgs.push({ role, content: String(m.content || '').slice(0, 2000) })
    }
    // 兜底：如果 recent 里没有 user 最新输入，再追加一次（保证不丢失）
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'user') {
      msgs.push({ role: 'user', content: String(lastContent || '').slice(0, 2000) })
    }

    // 主/备份/本地 三层兜底调用
    const { reply: aiReply, source, errors } = await _callAiWithFallback(aiUser, msgs, lastContent)
    if (!aiReply) return
    if (source === 'local-fallback') {
      console.warn('[AI-AUTO-REPLY] fallback → local. errors=', (errors || []).join(' | '))
    } else {
      console.info('[AI-AUTO-REPLY] ok, source=', source)
    }

    // 保存 AI 回复
    const replyMsg = await Message.create({
      sessionId: sid,
      senderId: aiUser.id,
      receiverId: senderId,
      type: 'text',
      content: aiReply.slice(0, 2000),
      isRead: false
    })
    if (app && app.get && app.get('io')) {
      app.get('io').to(`user_${senderId}`).emit('message', replyMsg.toJSON())
    }
    const push = require('../utils/push')
    const bodyPreview = aiReply.length > 32 ? aiReply.slice(0, 32) + '...' : aiReply
    push.pushToUser(senderId, {
      title: aiUser.nickname || '白夜用户',
      body: bodyPreview,
      extras: { type: 'im', sessionId: sid, senderId: aiUser.id }
    }).catch(() => {})

    // 腾讯云 IM 代发：使用官方 TUIKit 的接收方只能从 TIM 收到消息，
    // 用老版 REST(v4，仅需 SDKAppID+密钥) 以 AI 用户身份把回复发过去
    try {
      const imCfg = await _loadImCfg()
      if (imCfg) {
        await _ensureImAccount(imCfg, aiUser.id, aiUser.nickname, aiUser.avatar)
        const { sendIMC2CTextV4 } = require('../utils/im')
        const r = await sendIMC2CTextV4({
          cfg: imCfg,
          fromUserId: aiUser.id,
          toUserId: senderId,
          text: aiReply.slice(0, 2000)
        })
        if (r && r.ActionStatus === 'OK') {
          console.info('[AI-AUTO-REPLY] delivered via IM REST')
        } else if (r && !r.noop) {
          console.warn('[AI-AUTO-REPLY] IM REST fail:', r.ErrorCode, r.ErrorInfo)
        }
      }
    } catch (e) {
      console.warn('[AI-AUTO-REPLY] IM deliver error:', e && e.message)
    }
  } catch (e) {
    // AI 回复失败不往外抛，避免影响前端主消息
    console.warn('[AI-AUTO-REPLY] failed:', e && e.message ? e.message : String(e))
  }
}

/**
 * POST /chat/im-sync
 * 前端经腾讯云 TIM（官方 TUIKit）发出的消息回报到这里：
 *   - 落库维护会话列表/历史（90s 内同内容去重，防止重复回报）
 *   - 推送给可能处于自建 WS 通道的接收方
 *   - 对方是 AI 用户时触发自动回复（回复经 IM REST 代发）
 * 注意：消息已经由 TIM 投递给接收方，这里不再 forwardToIM。
 */
router.post('/im-sync', auth, async (req, res, next) => {
  try {
    const body = req.body || {}
    const receiverId = Number(body.to) || null
    const type = body.type === 'image' || body.type === 'voice' || body.type === 'file' ? body.type : 'text'
    const content = String(body.content || '')
    if (!receiverId || !content) return fail(res, '参数不完整')

    const other = await User.findByPk(receiverId)
    if (!other) return fail(res, '用户不存在', 404)

    // 去重：同一发送者 90 秒内发给同一接收者的相同内容视为重复回报
    const dup = await Message.findOne({
      where: {
        senderId: req.userId,
        receiverId,
        type,
        content,
        createdAt: { [Op.gte]: new Date(Date.now() - 90 * 1000) }
      }
    })
    let message
    if (dup) {
      message = dup
    } else {
      message = await Message.create({
        sessionId: sessionId(req.userId, receiverId),
        senderId: req.userId,
        receiverId,
        type,
        content,
        isRead: false
      })
      // 接收方可能在自建 WS 聊天页（Socket.IO），推一份；若对方在官方 TUIKit 页，WS 未连接，无副作用
      if (req.app.get('io')) {
        req.app.get('io').to(`user_${receiverId}`).emit('message', message.toJSON())
      }
      // AI 用户触发自动回复
      if (type === 'text' && other.userType === 'ai') {
        setImmediate(() => tryAiAutoReply({
          app: req.app,
          senderId: req.userId,
          aiUser: other,
          lastContent: content
        }))
      }
    }
    success(res, message, '同步成功')
  } catch (err) { next(err) }
})

/** 发送消息（HTTP 备用通道；实时消息走 WebSocket） */
router.post('/', auth, async (req, res, next) => {
  try {
    const body = req.body || {}
    // 兼容两个命名：receiverId（后端原生）& to（前端 IM 常用写法，避免用户端聊天页提示"参数不完整"）
    const receiverIdRaw = body.receiverId != null ? body.receiverId : body.to
    const receiverId = Number(receiverIdRaw) || null
    const { type = 'text', content, duration } = body
    if (!receiverId || !content) return fail(res, '参数不完整')

    const other = await User.findByPk(receiverId)
    if (!other) return fail(res, '用户不存在', 404)

    const message = await Message.create({
      sessionId: sessionId(req.userId, receiverId),
      senderId: req.userId,
      receiverId,
      type,
      content,
      duration,
      isRead: false
    })

    // 通过 WebSocket 推送给接收方
    if (req.app.get('io')) {
      req.app.get('io').to(`user_${receiverId}`).emit('message', message.toJSON())
    }

    // 腾讯云 IM 转发：接收方若使用官方 TUIKit，只能通过 TIM 收消息（异步，不阻塞）
    setImmediate(() => forwardToIM(req.userId, receiverId, type, content))

    // 离线推送（接收方不在线时收到推送通知）
    const sender = await User.findByPk(req.userId)
    const senderName = sender ? sender.nickname : '新消息'
    const preview = type === 'voice' ? '[语音消息]' : type === 'image' ? '[图片]' : content
    const push = require('../utils/push')
    push.pushToUser(receiverId, {
      title: senderName,
      body: preview.length > 30 ? preview.slice(0, 30) + '...' : preview,
      extras: { type: 'im', sessionId: sessionId(req.userId, receiverId), senderId: req.userId }
    }).catch(() => {})

    // AI 用户：发送成功后触发自动回复（异步，不阻塞接口返回）
    if (type === 'text' && other && other.userType === 'ai') {
      setImmediate(() => tryAiAutoReply({
        app: req.app,
        senderId: req.userId,
        aiUser: other,
        lastContent: content
      }))
    }

    success(res, message, '发送成功')
  } catch (err) { next(err) }
})

module.exports = router
// WebSocket 通道（app.js）复用同一套 AI 自动回复，保证 WS 发消息也能触发
module.exports.tryAiAutoReply = tryAiAutoReply
// WebSocket 通道（app.js）复用腾讯云 IM 转发，保证官方 TUIKit 接收方能收到
module.exports.forwardToIM = forwardToIM
