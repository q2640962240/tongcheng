/**
 * 生产级数据初始化脚本（MySQL / JSON 存储双兼容）
 * 用法：node src/seed.js
 *
 * 原则：
 *   1. 仅初始化超级管理员账号（无测试用户/服务/订单等冗余数据）
 *   2. 仅创建配置中心空模板（5 大模块默认待配置，无密钥占位）
 *   3. 幂等执行：已存在的记录跳过
 *   4. 无 console.log 打印任何敏感明文密钥
 *   5. MySQL 模式下使用事务，失败自动回滚，避免半成品
 *
 * 管理员账号：
 *   用户名: admin
 *   初始密码: admin123   （首次登录管理后台后请立即修改）
 */
require('dotenv').config()
const path = require('path')
const fs = require('fs')

const DATA_DIR = path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const db = require('./models')
const { Admin, Config, ServiceCategory, sequelize } = db

// ============ 配置中心空模板定义 ============
// type 说明: string / number / boolean / secret(敏感, 后台应脱敏显示) / json
const CONFIG_TEMPLATES = {
  // 1. 应用基本信息
  app: [
    { key: 'name',            value: '白夜',  type: 'string',  description: '应用名称' },
    { key: 'domain',          value: '',      type: 'string',  description: '应用域名(含协议), 例如 https://baiye.example.com' },
    { key: 'kefuWechat',      value: '',      type: 'string',  description: '客服微信号' },
    { key: 'kefuQrcode',      value: '',      type: 'string',  description: '客服二维码 URL' },
    { key: 'kefuPhone',       value: '',      type: 'string',  description: '客服联系电话' },
    { key: 'notice',          value: '',      type: 'string',  description: '客服/公告说明文案' }
  ],

  // 2. 短信服务 (未配置接口将直接抛错，引导管理后台配置)
  sms: [
    { key: 'provider',        value: '',      type: 'string',  description: '短信服务商: aliyun / tencent' },
    { key: 'accessKeyId',     value: '',      type: 'secret',  description: 'AccessKey Id' },
    { key: 'accessKeySecret', value: '',      type: 'secret',  description: 'AccessKey Secret' },
    { key: 'signName',        value: '白夜',  type: 'string',  description: '短信签名' },
    { key: 'templateCode',    value: '',      type: 'string',  description: '通用短信模板编码' },
    { key: 'templateRegister',value: '',      type: 'string',  description: '注册场景短信模板编码(可选, 为空使用通用)' },
    { key: 'templateLogin',   value: '',      type: 'string',  description: '登录场景短信模板编码(可选, 为空使用通用)' }
  ],

  // 3. 微信支付 (enabled=true 且字段齐全才真实调用)
  wxpay: [
    { key: 'enabled',         value: 'false', type: 'boolean', description: '是否启用微信支付' },
    { key: 'appId',           value: '',      type: 'secret',  description: '微信开放平台/公众平台 AppID' },
    { key: 'mchId',           value: '',      type: 'secret',  description: '微信支付商户号 mch_id' },
    { key: 'mchKey',          value: '',      type: 'secret',  description: '商户 API 密钥(v3 为 apiv3 key)' },
    { key: 'notifyUrl',       value: '',      type: 'string',  description: '异步回调地址: https://域名/api/wallet/wx-notify' },
    { key: 'certPath',        value: '',      type: 'string',  description: '商户 API 证书 apiclient_cert.pem 本地路径(用于 v3 RSA 签名)' },
    { key: 'certKey',         value: '',      type: 'string',  description: '商户证书序列号 (cert serial no.)' },
    { key: 'certPrivateKey',  value: '',      type: 'secret',  description: '商户私钥 apiclient_key.pem 完整内容(生产推荐)' }
  ],

  // 4. 支付宝
  alipay: [
    { key: 'enabled',         value: 'false', type: 'boolean', description: '是否启用支付宝支付' },
    { key: 'appId',           value: '',      type: 'secret',  description: '支付宝应用 AppID' },
    { key: 'privateKey',      value: '',      type: 'secret',  description: '应用私钥(完整 RSA PRIVATE KEY PEM 字符串)' },
    { key: 'publicKey',       value: '',      type: 'secret',  description: '支付宝平台公钥(用于回调验签)' },
    { key: 'notifyUrl',       value: '',      type: 'string',  description: '异步回调地址: https://域名/api/wallet/alipay-notify' },
    { key: 'sandbox',         value: 'false', type: 'boolean', description: '是否使用沙箱环境测试' }
  ],

  // 5. 推送服务
  push: [
    { key: 'enabled',         value: 'false', type: 'boolean', description: '是否启用离线推送' },
    { key: 'provider',        value: '',      type: 'string',  description: '推送服务商: jpush(极光) / getui(个推)' },
    { key: 'appId',           value: '',      type: 'secret',  description: '应用 AppID (个推必填)' },
    { key: 'appKey',          value: '',      type: 'secret',  description: '应用 AppKey' },
    { key: 'masterSecret',    value: '',      type: 'secret',  description: '服务端 MasterSecret' },
    { key: 'channelId',       value: '',      type: 'string',  description: 'Android 通知渠道 ID (可选)' }
  ],

  // 6. OSS 存储 (provider=local 表示本地存储, aliyun 为阿里云 OSS)
  oss: [
    { key: 'provider',        value: 'local', type: 'string',  description: '存储服务商: local / aliyun' },
    { key: 'region',          value: '',      type: 'string',  description: '阿里云 OSS Region, 如 oss-cn-hangzhou' },
    { key: 'bucket',          value: '',      type: 'string',  description: '阿里云 OSS Bucket 名称' },
    { key: 'accessKeyId',     value: '',      type: 'secret',  description: 'AccessKey Id' },
    { key: 'accessKeySecret', value: '',      type: 'secret',  description: 'AccessKey Secret' },
    { key: 'endpoint',        value: '',      type: 'string',  description: '自定义 Endpoint (可选, ECS 内网可填)' },
    { key: 'cdnDomain',       value: '',      type: 'string',  description: 'CDN 加速域名, 如 https://cdn.example.com (可选)' }
  ]
}

// ============ 业务参数 配置项 ============
const SINGLE_CONFIGS = [
  { module: 'app', key: 'elite_lifetime_price_fen',     value: '3000', type: 'number', description: '精英终身会员价(分), 默认 30 元' },
  { module: 'app', key: 'unlock_wechat_diamond_cost',   value: '99',   type: 'number', description: '扣钻解锁查看微信号价格(钻石/次)' },
  { module: 'app', key: 'platform_commission_rate',     value: '0.2',  type: 'number', description: '平台抽成比例(0~1), 默认 20%' },
  { module: 'app', key: 'withdraw_min_amount_fen',      value: '1000', type: 'number', description: '最低提现额(分), 默认 10 元' },
  { module: 'app', key: 'withdraw_fee_rate',            value: '0',    type: 'number', description: '提现手续费比例(0~1), 默认 0' },
  { module: 'app', key: 'signInRewardDiamond',          value: '10',   type: 'number', description: '每日签到奖励钻石数, 默认 10' }
]

async function ensureAdmin({ transaction }) {
  let admin = await Admin.findOne({ where: { username: 'admin' }, transaction })
  if (!admin) {
    admin = await Admin.create({
      username: 'admin',
      password: 'admin123',
      role: 'superadmin',
      nickname: '超级管理员'
    }, { transaction })
    console.log('  ✅ 创建默认管理员: admin / admin123  (请在后台立即修改密码!)')
  } else {
    console.log('  - 管理员 admin 已存在, 跳过')
  }
  return admin
}

async function ensureConfigTemplates({ transaction }) {
  // 1. 按 (module, key) 去重查找当前已存数据，避免 N*2 查询
  const existing = await Config.findAll({ transaction })
  const map = new Map()
  for (const row of existing) map.set(`${row.module || ''}::${row.key}`, row)

  const toCreate = []
  const toUpdate = []

  function pushEntry(mod, entry) {
    const key = `${mod || ''}::${entry.key}`
    const row = map.get(key)
    if (!row) {
      toCreate.push({
        module: mod,
        key: entry.key,
        value: entry.value != null ? String(entry.value) : '',
        type: entry.type || 'string',
        description: entry.description || ''
      })
    } else {
      const patch = {}
      if (!row.description && entry.description) patch.description = entry.description
      if ((!row.type || row.type === 'string') && entry.type && entry.type !== 'string') patch.type = entry.type
      if (Object.keys(patch).length) toUpdate.push({ row, patch })
    }
  }

  for (const [mod, entries] of Object.entries(CONFIG_TEMPLATES)) {
    for (const e of entries) pushEntry(mod, e)
  }
  for (const e of SINGLE_CONFIGS) pushEntry(e.module, { key: e.key, value: e.value, type: e.type, description: e.description })

  if (toCreate.length) {
    // MySQL 模式 bulkCreate；JSON 模式循环 create，保证幂等
    if (sequelize.usingMysql) {
      await Config.bulkCreate(toCreate, { transaction, ignoreDuplicates: true })
    } else {
      for (const row of toCreate) await Config.create(row, { transaction })
    }
  }
  if (toUpdate.length) {
    for (const { row, patch } of toUpdate) {
      await row.update(patch, { transaction })
    }
  }
  const totalCreated = toCreate.length
  const totalTouched = totalCreated + toUpdate.length
  const skipped = Math.max(existing.length + totalTouched - (totalTouched), 0)
  console.log(`  ✅ 配置中心: 新增 ${totalCreated} 项, 更新 ${toUpdate.length} 项, 已存在 ${existing.length} 项 跳过`)
}

// ============ 服务分类（用户端展示/管理后台上架）初始化 ============
async function ensureServiceCategories({ transaction }) {
  const defaults = [
    // —— 顶级分类 ——
    { key: 'warm', name: '暖心服务', parentKey: null, icon: '💖', description: '虚拟恋人、哄睡、叫醒、唱歌等情感陪伴', sort: 100, visible: true, requireAudit: true, price: 0, priceUnit: '' },
    { key: 'game', name: '游戏陪玩', parentKey: null, icon: '🎮', description: '王者荣耀 / 和平精英 / 英雄联盟等热门游戏', sort: 90, visible: true, requireAudit: true, price: 0, priceUnit: '' },
    { key: 'offline', name: '兴趣约玩', parentKey: null, icon: '📍', description: '线下开黑 / 运动健身 / 同城约会等兴趣活动', sort: 80, visible: true, requireAudit: true, price: 0, priceUnit: '' },
    // —— 暖心服务子分类 ——
    { key: 'virtual-lover', name: '虚拟恋人', parentKey: 'warm', price: 99, priceUnit: '20分钟', allowCustomPrice: true, sort: 10, visible: true, requireAudit: true },
    { key: 'sing', name: '给你唱歌', parentKey: 'warm', price: 6, priceUnit: '首', allowCustomPrice: true, sort: 9, visible: true, requireAudit: true },
    { key: 'sleep', name: '哄睡电台', parentKey: 'warm', price: 0, priceUnit: '按分钟', allowCustomPrice: true, sort: 8, visible: true, requireAudit: true },
    { key: 'wake', name: '叫醒服务', parentKey: 'warm', price: 0, priceUnit: '按次', allowCustomPrice: true, sort: 7, visible: true, requireAudit: true },
    // —— 游戏陪玩子分类 ——
    { key: 'wzry', name: '王者荣耀', parentKey: 'game', price: 10, priceUnit: '局', allowCustomPrice: true, sort: 10, visible: true, requireAudit: true },
    { key: 'hpjy', name: '和平精英', parentKey: 'game', price: 10, priceUnit: '局', allowCustomPrice: true, sort: 9, visible: true, requireAudit: true },
    { key: 'lol', name: '英雄联盟', parentKey: 'game', price: 10, priceUnit: '局', allowCustomPrice: true, sort: 8, visible: true, requireAudit: true },
    { key: 'other-game', name: '其他游戏', parentKey: 'game', price: 10, priceUnit: '局', allowCustomPrice: true, sort: 7, visible: true, requireAudit: true },
    // —— 兴趣约玩子分类 ——
    { key: 'sport', name: '运动健身', parentKey: 'offline', price: 0, priceUnit: '', allowCustomPrice: true, sort: 10, visible: true, requireAudit: true },
    { key: 'date', name: '同城约会', parentKey: 'offline', price: 0, priceUnit: '', allowCustomPrice: true, sort: 9, visible: true, requireAudit: true },
    { key: 'offline-game', name: '线下开黑', parentKey: 'offline', price: 0, priceUnit: '', allowCustomPrice: true, sort: 8, visible: true, requireAudit: true }
  ]
  let created = 0, skipped = 0
  for (const d of defaults) {
    const exist = await ServiceCategory.findOne({ where: { key: d.key }, transaction })
    if (exist) { skipped++; continue }
    await ServiceCategory.create(d, { transaction })
    created++
  }
  console.log(`  🏷️  服务分类: 新增 ${created} 项, 已存在 ${skipped} 项 跳过（共 ${defaults.length} 个）`)
}

async function seed() {
  console.log('')
  console.log('🌱 白夜后端 · 生产级数据初始化')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  // 0. 建表 / 连接
  const bootstrapInfo = await db.bootstrap({ force: true })
  console.log(`  🗄️  存储驱动: ${bootstrapInfo.driver.toUpperCase()} ${bootstrapInfo.force ? '(force 模式重建表)' : '(alter 模式补齐列)'}`)

  if (sequelize.usingMysql) {
    // MySQL：事务包裹，失败全部回滚
    const transaction = await sequelize.transaction()
    try {
      await ensureAdmin({ transaction })
      await ensureConfigTemplates({ transaction })
      await ensureServiceCategories({ transaction })
      await transaction.commit()
    } catch (e) {
      await transaction.rollback()
      throw e
    }
  } else {
    // JSON：无事务，顺序执行即可
    await ensureAdmin({ transaction: undefined })
    await ensureConfigTemplates({ transaction: undefined })
    await ensureServiceCategories({ transaction: undefined })
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 初始化完成!')
  console.log('📌 下一步: 登录管理后台 → 配置中心 → 填写 短信/支付/OSS/推送 等真实参数')
  console.log('📌 管理后台 → 服务分类管理：上架/下架/排序/新增自定义分类')
  console.log('')
}

// 成功后必须显式关闭连接池并退出：
// sequelize 连接池是常驻句柄，不关则 Node 事件循环不空、进程永不退出，
// 会卡住容器 entrypoint 中 seed 之后的 `exec node src/app.js`（API 永不启动）。
seed().then(async () => {
  try {
    const { sequelize: seq } = require('./models')
    if (seq && typeof seq.close === 'function') await seq.close()
  } catch (_) { /* 关闭失败不阻塞退出 */ }
  process.exit(0)
}).catch(err => {
  console.error('种子初始化失败:', err)
  process.exit(1)
})
