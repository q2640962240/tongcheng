/**
 * 服务分类模型：
 *  - 顶级分类（如暖心服务、游戏陪玩、兴趣约玩）parentKey=null
 *  - 二级分类（如虚拟恋人、王者荣耀、同城约会）parentKey=顶级 key
 * 管理后台可 CRUD；用户端 GET /services/categories 读取此表，支持动态上下架
 */
const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const ServiceCategory = sequelize.define('ServiceCategory', {
  // 业务唯一标识（URL/筛选友好）：虚拟恋人 -> virtual-lover
  key: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '分类英文/短横线唯一标识'
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '展示名称'
  },
  parentKey: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '父级 key，null 表示顶级分类'
  },
  icon: {
    type: DataTypes.STRING(120),
    allowNull: true,
    comment: '分类图标 URL 或 iconfont class'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '分类简介'
  },
  // 子分类展示价格 & 价格单位，前端热门卡片 / 发布服务默认值使用
  price: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '默认展示价格（单位：分 / 钻石 / 元整数，按 priceUnit 解读）'
  },
  priceUnit: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '价格单位：20分钟 / 局 / 首 / 按分钟 / 按次...'
  },
  // 发布服务时是否允许用户自定义价格
  allowCustomPrice: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // 是否在用户端首页 / 分类 Tab 显示
  visible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '上架/下架（仅对用户端生效）'
  },
  sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '同层级排序，越大越靠前'
  },
  // 扩展：审核模式(服务发布到此分类是否需要审核)、标签、佣金
  requireAudit: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '发布服务时是否需要管理审核'
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '服务推荐标签（数组）'
  },
  meta: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '扩展字段'
  }
}, {
  tableName: 'service_categories',
  indexes: [
    { fields: ['parent_key'] },
    { fields: ['visible'] },
    { fields: ['sort'] },
    { fields: ['key'], unique: true, name: 'uniq_service_category_key' }
  ]
})

module.exports = ServiceCategory
