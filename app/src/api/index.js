/**
 * API 定义 — 按模块聚合
 */
import { get, post, put, del } from '../utils/request'
import { uploadFile, uploadFiles, uploadFileTo } from '../utils/upload'

// ==================== 鉴权 ====================
export const authApi = {
  sendSms: (phone, scene) => post('/auth/sms', { phone, scene: scene || 'login' }),
  login: (phone, code) => post('/auth/login', { phone, code }),
  loginByPassword: (phone, password) => post('/auth/login-password', { phone, password }),
  refresh: (refreshToken) => post('/auth/refresh', { refreshToken }),
  setPassword: (payload) => post('/auth/password', payload),
  logout: () => post('/auth/logout')
}

// ==================== 用户 ====================
export const userApi = {
  profile: () => get('/user/profile'),
  updateProfile: (data) => put('/user/profile', data),
  uploadAvatar: (filePath) => uploadFileTo('/user/avatar', filePath, 'file'),
  applyElite: (filePath, formData) => uploadFileTo('/user/elite/apply', filePath, 'photo', formData),
  applyEliteJson: (data) => post('/user/elite/apply', data),
  certifications: () => get('/user/certifications'),
  // 客服信息（聊天页"联系客服"按钮）
  kefu: () => get('/user/kefu'),
  // 用户搜索（寻人大厅 & 搜索页）
  discover: (params) => get('/user/discover', params),
  // 社交 — 公开主页
  publicProfile: (id) => get(`/user/${id}/public-profile`),
  follow: (id) => post(`/user/${id}/follow`),
  unfollow: (id) => del(`/user/${id}/follow`),
  followers: (id, params) => get(`/user/${id}/followers`, { params }),
  following: (id, params) => get(`/user/${id}/following`, { params }),
  sendGreeting: (id, data) => post(`/user/${id}/greet`, data),
}

// ==================== 钱包 ====================
export const walletApi = {
  balance: () => get('/wallet/balance'),
  recharge: (amount) => post('/wallet/recharge', { amount }),
  withdraw: (amount) => post('/wallet/withdraw', { amount }),
  transactions: (params) => get('/wallet/transactions', params),
  // 每日签到（红包签到专区）
  signIn: () => post('/wallet/sign-in'),
  signInStatus: () => get('/wallet/sign-in/status')
}

// ==================== 聊天 ====================
export const chatApi = {
  sessions: () => get('/chat/sessions'),
  history: (userId, params) => get(`/chat/history/${userId}`, params),
  send: (data) => post('/chat', data)
}

// ==================== 邀请 ====================
export const inviteApi = {
  stats: () => get('/invite/stats'),
  invitees: (params) => get('/invite/invitees', params),
  shareInfo: () => get('/invite/share-info'),
  bind: (inviteCode) => post('/invite/bind', { inviteCode })
}

// ==================== 礼物 ====================
export const giftApi = {
  // 获取礼物列表
  list: () => get('/gifts'),
  // 发送礼物
  send: (data) => post('/gifts/send', data),
  // 查询礼物收入
  income: () => get('/gifts/income'),
  // 申请提现
  withdraw: (data) => post('/gifts/withdraw', data),
}

// ==================== 反馈 ====================
export const feedbackApi = {
  types: () => get('/feedback/types'),
  submit: (data) => post('/feedback', data),
  list: (params) => get('/feedback', params)
}

// ==================== 上传 ====================
export const uploadApi = {
  file: (filePath, name) => uploadFile(filePath, name),
  files: (filePaths) => uploadFiles(filePaths),
  voice: (filePath) => uploadFile(filePath, 'voice')
}

// ==================== 推送 ====================
export const pushApi = {
  test: () => post('/push/test'),
  wakeUp: (orderId, userId) => post('/push/wake-up', { orderId, userId }),
  broadcast: (title, body) => post('/push/broadcast', { title, body })
}

// ==================== 设置 ====================
export const settingsApi = {
  get: () => get('/settings'),
  bindPhone: (phone, code) => post('/settings/phone', { phone, code }),
  toggleSmsDnd: (enabled) => post('/settings/sms-dnd', { enabled }),
  cancelAccount: () => post('/settings/cancel-account'),
  // 动态/组局通知开关（设置页 Tab）
  notify: (type, enabled) => post('/settings/notify', { type, enabled })
}

// ==================== 动态 (白夜 v2 新增) ====================
export const postApi = {
  list: (params) => get('/posts', params),
  detail: (id) => get(`/posts/${id}`),
  create: (data) => post('/posts', data),
  remove: (id) => del(`/posts/${id}`),
  like: (id) => post(`/posts/${id}/like`),
  commentList: (id, params) => get(`/posts/${id}/comments`, params),
  comment: (id, data) => post(`/posts/${id}/comments`, data),
}

// ==================== 组局 (白夜 v2 新增) ====================
export const groupApi = {
  list: (params) => get('/groups', params),
  detail: (id) => get(`/groups/${id}`),
  create: (data) => post('/groups', data),
  update: (id, data) => put(`/groups/${id}`, data),
  close: (id) => del(`/groups/${id}`),
  join: (id, remark) => post(`/groups/${id}/join`, { remark }),
  joins: (id) => get(`/groups/${id}/joins`),
  handleJoin: (id, joinId, status) => put(`/groups/${id}/joins/${joinId}`, { status }),
}

// ==================== Banner (白夜 v2 新增) ====================
export const bannerApi = {
  list: (params) => get('/banners', params),
}

// ==================== 精英认证 (白夜 v2 新增) ====================
export const eliteApi = {
  rights: () => get('/elite/rights'),
  order: (channel) => post('/elite/pay/order', { channel }),
  devPay: () => post('/elite/dev/pay'),
  notify: (channel, body) => post(`/elite/pay/notify/${channel}`, body),
  unlockWechat: (userId) => post('/elite/user/unlock-wechat', { userId }),
  contactQuota: (userId) => post('/elite/user/contact', { userId }),
}

// ==================== 行政区划 / 定位 (白夜 v2 企业级) ====================
export const regionApi = {
  // 省 → 市 两级树，覆盖 34 省 + 民政 2024 全部地级单位
  tree: () => get('/regions/tree'),
  // 中文 / 拼音 / 别名 模糊检索，用于城市选择页实时搜索
  search: (kw, limit = 50) => get('/regions/search', { kw, limit }),
  // 数据集元信息（省份数、城市数、版本）
  meta: () => get('/regions/meta')
}

export const locationApi = {
  // 逆地理：经纬度 → 省/市/区；未配置地理服务时 source=not-configured
  reverse: ({ lat, lng }) => post('/location/reverse', { lat, lng }),
  // IP 粗定位：不依赖外部 key，本地规则兜底
  guessByIp: () => get('/location/guess-by-ip')
}

export default {
  auth: authApi,
  user: userApi,
  wallet: walletApi,
  chat: chatApi,
  invite: inviteApi,
  gift: giftApi,
  feedback: feedbackApi,
  upload: uploadApi,
  push: pushApi,
  settings: settingsApi,
  post: postApi,
  group: groupApi,
  banner: bannerApi,
  elite: eliteApi,
  region: regionApi,
  location: locationApi,
}
