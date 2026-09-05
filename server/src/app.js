require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const path = require('path')
const rateLimit = require('express-rate-limit')
const config = require('./config')
const { errorHandler, notFound } = require('./middleware/error')

// 路由
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/user')
const serviceRoutes = require('./routes/services')
const orderRoutes = require('./routes/orders')
const walletRoutes = require('./routes/wallet')
const inviteRoutes = require('./routes/invite')
const feedbackRoutes = require('./routes/feedback')
const settingsRoutes = require('./routes/settings')
const adminRoutes = require('./routes/admin')
const uploadRoutes = require('./routes/upload')
const chatRoutes = require('./routes/chat')
const configRoutes = require('./routes/config')
const pushRoutes = require('./routes/push')
const postRoutes = require('./routes/posts')
const groupRoutes = require('./routes/groups')
const bannerRoutes = require('./routes/banners')
const eliteRoutes = require('./routes/elite')
const regionRoutes = require('./routes/regions')
const locationRoutes = require('./routes/location')
const imRoutes = require('./routes/im')
const giftRoutes = require('./routes/gifts')

const app = express()

// 安全 & 基础中间件
app.use(helmet({ crossOriginResourcePolicy: false }))
// CORS：生产环境按 CORS_ORIGINS 白名单严格限定（逗号分隔多个域名，支持 * 作为域名前缀通配）
// 例：CORS_ORIGINS=https://baiye.yourdomain.com,https://admin.yourdomain.com,https://*.yourdomain.com
// 留空 / 未设置 + NODE_ENV=production → 默认仅放行 APP_DOMAIN 对应 origin
{
  const envList = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  const appDomain = config.appDomain || ''
  const origins = new Set(envList)
  try { if (appDomain) origins.add(new URL(appDomain).origin) } catch (_) {}
  const wildcardList = envList.filter(o => o.startsWith('*.'))
  const allowOrigin = (origin, cb) => {
    // 非浏览器请求（cURL / 后端互调 / Socket.IO 握手）origin 为空 → 放行
    if (!origin) return cb(null, true)
    // 显式配置裸 * = 允许所有来源（IP 直连/未配域名阶段使用；域名确定后应收紧为白名单）
    if (origins.has('*')) return cb(null, true)
    if (origins.has(origin)) return cb(null, true)
    if (wildcardList.length) {
      try {
        const host = new URL(origin).hostname.toLowerCase()
        const match = wildcardList.some(w => host.endsWith(w.slice(1).toLowerCase()))
        if (match) return cb(null, true)
      } catch (_) { /* ignore */ }
    }
    // 开发环境宽松；生产白名单未命中 → 拒绝（避免 credentials+* 组合被利用）
    if (config.env !== 'production') return cb(null, true)
    const e = new Error('CORS_NOT_ALLOWED')
    e.status = 403
    return cb(e, false)
  }
  app.use(cors({ origin: allowOrigin, credentials: true, maxAge: 86400 }))
}
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// XSS 输入清理
const { xssFilter } = require('./middleware/security')
app.use(xssFilter)

if (config.env !== 'test') {
  app.use(morgan('dev'))
}

// 静态文件：上传的文件
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// 限流（测试环境禁用）
const apiLimiter = (process.env.NODE_ENV === 'test' || process.env.RATE_LIMIT_ENABLED === 'false')
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: { code: 429, message: '请求过于频繁，请稍后再试' }
    })

// 健康检查
app.get('/health', (req, res) => {
  const db = require('./models')
  const driver = db.usingMysql ? 'mysql' : 'json'
  const dbConfig = require('./config').db
  res.json({
    status: 'ok',
    env: config.env,
    driver,
    storage: db.usingMysql
      ? `mysql://${dbConfig.host}:${dbConfig.port}/${dbConfig.name}`
      : require('path').join(__dirname, '..', 'data'),
    timestamp: new Date().toISOString()
  })
})

// API 路由
app.use('/api/auth', apiLimiter, authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/invite', inviteRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/push', pushRoutes)
app.use('/api/admin/config', configRoutes)
// 白夜 v2 新增路由
app.use('/api/posts', postRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/banners', bannerRoutes)
// 后台风格 Banner 路径别名（让 /api/admin/banners/* 也走 banners.js，统一 admin 路径前缀风格）
//  banners.js 内已实现同名别名 + adminAuth 鉴权
app.use('/api/admin/banners', bannerRoutes)
app.use('/api/elite', eliteRoutes)
app.use('/api/regions', regionRoutes)
app.use('/api/location', locationRoutes)
app.use('/api/im', imRoutes)
app.use('/api/gifts', giftRoutes)

// 健康检查接口（放在 404 处理之前）
app.get('/api/health', async (req, res) => {
  const db = require('./models')
  const driver = db.usingMysql ? 'mysql' : 'json'
  const result = { status: 'ok', driver, timestamp: Date.now() }
  if (db.usingMysql) {
    try {
      const [rows] = await db.sequelize.query('SELECT 1 AS n')
      if (rows && Array.isArray(rows) && rows.length && rows[0].n === 1) {
        result.dbOk = true
      } else {
        result.dbOk = false
        result.dbError = 'SELECT 1 unexpected result'
      }
    } catch (err) {
      result.status = 'degraded'
      result.dbOk = false
      result.dbError = (err && err.message) ? String(err.message) : 'db query failed'
    }
  } else {
    result.dbOk = true
  }
  res.json(result)
})

// 404 处理
app.use(notFound)

// 全局错误处理（放在 404 之后，统一兜底 SyntaxError / 数据库连接错误等）
app.use(errorHandler)

// 启动 HTTP 服务（仅在直接执行时启动，测试 require 时不启动）
const PORT = config.port
let server = null
let io = null

async function startApp() {
  const db = require('./models')
  // 1) 初始化数据库（连接 + 建表），测试交给 setup.js 自行控制
  if (config.env !== 'test') {
    const info = await db.bootstrap()
    console.log(`[DB] 驱动: ${info.driver.toUpperCase()}`)
  }
  if (require.main !== module) return // require(app) 用于 test:supertest

  server = app.listen(PORT, async () => {
    console.log(`[Companion Play API] running at http://localhost:${PORT} (${config.env})`)
    if (!db.usingMysql) {
      const path = require('path')
      console.log(`[Storage] JSON file store at: ${path.join(__dirname, '..', 'data')}`)
    } else {
      console.log(`[Storage] MySQL at: ${config.db.host}:${config.db.port}/${config.db.name} (pool ${config.db.poolMin}-${config.db.poolMax})`)
    }
  })

  // WebSocket（IM 实时通讯）
  const { Server } = require('socket.io')
  io = new Server(server, {
    cors: { origin: '*', credentials: true }
  })
  app.set('io', io)
  module.exports.io = io

  // JWT 鉴权
  const jwt = require('jsonwebtoken')
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token
    if (!token) return next(new Error('未提供 token'))
    try {
      const decoded = jwt.verify(token, config.jwt.secret)
      socket.userId = decoded.id
      next()
    } catch (e) {
      next(new Error('token 无效'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`[WS] user_${socket.userId} connected`)
    socket.join(`user_${socket.userId}`)

    // 更新最后活跃时间（用于在线状态判断）
    setImmediate(() => {
      const { User } = require('./models')
      User.update({ lastActiveAt: new Date() }, { where: { id: socket.userId } }).catch(() => {})
    })

    // 发送消息
    socket.on('message', async (data, ack) => {
      try {
        const { Message, User } = require('./models')
        const { receiverId, type = 'text', content, duration } = data
        if (!receiverId || !content) {
          if (ack) ack({ ok: false, message: '参数不完整' })
          return
        }
        const msg = await Message.create({
          sessionId: [Number(socket.userId), Number(receiverId)].sort((a, b) => a - b).join('-'),
          senderId: socket.userId,
          receiverId,
          type,
          content,
          duration,
          isRead: false
        })
        // 推送给接收方
        io.to(`user_${receiverId}`).emit('message', msg.toJSON())
        if (ack) ack({ ok: true, data: msg.toJSON() })

        // 同步转发到腾讯云 IM，保证使用官方 TUIKit 的接收方也能收到（异步，不阻塞）
        setImmediate(() => {
          try {
            const { forwardToIM } = require('./routes/chat')
            forwardToIM(socket.userId, receiverId, type, content)
          } catch (e) {
            console.warn('[WS] forwardToIM error:', e.message)
          }
        })

        // AI 用户：与 HTTP 通道一致触发自动回复（异步，不阻塞 ack）
        if (type === 'text') {
          const other = await User.findByPk(receiverId)
          if (other && other.userType === 'ai') {
            const { tryAiAutoReply } = require('./routes/chat')
            setImmediate(() => tryAiAutoReply({
              app,
              senderId: socket.userId,
              aiUser: other,
              lastContent: content
            }))
          }
        }
      } catch (err) {
        console.error('[WS] message error:', err)
        if (ack) ack({ ok: false, message: err.message })
      }
    })

    // 输入中通知
    socket.on('typing', (data) => {
      io.to(`user_${data.receiverId}`).emit('typing', { from: socket.userId })
    })

    // 已读回执
    socket.on('read', async (data) => {
      const { Message } = require('./models')
      const msgs = await Message.findAll({
        where: { senderId: data.receiverId, receiverId: socket.userId, isRead: false }
      })
      for (const m of msgs) await m.update({ isRead: true })
      io.to(`user_${data.receiverId}`).emit('read', { by: socket.userId })
    })

    socket.on('disconnect', () => {
      console.log(`[WS] user_${socket.userId} disconnected`)
    })
  })
}

if (require.main === module) {
  startApp().catch(err => {
    console.error('[app] 启动失败:', err)
    process.exit(1)
  })
}

// 捕获未处理异常
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

/** 向指定用户推送 Socket.IO 事件（在线推送） */
function emitToUser(userId, event, data) {
  if (!io) return false
  io.to(`user_${userId}`).emit(event, data)
  return true
}

module.exports = app
module.exports.emitToUser = emitToUser
module.exports.io = io
