import http from './http'

// 鉴权
export const login = (data) => http.post('/admin/login', data)

// 仪表盘
export const getDashboard = () => http.get('/admin/dashboard')

// 用户管理
export const getUsers = (params) => http.get('/admin/users', { params })
export const getUserDetail = (id) => http.get(`/admin/users/${id}`)
export const createUser = (data) => http.post('/admin/users', data)
export const updateUser = (id, data) => http.put(`/admin/users/${id}`, data)
export const updateUserStatus = (id, status) => http.put(`/admin/users/${id}/status`, { status })
export const auditElite = (id, approved) => http.put(`/admin/users/${id}/elite`, { approved })

// 服务管理
export const getServices = (params) => http.get('/admin/services', { params })
export const auditService = (id, data) => http.put(`/admin/services/${id}/audit`, data)
export const createServiceForUser = (data) => http.post('/admin/services/create-for-user', data)
// 搜索用户（下拉选择器使用）
export const searchUsers = (keyword, pageSize = 20) => http.get('/admin/users', { params: { keyword, page: 1, pageSize } })
// 用户端可展示服务类型 / 分类管理
export const serviceCategoriesApi = {
  list: () => http.get('/admin/service-categories'),
  create: (data) => http.post('/admin/service-categories', data),
  update: (key, data) => http.put(`/admin/service-categories/${key}`, data),
  toggle: (key) => http.put(`/admin/service-categories/${key}/toggle-visible`),
  del: (key, force = false) => http.delete(`/admin/service-categories/${key}${force ? '?force=1' : ''}`),
  // 用户端分类（含可见性过滤，复用 services 路由）
  publicList: () => http.get('/services/categories')
}

// 订单管理
export const getOrders = (params) => http.get('/admin/orders', { params })
export const refundOrder = (id) => http.put(`/admin/orders/${id}/refund`)

// 反馈管理
export const getFeedbacks = (params) => http.get('/admin/feedback', { params })
export const handleFeedback = (id, data) => http.put(`/admin/feedback/${id}`, data)

// 财务管理
export const getFinanceTransactions = (params) => http.get('/admin/finance/transactions', { params })

// 提现审核
export const getWithdrawals = (params) => http.get('/admin/withdrawals', { params })
export const auditWithdrawal = (id, data) => http.put(`/admin/withdrawals/${id}`, data)

// 邀请管理
export const getInviteLeaderboard = () => http.get('/admin/invite/leaderboard')

// ==================== 配置中心 ====================
export const getConfigModules = () => http.get('/admin/config/modules')
export const getConfigModule = (name) => http.get(`/admin/config/modules/${name}`)
export const updateConfigModule = (name, values) => http.put(`/admin/config/modules/${name}`, values)
export const resetConfigModule = (name) => http.delete(`/admin/config/modules/${name}`)
// 测试连通性：带上当前表单 values（不等「保存后再测」，也避免依赖缓存导致「瞎填也通过」）
export const testConfigModule = (name, values) => http.post(`/admin/config/modules/${name}/test`, { values })

// ==================== 动态管理 (白夜 v2) ====================
export const postsApi = {
  list: (params) => http.get('/admin/posts', { params }),
  audit: (id, status) => http.put(`/admin/posts/${id}/audit`, { status }),
  del: (id) => http.delete(`/admin/posts/${id}`)
}

// ==================== 组局管理 (白夜 v2) ====================
export const groupsApi = {
  list: (params) => http.get('/admin/groups', { params }),
  del: (id) => http.delete(`/admin/groups/${id}`)
}

// ==================== Banner 管理 (白夜 v2) ====================
export const bannersApi = {
  list: (params) => http.get('/admin/banners', { params }),
  create: (data) => http.post('/admin/banners', data),
  update: (id, data) => http.put(`/admin/banners/${id}`, data),
  del: (id) => http.delete(`/admin/banners/${id}`)
}

// ==================== 精英订单 (白夜 v2) ====================
export const eliteOrdersApi = {
  list: (params) => http.get('/admin/elite/orders', { params })
}

// ==================== 认证管理 (白夜 v2) ====================
export const certificationsApi = {
  list: (params) => http.get('/admin/certifications', { params }),
  audit: (id, status, rejectReason) => http.put(`/admin/certifications/${id}/audit`, { status, rejectReason })
}

