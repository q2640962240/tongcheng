const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Service = sequelize.define('Service', {
  providerId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  subCategory: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  coverImage: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  price: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  priceUnit: {
    type: DataTypes.STRING(20),
    defaultValue: '次'
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'online', 'offline', 'rejected'),
    defaultValue: 'pending'
  },
  rejectReason: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  orderCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  ratingAvg: {
    type: DataTypes.DECIMAL(3, 1),
    defaultValue: 5.0
  }
}, {
  tableName: 'services',
  indexes: [
    { fields: ['provider_id'] },
    { fields: ['status'] },
    { fields: ['category'] },
    { fields: ['sort'] },
    { fields: ['rating_avg'] }
  ]
})

module.exports = Service
