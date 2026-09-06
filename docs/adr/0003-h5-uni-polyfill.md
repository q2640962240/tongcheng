# ADR-003: H5 端 uni API Polyfill（window.uni 替代 uni）

## 状态

已采纳 (2026-08)

## 背景

白夜使用 uni-app 开发，理论上 `uni` 对象在所有端（H5/小程序/App）都可用。但实际在 H5 端：

1. **vite-plugin-uni 替换问题**: 构建时 `uni` 被替换为精简版，缺少路由 API（navigateTo、redirectTo 等）
2. **TUIKit 依赖完整 uni API**: 官方 TUIKit 组件内部调用 `uni.navigateTo`、`uni.showTabBar` 等，H5 端报错
3. **window.uni 与 uni 不一致**: 运行时 `window.uni` 保留完整 API，但代码中直接写 `uni` 会被替换

## 决策

1. **在 `app/src/main.js` 的 `_tuiPolyfillUni()` 中补齐缺失 API**:
   - 路由 API: navigateTo、redirectTo、switchTab、navigateBack
   - 事件总线: `$on`、`$off`、`$emit`
   - UI 反馈: showToast、showModal、showLoading、hideLoading
   - 其他: setTabBarBadge、getStorageSync 等

2. **必须用 `window.uni` 而非 `uni`**:
   - 在 polyfill 代码中使用 `const U = window.uni || uni`
   - 确保操作的是运行时完整对象，而非被替换的精简版

3. **polyfill 是临时方案**:
   - 理想情况是 uni-app 官方修复 H5 端 API 缺失
   - 当前作为兼容性补丁，随 uni-app 版本更新可能需要调整

## 后果

**正面**:
- TUIKit 在 H5 端正常运行
- 路由跳转、事件通信等核心功能可用
- 无需修改 TUIKit 源码

**负面**:
- polyfill 需要维护，uni-app 升级可能需要调整
- 部分 API（如 setTabBarBadge）在非 Tab 页是空操作，需要注意调用时机
- 新人容易忘记用 `window.uni`，导致 polyfill 失效

## 关键文件

- `app/src/main.js` — `_tuiPolyfillUni()` 函数（约 200 行）
- `app/src/utils/tuilogin.js` — 使用 polyfill 后的路由 API

## 相关

- [AGENTS.md 已知坑点 #3](../../AGENTS.md): H5 端 uni 路由 API 缺失
