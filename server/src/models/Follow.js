const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Follow = sequelize.define('Follow', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  followerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关注者'
  },
  followingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '被关注者'
  }
}, {
  tableName: 'follows',
  indexes: [
    { unique: true, fields: ['followerId', 'followingId'], name: 'uniq_follow_pair' },
    { fields: ['followingId'] }
  ]
})

module.exports = Follow
