const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Follow = sequelize.define('Follow', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  followerId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '关注者'
  },
  followingId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '被关注者'
  }
}, {
  tableName: 'follows',
  indexes: [
    { unique: true, fields: ['follower_id', 'following_id'], name: 'uniq_follow_pair' },
    { fields: ['following_id'] }
  ]
})

module.exports = Follow
