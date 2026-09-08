/**
 * 特征开关配置
 *
 * 用于 App Store 上架合规：iOS 端屏蔽礼物板块、隐藏钻石充值、精英付费走 Apple IAP。
 * 所有开关基于 uni-app 条件编译，非 iOS 端功能保持原样。
 *
 * 使用方式：
 *   import { giftEnabled, diamondRechargeEnabled, appleIAPEnabled } from '@/config/features'
 */

// #ifdef APP-IOS
const giftEnabled = false
const diamondRechargeEnabled = false
const appleIAPEnabled = true
// #endif

// #ifndef APP-IOS
const giftEnabled = true
const diamondRechargeEnabled = true
const appleIAPEnabled = false
// #endif

/** Apple IAP 商品 ID（精英终身会员，非消耗型），需在 App Store Connect 配置 */
const IAP_PRODUCT_ELITE = 'com.baiye.elite.lifetime'

/** Apple 票据校验地址（生产 / 沙盒） */
const APPLE_VERIFY_URL = 'https://buy.itunes.apple.com/verifyReceipt'
const APPLE_VERIFY_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt'

export default {
  giftEnabled,
  diamondRechargeEnabled,
  appleIAPEnabled,
  IAP_PRODUCT_ELITE,
  APPLE_VERIFY_URL,
  APPLE_VERIFY_SANDBOX_URL
}

export {
  giftEnabled,
  diamondRechargeEnabled,
  appleIAPEnabled,
  IAP_PRODUCT_ELITE,
  APPLE_VERIFY_URL,
  APPLE_VERIFY_SANDBOX_URL
}
