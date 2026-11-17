// Canvas renderer for folder entries — mirrors the EntryPreview DOM layout
// (buildLayers) so printed deck cards match the on-screen preview. Supports
// the portrait templates (permanent/instant/modifier/income) and the landscape
// battlefield template.
import { buildLayers, canvasSizeFor } from './folderPreview';

function loadImage(url) {
  return new Promise((res) => {
    if (!url) return res(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

async function collectImages(entry) {
  const urls = new Set();
  (entry.cost_icons || []).forEach((u) => u && urls.add(u));
  (entry.bonus_cost_icons || []).forEach((u) => u && urls.add(u));
  if (entry.income_symbol) urls.add(entry.income_symbol);
  const re = /\[icon:([^\]]+)\]/g;
  let m;
  while ((m = re.exec(entry.ability || '')) !== null) urls.add(m[1]);
  while ((m = re.exec(entry.bonus_ability || '')) !== null) urls.add(m[1]);
  while ((m = re.exec(entry.flavor_text || '')) !== null) urls.add(m[1]);
  const map = {};
  await Promise.all([...urls].map(async (u) => { map[u] = await loadImage(u); }));
  return map;
}

// Parse [b][i][color:hex][icon:url] markup into ordered runs.
function parseRich(content, baseItalic = false) {
  const re = /\[(b|i|\/b|\/i|color:[^\]]+|\/color|icon:[^\]]+)\]/g;
  const runs = [];
  let last = 0;
  let m;
  let bold = false;
  let italic = baseItalic;
  let color = null;
  const push = (text) => { if (text) runs.push({ type: 'text', text, bold: bold || !!color, italic, color }); };
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) push(content.slice(last, m.index));
    const tag = m[1];
    if (tag === 'b') bold = true;
    else if (tag === '/b') bold = false;
    else if (tag === 'i') italic = true;
    else if (tag === '/i') italic = false;
    else if (tag.startsWith('color:')) color = tag.slice(6);
    else if (tag === '/color') color = null;
    else if (tag.startsWith('icon:')) runs.push({ type: 'icon', url: tag.slice(5) });
    last = m.index + m[0].length;
  }
  if (last < content.length) push(content.slice(last));
  return runs;
}

function fontString(family, size, bold, italic) {
  const parts = [];
  if (italic) parts.push('italic');
  if (bold) parts.push('bold');
  parts.push(`${size}px ${family}`);
  return parts.join(' ');
}

// Lay rich runs out into wrapped lines (pre-wrap style: preserve newlines,
// wrap on word boundaries). Returns lines + total height.
function layoutRich(ctx, runs, fontSize, fontFamily, maxWidth, images) {
  const lineHeight = fontSize * 1.3;
  const lines = [];
  let line = [];
  let lineWidth = 0;
  let lineH = lineHeight;
  const pushLine = () => { lines.push({ segments: line, width: lineWidth, height: lineH }); line = []; lineWidth = 0; lineH = lineHeight; };

  for (const run of runs) {
    if (run.type === 'icon') {
      const img = images[run.url];
      const iconH = fontSize * 1.35;
      const iconW = img && img.width && img.height ? iconH * (img.width / img.height) : iconH;
      if (lineWidth + iconW > maxWidth && line.length > 0) pushLine();
      line.push({ icon: run.url, width: iconW, height: iconH });
      if (iconH > lineH) lineH = iconH;
      lineWidth += iconW;
    } else {
      ctx.font = fontString(run.color ? 'CaesarDressing, cursive' : fontFamily, fontSize, run.bold, run.italic);
      const parts = run.text.split('\n');
      for (let pi = 0; pi < parts.length; pi++) {
        if (pi > 0) pushLine();
        const words = parts[pi].split(/(\s+)/).filter((s) => s !== '');
        for (const word of words) {
          const ww = ctx.measureText(word).width;
          if (lineWidth + ww > maxWidth && line.length > 0) pushLine();
          line.push({ text: word, bold: run.bold, italic: run.italic, color: run.color, width: ww });
          lineWidth += ww;
        }
      }
    }
  }
  if (line.length > 0) pushLine();
  const totalHeight = lines.reduce((s, l) => s + l.height, 0);
  return { lines, totalHeight };
}

// Shrink font size until the block fits the box (height + max line width).
function fitText(ctx, runs, fontFamily, fontSize, w, h, minSize, images) {
  let size = fontSize;
  let layout = null;
  while (size >= minSize) {
    layout = layoutRich(ctx, runs, size, fontFamily, w, images);
    const maxW = layout.lines.reduce((mx, l) => Math.max(mx, l.width), 0);
    if (layout.totalHeight <= h && maxW <= w) return { layout, size };
    size -= 0.5;
  }
  layout = layoutRich(ctx, runs, minSize, fontFamily, w, images);
  return { layout, size: minSize };
}

function drawRich(ctx, layout, size, x, y, w, h, valign, align, fontFamily, images, color) {
  let startY = y;
  if (valign === 'bottom') startY = y + (h - layout.totalHeight);
  else if (valign === 'center') startY = y + (h - layout.totalHeight) / 2;
  let cy = startY;
  for (const line of layout.lines) {
    let cx;
    if (align === 'center') cx = x + (w - line.width) / 2;
    else if (align === 'right') cx = x + w - line.width;
    else cx = x;
    const baseline = cy + line.height * 0.8;
    for (const seg of line.segments) {
      if (seg.icon) {
        const img = images[seg.icon];
        if (img) ctx.drawImage(img, cx, cy + (line.height - seg.height) / 2, seg.width, seg.height);
        cx += seg.width;
      } else {
        ctx.font = fontString(seg.color ? 'CaesarDressing, cursive' : fontFamily, size, seg.bold, seg.italic);
        ctx.fillStyle = seg.color || color || '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(seg.text, cx, baseline);
        cx += seg.width;
      }
    }
    cy += line.height;
  }
}

function drawQuestionBadge(ctx, x, y, size, borderColor) {
  const s = Math.max(18, size * 0.7);
  const strokeW = Math.max(1.6, s * 0.14);
  ctx.save();
  ctx.font = `${Math.floor(s * 1.22)}px "CaesarDressing", cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = strokeW;
  ctx.lineJoin = 'round';
  ctx.strokeText('?', x + 1 + s / 2, y - 4 + s / 2 + 1);
  ctx.fillStyle = '#000';
  ctx.fillText('?', x + 1 + s / 2, y - 4 + s / 2 + 1);
  ctx.restore();
}

function drawCostBar(ctx, layer, images, bgColor) {
  const { x, y, w, h, costIcons, costQuestion, fit } = layer;
  const icons = costIcons || [];
  const questions = costQuestion || [];
  if (!icons.length) return;
  if (fit) {
    const size = Math.min(h, Math.floor(w / icons.length));
    const total = size * icons.length;
    let cx = x + (w - total) / 2;
    const cy = y + (h - size) / 2;
    for (let i = 0; i < icons.length; i++) {
      const img = images[icons[i]];
      if (img) ctx.drawImage(img, cx, cy, size, size);
      if (questions[i]) drawQuestionBadge(ctx, cx, cy, size, bgColor || '#ffffff');
      cx += size;
    }
    return;
  }
  const size = h;
  if (icons.length * size > w) {
    const img = images[icons[0]];
    const label = `×${icons.length}`;
    ctx.font = `bold ${(layer.fontSize || 25) * 1.4}px "Albert Sans", sans-serif`;
    const lw = ctx.measureText(label).width;
    const total = size + 2 + lw;
    let cx = x + (w - total) / 2;
    if (img) ctx.drawImage(img, cx, y, size, size);
    if (questions[0]) drawQuestionBadge(ctx, cx, y, size, bgColor || '#ffffff');
    cx += size + 2;
    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, y + h / 2);
  } else {
    const total = icons.length * size;
    let cx = x + (w - total) / 2;
    for (let i = 0; i < icons.length; i++) {
      const img = images[icons[i]];
      if (img) ctx.drawImage(img, cx, y, size, size);
      if (questions[i]) drawQuestionBadge(ctx, cx, y, size, bgColor || '#ffffff');
      cx += size;
    }
  }
}

function drawRect(ctx, layer) {
  ctx.strokeStyle = layer.stroke || '#000000';
  ctx.lineWidth = layer.strokeWidth || 1;
  const lw = ctx.lineWidth;
  ctx.strokeRect(layer.x + lw / 2, layer.y + lw / 2, layer.w - lw, layer.h - lw);
}

function drawImage(ctx, layer, images) {
  const img = images[layer.url];
  if (!img) return;
  const w = layer.w;
  const h = img.height && img.width ? (w * img.height) / img.width : w;
  ctx.drawImage(img, layer.x, layer.y, w, h);
}

export async function renderFolderEntryToCanvas(entry, scale = 3, supertypes = [], folderColor = '') {
  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('48px "CaesarDressing"'),
        document.fonts.load('bold 48px "CaesarDressing"'),
        document.fonts.load('24px "Albert Sans"'),
        document.fonts.load('italic 24px "Albert Sans"'),
        document.fonts.load('bold 24px "Albert Sans"'),
      ]);
      await document.fonts.ready;
    } catch {}
  }
  const images = await collectImages(entry);
  const { w: W, h: H } = canvasSizeFor(entry, supertypes);
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Background + border matching the live EntryPreview.
  ctx.fillStyle = folderColor || '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#d4d4d4';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  const layers = buildLayers(entry, supertypes);
  for (const layer of layers) {
    if (layer.type === 'costbar') {
      drawCostBar(ctx, layer, images, folderColor || '#ffffff');
    } else if (layer.type === 'rect') {
      drawRect(ctx, layer);
    } else if (layer.type === 'image') {
      drawImage(ctx, layer, images);
    } else {
      const runs = parseRich(layer.content || '', layer.italic);
      const { layout, size } = fitText(ctx, runs, layer.fontFamily, layer.fontSize, layer.w, layer.h, 1, images);
      drawRich(ctx, layout, size, layer.x, layer.y, layer.w, layer.h, layer.valign, layer.align, layer.fontFamily, images, layer.color);
    }
  }
  return canvas;
}