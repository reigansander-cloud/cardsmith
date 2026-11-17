// Shared image-effect helpers for Free Canvas image elements.
// Outline + drop-shadow are rendered with drop-shadow filters so they follow
// the image's actual alpha content. Frame is rendered as an inset rectangular
// border (see FreeCanvasCanvas / freeCanvasRenderer) — cheap and "going in".

export function hexToRgba(hex, alpha) {
  const h = (hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha == null ? 1 : alpha})`;
}

function dirs(w) {
  return [[w, 0], [-w, 0], [0, w], [0, -w], [w, w], [-w, -w], [w, -w], [-w, w]];
}

// A single CSS/canvas filter string of stacked drop-shadows — usable both as
// the inline style on the <img> and as ctx.filter when exporting.
export function imageEffectsFilter(el) {
  const fx = el.effects || {};
  const shadows = [];

  if (fx.outline) {
    const w = Math.max(1, fx.outline.width), c = fx.outline.color;
    dirs(w).forEach(([dx, dy]) => shadows.push(`drop-shadow(${dx}px ${dy}px 0 ${c})`));
  }
  if (fx.shadow) {
    shadows.push(`drop-shadow(${fx.shadow.x}px ${fx.shadow.y}px ${fx.shadow.blur}px ${hexToRgba(fx.shadow.color, fx.shadow.opacity)})`);
  }
  return shadows.length ? shadows.join(' ') : 'none';
}

export function hexToRgb(hex) {
  const h = (hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Shifts each non-white pixel's hue & saturation toward the target color by `amount` percent.
// White pixels (high lightness, low saturation) are preserved.
export function colorizeImageData(imageData, color, amount) {
  const [tr, tg, tb] = hexToRgb(color);
  const [th] = rgbToHsl(tr, tg, tb);
  const t = Math.max(0, Math.min(1, (amount ?? 50) / 100));
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.1) continue;
    const newH = h + (th - h) * t;
    const [nr, ng, nb] = hslToRgb(newH, s, l);
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}

// Replaces every non-transparent pixel's RGB with the target color, preserving alpha.
export function fillImageData(imageData, color) {
  const [tr, tg, tb] = hexToRgb(color);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    data[i] = tr;
    data[i + 1] = tg;
    data[i + 2] = tb;
  }
}

export function imagePreviewStyle(el) {
  const fx = el.effects || {};
  const parts = [];
  if (fx.colorize) {
    const [tr, tg, tb] = hexToRgb(fx.colorize.color || '#ff0000');
    const [th] = rgbToHsl(tr, tg, tb);
    const t = Math.max(0, Math.min(1, (fx.colorize.amount ?? 50) / 100));
    parts.push(`hue-rotate(${th * 360 * t}deg)`);
  }
  const baseFilter = imageEffectsFilter(el);
  if (baseFilter !== 'none') parts.push(baseFilter);
  return { filter: parts.length ? parts.join(' ') : 'none' };
}