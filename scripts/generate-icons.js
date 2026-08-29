/**
 * 生成白夜 APP 打包所需的所有图标 / TabBar / 启动图 PNG 文件
 * 运行: node scripts/generate-icons.js
 * 依赖: pngjs (纯 JS，无需原生编译)
 *
 * 品牌配色（白夜午夜风）:
 *   午夜底色 #0B0F1A · 次夜背景 #141A2D · 表面 #1A2238
 *   金色主色 #D4AF37 · 浅金 #F5D583
 *   极光紫 #7B61FF · 极光粉紫 #B57BFF · 极光冰蓝 #4FB8FF
 *   主文本 #F5F7FF · 次文本 #B7BFDA · 占位 #7E88AA
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require(path.join(__dirname, '..', 'server', 'node_modules', 'pngjs'));

const APP_SRC = path.join(__dirname, '..', 'app', 'src');
const STATIC = path.join(APP_SRC, 'static');
const TAB = path.join(STATIC, 'tab');
const APP_PLUS = path.join(STATIC, 'app-plus');
const ICONS_DIR = path.join(STATIC, 'icons');

[STATIC, TAB, APP_PLUS, ICONS_DIR].forEach(p => fs.mkdirSync(p, { recursive: true }));

/* ----------- 通用工具 ----------- */
function hex(c) {
  c = c.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}
function createPNG(w, h) {
  const p = new PNG({ width: w, height: h, filterType: -1 });
  return { png: p, data: p.data, W: w, H: h };
}
function setPixel(ctx, x, y, colorRGBA) {
  if (x < 0 || y < 0 || x >= ctx.W || y >= ctx.H) return;
  const [r, g, b, a] = colorRGBA;
  const i = (y * ctx.W + x) << 2;
  if (a >= 255) {
    ctx.data[i] = r; ctx.data[i + 1] = g; ctx.data[i + 2] = b; ctx.data[i + 3] = 255;
  } else {
    const dstA = ctx.data[i + 3] / 255;
    const srcA = a / 255;
    const outA = srcA + dstA * (1 - srcA) || 0;
    ctx.data[i]     = Math.round((r * srcA + ctx.data[i]   * dstA * (1 - srcA)) / (outA || 1));
    ctx.data[i + 1] = Math.round((g * srcA + ctx.data[i + 1] * dstA * (1 - srcA)) / (outA || 1));
    ctx.data[i + 2] = Math.round((b * srcA + ctx.data[i + 2] * dstA * (1 - srcA)) / (outA || 1));
    ctx.data[i + 3] = Math.round(outA * 255);
  }
}
function fillRect(ctx, x, y, w, h, colorRGBA) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      setPixel(ctx, x + i, y + j, colorRGBA);
}
function fillRounded(ctx, x, y, w, h, r, colorRGBA) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dx = Math.max(x + r - (x + i), 0, (x + i) - (x + w - 1 - r));
      const dy = Math.max(y + r - (y + j), 0, (y + j) - (y + h - 1 - r));
      if (dx * dx + dy * dy <= r * r) setPixel(ctx, x + i, y + j, colorRGBA);
    }
  }
}
function fillCircle(ctx, cx, cy, radius, colorRGBA) {
  const r2 = radius * radius;
  for (let j = -radius; j <= radius; j++)
    for (let i = -radius; i <= radius; i++)
      if (i * i + j * j <= r2) setPixel(ctx, cx + i, cy + j, colorRGBA);
}
function drawLine(ctx, x1, y1, x2, y2, width, colorRGBA) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);
    fillCircle(ctx, x, y, Math.max(1, Math.round(width / 2)), colorRGBA);
  }
}
function fillGradientVertical(ctx, x, y, w, h, topRGBA, bottomRGBA) {
  for (let j = 0; j < h; j++) {
    const t = h === 0 ? 0 : j / h;
    const r = Math.round(topRGBA[0] + (bottomRGBA[0] - topRGBA[0]) * t);
    const g = Math.round(topRGBA[1] + (bottomRGBA[1] - topRGBA[1]) * t);
    const b = Math.round(topRGBA[2] + (bottomRGBA[2] - topRGBA[2]) * t);
    const a = Math.round(topRGBA[3] + (bottomRGBA[3] - topRGBA[3]) * t);
    fillRect(ctx, x, y + j, w, 1, [r, g, b, a]);
  }
}
/* ----------- 字符绘制（内置像素字体，仅用于 LOGO 简单文字） ----------- */
function drawChar(ctx, char, cx, cy, scale, colorRGBA) {
  const F = {
    'H': ['10001','10001','10001','11111','10001','10001','10001'],
    'P': ['11110','10001','10001','11110','10000','10000','10000'],
    'C': ['01111','10000','10000','10000','10000','10000','01111'],
    'O': ['01110','10001','10001','10001','10001','10001','01110'],
    'M': ['10001','11011','10101','10101','10001','10001','10001'],
    'E': ['11111','10000','10000','11110','10000','10000','11111'],
    'G': ['01111','10000','10000','10111','10001','10001','01111'],
    'A': ['01110','10001','10001','11111','10001','10001','10001'],
    'I': ['11111','00100','00100','00100','00100','00100','11111'],
    'N': ['10001','11001','10101','10011','10001','10001','10001'],
    'U': ['10001','10001','10001','10001','10001','10001','01110'],
    'S': ['01111','10000','10000','01110','00001','00001','11110'],
    'W': ['10001','10001','10001','10001','10101','10101','01010'],
    'Y': ['10001','10001','01010','00100','00100','00100','00100'],
    '★': ['00100','00100','11111','01110','01110','10101','10001'],
    'B': ['11110','10001','10001','11110','10001','10001','11110'],
    'L': ['10000','10000','10000','10000','10000','10000','11111'],
    'V': ['10001','10001','10001','10001','10001','01010','00100'],
    'T': ['11111','00100','00100','00100','00100','00100','00100'],
    'R': ['11110','10001','10001','11110','10100','10010','10001'],
    'D': ['11110','10001','10001','10001','10001','10001','11110'],
    'K': ['10001','10010','10100','11000','10100','10010','10001'],
    'X': ['10001','10001','01010','00100','01010','10001','10001'],
    'Z': ['11111','00001','00010','00100','01000','10000','11111'],
    'F': ['11111','10000','10000','11110','10000','10000','10000'],
    'J': ['00001','00001','00001','00001','10001','10001','01110'],
    'Q': ['01110','10001','10001','10001','10101','10010','01101'],
    '1': ['00100','01100','00100','00100','00100','00100','01110'],
    '2': ['01110','10001','00001','00010','00100','01000','11111'],
    '3': ['11110','00001','00001','01110','00001','00001','11110'],
    '4': ['10010','10010','10010','11111','00010','00010','00010'],
    '5': ['11111','10000','11110','00001','00001','10001','01110'],
    '6': ['01110','10000','10000','01110','10001','10001','01110'],
    '7': ['11111','00001','00010','00100','01000','01000','01000'],
    '8': ['01110','10001','10001','01110','10001','10001','01110'],
    '9': ['01110','10001','10001','01111','00001','00001','01110'],
    '0': ['01110','10001','10001','10001','10001','10001','01110'],
    '¥': ['10001','10001','01010','00100','11111','00100','11111'],
    '/': ['00001','00001','00010','00100','01000','01000','10000'],
    '.': ['00000','00000','00000','00000','00000','00000','00100'],
    '-': ['00000','00000','00000','11111','00000','00000','00000'],
  };
  const c = F[char.toUpperCase()] || F['★'];
  const W = 5, H = 7;
  const ox = cx - (W * scale) / 2;
  const oy = cy - (H * scale) / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (c[y][x] === '1') {
        fillRect(ctx, Math.round(ox + x * scale), Math.round(oy + y * scale), scale, scale, colorRGBA);
      }
    }
  }
}
function drawText(ctx, text, cx, cy, scale, colorRGBA, spacing = 1) {
  const n = text.length;
  const charW = 5 * scale + spacing;
  const totalW = n * charW - spacing;
  let x = cx - totalW / 2;
  for (const ch of text) {
    drawChar(ctx, ch, Math.round(x + (5 * scale) / 2), cy, scale, colorRGBA);
    x += charW;
  }
}
function savePNG(ctx, filePath) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    ctx.png.pack()
      .on('data', c => chunks.push(c))
      .on('end', () => { fs.writeFileSync(filePath, Buffer.concat(chunks)); resolve(); })
      .on('error', reject);
  });
}

/* ----------- 白夜主题色 ----------- */
const NIGHT_0 = [...hex('#0B0F1A'), 255];
const NIGHT_1 = [...hex('#141A2D'), 255];
const NIGHT_2 = [...hex('#1A2238'), 255];
const GOLD = [...hex('#D4AF37'), 255];
const GOLD_SOFT = [...hex('#F5D583'), 255];
const GOLD_DEEP = [...hex('#B8941F'), 255];
const AURORA_PURPLE = [...hex('#7B61FF'), 255];
const AURORA_PINK = [...hex('#B57BFF'), 255];
const AURORA_BLUE = [...hex('#4FB8FF'), 255];
const TEXT_1 = [...hex('#F5F7FF'), 255];
const TEXT_2 = [...hex('#B7BFDA'), 255];
const TEXT_MUTED = [...hex('#7E88AA'), 255];
const WHITE = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];
const ERROR_R = [...hex('#EF4444'), 255];
const SUCCESS_G = [...hex('#22C55E'), 255];

/* ----------- App Logo: 圆角午夜方形 + 大写 B 极光高光 + 星点 ----------- */
function drawAppLogo(ctx) {
  const W = ctx.W, H = ctx.H;
  const r0 = Math.round(W * 0.20);
  // 1) 午夜渐变背景
  fillGradientVertical(ctx, 0, 0, W, H, NIGHT_0, NIGHT_2);
  // 2) 极光条带 (左上 → 右下)
  for (let i = 0; i < Math.round(W * 1.4); i++) {
    const t = i / (W * 1.4);
    const col = t < 0.33 ? AURORA_PURPLE : t < 0.66 ? AURORA_PINK : GOLD;
    const x = Math.round(-W * 0.2 + i);
    const y = Math.round(H * 0.1 + i * 0.62);
    for (let j = -Math.round(H * 0.06); j <= Math.round(H * 0.06); j++) {
      setPixel(ctx, x, y + j, [col[0], col[1], col[2], 46]); // ~18% alpha band
    }
  }
  // 3) 中心金色圆角胶囊 B 形 (两圆 + 一竖 + 内凹)
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  const bodyW = Math.round(W * 0.52), bodyH = Math.round(W * 0.60);
  const roundness = Math.round(bodyH * 0.5);
  // 外轮廓 B
  fillRounded(ctx, cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH, roundness, GOLD);
  // 内挖空 B 的"两个洞"
  const holeR = Math.round(bodyH * 0.17);
  fillCircle(ctx, cx + Math.round(bodyW * 0.05), cy - Math.round(bodyH * 0.22), holeR, NIGHT_1);
  fillCircle(ctx, cx + Math.round(bodyW * 0.05), cy + Math.round(bodyH * 0.22), holeR, NIGHT_1);
  // 左竖挖去一层（让 B 更像 B，视觉竖条存在）
  fillRect(ctx, cx - bodyW / 2, cy - bodyH / 2 + Math.round(bodyH * 0.04), Math.round(bodyW * 0.32), bodyH - Math.round(bodyH * 0.08), NIGHT_1);
  // 4) 高光环（极光圈）
  const ringR = Math.round(W * 0.42);
  for (let i = 0; i < 360; i++) {
    const rad = i * Math.PI / 180;
    const x = Math.round(cx + Math.cos(rad) * ringR);
    const y = Math.round(cy + Math.sin(rad) * ringR);
    const col = i < 120 ? GOLD : i < 240 ? AURORA_PINK : AURORA_PURPLE;
    fillCircle(ctx, x, y, Math.max(1, Math.round(W * 0.008)), [col[0], col[1], col[2], 180]);
  }
  // 5) 星点 (白色微光 4 点)
  [[0.20,0.18],[0.80,0.22],[0.86,0.78],[0.14,0.82],[0.50,0.10]].forEach(([px,py]) => {
    fillCircle(ctx, Math.round(W * px), Math.round(H * py), Math.max(1, Math.round(W * 0.018)), WHITE);
  });
}

/* ----------- TabBar 图标绘制（白夜金色选中 / 占位灰未选中）----------- */

/* home — 屋顶 + 星星 (白夜感) */
function drawHomeIcon(ctx, active) {
  const W = ctx.W, H = ctx.H;
  const col = active ? GOLD : TEXT_MUTED;
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  const s = Math.round(W / 24);
  const topY = cy - 7 * s;
  const left = cx - 8 * s, right = cx + 8 * s;
  // 屋顶
  drawLine(ctx, left, cy - 2 * s, cx, topY, Math.max(3, 4 * s / 3), col);
  drawLine(ctx, cx, topY, right, cy - 2 * s, Math.max(3, 4 * s / 3), col);
  drawLine(ctx, left - s, cy - 2 * s, right + s, cy - 2 * s, 2 * s, col);
  // 主体
  fillRect(ctx, left + s, cy - 2 * s, (right - left) - 2 * s, 8 * s, col);
  // 门洞
  const doorCol = active ? TEXT_1 : [200,200,200,255];
  fillRect(ctx, cx - 2 * s, cy + s, 4 * s, 5 * s, doorCol);
  // 顶部星辰
  fillCircle(ctx, cx, topY - 3 * s, Math.max(1, Math.round(s * 0.7)), active ? GOLD_SOFT : [255,255,255, 80]);
  fillCircle(ctx, cx - 6 * s, topY - s, Math.max(1, Math.round(s * 0.5)), active ? AURORA_PINK : [255,255,255,50]);
  fillCircle(ctx, cx + 6 * s, topY - 2 * s, Math.max(1, Math.round(s * 0.5)), active ? AURORA_BLUE : [255,255,255,50]);
}

/* profile — 头肩造型（白夜女性版） */
function drawProfileIcon(ctx, active) {
  const W = ctx.W, H = ctx.H;
  const col = active ? GOLD : TEXT_MUTED;
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  const s = Math.round(W / 24);
  fillCircle(ctx, cx, cy - 3 * s, 4 * s, col);
  // 肩膀
  const R = 8 * s;
  for (let j = 0; j < 8 * s; j++) {
    const y = cy + 2 * s + j;
    const wHalf = Math.round(Math.sqrt(Math.max(0, R * R - (j - s) * (j - s))));
    fillRect(ctx, cx - wHalf, y, wHalf * 2, 1, col);
  }
  fillRect(ctx, cx - s, cy + 2 * s, 2 * s, 2 * s, active ? TEXT_1 : [200,200,200,255]);
  // 小皇冠（精英暗示）
  if (active) {
    const tY = cy - 9 * s;
    drawLine(ctx, cx - 3 * s, tY, cx - 2 * s, tY - 2 * s, 1 * s, GOLD);
    drawLine(ctx, cx - 2 * s, tY - 2 * s, cx, tY, 1 * s, GOLD);
    drawLine(ctx, cx, tY, cx + 2 * s, tY - 2 * s, 1 * s, GOLD);
    drawLine(ctx, cx + 2 * s, tY - 2 * s, cx + 3 * s, tY, 1 * s, GOLD);
    drawLine(ctx, cx - 3 * s, tY, cx + 3 * s, tY, Math.max(1, Math.round(s * 0.6)), GOLD);
  }
}

/* discover — 指南针/放大镜造型 */
function drawDiscoverIcon(ctx, active) {
  const W = ctx.W, H = ctx.H;
  const col = active ? GOLD : TEXT_MUTED;
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  const s = Math.round(W / 24);
  // 放大镜片
  fillCircle(ctx, cx - 2 * s, cy - 2 * s, 6 * s, col);
  fillCircle(ctx, cx - 2 * s, cy - 2 * s, 4 * s, active ? NIGHT_0 : [0,0,0, 10]);
  // 镜柄（右下斜线）
  drawLine(ctx, cx + 2 * s, cy + 2 * s, cx + 8 * s, cy + 8 * s, 3 * s, col);
  // 星点（发现=星辰）
  fillCircle(ctx, cx - 6 * s, cy + 5 * s, Math.max(1, Math.round(s * 0.5)), active ? AURORA_BLUE : [255,255,255,40]);
  fillCircle(ctx, cx + 4 * s, cy - 8 * s, Math.max(1, Math.round(s * 0.6)), active ? AURORA_PINK : [255,255,255,40]);
}

/* message — 双气泡对话（未选中一个点，选中两个点）*/
function drawMessageIcon(ctx, active) {
  const W = ctx.W, H = ctx.H;
  const col = active ? GOLD : TEXT_MUTED;
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  const s = Math.round(W / 24);
  // 大气泡
  fillRounded(ctx, cx - 9 * s, cy - 7 * s, 18 * s, 11 * s, 4 * s, col);
  // 气泡尾巴
  for (let k = 0; k < 4 * s; k++) {
    setPixel(ctx, cx - 6 * s + k, cy + 4 * s + Math.round(k * 0.45), col);
    setPixel(ctx, cx - 6 * s + k, cy + 4 * s + Math.round(k * 0.45) + 1, col);
  }
  // 小气泡内嵌（对话点）
  const innerCol = active ? TEXT_1 : [200,200,200,255];
  fillRect(ctx, cx - 6 * s, cy - 4 * s, 3 * s, 2 * s, innerCol);
  fillRect(ctx, cx + 1 * s, cy - 4 * s, 5 * s, 2 * s, innerCol);
  fillRect(ctx, cx - 6 * s, cy - 0 * s, 6 * s, 2 * s, innerCol);
  // 未读小红点（选中态才有）
  if (active) {
    fillCircle(ctx, cx + 7 * s, cy - 7 * s, 2 * s, ERROR_R);
    fillRect(ctx, cx + 6 * s, cy - 8 * s, 2 * s, 1 * s, ERROR_R);
  }
}

/* ----------- Splash 启动图（白夜午夜+极光+金色B Logo+文字）----------- */
function drawSplash(ctx, orientation) {
  const W = ctx.W, H = ctx.H;
  // 午夜渐变背景
  fillGradientVertical(ctx, 0, 0, W, H, NIGHT_0, NIGHT_2);
  // 极光条带（两条横斜）
  for (let i = 0; i < Math.round(W * 1.2); i++) {
    const t = i / (W * 1.2);
    const col = t < 0.4 ? AURORA_PURPLE : t < 0.8 ? AURORA_PINK : AURORA_BLUE;
    const x = i;
    const y = Math.round(H * 0.22 + Math.sin((i / W) * Math.PI * 1.1) * H * 0.04 + i * 0.05);
    for (let j = -Math.round(H * 0.06); j <= Math.round(H * 0.06); j++) {
      setPixel(ctx, x, y + j, [col[0], col[1], col[2], 50]);
    }
    const x2 = i;
    const y2 = Math.round(H * 0.82 - i * 0.06);
    for (let j = -Math.round(H * 0.05); j <= Math.round(H * 0.05); j++) {
      setPixel(ctx, x2, y2 + j, [GOLD[0], GOLD[1], GOLD[2], 58]);
    }
  }
  // 星点散布
  const stars = 80;
  for (let i = 0; i < stars; i++) {
    const x = Math.round((i * 137) % W);
    const y = Math.round((i * 997) % H);
    const r = (i % 3) + 1;
    const col = (i % 5 === 0) ? GOLD_SOFT : (i % 7 === 0 ? AURORA_PINK : TEXT_1);
    fillCircle(ctx, x, y, r, [col[0], col[1], col[2], 140]);
  }
  // Logo 圆
  const cx = Math.round(W / 2);
  const cy = Math.round(H * 0.38);
  const logoR = Math.round(Math.min(W, H) * 0.14);
  // 绘制内嵌 Logo（简化版，避免依赖 drawAppLogo 尺寸）
  const mini = createPNG(logoR * 2, logoR * 2);
  const saveBG = NIGHT_0;
  fillGradientVertical(mini, 0, 0, mini.W, mini.H, NIGHT_0, NIGHT_2);
  // 极光条
  for (let i = 0; i < mini.W; i++) {
    const t = i / mini.W;
    const col = t < 0.33 ? AURORA_PURPLE : t < 0.66 ? AURORA_PINK : GOLD;
    const y = Math.round(mini.H * 0.30 + i * 0.55);
    for (let j = -4; j <= 4; j++) setPixel(mini, i, y + j, [col[0], col[1], col[2], 40]);
  }
  // B 字母
  const mcx = Math.round(mini.W / 2), mcy = Math.round(mini.H / 2);
  const bw = Math.round(mini.W * 0.55), bh = Math.round(mini.W * 0.65);
  fillRounded(mini, mcx - bw / 2, mcy - bh / 2, bw, bh, Math.round(bh * 0.5), GOLD);
  const holeR = Math.round(bh * 0.18);
  fillCircle(mini, mcx + Math.round(bw * 0.05), mcy - Math.round(bh * 0.22), holeR, NIGHT_1);
  fillCircle(mini, mcx + Math.round(bw * 0.05), mcy + Math.round(bh * 0.22), holeR, NIGHT_1);
  fillRect(mini, mcx - bw / 2, mcy - bh / 2 + Math.round(bh * 0.04), Math.round(bw * 0.32), bh - Math.round(bh * 0.08), NIGHT_1);
  // 4 角星点
  [[0.18,0.18],[0.82,0.22],[0.84,0.80],[0.16,0.82]].forEach(([px,py]) => {
    fillCircle(mini, Math.round(mini.W * px), Math.round(mini.H * py), 2, TEXT_1);
  });
  // 贴图到 splash 中心
  for (let j = 0; j < mini.H; j++) {
    for (let i = 0; i < mini.W; i++) {
      const sx = cx - logoR + i;
      const sy = cy - logoR + j;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const idx = (j * mini.W + i) << 2;
      const a = mini.data[idx + 3];
      if (!a) continue;
      setPixel(ctx, sx, sy, [mini.data[idx], mini.data[idx+1], mini.data[idx+2], a]);
    }
  }
  // 标题：BAIYE
  const s1 = Math.max(4, Math.round(Math.min(W, H) / 56));
  drawText(ctx, 'BAIYE', cx, cy + logoR + 8 * s1, s1, GOLD, 2);
  // 副标题：白夜 · 陪伴与邀约的夜
  const s2 = Math.max(2, Math.round(s1 * 0.75));
  drawText(ctx, 'BY-BAIYE.ONLINE', cx, cy + logoR + 16 * s1, s2, TEXT_2, 2);
  const s3 = Math.max(2, Math.round(s1 * 0.6));
  drawText(ctx, 'BAN-YE-SOCIAL-APP', cx, cy + logoR + 22 * s1, s3, [126, 136, 170, 180], 2);
}

/* ----------- 任务：生成各资源 ----------- */
async function generateAppIcon(size, filePath) {
  const ctx = createPNG(size, size);
  drawAppLogo(ctx);
  await savePNG(ctx, filePath);
}
function tabDrawer(kind) {
  switch (kind) {
    case 'home':    return drawHomeIcon;
    case 'profile': return drawProfileIcon;
    case 'discover':return drawDiscoverIcon;
    case 'message': return drawMessageIcon;
  }
  return drawHomeIcon;
}
async function generateTabIcon(kind, active, size, filePath) {
  const ctx = createPNG(size, size);
  tabDrawer(kind)(ctx, active);
  await savePNG(ctx, filePath);
}
async function generateSplash(w, h, filePath, orientation) {
  const ctx = createPNG(w, h);
  drawSplash(ctx, orientation);
  await savePNG(ctx, filePath);
}

/* 命令行参数：--check 检查 manifest 声明的资源是否全存在 */
function checkManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(APP_SRC, 'manifest.json'), 'utf8'));
  const paths = new Set();
  function push(p) { if (p && typeof p === 'string' && p.startsWith('static/')) paths.add(path.resolve(APP_SRC, p.replace('static/', STATIC + path.sep).replace(/\//g, path.sep))); }

  push(manifest.iconPath);
  (manifest.icons || []).forEach(i => push(i.src));
  (manifest.tabBar && manifest.tabBar.list || []).forEach(t => { push(t.iconPath); push(t.selectedIconPath); });
  const d = manifest.distribute || {};
  (d.appPlus || []);
  const ap = d.appPlus || {};
  (ap.icons || []).forEach(i => push(i.src));
  const ss = ap.splashscreen || {};
  (ss.static && ss.static.iOS && ss.static.iOS.images || []).forEach(i => push(i));
  (ss.static && ss.static.android && ss.static.android.images || []).forEach(i => push(i));
  // manifest 常用 icon 字段路径（HBuilderX 不会全声明在数组里）
  ['static/app-plus/icon.png','static/app-plus/icon-48.png','static/app-plus/icon-72.png','static/app-plus/icon-96.png',
   'static/app-plus/icon-128.png','static/app-plus/icon-144.png','static/app-plus/icon-180.png','static/app-plus/icon-192.png',
   'static/app-plus/icon-256.png','static/app-plus/icon-512.png','static/app-plus/icon-1024.png',
   'static/app-plus/splash.png',
   'static/app-plus/splash-720x1280.png','static/app-plus/splash-1080x1920.png','static/app-plus/splash-1280x720.png',
   'static/app-plus/splash-750x1334.png','static/app-plus/splash-828x1792.png',
   'static/app-plus/splash-1125x2436.png','static/app-plus/splash-1242x2688.png',
   'static/favicon.png','static/icons/icon-192.png','static/icons/icon-512.png','static/logo.png'].forEach(push);

  let ok = 0, miss = 0;
  for (const p of [...paths].sort()) {
    if (fs.existsSync(p)) { ok++; console.log('OK ' + path.relative(APP_SRC, p)); }
    else { miss++; console.log('MISS ' + path.relative(APP_SRC, p)); }
  }
  console.log('\nManifest resource check: ' + ok + ' OK, ' + miss + ' missing (declared paths=' + paths.size + ')');
  process.exit(miss === 0 ? 0 : 1);
}

(async () => {
  if (process.argv.includes('--check')) { checkManifest(); return; }

  // 1) 主图标
  await generateAppIcon(512, path.join(STATIC, 'logo.png'));

  // 2) App-Plus 多尺寸
  const iconSizes = [48, 72, 96, 128, 144, 192, 256, 512, 1024];
  for (const sz of iconSizes) await generateAppIcon(sz, path.join(APP_PLUS, `icon-${sz}.png`));
  await generateAppIcon(72, path.join(APP_PLUS, 'icon.png'));
  await generateAppIcon(180, path.join(APP_PLUS, 'icon-180.png'));
  await generateAppIcon(1024, path.join(APP_PLUS, 'icon-1024.png'));

  // 3) TabBar (4×2) — 白夜 4 Tab
  const TAB_SZ = 81;
  for (const [k, f] of [
    ['home', 'home'], ['home-active','home'],
    ['discover', 'discover'], ['discover-active','discover'],
    ['message', 'message'], ['message-active','message'],
    ['profile', 'profile'], ['profile-active','profile'],
  ]) {
    const active = k.endsWith('-active');
    await generateTabIcon(f, active, TAB_SZ, path.join(TAB, k + '.png'));
  }

  // 4) 启动图 Splash (HBuilderX 标准尺寸)
  await generateSplash(720, 1280, path.join(APP_PLUS, 'splash-720x1280.png'), 'portrait');
  await generateSplash(1080, 1920, path.join(APP_PLUS, 'splash-1080x1920.png'), 'portrait');
  await generateSplash(1280, 720, path.join(APP_PLUS, 'splash-1280x720.png'), 'landscape');
  await generateSplash(750, 1334, path.join(APP_PLUS, 'splash-750x1334.png'), 'portrait');
  await generateSplash(828, 1792, path.join(APP_PLUS, 'splash-828x1792.png'), 'portrait');
  await generateSplash(1125, 2436, path.join(APP_PLUS, 'splash-1125x2436.png'), 'portrait');
  await generateSplash(1242, 2688, path.join(APP_PLUS, 'splash-1242x2688.png'), 'portrait');
  await generateSplash(720, 1280, path.join(APP_PLUS, 'splash.png'), 'portrait');

  // 5) H5 favicon / PWA
  await generateAppIcon(64,  path.join(STATIC, 'favicon.png'));
  await generateAppIcon(192, path.join(ICONS_DIR, 'icon-192.png'));
  await generateAppIcon(512, path.join(ICONS_DIR, 'icon-512.png'));

  console.log('✅ 白夜主题图标/启动图已生成到: ' + STATIC);
})().catch(err => { console.error('❌ 生成失败:', err); process.exit(1); });
