import { drawFreeCanvasCard } from './freeCanvasRenderer';
import { loadImage, getCachedImage } from './domCardCanvasRenderer';
import { colorizeImageData } from './imageEffects';

export function drawSelectionPath(ctx, selection, cardW, cardH, canvasW, canvasH) {
  if (!selection) return;
  const sx = canvasW / cardW, sy = canvasH / cardH;
  if (selection.type === 'rectangle') {
    ctx.rect(selection.x * sx, selection.y * sy, selection.width * sx, selection.height * sy);
  } else if (selection.type === 'circle') {
    const cx = selection.cx * sx;
    const cy = selection.cy * sy;
    const rx = Math.max(0.5, selection.rx * sx);
    const ry = Math.max(0.5, selection.ry * sy);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  } else if (selection.type === 'draw') {
    const points = selection.points || [];
    if (points.length === 0) return;
    ctx.moveTo(points[0].x * sx, points[0].y * sy);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * sx, points[i].y * sy);
    }
    ctx.closePath();
  }
  // 'magic' has no single path — it is masked via the mask image.
}

export function getSelectionBounds(selection) {
  if (!selection) return { x: 0, y: 0, width: 0, height: 0 };
  if (selection.type === 'compound') {
    const regions = selection.regions || [];
    if (regions.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of regions) {
      const b = getSelectionBounds(r);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  if (selection.type === 'rectangle') {
    return { x: selection.x, y: selection.y, width: selection.width, height: selection.height };
  } else if (selection.type === 'circle') {
    return { x: selection.cx - selection.rx, y: selection.cy - selection.ry, width: selection.rx * 2, height: selection.ry * 2 };
  } else if (selection.type === 'draw') {
    const points = selection.points || [];
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  } else if (selection.type === 'magic') {
    return { x: selection.x, y: selection.y, width: selection.width, height: selection.height };
  }
  return { x: 0, y: 0, width: 0, height: 0 };
}

// Preload all images an element needs (image URL + inline icons in text).
async function preloadElementImages(el) {
  const urls = [];
  if (el.type === 'image' && el.url) urls.push(el.url);
  if (el.type === 'text' && el.content) {
    const re = /\[icon:([^\]]+)\]/g;
    let m;
    while ((m = re.exec(el.content)) !== null) urls.push(m[1].trim());
  }
  await Promise.all(urls.map(loadImage));
}

function renderElementToCanvas(el, w, h) {
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFreeCanvasCard(ctx, { elements: [el], cardWidth: w, cardHeight: h }, w, h, null, null, { skipBackground: true, skipConnections: true });
  return canvas;
}

function cropCanvasToElement(fullCanvas, el, cardW, cardH) {
  const pw = fullCanvas.width;
  const ph = fullCanvas.height;
  const sx = pw / cardW, sy = ph / cardH;
  const elX = el.x * sx;
  const elY = el.y * sy;
  let elW, elH;
  if (el.type === 'image') {
    const ar = el.aspectRatio || 1;
    elW = el.width * sx;
    elH = elW / ar;
  } else {
    elW = el.width * sx;
    elH = el.height * sy;
  }

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = Math.max(1, Math.round(elW));
  croppedCanvas.height = Math.max(1, Math.round(elH));
  const croppedCtx = croppedCanvas.getContext('2d');
  croppedCtx.drawImage(fullCanvas, -elX, -elY);

  return {
    ...el,
    type: 'image',
    url: croppedCanvas.toDataURL(),
    aspectRatio: elW / elH,
    effects: {},
    rotation: 0,
  };
}

// Magic mask images are data URLs — cache them so repeated ops are synchronous.
const maskCache = new Map();
async function getMaskImage(selection) {
  if (!selection || selection.type !== 'magic' || !selection.maskUrl) return null;
  if (maskCache.has(selection.maskUrl)) return maskCache.get(selection.maskUrl);
  const img = await loadImage(selection.maskUrl);
  if (img) maskCache.set(selection.maskUrl, img);
  return img;
}

// Returns a w×h canvas filled with `color` everywhere the selection covers,
// transparent elsewhere. Handles path shapes and magic masks uniformly.
async function buildSelectionFill(selection, color, w, h) {
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d');
  if (selection.type === 'magic') {
    const mask = await getMaskImage(selection);
    if (!mask) return canvas;
    const bx = (selection.x / w) * pw;
    const by = (selection.y / h) * ph;
    const bw = Math.max(1, (selection.width / w) * pw);
    const bh = Math.max(1, (selection.height / h) * ph);
    ctx.drawImage(mask, bx, by, bw, bh); // white where selected
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, pw, ph);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    ctx.beginPath();
    drawSelectionPath(ctx, selection, w, h, pw, ph);
    ctx.fillStyle = color;
    ctx.fill();
  }
  return canvas;
}

// Returns a bounds-sized canvas containing the fullCanvas content clipped to
// the selection (transparent outside the selection).
async function cropToSelection(fullCanvas, selection, w, h) {
  const pw = fullCanvas.width;
  const ph = fullCanvas.height;
  const bounds = getSelectionBounds(selection);
  const bx = (bounds.x / w) * pw;
  const by = (bounds.y / h) * ph;
  const bw = Math.max(1, (bounds.width / w) * pw);
  const bh = Math.max(1, (bounds.height / h) * ph);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bw));
  canvas.height = Math.max(1, Math.round(bh));
  const ctx = canvas.getContext('2d');
  if (selection.type === 'magic') {
    ctx.drawImage(fullCanvas, -bx, -by);
    const mask = await getMaskImage(selection);
    if (mask) {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
  } else {
    ctx.save();
    ctx.translate(-bx, -by);
    ctx.beginPath();
    drawSelectionPath(ctx, selection, w, h, pw, ph);
    ctx.clip();
    ctx.drawImage(fullCanvas, 0, 0);
    ctx.restore();
  }
  return canvas;
}

// Copy: keep only the selected portion for the clipboard. Leaves the original
// layer untouched. Preloads the image so rendering is synchronous and reliable.
export async function copySelection(el, selection, w, h) {
  await preloadElementImages(el);
  const fullCanvas = renderElementToCanvas(el, w, h);
  return cropToSelection(fullCanvas, selection, w, h);
}

// Build a standalone image element (no id) from a cropped selection canvas,
// positioned at the selection bounds so it can be pasted in as its own layer.
export function canvasToImageElement(canvas, selection, w, h) {
  const bounds = getSelectionBounds(selection);
  const bw = Math.max(1, bounds.width);
  const bh = Math.max(1, bounds.height);
  return {
    type: 'image',
    url: canvas.toDataURL(),
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    aspectRatio: bw / bh,
    effects: {},
    rotation: 0,
  };
}

export async function cutSelection(el, selection, w, h) {
  await preloadElementImages(el);
  const fullCanvas = renderElementToCanvas(el, w, h);
  const pw = fullCanvas.width;
  const ph = fullCanvas.height;

  // Clipboard: only the selected portion.
  const clipboardCanvas = await cropToSelection(fullCanvas, selection, w, h);

  // Hole: erase the selected portion from the full canvas.
  const holeCanvas = document.createElement('canvas');
  holeCanvas.width = pw;
  holeCanvas.height = ph;
  const holeCtx = holeCanvas.getContext('2d');
  holeCtx.drawImage(fullCanvas, 0, 0);
  if (selection.type === 'magic') {
    const fill = await buildSelectionFill(selection, '#000000', w, h);
    holeCtx.globalCompositeOperation = 'destination-out';
    holeCtx.drawImage(fill, 0, 0);
    holeCtx.globalCompositeOperation = 'source-over';
  } else {
    holeCtx.save();
    holeCtx.globalCompositeOperation = 'destination-out';
    holeCtx.beginPath();
    drawSelectionPath(holeCtx, selection, w, h, pw, ph);
    holeCtx.fill();
    holeCtx.restore();
  }

  return { clipboard: clipboardCanvas, updatedEl: cropCanvasToElement(holeCanvas, el, w, h) };
}

// Crop the selection region, colorize just that portion, then merge back onto the original.
export async function colorizeSelection(el, selection, w, h, color, amount) {
  await preloadElementImages(el);
  const fullCanvas = renderElementToCanvas(el, w, h);
  const pw = fullCanvas.width;
  const ph = fullCanvas.height;
  const bounds = getSelectionBounds(selection);
  const bx = (bounds.x / w) * pw;
  const by = (bounds.y / h) * ph;

  const croppedCanvas = await cropToSelection(fullCanvas, selection, w, h);
  try {
    const croppedCtx = croppedCanvas.getContext('2d');
    const imageData = croppedCtx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);
    colorizeImageData(imageData, color, amount);
    croppedCtx.putImageData(imageData, 0, 0);
  } catch (e) {
    return cropCanvasToElement(fullCanvas, el, w, h);
  }

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = pw;
  resultCanvas.height = ph;
  const resultCtx = resultCanvas.getContext('2d');
  resultCtx.drawImage(fullCanvas, 0, 0);
  resultCtx.drawImage(croppedCanvas, bx, by);

  return cropCanvasToElement(resultCanvas, el, w, h);
}

// NEW approach: pure canvas compositing, no pixel reading.
// Paints `color` into the selected area of the layer, restricted to where the
// layer already has content (alpha). Works for path shapes AND magic masks.
export async function fillSelection(el, selection, w, h, color) {
  await preloadElementImages(el);
  const fullCanvas = renderElementToCanvas(el, w, h);
  const pw = fullCanvas.width;
  const ph = fullCanvas.height;

  // 1. fillLayer = solid color everywhere the selection covers.
  const fillLayer = await buildSelectionFill(selection, color, w, h);
  // 2. Restrict the fill to the layer's own alpha (so transparent areas stay
  //    transparent and anti-aliased edges stay smooth).
  const fillCtx = fillLayer.getContext('2d');
  fillCtx.globalCompositeOperation = 'destination-in';
  fillCtx.drawImage(fullCanvas, 0, 0);
  fillCtx.globalCompositeOperation = 'source-over';

  // 3. Composite the fill over the original, then crop back to the element bounds.
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = pw;
  resultCanvas.height = ph;
  const resultCtx = resultCanvas.getContext('2d');
  resultCtx.drawImage(fullCanvas, 0, 0);
  resultCtx.drawImage(fillLayer, 0, 0);

  return cropCanvasToElement(resultCanvas, el, w, h);
}

// Photoshop-style magic wand: sample the color at `point` on the rendered
// layer, flood-fill contiguous pixels within `tolerance`, and return a magic
// selection (a cropped white/transparent mask stored as a data URL). Returns
// null if the layer can't be read (cross-origin taint) or nothing matches.
export async function magicWandSelect(el, point, w, h, tolerance = 40) {
  await preloadElementImages(el);
  const fullCanvas = renderElementToCanvas(el, w, h);
  const pw = fullCanvas.width;
  const ph = fullCanvas.height;
  const ctx = fullCanvas.getContext('2d');
  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, pw, ph);
  } catch (e) {
    return null;
  }
  const data = imageData.data;
  const px = Math.round((point.x / w) * pw);
  const py = Math.round((point.y / h) * ph);
  if (px < 0 || px >= pw || py < 0 || py >= ph) return null;
  const idx0 = (py * pw + px) * 4;
  const sa = data[idx0 + 3];
  if (sa === 0) return null; // clicked on empty space
  const sr = data[idx0], sg = data[idx0 + 1], sb = data[idx0 + 2];

  const visited = new Uint8Array(pw * ph);
  const selected = new Uint8Array(pw * ph);
  const stack = [py * pw + px];
  visited[py * pw + px] = 1;
  selected[py * pw + px] = 1;
  let minX = px, maxX = px, minY = py, maxY = py;

  while (stack.length) {
    const p = stack.pop();
    const x = p % pw;
    const y = (p / pw) | 0;
    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= pw || ny < 0 || ny >= ph) continue;
      const ni = ny * pw + nx;
      if (visited[ni]) continue;
      visited[ni] = 1;
      const ci = ni * 4;
      if (data[ci + 3] === 0) continue; // only select within the layer's content
      const dr = Math.abs(data[ci] - sr);
      const dg = Math.abs(data[ci + 1] - sg);
      const db = Math.abs(data[ci + 2] - sb);
      if (Math.max(dr, dg, db) <= tolerance) {
        selected[ni] = 1;
        stack.push(ni);
        if (nx < minX) minX = nx;
        if (nx > maxX) maxX = nx;
        if (ny < minY) minY = ny;
        if (ny > maxY) maxY = ny;
      }
    }
  }

  let count = 0;
  for (let i = 0; i < selected.length; i++) if (selected[i]) count++;
  if (count === 0) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = bw;
  maskCanvas.height = bh;
  const maskCtx = maskCanvas.getContext('2d');
  const maskData = maskCtx.createImageData(bw, bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      if (selected[(minY + y) * pw + (minX + x)]) {
        const i = (y * bw + x) * 4;
        maskData.data[i] = 255;
        maskData.data[i + 1] = 255;
        maskData.data[i + 2] = 255;
        maskData.data[i + 3] = 255;
      }
    }
  }
  maskCtx.putImageData(maskData, 0, 0);

  return {
    type: 'magic',
    x: (minX / pw) * w,
    y: (minY / ph) * h,
    width: (bw / pw) * w,
    height: (bh / ph) * h,
    maskUrl: maskCanvas.toDataURL(),
  };
}

export function canvasToClipboard(canvas) {
  try {
    const blobPromise = new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
    return true;
  } catch (e) {
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } catch (e2) {}
    }, 'image/png');
    return false;
  }
}

// --- Compound (multi-region) selection support ---

export function getSelectionRegions(selection) {
  if (!selection) return [];
  if (selection.type === 'compound') return selection.regions || [];
  return [selection];
}

function compositeClipCanvases(clips, w, h) {
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  const regions = clips.map(c => c.region);
  const bounds = getSelectionBounds({ type: 'compound', regions });
  const ow = Math.max(1, Math.round((bounds.width / w) * pw));
  const oh = Math.max(1, Math.round((bounds.height / h) * ph));
  const out = document.createElement('canvas');
  out.width = ow;
  out.height = oh;
  const ctx = out.getContext('2d');
  for (const c of clips) {
    const rb = getSelectionBounds(c.region);
    const ox = ((rb.x - bounds.x) / w) * pw;
    const oy = ((rb.y - bounds.y) / h) * ph;
    ctx.drawImage(c.canvas, ox, oy);
  }
  return out;
}

export async function copySelections(el, regions, w, h) {
  if (!regions || regions.length === 0) return null;
  if (regions.length === 1) return copySelection(el, regions[0], w, h);
  await preloadElementImages(el);
  const fullCanvas = renderElementToCanvas(el, w, h);
  const clips = [];
  for (const r of regions) {
    const canvas = await cropToSelection(fullCanvas, r, w, h);
    clips.push({ canvas, region: r });
  }
  return compositeClipCanvases(clips, w, h);
}

export async function cutSelections(el, regions, w, h) {
  if (!regions || regions.length === 0) return null;
  if (regions.length === 1) return cutSelection(el, regions[0], w, h);
  let cur = el;
  const clips = [];
  for (const r of regions) {
    const { clipboard, updatedEl } = await cutSelection(cur, r, w, h);
    clips.push({ canvas: clipboard, region: r });
    cur = updatedEl;
  }
  return { clipboard: compositeClipCanvases(clips, w, h), updatedEl: cur };
}

export async function fillSelections(el, regions, w, h, color) {
  if (!regions || regions.length === 0) return el;
  let cur = el;
  for (const r of regions) cur = await fillSelection(cur, r, w, h, color);
  return cur;
}

export async function colorizeSelections(el, regions, w, h, color, amount) {
  if (!regions || regions.length === 0) return el;
  let cur = el;
  for (const r of regions) cur = await colorizeSelection(cur, r, w, h, color, amount);
  return cur;
}