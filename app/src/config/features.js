/**
 * 特征开关配置
 *
 * App Store 上架合规：全平台屏蔽礼物板块、钻石充值、钱包页面。
 * 精英付费在 iOS 端走 Apple IAP。
 *
 * 使用方式：
 *   import { giftEnabled, diamondRechargeEnabled, walletEnabled, appleIAPEnabled } from '@/config/features'
 */

// 全平台屏蔽：礼物、钻石充值、钱包页面
const giftEnabled = false
const diamondRechargeEnabled = false
const walletEnabled = false

// Apple IAP 仅 iOS 端启用
// #ifdef APP-IOS
const appleIAPEnabled = true
// #endif
// #ifndef APP-IOS
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
  walletEnabled,
  appleIAPEnabled,
  IAP_PRODUCT_ELITE,
  APPLE_VERIFY_URL,
  APPLE_VERIFY_SANDBOX_URL
}

export {
  giftEnabled,
  diamondRechargeEnabled,
  walletEnabled,
  appleIAPEnabled,
  IAP_PRODUCT_ELITE,
  APPLE_VERIFY_URL,
  APPLE_VERIFY_SANDBOX_URL
}
