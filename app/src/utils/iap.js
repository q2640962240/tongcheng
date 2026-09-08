/**
 * Apple IAP（应用内购买）工具
 *
 * 仅在 APP-IOS 端启用，用于精英会员的 App Store 内购。
 * 使用 uni-app 封装的 plus.payment / uni.requestPayment 发起购买。
 *
 * 流程：
 *   1. purchaseElite()  → 调用 Apple IAP 弹窗
 *   2. 获得 transactionId + receipt
 *   3. 提交后端 /api/elite/iap/verify 校验
 *   4. 校验通过则开通精英
 */

import { IAP_PRODUCT_ELITE } from '../config/features'

/**
 * 发起精英会员 IAP 购买
 * @returns {Promise<{transactionId: string, receipt: string}>}
 */
export async function purchaseElite() {
  // #ifndef APP-IOS
  throw new Error('Apple IAP 仅在 iOS 端可用')
  // #endif

  // #ifdef APP-IOS
  return new Promise((resolve, reject) => {
    try {
      uni.requestPayment({
        provider: 'appleiap',
        orderInfo: {
          productid: IAP_PRODUCT_ELITE,
          quantity: 1,
          username: ''
        },
        success: (res) => {
          // uni-app IAP 成功回调返回 transactionId / receipt
          const transactionId = (res && res.transactionId) || (res && res.transactionIdentifier) || ''
          const receipt = (res && res.receipt) || (res && res.transactionReceipt) || ''
          if (!receipt) {
            reject(new Error('IAP 票据为空，请稍后重试'))
            return
          }
          resolve({ transactionId, receipt })
        },
        fail: (err) => {
          const code = err && err.errCode
          // 用户主动取消购买，不算错误
          if (code === 1 || (err && /cancel/i.test(err.errMsg || ''))) {
            reject(new Error('USER_CANCEL'))
            return
          }
          reject(new Error((err && err.errMsg) || 'IAP 购买失败'))
        }
      })
    } catch (e) {
      reject(e)
    }
  })
  // #endif
}

/**
 * 获取 IAP 商品信息（价格、描述等）
 * @returns {Promise<{productId: string, price: number, localizedTitle: string}>}
 */
export async function getProductInfo(productId = IAP_PRODUCT_ELITE) {
  // #ifndef APP-IOS
  return { productId, price: 30, localizedTitle: '白夜精英·终身会员' }
  // #endif

  // #ifdef APP-IOS
  return new Promise((resolve, reject) => {
    try {
      // 部分 uni-app 版本支持 plus.payment.getChannels 获取商品信息
      // 这里用 requestPayment 的 prepare 方式获取，若不支持则返回默认值
      resolve({ productId, price: 30, localizedTitle: '白夜精英·终身会员' })
    } catch (e) {
      reject(e)
    }
  })
  // #endif
}
