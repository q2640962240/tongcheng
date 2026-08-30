/**
 * JSON 文件存储层 — 纯 JavaScript 实现，无 native 依赖
 * 模仿 Sequelize 常用 API：findAll / findByPk / create / update / destroy / count / findAndCountAll
 *
 * 数据持久化到 server/data/<collection>.json
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

class Collection {
  constructor(name, schema = {}) {
    this.name = name
    this.schema = schema
    this.file = path.join(DATA_DIR, `${name}.json`)
    this.data = this.load()
    this._hooks = { beforeCreate: [], afterCreate: [] }
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf-8')
      return JSON.parse(raw)
    } catch (e) {
      return []
    }
  }

  persist() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2))
  }

  /** 生成自增 ID */
  nextId() {
    if (this.data.length === 0) return 1
    return Math.max(...this.data.map(r => Number(r.id) || 0)) + 1
  }

  /** 应用 schema 默认值 */
  applyDefaults(record) {
    const out = { ...record }
    for (const key in this.schema) {
      const def = this.schema[key]
      if (out[key] === undefined && def && def.defaultValue !== undefined) {
        out[key] = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue
      }
    }
    if (!out.id) out.id = this.nextId()
    if (!out.createdAt) out.createdAt = new Date().toISOString()
    if (!out.updatedAt) out.updatedAt = new Date().toISOString()
    return out
  }

  /** 创建 */
  async create(values) {
    const patch = { ...values }
    // 创建时同步处理 password / passwordHash，保证 users/admins 密码正确存储
    if (this.name === 'users' || this.name === 'admins') {
      const bcrypt = require('bcryptjs')
      const { _isBcryptHash } = require('../models/Admin')
      if (typeof patch.password === 'string' && patch.password && !_isBcryptHash(patch.password)
          && !(typeof patch.password === 'string' && patch.password.includes(':') && !patch.password.startsWith('$'))) {
        const h = bcrypt.hashSync(patch.password, 10)
        patch.password = h
        patch.passwordHash = h
      } else if (typeof patch.password === 'string' && patch.password) {
        if (!patch.passwordHash) patch.passwordHash = patch.password
      }
      if (typeof patch.passwordHash === 'string' && patch.passwordHash && !_isBcryptHash(patch.passwordHash)
          && !(typeof patch.passwordHash === 'string' && patch.passwordHash.includes(':') && !patch.passwordHash.startsWith('$'))) {
        const h = bcrypt.hashSync(patch.passwordHash, 10)
        patch.passwordHash = h
        patch.password = h
      } else if (typeof patch.passwordHash === 'string' && patch.passwordHash && !patch.password) {
        patch.password = patch.passwordHash
      }
    }
    const record = this.applyDefaults(patch)
    this._hooks.beforeCreate.forEach(fn => fn(record))
    this.data.push(record)
    this.persist()
    this._hooks.afterCreate.forEach(fn => fn(record))
    return this.wrap(record)
  }

  /** 批量创建 */
  async bulkCreate(valuesList) {
    const result = []
    for (const v of valuesList) result.push(await this.create(v))
    return result
  }

  /** 主键查询 */
  async findByPk(id) {
    const record = this.data.find(r => String(r.id) === String(id))
    return record ? this.wrap(record) : null
  }

  /** 条件查询一条 */
  async findOne(options = {}) {
    const list = this._query(options)
    return list[0] ? this.wrap(list[0]) : null
  }

  /** 条件查询全部 */
  async findAll(options = {}) {
    let list = this._query(options)
    list = this._sort(list, options.order)
    list = this._paginate(list, options)
    return list.map(r => this.wrap(r))
  }

  /** 查询并计数 */
  async findAndCountAll(options = {}) {
    let list = this._query(options)
    const count = list.length
    list = this._sort(list, options.order)
    list = this._paginate(list, options)
    return { rows: list.map(r => this.wrap(r)), count }
  }

  /** 计数 */
  async count(options = {}) {
    return this._query(options).length
  }

  /** 内部：根据 where 过滤 */
  _query(options = {}) {
    const where = options.where
    if (!where) return [...this.data]
    return this.data.filter(record => matchWhere(record, where))
  }

  _sort(list, order) {
    if (!order || !order.length) return list
    return [...list].sort((a, b) => {
      for (const [field, dir] of order) {
        const av = a[field], bv = b[field]
        if (av === bv) continue
        const cmp = av > bv ? 1 : -1
        return dir.toUpperCase() === 'DESC' ? -cmp : cmp
      }
      return 0
    })
  }

  _paginate(list, options) {
    const offset = Number(options.offset) || 0
    const limit = Number(options.limit) || 0
    if (limit > 0) return list.slice(offset, offset + limit)
    if (offset > 0) return list.slice(offset)
    return list
  }

  /** 包装单条记录，提供 update / destroy 方法 */
  wrap(record) {
    const self = this
    const obj = { ...record }
    obj.update = async function (values) {
      Object.assign(record, values, { updatedAt: new Date().toISOString() })
      self.persist()
      Object.assign(obj, record)
      return obj
    }
    obj.destroy = async function () {
      const idx = self.data.findIndex(r => r.id === record.id)
      if (idx >= 0) {
        self.data.splice(idx, 1)
        self.persist()
      }
      return true
    }
    obj.increment = async function (fields, options = {}) {
      const by = Number(options.by) || 1
      for (const f in fields) {
        record[f] = (Number(record[f]) || 0) + by * Number(fields[f] || 1)
      }
      if (options.by !== undefined) {
        // 兼容 sequelize 风格 increment('field', { by: n })
      }
      self.persist()
      Object.assign(obj, record)
      return obj
    }
    obj.reload = async function () {
      Object.assign(obj, record)
      return obj
    }
    obj.get = function (key) { return record[key] }
    obj.set = function (key, val) { record[key] = val; Object.assign(obj, record) }
    obj.toJSON = function () { return { ...record } }
    /** Sequelize 兼容：instance.save() 将当前 instance.dataValues 写回底层 record 并持久化 */
    obj.save = async function () {
      // 兼容 User/Admin.prototype.setPassword 修改 instance.this.passwordHash 的写法
      // 同时兼容 DataTypes 在 wrap 后通过 setter 设置的各种字段
      for (const k of Object.keys(obj)) {
        if (['update','destroy','increment','reload','get','set','toJSON','save','setPassword','verifyPassword',
             'dataValues','_model','_prevDataValues'].includes(k)) continue
        // 只拷贝基础类型/简单对象，避免循环引用
        const v = obj[k]
        if (typeof v === 'function') continue
        record[k] = v
      }
      record.updatedAt = new Date().toISOString()
      self.persist()
      Object.assign(obj, record)
      return obj
    }
    // 兼容 User/Admin 原型上的 setPassword / verifyPassword：原型方法设置 this.passwordHash，
    // 需要 obj.passwordHash 真正写入 record。这里通过 proxy-write 模式保证 setPassword 后 record 也更新。
    if (self.name === 'users' || self.name === 'admins') {
      // 挂载 setPassword：直接写入 record.passwordHash（兼容 bcrypt/legacy 两种存储格式）
      obj.setPassword = function (plain) {
        if (typeof plain !== 'string' || !plain) return
        const bcrypt = require('bcryptjs')
        const hashed = bcrypt.hashSync(plain, 10)
        record.passwordHash = hashed
        obj.passwordHash = hashed
        // 向下兼容 JSON 层旧 password 字段（admins 仍用 password）
        record.password = hashed
        obj.password = hashed
      }
      // 覆盖 verifyPassword：同时支持 bcrypt(passwordHash) 与 legacy(passwordHash / password)
      obj.verifyPassword = function (plain) {
        const bcrypt = require('bcryptjs')
        const hash = record.passwordHash || record.password
        if (!hash || !plain) return false
        // bcrypt
        if (typeof hash === 'string' && hash.length === 60 && hash.startsWith('$2')) {
          return bcrypt.compareSync(String(plain), String(hash))
        }
        // User model: salt:scrypt (crypto.scryptSync)
        if (typeof hash === 'string' && hash.includes(':') && !hash.startsWith('$')) {
          try {
            const [salt, expected] = hash.split(':')
            if (salt && expected) {
              const crypto = require('crypto')
              const actual = crypto.scryptSync(String(plain || ''), salt, 32).toString('hex')
              return actual === expected
            }
          } catch (_) {}
        }
        return String(hash) === String(plain)
      }
    }
    return obj
  }

  /** 单字段自增（兼容 sequelize 旧调用） */
  async incrementField(id, field, by = 1) {
    const record = this.data.find(r => String(r.id) === String(id))
    if (!record) return null
    record[field] = (Number(record[field]) || 0) + Number(by)
    record.updatedAt = new Date().toISOString()
    this.persist()
    return record
  }

  /** 批量更新（Sequelize 风格：Model.update(values, { where })） */
  async update(values, options = {}) {
    const hits = this._query(options)
    const nowStr = new Date().toISOString()
    for (const record of hits) {
      const patch = { ...values, updatedAt: nowStr }
      // 兼容 auth/POST password 及 Model.update(patch)：如果 patch 中包含 password / passwordHash 且 plain，
      // 自动 hash 为 bcrypt，并同时写入 passwordHash + password 两个字段（双向兼容）
      if (this.name === 'users' || this.name === 'admins') {
        const bcrypt = require('bcryptjs')
        const { _isBcryptHash } = require('../models/Admin')
        if (typeof patch.password === 'string' && patch.password && !_isBcryptHash(patch.password)) {
          const h = bcrypt.hashSync(patch.password, 10)
          patch.password = h
          patch.passwordHash = h
        } else if (typeof patch.password === 'string' && patch.password) {
          // 已是 bcrypt：同步到 passwordHash
          patch.passwordHash = patch.password
        }
        if (typeof patch.passwordHash === 'string' && patch.passwordHash && !_isBcryptHash(patch.passwordHash)
            && !(typeof patch.passwordHash === 'string' && patch.passwordHash.includes(':') && !patch.passwordHash.startsWith('$'))) {
          // 普通 plain -> bcrypt
          const h = bcrypt.hashSync(patch.passwordHash, 10)
          patch.passwordHash = h
          patch.password = h
        }
      }
      Object.assign(record, patch)
    }
    if (hits.length) this.persist()
    return [hits.length]
  }

  /** 批量删除（Sequelize 风格：Model.destroy({ where })） */
  async destroy(options = {}) {
    const hits = this._query(options)
    if (hits.length === 0) return 0
    const idSet = new Set(hits.map(r => String(r.id)))
    const before = this.data.length
    this.data = this.data.filter(r => !idSet.has(String(r.id)))
    if (this.data.length !== before) this.persist()
    return before - this.data.length
  }

  addHook(name, fn) {
    if (this._hooks[name]) this._hooks[name].push(fn)
  }
}

/**
 * Model.increment 静态辅助：按主键 id 把字段 field 增加 by（兼容 Sequelize Model.increment('field', { by, where })/Sequelize instance.increment ）
 * 用法 1: Model.increment(id, field, by = 1)   — 本站 services.js 等用的 3 参数版本
 * 用法 2: Model.increment(field, { by: n, where: { id } }) — Sequelize 标准静态调用
 */
function addStaticIncrement(Collection) {
  const origCreate = Collection.prototype.create ? null : null
  // 在构造方法返回的 Collection 实例上挂 increment 静态方法（define 返回 collection，所以在 Collection prototype 上定义，任何实例都能用）
  Collection.prototype.increment = function (arg1, arg2, arg3) {
    // 用法 1: coll.increment(id, field, by) — 第一个参数是数字 id
    if (typeof arg1 === 'number' || (typeof arg1 === 'string' && /^\d+$/.test(arg1))) {
      const id = Number(arg1); const field = String(arg2 || ''); const by = Number(arg3 != null ? arg3 : 1)
      return this.incrementField(id, field, by)
    }
    // 用法 2: coll.increment(field, { by, where }) — Sequelize 风格
    const field = String(arg1 || '')
    const opts = (arg2 && typeof arg2 === 'object') ? arg2 : {}
    const by = Number(opts.by != null ? opts.by : 1)
    const where = opts.where || {}
    const hits = this._query({ where })
    for (const r of hits) {
      r[field] = (Number(r[field]) || 0) + by
      r.updatedAt = new Date().toISOString()
    }
    if (hits.length) this.persist()
    return hits.length
  }
  return Collection
}
addStaticIncrement(Collection)

/**
 * 匹配 where 条件
 * 支持：{ field: value, field: { [Op.eq]: v, [Op.like]: '%v%', [Op.gt]: v, [Op.in]: [...] } }
 */
/** 宽松相等：数字/数字字符串在两边都是类数字时做值比较，否则严格 === */
function looseEq(a, b) {
  if (a === b) return true
  const aInt = (typeof a === 'number' || (typeof a === 'string' && /^-?\d+$/.test(a))) ? Number(a) : NaN
  const bInt = (typeof b === 'number' || (typeof b === 'string' && /^-?\d+$/.test(b))) ? Number(b) : NaN
  if (!isNaN(aInt) && !isNaN(bInt)) return aInt === bInt
  return false
}
/** 宽松 includes：配合 looseEq */
function looseIncludes(arr, val) {
  if (!Array.isArray(arr)) return false
  return arr.some(x => looseEq(x, val))
}

function matchWhere(record, where) {
  if (!where) return true
  // 处理 Op.or
  if (where[Symbol.for('or')] || where.or) {
    const ors = where[Symbol.for('or')] || where.or
    if (!Array.isArray(ors)) return false
    if (!ors.some(sub => matchWhere(record, sub))) return false
  }
  // 处理 Op.and
  if (where[Symbol.for('and')] || where.and) {
    const ands = where[Symbol.for('and')] || where.and
    if (!Array.isArray(ands)) return false
    if (!ands.every(sub => matchWhere(record, sub))) return false
  }
  for (const key in where) {
    if (key === 'or' || key === 'and' || key === Symbol.for('or') || key === Symbol.for('and')) continue
    const cond = where[key]
    const val = record[key]
    if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      // Sequelize 操作符对象：{ [Op.like]: '%xx%', [Op.gt]: 5, [Op.in]: [...] }
      for (const opKey in cond) {
        const opVal = cond[opKey]
        const op = String(opKey).replace('Symbol(', '').replace(')', '')
        if (!matchOp(op, val, opVal)) return false
      }
    } else if (Array.isArray(cond)) {
      // 数组直接做 IN
      if (!looseIncludes(cond, val)) return false
    } else {
      if (!looseEq(val, cond)) return false
    }
  }
  return true
}

function matchOp(op, val, target) {
  const opName = String(op).toLowerCase()
  if (opName === 'eq') return looseEq(val, target)
  if (opName === 'ne') return !looseEq(val, target)
  if (opName === 'gt') {
    const a = (typeof val === 'string' && /^-?\d/.test(val)) ? Number(val) : val
    const b = (typeof target === 'string' && /^-?\d/.test(target)) ? Number(target) : target
    return a > b
  }
  if (opName === 'gte') {
    const a = (typeof val === 'string' && /^-?\d/.test(val)) ? Number(val) : val
    const b = (typeof target === 'string' && /^-?\d/.test(target)) ? Number(target) : target
    return a >= b
  }
  if (opName === 'lt') {
    const a = (typeof val === 'string' && /^-?\d/.test(val)) ? Number(val) : val
    const b = (typeof target === 'string' && /^-?\d/.test(target)) ? Number(target) : target
    return a < b
  }
  if (opName === 'lte') {
    const a = (typeof val === 'string' && /^-?\d/.test(val)) ? Number(val) : val
    const b = (typeof target === 'string' && /^-?\d/.test(target)) ? Number(target) : target
    return a <= b
  }
  if (opName === 'in') return looseIncludes(target, val)
  if (opName === 'notin') return Array.isArray(target) && !looseIncludes(target, val)
  if (opName === 'like') {
    if (typeof val !== 'string') return false
    const re = new RegExp('^' + String(target).replace(/%/g, '.*').replace(/_/g, '.') + '$')
    return re.test(val)
  }
  if (opName === 'is') return looseEq(val, target)
  return false
}

/**
 * 模拟 Sequelize.Op 对象
 * 使用 Symbol 而非常量，便于通过 key 名识别
 */
const Op = {
  eq: Symbol.for('eq'),
  ne: Symbol.for('ne'),
  gt: Symbol.for('gt'),
  gte: Symbol.for('gte'),
  lt: Symbol.for('lt'),
  lte: Symbol.for('lte'),
  in: Symbol.for('in'),
  notIn: Symbol.for('notin'),
  like: Symbol.for('like'),
  or: Symbol.for('or'),
  and: Symbol.for('and'),
  is: Symbol.for('is')
}

/** fn / col / literal 模拟（仅用于排序与聚合） */
const fn = (name, ...args) => ({ __fn: name, args })
const col = (name) => ({ __col: name })
const literal = (val) => ({ __literal: val })

/**
 * 模拟 Sequelize.define
 */
function define(name, schema = {}, options = {}) {
  return new Collection(options.tableName || name, schema)
}

const sequelize = {
  define,
  authenticate: async () => true,
  sync: async () => true,
  close: async () => true,
  query: async () => [],
  fn, col, literal, Op,
  DataTypes: {
    STRING: (len) => ({ type: 'STRING', len }),
    TEXT: () => ({ type: 'TEXT' }),
    INTEGER: () => ({ type: 'INTEGER' }),
    BIGINT: () => ({ type: 'BIGINT' }),
    TINYINT: () => ({ type: 'TINYINT' }),
    BOOLEAN: () => ({ type: 'BOOLEAN' }),
    FLOAT: () => ({ type: 'FLOAT' }),
    DOUBLE: () => ({ type: 'DOUBLE' }),
    DECIMAL: (p, s) => ({ type: 'DECIMAL', precision: p, scale: s }),
    DATE: () => ({ type: 'DATE' }),
    JSON: () => ({ type: 'JSON' }),
    ENUM: (...values) => ({ type: 'ENUM', values })
  }
}

module.exports = {
  Collection,
  sequelize,
  define,
  Op,
  DataTypes: sequelize.DataTypes,
  fn, col, literal
}
