/**
 * 敏感词过滤（30+ 常见违规词正则黑名单）
 * 注意：仅做发布场景的初级防御，生产环境建议接入专业云安全产品。
 */
const PATTERNS = [
  // 政治敏感
  /法轮|法沦|flg|焚身|天安门.*自焚/i,
  /台独|藏独|疆独|港独|东突厥|反共|反华/i,
  // 暴恐 / 军事极端
  /isil|isis|基地组织|塔利班|人肉炸弹|自杀袭击/i,
  /枪支|毒品|海洛因|可卡因|大麻|摇头丸|冰毒|k粉|白粉/i,
  // 色情 / 招嫖
  /约炮|一夜情|援交|外围|上门|包养|学生妹|处女摸|自慰|淫|嫖娼|骚逼|色情视频|av|色欲|苍井空|波多野结衣|无码|有码|三级片/i,
  /加.*微信.*约|vx.*(可约|福利)|扣扣.*同城|小姐|按摩.*全套|莞式/i,
  // 违法欺诈
  /办证|刻章|假钞|发票|赌博|六合彩|澳门赌场|大发快三|时时彩|黑彩|传销|直销|裸贷|私贷/i,
  // 人身攻击
  /傻逼|sb|草泥马|nmsl|狗娘养|杂种|智障|废物|去死|奸杀|分尸|碎尸|自杀.*(指南|方法|教程)/i,
  // 广告 / 非法招聘
  /刷单|兼.*职.*日结|手工活外发|传销直销|零投资.*高回报/i,
  // 其他平台违规（屏蔽竞争/诱导）
  /(加|添|微).{0,2}(信|V|Q|扣|vx|qq).{0,3}\d{5,}/i,   // 留号（不做强拦截：仅提示或后置审核）
]

/** 白名单：避免误杀产品名 */
const WHITELIST_PATTERNS = [/白夜/i, /baiye/i, /精英/i]

function stripWhitelist(text) {
  let t = text
  WHITELIST_PATTERNS.forEach(p => { t = t.replace(p, '***ok***') })
  return t
}

/** 返回命中的第一个敏感词（字符串模式表示），未命中返回 null */
function detect(text) {
  if (!text || typeof text !== 'string') return null
  const t = stripWhitelist(text)
  for (const p of PATTERNS) {
    if (p.test(t)) return String(p).replace(/[\/\\^$.*+?()[\]{}|]/g, '').slice(0, 40)
  }
  return null
}

/** 若含敏感词则抛错；否则返回原文本 */
function ensureClean(text, field = '内容') {
  const hit = detect(text)
  if (hit) {
    const err = new Error(`${field} 包含违规内容，请修改后重新发布`)
    err.code = 422
    err.hit = hit
    throw err
  }
  return text
}

module.exports = { PATTERNS, WHITELIST_PATTERNS, detect, ensureClean }
