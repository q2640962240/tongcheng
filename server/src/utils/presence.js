/**
 * 在线状态（presence）单点写入。
 *
 * 消费方只有一处：routes/user.js 的 isOnline = (now - lastActiveAt) < 5 分钟，
 * 用于首页/发现页的在线绿点。
 *
 * 原先唯一的生产者是 Socket.IO connect（app.js），但主通道是官方 TUIKit，
 * 它经腾讯云 IM 收发消息、根本不连自建 Socket.IO —— 只有兜底页
 * pages/chat/chat.vue 和未在 tabbar 上的 chat-list.vue 会连。
 * 结果是绿点对主通道用户恒为 false（2026-09-08 生产实测：6 个真人用户里
 * 5 个 lastActiveAt 为 NULL，剩下一个已 stale 31 小时）。
 *
 * 所以写入点改到鉴权中间件：任何带有效 token 的 HTTP 请求都算活跃。
 * 主通道的活跃聊天会走 /chat/im-sync 回报，浏览首页/发现页会走
 * optionalAuth 的列表接口，两条都覆盖到。
 */

// 必须显著小于消费方的 5 分钟窗口，否则用户明明在线也会被判掉线。
// 60s 意味着每个活跃用户每分钟最多一次 UPDATE。
const THROTTLE_MS = 60 * 1000

const lastWrite = new Map()

function touch(userId) {
  const id = Number(userId)
  if (!id) return
  const now = Date.now()
  const prev = lastWrite.get(id)
  if (prev && now - prev < THROTTLE_MS) return
  lastWrite.set(id, now)
  // 延迟 require：models 在 app 启动时才完成 sequelize 初始化
  const { User } = require('../models')
  User.update({ lastActiveAt: new Date(now) }, { where: { id } }).catch(() => {})
}

module.exports = { touch, THROTTLE_MS }
