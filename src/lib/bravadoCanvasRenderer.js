// Single rendering pipeline for Bravado cards.
// drawBravadoItemsCard / drawBravadoCharactersCard are called for BOTH
// the visible preview canvas and the offscreen export canvas — guaranteeing
// identical pixels. Export is simply canvas.toDataURL().

import {
  drawBravadoIcon, getIconWidth, getCachedImage, getCustomIconUrl, preloadCardImages, loadImage, COG_URL, SUIT_URLS, SUIT_COLORS, CREDITS_URL, POINTS_URL, TRAP_URL
} from './bravadoCanvasIcons';
import { preloadPlayingCardImages, renderPlayingCardToCanvas } from './playingCardCanvasRenderer';
import { renderDomCardToCanvas } from './domCardCanvasRenderer';
import { renderGlimpsesToCanvas } from './glimpsesCanvasRenderer';
import { renderFreeCanvasToCanvas } from './freeCanvasRenderer';
import { renderSevenWondersToCanvas } from './sevenWondersRenderer';
import { drawCardBackground } from './canvasBg';

const RYE = '"Rye", cursive';
const TITLE = "'Naluka', sans-serif";
const BODY = "'Albert Sans', sans-serif";

function pseudoRandom(seed) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
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

// ============ Text parsing ============

function parseBravadoText(text) {
  if (!text) return [];
  const elements = [];
  const regex = /(\[icon:[^\]]+\]|\*\*[^*]+\*\*|_[^_]+_|\n)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith('[icon:')) {
      elements.push({ type: 'icon', iconType: token.slice(6, -1) });
    } else if (token.startsWith('**') && token.endsWith('**')) {
      elements.push({ type: 'text', value: token.slice(2, -2), bold: true });
    } else if (token.startsWith('_') && token.endsWith('_') && token.length > 2) {
      elements.push({ type: 'text', value: token.slice(1, -1), italic: true });
    } else if (token === '\n') {
      elements.push({ type: 'newline' });
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    elements.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return elements;
}

function getFontString(fontSize, bold, italic) {
  const parts = [];
  if (italic) parts.push('italic');
  if (bold) parts.push('bold');
  parts.push(`${fontSize}px ${BODY}`);
  return parts.join(' ');
}

// ============ Text layout (word-wrap with inline icons) ============

function layoutElements(ctx, elements, fontSize, iconSize, maxWidth, rowGap = 0, perLineHeight = false) {
  const baseLineHeight = fontSize * 1.6;
  const lines = [];
  let line = [];
  let lineWidth = 0;
  let totalHeight = 0;

  function pushLine() {
    let lh;
    if (perLineHeight) {
      const hasIcon = line.some(item => item.type === 'icon');
      lh = (hasIcon ? iconSize * 1.5 : fontSize * 1.5) + rowGap;
    } else {
      lh = baseLineHeight;
    }
    lines.push({ items: line, height: lh });
    totalHeight += lh;
    line = [];
    lineWidth = 0;
  }

  for (const el of elements) {
    if (el.type === 'gap') {
      if (line.length > 0) pushLine();
      lines.push({ items: [], height: el.height, gap: true });
      totalHeight += el.height;
      continue;
    }
    if (el.type === 'newline') {
      pushLine();
      continue;
    }
    if (el.type === 'icon') {
      const isCustom = el.iconType?.startsWith('custom_');
      const iw = isCustom ? iconSize : getIconWidth(el.iconType, iconSize);
      if (lineWidth + iw > maxWidth && line.length > 0) pushLine();
      line.push({ type: 'icon', iconType: el.iconType, width: iw, scatter: el.scatter, scatterSeed: el.scatterSeed });
      lineWidth += iw;
      continue;
    }
    // Text — split into words/spaces, measure each
    const fs = (el.rye || el.arrow) ? iconSize : fontSize;
    ctx.font = el.rye ? `${fs}px ${RYE}` : el.arrow ? `bold ${fs}px ${BODY}` : getFontString(fs, el.bold, el.italic);
    const parts = el.value.split(/(\s+)/).filter(p => p !== '');
    for (const part of parts) {
      const pw = ctx.measureText(part).width;
      if (lineWidth + pw > maxWidth && line.length > 0) pushLine();
      line.push({ type: 'text', value: part, width: pw, bold: el.bold, italic: el.italic, rye: el.rye, arrow: el.arrow });
      lineWidth += pw;
    }
  }
  if (line.length > 0) pushLine();
  return { lines, totalHeight };
}

// ============ Draw laid-out text ============

function drawLayout(ctx, layout, x, y, maxWidth, fontSize, iconSize, customIcons, align) {
  let currentY = y;

  for (const lineObj of layout.lines) {
    if (lineObj.gap) {
      currentY += lineObj.height;
      continue;
    }
    const line = lineObj.items;
    if (line.length === 0) {
      currentY += lineObj.height;
      continue;
    }

    let lineWidth = 0;
    for (const item of line) lineWidth += item.width;
    let cx;
    if (align === 'center') cx = x + (maxWidth - lineWidth) / 2;
    else if (align === 'right') cx = x + maxWidth - lineWidth;
    else cx = x;
    const lineCenterY = currentY + lineObj.height / 2;

    for (const item of line) {
      if (item.type === 'icon') {
        const isCustom = item.iconType?.startsWith('custom_');
        const iw = item.width;
        const ih = isCustom ? iconSize : getIconWidth(item.iconType, iconSize);

        if (item.scatter) {
          const seed = item.scatterSeed * 31 + 7;
          const rot = (pseudoRandom(seed) - 0.5) * 30;
          const offsetY = (pseudoRandom(seed + 100) - 0.5) * 8;
          const offsetX = (pseudoRandom(seed + 200) - 0.5) * 5;
          ctx.save();
          ctx.translate(cx + iw / 2 + offsetX, lineCenterY + offsetY);
          ctx.rotate(rot * Math.PI / 180);
          if (isCustom) {
            const img = getCachedImage(getCustomIconUrl(item.iconType, customIcons));
            if (img) ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
          } else {
            drawBravadoIcon(ctx, item.iconType, -iw / 2, -ih / 2, iconSize);
          }
          ctx.restore();
        } else {
          const iconY = lineCenterY - ih / 2;
          if (isCustom) {
            const img = getCachedImage(getCustomIconUrl(item.iconType, customIcons));
            if (img) ctx.drawImage(img, cx, iconY, iw, ih);
          } else {
            drawBravadoIcon(ctx, item.iconType, cx, iconY, iconSize);
          }
        }
        cx += item.width;
      } else {
        const fs = (item.rye || item.arrow) ? iconSize : fontSize;
        ctx.font = item.rye ? `${fs}px ${RYE}` : item.arrow ? `bold ${fs}px ${BODY}` : getFontString(fs, item.bold, item.italic);
        ctx.fillStyle = (item.rye || item.arrow) ? '#3a2a0a' : '#1a0e00';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.value, cx, lineCenterY);
        cx += item.width;
      }
    }
    currentY += lineObj.height;
  }
}

// ============ Conversion layout (three sections: input | arrow | output) ============

function getLayoutWidth(layout) {
  let maxW = 0;
  for (const line of layout.lines) {
    if (line.gap) continue;
    let w = 0;
    for (const item of line.items) w += item.width;
    if (w > maxW) maxW = w;
  }
  return maxW;
}

function layoutConversion(ctx, conv, fontSize, iconSize, maxWidth, seedOffset = 0, convRowGap, convTextScale) {
  ctx.font = `bold ${iconSize}px ${BODY}`;
  const arrowWidth = ctx.measureText('→').width;
  const arrowGap = 12;
  const textFontSize = iconSize * (convTextScale || 0.5);
  const rowGap = convRowGap !== undefined ? convRowGap : -6;

  const groupMaxWidth = (maxWidth - arrowWidth - arrowGap * 2) / 2;
  if (groupMaxWidth < 10) return null;

  const inputElements = parseBravadoText(conv.input || '');
  const outputElements = parseBravadoText(conv.output || '');
  const outputHasText = outputElements.some(el => el.type === 'text' && el.value.trim());
  const outputIconSize = outputHasText ? textFontSize : iconSize;
  let iconIdx = 0;
  for (const el of outputElements) {
    if (el.type === 'icon') {
      el.scatter = !outputHasText;
      el.scatterSeed = seedOffset + iconIdx;
      iconIdx++;
    }
  }

  const inputLayout = layoutElements(ctx, inputElements, textFontSize, iconSize, groupMaxWidth, rowGap, true);
  const outputLayout = layoutElements(ctx, outputElements, textFontSize, outputIconSize, groupMaxWidth, rowGap, true);

  const inputWidth = getLayoutWidth(inputLayout);
  const outputWidth = getLayoutWidth(outputLayout);
  const totalBlockWidth = inputWidth + arrowGap + arrowWidth + arrowGap + outputWidth;
  const totalHeight = Math.max(inputLayout.totalHeight, outputLayout.totalHeight, iconSize * 1.5 + rowGap);

  return { inputLayout, outputLayout, inputWidth, outputWidth, arrowWidth, arrowGap, totalBlockWidth, totalHeight, textFontSize, outputIconSize };
}

function drawConversionLayout(ctx, convLayout, x, y, maxWidth, fontSize, iconSize, customIcons) {
  const { inputLayout, outputLayout, inputWidth, outputWidth, arrowWidth, arrowGap, totalBlockWidth, totalHeight, textFontSize, outputIconSize } = convLayout;

  // Center the entire conversion block within maxWidth
  const blockX = x + (maxWidth - totalBlockWidth) / 2;

  // Input group — right-aligned to arrow, vertically centered in container
  const inputY = y + (totalHeight - inputLayout.totalHeight) / 2;
  drawLayout(ctx, inputLayout, blockX, inputY, inputWidth, textFontSize, iconSize, customIcons, 'right');

  // Arrow — centered between groups, vertically centered in container
  const arrowX = blockX + inputWidth + arrowGap + arrowWidth / 2;
  const arrowY = y + totalHeight / 2;
  ctx.font = `bold ${iconSize}px ${BODY}`;
  ctx.fillStyle = '#3a2a0a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('→', arrowX, arrowY);

  // Output group — left-aligned after arrow, vertically centered in container
  const outputX = blockX + inputWidth + arrowGap * 2 + arrowWidth;
  const outputY = y + (totalHeight - outputLayout.totalHeight) / 2;
  drawLayout(ctx, outputLayout, outputX, outputY, outputWidth, textFontSize, outputIconSize, customIcons, 'left');
}

// ============ Uses section (massive numbered boxes in a row) ============

function layoutUses(ctx, block, maxWidth, maxBoxW = 80) {
  const count = Math.max(1, Math.min(block.count || 1, 10));
  const boxGap = 8;
  const boxW = Math.min(maxBoxW, (maxWidth - boxGap * (count - 1)) / count);
  const boxH = boxW;
  return { count, boxW, boxH, boxGap, height: boxH };
}

function drawUses(ctx, usesLayout, x, y, maxWidth) {
  const { count, boxW, boxH, boxGap } = usesLayout;
  const totalW = count * boxW + (count - 1) * boxGap;
  const startX = x + (maxWidth - totalW) / 2;
  for (let i = 0; i < count; i++) {
    const bx = startX + i * (boxW + boxGap);
    ctx.fillStyle = '#3a2a0a';
    ctx.strokeStyle = '#3a2a0a';
    ctx.lineWidth = 2;
    roundRect(ctx, bx, y, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();
  }
}

// ============ Pet uses (red, fixed-size, wraps to next line) ============

function layoutPetUses(ctx, count, maxWidth) {
  count = Math.max(1, count || 1);
  const boxGap = 6;
  const boxW = 36;
  const boxH = boxW;
  const boxesPerRow = Math.max(1, Math.floor((maxWidth + boxGap) / (boxW + boxGap)));
  const rows = Math.ceil(count / boxesPerRow);
  const totalHeight = rows * boxH + (rows - 1) * boxGap;
  return { count, boxW, boxH, boxGap, boxesPerRow, rows, height: totalHeight };
}

function drawPetUses(ctx, usesLayout, x, y, maxWidth) {
  const { count, boxW, boxH, boxGap, boxesPerRow } = usesLayout;
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / boxesPerRow);
    const col = i % boxesPerRow;
    const boxesInThisRow = Math.min(boxesPerRow, count - row * boxesPerRow);
    const thisRowW = boxesInThisRow * boxW + (boxesInThisRow - 1) * boxGap;
    const thisStartX = x + (maxWidth - thisRowW) / 2;
    const bx = thisStartX + col * (boxW + boxGap);
    const by = y + row * (boxH + boxGap);
    ctx.fillStyle = '#c0392b';
    ctx.strokeStyle = '#922b21';
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();
  }
}

// ============ Die face (dice slot) ============

const DIE_PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.5], [0.72, 0.5], [0.28, 0.72], [0.72, 0.72]]
};

function drawDieFace(ctx, x, y, size, value) {
  ctx.fillStyle = '#fdf6e3';
  ctx.strokeStyle = '#3a2a0a';
  ctx.lineWidth = Math.max(2, size * 0.04);
  roundRect(ctx, x, y, size, size, size * 0.16);
  ctx.fill();
  ctx.stroke();
  const pips = DIE_PIPS[value] || [];
  const pr = size * 0.085;
  ctx.fillStyle = '#3a2a0a';
  for (const [px, py] of pips) {
    ctx.beginPath();
    ctx.arc(x + px * size, y + py * size, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============ Block layout (text blocks + conversion blocks) ============

function layoutBlocks(ctx, blocks, fontSize, iconSize, maxWidth, convRowGap, convTextScale) {
  const layouts = [];
  let totalHeight = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    let blockLayout = null;
    if (block.type === 'text') {
      const elements = parseBravadoText(block.content || '');
      const layout = layoutElements(ctx, elements, fontSize, iconSize, maxWidth);
      blockLayout = { type: 'text', layout, height: layout.totalHeight };
    } else if (block.type === 'conversion') {
      const convLayout = layoutConversion(ctx, block, fontSize, iconSize, maxWidth, i * 100, convRowGap, convTextScale);
      if (convLayout) {
        blockLayout = { type: 'conversion', layout: convLayout, height: convLayout.totalHeight };
      }
    } else if (block.type === 'uses') {
      const usesLayout = layoutUses(ctx, block, maxWidth);
      blockLayout = { type: 'uses', layout: usesLayout, height: usesLayout.height };
    }
    if (blockLayout) {
      if (layouts.length > 0) totalHeight += 12;
      layouts.push(blockLayout);
      totalHeight += blockLayout.height;
    }
  }
  return { layouts, totalHeight };
}

function drawBlocks(ctx, blockLayouts, x, y, maxWidth, fontSize, iconSize, customIcons) {
  let currentY = y;
  for (let i = 0; i < blockLayouts.length; i++) {
    const bl = blockLayouts[i];
    if (bl.type === 'text') {
      drawLayout(ctx, bl.layout, x, currentY, maxWidth, fontSize, iconSize, customIcons, 'center');
    } else if (bl.type === 'conversion') {
      drawConversionLayout(ctx, bl.layout, x, currentY, maxWidth, fontSize, iconSize, customIcons);
    } else if (bl.type === 'uses') {
      drawUses(ctx, bl.layout, x, currentY, maxWidth);
    }
    currentY += bl.height;
    if (i < blockLayouts.length - 1) {
      const nextBl = blockLayouts[i + 1];
      // Skip divider line adjacent to Uses sections
      if (bl.type !== 'uses' && nextBl.type !== 'uses') {
        const lineY = currentY + 6;
        ctx.strokeStyle = 'rgba(58, 42, 10, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 8, lineY);
        ctx.lineTo(x + maxWidth - 8, lineY);
        ctx.stroke();
      }
      currentY += 12;
    }
  }
}

// ============ Auto-scale + draw content ============

function drawCardContent(ctx, blocks, customIcons, x, y, maxWidth, maxHeight, maxFontSize, minFontSize, iconSizeOffset, convRowGap, convTextScale) {
  if (!blocks || blocks.length === 0) return;

  let bestLayout = null;
  let bestFontSize = maxFontSize;
  let bestIconSize = maxFontSize + iconSizeOffset;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 0.5) {
    const iconSize = fontSize + iconSizeOffset;
    const layout = layoutBlocks(ctx, blocks, fontSize, iconSize, maxWidth, convRowGap, convTextScale);
    if (layout.totalHeight <= maxHeight) {
      bestLayout = layout;
      bestFontSize = fontSize;
      bestIconSize = iconSize;
      break;
    }
  }

  if (!bestLayout) {
    bestFontSize = minFontSize;
    bestIconSize = minFontSize + iconSizeOffset;
    bestLayout = layoutBlocks(ctx, blocks, minFontSize, bestIconSize, maxWidth, convRowGap, convTextScale);
  }

  // Vertically center in available space
  const startY = y + (maxHeight - bestLayout.totalHeight) / 2;
  drawBlocks(ctx, bestLayout.layouts, x, startY, maxWidth, bestFontSize, bestIconSize, customIcons);
}

function getBlocksFromData(data) {
  if (data?.blocks !== undefined) return data.blocks;
  const blocks = [];
  if (data?.text) blocks.push({ id: 'legacy_t', type: 'text', content: data.text });
  if (data?.conversions) {
    data.conversions.forEach((c, i) => {
      blocks.push({ id: `legacy_c${i}`, type: 'conversion', input: c.input, output: c.output });
    });
  }
  return blocks;
}

// ============ Trait section (large circle with a suit icon) ============

function drawTraitSection(ctx, x, y, w, h, suit, number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2 - 8;
  ctx.lineWidth = 6;
  if (number) {
    ctx.strokeStyle = '#3a2a0a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#3a2a0a';
    ctx.font = `${Math.round(r * 1.1)}px ${RYE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), cx, cy + r * 0.06);
    return;
  }
  if (suit === 'blank') {
    ctx.strokeStyle = '#3a2a0a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  ctx.strokeStyle = (suit && SUIT_COLORS[suit]) || SUIT_COLORS.mask;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const url = suit && SUIT_URLS[suit];
  if (url) {
    const img = getCachedImage(url);
    if (img) {
      const box = r * 1.5;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      let dw = box, dh = box;
      if (iw && ih) {
        const ar = iw / ih;
        if (ar > 1) dh = box / ar; else dw = box * ar;
      }
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    }
  }
}

// ============ Sequence section (card icons, 4 across) ============

function drawSequence(ctx, seqList, x, y, w, maxH, customIcons) {
  const cols = 4;
  const gap = 8;
  const count = seqList.length;
  if (count === 0) return;
  const rows = Math.ceil(count / cols);
  let iconW = (w - (cols - 1) * gap) / cols;
  const maxRowH = (maxH - (rows - 1) * gap) / rows;
  if (iconW * 1.25 > maxRowH) iconW = maxRowH / 1.25;
  const iconH = iconW * 1.25;
  const gridH = rows * iconH + (rows - 1) * gap;
  const startY = y + (maxH - gridH) / 2;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const itemsThisRow = r === rows - 1 ? (count - (rows - 1) * cols) : cols;
    const rowW = itemsThisRow * iconW + (itemsThisRow - 1) * gap;
    const startX = x + (w - rowW) / 2;
    const ix = startX + c * (iconW + gap);
    const iy = startY + r * (iconH + gap);
    const type = seqList[i];
    if (type && type.startsWith('custom_')) {
      const cu = getCustomIconUrl(type, customIcons);
      const img = getCachedImage(cu);
      if (img) ctx.drawImage(img, ix, iy, iconW, iconW);
    } else {
      drawBravadoIcon(ctx, type, ix, iy, iconW);
    }
  }
}

// ============ Card renderers ============

export function drawBravadoItemsCard(ctx, data, w, h, bgColor, bgImage) {
  const { title = '', imageUrl = '', customIcons = [], cost = '', merchant = '' } = data || {};
  const blocks = getBlocksFromData(data);

  // Background
  drawCardBackground(ctx, w, h, 8, bgColor, bgImage, getCachedImage);
  roundRect(ctx, 0, 0, w, h, 8);
  ctx.strokeStyle = '#3a2a0a';
  ctx.lineWidth = 2;
  ctx.stroke();

  const pad = 16;
  const titleFont = 30;
  const titleAreaH = merchant ? 74 : 56;

  // Optional dice slots (die faces above the title, sized as if 6 across)
  let topOffset = 0;
  const dice = Array.isArray(data.dice) ? data.dice.filter(v => v >= 1 && v <= 6) : [];
  const diceCount = Math.min(6, dice.length);
  if (diceCount > 0) {
    const dGap = 8;
    const availWd = w - pad * 2;
    const boxW = Math.min(80, (availWd - dGap * 5) / 6);
    const totalWd = diceCount * boxW + (diceCount - 1) * dGap;
    const startX = pad + (availWd - totalWd) / 2;
    for (let i = 0; i < diceCount; i++) {
      drawDieFace(ctx, startX + i * (boxW + dGap), pad, boxW, dice[i]);
    }
    topOffset = boxW + 10;
  }

  // Cost block width (top-right)
  let costBlockW = 0;
  const costIconSize = 40;
  const costGap = 8;
  const costFont = 56;
  if (cost) {
    ctx.font = `${costFont}px ${RYE}`;
    const costTextW = ctx.measureText(cost).width;
    costBlockW = costIconSize + costGap + costTextW;
  }

  // Title centered in its section (left of cost)
  const costSectionW = cost ? costBlockW + 24 : 0;
  const titleSectionW = w - pad * 2 - costSectionW;
  const titleSectionX = pad;

  ctx.fillStyle = '#3a2a0a';
  ctx.font = `${titleFont}px ${TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title || 'Item Name', titleSectionX + titleSectionW / 2, pad + topOffset + titleFont);

  // Merchant subtitle (small italics under the title)
  if (merchant) {
    ctx.fillStyle = 'rgba(58, 42, 10, 0.7)';
    ctx.font = `italic 16px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(merchant, titleSectionX + titleSectionW / 2, pad + topOffset + titleFont + 18);
  }

  // Cost (top-right) — vertically centered in title area
  if (cost) {
    const costSectionX = w - pad - costSectionW;
    const costX = costSectionX + (costSectionW - costBlockW) / 2;
    const costCenterY = titleAreaH / 2 + 6 + topOffset;
    const creditsImg = getCachedImage(CREDITS_URL);
    if (creditsImg) ctx.drawImage(creditsImg, costX, costCenterY - costIconSize / 2, costIconSize, costIconSize);
    ctx.fillStyle = '#EED22D';
    ctx.font = `bold ${costFont}px ${BODY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cost, costX + costIconSize + costGap, costCenterY);
  }

  // Content area
  const y = titleAreaH + topOffset;
  const pb = 16, gap = 12;
  const contentH = h - y - pb;

  // Trait block: text left, large suit circle right
  const traitBlock = blocks.find(b => b.type === 'trait');
  if (traitBlock) {
    const contentW = w - 2 * pad;
    const halfW = contentW / 2;
    drawCardContent(ctx, [{ id: 'trait_t', type: 'text', content: traitBlock.content || '' }], customIcons, pad, y, halfW - gap / 2, contentH, 32, 14, 8);
    drawTraitSection(ctx, pad + halfW + gap / 2, y, halfW - gap / 2, contentH, traitBlock.suit, traitBlock.number);
    return;
  }

  const imgW = imageUrl ? 130 : 0;
  const textW = w - 2 * pad - imgW - (imageUrl ? gap : 0);

  // Image (contained)
  if (imageUrl) {
    const img = getCachedImage(imageUrl);
    if (img) {
      const scale = Math.min(imgW / img.width, contentH / img.height, 1);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, pad + (imgW - dw) / 2, y + (contentH - dh) / 2, dw, dh);
    }
  }

  // Text + conversions
  const textX = pad + imgW + (imageUrl ? gap : 0);
  drawCardContent(ctx, blocks, customIcons, textX, y, textW, contentH, 32, 14, 8);
}

function drawRewards(ctx, items, x, y, w, h) {
  // Counts of 3 or fewer expand to individual icons (no number);
  // larger counts render as one icon + the number.
  const cells = [];
  for (const it of items) {
    if (it.count <= 3) {
      for (let k = 0; k < it.count; k++) cells.push({ url: it.url, count: null });
    } else {
      cells.push({ url: it.url, count: it.count });
    }
  }
  if (cells.length === 0) return;

  const cellGap = 10;
  let iconSize = 84;
  if (h > 0 && iconSize > h) iconSize = h;
  const fontRatio = 0.66;
  let font, cellWidths, totalW;
  do {
    font = Math.round(iconSize * fontRatio);
    ctx.font = `bold ${font}px ${BODY}`;
    cellWidths = cells.map(c => c.count == null ? iconSize : iconSize + 8 + ctx.measureText(String(c.count)).width);
    totalW = cellWidths.reduce((a, b) => a + b, 0) + cellGap * (cells.length - 1);
    if (totalW <= w) break;
    iconSize -= 4;
  } while (iconSize > 24);

  let cx = x + (w - totalW) / 2;
  const cy = y + (h - iconSize) / 2;
  for (let i = 0; i < cells.length; i++) {
    const img = getCachedImage(cells[i].url);
    if (img) ctx.drawImage(img, cx, cy, iconSize, iconSize);
    if (cells[i].count != null) {
      ctx.fillStyle = '#3a2a0a';
      ctx.font = `bold ${font}px ${BODY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cells[i].count), cx + iconSize + 8, cy + iconSize / 2);
    }
    cx += cellWidths[i] + cellGap;
  }
}

export function drawBravadoPetsCard(ctx, data, w, h, bgColor, bgImage) {
  const { title = '', merchant = '', text = '', customIcons = [], sequence = [], rewards = {} } = data || {};
  const { traps = 0, points = 0, coins = 0 } = rewards || {};

  drawCardBackground(ctx, w, h, 8, bgColor, bgImage, getCachedImage);
  roundRect(ctx, 0, 0, w, h, 8);
  ctx.strokeStyle = '#3a2a0a';
  ctx.lineWidth = 2;
  ctx.stroke();

  const pad = 20;
  let y = 16;

  // Header: title (larger, shrinks to fit) + optional merchant subtitle
  ctx.fillStyle = '#3a2a0a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let titleFont = 38;
  const maxTitleW = w - pad * 2;
  ctx.font = `${titleFont}px ${TITLE}`;
  while (titleFont > 16 && ctx.measureText(title || 'Trinket Name').width > maxTitleW) {
    titleFont -= 1;
    ctx.font = `${titleFont}px ${TITLE}`;
  }
  ctx.fillText(title || 'Trinket Name', w / 2, y + titleFont);
  y += titleFont + 6;

  if (merchant) {
    ctx.fillStyle = 'rgba(58, 42, 10, 0.7)';
    ctx.font = `italic 14px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText(merchant, w / 2, y + 14);
    y += 22;
  }

  // Sequence (card icons, 4 across)
  const seqH = 150;
  const seqList = (sequence || []).filter(s => s);
  if (seqList.length > 0) {
    drawSequence(ctx, seqList, pad, y, w - pad * 2, seqH, customIcons);
  }
  y += seqH;

  // Rewards (points / traps / coins)
  const rewardItems = [];
  if (points > 0) rewardItems.push({ url: POINTS_URL, count: points });
  if (traps > 0) rewardItems.push({ url: TRAP_URL, count: traps });
  if (coins > 0) rewardItems.push({ url: CREDITS_URL, count: coins });

  const hasText = !!(text && text.trim());
  const innerBottom = h - pad;

  if (hasText) {
    const rewardsReserve = rewardItems.length > 0 ? 100 : 0;
    const textH = Math.max(0, innerBottom - y - rewardsReserve);
    drawCardContent(ctx, [{ type: 'text', content: text }], customIcons, pad, y, w - pad * 2, textH, 44, 14, 8);
    y += textH;
    if (rewardItems.length > 0) drawRewards(ctx, rewardItems, pad, y, w - pad * 2, innerBottom - y);
  } else if (rewardItems.length > 0) {
    drawRewards(ctx, rewardItems, pad, y, w - pad * 2, Math.max(0, innerBottom - y));
  }
}

// ============ Beast (landscape stat card) ============

function drawStatBox(ctx, x, y, w, h, label, iconType, value) {
  ctx.strokeStyle = '#3a2a0a';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 4);
  ctx.stroke();

  ctx.fillStyle = '#3a2a0a';
  ctx.font = `bold 11px ${BODY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, x + 8, y + 15);

  const innerTop = y + 20;
  const innerH = h - innerTop + y;
  const iconSize = Math.min(innerH - 6, 38);
  const iconY = innerTop + (innerH - iconSize) / 2;
  drawBravadoIcon(ctx, iconType, x + 10, iconY, iconSize);

  const valFont = Math.min(innerH * 0.7, 28);
  ctx.fillStyle = '#3a2a0a';
  ctx.font = `bold ${valFont}px ${BODY}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(value != null ? String(value) : '0', x + w - 12, innerTop + innerH / 2 + 2);
}

export function drawBravadoBeastCard(ctx, data, w, h, bgColor, bgImage) {
  const { title = '', health = 0, power = 0, ability = '', rewards = {}, customIcons = [] } = data || {};
  const { points = 0, traps = 0, coins = 0 } = rewards || {};

  drawCardBackground(ctx, w, h, 8, bgColor, bgImage, getCachedImage);
  roundRect(ctx, 0, 0, w, h, 8);
  ctx.strokeStyle = '#3a2a0a';
  ctx.lineWidth = 2;
  ctx.stroke();

  const pad = 16;
  const gap = 12;

  // Title (Naluka)
  ctx.fillStyle = '#3a2a0a';
  let titleFont = 30;
  const maxTitleW = w - pad * 2;
  ctx.font = `${titleFont}px ${TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  while (titleFont > 16 && ctx.measureText(title || 'Beast Name').width > maxTitleW) {
    titleFont -= 1;
    ctx.font = `${titleFont}px ${TITLE}`;
  }
  ctx.fillText(title || 'Beast Name', w / 2, pad + titleFont);

  // Stats row (at the bottom)
  const statsH = 60;
  const statsY = h - pad - statsH;
  const statBoxW = (w - pad * 2 - gap) / 2;
  drawStatBox(ctx, pad, statsY, statBoxW, statsH, 'HEALTH', 'heart', health);
  drawStatBox(ctx, pad + statBoxW + gap, statsY, statBoxW, statsH, 'POWER', 'fangs', power);

  // Rewards box (above the stats)
  const rewardsH = 72;
  const rewardsY = statsY - 10 - rewardsH;
  ctx.strokeStyle = '#3a2a0a';
  ctx.lineWidth = 1.5;
  roundRect(ctx, pad, rewardsY, w - pad * 2, rewardsH, 4);
  ctx.stroke();
  ctx.fillStyle = '#3a2a0a';
  ctx.font = `bold 12px ${BODY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('REWARDS', pad + 8, rewardsY + 15);

  const rewardItems = [];
  if (points > 0) rewardItems.push({ url: POINTS_URL, count: points });
  if (traps > 0) rewardItems.push({ url: TRAP_URL, count: traps });
  if (coins > 0) rewardItems.push({ url: CREDITS_URL, count: coins });
  if (rewardItems.length > 0) {
    drawRewards(ctx, rewardItems, pad + 6, rewardsY + 20, w - pad * 2 - 12, rewardsH - 24);
  }

  // Ability box (fills the top/middle)
  const abilTop = pad + titleFont + 14;
  const abilH = rewardsY - abilTop - 10;
  if (abilH > 28) {
    ctx.strokeStyle = '#3a2a0a';
    ctx.lineWidth = 1.5;
    roundRect(ctx, pad, abilTop, w - pad * 2, abilH, 4);
    ctx.stroke();
    ctx.fillStyle = '#3a2a0a';
    ctx.font = `bold 12px ${BODY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('ABILITY', pad + 8, abilTop + 15);
    const textTop = abilTop + 22;
    const textH = abilH - 28;
    if (ability && textH > 0) {
      drawCardContent(ctx, [{ type: 'text', content: ability }], customIcons, pad + 10, textTop, w - pad * 2 - 20, textH, 16, 10, 4);
    }
  }
}

// ============ Upgrade (square number card) ============

const UPGRADE_CARD_ICON_RE = /^(num_|arrow_|coin_|equals|blank|plus_card|mask|feather|fishbone)/;

function getUpgradeIcons(data) {
  if (Array.isArray(data?.icons) && data.icons.length > 0) return data.icons.slice(0, 4);
  if (data?.mode === 'icon' || data?.iconType || data?.iconUrl) {
    return [{ type: data.iconType || 'antler', url: data.iconUrl || '' }];
  }
  return [{ type: 'antler', url: '' }];
}

function drawUpgradeIconInCell(ctx, icon, cellX, cellY, cellW, cellH, innerPad = 6) {
  const availW = cellW - innerPad * 2;
  const availH = cellH - innerPad * 2;
  if (availW <= 0 || availH <= 0) return;

  if (icon?.url) {
    const img = getCachedImage(icon.url);
    if (img && img.width && img.height) {
      const ar = img.width / img.height;
      let iw, ih;
      if (ar >= availW / availH) { iw = availW; ih = availW / ar; }
      else { ih = availH; iw = availH * ar; }
      ctx.drawImage(img, cellX + (cellW - iw) / 2, cellY + (cellH - ih) / 2, iw, ih);
    }
    return;
  }

  const type = icon?.type || 'antler';
  const isCard = UPGRADE_CARD_ICON_RE.test(type);
  let size;
  if (type === 'antler') size = Math.min(availW, availH) / 1.5;
  else if (isCard) size = Math.min(availW, availH / 1.25);
  else size = Math.min(availW, availH);
  const nominalH = isCard ? size * 1.25 : size;
  const x = cellX + (cellW - size) / 2;
  const y = cellY + (cellH - nominalH) / 2;
  drawBravadoIcon(ctx, type, x, y, size);
}

// 1 icon fills the card; 2 sit in the upper-left & lower-right corners;
// 3 or 4 arrange in a 2x2 grid (smaller than the 2-icon layout).
function drawUpgradeIcons(ctx, icons, w, h) {
  const pad = 22;
  const inner = Math.min(w, h) - pad * 2;
  const count = Math.min(4, Math.max(1, icons.length));

  if (count === 1) {
    drawUpgradeIconInCell(ctx, icons[0], pad, pad, inner, inner, 0);
    return;
  }

  if (count === 2) {
    const gap = 10;
    const box = (inner - gap) / 2;
    drawUpgradeIconInCell(ctx, icons[0], pad, pad, box, box, 6);
    drawUpgradeIconInCell(ctx, icons[1], pad + box + gap, pad + box + gap, box, box, 6);
    return;
  }

  const inset = 14;
  const gridInner = inner - inset * 2;
  const gap = 14;
  const cell = (gridInner - gap) / 2;
  const origin = pad + inset;
  const positions = [[0, 0], [1, 0], [0, 1], [1, 1]];
  for (let i = 0; i < count; i++) {
    const [cx, cy] = positions[i];
    drawUpgradeIconInCell(ctx, icons[i], origin + cx * (cell + gap), origin + cy * (cell + gap), cell, cell, 6);
  }
}

export function drawBravadoUpgradeCard(ctx, data, w, h, bgColor, bgImage) {
  const { mode = 'number', value = 1 } = data || {};

  if (bgImage) {
    const img = getCachedImage(bgImage);
    if (img) ctx.drawImage(img, 0, 0, w, h);
    else if (bgColor) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, w, h); }
  } else if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
  }

  roundRect(ctx, 0, 0, w, h, 8);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.stroke();

  if (mode === 'icon') {
    drawUpgradeIcons(ctx, getUpgradeIcons(data), w, h);
    return;
  }

  const text = String(value || 1);
  let fontSize = Math.floor(h * 0.82);
  ctx.font = `bold ${fontSize}px ${BODY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxW = w * 0.82;
  while (fontSize > 24 && ctx.measureText(text).width > maxW) {
    fontSize -= 4;
    ctx.font = `bold ${fontSize}px ${BODY}`;
  }
  ctx.fillStyle = '#000000';
  ctx.fillText(text, w / 2, h / 2);
}

// ============ Character Sheet (half-page western character sheet) ============

export function drawBravadoCharacterSheetCard(ctx, data, w, h, bgColor, bgImage) {
  const { title = '', services = [], abilities = [], flavorText = '', customIcons = [] } = data || {};

  // Background
  drawCardBackground(ctx, w, h, 12, bgColor, bgImage, getCachedImage);

  // Outer border
  roundRect(ctx, 0, 0, w, h, 12);
  ctx.strokeStyle = '#3a2a0a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner decorative border
  roundRect(ctx, 10, 10, w - 20, h - 20, 8);
  ctx.strokeStyle = '#3a2a0a';
  ctx.lineWidth = 1;
  ctx.stroke();

  const pad = 28;

  // Title
  ctx.fillStyle = '#3a2a0a';
  ctx.font = `38px ${TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title || 'Merchant Name', w / 2, pad + 30);

  // Decorative divider under title
  const divY = pad + 46;
  ctx.strokeStyle = '#3a2a0a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad + 16, divY);
  ctx.lineTo(w / 2 - 16, divY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w / 2 + 16, divY);
  ctx.lineTo(w - pad - 16, divY);
  ctx.stroke();
  ctx.fillStyle = '#3a2a0a';
  ctx.beginPath();
  ctx.moveTo(w / 2, divY - 6);
  ctx.lineTo(w / 2 + 6, divY);
  ctx.lineTo(w / 2, divY + 6);
  ctx.lineTo(w / 2 - 6, divY);
  ctx.closePath();
  ctx.fill();

  // === Services section (2x2 boxes) ===
  const contentTop = divY + 32;
  const colGap = 10, rowGap = 8;
  const servicesH = 196;

  ctx.fillStyle = '#3a2a0a';
  ctx.font = `22px ${TITLE}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('SERVICES', pad, contentTop + 4);

  const servicesTop = contentTop + 24;
  const boxW = (w - pad * 2 - colGap) / 2;
  const boxH = (servicesH - rowGap) / 2;
  const svcList = services || [];
  for (let i = 0; i < Math.min(4, svcList.length); i++) {
    const svc = svcList[i];
    if (!svc) continue;
    const r = Math.floor(i / 2);
    const c = i % 2;
    const bx = pad + c * (boxW + colGap);
    const by = servicesTop + r * (boxH + rowGap);

    ctx.strokeStyle = '#3a2a0a';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, boxW, boxH, 4);
    ctx.stroke();

    // Title
    ctx.fillStyle = '#3a2a0a';
    ctx.font = `bold 16px ${BODY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(svc.title || 'Service', bx + 8, by + 18);

    ctx.strokeStyle = 'rgba(58, 42, 10, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(bx + 6, by + 24);
    ctx.lineTo(bx + boxW - 6, by + 24);
    ctx.stroke();

    // Large coin cost on the left
    const coinSize = Math.min(boxH - 40, 38);
    const coinAreaTop = by + 28;
    const coinAreaH = boxH - 32;
    const coinY = coinAreaTop + (coinAreaH - coinSize) / 2;
    const coinX = bx + 10;
    const costIconType = svc.costIcon || 'coin';
    if (costIconType.startsWith('custom_')) {
      const costImg = getCachedImage(getCustomIconUrl(costIconType, customIcons));
      if (costImg) ctx.drawImage(costImg, coinX, coinY, coinSize, coinSize);
    } else {
      drawBravadoIcon(ctx, costIconType, coinX, coinY, coinSize);
    }
    const costFont = Math.min(boxH * 0.38, 26);
    ctx.fillStyle = '#EED22D';
    ctx.font = `bold ${costFont}px ${BODY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(svc.cost != null ? String(svc.cost) : '', coinX + coinSize + 4, coinY + coinSize / 2);

    // Text on the right of the coin
    const textX = bx + coinSize + 30;
    const textW = bx + boxW - 8 - textX;
    if (textW > 20 && svc.text) {
      drawCardContent(ctx, [{ type: 'text', content: svc.text }], customIcons, textX, coinAreaTop, textW, coinAreaH, 14, 8, 2);
    }
  }

  // === Lower region: Abilities (full-width bordered boxes) + flavor (after) ===
  const innerBottom = h - 14;
  const lowerTop = servicesTop + servicesH + 30;

  ctx.fillStyle = '#3a2a0a';
  ctx.font = `22px ${TITLE}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ABILITIES', pad, lowerTop + 4);

  const abilList = (abilities || []).filter(a => a && (a.title || a.text));
  const abilW = w - pad * 2;
  const abilFontSize = 14;
  const abilIconSize = 16;
  const abilPadX = 8;
  const contentMaxW = abilW - abilPadX * 2;
  const titleH = 22;
  const dividerGap = 8;
  let ay = lowerTop + 24;
  for (const abil of abilList) {
    const elements = parseBravadoText(abil.text || '');
    const layout = layoutElements(ctx, elements, abilFontSize, abilIconSize, contentMaxW);
    const contentH = layout.totalHeight;
    const boxH = titleH + dividerGap + 6 + Math.max(contentH, 0) + 8;

    ctx.strokeStyle = '#3a2a0a';
    ctx.lineWidth = 1.5;
    roundRect(ctx, pad, ay, abilW, boxH, 4);
    ctx.stroke();

    ctx.fillStyle = '#3a2a0a';
    ctx.font = `bold 16px ${BODY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(abil.title || 'Ability', pad + abilPadX, ay + 16);

    ctx.strokeStyle = 'rgba(58, 42, 10, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(pad + 6, ay + titleH);
    ctx.lineTo(pad + abilW - 6, ay + titleH);
    ctx.stroke();

    const contentY = ay + titleH + dividerGap + 6;
    drawLayout(ctx, layout, pad + abilPadX, contentY, contentMaxW, abilFontSize, abilIconSize, customIcons, 'left');

    ay += boxH + 8;
    if (ay > innerBottom - 30) break;
  }

  // === Flavor text (flows after the abilities, full width) ===
  if (flavorText && ay < innerBottom) {
    const flavorY = ay + 6;
    const flavorW = w - pad * 2;
    ctx.fillStyle = 'rgba(58, 42, 10, 0.75)';
    ctx.font = `italic 15px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const words = flavorText.split(' ');
    let line = '';
    const textLines = [];
    for (const word of words) {
      const testLine = line ? line + ' ' + word : word;
      if (ctx.measureText(testLine).width > flavorW && line) {
        textLines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) textLines.push(line);
    const lineH = 18;
    let fy = flavorY + lineH * 0.75;
    for (let i = 0; i < textLines.length; i++) {
      ctx.fillText(textLines[i], w / 2, fy);
      fy += lineH;
      if (fy > innerBottom) break;
    }
  }
}

// ============ Export (offscreen canvas → toDataURL) ============

export async function renderCardToCanvas(template, data, scale = 2, bgColor, bgImage) {
  await document.fonts.ready;

  if (template === 'playing_card') {
    return renderPlayingCardToCanvas(data, scale, bgColor, bgImage);
  }

  // Canvas-native templates rendered via the DOM card renderer
  if (template === 'clans' || template === 'tactical') {
    return renderDomCardToCanvas(template, data, scale, bgColor, bgImage);
  }

  if (template === 'glimpses') {
    return renderGlimpsesToCanvas(data, scale);
  }

  if (template === 'free_canvas') {
    return renderFreeCanvasToCanvas(data, scale, bgColor, bgImage);
  }

  if (template === 'seven_wonders') {
    return renderSevenWondersToCanvas(data, scale);
  }

  await preloadCardImages(data);
  if (bgImage) await loadImage(bgImage);

  let w, h;
  if (template === 'bravado_items') { w = 504; h = 360; }
  else if (template === 'bravado_pets') { w = 360; h = 504; }
  else if (template === 'bravado_character_sheet') { w = 550; h = 850; }
  else if (template === 'bravado_beast') { w = 504; h = 360; }
  else if (template === 'bravado_upgrade') { w = 420; h = 420; }
  else return null;

  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  if (template === 'bravado_items') drawBravadoItemsCard(ctx, data, w, h, bgColor, bgImage);
  else if (template === 'bravado_pets') drawBravadoPetsCard(ctx, data, w, h, bgColor, bgImage);
  else if (template === 'bravado_character_sheet') drawBravadoCharacterSheetCard(ctx, data, w, h, bgColor, bgImage);
  else if (template === 'bravado_beast') drawBravadoBeastCard(ctx, data, w, h, bgColor, bgImage);
  else if (template === 'bravado_upgrade') drawBravadoUpgradeCard(ctx, data, w, h, bgColor, bgImage);

  return canvas;
}

export async function exportCard(template, data, { margin = false, bgColor, bgImage } = {}) {
  const scale = 3;
  const canvas = await renderCardToCanvas(template, data, scale, bgColor, bgImage);
  if (!canvas) return null;

  // Rotate landscape cards 90° clockwise for export (free canvas keeps its native orientation)
  let finalCanvas = canvas;
  if (template !== 'free_canvas' && canvas.width > canvas.height) {
    const rotated = document.createElement('canvas');
    rotated.width = canvas.height;
    rotated.height = canvas.width;
    const rctx = rotated.getContext('2d');
    rctx.translate(rotated.width, 0);
    rctx.rotate(Math.PI / 2);
    rctx.drawImage(canvas, 0, 0);
    finalCanvas = rotated;
  }

  if (margin) {
    const mp = 12 * scale;
    const padded = document.createElement('canvas');
    padded.width = finalCanvas.width + mp * 2;
    padded.height = finalCanvas.height + mp * 2;
    const pctx = padded.getContext('2d');
    if (bgColor) {
      pctx.fillStyle = bgColor;
      pctx.fillRect(0, 0, padded.width, padded.height);
    }
    pctx.drawImage(finalCanvas, mp, mp);
    return padded;
  }
  return finalCanvas;
}