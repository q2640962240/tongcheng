/**
 * 礼物特效「已播放」持久化去重。
 *
 * 特效每条礼物只播一次：发送方送出时播、接收方实时到达时播、接收方首次打开会话时
 * 补播最新一条。内存 Set 扛不住刷新/切会话/重启，所以落在本地存储并按用户隔离。
 */
import { getUser } from './auth'

const KEY_PREFIX = 'gift_anim_played_'
const MAX_ENTRIES = 200

let cacheUid = null
let cacheList = []
let cacheSet = new Set()

function currentUid() {
  try {
    const u = getUser()
    return u && u.id ? String(u.id) : 'anon'
  } catch (_) {
    return 'anon'
  }
}

function load(uid) {
  if (cacheUid === uid) return
  cacheUid = uid
  cacheList = []
  cacheSet = new Set()
  try {
    const raw = uni.getStorageSync(KEY_PREFIX + uid)
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(arr)) {
      cacheList = arr.filter((k) => typeof k === 'string').slice(-MAX_ENTRIES)
      cacheSet = new Set(cacheList)
    }
  } catch (_) {}
}

/** 没有可靠标识时返回 true（当作已播），宁可漏播也不要重复播 */
export function isGiftPlayed(key) {
  if (!key) return true
  load(currentUid())
  return cacheSet.has(key)
}

export function markGiftPlayed(key) {
  if (!key) return
  const uid = currentUid()
  load(uid)
  if (cacheSet.has(key)) return
  cacheSet.add(key)
  cacheList.push(key)
  if (cacheList.length > MAX_ENTRIES) cacheList = cacheList.slice(-MAX_ENTRIES)
  try {
    uni.setStorageSync(KEY_PREFIX + uid, JSON.stringify(cacheList))
  } catch (_) {}
}
