const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Order = sequelize.define('Order', {
  orderNo: {
    type: DataTypes.STRING(32),
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
  serviceId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  serviceTitle: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  price: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  priceUnit: {
    type: DataTypes.STRING(20),
    defaultValue: ''
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'serving', 'completed', 'cancelled', 'refunding', 'refunded'),
    defaultValue: 'pending'
  },
  payMethod: {
    type: DataTypes.ENUM('star_coin', 'wechat', 'alipay'),
    allowNull: true
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelReason: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  remark: {
    type: DataTypes.STRING(200),
    allowNull: true
  }
}, {
  tableName: 'orders',
  indexes: [
    { unique: true, fields: ['order_no'], name: 'uniq_order_no' },
    { fields: ['user_id'] },
    { fields: ['provider_id'] },
    { fields: ['service_id'] },
    { fields: ['status'] },
    { fields: ['paid_at'] }
  ]
})

module.exports = Order
