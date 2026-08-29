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
    const record = this.applyDefaults(values)
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
    // 统一密码校验：复用 Admin 的 hash 判定，优先 bcrypt；否则兼容旧明文比较（迁移过渡期）
    obj.verifyPassword = function (plain) {
      const bcrypt = require('bcryptjs')
      const { _isBcryptHash } = require('../models/Admin')
      const hashed = record.password
      if (!hashed || !plain) return false
      if (_isBcryptHash(hashed)) return bcrypt.compareSync(String(plain), String(hashed))
      return String(hashed) === String(plain)
    }
    // 密码 setter 钩子：Admin 模型在 Sequelize 里通过 DataTypes setter 实现 bcrypt；
    // JSON 驱动下 create/update 时要保持同样的幂等行为，避免二次 hash 导致登录失败
    if (self.name === 'admins' || self.name === 'users') {
      const pwd = obj.password
      if (typeof pwd === 'string' && pwd && !require('../models/Admin')._isBcryptHash(pwd)) {
        const hashed = require('bcryptjs').hashSync(pwd, 10)
        record.password = hashed
        obj.password = hashed
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
      Object.assign(record, values, { updatedAt: nowStr })
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
 * 匹配 where 条件
 * 支持：{ field: value, field: { [Op.eq]: v, [Op.like]: '%v%', [Op.gt]: v, [Op.in]: [...] } }
 */
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
      if (!cond.includes(val)) return false
    } else {
      if (val !== cond) return false
    }
  }
  return true
}

function matchOp(op, val, target) {
  const opName = String(op).toLowerCase()
  if (opName === 'eq') return val === target
  if (opName === 'ne') return val !== target
  if (opName === 'gt') return val > target
  if (opName === 'gte') return val >= target
  if (opName === 'lt') return val < target
  if (opName === 'lte') return val <= target
  if (opName === 'in') return Array.isArray(target) && target.includes(val)
  if (opName === 'notin') return Array.isArray(target) && !target.includes(val)
  if (opName === 'like') {
    if (typeof val !== 'string') return false
    const re = new RegExp('^' + String(target).replace(/%/g, '.*').replace(/_/g, '.') + '$')
    return re.test(val)
  }
  if (opName === 'is') return val === target
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
