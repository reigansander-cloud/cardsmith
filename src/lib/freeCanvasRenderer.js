// Canvas renderer for the Free Canvas template.
// Used for export — the live editor is HTML-based (FreeCanvasCanvas.jsx).

import { drawCardBackground } from './canvasBg';
import { loadImage, getCachedImage } from './domCardCanvasRenderer';
import { imageEffectsFilter, colorizeImageData } from './imageEffects';
import { getAnchorPoint, buildConnectionPath, getConnectionArrows } from './connectionPaths';
import { PIP_POSITIONS, parseContentTokens, parseRichTokens } from './dicePips';
import { buildGridSVG, svgToImage } from './gridLayerRenderer';
import { buildStyledStrokes } from './shapeLineStyle';

const INTER = '"Inter", sans-serif';
const gridImageCache = new Map();

function condenseCosts(costs = []) {
  const out = [];
  for (const c of costs) {
    const last = out[out.length - 1];
    if (last && last.url === c.url) last.count += 1;
    else out.push({ url: c.url, name: c.name, count: 1 });
  }
  return out;
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

export async function preloadFreeCanvasImages(data) {
  const urls = [];
  const w = data?.cardWidth || 360, h = data?.cardHeight || 504;
  for (const el of (data?.elements || [])) {
    if (el.type === 'image' && el.url) {
      urls.push(el.url);
    } else if (el.type === 'text' && el.content) {
      const re = /\[icon:([^\]]+)\]/g;
      let m;
      while ((m = re.exec(el.content)) !== null) urls.push(m[1].trim());
    } else if (el.type === 'costbar') {
      for (const c of (el.costs || [])) if (c.url) urls.push(c.url);
    } else if (el.type === 'grid') {
      const pxW = el.width;
      const pxH = el.height;
      const svg = buildGridSVG(el.grids || [], el.connections || [], pxW, pxH, el.color || '#3a2a0a', false);
      if (svg) {
        const img = await svgToImage(svg);
        if (img) gridImageCache.set(el.id, img);
      }
    }
  }
  await Promise.all(urls.map(loadImage));
}

export function drawFreeCanvasCard(ctx, data, w, h, bgColor, bgImage, options) {
  const { elements = [] } = data || {};

  if (!options?.skipBackground) {
    drawCardBackground(ctx, w, h, 8, bgColor, bgImage, getCachedImage);
    roundRect(ctx, 0, 0, w, h, 8);
    ctx.strokeStyle = '#3a2a0a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (!options?.skipConnections) {
  // Draw connection lines behind elements
  const elementHeightFn = (el) => {
    if (el.type === 'image') {
      const ar = el.aspectRatio || (el.height ? el.width / el.height : 1);
      return el.width / ar;
    }
    return el.height;
  };
  for (const conn of (data?.connections || [])) {
    const fromEl = elements.find(e => e.id === conn.fromId);
    const toEl = elements.find(e => e.id === conn.toId);
    if (!fromEl || !toEl) continue;
    const a = getAnchorPoint(fromEl, conn.fromPoint, elementHeightFn, w, h);
    const b = getAnchorPoint(toEl, conn.toPoint, elementHeightFn, w, h);
    const ax = a.x, ay = a.y;
    const bx = b.x, by = b.y;
    const obstacles = elements
      .filter(el => el.id !== conn.fromId && el.id !== conn.toId)
      .map(el => {
        const elH = elementHeightFn(el);
        return {
          x1: el.x,
          y1: el.y,
          x2: el.x + el.width,
          y2: el.y + elH,
        };
      });
    const path = buildConnectionPath(ax, ay, bx, by, conn.fromPoint, conn.toPoint, conn.style, 12, obstacles);
    ctx.lineWidth = conn.width || 2;
    ctx.strokeStyle = conn.color || '#000000';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    try { ctx.stroke(new Path2D(path)); } catch (e) {}

    if (data?.arrows) {
      const arrows = getConnectionArrows(ax, ay, bx, by, conn.fromPoint, conn.toPoint, conn.style, conn.id, 3, 8 + (conn.width || 2), obstacles);
      for (const arrow of arrows) {
        const size = 6;
        const angle = Math.atan2(arrow.dy, arrow.dx);
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const tipX = arrow.x + cos * size, tipY = arrow.y + sin * size;
        const baseX = arrow.x - cos * size, baseY = arrow.y - sin * size;
        const headLen = size * 0.7;
        const ha = 0.5;
        const h1 = angle + Math.PI - ha;
        const h2 = angle + Math.PI + ha;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(tipX, tipY);
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + Math.cos(h1) * headLen, tipY + Math.sin(h1) * headLen);
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + Math.cos(h2) * headLen, tipY + Math.sin(h2) * headLen);
        ctx.stroke();
      }
    }
  }

  }

  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === 'folder') continue;
    const x = el.x;
    const y = el.y;
    const elW = el.width;
    const rot = (el.rotation || 0) * Math.PI / 180;
    ctx.save();
    ctx.globalAlpha = el.opacity != null ? el.opacity : 1;

    if (el.type === 'image') {
      const img = getCachedImage(el.url);
      if (img) {
        const aspectRatio = el.aspectRatio || (el.height ? el.width / el.height : img.width / img.height);
        const elH = elW / aspectRatio;
        ctx.save();
        if (rot) { ctx.translate(x + elW / 2, y + elH / 2); ctx.rotate(rot); }
        const dx = rot ? -elW / 2 : x;
        const dy = rot ? -elH / 2 : y;
        if (el.effects?.colorize) {
          const off = document.createElement('canvas');
          off.width = Math.max(1, Math.round(img.naturalWidth || elW));
          off.height = Math.max(1, Math.round(img.naturalHeight || elH));
          const offCtx = off.getContext('2d');
          offCtx.drawImage(img, 0, 0, off.width, off.height);
          try {
            const imageData = offCtx.getImageData(0, 0, off.width, off.height);
            colorizeImageData(imageData, el.effects.colorize.color || '#ff0000', el.effects.colorize.amount ?? 50);
            offCtx.putImageData(imageData, 0, 0);
          } catch (e) {}
          ctx.filter = imageEffectsFilter(el);
          ctx.drawImage(off, dx, dy, elW, elH);
          ctx.filter = 'none';
        } else {
          ctx.filter = imageEffectsFilter(el);
          ctx.drawImage(img, dx, dy, elW, elH);
          ctx.filter = 'none';
        }
        if (el.effects?.frame) {
          const fw = Math.max(1, el.effects.frame.width);
          ctx.lineWidth = fw;
          ctx.strokeStyle = el.effects.frame.color || '#000000';
          ctx.strokeRect(dx + fw / 2, dy + fw / 2, elW - fw, elH - fw);
        }
        ctx.restore();
      }
    } else if (el.type === 'text') {
      const elH = el.height;
      const fontSize = el.fontSize || 14;
      const color = el.color || '#000000';
      const align = el.align || 'left';
      const bold = el.bold;
      const italic = el.italic;
      ctx.save();
      if (rot) { ctx.translate(x + elW / 2, y + elH / 2); ctx.rotate(rot); }
      const dx = rot ? -elW / 2 : x;
      const dy = rot ? -elH / 2 : y;
      if (el.border) {
        ctx.lineWidth = el.borderWidth || 2;
        ctx.strokeStyle = el.color || '#000000';
        ctx.strokeRect(dx, dy, elW, elH);
      }
      ctx.beginPath();
      ctx.rect(dx, dy, elW, elH);
      ctx.clip();

      const fontFor = (fs, b, i) => `${i ? 'italic ' : ''}${b ? 'bold ' : ''}${fs}px ${el.fontFamily || INTER}`;
      const wrap = (fs) => {
        ctx.font = fontFor(fs, bold, italic);
        const lh = fs * 1.3;
        const iconS = fs * 1.35;
        const spaceW = ctx.measureText(' ').width;
        const iconGap = spaceW * 0.35;
        const result = [];
        for (const rawLine of (el.content || '').split('\n')) {
          const tokens = parseRichTokens(rawLine);
          const units = [];
          for (const tok of tokens) {
            const b = bold || tok.bold;
            const it = italic || tok.italic;
            const un = el.underline || tok.underline;
            if (tok.type === 'icon') {
              if (units.length && units[units.length - 1].type === 'word') {
                units[units.length - 1].adv = units[units.length - 1].w + iconGap;
              }
              units.push({ type: 'icon', url: tok.url, w: iconS, adv: iconS + iconGap, bold: b, italic: it, underline: un });
            } else {
              ctx.font = fontFor(fs, b, it);
              for (const wd of tok.value.split(/\s+/).filter(Boolean)) {
                const ww = ctx.measureText(wd).width;
                units.push({ type: 'word', value: wd, w: ww, adv: ww + spaceW, bold: b, italic: it, underline: un });
              }
            }
          }
          const lines = [];
          let line = [];
          let lineW = 0;
          for (const u of units) {
            if (lineW + u.w > elW && line.length) { lines.push(line); line = []; lineW = 0; }
            line.push(u);
            lineW += u.adv;
          }
          if (line.length) lines.push(line);
          result.push(lines);
        }
        let totalH = 0;
        for (const lines of result) totalH += Math.max(1, lines.length) * lh;
        return { result, lh, iconS, totalH };
      };

      let fs = fontSize;
      if (el.shrinkToFit !== false) {
        while (fs > 6) {
          const m = wrap(fs);
          if (m.totalH <= elH) break;
          fs -= 1;
        }
      }
      const { result, lh, iconS } = wrap(fs);
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      let lineY = dy;
      for (const lines of result) {
        if (lines.length === 0) { lineY += lh; continue; }
        for (const ln of lines) {
          let lineWidth = 0;
          for (const u of ln) lineWidth += u.adv;
          if (ln.length) {
            const last = ln[ln.length - 1];
            if (last.type === 'word') lineWidth -= (last.adv - last.w);
          }
          let cx = align === 'center' ? dx + (elW - lineWidth) / 2 : align === 'right' ? dx + elW - lineWidth : dx;
          for (const u of ln) {
            if (u.type === 'icon') {
              const img = getCachedImage(u.url);
              if (img) ctx.drawImage(img, cx, lineY + (lh - iconS) / 2, iconS, iconS);
              cx += u.adv;
            } else {
              ctx.font = fontFor(fs, u.bold, u.italic);
              ctx.fillText(u.value, cx, lineY);
              if (u.underline) {
                const ww = ctx.measureText(u.value).width;
                ctx.strokeStyle = color;
                ctx.lineWidth = Math.max(1, fs / 12);
                ctx.beginPath();
                ctx.moveTo(cx, lineY + fs * 0.88);
                ctx.lineTo(cx + ww, lineY + fs * 0.88);
                ctx.stroke();
              }
              cx += u.adv;
            }
          }
          lineY += lh;
        }
      }
      ctx.restore();
    } else if (el.type === 'shape') {
      const elH = el.height;
      const sw = el.strokeWidth || 3;
      const color = el.color || '#000000';
      ctx.save();
      if (rot) { ctx.translate(x + elW / 2, y + elH / 2); ctx.rotate(rot); }
      const dx = rot ? -elW / 2 : x;
      const dy = rot ? -elH / 2 : y;
      ctx.lineWidth = sw;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const half = el.filled ? 0 : sw / 2;
      if (!el.filled && (el.lineStyle === 'drawn' || el.lineStyle === 'choppy')) {
        const strokes = buildStyledStrokes(el.shape, el.lineStyle, el.id);
        const opacity = el.lineStyle === 'drawn' ? 0.55 : 1;
        const ix = dx + half, iy = dy + half, iw = Math.max(0, elW - sw), ih = Math.max(0, elH - sw);
        ctx.globalAlpha = opacity * (el.opacity != null ? el.opacity : 1);
        for (const poly of strokes) {
          ctx.beginPath();
          poly.forEach(([nx, ny], j) => {
            const px = ix + nx * iw, py = iy + ny * ih;
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          });
          ctx.stroke();
        }
        ctx.globalAlpha = el.opacity != null ? el.opacity : 1;
      } else if (el.shape === 'rounded') {
        roundRect(ctx, dx - half, dy - half, elW + sw, elH + sw, Math.min(elW, elH) * 0.2);
        if (el.filled) ctx.fill(); else ctx.stroke();
      } else if (el.shape === 'rectangle') {
        if (el.filled) ctx.fillRect(dx, dy, elW, elH); else ctx.strokeRect(dx - half, dy - half, elW + sw, elH + sw);
      } else if (el.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(dx + elW / 2, dy + elH / 2, Math.max(0.5, elW / 2 + half), Math.max(0.5, elH / 2 + half), 0, 0, Math.PI * 2);
        if (el.filled) ctx.fill(); else ctx.stroke();
      } else if (el.shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(dx + elW / 2, dy - half);
        ctx.lineTo(dx + elW + half, dy + elH + half);
        ctx.lineTo(dx - half, dy + elH + half);
        ctx.closePath();
        if (el.filled) ctx.fill(); else ctx.stroke();
      } else if (el.shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(dx + elW / 2, dy - half);
        ctx.lineTo(dx + elW + half, dy + elH / 2);
        ctx.lineTo(dx + elW / 2, dy + elH + half);
        ctx.lineTo(dx - half, dy + elH / 2);
        ctx.closePath();
        if (el.filled) ctx.fill(); else ctx.stroke();
      } else if (el.shape === 'line') {
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx + elW, dy + elH);
        ctx.stroke();
      }
      if (el.pips) {
        const pips = PIP_POSITIONS[el.pips] || [];
        const pipR = Math.min(elW, elH) * 0.07;
        for (const [px, py] of pips) {
          ctx.beginPath();
          ctx.arc(dx + px * elW, dy + py * elH, pipR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    } else if (el.type === 'drawing') {
      const elH = el.height;
      ctx.save();
      if (rot) { ctx.translate(x + elW / 2, y + elH / 2); ctx.rotate(rot); }
      const dx = rot ? -elW / 2 : x;
      const dy = rot ? -elH / 2 : y;
      ctx.beginPath();
      ctx.rect(dx, dy, elW, elH);
      ctx.clip();
      for (const s of (el.strokes || [])) {
        if (!s.points || s.points.length === 0) continue;
        ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
        if (el.pixelArt) {
          const gridX = el.pixelSize || 16;
          const gridY = Math.max(1, Math.round(gridX * elH / elW));
          const cellW = elW / gridX, cellH = elH / gridY;
          ctx.fillStyle = s.color || '#000000';
          const drawCell = (gx, gy) => ctx.fillRect(dx + gx * cellW, dy + gy * cellH, Math.ceil(cellW) + 0.5, Math.ceil(cellH) + 0.5);
          for (let i = 0; i < s.points.length; i++) {
            const gx = Math.round(s.points[i].x * gridX), gy = Math.round(s.points[i].y * gridY);
            if (i === 0) { drawCell(gx, gy); continue; }
            const px = Math.round(s.points[i - 1].x * gridX), py = Math.round(s.points[i - 1].y * gridY);
            let x0 = px, y0 = py; const x1 = gx, y1 = gy;
            const ddx = Math.abs(x1 - x0), ddy = Math.abs(y1 - y0);
            const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
            let err = ddx - ddy;
            while (true) {
              drawCell(x0, y0);
              if (x0 === x1 && y0 === y1) break;
              const e2 = 2 * err;
              if (e2 > -ddy) { err -= ddy; x0 += sx; }
              if (e2 < ddx) { err += ddx; y0 += sy; }
            }
          }
        } else {
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.lineWidth = s.size || 6;
          ctx.strokeStyle = s.color || '#000000';
          ctx.fillStyle = s.color || '#000000';
          ctx.beginPath();
          ctx.moveTo(dx + s.points[0].x * elW, dy + s.points[0].y * elH);
          for (let i = 1; i < s.points.length; i++) ctx.lineTo(dx + s.points[i].x * elW, dy + s.points[i].y * elH);
          if (s.fill) ctx.fill(); else ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    } else if (el.type === 'costbar') {
      const elH = el.height;
      const costs = el.costs || [];
      if (costs.length > 0) {
        ctx.save();
        if (rot) { ctx.translate(x + elW / 2, y + elH / 2); ctx.rotate(rot); }
        const dx = rot ? -elW / 2 : x;
        const dy = rot ? -elH / 2 : y;
        ctx.fillStyle = el.color || '#000000';
        ctx.textBaseline = 'middle';
        const align = el.align || 'left';
        if (el.iconx === false) {
          const gap = Math.max(1, elH * 0.08);
          const measures = costs.map(c => {
            const img = getCachedImage(c.url);
            const iw = img ? (img.width / img.height) * elH : elH * 0.7;
            return { img, iw };
          });
          let totalW = 0;
          for (const m of measures) totalW += m.iw + gap;
          totalW -= gap;
          let cx = align === 'center' ? dx + (elW - totalW) / 2 : align === 'right' ? dx + elW - totalW : dx;
          for (let i = 0; i < costs.length; i++) {
            const { img, iw } = measures[i];
            if (img) ctx.drawImage(img, cx, dy, iw, elH);
            cx += iw + gap;
          }
        } else {
          const condensed = condenseCosts(costs);
          const gap = Math.max(1, elH * 0.08);
          const fontSize = elH * 0.5;
          ctx.font = `${fontSize}px ${INTER}`;
          ctx.textAlign = 'left';
          const measures = condensed.map(g => {
            const img = getCachedImage(g.url);
            const iw = img ? (img.width / img.height) * elH : elH * 0.7;
            const tw = ctx.measureText(`×${g.count}`).width + gap * 0.5 + gap;
            return { img, iw, tw };
          });
          let totalW = 0;
          for (const m of measures) totalW += m.iw + m.tw + gap;
          totalW -= gap;
          let cx = align === 'center' ? dx + (elW - totalW) / 2 : align === 'right' ? dx + elW - totalW : dx;
          for (let i = 0; i < condensed.length; i++) {
            const { img, iw, tw } = measures[i];
            if (img) ctx.drawImage(img, cx, dy, iw, elH);
            cx += iw;
            ctx.fillText(`×${condensed[i].count}`, cx + gap * 0.5, dy + elH / 2);
            cx += tw;
            cx += gap;
          }
        }
        ctx.restore();
      }
    } else if (el.type === 'grid') {
      const elH = el.height;
      const gridImg = gridImageCache.get(el.id);
      if (gridImg) {
        ctx.save();
        if (rot) { ctx.translate(x + elW / 2, y + elH / 2); ctx.rotate(rot); }
        const dx = rot ? -elW / 2 : x;
        const dy = rot ? -elH / 2 : y;
        ctx.drawImage(gridImg, dx, dy, elW, elH);
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

export async function renderFreeCanvasToCanvas(data, scale = 2, bgColor, bgImage) {
  await document.fonts.ready;
  await preloadFreeCanvasImages(data);
  if (bgImage) await loadImage(bgImage);

  const w = data?.cardWidth || 360, h = data?.cardHeight || 504;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  drawFreeCanvasCard(ctx, data, w, h, bgColor, bgImage);
  return canvas;
}