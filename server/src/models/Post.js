const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Post = sequelize.define('Post', {
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  text: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  location: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  city: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  distanceUnit: {
    type: DataTypes.STRING(8),
    defaultValue: 'km'
  },
  auditStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'blocked'),
    defaultValue: 'approved'
  },
  likes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  likeCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  commentCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  online: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  top: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  category: {
    type: DataTypes.STRING(32),
    defaultValue: 'dynamic'
  }
}, {
  tableName: 'posts',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['city'] },
    { fields: ['category'] },
    { fields: ['audit_status'] },
    { fields: ['online'] },
    { fields: ['top'] },
    { fields: ['like_count'] },
    { fields: ['created_at'] }
  ]
})

module.exports = Post
