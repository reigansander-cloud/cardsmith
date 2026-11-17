import { jsPDF } from 'jspdf';

export const PRINT_SIZES = {
  standard: { label: 'Standard', desc: '360 × 504', cardW: 2.5, cardH: 3.5, unit: 'in', format: 'letter', pageW: 8.5, pageH: 11 },
  seven_wonders: { label: '7 Wonders', desc: '461 × 709', cardW: 59, cardH: 91, unit: 'mm', format: 'a4', pageW: 210, pageH: 297 },
};

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, format: file.type === 'image/png' ? 'PNG' : 'JPEG', url });
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export async function generatePrintSheetPDF(files, sizeKey) {
  const s = PRINT_SIZES[sizeKey];
  if (!s) throw new Error('Unknown print size');
  const loaded = await Promise.all(files.map(loadImageFromFile));
  const doc = new jsPDF({ unit: s.unit, format: s.format });
  const cols = 3, rows = 3, perPage = 9;
  const offX = (s.pageW - cols * s.cardW) / 2;
  const offY = (s.pageH - rows * s.cardH) / 2;
  loaded.forEach((entry, i) => {
    const slot = i % perPage;
    if (i > 0 && slot === 0) doc.addPage();
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    doc.addImage(entry.img, entry.format, offX + col * s.cardW, offY + row * s.cardH, s.cardW, s.cardH);
  });
  loaded.forEach(e => URL.revokeObjectURL(e.url));
  doc.save(`print-sheet-${sizeKey}.pdf`);
}