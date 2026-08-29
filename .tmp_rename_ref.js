const fs = require('fs')
const f = 'app/src/pages/city/city.vue'
let s = fs.readFileSync(f, 'utf8')
const start = s.indexOf('<script setup>')
const end = s.indexOf('</script>', start)
if (start < 0 || end < 0) { console.log('no script'); process.exit(1) }
const head = s.substring(0, start)
const script = s.substring(start, end)
const tail = s.substring(end)

// 只在 <script setup> 内部替换（避免改 <template> 内的字符串或 class 引用）
function repl(code) {
  let c = 0
  // \bref( —— 不能匹配 computed / refresh 等前缀
  code = code.replace(/(^|[^\w$])ref\s*\(/g, (_, pre) => { c++; return pre + '_ref(' })
  console.log('repl ref:', c)
  let c2 = 0
  code = code.replace(/(^|[^\w$])computed\s*\(/g, (_, pre) => { c2++; return pre + '_computed(' })
  console.log('repl computed:', c2)
  let c3 = 0
  code = code.replace(/(^|[^\w$])onMounted\s*\(/g, (_, pre) => { c3++; return pre + '_onMounted(' })
  console.log('repl onMounted:', c3)
  return code
}
const newScript = repl(script)
fs.writeFileSync(f, head + newScript + tail)
console.log('done')
