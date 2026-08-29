import fs from 'fs';
import { parse as acornParse } from 'acorn';
const src = fs.readFileSync('app/src/pages/city/city.vue', 'utf8');
const m = src.match(/<script setup>([\s\S]*?)<\/script>/);
if (!m) { console.log('NO_SCRIPT'); process.exit(1); }
const code = m[1];
try {
  acornParse(code, { sourceType: 'module', ecmaVersion: 2022, allowHashBang: true });
  console.log('SYNTAX_OK bytes=', code.length);
} catch (e) {
  console.log('SYNTAX_ERR line=', e.loc && e.loc.line, 'msg=', e.message);
  // show context
  const lines = code.split('\n');
  for (let i = Math.max(0,(e.loc && e.loc.line || 1)-4); i < Math.min(lines.length,(e.loc && e.loc.line || 1)+3); i++) {
    console.log((i+1) + ': ' + lines[i]);
  }
}
