/**
 * OSS 上传抽象层 — 生产级
 *
 * Provider：
 *   - local   本地存储 (文件由 multer 写入 uploads/，通过 express.static 对外提供 /uploads/*)
 *             ★ 生产可用。适合单机部署；如需集群/CDN 请使用 aliyun
 *   - aliyun  阿里云 OSS (需要 region + bucket + AccessKey)
 *             依赖：ali-oss
 *
 * 生产原则：
 *   - provider=aliyun 但 SDK 未安装 or 配置缺失 → 直接返回错误，不再静默回退本地
 *   - provider=local → 不依赖任何 SDK，始终可用
 */
const fs = require('fs')
const path = require('path')
const { getModuleConfig } = require('./config')

function loadOSS() {
  try { return require('ali-oss') } catch (e) { return null }
}

async function getConfig() {
  return getModuleConfig('oss')
}

function missingFields(cfg, required) {
  return required.filter(k => !cfg[k])
}

async function isEnabledAliyun() {
  const cfg = await getConfig()
  if (cfg.provider !== 'aliyun') return false
  return missingFields(cfg, ['region', 'bucket', 'accessKeyId', 'accessKeySecret']).length === 0
}

/**
 * 上传文件
 * @returns {Promise<{success, provider, url?, key?, message?}>}
 */
async function upload(localPath, filename, mimeType = 'image/jpeg') {
  const cfg = await getConfig()
  const provider = (cfg.provider || 'local').trim().toLowerCase()

  if (provider === 'local' || provider === '') {
    // 本地存储：文件已由 multer 写入 uploads/，此处仅返回访问 URL
    return {
      success: true,
      provider: 'local',
      url: `/uploads/${encodeURIComponent(filename)}`,
      key: filename
    }
  }

  if (provider === 'aliyun') {
    const miss = missingFields(cfg, ['region', 'bucket', 'accessKeyId', 'accessKeySecret'])
    if (miss.length) {
      return {
        success: false,
        provider: 'aliyun',
        message: `阿里云 OSS 缺少必要配置: ${miss.join(', ')}，请在管理后台「配置中心 → OSS」填写`
      }
    }
    const OSS = loadOSS()
    if (!OSS) {
      return { success: false, provider: 'aliyun', message: 'ali-oss 未安装，请执行 npm i ali-oss' }
    }
    try {
      const client = new OSS({
        region: cfg.region,
        accessKeyId: cfg.accessKeyId,
        accessKeySecret: cfg.accessKeySecret,
        bucket: cfg.bucket,
        endpoint: cfg.endpoint || undefined,
        secure: true
      })
      const key = `uploads/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${Date.now()}_${filename}`
      const result = await client.put(key, localPath, { mime: mimeType, headers: { 'Content-Type': mimeType } })
      const cdn = cfg.cdnDomain ? String(cfg.cdnDomain).replace(/\/$/, '') : ''
      const url = cdn ? `${cdn}/${key}` : (result && result.url ? result.url : `https://${cfg.bucket}.${cfg.region}.aliyuncs.com/${key}`)
      return { success: true, provider: 'aliyun', url, key }
    } catch (e) {
      return { success: false, provider: 'aliyun', message: `阿里云 OSS 上传失败: ${e.message}` }
    }
  }

  return { success: false, provider, message: `不支持的 OSS 服务商: ${provider}，请使用 local 或 aliyun` }
}

/**
 * 删除文件（幂等）
 */
async function deleteFile(key) {
  if (!key) return { success: true, provider: 'noop' }
  const cfg = await getConfig()
  const provider = (cfg.provider || 'local').trim().toLowerCase()

  if (provider === 'local' || provider === '') {
    try {
      const localPath = path.join(__dirname, '..', '..', 'uploads', path.basename(key))
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath)
      return { success: true, provider: 'local' }
    } catch (e) {
      return { success: false, provider: 'local', message: `本地文件删除失败: ${e.message}` }
    }
  }

  if (provider === 'aliyun') {
    const miss = missingFields(cfg, ['region', 'bucket', 'accessKeyId', 'accessKeySecret'])
    if (miss.length) {
      return { success: false, provider: 'aliyun', message: `阿里云 OSS 缺少配置: ${miss.join(', ')}` }
    }
    const OSS = loadOSS()
    if (!OSS) return { success: false, provider: 'aliyun', message: 'ali-oss 未安装，请执行 npm i ali-oss' }
    try {
      const client = new OSS({
        region: cfg.region,
        accessKeyId: cfg.accessKeyId,
        accessKeySecret: cfg.accessKeySecret,
        bucket: cfg.bucket,
        endpoint: cfg.endpoint || undefined,
        secure: true
      })
      await client.delete(key)
      return { success: true, provider: 'aliyun' }
    } catch (e) {
      return { success: false, provider: 'aliyun', message: `阿里云 OSS 删除失败: ${e.message}` }
    }
  }

  return { success: false, provider, message: `不支持的 OSS 服务商: ${provider}` }
}

async function testConfig() {
  const cfg = await getConfig()
  const provider = (cfg.provider || 'local').trim().toLowerCase()
  if (provider === 'local' || provider === '') {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads')
    try {
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
      const testFile = path.join(uploadDir, '.write_test_' + Date.now())
      fs.writeFileSync(testFile, 'ok')
      fs.unlinkSync(testFile)
      return { success: true, provider: 'local', message: '本地存储校验通过（可读写 uploads/）' }
    } catch (e) {
      return { success: false, provider: 'local', message: `本地存储不可用: ${e.message}` }
    }
  }
  if (provider === 'aliyun') {
    const miss = missingFields(cfg, ['region', 'bucket', 'accessKeyId', 'accessKeySecret'])
    if (miss.length) return { success: false, provider: 'aliyun', message: `缺少配置: ${miss.join(', ')}` }
    if (!loadOSS()) return { success: false, provider: 'aliyun', message: 'ali-oss SDK 未安装: npm i ali-oss' }
    return { success: true, provider: 'aliyun', message: '阿里云 OSS 配置校验通过（仅校验字段/SDK，未真实上传）' }
  }
  return { success: false, provider, message: `不支持的 OSS 服务商: ${provider}` }
}

module.exports = {
  isEnabled: isEnabledAliyun,
  upload,
  deleteFile,
  testConfig,
  validateConfig: (cfg) => {
    const safe = cfg && typeof cfg === 'object' ? cfg : {}
    const providerRaw = typeof safe.provider === 'string' ? safe.provider.trim() : ''
    // ★ 企业级校验规则：
    //   - provider 为空字符串 → 视为"尚未选择服务商"，返回 ok=false，引导用户在配置中心明确选择 local 或 aliyun
    //   - provider=local  → 允许（本地 uploads/，单机生产可用）
    //   - provider=aliyun → 必须补齐 region/bucket/accessKey 等字段
    if (!providerRaw) {
      return {
        ok: false,
        message: 'OSS 服务商未选择，请在管理后台「配置中心 → OSS」明确选择 local 或 aliyun'
      }
    }
    const provider = providerRaw.toLowerCase()
    if (provider === 'local') return { ok: true, provider: 'local', message: '本地存储可用（uploads/ 目录）' }
    if (provider === 'aliyun') {
      const miss = missingFields(safe, ['region', 'bucket', 'accessKeyId', 'accessKeySecret'])
      if (miss.length) return { ok: false, message: `阿里云 OSS 缺少必要配置: ${miss.join(', ')}` }
      return { ok: true, provider: 'aliyun', message: '阿里云 OSS 参数齐全' }
    }
    return { ok: false, message: `不支持的 OSS 服务商: ${provider}，请选择 local 或 aliyun` }
  }
}
