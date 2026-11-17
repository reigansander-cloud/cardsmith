export function downloadCanvas(canvas, filename, mime = 'image/png') {
  const link = document.createElement('a');
  link.download = filename || 'card.png';
  link.href = canvas.toDataURL(mime);
  link.click();
}

export function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.download = filename || 'download';
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}