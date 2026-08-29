/**
 * Sequelize + MySQL 数据库连接池
 * --------------------------------
 * 生产默认启用：当 NODE_ENV=production 时强制使用真实 MySQL。
 * 开发/测试可通过 DB_DRIVER=json 回退到本地 JSON 文件存储（src/store），
 * 方便没有 MySQL 环境时继续调试前端/业务逻辑。
 */
require('dotenv').config()
const config = require('./index')

const env = (config.env || 'development').toLowerCase()
const driver = String(process.env.DB_DRIVER || '').toLowerCase()

// 生产强制走 MySQL
const useMysql = env === 'production'
  ? true
  : (driver === 'mysql' ? true : (driver === 'json' ? false : false))

if (useMysql) {
  const { Sequelize } = require('sequelize')

  const sequelize = new Sequelize(
    config.db.name,
    config.db.user,
    config.db.password || '',
    {
      host: config.db.host,
      port: Number(config.db.port) || 3306,
      dialect: 'mysql',
      dialectOptions: {
        charset: 'utf8mb4',
        // 兼容 MySQL 5.7 / 8.0 的时区处理
        typeCast: true,
        supportBigNumbers: true,
        bigNumberStrings: false,
        dateStrings: false
      },
      timezone: '+08:00',
      logging: config.db.logging ? console.log : false,
      pool: {
        max: Number(process.env.DB_POOL_MAX) || 20,
        min: Number(process.env.DB_POOL_MIN) || 2,
        acquire: 60000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
        paranoid: false
      },
      hooks: {
        beforeDefine(attributes, options) {
          // 保证主键 id 统一为自增 BIGINT UNSIGNED
          if (!attributes.id) {
            const { DataTypes } = require('sequelize')
            attributes.id = {
              type: DataTypes.BIGINT.UNSIGNED,
              primaryKey: true,
              autoIncrement: true,
              allowNull: false
            }
          }
        }
      }
    }
  )

  module.exports = sequelize
  module.exports.usingMysql = true
} else {
  // JSON 存储回退：把 mock sequelize 暴露给 routes / models，保持代码零改动
  const { sequelize } = require('../store')
  module.exports = sequelize
  module.exports.usingMysql = false
}
