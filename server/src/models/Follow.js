const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Follow = sequelize.define('Follow', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  followerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '关注者'
  },
  followingId: {
    type: DataTypes.BIGINT,
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
