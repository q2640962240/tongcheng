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
  // 稳定业务键（拼音短码）。seed 按它匹配，改名不再插重复行（2026-09-07 线上曾因此 16→30）。
  // 唯一索引分三步加：先加列 → 生产按 name 回填 → 手工 ALTER TABLE ADD UNIQUE INDEX，
  // 不能一步到位：bootstrap 是 sync({alter:true})，既有行 code 全 NULL 时建唯一索引会失败或建出残缺索引。
  code: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '稳定业务键(拼音短码)，seed 按它匹配'
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
  },
  effectImage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '全屏特效背景图(L2/L3使用)'
  }
}, {
  tableName: 'gifts',
  indexes: [
    { fields: ['active'] },
    { fields: ['sort'] }
  ]
})

module.exports = Gift
