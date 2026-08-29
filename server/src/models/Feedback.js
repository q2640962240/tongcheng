const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Feedback = sequelize.define('Feedback', {
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  type: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  refType: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  postId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  groupId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  targetUserId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'resolved', 'rejected'),
    defaultValue: 'pending'
  },
  reward: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  reply: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  handledBy: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  }
}, {
  tableName: 'feedbacks',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['type'] },
    { fields: ['ref_type'] },
    { fields: ['post_id'] },
    { fields: ['group_id'] },
    { fields: ['target_user_id'] }
  ]
})

module.exports = Feedback
