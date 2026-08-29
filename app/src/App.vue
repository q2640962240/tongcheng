<script>
import { useUserStore } from './store/user'

/**
 * Android · 白夜主题 System UI 设置（状态栏 + 底部导航栏）
 * 目标：从启动页关闭 → 首屏内容渲染完成的窗口内，不要再露出默认的黑色系统背景，
 * 否则会被用户误解为"黑屏/白屏/渲染失败"。
 *
 * 策略（来自过往修复经验，缺一可能仍在部分机型显示黑）：
 *   1. Webview 级别：plus.webview.setStyle 设置背景色 + 状态栏样式
 *   2. Window 级别：用 Android 原生 Window API 强制设置导航栏/状态栏颜色、图标、对比度策略
 *   3. 生效时机：plusReady + 首个页面 onReady 双保险，避免 onLaunch 过早被后续覆盖
 */
function applyAndroidThemeSystemUI() {
  try {
    if (typeof plus === 'undefined') return
    const platformInfo = plus.os && plus.os.name ? String(plus.os.name).toLowerCase() : ''
    if (platformInfo !== 'android') return

    // ---------- 1. Webview 级：当前 app 主 webview 背景与状态栏 ----------
    try {
      const current = plus.webview.currentWebview()
      if (current && typeof current.setStyle === 'function') {
        current.setStyle({
          background: '#0B0F1A', // 午夜蓝
          statusbar: { background: '#0B0F1A', style: 'light' }
        })
      }
    } catch (_) { /* ignore */ }

    // ---------- 2. Window 级：原生 Android Window 强制设置 ----------
    try {
      const Activity = plus.android.runtimeMainActivity()
      const Window = Activity && Activity.getClass ? null : null
      const window = Activity.getWindow ? Activity.getWindow() : null
      if (!window) return

      const SDK_INT = (() => {
        try {
          const Build = plus.android.importClass('android.os.Build')
          return Number(Build.VERSION.SDK_INT) || 0
        } catch (_) { return 0 }
      })()

      // 2.1 导航栏颜色：午夜蓝（白色/浅色 3 键/手势区域）
      try {
        const Color = plus.android.importClass('android.graphics.Color')
        if (window.setNavigationBarColor) window.setNavigationBarColor(Color.parseColor('#0B0F1A'))
      } catch (_) {}

      // 2.2 状态栏颜色：午夜蓝
      try {
        const Color = plus.android.importClass('android.graphics.Color')
        if (window.setStatusBarColor) window.setStatusBarColor(Color.parseColor('#0B0F1A'))
      } catch (_) {}

      // 2.3 关闭对比度强制（Android 10+ 会在"深色背景+浅色图标"策略上再盖一层半透明遮罩 → 看上去像黑）
      try {
        if (SDK_INT >= 29 && window.setNavigationBarContrastEnforced) {
          window.setNavigationBarContrastEnforced(false)
        }
      } catch (_) {}
      try {
        if (SDK_INT >= 29 && window.setStatusBarContrastEnforced) {
          window.setStatusBarContrastEnforced(false)
        }
      } catch (_) {}

      // 2.4 导航栏/状态栏图标明暗模式（浅色图标）
      //    API 30+ 用 WindowInsetsController，旧版本用 systemUiVisibility flags
      try {
        if (SDK_INT >= 30 && window.getInsetsController) {
          const controller = window.getInsetsController()
          if (controller && controller.setSystemBarsAppearance) {
            const APPEARANCE_LIGHT_STATUS_BARS = 0x00000008
            const APPEARANCE_LIGHT_NAVIGATION_BARS = 0x00000010
            // 深色背景 → 不要 LIGHT flags（LIGHT flags 会把图标染成黑色，反而看不见）
            // 清除 LIGHT flags 即保留"浅色图标（白/灰）"语义
            controller.setSystemBarsAppearance(0, APPEARANCE_LIGHT_STATUS_BARS | APPEARANCE_LIGHT_NAVIGATION_BARS)
          }
        } else if (window.getDecorView) {
          // 旧版本：清除 LIGHT 标志位，保留浅色图标
          const View = plus.android.importClass('android.view.View')
          const decor = window.getDecorView()
          const SYSTEM_UI_FLAG_LIGHT_STATUS_BAR = 0x00002000
          const SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR = 0x00000010
          const currentFlags = Number(decor.getSystemUiVisibility()) || 0
          const nextFlags = currentFlags & ~(SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
          decor.setSystemUiVisibility(nextFlags)
        }
      } catch (_) { /* ignore */ }

      // 2.5 确保 DecorFitsSystemWindows = true（否则内容区域没填底，露出 Window 黑色背景）
      try {
        const ViewCompatExists = false // 我们直接用原生方式兜底
        if (window.getDecorView) {
          const View = plus.android.importClass('android.view.View')
          const decor = window.getDecorView()
          if (decor && decor.setFitsSystemWindows) decor.setFitsSystemWindows(true)
        }
      } catch (_) {}
    } catch (e) {
      // 任何原生桥接失败，不影响 App 启动
    }
  } catch (_) { /* ignore */ }
}

/** 延迟 + 重试几次，确保在页面 webview 真正 ready 后还能生效（防止页面覆盖） */
function scheduleApplySystemUI() {
  const times = [0, 200, 600, 1200]
  times.forEach((t) => {
    setTimeout(() => {
      try { applyAndroidThemeSystemUI() } catch (_) {}
    }, t)
  })
}

export default {
  onLaunch() {
    // 应用启动：检查登录状态
    const userStore = useUserStore()
    userStore.restoreSession()

    // #ifdef APP-PLUS
    if (typeof plus !== 'undefined') {
      scheduleApplySystemUI()
    } else {
      // 若 onLaunch 时 plus 未 ready，注册监听
      const handler = () => { try { scheduleApplySystemUI() } catch (_) {} }
      try {
        document.addEventListener('plusready', handler, false)
      } catch (_) {}
      setTimeout(handler, 300)
    }
    // #endif
  },
  onShow() {
    // #ifdef APP-PLUS
    try { applyAndroidThemeSystemUI() } catch (_) {}
    // #endif
  },
  onHide() {}
}
</script>

<style lang="scss">
/* 【Sass 模块使用规则（请配合 uni.scss 头部注释阅读）】
 * uni.scss 会被自动注入本 style 块第 0 行，已包含 @use "sass:color" + @use "@/theme-baiye.scss" as *
 * 因此这里：
 *   ✅ 直接写 color.adjust / color.mix / color.change
 *   ✅ 直接写 $by-* 变量
 *   ❌ 不要再写 @use "sass:color"（会冲突 There's already a module with namespace color）
 *   ❌ 不要再写 @import / @use theme-baiye.scss（uni.scss 已 as * 导出）
 */

/* 白夜 · 全局页面样式 */
page {
  background: $by-gradient-night;
  color: $by-text-1;
  font-family: 'Inter', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', system-ui, sans-serif;
  font-size: 28rpx;
  line-height: 1.55;
  min-height: 100vh;
}

/* 通用工具类 */
.flex { display: flex; }
.flex-1 { flex: 1; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.justify-center { justify-content: center; }
.flex-wrap { flex-wrap: wrap; }
.gap-8 { gap: 16rpx; }
.gap-12 { gap: 24rpx; }
.gap-16 { gap: 32rpx; }

.text-center { text-align: center; }
.text-sm { font-size: 24rpx; }
.text-base { font-size: 28rpx; }
.text-lg { font-size: 32rpx; }
.text-xl { font-size: 36rpx; }
.text-2xl { font-size: 44rpx; }
.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }
.font-medium { font-weight: 500; }

.text-1 { color: $by-text-1; }
.text-2 { color: $by-text-2; }
.text-3 { color: $by-text-3; }
.text-gold { color: $by-gold-soft; }

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 白夜卡片 — 磨砂+微边 */
.card {
  position: relative;
  background: linear-gradient(180deg, color.adjust($by-surface, $alpha: 1) 0%, color.adjust($by-bg-soft, $alpha: 0.96) 100%);
  border: 1rpx solid $by-border;
  border-radius: $by-radius-lg;
  padding: 24rpx;
  box-shadow: $by-shadow-2;
  backdrop-filter: blur(20px);
  &::before {
    content: "";
    position: absolute; inset: 0;
    border-radius: inherit;
    padding: 1rpx;
    background: linear-gradient(135deg, color.adjust(#ffffff, $alpha: 0.08), color.adjust(#ffffff, $alpha: 0) 40%, color.adjust(#ffffff, $alpha: 0.04));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude;
    pointer-events: none;
  }
}

/* 主按钮 — 金色渐变 */
.btn-primary {
  background: $by-gradient-gold;
  color: #0B0F1A;
  border-radius: $by-radius-pill;
  padding: 22rpx 40rpx;
  font-weight: 700;
  font-size: 30rpx;
  letter-spacing: 1rpx;
  text-align: center;
  border: none;
  box-shadow: $by-shadow-gold;
  transition: transform .15s ease, filter .15s ease;
  &:active { transform: translateY(2rpx); filter: brightness(1.05); }
}
.btn-primary::after { border: none; }

/* 极光主按钮（用于精英/解锁）*/
.btn-aurora {
  background: $by-gradient-aurora;
  color: #fff;
  border-radius: $by-radius-pill;
  padding: 22rpx 40rpx;
  font-weight: 700;
  font-size: 30rpx;
  text-align: center;
  box-shadow: 0 10rpx 30rpx rgba(123,97,255,.3);
}
.btn-aurora::after { border: none; }

.btn-outline {
  background: transparent;
  color: $by-text-1;
  border: 2rpx solid $by-border-strong;
  border-radius: $by-radius-pill;
  padding: 20rpx 40rpx;
  font-weight: 500;
  font-size: 30rpx;
  text-align: center;
  backdrop-filter: blur(10px);
  transition: all .15s ease;
  &:active { background: rgba(255,255,255,.06); }
}
.btn-outline::after { border: none; }

/* 标签（夜色版）*/
.tag {
  display: inline-flex;
  align-items: center;
  padding: 6rpx 18rpx;
  border-radius: $by-radius-pill;
  font-size: 22rpx;
  font-weight: 500;
  border: 1rpx solid transparent;
}
.tag-pink   { background: color.adjust($by-aurora-b, $alpha: .18); color: $by-aurora-b; border-color: color.adjust($by-aurora-b, $alpha: .3); }
.tag-purple { background: color.adjust($by-aurora-a, $alpha: .18); color: color.adjust($by-aurora-a, $lightness: 10%); border-color: color.adjust($by-aurora-a, $alpha: .3); }
.tag-blue   { background: color.adjust($by-info, $alpha: .18);    color: $by-info; border-color: color.adjust($by-info, $alpha: .3); }
.tag-yellow { background: color.adjust($by-gold, $alpha: .18);    color: $by-gold-soft; border-color: color.adjust($by-gold, $alpha: .35); }
.tag-success{ background: color.adjust($by-success, $alpha: .18); color: $by-success; }
.tag-error  { background: color.adjust($by-error, $alpha: .18);   color: $by-error; }

/* 安全区 */
.safe-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

/* 隐藏滚动条 */
.hide-scrollbar ::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* 白夜专属常用 */
.aurora-text {
  background: $by-gradient-aurora;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.gold-text {
  background: $by-gradient-gold;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.divider { height: 1rpx; background: $by-border; }
.divider-light { height: 1rpx; background: linear-gradient(90deg, transparent, color.adjust(#ffffff, $alpha: .18), transparent); }
</style>
