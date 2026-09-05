const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Transaction = sequelize.define('Transaction', {
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('recharge', 'exchange', 'consume', 'income', 'withdraw', 'refund', 'reward', 'gift_withdraw', 'admin_adjustment')
  },
  amount: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'fen'
  },
  balanceAfter: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  orderId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  remark: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  extra: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'transactions',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['type'] },
    { fields: ['order_id'] },
    { fields: ['created_at'] }
  ]
})

module.exports = Transaction
