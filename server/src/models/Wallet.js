const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Wallet = sequelize.define('Wallet', {
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  diamond: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  starCoin: {
    // @deprecated — 保留向后兼容，新业务统一使用 diamond
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  income: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  totalRecharge: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  totalWithdraw: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  }
}, {
  tableName: 'wallets',
  indexes: [
    { unique: true, fields: ['user_id'], name: 'uniq_wallet_user_id' }
  ]
})

module.exports = Wallet
