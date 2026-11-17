// PSD export/import for the Free Canvas template using ag-psd.
// Text elements without icons become editable PSD text layers.
// Image/shape/drawing elements and icon-containing text are rasterized.

import { writePsd, readPsd } from 'ag-psd';
import { preloadFreeCanvasImages, drawFreeCanvasCard } from './freeCanvasRenderer';
import { loadImage, getCachedImage } from './domCardCanvasRenderer';
import { drawCardBackground } from './canvasBg';

const AVAILABLE_FONTS = [
  'Inter', 'JetBrains Mono', 'Albert Sans', 'Poiret One', 'Rye',
  'Alte DIN 1451 Mittelschrift', 'Naluka', 'CaesarDressing',
];

function hexToRgb(hex) {
  const m = (hex || '#000000').match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => Math.round(v || 0).toString(16).padStart(2, '0')).join('');
}

function getFontPostScriptName(fontFamily, bold, italic) {
  const match = (fontFamily || '').match(/^["']?([^"',]+)/);
  const family = match ? match[1].trim() : 'Inter';
  const suffix = bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular';
  return `${family}-${suffix}`;
}

// Resolve a PSD PostScript font name to one of our available fonts, falling
// back to Inter when the font is not installed.
function resolveFont(psName) {
  if (!psName) return { fontFamily: 'Inter', bold: false, italic: false };

  let bold = false, italic = false;
  if (/(bolditalic|boldoblique)/i.test(psName)) { bold = true; italic = true; }
  else if (/bold/i.test(psName)) { bold = true; }
  else if (/(italic|oblique)/i.test(psName)) { italic = true; }

  let family = psName.replace(/[-_]?(BoldItalic|BoldOblique|Bold|Italic|Oblique|Regular|Light|Medium|Semibold|SemiBold|Black|Thin|ExtraLight|Hairline)$/i, '');
  family = family.replace(/MT$/i, '').replace(/PS$/i, '').replace(/[-_]+$/i, '').trim();

  const match = AVAILABLE_FONTS.find(f => f.toLowerCase() === family.toLowerCase());
  return { fontFamily: match || 'Inter', bold, italic };
}

function measureText(text, fontSize, fontFamily, bold, italic) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const weight = bold ? 'bold' : 'normal';
  const style = italic ? 'italic' : 'normal';
  ctx.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
  const lines = (text || '').split('\n');
  let maxW = 0;
  for (const line of lines) {
    maxW = Math.max(maxW, ctx.measureText(line).width);
  }
  return {
    width: Math.max(maxW + 4, 10),
    height: Math.max(lines.length * fontSize * 1.3, fontSize * 1.3),
  };
}

// Check if text content contains inline icon tags — those can't be text layers.
function hasIcons(content) {
  return /\[icon:/.test(content || '');
}

export async function exportFreeCanvasToPsd(data, bgColor, bgImage) {
  const w = data?.cardWidth || 360;
  const h = data?.cardHeight || 504;

  await document.fonts.ready;
  await preloadFreeCanvasImages(data);
  if (bgImage) await loadImage(bgImage);

  const elements = data?.elements || [];
  const children = [];

  // Background layer (bottom of the stack)
  if (bgColor || bgImage) {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = w;
    bgCanvas.height = h;
    const bgCtx = bgCanvas.getContext('2d');
    drawCardBackground(bgCtx, w, h, 8, bgColor, bgImage, getCachedImage);
    children.push({ name: 'Background', canvas: bgCanvas });
  }

  // Free canvas: elements[0] = top, elements[last] = bottom.
  // PSD children: first = bottom, last = top. Iterate bottom-to-top.
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];

    // Text elements without icons or rotation → editable text layer
    if (el.type === 'text' && !hasIcons(el.content) && !el.rotation) {
      const tx = el.x;
      const ty = el.y;
      const fontSize = el.fontSize || 14;
      const fillColor = hexToRgb(el.color);
      const fontName = getFontPostScriptName(el.fontFamily, el.bold, el.italic);
      const justification = el.align === 'center' ? 'center' : el.align === 'right' ? 'right' : 'left';

      children.push({
        name: el.name || 'Text',
        text: {
          text: el.content || '',
          transform: [1, 0, 0, 1, tx, ty],
          style: {
            font: { name: fontName },
            fontSize,
            fillColor,
          },
          paragraphStyle: { justification },
        },
      });
      continue;
    }

    // Everything else → rasterized layer
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = w;
    layerCanvas.height = h;
    const ctx = layerCanvas.getContext('2d');
    drawFreeCanvasCard(ctx, { elements: [el], connections: [] }, w, h, null, null, {
      skipBackground: true,
      skipConnections: true,
    });
    children.push({ name: el.name || el.type || `Layer ${i + 1}`, canvas: layerCanvas });
  }

  const psd = { width: w, height: h, children };
  const buffer = writePsd(psd);
  return new Blob([buffer], { type: 'image/vnd.adobe.photoshop' });
}

function createTextElementFromLayer(layer, psdWidth, psdHeight, index) {
  const text = layer.text;
  if (!text || !text.text) return null;

  const style = text.style || {};
  const fontSize = style.fontSize || 14;
  const fillColor = style.fillColor || { r: 0, g: 0, b: 0 };
  const psFontName = style.font?.name || '';
  const { fontFamily, bold, italic } = resolveFont(psFontName);
  const justification = text.paragraphStyle?.justification || 'left';
  const align = justification === 'center' ? 'center' : justification === 'right' ? 'right' : 'left';

  // Position from transform [xx, yx, xy, yy, tx, ty]
  const transform = text.transform || [1, 0, 0, 1, 0, 0];
  const tx = transform[4] || 0;
  const ty = transform[5] || 0;
  const angle = Math.round(Math.atan2(transform[1], transform[0]) * 180 / Math.PI);

  const { width: measuredW, height: measuredH } = measureText(text.text, fontSize, fontFamily, bold, italic);

  return {
    id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${index}`,
    type: 'text',
    name: layer.name || 'Text',
    x: tx,
    y: ty,
    width: measuredW,
    height: measuredH,
    content: text.text,
    fontSize,
    color: rgbToHex(fillColor),
    fontFamily,
    align,
    bold,
    italic,
    ...(angle ? { rotation: angle } : {}),
  };
}

export async function parsePsdToElements(file, uploadFn) {
  const buffer = await file.arrayBuffer();
  const psd = readPsd(buffer);
  const psdWidth = psd.width;
  const psdHeight = psd.height;

  if (!psdWidth || !psdHeight) {
    throw new Error('Invalid PSD file — could not read dimensions.');
  }

  // Collect all layers (raster and text), flattening group layers.
  const layers = [];
  function collect(children) {
    for (const child of children || []) {
      if (child.text) {
        layers.push({ kind: 'text', ...child });
      } else if (child.canvas) {
        layers.push({ kind: 'raster', ...child });
      }
      if (child.children) collect(child.children);
    }
  }
  collect(psd.children);

  const elements = [];
  // PSD: first child = bottom. Free canvas: first element = top. Reverse.
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];

    if (layer.kind === 'text') {
      const textEl = createTextElementFromLayer(layer, psdWidth, psdHeight, i);
      if (textEl) elements.push(textEl);
      continue;
    }

    // Raster layer → upload as image
    const blob = await new Promise(resolve => layer.canvas.toBlob(resolve, 'image/png'));
    const fileObj = new File([blob], `layer_${i}.png`, { type: 'image/png' });
    const { file_url } = await uploadFn(fileObj);
    const left = layer.left || 0;
    const top = layer.top || 0;
    const lw = layer.canvas.width;
    const lh = layer.canvas.height;
    elements.push({
      id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${i}`,
      type: 'image',
      name: layer.name || `Layer ${i + 1}`,
      x: left,
      y: top,
      width: lw,
      aspectRatio: lw / lh,
      url: file_url,
    });
  }

  return { width: psdWidth, height: psdHeight, elements };
}