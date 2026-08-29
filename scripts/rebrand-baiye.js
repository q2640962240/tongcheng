/**
 * 品牌重命名脚本：把"同城陪伴玩/同城陪伴/伴玩"统一替换为"白夜"
 * 用法:
 *   node scripts/rebrand-baiye.js           执行替换
 *   node scripts/rebrand-baiye.js --check   仅扫描，不修改（输出命中计数）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ONLY_CHECK = process.argv.includes('--check');

const REPLACEMENTS = [
  [/同城陪伴玩 APP/g,   '白夜 App'],
  [/同城陪伴玩/g,       '白夜'],
  [/同城陪伴/g,         '白夜'],
  [/伴玩/g,             '白夜'],
];

// 目标文件（经扫描有实际命中）；脚本/种子数据/unpackage/node_modules 显式排除，以免改到注释或示例
const TARGET_FILES = [
  'README.md',
  'docs/PROJECT.md',
  'docs/PRIVACY-POLICY.md',
  'docs/APP-STORE-CHECKLIST.md',
  'server/src/routes/config.js',
  'app/src/manifest.json',
  'app/src/pages.json',
  'app/src/uni.scss',
  'app/src/pages/home/home.vue',
  'app/src/pages/login/login.vue',
  'app/src/pages/settings/settings.vue',
  'app/src/pages/invite/invite.vue',
  'admin/src/views/login/Login.vue',
  'admin/src/components/Layout.vue',
  'server/data/configs.json',
  // ↓↓ 实际代码与数据中发现的漏网命中
  'admin/src/router/index.js',
  'admin/src/styles/main.scss',
  'admin/index.html',
  'admin/package.json',
  'app/index.html',
  'app/package.json',
  'pages/home.html',
  'scripts/generate-icons.js',
  'scripts/setup-test-accounts.js',
  'server/.env',
  'server/package.json',
  'server/src/config/index.js',
  'server/src/routes/invite.js',
  'server/src/utils/config.js',
  'server/test/e2e.test.js',
  // 运行期 JSON 数据（有昵称/简介等产品文案展示给用户）
  'server/data/admins.json',
  'server/data/configs.json',
  'server/data/feedbacks.json',
  'server/data/invites.json',
  'server/data/messages.json',
  'server/data/orders.json',
  'server/data/services.json',
  'server/data/transactions.json',
  'server/data/users.json',
  'server/data/wallets.json',
];

const SKIP_DIR = new Set(['node_modules', '.git', 'unpackage', 'dist', 'data-test']);

function walk(dir, list = []) {
  if (SKIP_DIR.has(path.basename(dir))) return list;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, list);
    else list.push(p);
  }
  return list;
}

function replaceInContent(text) {
  let out = text;
  for (const [re, to] of REPLACEMENTS) out = out.replace(re, to);
  return out;
}

function countHits(text) {
  let n = 0;
  for (const [re] of REPLACEMENTS) {
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

let totalHits = 0, changedFiles = 0;

// 1) 先跑明确的目标文件
for (const rel of TARGET_FILES) {
  const p = path.resolve(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const text = fs.readFileSync(p, 'utf8');
  const hits = countHits(text);
  totalHits += hits;
  if (hits === 0) continue;
  if (ONLY_CHECK) {
    console.log(`HIT ${hits}  ${rel}`);
    continue;
  }
  const updated = replaceInContent(text);
  if (updated !== text) {
    fs.writeFileSync(p, updated, 'utf8');
    changedFiles++;
    console.log(`✓ replaced ${hits} in ${rel}`);
  }
}

// 2) 对 app/src/pages/admin/src/docs 等前端展示文件补一个"反扫"（确保即使上面列表漏了，也能提示）
//    注意：不修改，只在 --check 时报出，避免误伤其他功能文案（用户确实要显示老品牌才保留）
const SCAN_EXTRA_ROOTS = ['app/src', 'admin/src', 'server/src', 'docs', '.'];
const EXTRA_EXCLUDE = new Set(TARGET_FILES.map(r => path.resolve(ROOT, r).toLowerCase()));
let ghostHits = 0, ghostFiles = 0;
for (const r of SCAN_EXTRA_ROOTS) {
  const base = path.resolve(ROOT, r);
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) continue;
  const files = walk(base);
  for (const p of files) {
    if (EXTRA_EXCLUDE.has(p.toLowerCase())) continue;
    if (!/\.(vue|js|ts|jsx|tsx|scss|css|html|md|json|txt|env)$/i.test(p)) continue;
    // 不读 512KB 以上的
    try { if (fs.statSync(p).size > 512 * 1024) continue; } catch (_) { continue; }
    try {
      const t = fs.readFileSync(p, 'utf8');
      const n = countHits(t);
      if (n > 0) {
        ghostHits += n; ghostFiles++;
        if (ONLY_CHECK) console.log(`GHOST ${n}  ${path.relative(ROOT,p)}`);
      }
    } catch (_) {}
  }
}

console.log('');
console.log(`Total explicit hits: ${totalHits}   changed: ${changedFiles}   (in TARGET_FILES)`);
console.log(`Outside hits:       ${ghostHits}   files:   ${ghostFiles}  (not auto-modified, review manually if needed)`);
if (ONLY_CHECK) {
  console.log(totalHits + ghostHits === 0 ? 'Brand scan clean: 0 occurrences' : `Brand scan: ${totalHits + ghostHits} occurrences remain`);
  process.exit(totalHits + ghostHits === 0 ? 0 : 1);
}
