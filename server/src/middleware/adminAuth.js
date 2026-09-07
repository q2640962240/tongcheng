const jwt = require('jsonwebtoken')
const config = require('../config')
const { fail } = require('../utils/response')

/**
 * 管理后台鉴权 —— 全站唯一实现。
 *
 * 原先有四份各自的弱副本（admin.js / config.js / im.js / banners.js），其中三份
 * 只检查 token 是否以 'admin_' 开头、连库都不查，而 /admin/login 签发的就是明文
 * `'admin_' + admin.id`。任意人发一个 `x-admin-token: admin_1` 就能拿到整个管理面。
 * 2026-09-08 公网实测：连 `admin_99999`（一个根本不存在的 id）都返回 200，
 * 可读到全部用户手机号、明文阿里云 AccessKeySecret 与腾讯 IM secretKey，
 * 且 34 个写端点（封号/调余额/审批提现/退款/改配置中心/删内容）全部敞开。
 *
 * 签名密钥必须是**独立的** `ADMIN_JWT_SECRET`：
 *   - 不能复用 `config.jwt.secret` —— 否则任何普通登录用户的 JWT 都能直接当管理员令牌用；
 *   - 也**不能由它派生** —— 2026-09-08 实测发现线上 `JWT_SECRET` 与仓库公开串逐字节相同，
 *     派生式 `${jwt.secret}::baiye-admin` 任何读过仓库的人都算得出来，等于没修。
 * 所以生产环境拿不到合格的 `ADMIN_JWT_SECRET` 时一律 **fail closed**（管理接口全 503），
 * 只有非生产环境才用派生值图省事。`config/index.js` 的 `assertProdSecrets()` 会同时打 WARN。
 *
 * 「拿不到合格值」包含照抄 `.env.example` 的公开占位串 —— 那种串长度够、看着像配好了，
 * 但任何读过仓库的人都能拿它签管理员令牌，危害和缺失一样，所以走同一套 `isWeakSecret()` 判定。
 */
const RAW_ADMIN_SECRET = String(process.env.ADMIN_JWT_SECRET || '').trim()
const ADMIN_SECRET = (() => {
  if (config.isProd) return config.isWeakSecret(RAW_ADMIN_SECRET) ? null : RAW_ADMIN_SECRET
  return RAW_ADMIN_SECRET || `${config.jwt.secret}::baiye-admin`
})()
const ADMIN_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '12h'

/** 管理密钥是否可用；登录端点据此返回 503 而不是 500 */
const adminSecretMissing = () => !ADMIN_SECRET

const signAdminToken = (adminId) => {
  if (!ADMIN_SECRET) throw new Error('ADMIN_JWT_SECRET 未配置，无法签发管理员令牌')
  return jwt.sign({ id: Number(adminId), type: 'admin' }, ADMIN_SECRET, { expiresIn: ADMIN_EXPIRES_IN })
}

const adminAuth = async (req, res, next) => {
  if (!ADMIN_SECRET) return fail(res, '服务端未配置管理密钥，管理后台暂不可用', 503)

  const token = req.headers['x-admin-token']
  if (!token) return fail(res, '请先登录', 401)

  let payload
  try {
    payload = jwt.verify(token, ADMIN_SECRET)
  } catch (e) {
    return fail(res, '管理员登录已过期，请重新登录', 401)
  }
  // type 是纵深防御：万一将来两个 secret 被配成同一个，用户 token 也不能越权
  if (!payload || payload.type !== 'admin' || !payload.id) {
    return fail(res, '管理员令牌无效', 401)
  }

  try {
    const { Admin } = require('../models')
    // JSON 存储驱动（本地开发）下模型不是 Sequelize Model、没有 findByPk。
    // 签名校验已经是安全边界，查库只是纵深防御（拦掉已被删除的管理员）
    if (Admin && typeof Admin.findByPk === 'function') {
      const admin = await Admin.findByPk(payload.id)
      if (!admin) return fail(res, '管理员不存在', 401)
      req.adminRole = admin.role
    }
  } catch (e) {
    // 查不动就拒绝，安全中间件必须 fail closed
    return fail(res, '管理员校验失败，请重新登录', 401)
  }

  req.adminId = payload.id
  next()
}

module.exports = { adminAuth, signAdminToken, adminSecretMissing, ADMIN_EXPIRES_IN }
