const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Banner = sequelize.define('Banner', {
  title: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  image: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  link: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  position: {
    type: DataTypes.STRING(32),
    defaultValue: 'home_top'
  },
  sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'banners',
  indexes: [
    { fields: ['position'] },
    { fields: ['enabled'] },
    { fields: ['sort'] }
  ]
})

module.exports = Banner
