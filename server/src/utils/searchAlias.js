/*
 * 搜索同义词扩展：游戏/桌游/业务场景常见口语化表达
 * 规范：所有别名均为小写，匹配前统一 normalize；若需扩展，只需往 SYNONYM 里加数组
 */
'use strict'

const SYNONYM_GROUPS = [
  // MOBA / 竞技
  ['英雄联盟', 'league of legends', 'lol', '撸啊撸', '撸', 'LoL', 'LOL'],
  ['王者荣耀', '王者', '王者荣耀手游', '农药', '王荣耀', 'Honor of Kings', 'HOK'],
  ['和平精英', '吃鸡', '和平精英手游', 'pubg mobile', '绝地求生手游', '鸡'],
  ['荒野行动', '荒野', '网易吃鸡'],
  ['永劫无间', '永劫', 'Naraka'],
  ['第五人格', '第五', 'identity v'],
  ['无畏契约', '瓦罗兰特', 'VALORANT', '瓦洛兰特', '瓦'],
  ['英雄联盟手游', 'LOL手游', 'LOL M', 'Wild Rift', 'WR'],
  ['DOTA2', '刀塔2', 'DOTA', '刀塔', 'dota2', 'Dota 2'],
  ['CS2', 'CSGO', 'CS:GO', '反恐精英 2', 'Counter-Strike 2'],

  // 射击 / 生存
  ['穿越火线', 'CF', 'CrossFire', '穿越火线手游', 'CF手游', 'CFM'],
  ['使命召唤手游', 'CODM', 'Call of Duty Mobile', '使命召唤'],
  ['APEX英雄', 'Apex', 'Apex英雄', 'apex legends'],
  ['绝地求生', 'PUBG', 'PlayerUnknown Battlegrounds'],

  // 卡牌 / 二次元
  ['原神', 'Genshin', 'Genshin Impact'],
  ['崩坏：星穹铁道', '星穹铁道', '星铁', 'Honkai: Star Rail', 'HSR'],
  ['崩坏3', '崩3', '崩三', 'Honkai Impact 3rd'],
  ['阴阳师', '网易阴阳师', 'Onmyoji'],
  ['明日方舟', '方舟', 'Arknights', '驴游'],
  ['FGO', 'Fate/Grand Order', '命运-冠位指定', '废狗'],
  ['碧蓝航线', 'Azur Lane', '碧航'],
  ['少女前线', 'Girls Frontline'],
  ['闪耀暖暖', '暖暖'],

  // 休闲 / 音乐
  ['金铲铲之战', '云顶手游', 'TFT Mobile'],
  ['云顶之弈', '云顶', 'TFT'],
  ['QQ飞车手游', 'QQ飞车', '飞车手游'],
  ['QQ炫舞手游', '炫舞', '劲舞手游'],
  ['斗地主', '欢乐斗地主', '斗地主经典'],
  ['麻将', '欢乐麻将', '国标麻将'],
  ['狼人杀', '狼人', 'Werewolf', '网杀'],
  ['剧本杀', '剧本', '剧本推理', '推理馆'],
  ['密室逃脱', '密室', 'Escape Room'],
  ['桌游', '桌面游戏', 'Board Game'],

  // 棋牌 / 线下陪练
  ['台球', '桌球', '斯诺克', 'Snooker', '中式八球'],
  ['网球', 'Tennis'],
  ['羽毛球', '羽球', 'Badminton'],
  ['乒乓球', '乒乓', 'Pingpong'],
  ['游泳', 'Swimming'],
  ['健身', 'Gym', '私教'],
  ['跑步', '慢跑', 'Marathon 陪跑'],

  // 语音 / 陪聊
  ['连麦', '语音连麦', '连麦聊天'],
  ['哄睡', 'ASMR', '耳骚'],
  ['陪看剧', '陪看', '一起看剧'],
  ['陪看电影', '陪看影', '一起看电影'],

  // 平台/职业 俗称
  ['陪玩', '陪练', '游戏陪玩', '游戏陪练'],
  ['技术陪玩', '技术陪', '上分陪玩'],
  ['娱乐陪玩', '娱乐陪', '快乐陪玩'],
  ['大神', '高玩', '高端玩家'],
  ['声优', '声控', '音控']
]

// 构建索引：别名 → 规范名（Canonical）
function buildMap() {
  const map = new Map()
  const canonicalSet = new Set()
  for (const group of SYNONYM_GROUPS) {
    if (!group || !group.length) continue
    const canonical = group[0]
    canonicalSet.add(canonical.toLowerCase())
    for (const alias of group) {
      const key = String(alias).trim().toLowerCase()
      if (!key) continue
      const list = map.get(key) || []
      if (!list.includes(canonical)) list.push(canonical)
      map.set(key, list)
    }
  }
  return { map, canonicalSet }
}

const BUILT = buildMap()

/**
 * 把用户输入展开为一组规范化关键词（原词 + 同义词），用于后端 OR 匹配
 *   示例：keyword='LOL' → ['LOL', '英雄联盟']
 *         keyword='吃鸡上分' → ['吃鸡上分', '和平精英上分']
 * @param {string} keyword
 * @returns {string[]}
 */
function expandAlias(keyword) {
  const raw = String(keyword || '').trim()
  if (!raw) return []
  const low = raw.toLowerCase()
  const out = new Set([raw])
  // 整体命中
  if (BUILT.map.has(low)) {
    for (const c of BUILT.map.get(low)) out.add(c)
  }
  // 分词命中：支持空格/英文标点分词
  const tokens = low.split(/[\s,，。、\/\\#\|~+]+/g).filter(Boolean)
  if (tokens.length > 1) {
    const tokenMap = tokens.map(t => BUILT.map.get(t) || [])
    const canonicals = tokenMap.flat()
    if (canonicals.length) {
      // 把原词中的每个 token 替换为规范名生成新候选
      for (let i = 0; i < tokens.length; i++) {
        const can = BUILT.map.get(tokens[i]) || []
        for (const c of can) {
          const rebuilt = tokens.slice(0, i).concat([c]).concat(tokens.slice(i + 1)).join(' ')
          out.add(rebuilt)
        }
      }
    }
  }
  // 原始词如果本身就是某条 canonical 的前缀，也加入完整 canonical，提高模糊匹配命中率
  for (const canon of BUILT.canonicalSet) {
    if (canon.includes(low) || low.includes(canon)) out.add(canon)
  }
  return Array.from(out)
}

module.exports = {
  expandAlias,
  _groups: SYNONYM_GROUPS
}
