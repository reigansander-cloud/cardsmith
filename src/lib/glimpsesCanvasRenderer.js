// Glimpses card rendering pipeline.
// Two banner assets:
//   - Frame (bfd3d83eb_Template.png): header/footer stone + a shield banner
//     (x60..186, y195..400, tapering to a point at y400). Always drawn.
//   - Number banner (Template 1): transparent canvas with a tall stone banner
//     (x60..187, y185..590). Only drawn when an icon is selected, so the bottom
//     banner (y400..590) provides a surface for the icon. When no icon, only the
//     frame's shield is visible (no number banner at all).
// Layer order: artwork -> number banner (if icon) -> frame (with shield) ->
// banner number -> icon (clipped to bottom banner) -> title -> rules.
// The same draw function is used for the preview canvas AND the export canvas.

import { loadImage, getCachedImage } from './domCardCanvasRenderer';

const GEORGIA = 'Georgia, "Times New Roman", serif';
const CASLON = '"Adobe Caslon Pro", Georgia, "Times New Roman", serif';
const INLINE_ICON_SCALE = 1.25;

const FRAME_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/9f102a48d9_bfd3d83eb_Template.png';
const BANNER_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/db9035f7f4_26132645d_Template2.png';

const TP_W = 614;
const TP_H = 1024;

// Stone panel boundaries (Template 2 frame):
//   header stone y0..180 (opaque, feathered to ~218)
//   transparent center y218..735
//   footer stone y780..1023 (opaque, feathered from ~735)
const HEADER_H = 180;
const FOOTER_TOP = 808;   // scooted down slightly, center + top aligned
const FOOTER_H = TP_H - FOOTER_TOP;

// Bottom banner (number banner's lower portion, y400..590): wide at top (x60..187),
// tapering to a point at (123, 590). The icon is clipped to this shape. The bottom
// banner is hidden (cropped from the number banner) when no icon is selected.
const BOTTOM_BANNER_POINTS = [
  { x: 60, y: 400 },   // top-left
  { x: 187, y: 400 },  // top-right
  { x: 186, y: 490 },  // right (taper start)
  { x: 123, y: 590 },  // bottom point
  { x: 61, y: 490 },   // left (taper start)
];

// Banner number: centered on the shield's upper portion.
const NUM_CX = 123;
const NUM_CY = 258;

// Icon: on the bottom banner, moved down, clipped to the bottom banner shape.
const ICON_BOX = { x: 78, y: 410, w: 90, h: 90 };

// Default icons that should be rendered slightly smaller than the rest.
// Icon 3 (eye) stays at full size; the other three defaults are shrunk.
const SHRUNK_ICON_URLS = [
  'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/bf77aa7260_193d28fa7_ICON4.png', // crown
  'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/013d958c4c_cff2c146b_ICON2.png', // hourglass
  'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/43a81f84a9_865386231_ICON1.png', // pillar
];

// Default icon name → URL mapping (for inline footer icons and doc text shortcuts).
const DEFAULT_ICON_MAP = {
  crown: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/bf77aa7260_193d28fa7_ICON4.png',
  eye: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/f86b9ae102_8b7c641d4_ICON3.png',
  hourglass: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/013d958c4c_cff2c146b_ICON2.png',
  pillar: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/43a81f84a9_865386231_ICON1.png',
};

function resolveIconRef(ref) {
  return DEFAULT_ICON_MAP[ref] || ref;
}

function parseIconRefs(text) {
  const refs = [];
  const regex = /\[icon:([^\]]+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) refs.push(match[1]);
  return refs;
}

// Third banner (for the second banner icon): the bottom tapered portion of the
// number banner, drawn again lower on the card.
const BANNER2_Y_OFFSET = 190;
const BANNER2_EXTEND = 100; // extend third banner upward so it tucks under the second
const BOTTOM_BANNER2_POINTS = BOTTOM_BANNER_POINTS.map(p => ({ x: p.x, y: p.y + BANNER2_Y_OFFSET }));

// Title / footer text boxes.
const TITLE_X = 49;
const TITLE_W = 516;
const FOOTER_X = 49;
const FOOTER_W = 516;

let frameImg = null;
let frameDims = { w: TP_W, h: TP_H };
let bannerImg = null;
let bannerDims = { w: TP_W, h: TP_H };

export async function preloadGlimpsesImages(data) {
  if (!frameImg) {
    frameImg = await loadImage(FRAME_URL);
    if (frameImg) frameDims = { w: frameImg.naturalWidth || frameImg.width, h: frameImg.naturalHeight || frameImg.height };
  }
  if (!bannerImg) {
    bannerImg = await loadImage(BANNER_URL);
    if (bannerImg) bannerDims = { w: bannerImg.naturalWidth || bannerImg.width, h: bannerImg.naturalHeight || bannerImg.height };
  }
  const urls = [];
  if (data?.bannerIconUrl || data?.bannerIcon2Url) urls.push(BANNER_URL);
  if (data?.artUrl) urls.push(data.artUrl);
  if (data?.bannerIconUrl) urls.push(data.bannerIconUrl);
  if (data?.bannerIcon2Url) urls.push(data.bannerIcon2Url);
  if (data?.footerText) {
    for (const ref of parseIconRefs(data.footerText)) {
      const url = resolveIconRef(ref);
      if (url) urls.push(url);
    }
  }
  if (data?.footerText2) {
    for (const ref of parseIconRefs(data.footerText2)) {
      const url = resolveIconRef(ref);
      if (url) urls.push(url);
    }
  }
  await Promise.all(urls.map(loadImage));
}

export function getGlimpsesFrameDims() {
  return frameDims;
}

// ============ Drawing helpers ============

function setLetterSpacing(ctx, v) { try { ctx.letterSpacing = v; } catch { /* unsupported */ } }
function resetLetterSpacing(ctx) { try { ctx.letterSpacing = '0px'; } catch { /* unsupported */ } }

function drawImageCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawImageContain(ctx, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function clipBottomBanner(ctx, sx, sy) {
  ctx.beginPath();
  ctx.moveTo(BOTTOM_BANNER_POINTS[0].x * sx, BOTTOM_BANNER_POINTS[0].y * sy);
  for (let i = 1; i < BOTTOM_BANNER_POINTS.length; i++) {
    ctx.lineTo(BOTTOM_BANNER_POINTS[i].x * sx, BOTTOM_BANNER_POINTS[i].y * sy);
  }
  ctx.closePath();
  ctx.clip();
}

function clipBottomBanner2(ctx, sx, sy) {
  ctx.beginPath();
  ctx.moveTo(BOTTOM_BANNER2_POINTS[0].x * sx, BOTTOM_BANNER2_POINTS[0].y * sy);
  for (let i = 1; i < BOTTOM_BANNER2_POINTS.length; i++) {
    ctx.lineTo(BOTTOM_BANNER2_POINTS[i].x * sx, BOTTOM_BANNER2_POINTS[i].y * sy);
  }
  ctx.closePath();
  ctx.clip();
}

function wrapLines(ctx, words, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Engraved stone lettering: dark shadow on the top-left wall of the carve, light
// highlight on the bottom-right wall, dark fill at the bottom of the carve.
// More intense bevel so the letters read as deeply cut into the stone.
function drawEngravedLine(ctx, text, cx, cy, font, align) {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.50)';
  ctx.fillText(text, cx - 1, cy - 1);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(text, cx + 1, cy + 1);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(text, cx, cy);
}

// Auto-shrinking engraved text block.
// align: 'center' | 'left'  ·  vAlign: 'center' | 'top'
function drawEngravedBlock(ctx, text, x, y, w, h, maxFont, minFont, maxLines, letterSpacing, align, vAlign) {
  if (!text) return;
  setLetterSpacing(ctx, `${letterSpacing}px`);
  const words = String(text).split(/\s+/).filter(Boolean);
  let best = null;
  for (let fs = maxFont; fs >= minFont; fs -= 0.5) {
    const font = `bold ${fs}px ${GEORGIA}`;
    ctx.font = font;
    const lineHeight = fs * 1.12;
    const lines = wrapLines(ctx, words, w);
    if (lines.length <= maxLines && lines.length * lineHeight <= h) {
      best = { font, lines, lineHeight, totalH: lines.length * lineHeight };
      break;
    }
  }
  if (!best) {
    const fs = minFont;
    const font = `bold ${fs}px ${GEORGIA}`;
    ctx.font = font;
    const lines = wrapLines(ctx, words, w).slice(0, maxLines);
    const lineHeight = fs * 1.12;
    best = { font, lines, lineHeight, totalH: lines.length * lineHeight };
  }
  let cy;
  if (vAlign === 'top') {
    cy = y + best.lineHeight / 2;
  } else {
    cy = y + (h - best.totalH) / 2 + best.lineHeight / 2;
  }
  for (const line of best.lines) {
    const lx = align === 'left' ? x : x + w / 2;
    drawEngravedLine(ctx, line, lx, cy, best.font, align);
    cy += best.lineHeight;
  }
  resetLetterSpacing(ctx);
}

// ============ Inline icon text rendering (footer rules) ============

function parseInlineTokens(text) {
  const result = [];
  const regex = /\[icon:([^\]]+)\]/g;
  let lastIndex = 0;
  let match;
  const pushTextWords = (str) => {
    const segments = str.split('\n');
    segments.forEach((seg, i) => {
      if (i > 0) result.push({ type: 'newline' });
      seg.split(/\s+/).filter(Boolean)
        .forEach(w => result.push({ type: 'text', value: w }));
    });
  };
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushTextWords(text.slice(lastIndex, match.index));
    }
    result.push({ type: 'icon', ref: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    pushTextWords(text.slice(lastIndex));
  }
  return result;
}

function wrapInlineTokens(ctx, tokens, maxWidth, fontSize) {
  const spaceW = ctx.measureText(' ').width;
  const lines = [];
  let line = [];
  let lineWidth = 0;
  for (const token of tokens) {
    if (token.type === 'newline') {
      lines.push(line);
      line = [];
      lineWidth = 0;
      continue;
    }
    const tw = token.type === 'icon' ? fontSize * INLINE_ICON_SCALE : ctx.measureText(token.value).width;
    const add = (line.length > 0 ? spaceW : 0) + tw;
    if (lineWidth + add > maxWidth && line.length > 0) {
      lines.push(line);
      line = [token];
      lineWidth = tw;
    } else {
      line.push(token);
      lineWidth += add;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

function drawInlineLine(ctx, line, x, cy, w, fontSize, font, align) {
  ctx.font = font;
  const spaceW = ctx.measureText(' ').width;
  let totalW = 0;
  for (let i = 0; i < line.length; i++) {
    if (i > 0) totalW += spaceW;
    totalW += line[i].type === 'icon' ? fontSize * INLINE_ICON_SCALE : ctx.measureText(line[i].value).width;
  }
  let cx = align === 'left' ? x : x + (w - totalW) / 2;
  for (let i = 0; i < line.length; i++) {
    if (i > 0) cx += spaceW;
    const token = line[i];
    if (token.type === 'icon') {
      const iconSize = fontSize * INLINE_ICON_SCALE;
      const url = resolveIconRef(token.ref);
      const img = url ? getCachedImage(url) : null;
      if (img) drawImageContain(ctx, img, cx, cy - iconSize / 2, iconSize, iconSize);
      cx += iconSize;
    } else {
      drawEngravedLine(ctx, token.value, cx, cy, font, 'left');
      cx += ctx.measureText(token.value).width;
    }
  }
}

function drawEngravedDivider(ctx, x, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.50)';
  ctx.fillRect(x, y - 1, w, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y + 1, w, 1);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x, y, w, 1);
}

function drawEngravedBlockWithIcons(ctx, text, x, y, w, h, maxFont, minFont, maxLines, letterSpacing, align, vAlign) {
  if (!text) return 0;
  const tokens = parseInlineTokens(text);
  if (tokens.length === 0) return 0;
  setLetterSpacing(ctx, `${letterSpacing}px`);
  let best = null;
  for (let fs = maxFont; fs >= minFont; fs -= 0.5) {
    const font = `bold ${fs}px ${GEORGIA}`;
    ctx.font = font;
    const lineHeight = fs * 1.12;
    const lines = wrapInlineTokens(ctx, tokens, w, fs);
    if (lines.length <= maxLines && lines.length * lineHeight <= h) {
      best = { font, lines, lineHeight, totalH: lines.length * lineHeight, fs };
      break;
    }
  }
  if (!best) {
    const fs = minFont;
    const font = `bold ${fs}px ${GEORGIA}`;
    ctx.font = font;
    const lines = wrapInlineTokens(ctx, tokens, w, fs).slice(0, maxLines);
    const lineHeight = fs * 1.12;
    best = { font, lines, lineHeight, totalH: lines.length * lineHeight, fs };
  }
  let cy;
  if (vAlign === 'top') {
    cy = y + best.lineHeight / 2;
  } else {
    cy = y + (h - best.totalH) / 2 + best.lineHeight / 2;
  }
  for (const line of best.lines) {
    drawInlineLine(ctx, line, x, cy, w, best.fs, best.font, align);
    cy += best.lineHeight;
  }
  resetLetterSpacing(ctx);
  return best.totalH;
}

// Banner number: no bevel, just a faint drop shadow + dark fill.
function drawNumberWithShadow(ctx, text, cx, cy, maxFont, minFont, maxWidth, letterSpacing) {
  setLetterSpacing(ctx, `${letterSpacing}px`);
  let font = `italic bold ${maxFont}px ${CASLON}`;
  for (let fs = maxFont; fs >= minFont; fs -= 0.5) {
    font = `italic bold ${fs}px ${CASLON}`;
    ctx.font = font;
    if (ctx.measureText(String(text)).width <= maxWidth) break;
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a2a2a';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillText(String(text), cx, cy);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  resetLetterSpacing(ctx);
}

// ============ Card renderer ============

export function drawGlimpsesCard(ctx, data, w, h) {
  const { title = '', bannerNumber = '', bannerIconUrl = '', bannerIcon2Url = '', artUrl = '', footerText = '', footerText2 = '', textless = false } = data || {};

  const sx = w / TP_W;
  const sy = h / TP_H;

  // 1. Main artwork — between the stone sections. In textless mode, extends to
  //    the bottom of the card (no footer stone).
  if (artUrl) {
    const img = getCachedImage(artUrl);
    if (img) {
      const artH = textless ? (TP_H - 180) : 600;
      drawImageCover(ctx, img, 0, 180 * sy, w, artH * sy);
    }
  }

  // 2. Third banner segment — drawn when the second icon is selected, BEFORE the
  //     number banner so it appears to go under it. Crops an extended portion of
  //     the number banner (starting higher up) and redraws it lower on the card.
  const numBanner = getCachedImage(BANNER_URL);
  if (numBanner && bannerIcon2Url) {
    const bsx = bannerDims.w / TP_W;
    const bsy = bannerDims.h / TP_H;
    const srcY = 400 - BANNER2_EXTEND;
    const srcH = 190 + BANNER2_EXTEND;
    const dstY = (400 + BANNER2_Y_OFFSET) - BANNER2_EXTEND;
    ctx.drawImage(
      numBanner,
      60 * bsx, srcY * bsy, 127 * bsx, srcH * bsy,
      60 * sx, dstY * sy, 127 * sx, srcH * sy
    );
  }

  // 2b. Number banner (Template 1) — drawn when the first icon is selected, on
  //     top of the third banner so the third banner tucks under it.
  if (numBanner && bannerIconUrl) {
    ctx.drawImage(numBanner, 0, 0, w, h);
  }

  // 3. Frame (Template 2) — header/footer stone + shield. In textless mode, crop
  //    to hide the footer stone so artwork extends to the bottom.
  const frame = getCachedImage(FRAME_URL);
  if (frame) {
    if (textless) {
      const cropY = 512;
      const fsy = frameDims.h / TP_H;
      ctx.drawImage(frame, 0, 0, frameDims.w, cropY * fsy, 0, 0, w, cropY * sy);
    } else {
      ctx.drawImage(frame, 0, 0, w, h);
    }
  }

  // 4. First icon — on the bottom banner, clipped to its shape.
  //    Three of the four default icons are shrunk slightly; icon 3 (eye) is full size.
  if (bannerIconUrl) {
    const iconImg = getCachedImage(bannerIconUrl);
    if (iconImg) {
      const isShrunk = SHRUNK_ICON_URLS.includes(bannerIconUrl);
      const iconW = isShrunk ? 80 : ICON_BOX.w;
      const iconX = 123 - iconW / 2;
      const iconY = 455 - iconW / 2;
      ctx.save();
      clipBottomBanner(ctx, sx, sy);
      drawImageContain(ctx, iconImg, iconX * sx, iconY * sy, iconW * sx, iconW * sy);
      ctx.restore();
    }
  }

  // 4b. Second icon — on the third banner, clipped to its shape.
  if (bannerIcon2Url) {
    const iconImg = getCachedImage(bannerIcon2Url);
    if (iconImg) {
      const isShrunk = SHRUNK_ICON_URLS.includes(bannerIcon2Url);
      const iconW = isShrunk ? 80 : ICON_BOX.w;
      const iconX = 123 - iconW / 2;
      const iconY = (455 + BANNER2_Y_OFFSET) - iconW / 2;
      ctx.save();
      clipBottomBanner2(ctx, sx, sy);
      drawImageContain(ctx, iconImg, iconX * sx, iconY * sy, iconW * sx, iconW * sy);
      ctx.restore();
    }
  }

  // 5. Banner number — faint shadow, lighter grey, on the shield's upper portion.
  if (bannerNumber) {
    drawNumberWithShadow(ctx, bannerNumber, NUM_CX * sx, NUM_CY * sy, 96 * sy, 40 * sy, 70 * sx, -0.5);
  }

  // 6. Title — vertically & horizontally centered in the top stone panel.
  drawEngravedBlock(ctx, title, TITLE_X * sx, 0, TITLE_W * sx, HEADER_H * sy, 44 * sy, 24 * sy, 2, -0.5, 'center', 'center');

  // 7. Rules text — centered, top-aligned in the bottom stone panel. Skipped in
  //    textless mode. Supports inline [icon:name] tokens rendered at text size.
  if (!textless) {
    if (footerText2) {
      const section1MaxH = FOOTER_H * 0.6;
      const section1H = drawEngravedBlockWithIcons(ctx, footerText, FOOTER_X * sx, FOOTER_TOP * sy, FOOTER_W * sx, section1MaxH * sy, 32 * sy, 16 * sy, 5, -0.3, 'center', 'top') || 0;
      const dividerY = FOOTER_TOP + section1H / sy + 5;
      const section2Y = dividerY + 5;
      const section2H = TP_H - section2Y;
      drawEngravedDivider(ctx, FOOTER_X * sx, dividerY * sy, FOOTER_W * sx);
      drawEngravedBlockWithIcons(ctx, footerText2, FOOTER_X * sx, section2Y * sy, FOOTER_W * sx, section2H * sy, 32 * sy, 16 * sy, 5, -0.3, 'center', 'top');
    } else {
      drawEngravedBlockWithIcons(ctx, footerText, FOOTER_X * sx, FOOTER_TOP * sy, FOOTER_W * sx, FOOTER_H * sy, 32 * sy, 16 * sy, 5, -0.3, 'center', 'top');
    }
  }
}

// ============ Export entry point ============

export async function renderGlimpsesToCanvas(data, scale = 2) {
  await document.fonts.ready;
  await preloadGlimpsesImages(data);
  const { w, h } = getGlimpsesFrameDims();

  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  drawGlimpsesCard(ctx, data, w, h);
  return canvas;
}