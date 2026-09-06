# ADR-002: 礼物收入单位为分（giftIncome 用分存储）

## 状态

已采纳 (2026-08)

## 背景

礼物收入涉及金钱计算。JavaScript 的浮点数精度问题（0.1 + 0.2 ≠ 0.3）可能导致：
- 累计误差
- 提现金额不一致
- 对账困难

## 决策

**giftIncome（礼物收入）以"分"为单位存储和计算**，UI 显示时 ÷100 转为"元"。

- 数据库 `users.giftIncome` 存储分（整数）
- API 返回分（整数）
- 前端显示时 `giftIncome / 100` 显示元
- 提现金额也以分传入后端

## 后果

**正面**:
- 避免浮点精度问题
- 计算简单，无舍入误差
- 与支付宝/微信支付的分单位一致

**负面**:
- 前端每次显示都需要 ÷100
- 新人容易忘记单位，直接显示分

## 适用范围

所有涉及金额的字段：
- `users.giftIncome` — 礼物收入（分）
- `users.diamond` — 钻石余额（个，整数，无精度问题）
- `transactions.amount` — 交易金额（分或个，视类型而定）
- `gift_records.totalDiamond` — 送礼总钻石数（个）

## 关键文件

- `server/src/routes/gifts.js` — 送礼事务（分单位计算）
- `app/src/components/GiftPanel.vue` — 礼物面板（显示时 ÷100）
- `app/src/pages/withdraw/withdraw.vue` — 提现页（显示时 ÷100）
