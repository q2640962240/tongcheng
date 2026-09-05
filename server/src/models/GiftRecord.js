const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const GiftRecord = sequelize.define('GiftRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  receiverId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  giftId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  giftName: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  diamondAmount: {
    type: DataTypes.INTEGER,
    allowNull: false
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
