// Shared line-style rendering for shape outlines (Straight / Drawn / Choppy).
// Used by both the live SVG preview (FreeCanvasCanvas) and the canvas export
// renderer (freeCanvasRenderer) so the two stay in sync.

// Deterministic RNG (mulberry32) seeded from a string so a given element
// always renders with the same "random" sketch pattern across renders.
export function seededRng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Outline of a shape as a polyline in normalized 0..1 space.
// Closed shapes repeat the first point at the end so the path closes cleanly.
export function shapeOutline(shape) {
  const arc = (cx, cy, r, a0, a1, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  };
  switch (shape) {
    case 'rectangle': return [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
    case 'rounded': {
      const r = 0.2;
      return [
        ...arc(1 - r, r, r, -Math.PI / 2, 0, 6),
        ...arc(1 - r, 1 - r, r, 0, Math.PI / 2, 6),
        ...arc(r, 1 - r, r, Math.PI / 2, Math.PI, 6),
        ...arc(r, r, r, Math.PI, 3 * Math.PI / 2, 6),
      ];
    }
    case 'ellipse': {
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        pts.push([0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5]);
      }
      return pts;
    }
    case 'triangle': return [[0.5, 0], [1, 1], [0, 1], [0.5, 0]];
    case 'diamond': return [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5], [0.5, 0]];
    case 'line': return [[0, 0], [1, 1]];
    default: return [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  }
}

function subdivide(points, step) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j < n; j++) out.push([x0 + (x1 - x0) * (j / n), y0 + (y1 - y0) * (j / n)]);
  }
  out.push(points[points.length - 1]);
  return out;
}

// Returns an array of polylines (each a list of [x, y] in 0..1 space) to stroke.
// 'straight' -> a single clean outline.
// 'drawn'    -> several jittered passes for a pencil-sketch look.
// 'choppy'   -> many short segments with random gaps removed.
export function buildStyledStrokes(shape, style, seedStr) {
  const outline = shapeOutline(shape);
  if (!style || style === 'straight') return [outline];
  if (style === 'drawn') {
    const sub = subdivide(outline, 0.04);
    const passes = [];
    for (let p = 0; p < 3; p++) {
      const r = seededRng(seedStr + ':drawn:' + p);
      passes.push(sub.map(([x, y]) => [x + (r() - 0.5) * 0.012, y + (r() - 0.5) * 0.012]));
    }
    return passes;
  }
  if (style === 'choppy') {
    const r = seededRng(seedStr + ':choppy');
    const sub = subdivide(outline, 0.03);
    const segs = [];
    for (let i = 0; i < sub.length - 1; i++) {
      if (r() < 0.6) segs.push([sub[i], sub[i + 1]]);
    }
    return segs;
  }
  return [outline];
}