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
const { Admin, Config, ServiceCategory, User, Wallet, Service, Post, Banner, Gift, sequelize } = db

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
  ],

  // 7. 腾讯云即时通信 IM (Chat UIKit / TIM SDK)
  im: [
    { key: 'enabled',         value: 'false',            type: 'boolean', description: '是否启用腾讯云 IM：true=前端优先走 TIM SDK 真实通道(会话/离线/多端同步)，false=回退自建 WebSocket 聊天' },
    { key: 'sdkAppId',        value: '',                 type: 'secret',  description: 'SDKAppID：IM 控制台 → 应用管理 → 创建应用后获取(纯数字，string 保存)' },
    { key: 'secretKey',       value: '',                 type: 'secret',  description: '密钥 Key：IM 控制台 → 应用管理 → 基本配置 → 获取密钥，用于服务端签发 UserSig' },
    { key: 'expireSeconds',   value: '15552000',         type: 'number',  description: 'UserSig 有效期(秒)：默认 15552000 = 180 天' },
    { key: 'adminUserId',     value: 'administrator',    type: 'string',  description: '服务端管理员账号：一般填 administrator，用于 REST API 调用单发消息、账号导入等' },
    { key: 'cloudSecretId',   value: '',                 type: 'secret',  description: '腾讯云 API SecretId：用于调用 v3 服务端 REST(账号导入、单发消息等)，非必填' },
    { key: 'cloudSecretKey',  value: '',                 type: 'secret',  description: '腾讯云 API SecretKey：配合 cloudSecretId 使用' },
    { key: 'imRegion',        value: 'ap-guangzhou',     type: 'string',  description: '接入地域：默认 ap-guangzhou (华南广州)' }
  ]
}

// ============ 业务参数 配置项 ============
const SINGLE_CONFIGS = [
  { module: 'app', key: 'elite_lifetime_price_fen',     value: '3000', type: 'number', description: '精英终身会员价(分), 默认 30 元' },
  { module: 'app', key: 'unlock_wechat_diamond_cost',   value: '99',   type: 'number', description: '扣钻解锁查看微信号价格(钻石/次)' },
  { module: 'app', key: 'platform_commission_rate',     value: '0.2',  type: 'number', description: '平台抽成比例(0~1), 默认 20%' },
  { module: 'app', key: 'withdraw_min_amount_fen',      value: '1000', type: 'number', description: '最低提现额(分), 默认 10 元' },
  { module: 'app', key: 'withdraw_fee_rate',            value: '0',    type: 'number', description: '提现手续费比例(0~1), 默认 0' },
  { module: 'app', key: 'signInRewardDiamond',          value: '10',   type: 'number', description: '每日签到奖励钻石数, 默认 10' },
  { module: 'app', key: 'serviceAutoApprove',            value: 'true', type: 'boolean', description: '用户发布服务是否自动过审(true=直接上架，false=进入审核队列，默认 true)' },
  { module: 'gift', key: 'withdrawRatio',                value: '0.7',  type: 'number',  description: '礼物提现比例(0~1), 默认 0.7(70%)' }
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

// ============ SVG 头像生成工具（纯本地、不请求外网）============
// 16 种稳定配色（按姓名 hash 稳定取色），生成 128×128 圆形头像 + 中心昵称首字 Emoji。
const AVATAR_PALETTES = [
  ['#0b1030', '#1b2060'], ['#6a1b4a', '#c7366b'], ['#1b4332', '#52b788'],
  ['#3c096c', '#9d4edd'], ['#013a63', '#2a9d8f'], ['#7f4f24', '#dda15e'],
  ['#212529', '#495057'], ['#ff006e', '#ffbe0b'], ['#264653', '#e76f51'],
  ['#3a0ca3', '#f72585'], ['#1a759f', '#76c893'], ['#606c38', '#fefae0'],
  ['#370617', '#ff4d6d'], ['#006400', '#9ef01a'], ['#1d3557', '#e63946'],
  ['#590d22', '#ffb4a2']
]
function hashStr(s) {
  let h = 2166136261
  const str = String(s || 'user')
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 16777619) }
  return (h >>> 0)
}
function svgAvatar(name = '小白', idx = 0) {
  const palette = AVATAR_PALETTES[(hashStr(name) + idx) % AVATAR_PALETTES.length]
  const [c1, c2] = palette
  const g = String(name || 'U').trim().charAt(0) || 'U'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="128" height="128" rx="64" fill="url(#g)"/><circle cx="64" cy="52" r="22" fill="#d9b26b"/><path d="M22 112c6-24 26-36 42-36s36 12 42 36z" fill="#d9b26b"/><text x="64" y="104" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="18" font-weight="700" fill="#fff" opacity="0.95">${g}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

// ============ 应用公告 / 客服文案（写 config 模板的空值，不覆盖已修改） ============
const APP_DEFAULTS_IDEMPOTENT = [
  { module: 'app', key: 'kefuWechat', value: 'baiye_kefu_01',    patchIfEmpty: true,  description: '客服微信号(种子默认，可在后台替换)' },
  { module: 'app', key: 'kefuPhone',  value: '400-000-0000',    patchIfEmpty: true,  description: '客服联系电话(种子默认)' },
  { module: 'app', key: 'notice',     value: '欢迎来到白夜陪玩 · 精英会员 30 元终身，解锁暖心/游戏/同城约玩 22+ 技能；充值钻石可查看大神微信号、赠送礼物、打赏下单。客服微信：baiye_kefu_01（工作日 10:00~22:00）', patchIfEmpty: true, description: '首页公告/客服说明(种子默认)' },
  { module: 'app', key: 'domain',     value: 'https://zyb001.cn', patchIfEmpty: true, description: '应用域名(种子默认：生产域名)' }
]
async function ensureAppDefaults({ transaction }) {
  let patched = 0
  for (const e of APP_DEFAULTS_IDEMPOTENT) {
    const row = await Config.findOne({ where: { module: e.module, key: e.key }, transaction })
    if (!row) {
      await Config.create({ module: e.module, key: e.key, value: String(e.value), type: 'string', description: e.description || '' }, { transaction })
      patched++
      continue
    }
    if (e.patchIfEmpty && (!String(row.value || '').trim())) {
      await row.update({ value: String(e.value), description: row.description || e.description || '' }, { transaction })
      patched++
    }
  }
  console.log(`  📣  应用文案：补充/修正 ${patched} 项（客服微信、客服电话、公告、域名）`)
}

// ============ AI 用户种子（虚拟大神，phone 唯一键幂等） ============
const AI_USERS = [
  { phone: '18800000101', nickname: '小桃姐姐', gender: 2, city: '北京市', bio: '播音系在读 · 声控福利 · 深夜电台主播 23:00 在线', tags: ['声控','电台','温柔'], g: 1, ai: 'deepseek', specialty: ['virtual-lover', 'sleep', 'sing'] },
  { phone: '18800000102', nickname: '软糖酱',   gender: 2, city: '上海市', bio: '萝莉音 / 二次元 / 王者钻石带飞三路',       tags: ['萝莉音','王者','二次元'], g: 2, ai: 'openai',   specialty: ['wzry', 'sing'] },
  { phone: '18800000103', nickname: '七月学长', gender: 1, city: '广州市', bio: '青叔音 · 陪你上分 · 英雄联盟大师打野',     tags: ['青叔音','LOL','上分'], g: 3, ai: 'custom',   specialty: ['lol', 'virtual-lover'] },
  { phone: '18800000104', nickname: '雪梨',     gender: 2, city: '深圳市', bio: '御姐音 · 心理咨询专业 · 哄睡超治愈',         tags: ['御姐','哄睡','情感'], g: 4, ai: 'deepseek', specialty: ['sleep', 'virtual-lover'] },
  { phone: '18800000105', nickname: '大橘',     gender: 1, city: '成都市', bio: '川普 00 后 · 和平精英王牌 · 超会唠',       tags: ['川普','吃鸡','社交牛'], g: 5, ai: 'openai',   specialty: ['hpjy', 'date'] },
  { phone: '18800000106', nickname: '抹茶',     gender: 2, city: '杭州市', bio: '日系甜美 · 唱歌比赛银奖 · 叫醒小能手',       tags: ['日系','唱歌','叫醒'], g: 6, ai: 'custom',   specialty: ['sing', 'wake', 'virtual-lover'] },
  { phone: '18800000107', nickname: '阿泽',     gender: 1, city: '武汉市', bio: '健身教练 · 同城线下陪练 · 羽毛球/跑步',       tags: ['健身','线下','运动'], g: 7, ai: 'deepseek', specialty: ['sport', 'offline-game'] },
  { phone: '18800000108', nickname: '奶盖',     gender: 2, city: '南京市', bio: '汉服少女 · 线下漫展/探店/拍照向导',          tags: ['汉服','拍照','探店'], g: 8, ai: 'openai',   specialty: ['date', 'sport'] },
  { phone: '18800000109', nickname: 'Leo',      gender: 1, city: '重庆市', bio: '留学海龟 · 英语口语陪练 · 虚拟男友力 max',   tags: ['英语','男友力','情感'], g: 9, ai: 'custom',   specialty: ['virtual-lover', 'sing'] },
  { phone: '18800000110', nickname: '云朵',     gender: 2, city: '西安市', bio: '美院毕业 · 手绘头像 · 树洞聊天到天亮',        tags: ['画画','树洞','暖心'], g: 10, ai: 'deepseek', specialty: ['virtual-lover', 'sleep'] },
  { phone: '18800000111', nickname: '阿坤',     gender: 1, city: '杭州市', bio: 'KTV 麦霸 · 其他游戏全能 · 线下开黑首选',     tags: ['麦霸','全能','线下'], g: 11, ai: 'openai',   specialty: ['other-game', 'offline-game', 'sing'] }
]
function genInviteCode(seedStr, i) {
  const base = (hashStr(seedStr) + i * 1315423911).toString(36).toUpperCase().padStart(8, '0').slice(0, 8)
  return 'AI' + base
}
async function ensureAiUsers({ transaction }) {
  const phoneSeen = new Set()
  // 取出现有的 AI 用户（避免 phone 唯一键冲突）
  const existing = await User.findAll({ where: { phone: AI_USERS.map(u => u.phone) }, transaction })
  existing.forEach(u => phoneSeen.add(u.phone))
  const created = []
  for (let i = 0; i < AI_USERS.length; i++) {
    const u = AI_USERS[i]
    if (phoneSeen.has(u.phone)) continue
    const [row] = await User.findOrCreate({
      where: { phone: u.phone },
      defaults: {
        phone: u.phone,
        nickname: u.nickname,
        avatar: svgAvatar(u.nickname, u.g),
        gender: u.gender,
        city: u.city,
        bio: u.bio,
        isElite: true,
        isProvider: true,
        userType: 'ai',
        aiProvider: u.ai,
        realPersonStatus: 'passed',
        identityStatus: 'none',
        inviteCode: genInviteCode(u.phone, i),
        status: 1,
        meta: { seed: true, tags: u.tags || null, specialties: u.specialty || null }
      },
      transaction
    })
    // 没有 Wallet 的补齐（确保 Wallet 1:1 userId 唯一键不冲突）
    const wallet = await Wallet.findOne({ where: { userId: row.id }, transaction })
    if (!wallet) {
      await Wallet.create({ userId: row.id, diamond: 0, starCoin: Math.floor(100 + Math.random() * 900) }, { transaction })
    }
    created.push(row)
  }
  console.log(`  🤖  AI 虚拟大神：新增 ${created.length} 位, 已存在 ${AI_USERS.length - created.length} 位 跳过（phone 幂等）`)
  return AI_USERS
}

// ============ AI 服务种子（providerId+category+subCategory+title 幂等） ============
const SERVICE_SPECS = [
  // 暖心服务
  ['virtual-lover','warm','虚拟恋人 · 恋爱聊天（24h）', 99, '20分钟', '24 小时陪你聊天：早安晚安、分享日常、连麦哄睡、游戏陪唠。', ['温柔','连麦','情商高']],
  ['sleep',         'warm','深夜哄睡电台（45 分钟）', 29, '45分钟',  '呼吸引导 + 环境音白噪音 + 轻声故事，专治失眠。',          ['助眠','呼吸法','故事']],
  ['wake',          'warm','早安温柔叫醒（一周套餐）', 39, '次',      '每天 7:30 温柔叫起 + 天气预报 + 一句情话。',               ['早安','定制','周卡']],
  ['sing',          'warm','给你唱首歌 · 指定 1 首',    12, '首',      '指定流行/古风/二次元歌曲，MP3 交付 + 可选语音祝福。',        ['古风','二次元','点歌']],
  ['sing',          'warm','哄睡唱摇篮曲 · 3 首连播',   18, '次',      '3 首温柔摇篮曲 + 收尾呼吸降速引导。',                     ['助眠','摇篮曲','温柔']],
  // 游戏陪玩
  ['wzry',          'game','王者荣耀 1 局（排位/娱乐）',12, '局',      '王者段位：钻石 ~ 星耀，位置：游走 / 打野 双位置。',          ['王者','上分','带飞']],
  ['wzry',          'game','王者荣耀 · 连麦娱乐 3 局', 30, '3局',      '快乐为主，输赢不挂脸，会喊 666。',                           ['娱乐','连麦','气氛组']],
  ['hpjy',          'game','和平精英 1 局（经典四排）',12, '局',      '王牌 ~ 战神，钢枪指挥位，包进决赛圈。',                     ['吃鸡','指挥','带妹']],
  ['lol',           'game','英雄联盟 · 打野位置 1 局',15, '局',      '网一/电一双区可玩，打野节奏大师。',                          ['LOL','打野','大师']],
  ['other-game',    'game','其他游戏 · 自定义咨询',    10, '小时',    '原神/金铲铲/永劫无间等其他热门游戏，先聊再下单。',            ['原神','金铲铲','永劫无间']],
  // 兴趣约玩
  ['sport',         'offline','线下健身陪练 1 小时', 66, '小时',    '健身房动作纠正 / 跑步 5km / 羽毛球 1v1，自备场地 AA。',     ['健身','跑步','羽毛球']],
  ['date',          'offline','同城探店 / 拍照 2 小时',88, '2小时', '奶茶店 / 咖啡馆 / 网红展览 / 景点，可当你摄影师兼闺蜜。', ['探店','拍照','看展']],
  ['date',          'offline','同城电影陪同（1 场）',  39, '场',      '电影票 AA，负责选座 + 买爆米花 + 观后讨论小作文。',          ['电影','陪同','爆米花']],
  ['offline-game',  'offline','线下开黑 · 桌游网吧 2h',58, '2小时',  '指定城市桌游吧/网吧：剧本杀 DM 场记、英雄联盟五黑车队。',  ['桌游','剧本杀','开黑']],
  ['sport',         'offline','Citywalk 城市漫步 2h', 45, '2小时',  '老城区 / 滨江步道 / 梧桐区，边走边聊，附赠城市笔记。',     ['漫步','Citywalk','拍照']]
]
async function ensureAiServices({ transaction }) {
  // 取所有 userType='ai' 的用户作为服务候选池
  const aiUsers = await User.findAll({ where: { userType: 'ai', status: 1 }, transaction })
  if (!aiUsers.length) { console.log('  🛠️  AI 服务：跳过（无 AI 用户可分配）'); return 0 }
  let created = 0, skipped = 0
  for (let i = 0; i < SERVICE_SPECS.length; i++) {
    const [sub, cat, title, price, unit, desc, tags] = SERVICE_SPECS[i]
    // 按 specialty 偏好匹配；未命中就循环分配
    let provider = aiUsers.find(u => {
      const sp = (u.meta && u.meta.specialties) ? u.meta.specialties : null
      return Array.isArray(sp) && sp.includes(sub)
    }) || aiUsers[i % aiUsers.length]
    const where = { providerId: provider.id, category: cat, subCategory: sub, title: title }
    const exist = await Service.findOne({ where, transaction })
    if (exist) { skipped++; continue }
    await Service.create({
      ...where,
      description: desc,
      price: Number(price) || 0,
      priceUnit: unit,
      coverImage: svgAvatar(title || sub, i + 20),
      tags: Array.isArray(tags) ? tags : null,
      status: 'online',
      sort: SERVICE_SPECS.length - i,
      viewCount: Math.floor(80 + Math.random() * 1500),
      orderCount: Math.floor(Math.random() * 50),
      ratingAvg: (4.5 + Math.random() * 0.5).toFixed(1),
      city: String(provider.city || '')
    }, { transaction })
    created++
  }
  console.log(`  🛠️  AI 服务：新增 ${created} 条, 已存在 ${skipped} 条 跳过（共 ${SERVICE_SPECS.length} 项）`)
  return created
}

// ============ AI 动态种子（userId+text 幂等，approved） ============
const POST_TEMPLATES = [
  { c: '北京市', t: '今晚 23:30 电台档又要开播啦～主题是「那些年没能说出口的喜欢」，有想听的故事可以提前告诉我 🌙 #深夜电台 #树洞' },
  { c: '上海市', t: '王者今晚钻石局还差一位辅助！要软辅硬辅都可以，我负责打中上，上分给我冲。 #王者荣耀 #上分' },
  { c: '广州市', t: '英雄联盟大师打野在线，缺中单！有人双排吗，今晚通宵也可以？ #LOL #陪玩' },
  { c: '深圳市', t: '最近学了两首周杰伦的老歌，下单唱歌就送呼吸法哄睡一次～有人点歌吗🎤 #唱歌 #哄睡' },
  { c: '成都市', t: '和平精英四缺一，王牌车队带飞，川普指挥超好笑 🐔 今晚 20:00 老地方见！ #吃鸡 #四排' },
  { c: '杭州市', t: '周末汉服出街约拍！杭州西湖 / 小河直街 路线已经规划好啦，需要陪同或拍照的姐妹dd。 #汉服 #探店' },
  { c: '武汉市', t: '武汉的雨下了一整天，准备开一家线上 24h 树洞，语音 / 文字都接，睡不着的朋友点我主页。 #树洞 #情感' },
  { c: '南京市', t: '探店第 38 家：南京老门东的「阿婆糖水铺」真的绝！下次要一起的扣 1。 #探店 #Citywalk' },
  { c: '重庆市', t: '英语口语陪练的同学可以来了！雅思 7.5，日常对话 / 面试模拟 / 留学行前 都 ok。 #英语 #虚拟男友' },
  { c: '西安市', t: '手绘头像 9.9 元一张，今天抽 3 位下单唱歌的朋友免费送！✨ #画画 #福利' },
  { c: '杭州市', t: '麦霸在线 3 小时，其他游戏（原神/金铲铲/永劫无间）也都能陪玩，要连麦的直接拍。 #麦霸 #全能' }
]
async function ensureAiPosts({ transaction }) {
  const aiUsers = await User.findAll({ where: { userType: 'ai', status: 1 }, transaction })
  if (!aiUsers.length) { console.log('  📜  AI 动态：跳过（无 AI 用户）'); return 0 }
  let created = 0, skipped = 0
  for (let i = 0; i < POST_TEMPLATES.length; i++) {
    const p = POST_TEMPLATES[i]
    const author = aiUsers[i % aiUsers.length]
    const exist = await Post.findOne({ where: { userId: author.id, text: p.t }, transaction })
    if (exist) { skipped++; continue }
    const cover = svgAvatar(`动态${i}`, i + 100)
    await Post.create({
      userId: author.id,
      text: p.t,
      images: [cover],
      city: p.c,
      location: { city: p.c, source: 'seed' },
      auditStatus: 'approved',
      online: true,
      category: 'dynamic',
      likeCount: Math.floor(5 + Math.random() * 200),
      commentCount: Math.floor(Math.random() * 20),
      top: i === 0
    }, { transaction })
    created++
  }
  console.log(`  📜  AI 动态：新增 ${created} 条, 已存在 ${skipped} 条 跳过（共 ${POST_TEMPLATES.length} 条）`)
  return created
}

// ============ Banner 种子（image 去重） ============
const BANNER_DEFS = [
  { title: '白夜 · 精英会员 30 元终身',            c1: '#1d3557', c2: '#e63946', link: '/pages/elite/elite',  position: 'home_top', sort: 100, text: '6 大特权 · 解锁无限聊 · 服务置顶' },
  { title: '新人首充 6 元送 66 钻',                  c1: '#3c096c', c2: '#f72585', link: '/pages/recharge/recharge', position: 'home_top', sort: 90,  text: '限时福利 · 再送 7 天体验精英权益' },
  { title: '暖心电台 · 深夜哄睡专场 29 元起',        c1: '#0b1030', c2: '#52b788', link: '/pages/warm/warm',    position: 'home_top', sort: 80,  text: '呼吸引导 + 故事 + 45 分钟连麦 · 失眠救星' }
]
function svgBanner(title, subtitle, c1, c2) {
  const safe = (s) => String(s || '').replace(/[<>&]/g, '').slice(0, 28)
  const titleTxt = safe(title), subTxt = safe(subtitle)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 280"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="750" height="280" rx="24" fill="url(#bg)"/><circle cx="640" cy="90" r="120" fill="#ffffff" opacity="0.08"/><circle cx="690" cy="210" r="70" fill="#ffffff" opacity="0.10"/><text x="42" y="118" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="44" font-weight="800" fill="#fff">${titleTxt}</text><text x="42" y="170" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="24" fill="#ffffff" opacity="0.92">${subTxt}</text><text x="42" y="232" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="22" fill="#ffffff" opacity="0.78">🎉 点击立即参与 →</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
async function ensureBanners({ transaction }) {
  let created = 0, skipped = 0
  for (let i = 0; i < BANNER_DEFS.length; i++) {
    const b = BANNER_DEFS[i]
    const image = svgBanner(b.title, b.text, b.c1, b.c2)
    const exist = await Banner.findOne({ where: { title: b.title }, transaction })
    if (exist) { skipped++; continue }
    await Banner.create({
      title: b.title,
      image,
      link: b.link,
      position: b.position,
      sort: b.sort,
      enabled: true
    }, { transaction })
    created++
  }
  console.log(`  🖼️  Banner：新增 ${created} 张, 已存在 ${skipped} 张 跳过（共 ${BANNER_DEFS.length} 张）`)
  return created
}

// ============ 礼物种子数据 ============
const DEFAULT_GIFTS = [
  { name: '小红花', imageUrl: '/static/gifts/flower.png', price: 10, sort: 1, active: true },
  { name: '爱心',   imageUrl: '/static/gifts/heart.png',   price: 50, sort: 2, active: true },
  { name: '皇冠',   imageUrl: '/static/gifts/crown.png',   price: 100, sort: 3, active: true },
  { name: '火箭',   imageUrl: '/static/gifts/rocket.png',  price: 500, sort: 4, active: true }
]
async function ensureGifts({ transaction }) {
  const existing = await Gift.findAll({ transaction })
  if (existing.length > 0) {
    console.log(`  🎁  礼物：已存在 ${existing.length} 个，跳过`)
    return
  }
  for (const g of DEFAULT_GIFTS) {
    await Gift.create(g, { transaction })
  }
  console.log(`  🎁  礼物：新增 ${DEFAULT_GIFTS.length} 个默认礼物`)
}

/**
 * 批量把业务用户（含 AI 虚拟大神）导入腾讯云 IM（account_import）。
 * 幂等：已存在的 IM 账号重复导入只会更新昵称/头像。
 * 仅在「配置中心 → 即时通信 IM」填了 cloudSecretId/cloudSecretKey 时才真实调用，否则跳过。
 */
async function importAllUsersToIM() {
  try {
    const { importIMAccount } = require('./utils/im')
    const { getModuleConfig } = require('./utils/config')
    const cfg = await getModuleConfig('im')
    if (!cfg || !cfg.enabled || !cfg.cloudSecretId || !cfg.cloudSecretKey) {
      console.log('  💬  腾讯云 IM 账号导入：跳过（未启用，或未填 cloudSecretId/cloudSecretKey）')
      return
    }
    const users = await User.findAll({ where: { status: 1 } })
    let imported = 0
    let failed = 0
    for (const u of users) {
      const r = await importIMAccount({ cfg, userId: u.id, nick: u.nickname || '', faceUrl: u.avatar || '' })
      if (r && r.action === 'import' && !(r.result && r.result.error)) imported++
      else failed++
      // 轻微限流，避免请求过快触发 IM 频控
      await new Promise((res) => setTimeout(res, 120))
    }
    console.log(`  💬  腾讯云 IM 账号导入：共 ${users.length} 位，成功 ${imported} 位，失败/跳过 ${failed} 位`)
  } catch (e) {
    console.warn('  💬  腾讯云 IM 账号导入失败（不阻塞启动）：', (e && e.message) || String(e))
  }
}

async function seed() {
  console.log('')
  console.log('🌱 白夜后端 · 生产级数据初始化')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  // 0. 建表 / 连接（注意：绝对不能 force:true，否则每次容器启动 DROP TABLE 清空数据!）
  //    首次启动表不存在 → alter 会自动建表；后续启动 → alter 只补新增列，不碰已有数据
  const bootstrapInfo = await db.bootstrap({ force: false })
  console.log(`  🗄️  存储驱动: ${bootstrapInfo.driver.toUpperCase()} (alter 模式: 只补列, 不重建表, 数据安全)`)

  if (sequelize.usingMysql) {
    // MySQL：事务包裹，失败全部回滚
    const transaction = await sequelize.transaction()
    try {
      await ensureAdmin({ transaction })
      await ensureConfigTemplates({ transaction })
      await ensureAppDefaults({ transaction })
      await ensureServiceCategories({ transaction })
      await ensureAiUsers({ transaction })
      await ensureAiServices({ transaction })
      await ensureAiPosts({ transaction })
      await ensureBanners({ transaction })
      await ensureGifts({ transaction })
      await transaction.commit()
    } catch (e) {
      await transaction.rollback()
      throw e
    }
  } else {
    // JSON：无事务，顺序执行即可
    await ensureAdmin({ transaction: undefined })
    await ensureConfigTemplates({ transaction: undefined })
    await ensureAppDefaults({ transaction: undefined })
    await ensureServiceCategories({ transaction: undefined })
    await ensureAiUsers({ transaction: undefined })
    await ensureAiServices({ transaction: undefined })
    await ensureAiPosts({ transaction: undefined })
    await ensureBanners({ transaction: undefined })
    await ensureGifts({ transaction: undefined })
  }
  // 事务/写入全部完成后再做 IM 账号导入（需读最新数据，且不纳入事务；失败不阻塞启动）
  await importAllUsersToIM()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 初始化完成!')
  console.log('📌 下一步: 登录管理后台 → 配置中心 → 填写 短信/支付/OSS/推送 等真实参数')
  console.log('📌 管理后台 → 服务分类管理：上架/下架/排序/新增自定义分类')
  console.log('📌 首页不空：已自动写入 AI 大神 11 位 + 服务 15 条 + 动态 11 条 + Banner 3 张（幂等，重启不重复）')
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
