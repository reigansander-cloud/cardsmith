import { downloadBlob } from '@/lib/exportUtils';

// 1/8" border at the app's export scale (matches the editor's export margin)
const BORDER_PX = 36;

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Expand the deck's cards into a flat list of images, repeating each by its copy count
async function buildImageList(items) {
  const out = [];
  for (const { card, copies } of items) {
    if (!card?.png_url) continue;
    const img = await loadImage(card.png_url);
    if (!img) continue;
    const n = Math.max(1, copies || 1);
    for (let i = 0; i < n; i++) out.push({ img, name: card.name || 'card' });
  }
  return out;
}

// TTS export: arrange every copy into a single borderless grid PNG (like the TTS tool)
export async function exportDeckTTS(items, deckName) {
  const images = await buildImageList(items);
  if (images.length === 0) throw new Error('No card images to export');

  const cellW = Math.max(...images.map((c) => c.img.width));
  const cellH = Math.max(...images.map((c) => c.img.height));
  const cols = Math.ceil(Math.sqrt(images.length));
  const rows = Math.ceil(images.length / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext('2d');
  images.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.drawImage(c.img, col * cellW, row * cellH, c.img.width, c.img.height);
  });

  const fname = (deckName || 'deck').trim() + '_tts.png';
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fname,
        types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  downloadBlob(blob, fname);
}

// Print export: save every copy as an individual PNG with a 1/8" border into a folder, then open ProxyPrint
export async function exportDeckPrint(items, deckName) {
  const images = await buildImageList(items);
  if (images.length === 0) throw new Error('No card images to export');

  const base = (deckName || 'deck').trim();
  let dir = null;
  if (window.showDirectoryPicker) {
    try {
      dir = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  let idx = 0;
  for (const { img, name } of images) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width + BORDER_PX * 2;
    canvas.height = img.height + BORDER_PX * 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, BORDER_PX, BORDER_PX);

    const safe = (name || 'card').replace(/[^a-z0-9_-]+/gi, '_');
    const fname = `${base}_${String(idx + 1).padStart(3, '0')}_${safe}.png`;
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (dir) {
      try {
        const fileHandle = await dir.getFileHandle(fname, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (err) {
        downloadBlob(blob, fname);
      }
    } else {
      downloadBlob(blob, fname);
    }
    idx++;
  }

  window.open('https://proxyprint.taxiera.net/', '_blank');
}