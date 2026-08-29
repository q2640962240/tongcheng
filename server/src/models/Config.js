const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

/**
 * 配置中心 — key/value 存储，支持模块分组
 * 管理后台可动态读写，覆盖 .env 默认值
 */
const Config = sequelize.define('Config', {
  module: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  key: {
    type: DataTypes.STRING(60),
    allowNull: false
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.STRING(20),
    defaultValue: 'string'
  },
  description: {
    type: DataTypes.STRING(200),
    allowNull: true
  }
}, {
  tableName: 'configs',
  indexes: [
    { fields: ['module', 'key'], unique: true }
  ]
})

module.exports = Config
