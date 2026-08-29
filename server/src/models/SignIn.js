/**
 * 签到记录（红包签到专区）
 * 业务规则：同一用户同一日期只能签到一次（幂等）
 */
const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const SignIn = sequelize.define('SignIn', {
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  date: {
    // YYYY-MM-DD
    type: DataTypes.STRING(16),
    allowNull: true
  },
  rewardDiamond: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  streakDays: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  }
}, {
  tableName: 'signins',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['date'] },
    { fields: ['user_id', 'date'], unique: true }
  ]
})

module.exports = SignIn
