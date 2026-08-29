const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Wallet = sequelize.define('Wallet', {
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    unique: true
  },
  diamond: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  starCoin: {
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
  indexes: []
})

module.exports = Wallet
