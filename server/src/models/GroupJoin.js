const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const GroupJoin = sequelize.define('GroupJoin', {
  groupId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'canceled'),
    defaultValue: 'pending'
  },
  appliedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  handledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  remark: {
    type: DataTypes.STRING(200),
    allowNull: true
  }
}, {
  tableName: 'group_joins',
  indexes: [
    { fields: ['group_id'] },
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['group_id', 'user_id'], unique: true }
  ]
})

module.exports = GroupJoin
