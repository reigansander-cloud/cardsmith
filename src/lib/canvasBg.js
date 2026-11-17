// Shared card-background painter: solid color, optional cover image clipped to
// the rounded card shape. Used by every card draw function so preview + export
// stay pixel-identical. `getImage(url)` resolves a cached HTMLImageElement.

function roundedPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCardBackground(ctx, w, h, radius, bgColor, bgImage, getImage) {
  if (bgColor) {
    ctx.fillStyle = bgColor;
    roundedPath(ctx, 0, 0, w, h, radius);
    ctx.fill();
  }

  if (bgImage) {
    const img = getImage ? getImage(bgImage) : null;
    if (img) {
      ctx.save();
      roundedPath(ctx, 0, 0, w, h, radius);
      ctx.clip();
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.restore();
    }
  }
}