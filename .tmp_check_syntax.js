const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('app/src/pages/city/city.vue', 'utf8');
const m = src.match(/<script setup>([\s\S]*?)<\/script>/);
if (!m) { console.log('NO_SCRIPT'); process.exit(1); }
const code = m[1];
try {
  new vm.Script(code, { filename: 'city-vue-check.mjs' });
  console.log('SYNTAX_OK bytes=', code.length);
} catch (e) {
  console.log('SYNTAX_ERR', e.message, 'stack=', (e.stack||'').split('\n').slice(0,5).join('\n'));
}
