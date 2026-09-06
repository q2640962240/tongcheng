# ADR-001: 聊天双模架构（TUIKit 主通道 + Socket.IO 兜底）

## 状态

已采纳 (2026-08)

## 背景

白夜需要聊天功能。腾讯 IM (TUIKit) 提供完整的即时通讯能力，但存在以下风险：
- H5 端 Lite SDK 功能受限
- IM 登录可能因网络/配置问题失败
- 部分场景（AI 自动回复、自建消息流）需要绕过 IM 云

## 决策

采用双模聊天架构：

1. **主通道**: 腾讯官方 TUIKit SDK (TUIChat + TUIConversation)
   - 用户进入聊天页 → 尝试 IM 登录（8s 超时）
   - 成功 → 跳转 TUIChat 页面，使用官方组件

2. **兜底通道**: 自建 Socket.IO 聊天
   - IM 登录失败 → 降级到 chatSocket.js 自建聊天
   - 功能精简，但保证基本聊天可用

3. **数据流**: 以数据库为准
   - 所有消息写入 MySQL
   - IM 云消息通过 im-sync 回调同步到 DB
   - 自建通道消息通过 forwardToIM 桥接到 IM 云

## 后果

**正面**:
- IM 登录失败不会导致聊天完全不可用
- DB 作为单一数据源，避免 IM 云与本地数据不一致
- AI 自动回复可通过 v4 REST API 以任意用户身份发消息

**负面**:
- 两套聊天逻辑需要维护
- 消息可能双写入（已通过 im-sync 跳过自定义消息解决）
- H5 端需要大量 polyfill（uni 路由 API、事件总线等）

## 关键文件

- `app/src/utils/tuilogin.js` — IM 登录工具
- `app/src/utils/chatSocket.js` — 自建 Socket.IO 通道
- `app/src/pages/chat/chat.vue` — 聊天入口（路由分发）
- `server/src/routes/im.js` — IM 配置/登录端点
- `server/src/utils/im.js` — v4 REST API 封装
