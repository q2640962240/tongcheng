const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Comment = sequelize.define('Comment', {
  postId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  replyToUserId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  text: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  blocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  auditStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'blocked'),
    defaultValue: 'approved'
  }
}, {
  tableName: 'comments',
  indexes: [
    { fields: ['post_id'] },
    { fields: ['user_id'] },
    { fields: ['reply_to_user_id'] },
    { fields: ['audit_status'] }
  ]
})

module.exports = Comment
