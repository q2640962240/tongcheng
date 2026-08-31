const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Invite = sequelize.define('Invite', {
  inviterId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  inviteeId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  inviteeGender: {
    type: DataTypes.TINYINT,
    allowNull: true
  },
  totalReward: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  }
}, {
  tableName: 'invites',
  indexes: [
    { unique: true, fields: ['invitee_id'], name: 'uniq_invite_invitee_id' },
    { fields: ['inviter_id'] },
    { fields: ['status'] }
  ]
})

module.exports = Invite
