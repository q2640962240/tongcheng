/**
 * 安全中间件
 * - XSS 输入清理
 * - 敏感字段日志脱敏
 * - 请求体大小限制
 */
const validator = require('validator')

/** XSS 清理：转义 HTML 特殊字符 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/** 递归清理对象中的字符串值 */
function sanitizeValue(value, depth = 0) {
  if (depth > 10) return value  // 防止深度嵌套
  if (typeof value === 'string') return escapeHtml(value.trim())
  if (Array.isArray(value)) return value.map(v => sanitizeValue(v, depth + 1))
  if (value && typeof value === 'object') {
    const cleaned = {}
    for (const [k, v] of Object.entries(value)) {
      cleaned[k] = sanitizeValue(v, depth + 1)
    }
    return cleaned
  }
  return value
}

/** XSS 输入清理中间件 */
function xssFilter(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body)
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query)
  }
  next()
}

/** 敏感字段脱敏（用于日志） */
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'code', 'idCard', 'realName', 'bankCard']

function maskSensitive(obj, depth = 0) {
  if (depth > 5 || !obj || typeof obj !== 'object') return obj
  const masked = Array.isArray(obj) ? [...obj] : { ...obj }
  for (const key of Object.keys(masked)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      const v = masked[key]
      if (typeof v === 'string' && v.length > 4) {
        masked[key] = v.slice(0, 2) + '****' + v.slice(-2)
      } else if (v) {
        masked[key] = '****'
      }
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitive(masked[key], depth + 1)
    }
  }
  return masked
}

/** 安全日志（脱敏后输出） */
function safeLog(label, data) {
  if (process.env.NODE_ENV === 'test') return
  console.log(`[${label}]`, JSON.stringify(maskSensitive(data)))
}

/** 手机号校验 */
function isValidPhone(phone) {
  return typeof phone === 'string' && /^1\d{10}$/.test(phone)
}

/** 金额校验（正整数，单位分） */
function isValidAmount(amount) {
  const n = Number(amount)
  return Number.isInteger(n) && n > 0 && n < 100000000  // 单次最大 100 万
}

module.exports = {
  xssFilter,
  maskSensitive,
  safeLog,
  isValidPhone,
  isValidAmount,
  escapeHtml,
  sanitizeValue
}
