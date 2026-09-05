const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Gift = sequelize.define('Gift', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '钻石价格'
  },
  sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序权重'
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否上架'
  },
  animationLevel: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '动画等级: 0无 1小型飘动 2中型横幅 3全屏'
  }
}, {
  tableName: 'gifts',
  indexes: [
    { fields: ['active'] },
    { fields: ['sort'] }
  ]
})

module.exports = Gift
