const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Group = sequelize.define('Group', {
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(120),
    allowNull: false
  },
  icon: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cover: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  category: {
    type: DataTypes.STRING(32),
    defaultValue: 'movie'
  },
  description: {
    type: DataTypes.STRING(2000),
    allowNull: true
  },
  city: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  expectMin: {
    type: DataTypes.INTEGER,
    defaultValue: 2
  },
  expectMax: {
    type: DataTypes.INTEGER,
    defaultValue: 8
  },
  activityAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  location: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  status: {
    type: DataTypes.ENUM('draft', 'open', 'full', 'closed', 'canceled'),
    defaultValue: 'open'
  },
  joinCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  hot: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'groups',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['city'] },
    { fields: ['category'] },
    { fields: ['status'] },
    { fields: ['hot'] },
    { fields: ['activity_at'] }
  ]
})

module.exports = Group
