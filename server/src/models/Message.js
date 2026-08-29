const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Message = sequelize.define('Message', {
  sessionId: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  senderId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  receiverId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('text', 'image', 'voice', 'system'),
    defaultValue: 'text'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'messages',
  indexes: [
    { fields: ['session_id'] },
    { fields: ['sender_id'] },
    { fields: ['receiver_id'] },
    { fields: ['is_read'] },
    { fields: ['created_at'] }
  ]
})

module.exports = Message
