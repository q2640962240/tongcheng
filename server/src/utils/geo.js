/*
 * 地理/定位工具：逆地理 + IP 粗定位 + 城市名规范化
 * 规范：任何外部网络请求必须在"配置中心已填 provider+key"条件下才发起；
 *       否则统一走本地兜底，绝不因缺少 key 产生外网费用或抛出 400 给前端。
 */
'use strict'
const axios = require('axios')
const { get: getConfig } = require('./config')
const { searchRegions, getProvinces, CITY_ALIASES } = require('../data/china_cities')

class ConfigNotSetError extends Error {
  constructor(msg = '定位服务未配置') {
    super(msg)
    this.name = 'ConfigNotSetError'
  }
}

function pickAppCfg() {
  const cfg = getConfig() || {}
  return {
    provider: String(cfg.app?.geoProvider || 'off').toLowerCase(),
    key: String(cfg.app?.geoKey || '').trim()
  }
}

/**
 * 经纬度 → 省/市/区（逆地理）
 * @returns {Promise<{ province: string, city: string, district: string, source: string, raw?: any }>}
 */
async function reverseGeocode({ lat, lng }) {
  const { provider, key } = pickAppCfg()
  const latNum = Number(lat)
  const lngNum = Number(lng)
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return { province: '', city: '', district: '', source: 'bad-input' }
  }
  if (provider === 'off' || !key) {
    // 未配置：不请求外网，返回空结果 + source 标识，前端会自动走下一级
    return { province: '', city: '', district: '', source: 'not-configured' }
  }
  let url = ''
  let params = {}
  let resp
  try {
    if (provider === 'amap') {
      url = 'https://restapi.amap.com/v3/geocode/regeo'
      params = { key, location: `${lngNum},${latNum}` }
      resp = (await axios.get(url, { params, timeout: 6000 })).data
      const addr = resp && resp.regeocode && resp.regeocode.addressComponent
      return {
        province: addr && addr.province ? String(addr.province) : '',
        city: addr && (addr.city || addr.province) ? String(addr.city || addr.province) : '',
        district: addr && addr.district ? String(addr.district) : '',
        source: 'amap'
      }
    }
    if (provider === 'tencent') {
      url = 'https://apis.map.qq.com/ws/geocoder/v1'
      params = { key, location: `${latNum},${lngNum}` }
      resp = (await axios.get(url, { params, timeout: 6000 })).data
      const result = resp && resp.result
      const addr = result && result.address_component
      return {
        province: addr && addr.province ? String(addr.province) : '',
        city: addr && addr.city ? String(addr.city) : '',
        district: addr && addr.district ? String(addr.district) : '',
        source: 'tencent'
      }
    }
  } catch (e) {
    // 外网请求失败：不抛给用户，标识为失败即可
    return { province: '', city: '', district: '', source: provider + '-error:' + (e.message || 'network').slice(0, 40) }
  }
  return { province: '', city: '', district: '', source: 'unknown-provider' }
}

/**
 * IP → 粗定位（本地规则库兜底）
 * 不对外暴露原始 IP；只返回省/市 + fallback 标识
 */
function guessCityByIp(req) {
  try {
    const fwd = (req.headers && req.headers['x-forwarded-for']) || ''
    const remote = (typeof req.ip === 'string' && req.ip) ||
      (req.connection && req.connection.remoteAddress) ||
      (req.socket && req.socket.remoteAddress) ||
      ''
    const ip = String(fwd ? fwd.split(',')[0] : remote).trim()
    // 本地网段回退（不收费、不访问外部）
    if (
      !ip ||
      ip === '::1' ||
      ip === '::ffff:127.0.0.1' ||
      /^127\./.test(ip) ||
      /^10\./.test(ip) ||
      /^192\.168\./.test(ip) ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip) ||
      ip.startsWith('fe80') ||
      ip.startsWith('fc') ||
      ip.startsWith('fd')
    ) {
      return { province: '', city: '北京', fallback: true, reason: 'private-ip' }
    }
    // 公网 IP 这里不访问外部接口（避免费用），返回空值；前端会落到"手动选择"兜底
    return { province: '', city: '', fallback: true, reason: 'public-ip-noop' }
  } catch (_) {
    return { province: '', city: '北京', fallback: true, reason: 'exception' }
  }
}

const SHORT_NAME_HINTS = [
  ['自治州', '州'],
  ['回族自治州', '州'],
  ['藏族自治州', '州'],
  ['蒙古族自治州', '州'],
  ['壮族自治州', '州'],
  ['彝族自治州', '州'],
  ['傣族景颇族自治州', '州'],
  ['傈僳族自治州', '州'],
  ['白族自治州', '州'],
  ['苗族侗族自治州', '州'],
  ['布依族苗族自治州', '州'],
  ['朝鲜族自治州', '州'],
  ['地区', ''],
  ['盟', '盟'],
  ['特别行政区', ''],
  ['市', '']
]

/**
 * 规范化城市名：
 *   "广州" → "广州市"，"北京" → "北京市"，"沪" → "上海市"，"申" → "上海市"
 *   若无法匹配，返回原始值（保留历史数据兼容性）
 */
function normalizeCityName(raw) {
  const name = String(raw || '').trim()
  if (!name) return name

  // 1) 先在别名里找完全匹配（比如"蓉""鹏城""沪""bj" 之类）
  for (const [cityName, aliases] of Object.entries(CITY_ALIASES || {})) {
    if (!aliases || !aliases.length) continue
    if (aliases.indexOf(name) >= 0) return cityName
  }
  // 2) 直接 searchRegions 中文前缀 / 去掉后缀简写
  const withoutSuffix = SHORT_NAME_HINTS.reduce((s, [suffix, repl]) => {
    if (suffix && s.endsWith(suffix)) return s.slice(0, -suffix.length) + repl
    return s
  }, name)
  const candidates = [name, withoutSuffix]
  // 3) 加上后缀"市"尝试
  if (!/市|州|盟|地区|香港|澳门$/.test(name)) {
    candidates.push(name + '市')
  }
  for (const c of candidates) {
    const hits = searchRegions(c)
    if (!hits || !hits.length) continue
    const first = hits[0]
    if (first.name === c) return first.name
    if (c === name) return first.name
  }
  // 4) 省名映射到该省省会（例如输入"浙江"→"杭州市"）
  const provinces = getProvinces()
  const byFullName = new Map(provinces.map(p => [p.name, p]))
  if (byFullName.has(name)) return byFullName.get(name).capital
  for (const p of provinces) {
    const shortName = p.name.replace(/省|市|自治区|壮族自治区|回族自治区|维吾尔自治区$/, '')
    if (shortName === name) {
      return capitalizeForProvince(p.name)
    }
    if (p.abbr === name) return capitalizeForProvince(p.name)
  }
  return name
}

const CAPITAL_BY_PROVINCE = {
  '北京市':'北京市','天津市':'天津市','上海市':'上海市','重庆市':'重庆市',
  '河北省':'石家庄市','山西省':'太原市','辽宁省':'沈阳市','吉林省':'长春市','黑龙江省':'哈尔滨市',
  '江苏省':'南京市','浙江省':'杭州市','安徽省':'合肥市','福建省':'福州市','江西省':'南昌市',
  '山东省':'济南市','河南省':'郑州市','湖北省':'武汉市','湖南省':'长沙市','广东省':'广州市',
  '海南省':'海口市','四川省':'成都市','贵州省':'贵阳市','云南省':'昆明市','陕西省':'西安市',
  '甘肃省':'兰州市','青海省':'西宁市','台湾省':'台北市',
  '内蒙古自治区':'呼和浩特市','广西壮族自治区':'南宁市','西藏自治区':'拉萨市',
  '宁夏回族自治区':'银川市','新疆维吾尔自治区':'乌鲁木齐市',
  '香港特别行政区':'香港','澳门特别行政区':'澳门'
}

function capitalizeForProvince(provinceName) {
  return CAPITAL_BY_PROVINCE[provinceName] || ''
}

// 给 normalizeCityName 在步骤 4 中使用（getProvinces 不含 capital，我们用映射）
module.exports = {
  ConfigNotSetError,
  reverseGeocode,
  guessCityByIp,
  normalizeCityName,
  CAPITAL_BY_PROVINCE
}
