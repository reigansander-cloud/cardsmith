import { renderFolderEntryToCanvas } from './folderEntryCanvas';
import { renderType } from './folderPreview';
import { counterpartsOf } from './counterparts';

const CARD_BACK_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/516417bcba_ec1ad09b0_CardBack.png';

function sanitizeName(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled';
}

// Battlefield cards render landscape (504x360). For printing/TTS they are
// rotated 90° clockwise so every card in the output is portrait (360x504).
function rotate90CW(src) {
  const out = document.createElement('canvas');
  out.width = src.height;
  out.height = src.width;
  const ctx = out.getContext('2d');
  ctx.translate(out.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return out;
}

// Add a 1/8" white margin around the card. The entry is 360px wide = 2.5"
// (poker size), so 1px = 1/144"; 1/8" = 18px at scale 1.
function addMargin(srcCanvas, inches = 1 / 8) {
  const scale = srcCanvas.width / 360;
  const m = Math.round(inches * 144 * scale);
  const out = document.createElement('canvas');
  out.width = srcCanvas.width + m * 2;
  out.height = srcCanvas.height + m * 2;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(srcCanvas, m, m);
  return out;
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Render one face to a portrait canvas, rotating battlefields so every output
// card shares the same orientation.
async function renderFace(face, supertypes, folderColor) {
  let card = await renderFolderEntryToCanvas(face, 3, supertypes, folderColor);
  if (renderType(face, supertypes) === 'battlefield') card = rotate90CW(card);
  return card;
}

function toBlob(canvas) {
  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

// Save a PNG, preferring the native file picker and falling back to a download.
async function saveBlob(blob, fname) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: fname, types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }] });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return true;
    } catch (err) {
      if (err && err.name === 'AbortError') return false;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

// Arrange already-rendered cells into one borderless grid PNG, downscaling if
// it would exceed the 4096px texture limit.
async function buildGrid(cells, cellW, cellH, rows, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  cells.forEach((cell, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (cell) ctx.drawImage(cell, col * cellW, row * cellH, cellW, cellH);
  });
  const MAX = 4096;
  if (canvas.width <= MAX && canvas.height <= MAX) return canvas;
  const scale = Math.min(MAX / canvas.width, MAX / canvas.height);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(canvas.width * scale));
  out.height = Math.max(1, Math.round(canvas.height * scale));
  const octx = out.getContext('2d');
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

// Save the deck to a new folder named after the deck: one rendered, 1/8"-margined
// PNG per copy of every card in the deck, plus a PNG for each counterpart it
// carries (named "<counterpart> (<card>)"). Entries render through the same
// canvas pipeline used for every other template.
export async function printDeck(deckEntries, deckName, supertypes = [], folderColorMap = {}) {
  if (!window.showDirectoryPicker) throw new Error('Folder save requires Chrome or Edge on desktop.');
  const parent = await window.showDirectoryPicker();
  const dir = await parent.getDirectoryHandle(sanitizeName(deckName), { create: true });

  const write = async (canvas, label) => {
    const final = addMargin(canvas, 1 / 8);
    const blob = await toBlob(final);
    const fh = await dir.getFileHandle(`${label}.png`, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  };

  let n = 0;
  for (const c of deckEntries) {
    const entry = c.entry;
    const copies = c.copies || 1;

    const main = await renderFace(entry, supertypes, '#ffffff');
    for (let i = 0; i < copies; i++) {
      n++;
      await write(main, `${String(n).padStart(3, '0')} ${sanitizeName(entry.name || 'card')}`);
    }

    // Each counterpart prints as its own card, named after both faces.
    for (const cp of counterpartsOf(entry)) {
      const face = { ...cp, folder_id: entry.folder_id };
      const rendered = await renderFace(face, supertypes, '#ffffff');
      const label = `${cp.name || 'Counterpart'} (${entry.name || 'card'})`;
      for (let i = 0; i < copies; i++) {
        n++;
        await write(rendered, `${String(n).padStart(3, '0')} ${sanitizeName(label)}`);
      }
    }
  }
  return n;
}

// Render every copy of every card with no margin, then arrange them into a
// single borderless grid PNG (like the main-page TTS tool) for Tabletop
// Simulator. A second, identical-sized grid holds each card's flipped face —
// its first counterpart where it has one, otherwise the card back — so the two
// sheets can be used together as a front/back pair. Returns the number of cards
// laid out (0 if the user aborted the save dialog).
export async function ttsDeck(deckEntries, deckName, supertypes = [], folderColorMap = {}) {
  const fronts = [];
  const backs = [];
  const cardBack = await loadImage(CARD_BACK_URL);

  for (const c of deckEntries) {
    const entry = c.entry;
    const folderColor = folderColorMap[entry.folder_id] || '';
    const copies = c.copies || 1;
    const main = await renderFace(entry, supertypes, folderColor);

    const cp = counterpartsOf(entry)[0];
    const flipFace = cp ? await renderFace({ ...cp, folder_id: entry.folder_id }, supertypes, folderColor) : null;

    for (let i = 0; i < copies; i++) {
      fronts.push(main);
      backs.push(flipFace || cardBack);
    }
  }

  const n = fronts.length;
  if (n === 0) return 0;
  const rows = Math.min(7, Math.ceil(Math.sqrt(n)));
  const cols = Math.ceil(n / rows);
  const cellW = fronts[0].width;
  const cellH = fronts[0].height;
  const base = sanitizeName(deckName);

  const frontSheet = await buildGrid(fronts, cellW, cellH, rows, cols);
  const saved = await saveBlob(await toBlob(frontSheet), `${base}_${cols}x${rows}.png`);
  if (!saved) return 0;

  const backSheet = await buildGrid(backs, cellW, cellH, rows, cols);
  await saveBlob(await toBlob(backSheet), `${base}_flipped_${cols}x${rows}.png`);

  return n;
}