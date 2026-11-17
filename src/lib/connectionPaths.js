// Shared helpers for the free-canvas connection-lines feature.
// Used by both the live editor (FreeCanvasCanvas.jsx) and the export renderer (freeCanvasRenderer.js).

const POINT_DIRS = {
  tl: { dx: -1, dy: -1, vert: true },
  t:  { dx: 0, dy: -1, vert: true },
  tr: { dx: 1, dy: -1, vert: true },
  r:  { dx: 1, dy: 0, vert: false },
  br: { dx: 1, dy: 1, vert: true },
  b:  { dx: 0, dy: 1, vert: true },
  bl: { dx: -1, dy: 1, vert: true },
  l:  { dx: -1, dy: 0, vert: false },
};

const POINT_OFFSETS = {
  tl: [-0.5, -0.5], t: [0, -0.5], tr: [0.5, -0.5],
  r: [0.5, 0], br: [0.5, 0.5], b: [0, 0.5],
  bl: [-0.5, 0.5], l: [-0.5, 0],
};

export const POINT_NAMES = ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'];

// Returns { x, y } in pixel coordinates (card-space) for a given anchor point on an element.
// elementHeightFn is a function(el) that returns the element's height in pixels.
export function getAnchorPoint(el, point, elementHeightFn, cardW, cardH) {
  const h = elementHeightFn(el);
  const cx = el.x + el.width / 2;
  const cy = el.y + h / 2;
  let [oxF, oyF] = POINT_OFFSETS[point] || [0, 0];
  // For ellipse shapes, pull corner anchors in to the circle edge (45° point)
  if (el.type === 'shape' && el.shape === 'ellipse' && oxF !== 0 && oyF !== 0) {
    const k = Math.SQRT1_2; // cos(45°) ≈ 0.7071
    oxF *= k;
    oyF *= k;
  }
  const ox = oxF * el.width;
  const oy = oyF * h;
  const rot = (el.rotation || 0) * Math.PI / 180;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const rx = ox * cos - oy * sin;
  const ry = ox * sin + oy * cos;
  return { x: cx + rx, y: cy + ry };
}

// --- Obstacle-aware orthogonal routing ---

const OBS_MARGIN = 8; // pixel clearance around obstacles

// Check if an orthogonal segment (horizontal or vertical) intersects a rect.
function segHitsRect(x1, y1, x2, y2, rx1, ry1, rx2, ry2) {
  if (Math.abs(x1 - x2) < 0.01) {
    // Vertical segment
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    return x1 > rx1 && x1 < rx2 && maxY > ry1 && minY < ry2;
  }
  // Horizontal segment
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  return y1 > ry1 && y1 < ry2 && maxX > rx1 && minX < rx2;
}

function pathHitsObs(points, obstacles) {
  for (let i = 0; i < points.length - 1; i++) {
    for (const obs of obstacles) {
      if (segHitsRect(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], obs.x1, obs.y1, obs.x2, obs.y2)) {
        return true;
      }
    }
  }
  return false;
}

function orthoPathLen(points) {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.abs(points[i + 1][0] - points[i][0]) + Math.abs(points[i + 1][1] - points[i][1]);
  }
  return len;
}

// Build the default (no-obstacle) orthogonal path, matching the original layout.
function buildDefaultOrtho(ax, ay, bx, by, awayAx, awayAy, awayBx, awayBy, aVert, bVert) {
  if (aVert && bVert) return [[ax, ay], [awayAx, awayAy], [awayBx, awayAy], [awayBx, awayBy], [bx, by]];
  if (aVert) return [[ax, ay], [awayAx, awayAy], [awayBx, awayAy], [awayBx, awayBy], [bx, by]];
  if (bVert) return [[ax, ay], [awayAx, awayAy], [awayAx, awayBy], [awayBx, awayBy], [bx, by]];
  return [[ax, ay], [awayAx, awayAy], [awayAx, awayBy], [awayBx, awayBy], [bx, by]];
}

// Route an orthogonal path from A to B, avoiding obstacle rects when possible.
// Returns an array of [x, y] points. If no obstacles or the default path is clear,
// returns the default path (identical to the original layout).
function routeOrthogonal(ax, ay, bx, by, fromPoint, toPoint, obstacles) {
  const aDir = POINT_DIRS[fromPoint] || POINT_DIRS.t;
  const bDir = POINT_DIRS[toPoint] || POINT_DIRS.b;
  const aVert = aDir.vert;
  const bVert = bDir.vert;
  const off = Math.min(Math.abs(bx - ax), Math.abs(by - ay)) * 0.3 + 12;
  const awayAx = aVert ? ax : ax + aDir.dx * off;
  const awayAy = aVert ? ay + aDir.dy * off : ay;
  const awayBx = bVert ? bx : bx + bDir.dx * off;
  const awayBy = bVert ? by + bDir.dy * off : by;

  const defaultPts = buildDefaultOrtho(ax, ay, bx, by, awayAx, awayAy, awayBx, awayBy, aVert, bVert);
  if (!obstacles || !obstacles.length || !pathHitsObs(defaultPts, obstacles)) return defaultPts;

  let best = null;
  let bestLen = Infinity;
  const tryPath = (pts) => {
    if (!pathHitsObs(pts, obstacles)) {
      const len = orthoPathLen(pts);
      if (len < bestLen) { best = pts; bestLen = len; }
    }
  };

  if (aVert && bVert) {
    // Bridge is a horizontal segment at some Y
    const xMin = Math.min(ax, bx), xMax = Math.max(ax, bx);
    const rel = obstacles.filter(o => o.x2 > xMin && o.x1 < xMax);
    const ys = new Set([awayAy]);
    for (const o of rel) { ys.add(o.y1 - OBS_MARGIN); ys.add(o.y2 + OBS_MARGIN); }
    for (const cy of ys) tryPath([[ax, ay], [ax, cy], [bx, cy], [bx, by]]);
    if (!best && rel.length) {
      const top = Math.min(...rel.map(o => o.y1)) - OBS_MARGIN;
      const bot = Math.max(...rel.map(o => o.y2)) + OBS_MARGIN;
      tryPath([[ax, ay], [ax, top], [bx, top], [bx, by]]);
      tryPath([[ax, ay], [ax, bot], [bx, bot], [bx, by]]);
    }
  } else if (!aVert && !bVert) {
    // Bridge is a vertical segment at some X
    const yMin = Math.min(ay, by), yMax = Math.max(ay, by);
    const rel = obstacles.filter(o => o.y2 > yMin && o.y1 < yMax);
    const xs = new Set([awayAx]);
    for (const o of rel) { xs.add(o.x1 - OBS_MARGIN); xs.add(o.x2 + OBS_MARGIN); }
    for (const cx of xs) tryPath([[ax, ay], [cx, ay], [cx, by], [bx, by]]);
    if (!best && rel.length) {
      const left = Math.min(...rel.map(o => o.x1)) - OBS_MARGIN;
      const right = Math.max(...rel.map(o => o.x2)) + OBS_MARGIN;
      tryPath([[ax, ay], [left, ay], [left, by], [bx, by]]);
      tryPath([[ax, ay], [right, ay], [right, by], [bx, by]]);
    }
  } else if (aVert) {
    // A exits vertical, B exits horizontal
    // Path: (ax,ay) → (ax, cy) → (cx, cy) → (cx, by) → (bx, by)
    const xMin = Math.min(ax, awayBx), xMax = Math.max(ax, awayBx);
    const relH = obstacles.filter(o => o.x2 > xMin && o.x1 < xMax);
    const ys = new Set([awayAy]);
    for (const o of relH) { ys.add(o.y1 - OBS_MARGIN); ys.add(o.y2 + OBS_MARGIN); }
    const yMinV = Math.min(awayAy, by), yMaxV = Math.max(awayAy, by);
    const relV = obstacles.filter(o => o.y2 > yMinV && o.y1 < yMaxV);
    const xs = new Set([awayBx]);
    for (const o of relV) { xs.add(o.x1 - OBS_MARGIN); xs.add(o.x2 + OBS_MARGIN); }
    for (const cy of ys) for (const cx of xs) tryPath([[ax, ay], [ax, cy], [cx, cy], [cx, by], [bx, by]]);
  } else {
    // A exits horizontal, B exits vertical
    // Path: (ax,ay) → (cx, ay) → (cx, cy) → (bx, cy) → (bx, by)
    const yMin = Math.min(ay, awayBy), yMax = Math.max(ay, awayBy);
    const relV = obstacles.filter(o => o.y2 > yMin && o.y1 < yMax);
    const xs = new Set([awayAx]);
    for (const o of relV) { xs.add(o.x1 - OBS_MARGIN); xs.add(o.x2 + OBS_MARGIN); }
    const xMinH = Math.min(awayAx, bx), xMaxH = Math.max(awayAx, bx);
    const relH = obstacles.filter(o => o.x2 > xMinH && o.x1 < xMaxH);
    const ys = new Set([awayBy]);
    for (const o of relH) { ys.add(o.y1 - OBS_MARGIN); ys.add(o.y2 + OBS_MARGIN); }
    for (const cx of xs) for (const cy of ys) tryPath([[ax, ay], [cx, ay], [cx, cy], [bx, cy], [bx, by]]);
  }

  return best || defaultPts;
}

// Builds an SVG path string for a connection line between two anchor points.
// Coordinates can be in any unit (percentage or pixel) as long as both ends match.
// cornerR is the corner radius for the "rounded" style, in the same units as coordinates.
// obstacles is an optional array of {x1, y1, x2, y2} pixel-space rects to route around
// (only used by the "orthogonal" and "rounded" styles).
export function buildConnectionPath(ax, ay, bx, by, fromPoint, toPoint, style, cornerR = 12, obstacles) {
  if (!style || style === 'straight') {
    return `M ${ax} ${ay} L ${bx} ${by}`;
  }

  const aDir = POINT_DIRS[fromPoint] || POINT_DIRS.t;
  const bDir = POINT_DIRS[toPoint] || POINT_DIRS.b;

  if (style === 'curved') {
    const off = Math.min(Math.abs(bx - ax), Math.abs(by - ay)) * 0.3 + 8;
    const cx1 = ax + aDir.dx * off;
    const cy1 = ay + aDir.dy * off;
    const cx2 = bx + bDir.dx * off;
    const cy2 = by + bDir.dy * off;
    return `M ${ax} ${ay} C ${cx1} ${cy1} ${cx2} ${cy2} ${bx} ${by}`;
  }

  const rounded = style === 'rounded';
  const r = rounded ? cornerR : 0;
  const points = routeOrthogonal(ax, ay, bx, by, fromPoint, toPoint, obstacles);
  return buildRoundedPath(points, r);
}

// Returns the polyline points (array of [x, y]) for a connection path.
// Used to sample arrow positions along any line style.
export function getConnectionPolyline(ax, ay, bx, by, fromPoint, toPoint, style, obstacles) {
  if (!style || style === 'straight') {
    return [[ax, ay], [bx, by]];
  }

  const aDir = POINT_DIRS[fromPoint] || POINT_DIRS.t;
  const bDir = POINT_DIRS[toPoint] || POINT_DIRS.b;

  if (style === 'curved') {
    const off = Math.min(Math.abs(bx - ax), Math.abs(by - ay)) * 0.3 + 8;
    const cx1 = ax + aDir.dx * off;
    const cy1 = ay + aDir.dy * off;
    const cx2 = bx + bDir.dx * off;
    const cy2 = by + bDir.dy * off;
    const points = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const x = (1 - t) ** 3 * ax + 3 * (1 - t) ** 2 * t * cx1 + 3 * (1 - t) * t ** 2 * cx2 + t ** 3 * bx;
      const y = (1 - t) ** 3 * ay + 3 * (1 - t) ** 2 * t * cy1 + 3 * (1 - t) * t ** 2 * cy2 + t ** 3 * by;
      points.push([x, y]);
    }
    return points;
  }

  return routeOrthogonal(ax, ay, bx, by, fromPoint, toPoint, obstacles);
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Returns array of { x, y, dx, dy } arrow positions along a connection path.
// Arrows are placed at random positions (seeded by seedStr for stability),
// offset perpendicular to the line, pointing from start towards end.
export function getConnectionArrows(ax, ay, bx, by, fromPoint, toPoint, style, seedStr, count = 3, offset = 8, obstacles) {
  const points = getConnectionPolyline(ax, ay, bx, by, fromPoint, toPoint, style, obstacles);

  const segments = [];
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1][0] - points[i][0];
    const dy = points[i + 1][1] - points[i][1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) continue;
    segments.push({ x1: points[i][0], y1: points[i][1], dx, dy, len, accumLen: totalLen });
    totalLen += len;
  }

  if (totalLen < 1) return [];

  // Always render at least one arrow, even on short lines.
  const effectiveCount = totalLen < 30 ? 1 : count;
  const rng = seededRandom(hashString(seedStr));
  const arrows = [];
  for (let i = 0; i < effectiveCount; i++) {
    const segStart = 0.15 + (0.7 * i / count);
    const segEnd = 0.15 + (0.7 * (i + 1) / count);
    const dist = (segStart + rng() * (segEnd - segStart)) * totalLen;
    for (const seg of segments) {
      if (dist >= seg.accumLen && dist <= seg.accumLen + seg.len) {
        const t = (dist - seg.accumLen) / seg.len;
        const x = seg.x1 + seg.dx * t;
        const y = seg.y1 + seg.dy * t;
        const ndx = seg.dx / seg.len;
        const ndy = seg.dy / seg.len;
        const perpSide = rng() > 0.5 ? 1 : -1;
        const perpAmount = (offset * 0.4 + rng() * offset * 0.6) * perpSide;
        arrows.push({ x: x - ndy * perpAmount, y: y + ndx * perpAmount, dx: ndx, dy: ndy });
        break;
      }
    }
  }
  return arrows;
}

function buildRoundedPath(points, r) {
  if (!r || points.length < 3) {
    return 'M ' + points.map(p => `${p[0]} ${p[1]}`).join(' L ');
  }
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const inDx = Math.sign(cx - px), inDy = Math.sign(cy - py);
    const outDx = Math.sign(nx - cx), outDy = Math.sign(ny - cy);
    if (inDx === outDx && inDy === outDy) {
      d += ` L ${cx} ${cy}`;
    } else {
      const apx = cx - inDx * r, apy = cy - inDy * r;
      const ex = cx + outDx * r, ey = cy + outDy * r;
      d += ` L ${apx} ${apy} Q ${cx} ${cy} ${ex} ${ey}`;
    }
  }
  const last = points[points.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}