/**
 * 支付宝支付抽象层 — 生产级
 *
 * 支持：电脑网站(web) / 手机网站(wap) / APP 支付 + 回调验签 + 退款
 * 依赖：alipay-sdk (官方)
 *
 * 生产原则：
 *   - 未启用 or 必要字段缺失 → 一律返回错误，不再 dev 回退
 *   - 回调严格使用官方 SDK 的 checkNotifySign 做验签
 *
 * 使用：
 *   const { createOrder, verifyNotify, refund, testConfig } = require('../utils/alipay')
 */
const { getModuleConfig } = require('./config')

function loadSDK() {
  try { return require('alipay-sdk').default || require('alipay-sdk') } catch (e) { return null }
}

function missingFields(cfg, required) {
  return required.filter(k => !cfg[k])
}

async function getConfig() {
  return getModuleConfig('alipay')
}

async function isEnabled() {
  const cfg = await getConfig()
  if (String(cfg.enabled) !== 'true') return false
  return missingFields(cfg, ['appId', 'privateKey', 'notifyUrl']).length === 0
}

async function createOrder(params) {
  const cfg = await getConfig()
  if (String(cfg.enabled) !== 'true') {
    return { success: false, provider: 'alipay', message: '支付宝未启用，请在管理后台「配置中心 → 支付宝」打开 enabled 开关' }
  }
  const required = ['appId', 'privateKey', 'notifyUrl']
  const miss = missingFields(cfg, required)
  if (miss.length) {
    return { success: false, provider: 'alipay', message: `支付宝缺少必要配置: ${miss.join(', ')}，请在管理后台填写` }
  }
  const AlipaySDK = loadSDK()
  if (!AlipaySDK) {
    return { success: false, provider: 'alipay', message: '支付宝 SDK 未安装，请执行 npm i alipay-sdk' }
  }
  const { outTradeNo, subject, amountFen, tradeType = 'wap', returnUrl } = params
  try {
    const sdk = new AlipaySDK({
      appId: cfg.appId,
      privateKey: cfg.privateKey,
      alipayPublicKey: cfg.publicKey,
      charset: 'utf-8',
      version: '1.0',
      signType: 'RSA2',
      gateway: cfg.sandbox === true || String(cfg.sandbox) === 'true'
        ? 'https://openapi.alipaydev.com/gateway.do'
        : 'https://openapi.alipay.com/gateway.do'
    })
    const amountYuan = (Number(amountFen) / 100).toFixed(2)
    const methodMap = {
      web: 'alipay.trade.page.pay',
      app: 'alipay.trade.app.pay',
      wap: 'alipay.trade.wap.pay'
    }
    const productCodeMap = {
      web: 'FAST_INSTANT_TRADE_PAY',
      app: 'QUICK_MSECURITY_PAY',
      wap: 'QUICK_WAP_WAY'
    }
    const method = methodMap[tradeType] || methodMap.wap
    const productCode = productCodeMap[tradeType] || productCodeMap.wap
    const bizContent = {
      out_trade_no: outTradeNo,
      product_code: productCode,
      subject,
      total_amount: amountYuan
    }
    const options = { notifyUrl: cfg.notifyUrl }
    if (returnUrl) {
      options.returnUrl = returnUrl
      bizContent.passback_params = encodeURIComponent(`returnUrl=${returnUrl}`)
    }
    const result = await sdk.exec(method, bizContent, options)
    const res = { success: true, provider: 'alipay', message: '下单成功' }
    if (tradeType === 'app') {
      res.payStr = typeof result === 'string' ? result : (result?.body || '')
    } else {
      // web/wap: SDK 返回 url 或 form 字符串（新版 exec 返回的是包含 url 的对象或字符串）
      if (result && typeof result === 'object') {
        res.payUrl = result.url || result.redirect_url || ''
        res.form = result.form || ''
      } else {
        res.payUrl = String(result || '')
      }
    }
    return res
  } catch (e) {
    return { success: false, provider: 'alipay', message: `支付宝下单失败: ${e.message}` }
  }
}

/**
 * 异步回调验签（官方 SDK）
 */
async function verifyNotify(params) {
  const cfg = await getConfig()
  const AlipaySDK = loadSDK()
  if (!AlipaySDK) {
    return { verified: false, message: '支付宝 SDK 未安装，请执行 npm i alipay-sdk' }
  }
  if (String(cfg.enabled) !== 'true') {
    return { verified: false, message: '支付宝未启用，拒绝处理回调' }
  }
  try {
    const sdk = new AlipaySDK({
      appId: cfg.appId,
      privateKey: cfg.privateKey,
      alipayPublicKey: cfg.publicKey,
      signType: 'RSA2'
    })
    const verified = sdk.checkNotifySign(params || {})
    if (!verified) return { verified: false, message: '支付宝回调签名校验失败' }
    return { verified: true, data: params, message: '验签通过' }
  } catch (e) {
    return { verified: false, message: `支付宝回调验签异常: ${e.message}` }
  }
}

async function refund(params) {
  const cfg = await getConfig()
  if (String(cfg.enabled) !== 'true') {
    return { success: false, provider: 'alipay', message: '支付宝未启用' }
  }
  const AlipaySDK = loadSDK()
  if (!AlipaySDK) return { success: false, provider: 'alipay', message: '支付宝 SDK 未安装' }
  const { outTradeNo, outRefundNo, refundFen, reason } = params
  try {
    const sdk = new AlipaySDK({
      appId: cfg.appId,
      privateKey: cfg.privateKey,
      alipayPublicKey: cfg.publicKey,
      signType: 'RSA2',
      gateway: cfg.sandbox === true || String(cfg.sandbox) === 'true'
        ? 'https://openapi.alipaydev.com/gateway.do'
        : 'https://openapi.alipay.com/gateway.do'
    })
    const result = await sdk.exec('alipay.trade.refund', {
      out_trade_no: outTradeNo,
      out_request_no: outRefundNo || `RF${Date.now()}`,
      refund_amount: (Number(refundFen) / 100).toFixed(2),
      refund_reason: reason || '用户申请退款'
    }, {})
    return {
      success: true,
      provider: 'alipay',
      refundId: result?.trade_no || result?.body?.trade_no || '',
      raw: result,
      message: '退款已申请'
    }
  } catch (e) {
    return { success: false, provider: 'alipay', message: `支付宝退款失败: ${e.message}` }
  }
}

async function testConfig() {
  const cfg = await getConfig()
  if (String(cfg.enabled) !== 'true') {
    return { success: false, provider: 'alipay', message: '支付宝未启用，请在配置中心打开 enabled 开关' }
  }
  const miss = missingFields(cfg, ['appId', 'privateKey', 'notifyUrl'])
  if (miss.length) {
    return { success: false, provider: 'alipay', message: `缺少配置: ${miss.join(', ')}` }
  }
  if (!cfg.publicKey) {
    return { success: false, provider: 'alipay', message: '缺少 alipayPublicKey（支付宝平台公钥），回调将无法验签，请在配置中心填写' }
  }
  if (!loadSDK()) {
    return { success: false, provider: 'alipay', message: '依赖 alipay-sdk 未安装: npm i alipay-sdk' }
  }
  return { success: true, provider: 'alipay', message: '支付宝配置校验通过（未真实下单，仅校验字段/SDK）' }
}

function validateConfig(cfg) {
  if (String(cfg?.enabled) !== 'true') {
    return { ok: false, message: '支付宝未启用，请在「配置中心 → 支付宝」打开 enabled 开关' }
  }
  const miss = missingFields(cfg, ['appId', 'privateKey', 'notifyUrl'])
  if (miss.length) return { ok: false, message: `支付宝缺少必要配置: ${miss.join(', ')}` }
  return { ok: true }
}

module.exports = {
  isEnabled,
  createOrder,
  verifyNotify,
  refund,
  testConfig,
  validateConfig
}
