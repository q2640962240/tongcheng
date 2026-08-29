/**
 * [deprecated] 旧版配置中心路由（仅保留兼容，避免老调用 404）
 * 统一实现已迁移到 routes/admin.js 的 /admin/config/modules/* 版本：
 *   - GET  /api/admin/config/modules          模块清单
 *   - GET  /api/admin/config/modules/:name    某模块配置（含字段元信息）
 *   - PUT  /api/admin/config/modules/:name    保存配置
 *   - POST /api/admin/config/modules/:name/test 连通性测试
 *   - DELETE /api/admin/config/modules/:name  重置到默认值
 * 管理后台 Settings.vue 已切换到新版 modules API；本文件不再扩展，仅作为兼容保留。
 */
const express = require('express')
const router = express.Router()
const { Config } = require('../models')
const { getModuleConfig, set, setModule, clearCache, ENV_DEFAULTS } = require('../utils/config')
const { success, fail } = require('../utils/response')
const sms = require('../utils/sms')
const wxpay = require('../utils/wxpay')
const alipay = require('../utils/alipay')
const oss = require('../utils/oss')

/** 管理员鉴权（与 admin.js 同款） */
const adminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token']
  if (!token || !token.startsWith('admin_')) return fail(res, '请先登录', 401)
  req.adminId = token.replace('admin_', '')
  next()
}

router.use(adminAuth)

/**
 * 模块元信息（管理后台渲染表单用）
 */
const MODULE_META = {
  app: {
    label: '应用配置',
    icon: 'Setting',
    fields: [
      { key: 'name', label: '应用名称', type: 'string' },
      { key: 'domain', label: '服务端域名', type: 'string', placeholder: 'https://your-domain.com', description: '用于支付回调、短信、推送等服务端地址' },
      { key: 'kefuWechat', label: '客服微信号', type: 'string' }
    ]
  },
  sms: {
    label: '短信服务',
    icon: 'Message',
    description: '验证码短信服务，支持 dev / aliyun / tencent 三种模式',
    fields: [
      { key: 'provider', label: '服务商', type: 'select', options: [
        { value: 'dev', label: 'dev（开发模式，控制台打印验证码）' },
        { value: 'aliyun', label: '阿里云短信' },
        { value: 'tencent', label: '腾讯云短信' }
      ] },
      { key: 'accessKeyId', label: 'AccessKeyId', type: 'secret', placeholder: 'LTAI5tXXXX' },
      { key: 'accessKeySecret', label: 'AccessKeySecret', type: 'secret' },
      { key: 'signName', label: '短信签名', type: 'string', placeholder: '白夜' },
      { key: 'templateCode', label: '默认模板ID', type: 'string', placeholder: 'SMS_XXXXXX' },
      { key: 'templateLogin', label: '登录模板ID', type: 'string' },
      { key: 'templateRegister', label: '注册模板ID', type: 'string' }
    ]
  },
  wxpay: {
    label: '微信支付',
    icon: 'Wallet',
    description: '未启用时充值为模拟（直接到账），启用后对接真实支付',
    fields: [
      { key: 'enabled', label: '启用微信支付', type: 'boolean' },
      { key: 'appId', label: 'AppID', type: 'string' },
      { key: 'mchId', label: '商户号', type: 'string' },
      { key: 'mchKey', label: '商户密钥', type: 'secret' },
      { key: 'notifyUrl', label: '支付回调地址', type: 'string', placeholder: 'https://your-domain.com/api/wallet/wx-notify' },
      { key: 'certPath', label: '商户证书路径', type: 'string', description: '可选，生产环境建议配置' },
      { key: 'certKey', label: '证书序列号', type: 'secret' }
    ]
  },
  alipay: {
    label: '支付宝',
    icon: 'Wallet',
    description: '未启用时充值为模拟，启用后对接真实支付宝',
    fields: [
      { key: 'enabled', label: '启用支付宝', type: 'boolean' },
      { key: 'appId', label: 'AppID', type: 'string' },
      { key: 'privateKey', label: '应用私钥', type: 'secret', description: 'PKCS8 格式' },
      { key: 'publicKey', label: '支付宝公钥', type: 'secret' },
      { key: 'notifyUrl', label: '异步通知地址', type: 'string' },
      { key: 'sandbox', label: '沙箱模式', type: 'boolean' }
    ]
  },
  oss: {
    label: 'OSS 存储',
    icon: 'Upload',
    description: 'local 模式存本地 uploads/，aliyun 模式存阿里云 OSS',
    fields: [
      { key: 'provider', label: '存储方式', type: 'select', options: [
        { value: 'local', label: '本地存储' },
        { value: 'aliyun', label: '阿里云 OSS' }
      ] },
      { key: 'region', label: 'Region', type: 'string', placeholder: 'oss-cn-hangzhou' },
      { key: 'bucket', label: 'Bucket', type: 'string' },
      { key: 'accessKeyId', label: 'AccessKeyId', type: 'secret' },
      { key: 'accessKeySecret', label: 'AccessKeySecret', type: 'secret' },
      { key: 'endpoint', label: 'Endpoint（可选）', type: 'string' },
      { key: 'cdnDomain', label: 'CDN 域名（可选）', type: 'string', placeholder: 'https://cdn.your-domain.com' }
    ]
  },
  push: {
    label: '推送服务',
    icon: 'Bell',
    description: '叫醒服务、订单状态、IM 离线推送',
    fields: [
      { key: 'enabled', label: '启用推送', type: 'boolean' },
      { key: 'provider', label: '服务商', type: 'select', options: [
        { value: 'none', label: '未启用' },
        { value: 'jpush', label: '极光推送' },
        { value: 'getui', label: '个推' },
        { value: 'mi', label: '小米推送' }
      ] },
      { key: 'appKey', label: 'AppKey', type: 'secret' },
      { key: 'masterSecret', label: 'MasterSecret', type: 'secret' },
      { key: 'channelId', label: 'Channel ID', type: 'string' }
    ]
  }
}

/**
 * 获取所有模块元信息 + 当前值
 */
router.get('/modules', async (req, res, next) => {
  try {
    const result = []
    for (const [name, meta] of Object.entries(MODULE_META)) {
      const values = await getModuleConfig(name)
      // 敏感字段打码展示
      const maskedValues = { ...values }
      for (const f of meta.fields) {
        if (f.type === 'secret' && maskedValues[f.key]) {
          const v = String(maskedValues[f.key])
          maskedValues[f.key] = v ? `${v.slice(0, 4)}****${v.slice(-4)}` : ''
        }
      }
      result.push({ name, ...meta, values: maskedValues })
    }
    success(res, result)
  } catch (err) { next(err) }
})

/**
 * 获取单个模块配置（含完整明文，仅 superadmin 可访问）
 * 简化版：所有管理员均可见
 */
router.get('/modules/:name', async (req, res, next) => {
  try {
    const { name } = req.params
    if (!MODULE_META[name]) return fail(res, '模块不存在', 404)
    const values = await getModuleConfig(name)
    success(res, { name, ...MODULE_META[name], values })
  } catch (err) { next(err) }
})

/**
 * 更新单个模块配置（批量）
 */
router.put('/modules/:name', async (req, res, next) => {
  try {
    const { name } = req.params
    if (!MODULE_META[name]) return fail(res, '模块不存在', 404)
    const updates = req.body || {}

    // 过滤掉打码占位（****）字段，避免覆盖原值
    const meta = MODULE_META[name]
    const currentValues = await getModuleConfig(name)
    const filtered = {}
    for (const f of meta.fields) {
      const val = updates[f.key]
      if (val === undefined || val === null) continue
      // 敏感字段：若为打码值（含 ****），跳过
      if (f.type === 'secret' && typeof val === 'string' && val.includes('****')) continue
      // 布尔字段处理
      if (f.type === 'boolean') {
        filtered[f.key] = val === true || val === 'true' || val === 1 ? 'true' : 'false'
      } else {
        filtered[f.key] = String(val)
      }
    }

    await setModule(name, filtered)
    clearCache(name)
    success(res, null, '配置已更新')
  } catch (err) { next(err) }
})

/**
 * 重置某模块到默认（清空 DB 覆盖项）
 */
router.delete('/modules/:name', async (req, res, next) => {
  try {
    const { name } = req.params
    if (!MODULE_META[name]) return fail(res, '模块不存在', 404)
    const rows = await Config.findAll({ where: { module: name } })
    for (const r of rows) await r.destroy()
    clearCache(name)
    success(res, null, '已重置为默认配置')
  } catch (err) { next(err) }
})

/**
 * 测试某模块连通性
 */
router.post('/modules/:name/test', async (req, res, next) => {
  try {
    const { name } = req.params
    let result
    switch (name) {
      case 'sms': result = await sms.testConfig(); break
      case 'wxpay': result = await wxpay.testConfig(); break
      case 'alipay': result = await alipay.testConfig(); break
      case 'oss': result = await oss.testConfig(); break
      case 'app':
        result = { success: true, message: '应用配置无需测试', provider: 'app' }
        break
      case 'push':
        result = { success: true, message: '推送服务测试（待实现）', provider: 'push' }
        break
      default: return fail(res, '不支持的模块', 404)
    }
    success(res, result)
  } catch (err) { next(err) }
})

module.exports = router
