#!/usr/bin/env node
/**
 * SVGA 容器解析（零依赖，只用 node 内置 zlib）
 *
 * 打印 videoSize / fps / frames / 内嵌图片数 / 容器形态。
 * 用途：在跑浏览器抽帧之前先做一轮粗筛，解析不出参数的素材直接淘汰。
 *
 * 用法:
 *   node check.mjs                          # 扫 candidates/ 下全部 .svga
 *   node check.mjs bianbian lvmaozi         # 只看指定几个（省略 .svga 扩展名）
 *   node check.mjs --dir ../../app/src/static/svga
 *   node check.mjs --entries bianbian       # 额外打印 zip 内条目清单
 *
 * 容器形态与 proto 字段编号见同目录 README.md（都是 hex dump 逆出来的，别照直觉改）。
 * 最常见的是 zlib 包裹的裸 protobuf（魔数 78 9c），其次是 ZIP（50 4b 03 04）。
 */
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))

const argv = process.argv.slice(2)
let dir = path.join(here, 'candidates')
const names = []
let showEntries = false
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--dir') dir = path.resolve(here, argv[++i])
  else if (argv[i] === '--entries') showEntries = true
  else names.push(argv[i])
}

// ---------- ZIP ----------
function findEOCD(buf) {
  const lo = Math.max(0, buf.length - 22 - 0xffff)
  for (let i = buf.length - 22; i >= lo; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i
  }
  return -1
}

function readZipEntries(buf) {
  const eocd = findEOCD(buf)
  if (eocd < 0) return null
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const entries = []
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const uncompSize = buf.readUInt32LE(p + 24)
    const nLen = buf.readUInt16LE(p + 28)
    const xLen = buf.readUInt16LE(p + 30)
    const cLen = buf.readUInt16LE(p + 32)
    const lho = buf.readUInt32LE(p + 42)
    entries.push({
      name: buf.toString('utf8', p + 46, p + 46 + nLen),
      method, compSize, uncompSize, lho
    })
    p += 46 + nLen + xLen + cLen
  }
  return entries
}

function readEntryData(buf, e) {
  if (buf.readUInt32LE(e.lho) !== 0x04034b50) throw new Error('bad local header')
  const nLen = buf.readUInt16LE(e.lho + 26)
  const xLen = buf.readUInt16LE(e.lho + 28)
  const start = e.lho + 30 + nLen + xLen
  const raw = buf.subarray(start, start + e.compSize)
  // 0=stored, 8=deflate
  return e.method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw)
}

// ---------- protobuf (只走到能拿到 params / images 计数的深度) ----------
function readVarint(buf, pos) {
  let result = 0n
  let shift = 0n
  let p = pos
  for (;;) {
    if (p >= buf.length) throw new Error('varint overflow')
    const b = buf[p++]
    result |= BigInt(b & 0x7f) << shift
    if (!(b & 0x80)) break
    shift += 7n
  }
  return [result, p]
}

function walkFields(buf, start, end) {
  const out = []
  let p = start
  while (p < end) {
    let key
    ;[key, p] = readVarint(buf, p)
    const fn = Number(key >> 3n)
    const wt = Number(key & 7n)
    if (fn === 0) break
    if (wt === 0) {
      let v
      ;[v, p] = readVarint(buf, p)
      out.push({ fn, wt, value: Number(v) })
    } else if (wt === 1) {
      out.push({ fn, wt, start: p, end: p + 8 })
      p += 8
    } else if (wt === 2) {
      let len
      ;[len, p] = readVarint(buf, p)
      const s = p
      p += Number(len)
      if (p > end) throw new Error('length-delimited overflow')
      out.push({ fn, wt, start: s, end: p })
    } else if (wt === 5) {
      out.push({ fn, wt, start: p, end: p + 4 })
      p += 4
    } else {
      break // 3/4 是已废弃的 group，遇到即认为不是合法 protobuf
    }
  }
  return out
}

/**
 * FileTransfer（SVGA 2.0）实际字段编号 —— 由 inflate 后 hex dump 逆出，不是照文档猜的：
 *   1 = version (string)
 *   2 = params (MovieParams)
 *   3 = images (map<string, bytes>)
 *   4 = sprites (repeated SpriteEntity)
 * MovieParams:
 *   1 = viewBoxWidth (fixed32 float)
 *   2 = viewBoxHeight (fixed32 float)
 *   3 = FPS      — 实测是 varint，不是 float
 *   4 = frames   — varint
 */
function parseFileTransfer(bin) {
  const info = { format: 'protobuf', videoSize: null, fps: null, frames: null, images: 0, sprites: 0, audios: 0, version: '' }
  const num = (f) => (f.wt === 0 ? f.value : f.wt === 5 ? round2(bin.readFloatLE(f.start)) : null)
  for (const f of walkFields(bin, 0, bin.length)) {
    if (f.fn === 1 && f.wt === 2) {
      info.version = bin.toString('utf8', f.start, f.end)
    } else if (f.fn === 2 && f.wt === 2) {
      const p = { width: null, height: null }
      for (const pf of walkFields(bin, f.start, f.end)) {
        const v = num(pf)
        if (pf.fn === 1) p.width = v
        else if (pf.fn === 2) p.height = v
        else if (pf.fn === 3) info.fps = v
        else if (pf.fn === 4) info.frames = v
      }
      info.videoSize = p
    } else if (f.fn === 3 && f.wt === 2) {
      info.images++
    } else if (f.fn === 4 && f.wt === 2) {
      info.sprites++
    }
  }
  return info
}

function round2(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : n
}

/**
 * 按魔数判断外层包装。实测候选池里三种都有：
 *   50 4b 03 04 → ZIP（内含 movie.spec / movie.binary + images/*）
 *   78 01|9c|da → zlib 包裹的裸 protobuf（最常见）
 *   1f 8b       → gzip 包裹的裸 protobuf
 *   其它        → 裸 protobuf
 */
function unwrap(buf) {
  const m0 = buf[0], m1 = buf[1]
  if (m0 === 0x50 && m1 === 0x4b) return { kind: 'zip', body: buf }
  if (m0 === 0x78 && (m1 === 0x01 || m1 === 0x9c || m1 === 0xda)) {
    return { kind: 'zlib+protobuf', body: zlib.inflateSync(buf) }
  }
  if (m0 === 0x1f && m1 === 0x8b) {
    return { kind: 'gzip+protobuf', body: zlib.gunzipSync(buf) }
  }
  return { kind: 'raw-protobuf', body: buf }
}

function inspect(buf) {
  const entries = readZipEntries(buf)
  if (!entries) {
    const { kind, body } = unwrap(buf)
    const info = parseFileTransfer(body)
    info.container = kind
    info.entryNames = []
    return info
  }
  const names = entries.map(e => e.name)
  const specE = entries.find(e => e.name === 'movie.spec')
  const binE = entries.find(e => e.name === 'movie.binary')
  const imageEntries = entries.filter(e => e.name.startsWith('images/') || /^img_/.test(e.name))

  const info = {
    container: binE ? 'zip+movie.binary' : specE ? 'zip+movie.spec' : 'zip(未知)',
    entryNames: names,
    zipImages: imageEntries.length
  }

  if (binE) {
    Object.assign(info, parseFileTransfer(readEntryData(buf, binE)))
    info.container = 'zip+movie.binary'
    // zip 里的图片条目是权威计数，protobuf map 有时只存 key
    if (imageEntries.length) info.images = imageEntries.length
  } else if (specE) {
    // ZIP 形态是 SVGA 1.x，JSON 结构与 2.0 的 protobuf 完全不同：
    //   { ver, movie: { viewBox:{width,height}, fps, frames }, images, sprites, audios }
    const spec = JSON.parse(readEntryData(buf, specE).toString('utf8'))
    info.format = 'json'
    const mv = spec.movie || {}
    info.videoSize = mv.viewBox ? { width: mv.viewBox.width, height: mv.viewBox.height } : null
    info.fps = mv.fps != null ? mv.fps : null
    info.frames = mv.frames != null ? mv.frames : null
    info.sprites = (spec.sprites || []).length
    info.images = imageEntries.length || Object.keys(spec.images || {}).length
    info.audios = (spec.audios || []).length
    info.version = spec.ver || ''
  }
  return info
}

// ---------- main ----------
const files = names.length
  ? names.map(n => path.join(dir, n.endsWith('.svga') ? n : n + '.svga'))
  : fs.readdirSync(dir).filter(f => f.endsWith('.svga')).sort().map(f => path.join(dir, f))

const rows = []
for (const f of files) {
  const base = path.basename(f, '.svga')
  let buf
  try { buf = fs.readFileSync(f) } catch (e) {
    rows.push({ name: base, kb: 0, err: 'read fail: ' + e.code })
    continue
  }
  try {
    const info = inspect(buf)
    rows.push({ name: base, kb: Math.round(buf.length / 1024), ...info })
  } catch (e) {
    rows.push({ name: base, kb: Math.round(buf.length / 1024), err: String(e.message || e) })
  }
}

const W = Math.max(...rows.map(r => r.name.length), 8)
let bad = 0
for (const r of rows) {
  if (r.err) {
    bad++
    console.log(r.name.padEnd(W), `${String(r.kb).padStart(5)}K`, 'PARSE-FAIL', r.err)
    continue
  }
  const vs = r.videoSize ? `${r.videoSize.width}x${r.videoSize.height}` : '?'
  const dur = r.fps && r.frames ? `${Math.round(r.frames / r.fps * 1000)}ms` : '?'
  console.log(
    r.name.padEnd(W),
    `${String(r.kb).padStart(5)}K`,
    r.container.padEnd(16),
    `v=${String(r.version || '-').padEnd(6)}`,
    `size=${vs.padEnd(11)}`,
    `fps=${String(r.fps).padEnd(5)}`,
    `frames=${String(r.frames).padEnd(5)}`,
    `dur=${dur.padEnd(7)}`,
    `img=${String(r.images).padEnd(4)}`,
    `spr=${String(r.sprites).padEnd(4)}`,
    `audio=${r.audios || 0}`
  )
  if (showEntries) console.log(' '.repeat(W + 2), r.entryNames.join(' | '))
}
console.log(`\n${rows.length} 个文件，解析失败 ${bad} 个`)
