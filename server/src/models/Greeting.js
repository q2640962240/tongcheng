const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Greeting = sequelize.define('Greeting', {
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
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'read', 'ignored'),
    defaultValue: 'pending'
  }
}, {
  tableName: 'greetings',
  indexes: [
    { fields: ['sender_id'] },
    { fields: ['receiver_id'] },
    { fields: ['status'] }
  ]
})

module.exports = Greeting
