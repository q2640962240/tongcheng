/**
 * 本地静态服务 + 抽帧落盘端点（零依赖）
 *
 *   node server.mjs          # http://127.0.0.1:8899
 *
 * 服务根是**仓库根目录**，这样 extract.html 既能取到
 * `scripts/svga-toolchain/candidates/*.svga`，也能直接加载 App 运行时真正在用的
 * `app/src/static/lib/svga.min.js`（不要复制一份，否则测的就不是线上那个播放器了）。
 *
 * 页面:
 *   /scripts/svga-toolchain/test.html      播放自检
 *   /scripts/svga-toolchain/extract.html   抽帧 / 生成图标
 *
 * 抽帧结果写到 scripts/svga-toolchain/out/（已 gitignore）。
 */
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const outDir = path.join(here, 'out')
fs.mkdirSync(outDir, { recursive: true })

const PORT = Number(process.env.PORT || 8899)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.svga': 'application/octet-stream',
  '.png': 'image/png',
  '.json': 'application/json',
  '.css': 'text/css'
}

// 服务根是整个仓库，必须挡住密钥类文件；只监听 127.0.0.1，但别指望这一点就够了
const DENY = [/(^|\/)\.env(\.|$)/, /(^|\/)\.git\//, /\.(pem|key|p12|pfx|keystore)$/i, /(^|\/)node_modules\//]

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0])

  if (req.method === 'POST' && urlPath === '/__svga_save') {
    let body = ''
    req.on('data', c => { body += c; if (body.length > 40e6) req.destroy() })
    req.on('end', () => {
      try {
        const { name, dataUrl } = JSON.parse(body)
        // 只允许平铺在 out/ 下的安全文件名，杜绝 ../ 穿越
        if (!/^[A-Za-z0-9_.@-]{1,96}$/.test(name) || name.includes('..')) throw new Error('bad name')
        const b64 = String(dataUrl).split(',')[1]
        if (!b64) throw new Error('bad dataUrl')
        const buf = Buffer.from(b64, 'base64')
        fs.writeFileSync(path.join(outDir, name.endsWith('.png') ? name : name + '.png'), buf)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, name, bytes: buf.length }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, err: String(e && e.message || e) }))
      }
    })
    return
  }

  const rel = urlPath.replace(/^\/+/, '') || 'scripts/svga-toolchain/test.html'
  const file = path.resolve(repoRoot, rel)
  if (file !== repoRoot && !file.startsWith(repoRoot + path.sep)) {
    res.writeHead(403); return res.end('forbidden')
  }
  if (DENY.some(re => re.test(rel))) {
    res.writeHead(403); return res.end('forbidden')
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found') }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    })
    res.end(buf)
  })
}).listen(PORT, '127.0.0.1', () => {
  console.log(`listening http://127.0.0.1:${PORT}`)
  console.log(`  test    http://127.0.0.1:${PORT}/scripts/svga-toolchain/test.html`)
  console.log(`  extract http://127.0.0.1:${PORT}/scripts/svga-toolchain/extract.html`)
  console.log(`  out     ${outDir}`)
})
