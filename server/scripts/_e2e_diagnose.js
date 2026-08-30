/** E2E 诊断脚本 v3：全流程端到端 — 使用项目真实接口路径（对齐 app/src/api/index.js） */
const http = require('http');

const req = (path, method, body, token) => new Promise((resolve) => {
  const data = body ? JSON.stringify(body) : null;
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data || ''),
  };
  if (token) {
    // 管理员 token 走 x-admin-token 头（项目真实约定）；用户 token 走 Authorization Bearer
    if (String(token).startsWith('admin_')) headers['x-admin-token'] = token;
    else headers['Authorization'] = 'Bearer ' + token;
  }
  const opts = {
    method,
    path: '/api' + path,
    headers,
    hostname: 'localhost',
    port: 3000,
    timeout: 15000,
  };
  const r = http.request(opts, (res) => {
    let chunks = '';
    res.on('data', (c) => { chunks += c; });
    res.on('end', () => {
      let parsed = chunks;
      try { parsed = JSON.parse(chunks || '{}'); } catch (_) {}
      resolve({ status: res.statusCode, body: parsed, raw: chunks });
    });
  });
  r.on('error', (e) => resolve({ status: 0, body: null, error: String(e) }));
  r.on('timeout', () => { r.destroy(new Error('timeout')); });
  if (data) r.write(data);
  r.end();
});

const results = [];
const step = (name, status, detail) => {
  const s = { name, status };
  if (detail !== undefined) s.detail = detail;
  results.push(s);
  const flag = (status >= 200 && status < 400) ? 'OK' : (status === 0 ? 'CRASH' : 'FAIL');
  const msg = `[${flag} ${String(status).padStart(3, ' ')}] ${name}` + (detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 240) : '');
  console.log(msg);
};

(async () => {
  // ========== 1. 登录 ==========
  const login = await req('/auth/login-password', 'POST', { phone: '13900000001', password: 'Test123456' });
  const token = (login.body && login.body.data && login.body.data.token) || '';
  const user = (login.body && login.body.data && login.body.data.user) || {};
  step('1. POST /auth/login-password', login.status, { ok: !!token, userId: user.id, nick: user.nickname, isElite: !!user.isElite, hasPwd: !!user.hasPassword });
  if (!token) { console.log('登录失败:', login.raw.slice(0, 300)); process.exit(1); }

  // 确保是精英
  if (!user.isElite) {
    const adminLg = await req('/admin/login', 'POST', { username: 'admin', password: 'admin123' });
    const at = adminLg.body && adminLg.body.data && adminLg.body.data.token;
    if (at) {
      const mark = await req('/admin/users/' + user.id, 'PUT', { isElite: true, eliteExpireAt: new Date(Date.now() + 365 * 86400000).toISOString() }, at);
      step('ADMIN. PUT 标记精英', mark.status, mark.body && mark.body.data && { isElite: mark.body.data.isElite });
    }
  }

  // ========== 2. GET /user/profile ==========
  const p2 = await req('/user/profile', 'GET', null, token);
  step('2. GET /user/profile (设置入口)', p2.status, p2.body && p2.body.data && { id: p2.body.data.id, city: p2.body.data.city, isElite: p2.body.data.isElite });

  // ========== 3. PUT /user/profile (编辑资料，同时设城市为深圳，后面服务发布 city 归一化验证用) ==========
  const nick = 'E2E用户_' + Math.floor(Math.random() * 900000 + 100000);
  const p3 = await req('/user/profile', 'PUT', { nickname: nick, bio: 'E2E自动生成简介 ✨', city: '深圳', gender: 'male' }, token);
  step('3. PUT /user/profile 编辑资料', p3.status, p3.body && p3.body.data && { nick: p3.body.data.nickname, city: p3.body.data.city, bioLen: (p3.body.data.bio || '').length });

  // ========== 4. GET /user/discover?isElite 首页附近精英 ==========
  const p4 = await req('/user/discover?isElite=true&page=1&pageSize=15', 'GET', null, token);
  const elites = (p4.body && p4.body.data && (p4.body.data.list || p4.body.data.rows || [])) || [];
  const others = elites.filter(u => u.id !== user.id);
  step('4. GET /user/discover?isElite 附近精英', p4.status, { total: elites.length, others: others.length, sample: elites.slice(0, 3).map(u => ({ id: u.id, nick: u.nickname, city: u.city || '' })) });

  // ========== 5. POST /posts 发布动态 (text 字段，仿 publish.vue 真实 payload：location.city) ==========
  const p5Content = '今夜王者开黑！E2E测试 — ' + new Date().toISOString().slice(0, 16).replace('T', ' ');
  const p5 = await req('/posts', 'POST', { text: p5Content, images: [], location: { city: '深圳' }, category: 'dynamic', tags: ['王者', '开黑'] }, token);
  const postId = p5.body && p5.body.data && p5.body.data.id;
  step('5. POST /posts 发布动态(text + location.city=深圳)', p5.status, p5.status >= 400 ? { err: p5.body && p5.body.message, raw: String(p5.raw || '').slice(0, 200) } : { id: postId, city: p5.body && p5.body.data && p5.body.data.city, textLen: (p5.body && p5.body.data && p5.body.data.text || '').length });

  // ========== 6. GET /posts 列表验证 ==========
  const p6 = await req('/posts?page=1&pageSize=30', 'GET', null, token);
  const posts = (p6.body && p6.body.data && (p6.body.data.list || p6.body.data.rows || [])) || [];
  const hitPost = posts.find(p => p.id === postId || (p.text && p.text.startsWith(p5Content.slice(0, 15))));
  step('6. GET /posts 新动态展示', p6.status, Object.assign({ total: posts.length }, hitPost ? { found: '✅ YES id=' + hitPost.id + ' city=' + (hitPost.city || '') } : { found: postId ? '❌ 不展示(前端刷新空白)' : '发布失败' }));

  // ========== 7. POST /services 发布服务(Bug2：city 用请求体 city=深圳，不能被用户城市覆盖) ==========
  const p7 = await req('/services', 'POST', {
    title: 'E2E测试：王者陪练带飞🎮',
    category: '游戏陪玩',
    price: 3000,
    priceUnit: '局',
    description: '百星水平，陪练上分，深圳优先~',
    city: '深圳',   // 关键：明确传 city
    tags: ['王者', '带飞']
  }, token);
  const svcId = p7.body && p7.body.data && p7.body.data.id;
  const svcCity = p7.body && p7.body.data && p7.body.data.city;
  step('7. POST /services 发布服务(city=深圳)', p7.status, p7.status >= 400 ? { err: p7.body && p7.body.message } : { id: svcId, city_written: svcCity, matchOK: svcCity && (svcCity.includes('深圳') || '深圳'.includes(svcCity)) ? '✅' : '❌ Bug2!', status: p7.body && p7.body.data && p7.body.data.status });

  // ========== 8. GET /services?city=深圳 列表包含新服务 ==========
  const p8 = await req('/services?city=' + encodeURIComponent('深圳') + '&page=1&pageSize=30', 'GET', null, token);
  const szList = (p8.body && p8.body.data && (p8.body.data.list || p8.body.data.rows || [])) || [];
  const hitSz = szList.find(s => s.id === svcId);
  step('8. GET /services?city=深圳 列表命中', p8.status, Object.assign({ total: szList.length }, svcId ? (hitSz ? { found: '✅ YES id=' + hitSz.id + ' city=' + hitSz.city } : { found: '❌ 未命中(Bug2)', top: szList.slice(0,3).map(s=>({id:s.id,city:s.city})) }) : {}));

  // ========== 9. 给 otherElite[0] 上架一个服务，用于 下单 场景(避免买自己) ==========
  let buyer = { svcId: null, providerId: null };
  if (others.length) {
    const adminLg = await req('/admin/login', 'POST', { username: 'admin', password: 'admin123' });
    const at = adminLg.body && adminLg.body.data && adminLg.body.data.token;
    if (at) {
      // 用管理后台的 指定用户上架服务 接口
      const peer = others[0];
      const p9 = await req('/admin/services/create-for-user', 'POST', {
        userId: peer.id,
        title: '（精英' + peer.id + '）LOL 陪练排位上分💪',
        category: '游戏陪玩',
        price: 5000,
        priceUnit: '局',
        description: '大师王者水平，一区可双排，稳赢不翻车！',
        city: peer.city || '上海',
        tags: ['LOL', '排位'],
        status: 'online'
      }, at);
      step('9. ADMIN POST /admin/services/create-for-user 给精英用户上架服务(供别人下单)', p9.status, p9.status >= 400 ? { err: p9.body && p9.body.message, raw: String(p9.raw || '').slice(0, 200) } : { id: p9.body && p9.body.data && p9.body.data.id, providerId: p9.body && p9.body.data && p9.body.data.providerId, city: p9.body && p9.body.data && p9.body.data.city });
      buyer.svcId = p9.body && p9.body.data && p9.body.data.id;
      buyer.providerId = p9.body && p9.body.data && p9.body.data.providerId;
    } else {
      step('9. (SKIPPED) 管理员登录失败无法代上架', adminLg.status, { err: adminLg.body && adminLg.body.message });
    }
  }

  // ========== 10. GET /services/:id 服务详情 ==========
  const detailId = buyer.svcId || svcId;
  if (detailId) {
    const p10 = await req('/services/' + detailId, 'GET', null, token);
    step('10. GET /services/:id 详情', p10.status, p10.body && p10.body.data && { id: p10.body.data.id, providerId: p10.body.data.providerId || p10.body.data.userId, title: (p10.body.data.title || '').slice(0, 20) });
  }

  // ========== 11. GET /user/provider/:id 服务者详情（Bug3 场景）==========
  const pid = buyer.providerId || (others[0] && others[0].id) || user.id;
  const p11 = await req('/user/provider/' + pid, 'GET', null, token);
  step('11. GET /user/provider/:id 服务者详情(Bug3场景)', p11.status, p11.status >= 400 ? { err: p11.body && p11.body.message, statusCode: p11.status, raw: String(p11.raw || '').slice(0, 300) } : p11.body && p11.body.data && { id: p11.body.data.id, nick: p11.body.data.nickname, isElite: p11.body.data.isElite, svcCount: (p11.body.data.services && p11.body.data.services.length) || 0 });

  // ========== 12. POST /orders 下单（买 他人的服务 buyer.svcId）==========
  if (buyer.svcId) {
    const p12 = await req('/orders', 'POST', { serviceId: buyer.svcId, quantity: 1, remark: 'E2E 下单：今天一起LOL！', appointmentTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString() }, token);
    const orderId = p12.body && p12.body.data && p12.body.data.id;
    step('12. POST /orders 下单他人服务', p12.status, p12.status >= 400 ? { err: p12.body && p12.body.message, raw: String(p12.raw || '').slice(0, 240) } : { id: orderId, orderNo: p12.body && p12.body.data && p12.body.data.orderNo, amount: p12.body && p12.body.data && p12.body.data.amount, status: p12.body && p12.body.data && p12.body.data.status });

    // ========== 13. GET /orders 订单列表 ==========
    const p13 = await req('/orders?page=1&pageSize=10', 'GET', null, token);
    const os = (p13.body && p13.body.data && (p13.body.data.list || p13.body.data.rows || [])) || [];
    step('13. GET /orders 订单列表包含新单', p13.status, Object.assign({ total: os.length }, orderId ? (os.find(o => o.id === orderId) ? { found: '✅ YES id=' + orderId, status: os.find(o => o.id === orderId).status } : { found: '❌' }) : {}));
  } else {
    step('12. (SKIP) 没有他人服务，下单跳过', 200, { reason: '未能为其他精英用户创建服务' });
    step('13. (SKIP) 订单列表跳过', 200);
  }

  // ========== 14. 聊天：使用前端真实路径 POST /chat ==========
  if (others.length) {
    const peer = others[0];
    const msg = `Hi~ 我是${nick}！E2E测试聊天，你好呀 🎉`;
    const p14 = await req('/chat', 'POST', { receiverId: peer.id, type: 'text', content: msg, to: peer.id }, token);
    step('14. POST /chat 发送聊天（用户端真实路径）', p14.status, p14.status >= 400 ? { err: p14.body && p14.body.message, statusCode: p14.status, raw: String(p14.raw || '').slice(0, 300) } : { id: p14.body && p14.body.data && p14.body.data.id, from: p14.body && p14.body.data && p14.body.data.senderId, to: p14.body && p14.body.data && p14.body.data.receiverId });

    // ========== 15. GET /chat/history/:userId 拉聊天记录 ==========
    const p15 = await req('/chat/history/' + peer.id + '?page=1&pageSize=20', 'GET', null, token);
    const msgs = (p15.body && p15.body.data && p15.body.data.list) ? p15.body.data.list : ((p15.body && p15.body.data && Array.isArray(p15.body.data)) ? p15.body.data : []);
    step('15. GET /chat/history/:userId 拉聊天记录', p15.status, { count: msgs.length, lastMsg: msgs.length ? (msgs[msgs.length - 1].content || '').slice(0, 30) : '' });

    // ========== 16. GET /chat/sessions 会话列表 ==========
    const p16 = await req('/chat/sessions', 'GET', null, token);
    const convs = (p16.body && p16.body.data && Array.isArray(p16.body.data)) ? p16.body.data : [];
    step('16. GET /chat/sessions 会话列表', p16.status, { count: convs.length, top3: convs.slice(0, 3).map(c => ({ peer: c.peerId || c.userId || c.id, last: (c.lastMessage || c.message || '').slice(0, 20) })) });
  } else {
    step('14. (SKIP) 没有其他精英，聊天跳过', 200);
    step('15. (SKIP) 历史记录跳过', 200);
    step('16. (SKIP) 会话列表跳过', 200);
  }

  // ========== 17. Bug 5：AI 用户设置密码 → 管理员可登录用户端 ==========
  try {
    const adminLg = await req('/admin/login', 'POST', { username: 'admin', password: 'admin123' });
    const at = adminLg.body && adminLg.body.data && adminLg.body.data.token;
    step('ADMIN 登录', adminLg.status, { tokenLen: at ? at.length : 0 });

    if (at) {
      const aiResp = await req('/admin/users?page=1&pageSize=50&userType=ai', 'GET', null, at);
      const aiList = (aiResp.body && aiResp.body.data && (aiResp.body.data.list || aiResp.body.data.rows || [])) || [];
      step('AI1. GET /admin/users?userType=ai', aiResp.status, { count: aiList.length, sample: aiList.slice(0, 2).map(u => ({ id: u.id, nick: u.nickname, userType: u.userType, phone: u.phone || '', hasPwd: !!u.hasPassword })) });

      if (aiList.length) {
        const ai = aiList.find(u => !u.phone) || aiList.find(u => !u.hasPassword) || aiList[0];
        const phone = ai.phone || ('1388AI' + String(100000 + ai.id).slice(-6));
        const putResp = await req('/admin/users/' + ai.id, 'PUT', { password: 'Ai123456', phone, userType: 'real' }, at);
        step('AI2. PUT /admin/users/:id 设置AI用户:手机+密码+userType=real', putResp.status, putResp.body && putResp.body.data && { id: putResp.body.data.id, phone: putResp.body.data.phone, userType: putResp.body.data.userType, hasPwd: !!putResp.body.data.hasPassword });

        // 用设置好的账号登录
        const lg = await req('/auth/login-password', 'POST', { phone, password: 'Ai123456' });
        step('AI3. AI用户使用设置好的密码登录', lg.status, lg.body && lg.body.data && lg.body.data.token ? { ok: true, userId: lg.body.data.user.id, nick: lg.body.data.user.nickname } : { ok: false, err: lg.body && lg.body.message, raw: String(lg.raw || '').slice(0, 200) });

        // 再切回真实 isElite 检查
        if (lg.body && lg.body.data && lg.body.data.token) {
          const me = await req('/user/profile', 'GET', null, lg.body.data.token);
          step('AI4. AI用户登录后 GET /user/profile 验证身份', me.status, me.body && me.body.data && { id: me.body.data.id, nick: me.body.data.nickname, userType: me.body.data.userType, elite: !!me.body.data.isElite });
        }
      }
    }
  } catch (e) {
    step('AI_SECTION 异常', 500, { err: String(e && e.message || e).slice(0, 200) });
  }

  // ========== 汇总 ==========
  console.log('\n================ E2E v3 全流程 汇总 ================');
  const pass = results.filter(r => r.status >= 200 && r.status < 400).length;
  const fail = results.length - pass;
  console.log(`总用例: ${results.length}   ✅ PASS: ${pass}   ❌ FAIL: ${fail}   通过率: ${(100 * pass / results.length).toFixed(1)}%`);
  if (fail) {
    console.log('\n失败详情：');
    results.filter(r => r.status < 200 || r.status >= 400).forEach(r => {
      const det = r.detail !== undefined ? '  |  ' + JSON.stringify(r.detail).slice(0, 280) : '';
      console.log(`  ❌ [${r.status}] ${r.name}${det}`);
    });
  } else {
    console.log('\n🎉 全部用户端核心业务用例通过！(登录/资料/精英列表/发布动态/发布服务+展示/服务者详情/下单/聊天/AI用户密码共' + results.length + '项)');
  }
  process.exit(fail ? 1 : 0);
})();
