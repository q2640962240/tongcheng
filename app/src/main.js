import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

/**
 * TUIKit H5 Polyfill
 * uni-app H5 端部分 TabBar API 不存在，TUIConversation/TUISearch 等组件会调用
 * uni.showTabBar() / uni.hideTabBar() / uni.switchTab() 导致 TypeError。
 * 在应用入口处为 uni 对象补齐这些空方法。
 */
function _tuiPolyfillUni() {
  if (typeof uni === 'undefined') return
  const noop = () => Promise.resolve()
  if (typeof uni.showTabBar !== 'function') uni.showTabBar = noop
  if (typeof uni.hideTabBar !== 'function') uni.hideTabBar = noop
  if (typeof uni.switchTab !== 'function') uni.switchTab = noop
  if (typeof uni.navigateTo !== 'function') uni.navigateTo = noop
  if (typeof uni.navigateBack !== 'function') uni.navigateBack = noop
  if (typeof uni.redirectTo !== 'function') uni.redirectTo = noop
  if (typeof uni.reLaunch !== 'function') uni.reLaunch = noop
}
_tuiPolyfillUni()

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)
  return { app, pinia }
}
