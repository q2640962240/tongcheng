const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

/** 精英付费订单（替代审核式精英认证） */
const EliteOrder = sequelize.define('EliteOrder', {
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  amount: {
    type: DataTypes.INTEGER,
    defaultValue: 3000
  },
  channel: {
    type: DataTypes.ENUM('wxpay', 'alipay', 'dev', 'manual'),
    defaultValue: 'dev'
  },
  outTradeNo: {
    type: DataTypes.STRING(64),
    allowNull: true,
    unique: true
  },
  transactionId: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('created', 'paid', 'failed', 'refunded', 'canceled'),
    defaultValue: 'created'
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  plan: {
    type: DataTypes.STRING(32),
    defaultValue: 'lifetime'
  },
  snapshot: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  refundedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'elite_orders',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['paid_at'] }
  ]
})

module.exports = EliteOrder
