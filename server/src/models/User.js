const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const User = sequelize.define('User', {
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '密码登录使用；未设置密码只能用短信验证码登录'
  },
  nickname: {
    type: DataTypes.STRING(50),
    defaultValue: '用户'
  },
  avatar: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  gender: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  bio: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  isElite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isProvider: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  userType: {
    type: DataTypes.ENUM('real', 'ai'),
    defaultValue: 'real',
    comment: '用户类型：real 真人用户 / ai AI 用户(可接入自动聊天)'
  },
  aiProvider: {
    type: DataTypes.ENUM('none', 'openai', 'deepseek', 'custom'),
    defaultValue: 'none',
    comment: 'AI 接入厂商：none 未接入 / openai OpenAI兼容 / deepseek DeepSeek / custom 自定义API'
  },
  aiConfig: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
    comment: 'AI 用户配置：{ apiKey, apiUrl, model, systemPrompt }'
  },
  realPersonStatus: {
    type: DataTypes.ENUM('none', 'pending', 'passed', 'rejected'),
    defaultValue: 'none'
  },
  identityStatus: {
    type: DataTypes.ENUM('none', 'pending', 'passed', 'rejected'),
    defaultValue: 'none'
  },
  inviteCode: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  inviterId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  meta: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'users',
  indexes: [
    { unique: true, fields: ['phone'], name: 'uniq_user_phone' },
    { unique: true, fields: ['invite_code'], name: 'uniq_user_invite_code' },
    { fields: ['city'] },
    { fields: ['status'] },
    { fields: ['is_elite'] },
    { fields: ['is_provider'] },
    { fields: ['inviter_id'] },
    { fields: ['user_type'] }
  ]
})

/** 兼容旧 JSON 层的 findOrCreate 用法 */
if (typeof User.findOrCreate !== 'function') {
  User.findOrCreate = async function ({ where, defaults = {} }) {
    let row = await this.findOne({ where })
    if (row) return [row, false]
    const created = await this.create({ ...where, ...defaults })
    return [created, true]
  }
}

/** 密码校验（仅当 passwordHash 存在时有效）；注意 passwordHash 可能为 null（用户未设置密码） */
if (typeof User.prototype !== 'undefined') {
  const crypto = require('crypto')
  const hashPassword = (pwd) => {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.scryptSync(String(pwd || ''), salt, 32).toString('hex')
    return `${salt}:${hash}`
  }
  User.prototype.setPassword = function (pwd) {
    this.passwordHash = hashPassword(pwd)
  }
  User.prototype.verifyPassword = function (pwd) {
    if (!this.passwordHash) return false
    const [salt, expected] = this.passwordHash.split(':')
    if (!salt || !expected) return false
    const actual = crypto.scryptSync(String(pwd || ''), salt, 32).toString('hex')
    return actual === expected
  }
  User.hashPassword = hashPassword
}

module.exports = User
