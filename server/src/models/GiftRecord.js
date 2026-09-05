const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const GiftRecord = sequelize.define('GiftRecord', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  senderId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  receiverId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  giftId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  giftName: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  diamondAmount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '送礼数量'
  },
  messageId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '关联消息ID'
  }
}, {
  tableName: 'gift_records',
  indexes: [
    { fields: ['sender_id'] },
    { fields: ['receiver_id'] },
    { fields: ['gift_id'] },
    { fields: ['created_at'] }
  ]
})

module.exports = GiftRecord
