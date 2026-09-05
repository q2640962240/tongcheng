const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const DailyTask = sequelize.define('DailyTask', {
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  loginDone: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  chatDone: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  chatCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  giftSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  postCreated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  shareDone: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  totalClaimed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'daily_tasks',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['date'] },
    { fields: ['user_id', 'date'], unique: true }
  ]
})

module.exports = DailyTask
