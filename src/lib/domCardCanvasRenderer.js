// Canvas-native rendering pipeline for the three DOM-origin templates:
// simple_text, clans, and tactical (Towers).
// The same draw functions are used for the visible preview canvas AND the
// offscreen export canvas — guaranteeing identical pixels (like Bravado).

import { GRID_SYMBOLS } from '@/lib/gridSymbols';
import { CARD_ICONS, ATTRIBUTE_ICONS, getIconByKey } from '@/lib/cardIcons';
import { drawCardBackground } from '@/lib/canvasBg';
import { base44 } from '@/api/base44Client';

const INTER = '"Inter", sans-serif';
const CAESAR = '"CaesarDressing", serif';
const ALBERT = "'Albert Sans', sans-serif";

const COLOR_MAP = {
  default: '#000000', black: '#000000', red: '#c0392b', blue: '#2471a3',
  green: '#1e8449', gold: '#b7950b', purple: '#7d3c98', brown: '#6e3b1e', orange: '#e67e22'
};

const NUMBER_COLORS = {
  black: '#1a0e00', red: '#c0392b', blue: '#2471a3', green: '#1e8449',
  gold: '#b7950b', purple: '#7d3c98', brown: '#6e3b1e', orange: '#e67e22'
};

// ============ Image cache ============

const imageCache = new Map();
let costSymbolMap = {};
let costSymbolsLoaded = false;
const gridSymbolImages = {};
const attrIconImages = {};
let gridSymbolsLoaded = false;
let attrIconsLoaded = false;
let cardIconsLoaded = false;

export async function loadImage(url) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(url, img); resolve(img); };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function getCachedImage(url) {
  return url ? imageCache.get(url) : null;
}

async function loadSvgAsImage(svgString, key, target) {
  const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
  const img = await loadImage(dataUrl);
  if (img) target[key] = img;
}

async function preloadCostSymbols() {
  if (costSymbolsLoaded) return;
  try {
    const list = await base44.entities.CostSymbol.list();
    const map = {};
    list.forEach(s => { map[s.name] = s.url; });
    costSymbolMap = map;
    await Promise.all(Object.values(map).map(loadImage));
  } catch { /* ignore */ }
  costSymbolsLoaded = true;
}

async function preloadGridSymbols() {
  if (gridSymbolsLoaded) return;
  await Promise.all(GRID_SYMBOLS.filter(s => s.key !== 'empty').map(async sym => {
    const inner = sym.render(64).replace(/currentColor/g, '#1a0e00');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${inner}</svg>`;
    await loadSvgAsImage(svg, sym.key, gridSymbolImages);
  }));
  gridSymbolsLoaded = true;
}

async function preloadAttrIcons() {
  if (attrIconsLoaded) return;
  await Promise.all(ATTRIBUTE_ICONS.map(async icon => {
    const colored = icon.svg.replace(/currentColor/g, '#000000');
    const svg = colored.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"');
    await loadSvgAsImage(svg, icon.key, attrIconImages);
  }));
  attrIconsLoaded = true;
}

async function preloadCardIcons() {
  if (cardIconsLoaded) return;
  await Promise.all(CARD_ICONS.map(i => loadImage(i.url)));
  cardIconsLoaded = true;
}

export async function preloadDomCardImages(data) {
  await Promise.all([preloadCostSymbols(), preloadGridSymbols(), preloadAttrIcons(), preloadCardIcons()]);
  const urls = [];
  if (data?.artUrl) urls.push(data.artUrl);
  if (data?.iconKey && /^https?:\/\//.test(data.iconKey)) urls.push(data.iconKey);
  if (data?.attributes) data.attributes.forEach(a => { if (a.customIconUrl) urls.push(a.customIconUrl); });
  if (data?.costSymbols) data.costSymbols.forEach(cs => { if (cs.url) urls.push(cs.url); });
  await Promise.all(urls.map(loadImage));
}

// Allow IconManager uploads to refresh the symbol cache
export function refreshCostSymbols() {
  costSymbolsLoaded = false;
  costSymbolMap = {};
}

// ============ Helpers ============

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function getFontString(size, bold, italic, family = INTER) {
  const parts = [];
  if (italic) parts.push('italic');
  if (bold) parts.push('bold');
  parts.push(`${size}px ${family}`);
  return parts.join(' ');
}

// ============ Rich text parsing (colors, icons, bold, italic, newlines) ============

function parseRichText(text, iconSize) {
  if (!text) return [];
  const elements = [];
  const regex = /(\[color:(\w+)\]|\[\/color\]|\[icon:([^\]]+)\]|\*\*[^*]+\*\*|_[^_]+_|\n)/g;
  let lastIndex = 0;
  let match;
  let currentColor = null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push({ type: 'text', value: text.slice(lastIndex, match.index), color: currentColor });
    }
    const token = match[0];
    if (token.startsWith('[color:')) {
      currentColor = COLOR_MAP[match[2]] || '#000000';
    } else if (token === '[/color]') {
      currentColor = null;
    } else if (token.startsWith('[icon:')) {
      const name = match[3];
      const url = costSymbolMap[name];
      if (url) elements.push({ type: 'icon', url, size: iconSize });
    } else if (token.startsWith('**') && token.endsWith('**')) {
      elements.push({ type: 'text', value: token.slice(2, -2), bold: true, color: currentColor });
    } else if (token.startsWith('_') && token.endsWith('_') && token.length > 2) {
      elements.push({ type: 'text', value: token.slice(1, -1), italic: true, color: currentColor });
    } else if (token === '\n') {
      elements.push({ type: 'newline' });
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    elements.push({ type: 'text', value: text.slice(lastIndex), color: currentColor });
  }
  return elements;
}

function layoutRichText(ctx, elements, fontSize, maxWidth, iconSize, lineHeight, family = INTER, coloredFamily = null) {
  const lines = [];
  let line = [];
  let lineWidth = 0;
  let totalHeight = 0;

  function pushLine() {
    lines.push({ items: line, height: lineHeight });
    totalHeight += lineHeight;
    line = [];
    lineWidth = 0;
  }

  for (const el of elements) {
    if (el.type === 'newline') { pushLine(); continue; }
    if (el.type === 'icon') {
      const iw = el.size;
      if (lineWidth + iw > maxWidth && line.length > 0) pushLine();
      line.push({ ...el, width: iw });
      lineWidth += iw;
      continue;
    }
    const itemFamily = (el.color && coloredFamily) ? coloredFamily : family;
    ctx.font = getFontString(fontSize, el.bold, el.italic, itemFamily);
    const parts = el.value.split(/(\s+)/).filter(p => p !== '');
    for (const part of parts) {
      const pw = ctx.measureText(part).width;
      if (lineWidth + pw > maxWidth && line.length > 0) pushLine();
      line.push({ type: 'text', value: part, width: pw, color: el.color, bold: el.bold, italic: el.italic });
      lineWidth += pw;
    }
  }
  if (line.length > 0) pushLine();
  return { lines, totalHeight };
}

function drawRichText(ctx, layout, x, y, maxWidth, fontSize, align, family = INTER, coloredFamily = null) {
  let currentY = y;
  for (const lineObj of layout.lines) {
    const line = lineObj.items;
    if (line.length === 0) { currentY += lineObj.height; continue; }
    let lineWidth = 0;
    for (const item of line) lineWidth += item.width;
    let cx;
    if (align === 'center') cx = x + (maxWidth - lineWidth) / 2;
    else if (align === 'right') cx = x + maxWidth - lineWidth;
    else cx = x;
    const lineCenterY = currentY + lineObj.height / 2;
    for (const item of line) {
      if (item.type === 'icon') {
        const img = getCachedImage(item.url);
        if (img) ctx.drawImage(img, cx, lineCenterY - item.size / 2, item.size, item.size);
        cx += item.width;
      } else {
        const itemFamily = (item.color && coloredFamily) ? coloredFamily : family;
        ctx.font = getFontString(fontSize, item.bold, item.italic, itemFamily);
        ctx.fillStyle = item.color || '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.value, cx, lineCenterY);
        cx += item.width;
      }
    }
    currentY += lineObj.height;
  }
}

// ============ Simple Text Card ============

export function drawSimpleTextCard(ctx, data, w, h, bgColor, bgImage) {
  const { header = '', body = '' } = data || {};

  drawCardBackground(ctx, w, h, 8, bgColor, bgImage, getCachedImage);
  roundRect(ctx, 0, 0, w, h, 8);
  ctx.strokeStyle = '#3a2a0a'; ctx.lineWidth = 2; ctx.stroke();

  const padX = 20;
  const contentW = w - padX * 2;

  // Header
  const headerFont = 20;
  const headerLineHeight = headerFont * 1.375;
  const headerIconSize = 25;
  const headerElements = parseRichText(header, headerIconSize);
  ctx.font = getFontString(headerFont, true);
  const headerLayout = layoutRichText(ctx, headerElements, headerFont, contentW, headerIconSize, headerLineHeight);
  let y = 20;
  drawRichText(ctx, headerLayout, padX, y, contentW, headerFont, 'left');
  y += headerLayout.totalHeight + 12;

  ctx.strokeStyle = 'rgba(58,42,10,0.33)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(w - padX, y); ctx.stroke();

  // Body
  y += 16;
  const bodyFont = 14;
  const bodyLineHeight = bodyFont * 1.625;
  const bodyIconSize = 25;
  const bodyText = (body || '').replace(/  \n/g, '\n');
  const bodyElements = parseRichText(bodyText, bodyIconSize);
  ctx.font = getFontString(bodyFont, false);
  const bodyLayout = layoutRichText(ctx, bodyElements, bodyFont, contentW, bodyIconSize, bodyLineHeight);
  drawRichText(ctx, bodyLayout, padX, y, contentW, bodyFont, 'left');
}

// ============ Clans Card ============

export function drawClansCard(ctx, data, w, h, bgColor, bgImage) {
  const { number = '', title = '', content = '', statNumbers = [], subtype = '', costSymbols = [] } = data || {};
  const costIconList = costSymbols.flatMap(cs => Array(cs.count || 1).fill({ url: cs.url, name: cs.name }));
  const showInfluence = number && number !== '-' && number.trim() !== '';

  drawCardBackground(ctx, w, h, 8, bgColor, bgImage, getCachedImage);
  roundRect(ctx, 0, 0, w, h, 8);
  ctx.strokeStyle = '#3a2a0a'; ctx.lineWidth = 2; ctx.stroke();

  const padX = 16;
  const availW = w - padX * 2;

  // --- Header ---
  const numberFont = 110;
  const titleFont = 28;
  const titleIconSize = 39;
  const costIconSize = 24;
  const headerGap = 12;

  ctx.font = `${numberFont}px ${CAESAR}`;
  const numberW = showInfluence ? Math.max(80, ctx.measureText(String(number)).width) : 0;
  const titleColX = padX + (showInfluence ? numberW + headerGap : 0);
  const titleColW = availW - (showInfluence ? numberW + headerGap : 0);

  const titleElements = parseRichText(title || 'Card Title', titleIconSize);
  ctx.font = getFontString(titleFont, false, false, CAESAR);
  const titleLayout = layoutRichText(ctx, titleElements, titleFont, titleColW, titleIconSize, titleFont * 1.2, CAESAR);
  const costRowH = costIconList.length > 0 ? costIconSize + 4 : 0;
  const titleBlockH = titleLayout.totalHeight + costRowH;

  const headerTop = 12;
  const headerContentH = showInfluence ? Math.max(numberFont, titleBlockH) : titleBlockH;
  const numberY = headerTop + (headerContentH - numberFont) / 2;
  const titleY = headerTop + (headerContentH - titleBlockH) / 2;

  if (showInfluence) {
    ctx.fillStyle = '#1a0e00';
    ctx.font = `${numberFont}px ${CAESAR}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), padX + numberW / 2, numberY + numberFont / 2);
  }

  drawRichText(ctx, titleLayout, titleColX, titleY, titleColW, titleFont, 'center', CAESAR);

  // Cost icons row (centered under title)
  if (costIconList.length > 0) {
    const totalCostW = costIconList.length * costIconSize + (costIconList.length - 1) * 4;
    let cx = titleColX + (titleColW - totalCostW) / 2;
    const costY = titleY + titleLayout.totalHeight + 4;
    for (const sym of costIconList) {
      const img = getCachedImage(sym.url);
      if (img) ctx.drawImage(img, cx, costY, costIconSize, costIconSize);
      cx += costIconSize + 4;
    }
  }

  let y = headerTop + headerContentH + 1;

  // --- Bottom (subtype + stat numbers) ---
  const subtypeFont = 22;
  const statFont = 64;
  const bottomPadB = 16;
  const bottomH = Math.max(subtypeFont, statNumbers.length > 0 ? statFont : 0) + bottomPadB;

  // --- Body (auto-shrink to fit) ---
  const bodyTop = y + 14;
  const bodyBottom = h - bottomH;
  const bodyW = w - 40;
  const bodyX = 20;
  let fontSize = 21;
  let bodyLayout = null;
  const bodyText = (content || '').replace(/  \n/g, '\n');
  const bodyElements = parseRichText(bodyText, 25);
  while (fontSize >= 11) {
    ctx.font = `${fontSize}px ${ALBERT}`;
    bodyLayout = layoutRichText(ctx, bodyElements, fontSize, bodyW, 25, fontSize * 1.55, ALBERT, CAESAR);
    if (bodyLayout.totalHeight <= bodyBottom - bodyTop) break;
    fontSize -= 0.5;
  }
  if (!bodyLayout) {
    ctx.font = `11px ${ALBERT}`;
    bodyLayout = layoutRichText(ctx, bodyElements, 11, bodyW, 25, 11 * 1.55, ALBERT, CAESAR);
  }
  // Vertically center body in available space
  const bodyY = bodyTop + Math.max(0, (bodyBottom - bodyTop - bodyLayout.totalHeight) / 2);
  for (const lineObj of bodyLayout.lines) {
    const line = lineObj.items;
    if (line.length === 0) { continue; }
    let lineWidth = 0;
    for (const item of line) lineWidth += item.width;
    let cx = bodyX + (bodyW - lineWidth) / 2;
    const lineCenterY = bodyY + lineObj.height / 2;
    for (const item of line) {
      if (item.type === 'icon') {
        const img = getCachedImage(item.url);
        if (img) ctx.drawImage(img, cx, lineCenterY - item.size / 2, item.size, item.size);
        cx += item.width;
      } else {
        const hasColor = !!item.color;
        ctx.font = `${fontSize}px ${hasColor ? CAESAR : ALBERT}`;
        ctx.fillStyle = item.color || '#1a0e00';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.value, cx, lineCenterY);
        cx += item.width;
      }
    }
    bodyY += lineObj.height;
  }

  // --- Bottom row ---
  const bottomY = h - bottomPadB;
  // Subtype (left)
  if (subtype) {
    ctx.fillStyle = '#3a2a0a';
    ctx.font = `${subtypeFont}px ${CAESAR}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(subtype, padX, bottomY);
  }
  // Stat numbers (right)
  let statX = w - padX;
  for (let i = statNumbers.length - 1; i >= 0; i--) {
    const stat = statNumbers[i];
    ctx.font = `${statFont}px ${CAESAR}`;
    const sw = ctx.measureText(String(stat.value ?? i)).width;
    ctx.fillStyle = NUMBER_COLORS[stat.color] || '#1a0e00';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(stat.value ?? i), statX, bottomY);
    statX -= sw + 12;
  }
}

// ============ Tactical (Towers) Card ============

function drawGridSymbol(ctx, symbolKey, x, y, size) {
  const img = gridSymbolImages[symbolKey];
  if (img) ctx.drawImage(img, x, y, size, size);
}

function drawCardIcon(ctx, iconKey, x, y, size) {
  const icon = getIconByKey(iconKey);
  if (!icon) return;
  if (icon.url) {
    const img = getCachedImage(icon.url);
    if (img) ctx.drawImage(img, x, y, size, size);
  } else if (attrIconImages[icon.key]) {
    ctx.drawImage(attrIconImages[icon.key], x, y, size, size);
  }
}

export function drawTacticalCard(ctx, data, w, h, bgColor, bgImage) {
  const { number, iconKey, artUrl, grids = [], connections = [], attributes = [] } = data || {};

  drawCardBackground(ctx, w, h, 8, bgColor, bgImage, getCachedImage);
  roundRect(ctx, 0, 0, w, h, 8);
  ctx.strokeStyle = '#3a2a0a'; ctx.lineWidth = 2; ctx.stroke();

  // --- Top section: number + icon ---
  const topPad = 12;
  const topFont = 64;
  const iconSize = 56;
  const numberX = 28; // px-4 (16) + marginLeft (12)
  const iconX = w - 28 - iconSize; // px-4 (16) + marginRight (12)
  ctx.fillStyle = '#1a0e00';
  ctx.font = `${topFont}px ${CAESAR}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(number || '0'), numberX, topPad + topFont);
  drawCardIcon(ctx, iconKey, iconX, topPad + (topFont - iconSize) / 2, iconSize);

  // --- Card art ---
  let y = topPad + topFont + topPad; // 88
  const artH = 160;
  if (artUrl) {
    const img = getCachedImage(artUrl);
    if (img) {
      const artW = w - 40;
      const scale = Math.min(artW / img.width, artH / img.height, 1);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, 20 + (artW - dw) / 2, y + (artH - dh) / 2, dw, dh);
    }
  }
  y += artH; // 248

  // --- Bottom section ---
  const bottomH = h - y; // 256
  const hasAttrs = attributes.length > 0;

  // Grid geometry
  const gridCount = grids.length;
  const gridAreaW = 172;
  const gridAreaH = Math.floor(200 / Math.max(gridCount, 1));
  const maxCols = Math.max(...grids.map(g => g.cols), 2);
  const maxRows = Math.max(...grids.map(g => g.rows), 2);
  const maxCellW = Math.floor(gridAreaW / maxCols) - 1;
  const maxCellH = Math.floor(gridAreaH / maxRows) - 1;
  const maxCellSize = Math.min(maxCellW, maxCellH, 36);
  const cellSize = Math.min(maxCellSize, 36);

  const gridWidths = grids.map(g => g.cols * cellSize);
  const gridHeights = grids.map(g => g.rows * cellSize);
  const maxGridW = Math.max(...gridWidths, 0);
  const stackH = gridHeights.reduce((a, b) => a + b, 0) + Math.max(0, gridCount - 1) * 6;

  // Compute grid positions
  let gridX, gridY;
  if (hasAttrs) {
    gridX = 24;
    gridY = y + 8;
  } else {
    gridX = 8 + (w - 16 - maxGridW) / 2;
    gridY = y + 8 + (bottomH - 16 - stackH) / 2;
  }

  // Draw grids + cells
  const cellCenters = {}; // gridIndex -> {row-col -> {cx, cy}}
  let curGridY = gridY;
  grids.forEach((grid, gi) => {
    const gw = gridWidths[gi];
    const gh = gridHeights[gi];
    cellCenters[gi] = {};
    // Grid border
    ctx.strokeStyle = '#3a2a0a';
    ctx.lineWidth = 1;
    ctx.strokeRect(gridX, curGridY, gw, gh);
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cx = gridX + c * cellSize;
        const cy = curGridY + r * cellSize;
        const isOrigin = grid.origin?.row === r && grid.origin?.col === c;
        // Cell border
        ctx.strokeStyle = '#3a2a0a';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, cellSize, cellSize);
        // Origin background
        if (isOrigin) {
          ctx.fillStyle = 'rgba(58,42,10,0.15)';
          ctx.fillRect(cx, cy, cellSize, cellSize);
          // Origin dot
          ctx.fillStyle = '#3a2a0a';
          ctx.beginPath();
          ctx.arc(cx + cellSize / 2, cy + cellSize / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        // Symbol
        const symbolKey = grid.cells?.[`${r}-${c}`];
        if (symbolKey && symbolKey !== 'empty') {
          const symSize = Math.max(cellSize * 0.65, 10);
          drawGridSymbol(ctx, symbolKey, cx + (cellSize - symSize) / 2, cy + (cellSize - symSize) / 2, symSize);
        }
        cellCenters[gi][`${r}-${c}`] = { cx: cx + cellSize / 2, cy: cy + cellSize / 2 };
      }
    }
    curGridY += gh + 6;
  });

  // Draw connection lines
  if (connections?.length) {
    ctx.strokeStyle = 'hsl(38, 80%, 55%)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const conn of connections) {
      const from = cellCenters[conn.from.gridIndex]?.[`${conn.from.row}-${conn.from.col}`];
      const to = cellCenters[conn.to.gridIndex]?.[`${conn.to.row}-${conn.to.col}`];
      if (from && to) {
        ctx.beginPath();
        ctx.moveTo(from.cx, from.cy);
        ctx.lineTo(to.cx, to.cy);
        ctx.stroke();
      }
    }
  }

  // --- Attributes (right side) ---
  if (hasAttrs) {
    const attrX = gridX + maxGridW + 8;
    const attrW = w - attrX - 8;
    let attrY = y + 8;
    for (const attr of attributes) {
      const iconBoxSize = 24;
      const iconDrawSize = 22;
      // Icon
      if (attr.customIconUrl) {
        const img = getCachedImage(attr.customIconUrl);
        if (img) ctx.drawImage(img, attrX, attrY + 1, iconBoxSize, iconBoxSize);
      } else {
        drawCardIcon(ctx, attr.iconKey || 'attr_star', attrX, attrY + 1, iconDrawSize);
      }
      // Name + text
      const textX = attrX + iconBoxSize + 6;
      const textW = attrW - iconBoxSize - 6;
      let ty = attrY;
      if (attr.name) {
        const nameElements = parseRichText(attr.name, 16);
        ctx.font = getFontString(11, true);
        const nameLayout = layoutRichText(ctx, nameElements, 11, textW, 16, 14);
        drawRichText(ctx, nameLayout, textX, ty, textW, 11, 'left');
        ty += nameLayout.totalHeight;
      }
      if (attr.text) {
        const textElements = parseRichText(attr.text, 16);
        ctx.font = getFontString(10, false);
        const textLayout = layoutRichText(ctx, textElements, 10, textW, 16, 13);
        drawRichText(ctx, textLayout, textX, ty, textW, 10, 'left');
        ty += textLayout.totalHeight;
      }
      attrY = ty + 8;
    }
  }
}

// ============ Export entry point ============

export async function renderDomCardToCanvas(template, data, scale = 2, bgColor, bgImage) {
  await document.fonts.ready;
  await preloadDomCardImages(data);
  if (bgImage) await loadImage(bgImage);

  const w = 360, h = 504;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  if (template === 'simple_text') drawSimpleTextCard(ctx, data, w, h, bgColor, bgImage);
  else if (template === 'clans') drawClansCard(ctx, data, w, h, bgColor, bgImage);
  else if (template === 'tactical') drawTacticalCard(ctx, data, w, h, bgColor, bgImage);
  else return null;

  return canvas;
}