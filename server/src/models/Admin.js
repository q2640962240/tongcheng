const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')
const bcrypt = require('bcryptjs')

/** 判定一个字符串是否已经是 bcrypt hash（避免 seed/update 二次加密导致无法登录）
 *  兼容 $2a$ / $2b$ / $2y$ 三种前缀，长度 60（22 salt + 31 hash）
 */
function isBcryptHash(v) {
  return typeof v === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(v)
}

const Admin = sequelize.define('Admin', {
  username: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  password: {
    type: DataTypes.STRING(200),
    allowNull: false,
    set(val) {
      if (val == null) return
      const str = String(val)
      if (!str) return
      this.setDataValue('password', isBcryptHash(str) ? str : bcrypt.hashSync(str, 10))
    }
  },
  role: {
    type: DataTypes.STRING(20),
    defaultValue: 'admin'
  },
  nickname: {
    type: DataTypes.STRING(50),
    defaultValue: '管理员'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'admins',
  indexes: [
    { unique: true, fields: ['username'], name: 'uniq_admin_username' }
  ]
})

// 仅当 Sequelize 模式下（sequelize.define 返回 Model，有 prototype）挂载实例方法
// JSON 驱动下 define 返回 Collection 实例，其 wrap() 中已自带同名 verifyPassword 方法
if (Admin && Admin.prototype) {
  Admin.prototype.verifyPassword = function (plain) {
    const passwd = this.password
    if (!passwd || !plain) return false
    // 优先 bcrypt；若老数据是明文（MySQL 导入/迁移期），兼容一次直接比较
    if (isBcryptHash(passwd)) return bcrypt.compareSync(String(plain), passwd)
    return String(passwd) === String(plain)
  }
}

module.exports = Admin
module.exports._isBcryptHash = isBcryptHash
