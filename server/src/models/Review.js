const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Review = sequelize.define('Review', {
  orderId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  serviceId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  providerId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  rating: {
    type: DataTypes.INTEGER,
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
  isAnonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'reviews',
  indexes: [
    { fields: ['order_id'] },
    { fields: ['service_id'] },
    { fields: ['user_id'] },
    { fields: ['provider_id'] }
  ]
})

module.exports = Review
