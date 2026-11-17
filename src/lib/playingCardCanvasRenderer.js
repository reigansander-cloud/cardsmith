// Rendering pipeline for Standard Playing Card template.
// drawPlayingCard is used for both the visible preview canvas and the
// offscreen export canvas — guaranteeing identical pixels.

import { drawCardBackground } from './canvasBg';

const imageCache = new Map();

export async function loadImage(url) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { imageCache.set(url, img); resolve(img); };
    img.onerror = () => resolve(null);
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

export async function preloadPlayingCardImages(data) {
  const urls = [];
  if (data?.suitIconUrl) urls.push(data.suitIconUrl);
  if (data?.artworkUrl) urls.push(data.artworkUrl);
  if (data?.abilitiesIconUrl) urls.push(data.abilitiesIconUrl);
  for (const field of [data?.content, data?.abilitiesText]) {
    if (!field) continue;
    const re = /\[icon:([^\]]+)\]/g;
    let m;
    while ((m = re.exec(field)) !== null) urls.push(m[1].trim());
  }
  await Promise.all(urls.map(loadImage));
}

function getCachedImage(url) {
  return url ? imageCache.get(url) : null;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Pip layouts: [normalizedX, normalizedY] within frame interior (0–1)
const PIP_LAYOUTS = {
  2:  [[0.5, 0.22], [0.5, 0.78]],
  3:  [[0.5, 0.18], [0.5, 0.5], [0.5, 0.82]],
  4:  [[0.28, 0.22], [0.72, 0.22], [0.28, 0.78], [0.72, 0.78]],
  5:  [[0.28, 0.22], [0.72, 0.22], [0.5, 0.5], [0.28, 0.78], [0.72, 0.78]],
  6:  [[0.28, 0.18], [0.72, 0.18], [0.28, 0.5], [0.72, 0.5], [0.28, 0.82], [0.72, 0.82]],
  7:  [[0.28, 0.18], [0.72, 0.18], [0.5, 0.34], [0.28, 0.5], [0.72, 0.5], [0.28, 0.82], [0.72, 0.82]],
  8:  [[0.28, 0.15], [0.72, 0.15], [0.28, 0.38], [0.72, 0.38], [0.28, 0.62], [0.72, 0.62], [0.28, 0.85], [0.72, 0.85]],
  9:  [[0.28, 0.15], [0.72, 0.15], [0.28, 0.38], [0.72, 0.38], [0.5, 0.5], [0.28, 0.62], [0.72, 0.62], [0.28, 0.85], [0.72, 0.85]],
  10: [[0.28, 0.1], [0.72, 0.1], [0.28, 0.3], [0.72, 0.3], [0.28, 0.5], [0.72, 0.5], [0.28, 0.7], [0.72, 0.7], [0.28, 0.9], [0.72, 0.9]],
};

function drawCornerValue(ctx, value, suitImg, color, fontFamily) {
  const margin = 24;
  const fontSize = 52;
  const iconSize = 44;

  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `${fontSize}px '${fontFamily}', serif`;
  ctx.fillText(value, margin, margin);

  if (suitImg) {
    const textWidth = ctx.measureText(value).width;
    const iconX = margin + (textWidth - iconSize) / 2;
    ctx.drawImage(suitImg, iconX, margin + fontSize + 2, iconSize, iconSize);
  }
}

function drawCornerFlourishes(ctx, x, y, w, h, inset, color) {
  const corners = [
    { cx: x + inset, cy: y + inset, angle: 0 },
    { cx: x + w - inset, cy: y + inset, angle: Math.PI / 2 },
    { cx: x + w - inset, cy: y + h - inset, angle: Math.PI },
    { cx: x + inset, cy: y + h - inset, angle: -Math.PI / 2 },
  ];

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (const { cx, cy, angle } of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(3, 9);
    ctx.quadraticCurveTo(3, 3, 9, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, 6, 1.2, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
}

function drawDecorativeFrame(ctx, x, y, w, h, color) {
  const r = 6;

  // Outer border
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();

  // Inner border
  const inset = 5;
  ctx.lineWidth = 1;
  roundRect(ctx, x + inset, y + inset, w - 2 * inset, h - 2 * inset, Math.max(1, r - inset));
  ctx.stroke();

  // Corner dots
  ctx.fillStyle = color;
  const corners = [
    [x + inset, y + inset],
    [x + w - inset, y + inset],
    [x + inset, y + h - inset],
    [x + w - inset, y + h - inset],
  ];
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Midpoint dots
  const midInset = inset / 2 + 1.5;
  const midPoints = [
    [x + w / 2, y + midInset],
    [x + w / 2, y + h - midInset],
    [x + midInset, y + h / 2],
    [x + w - midInset, y + h / 2],
  ];
  for (const [mx, my] of midPoints) {
    ctx.beginPath();
    ctx.arc(mx, my, 1.5, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Corner flourishes
  drawCornerFlourishes(ctx, x, y, w, h, inset, color);
}

function drawPipArrangement(ctx, suitImg, x, y, w, h, numValue) {
  const layout = PIP_LAYOUTS[numValue];
  if (!layout) return;

  const isSingleCol = numValue <= 3;
  const rows = isSingleCol ? numValue : Math.ceil(numValue / 2);
  const iconSize = isSingleCol
    ? Math.min(w * 0.25, h / (numValue + 1))
    : Math.min(w * 0.2, h / (rows + 1));

  for (const [nx, ny] of layout) {
    const px = x + nx * w - iconSize / 2;
    const py = y + ny * h - iconSize / 2;

    if (ny > 0.5) {
      ctx.save();
      ctx.translate(px + iconSize / 2, py + iconSize / 2);
      ctx.rotate(Math.PI);
      ctx.drawImage(suitImg, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
      ctx.restore();
    } else {
      ctx.drawImage(suitImg, px, py, iconSize, iconSize);
    }
  }
}

function drawFaceCard(ctx, suitImg, x, y, w, h) {
  const targetW = w * 0.5;
  const targetH = h * 0.55;
  const scale = Math.min(targetW / suitImg.width, targetH / suitImg.height);
  const dw = suitImg.width * scale;
  const dh = suitImg.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(suitImg, dx, dy, dw, dh);
}

// ============ Rich content (text + inline [icon:url] icons) ============

function parseContentTokens(content) {
  const tokens = [];
  const re = /\[icon:([^\]]+)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: content.slice(last, m.index) });
    tokens.push({ type: 'icon', url: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < content.length) tokens.push({ type: 'text', value: content.slice(last) });
  return tokens;
}

function layoutRichLines(ctx, content, bodyFont, iconSize, maxW) {
  const tokens = parseContentTokens(content);
  ctx.font = `${bodyFont}px 'Inter', sans-serif`;
  const spaceW = ctx.measureText(' ').width;
  const units = [];
  for (const tok of tokens) {
    if (tok.type === 'icon') {
      units.push({ type: 'icon', url: tok.url, w: iconSize, adv: iconSize + 2 });
    } else {
      const words = tok.value.split(/\s+/).filter(Boolean);
      for (const wd of words) {
        const ww = ctx.measureText(wd).width;
        units.push({ type: 'word', value: wd, w: ww, adv: ww + spaceW });
      }
    }
  }
  const lines = [];
  let line = [];
  let lineW = 0;
  for (const u of units) {
    if (lineW + u.w > maxW && line.length) {
      lines.push(line);
      line = [];
      lineW = 0;
    }
    line.push(u);
    lineW += u.adv;
  }
  if (line.length) lines.push(line);
  return lines;
}

function drawRichContent(ctx, content, x, y, w, maxH, color, startFont, minFont = 11, centerV = false) {
  let bodyFont = startFont;
  let iconSize = bodyFont * 1.5;
  let lineH = bodyFont * 1.35;
  let lines = layoutRichLines(ctx, content, bodyFont, iconSize, w);
  while (bodyFont > minFont && lines.length * lineH > maxH) {
    bodyFont -= 1;
    iconSize = bodyFont * 1.5;
    lineH = bodyFont * 1.35;
    lines = layoutRichLines(ctx, content, bodyFont, iconSize, w);
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let cy = y + lineH / 2;
  if (centerV) {
    const totalH = lines.length * lineH;
    cy = y + (maxH - totalH) / 2 + lineH / 2;
  }
  for (const line of lines) {
    let lineWidth = 0;
    for (const u of line) lineWidth += u.adv;
    if (line.length) {
      const last = line[line.length - 1];
      if (last.type === 'word') lineWidth -= (last.adv - last.w);
    }
    let cx = x + (w - lineWidth) / 2;
    for (const u of line) {
      if (u.type === 'icon') {
        const img = getCachedImage(u.url);
        if (img) ctx.drawImage(img, cx, cy - iconSize / 2, iconSize, iconSize);
        cx += u.adv;
      } else {
        ctx.font = `${bodyFont}px 'Inter', sans-serif`;
        ctx.fillText(u.value, cx, cy);
        cx += u.adv;
      }
    }
    cy += lineH;
  }
}

function drawPlainFrame(ctx, x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 6);
  ctx.stroke();
}

function drawDoubleFrame(ctx, x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 6);
  ctx.stroke();
  const inset = 6;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x + inset, y + inset, w - 2 * inset, h - 2 * inset, Math.max(1, 6 - inset));
  ctx.stroke();
}

function drawBoldFrame(ctx, x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  roundRect(ctx, x, y, w, h, 10);
  ctx.stroke();
}

function drawEtchedFrame(ctx, x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 6);
  ctx.stroke();
  const inset = 4;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  roundRect(ctx, x + inset, y + inset, w - 2 * inset, h - 2 * inset, Math.max(1, 6 - inset));
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawFrame(ctx, style, x, y, w, h, color) {
  if (style === 'plain') return drawPlainFrame(ctx, x, y, w, h, color);
  if (style === 'double') return drawDoubleFrame(ctx, x, y, w, h, color);
  if (style === 'bold') return drawBoldFrame(ctx, x, y, w, h, color);
  if (style === 'etched') return drawEtchedFrame(ctx, x, y, w, h, color);
  return drawDecorativeFrame(ctx, x, y, w, h, color);
}

function drawArtwork(ctx, img, x, y, w, h, offset) {
  if (!img) return;
  ctx.save();
  roundRect(ctx, x, y, w, h, 4);
  ctx.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const slack = dw - w;
  const dx = x + (w - dw) / 2 + (offset / 100) * (slack / 2);
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawHeaderPlate(ctx, text, frameX, frameY, frameW, color, fontFamily, frameStyle) {
  const plateW = frameW * 0.62;
  const plateH = 30;
  const plateX = frameX + (frameW - plateW) / 2;
  const plateY = frameY - plateH / 2;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = color;
  ctx.lineWidth = frameStyle === 'bold' ? 4 : 2;
  roundRect(ctx, plateX, plateY, plateW, plateH, 6);
  ctx.fill();
  ctx.stroke();
  if (!text) return;
  let font = 20;
  ctx.font = `${font}px '${fontFamily}', serif`;
  while (font > 10 && ctx.measureText(text).width > plateW - 18) {
    font -= 1;
    ctx.font = `${font}px '${fontFamily}', serif`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, plateX + plateW / 2, plateY + plateH / 2 + 1);
}

function drawAbilitiesBox(ctx, content, iconImg, frameX, frameY, frameW, frameH, color, frameStyle) {
  const boxW = frameW * 0.92;
  const boxH = 66;
  const boxX = frameX + (frameW - boxW) / 2;
  const boxY = frameY + frameH - boxH + 8;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = color;
  ctx.lineWidth = frameStyle === 'bold' ? 4 : 2;
  roundRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();
  const padding = 12;
  let textX = boxX + padding;
  let textW = boxW - 2 * padding;
  if (iconImg) {
    const iconSize = boxH - 16;
    const iconX = boxX + padding;
    const iconY = boxY + (boxH - iconSize) / 2;
    ctx.drawImage(iconImg, iconX, iconY, iconSize, iconSize);
    textX = iconX + iconSize + 8;
    textW = boxX + boxW - padding - textX;
  }
  if (!content) return;
  drawRichContent(ctx, content, textX, boxY + 6, textW, boxH - 12, color, 17, 7, true);
}

export function drawPlayingCard(ctx, data, w, h, bgColor, bgImage) {
  const { value = 'A', suitIconUrl = '', accentColor = '#1a1a2e', contentTitle = '', content = '', frameStyle = 'ornate', artworkUrl = '', artworkOffset = 0, headerText = '', abilitiesText = '', showHeader = false, showAbilities = false, showContentTitle = false, showContent = false, abilitiesIconUrl = '', fontFamily = 'CaesarDressing' } = data || {};
  const suitImg = getCachedImage(suitIconUrl);
  const artworkImg = getCachedImage(artworkUrl);
  const abilitiesIconImg = getCachedImage(abilitiesIconUrl);
  const hasContent = !!(content && content.trim());
  const hasArtwork = !!artworkImg;

  // Background
  drawCardBackground(ctx, w, h, 10, bgColor, bgImage, getCachedImage);

  // Outer thin border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = frameStyle === 'bold' ? 3 : 1;
  roundRect(ctx, 4, 4, w - 8, h - 8, 8);
  ctx.stroke();

  // Corner values — top left
  drawCornerValue(ctx, value, suitImg, accentColor, fontFamily);

  // Corner values — bottom right (rotated 180°)
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(Math.PI);
  ctx.translate(-w / 2, -h / 2);
  drawCornerValue(ctx, value, suitImg, accentColor, fontFamily);
  ctx.restore();

  // Central decorative frame
  const frameMarginX = 70;
  const frameMarginTop = 72;
  const frameMarginBottom = 72;
  const frameX = frameMarginX;
  const frameY = frameMarginTop;
  const frameW = w - 2 * frameMarginX;
  const frameH = h - frameMarginTop - frameMarginBottom;

  drawFrame(ctx, frameStyle, frameX, frameY, frameW, frameH, accentColor);

  // Frame interior
  const frameInset = 12;
  const innerX = frameX + frameInset;
  const innerY = frameY + frameInset;
  const innerW = frameW - 2 * frameInset;
  const innerH = frameH - 2 * frameInset;

  // Frame interior content
  const showContentArea = (showContent && hasContent) || (showContentTitle && !!(contentTitle && contentTitle.trim()));
  if (hasArtwork) {
    const artInset = (frameStyle === 'plain' || frameStyle === 'bold') ? 3 : 7;
    drawArtwork(ctx, artworkImg, frameX + artInset, frameY + artInset, frameW - 2 * artInset, frameH - 2 * artInset, artworkOffset);
  } else if (showContentArea) {
    const padding = 14;
    const tx = innerX + padding;
    const ty = innerY + padding;
    const tw = innerW - 2 * padding;
    const th = innerH - 2 * padding;
    let cursorY = ty;

    if (showContentTitle && contentTitle && contentTitle.trim()) {
      let titleFont = 30;
      ctx.font = `${titleFont}px '${fontFamily}', serif`;
      while (titleFont > 14 && ctx.measureText(contentTitle).width > tw) {
        titleFont -= 1;
        ctx.font = `${titleFont}px '${fontFamily}', serif`;
      }
      ctx.fillStyle = accentColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(contentTitle, tx + tw / 2, cursorY);
      cursorY += titleFont + 12;
    }

    if (showContent && hasContent) {
      const maxBottom = ty + th;
      drawRichContent(ctx, content, tx, cursorY, tw, maxBottom - cursorY, accentColor, 18);
    }
  } else if (!suitImg) {
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.2;
    ctx.font = `13px 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Upload a suit icon', innerX + innerW / 2, innerY + innerH / 2);
    ctx.globalAlpha = 1;
  } else {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 2 && numValue <= 10 && PIP_LAYOUTS[numValue]) {
      drawPipArrangement(ctx, suitImg, innerX, innerY, innerW, innerH, numValue);
    } else {
      drawFaceCard(ctx, suitImg, innerX, innerY, innerW, innerH);
    }
  }

  // Overlays — header plate and abilities box draw on top regardless of artwork
  if (showHeader) drawHeaderPlate(ctx, headerText, frameX, frameY, frameW, accentColor, fontFamily, frameStyle);
  if (showAbilities) drawAbilitiesBox(ctx, abilitiesText, abilitiesIconImg, frameX, frameY, frameW, frameH, accentColor, frameStyle);
}

export async function renderPlayingCardToCanvas(data, scale = 2, bgColor, bgImage) {
  await document.fonts.ready;
  await preloadPlayingCardImages(data);
  if (bgImage) await loadImage(bgImage);

  const w = 360, h = 504;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  drawPlayingCard(ctx, data, w, h, bgColor, bgImage);
  return canvas;
}