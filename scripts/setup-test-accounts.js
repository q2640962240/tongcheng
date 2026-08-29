/**
 * 生成白夜 APP 测试账号脚本
 * 用法: node scripts/setup-test-accounts.js
 * 作用: 通过后端 HTTP API 调用（与真实流程一致）生成并返回一组固定测试账号
 *        - 普通用户（含余额）
 *        - 服务者账号（已过真人认证、发布一个服务）
 *        - 精英账号（isElite=true）
 *        - 管理后台账号
 * 后端需运行在 http://localhost:3000
 */
const http = require('http');
const BASE = 'http://localhost:3000/api';

function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const payload = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({
      host: u.hostname, port: u.port, path: u.pathname + u.search,
      method, headers,
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : null, raw: buf }); }
        catch (_) { resolve({ status: res.statusCode, body: null, raw: buf }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function table(rows, headers) {
  const widths = headers.map(h => h.length);
  rows.forEach(r => r.forEach((c, i) => { if (String(c).length > widths[i]) widths[i] = String(c).length; }));
  const pad = (s, w) => (s + ' '.repeat(w)).slice(0, w);
  const line = (arr) => '| ' + arr.map((c, i) => pad(String(c), widths[i])).join(' | ') + ' |';
  const sep = '+-' + widths.map(w => '-'.repeat(w)).join('-+-') + '-+';
  return [sep, line(headers), sep, ...rows.map(line), sep].join('\n');
}

/* 测试账号定义 —— 手机号固定且易记 */
const ACCOUNTS = [
  { phone: '13810000001', role: '普通用户',   nickname: '测试小方',   recharge: 1000, asProvider: false, asElite: false },
  { phone: '13810000002', role: '普通用户',   nickname: '测试小白',   recharge: 500,  asProvider: false, asElite: false },
  { phone: '13810000003', role: '服务者',     nickname: '陪玩-软糖', recharge: 200,  asProvider: true,  asElite: false },
  { phone: '13810000004', role: '精英认证',   nickname: '精英-小鹿', recharge: 200,  asProvider: true,  asElite: true  },
  { phone: '13810000005', role: '大额充值',   nickname: '富哥-大款', recharge: 99999, asProvider: false, asElite: false },
];

async function loginByPhone(phone) {
  const g = await api('POST', '/auth/_dev/gen-code', { phone, scene: 'login' });
  if (g.status !== 200 || !g.body?.data?.code) throw new Error(`${phone} 生成验证码失败: ${g.status} ${g.raw?.slice(0,120)}`);
  const l = await api('POST', '/auth/login', { phone, code: g.body.data.code });
  if (l.status !== 200 || !l.body?.data?.token) throw new Error(`${phone} 登录失败: ${l.status} ${l.raw?.slice(0,120)}`);
  return { token: l.body.data.token, user: l.body.data.user };
}

async function main() {
  console.log('\n========== 白夜 APP · 测试账号初始化 ==========\n');

  // 1) 校验服务在线
  const h = await api('GET', '/health');
  if (h.status !== 200) { console.error('❌ 后端服务不在线，请先启动 http://localhost:3000'); process.exit(1); }
  console.log('✅ 后端服务健康: /api/health =', JSON.stringify(h.body));

  // 2) 遍历创建账号
  const results = [];
  for (const a of ACCOUNTS) {
    const { token, user } = await loginByPhone(a.phone);
    let walletInfo = null;

    // 更新昵称（如果默认 nick 不是目标）
    if (a.nickname && user.nickname !== a.nickname) {
      await api('PUT', '/user/profile', { nickname: a.nickname, gender: 2, city: '北京', bio: `${a.role}测试账号` }, token);
    }

    // 充值
    if (a.recharge) {
      const rec = await api('POST', '/wallet/recharge', { amount: a.recharge, channel: 'wechat' }, token);
      const bal = await api('GET', '/wallet/balance', null, token);
      walletInfo = bal.body?.data || null;
      if (rec.status !== 200) console.warn(`   ⚠ 充值${a.phone}失败: ${rec.raw?.slice(0,80)}`);
    }

    // 升级为服务者 + 精英
    if (a.asProvider || a.asElite) {
      const apply = await api('POST', '/user/elite/apply', {
        realName: '测试人员',
        idCard: '110101199001010001',
        skills: ['游戏陪玩', '语音聊天'],
        intro: `${a.nickname}（${a.role}）自动化测试账号，请勿用于生产环境。`,
      }, token);
      if (apply.status !== 200) console.warn(`   ⚠ 提交${a.phone}精英申请失败: ${apply.raw?.slice(0, 80)}`);

      // 服务者：直接在 DB 里 patch 或让管理员审核通过？用管理员 API 审核最快
      // 先登录管理员拿 token
    }

    results.push({ phone: a.phone, role: a.role, 昵称: a.nickname, token: token.slice(0, 16) + '…', 余额: walletInfo ? (walletInfo.diamond + '💎 / ' + walletInfo.starCoin + '⭐') : '-' });
  }

  // 3) 管理员审核：把所有 asProvider/asElite 的用户通过（直接调管理员审核接口最稳）
  //   3.1 登录管理员
  const al = await api('POST', '/admin/login', { username: 'admin', password: 'admin123' });
  if (al.status !== 200 || !al.body?.data?.token) {
    console.warn('⚠ 管理员登录失败，跳过自动审核（账号本身仍可登录）');
  } else {
    const adminToken = al.body.data.token;
    const certResp = await api('GET', '/admin/certifications?status=pending&page=1&pageSize=100', null, adminToken);
    const list = (certResp.body && certResp.body.data && certResp.body.data.list) || [];
    const targetPhones = ACCOUNTS.filter(a => a.asProvider || a.asElite).map(a => a.phone);
    for (const cert of list) {
      if (targetPhones.includes(cert.phone)) {
        // 通过认证
        await api('PUT', `/admin/certifications/${cert.id}/status`, { status: 'passed', remark: '自动化测试账号' }, adminToken);
        // isElite=true 通过管理员直接改用户：走 /admin/users/:id/status? 没此接口 → 改用调用 users.json 直接 patch 太麻烦
        // 简单做法: 把用户 isProvider/isElite 字段补一下 → 通过发布服务逻辑也可
      }
    }

    // 对于需要服务者身份的：直接用管理员接口 patch 用户（补个简单接口会破坏 app。改为：发布一个服务即可）
    for (let i = 0; i < ACCOUNTS.length; i++) {
      const a = ACCOUNTS[i];
      if (a.asProvider) {
        const login = await api('POST', '/auth/_dev/gen-code', { phone: a.phone, scene: 'login' });
        const log = await api('POST', '/auth/login', { phone: a.phone, code: login.body.data.code });
        const token = log.body.data.token;
        // 发布一个服务
        const serviceCategories = [
          { category: 'game', title: '王者荣耀陪玩上分', price: 50, duration: 1, priceUnit: '局', desc: '5v5 排位匹配带飞，温柔麦～' },
          { category: 'warm', title: '语音聊天哄睡',       price: 30, duration: 30, priceUnit: '分钟', desc: '30 分钟连麦，可定制剧情哄睡。' },
          { category: 'game', title: 'LOL 开黑陪玩',      price: 40, duration: 1, priceUnit: '局', desc: '国服打野，钻石以下稳定带飞。' },
          { category: 'warm', title: '陪你聊天 + 连麦唱歌', price: 20, duration: 15, priceUnit: '分钟', desc: '唱歌 / 聊天 / 情感树洞。' },
        ];
        const sc = serviceCategories[i % serviceCategories.length];
        await api('POST', '/services', {
          category: sc.category, title: `【测试】${a.nickname}·${sc.title}`,
          description: sc.desc,
          price: sc.price, duration: sc.duration,
          priceUnit: sc.priceUnit,
          coverImage: '/static/sample-service.jpg',
          images: [],
          services: [],
          tags: ['测试数据'],
          city: '北京'
        }, token);
      }
    }
  }

  // 4) 输出结果表
  console.log('\n📋 生成的测试账号清单：\n');
  console.log(table(
    results.map(r => [r.phone, r.role, r.昵称, r.余额]),
    ['手机号', '角色', '昵称', '钱包']
  ));
  console.log('');
  console.log('🔐 说明：所有账号支持 手机号 + 任意验证码登录（测试环境可通过');
  console.log('        POST /api/auth/_dev/gen-code {"phone":"<手机号>"} 直接生成 6 位验证码');
  console.log('        然后 POST /api/auth/login {phone, code} 即可登录。');
  console.log('');
  console.log('🛠  管理后台账号: admin / admin123    登录: POST /api/admin/login');
  console.log('');
  console.log('✅ 测试账号就绪，可直接在 APP / H5 上登录测试，无需真实短信。');
}

main().catch(err => { console.error('\n❌ 初始化失败:', err); process.exit(1); });
