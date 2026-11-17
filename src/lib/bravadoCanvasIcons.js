// Canvas drawing functions for Bravado card icons.
// All icons use a 24-unit viewBox; scale is applied via ctx transform.
// This is the SAME rendering code used for both preview and export —
// the preview draws to a visible canvas, export draws to an offscreen canvas.

const imageCache = new Map();

export const COG_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/e15bebfa25_1e94b3193_cog.png';
export const PAW_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/740f47d844_48d2ad525_flat-paw-print.png';
export const FEATHER_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/c5a8fa7102_0c353004d_feather.png';
export const FISHBONE_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/cb968be8f6_d57b79227_fishbone.png';
export const CREDITS_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/6951112fe6_991bb0389_credits-currency.png';
export const TRAP_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/d5efd0363e_b1df03e39_wolf-trap.png';
export const POINTS_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/1bdf935498_bc1e1c231_desert-skull.png';
export const ANTLER_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/d197fbde0a_83fb3aa53_ChatGPTImageJul25202612_05_19PM.png';
export const FANGS_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/c832b18e13_d5a62eec6_fangs.png';
export const HEART_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/db00af004f_6a4186aed_mineral-heart.png';

export const SUIT_URLS = {
  mask: PAW_URL,
  feather: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/bee0b69322_8c7699d11_feather.png',
  fishbone: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/3c2f78ed88_690719038_fishbone.png',
};

export const SUIT_COLORS = {
  mask: '#76504e',
  feather: '#9400ff',
  fishbone: '#8c0000',
};

export function getCustomIconUrl(type, customIcons = []) {
  if (type && type.startsWith('custom_')) {
    const idx = parseInt(type.slice(7));
    return customIcons[idx]?.url;
  }
  return null;
}

const CARD_TYPES = new Set([
  'num_1','num_2','num_3','num_4','num_5','num_6',
  'arrow_1','arrow_2','arrow_3','arrow_4','arrow_5','equals','blank','plus_card',
  'coin_1','coin_2','coin_3','coin_4','coin_5',
  'mask','feather','fishbone'
]);

// Card icons are taller (aspect 24:30), square icons are 1:1
export function getIconWidth(type, size) {
  if (type && type.startsWith('custom_')) return size;
  if (CARD_TYPES.has(type)) return size * 1.25;
  return size;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Scale to viewBox coordinates, draw, restore
function withScale(ctx, x, y, size, fn) {
  const s = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  fn();
  ctx.restore();
}

function drawCardBg(ctx) {
  ctx.fillStyle = '#fff8e7';
  ctx.strokeStyle = '#3a2a0a';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 1, 1, 22, 28, 3);
  ctx.fill();
  ctx.stroke();
}

function drawNumberCard(ctx, num) {
  drawCardBg(ctx);
  ctx.fillStyle = '#3a2a0a';
  ctx.font = '16px "Rye", cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(num), 12, 21);
}

function getArrowPositions(count) {
  if (count === 1) return [{ cx: 12, top: 8, w: 10, h: 14 }];
  if (count === 2) return [{ cx: 8, top: 10, w: 6, h: 10 }, { cx: 16, top: 10, w: 6, h: 10 }];
  if (count === 3) return [{ cx: 6, top: 11, w: 4.5, h: 8 }, { cx: 12, top: 11, w: 4.5, h: 8 }, { cx: 18, top: 11, w: 4.5, h: 8 }];
  if (count === 4) return [{ cx: 8, top: 7, w: 6, h: 9 }, { cx: 16, top: 7, w: 6, h: 9 }, { cx: 8, top: 17, w: 6, h: 9 }, { cx: 16, top: 17, w: 6, h: 9 }];
  if (count === 5) return [{ cx: 6, top: 7, w: 4.5, h: 8 }, { cx: 12, top: 7, w: 4.5, h: 8 }, { cx: 18, top: 7, w: 4.5, h: 8 }, { cx: 9, top: 17, w: 4.5, h: 8 }, { cx: 15, top: 17, w: 4.5, h: 8 }];
  return [];
}

function drawArrowCard(ctx, count) {
  drawCardBg(ctx);
  ctx.fillStyle = '#3a2a0a';
  for (const a of getArrowPositions(count)) {
    const triH = a.h * 0.4;
    const stemW = a.w * 0.3;
    const stemH = a.h * 0.6;
    ctx.beginPath();
    ctx.moveTo(a.cx, a.top);
    ctx.lineTo(a.cx + a.w / 2, a.top + triH);
    ctx.lineTo(a.cx - a.w / 2, a.top + triH);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(a.cx - stemW / 2, a.top + triH, stemW, stemH);
  }
}

function getCoinPositions(count) {
  if (count === 1) return [{ cx: 12, cy: 15, size: 16 }];
  if (count === 2) return [{ cx: 7, cy: 15, size: 9 }, { cx: 17, cy: 15, size: 9 }];
  if (count === 3) return [{ cx: 6, cy: 15, size: 7 }, { cx: 12, cy: 15, size: 7 }, { cx: 18, cy: 15, size: 7 }];
  if (count === 4) return [{ cx: 7, cy: 9, size: 7 }, { cx: 17, cy: 9, size: 7 }, { cx: 7, cy: 21, size: 7 }, { cx: 17, cy: 21, size: 7 }];
  if (count === 5) return [{ cx: 6, cy: 8, size: 6 }, { cx: 12, cy: 8, size: 6 }, { cx: 18, cy: 8, size: 6 }, { cx: 9, cy: 21, size: 6 }, { cx: 15, cy: 21, size: 6 }];
  return [];
}

function drawCoinCard(ctx, count) {
  drawCardBg(ctx);
  const img = getCachedImage(CREDITS_URL);
  if (!img) return;
  for (const c of getCoinPositions(count)) {
    ctx.drawImage(img, c.cx - c.size / 2, c.cy - c.size / 2, c.size, c.size);
  }
}

function drawCogIcon(ctx) {
  const cx = 12, cy = 12;
  const r = 8, teeth = 8, toothLen = 2.5, toothW = 2.2;
  ctx.fillStyle = '#6b6b6b';
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillRect(-toothW / 2, -(r + toothLen), toothW, toothLen);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff8e7';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawEqualsCard(ctx) {
  drawCardBg(ctx);
  ctx.fillStyle = '#3a2a0a';
  ctx.font = '16px "Rye", cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('=', 12, 20);
}

function drawBlankCard(ctx) {
  drawCardBg(ctx);
}

function drawPlusCard(ctx) {
  drawCardBg(ctx);
  ctx.fillStyle = '#3a2a0a';
  ctx.font = '18px "Rye", cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('+', 12, 21);
}

function drawCoinIcon(ctx) {
  const img = getCachedImage(CREDITS_URL);
  if (img) ctx.drawImage(img, 2, 2, 20, 20);
}

function drawImageResultIcon(ctx, url) {
  const img = getCachedImage(url);
  if (img) ctx.drawImage(img, 0, 0, 24, 24);
}

function drawImageCard(ctx, url) {
  drawCardBg(ctx);
  const img = getCachedImage(url);
  if (img) {
    const size = 20;
    ctx.drawImage(img, (24 - size) / 2, (30 - size) / 2, size, size);
  }
}

const DRAWERS = {
  num_1: (ctx) => drawNumberCard(ctx, 'A'),
  num_2: (ctx) => drawNumberCard(ctx, 2),
  num_3: (ctx) => drawNumberCard(ctx, 3),
  num_4: (ctx) => drawNumberCard(ctx, 4),
  num_5: (ctx) => drawNumberCard(ctx, 5),
  num_6: (ctx) => drawNumberCard(ctx, 6),
  arrow_1: (ctx) => drawArrowCard(ctx, 1),
  arrow_2: (ctx) => drawArrowCard(ctx, 2),
  arrow_3: (ctx) => drawArrowCard(ctx, 3),
  arrow_4: (ctx) => drawArrowCard(ctx, 4),
  arrow_5: (ctx) => drawArrowCard(ctx, 5),
  coin_1: (ctx) => drawCoinCard(ctx, 1),
  coin_2: (ctx) => drawCoinCard(ctx, 2),
  coin_3: (ctx) => drawCoinCard(ctx, 3),
  coin_4: (ctx) => drawCoinCard(ctx, 4),
  coin_5: (ctx) => drawCoinCard(ctx, 5),
  equals: drawEqualsCard,
  blank: drawBlankCard,
  plus_card: drawPlusCard,
  mask: (ctx) => drawImageCard(ctx, PAW_URL),
  feather: (ctx) => drawImageCard(ctx, FEATHER_URL),
  fishbone: (ctx) => drawImageCard(ctx, FISHBONE_URL),
  trap: (ctx) => drawImageResultIcon(ctx, TRAP_URL),
  points: (ctx) => drawImageResultIcon(ctx, POINTS_URL),
  antler: (ctx) => {
    const img = getCachedImage(ANTLER_URL);
    if (img) ctx.drawImage(img, -6, -6, 36, 36);
  },
  heart: (ctx) => drawImageResultIcon(ctx, HEART_URL),
  fangs: (ctx) => drawImageResultIcon(ctx, FANGS_URL),
  coin: drawCoinIcon,
  cog: drawCogIcon,
};

export function drawBravadoIcon(ctx, type, x, y, size, customUrl) {
  if (type && type.startsWith('custom_') && customUrl) {
    const img = imageCache.get(customUrl);
    if (img) ctx.drawImage(img, x, y, size, size);
    return;
  }
  const drawer = DRAWERS[type];
  if (drawer) withScale(ctx, x, y, size, () => drawer(ctx));
}

export async function loadImage(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(url, img); resolve(img); };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function preloadCardImages(data) {
  const urls = [];
  if (data?.imageUrl) urls.push(data.imageUrl);
  if (data?.customIcons) data.customIcons.forEach(ci => urls.push(ci.url));
  if (data?.customStat?.iconUrl) urls.push(data.customStat.iconUrl);
  if (data?.customSuitUrl) urls.push(data.customSuitUrl);
  if (data?.stats) data.stats.forEach(s => { if (s.iconUrl) urls.push(s.iconUrl); });
  if (data?.waresImage) urls.push(data.waresImage);
  if (data?.blocks) {
    for (const b of data.blocks) {
      if (b.type === 'trait' && b.suit && SUIT_URLS[b.suit]) urls.push(SUIT_URLS[b.suit]);
    }
  }
  urls.push(COG_URL, PAW_URL, FEATHER_URL, FISHBONE_URL, CREDITS_URL, TRAP_URL, POINTS_URL, ANTLER_URL, FANGS_URL, HEART_URL);
  if (data?.suit && SUIT_URLS[data.suit]) urls.push(SUIT_URLS[data.suit]);
  await Promise.all(urls.map(loadImage));
}

export function getCachedImage(url) {
  return imageCache.get(url);
}