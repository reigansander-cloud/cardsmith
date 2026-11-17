import { getSymbolByKey } from './gridSymbols';

// Builds an SVG string for a free-canvas grid layer.
// Used for both the live preview (inline SVG) and the canvas export (Image).
// `width`/`height` are the element's pixel dimensions in card space.
export function buildGridSVG(grids, connections, width, height, color = '#3a2a0a', fillContainer = false) {
  if (!grids || grids.length === 0 || width <= 0 || height <= 0) return '';
  const n = grids.length;
  const boxH = height / n;
  const layouts = grids.map((g) => {
    const cellSize = Math.min(width / g.cols, boxH / g.rows);
    const gridW = g.cols * cellSize;
    const gridH = g.rows * cellSize;
    return {
      cellSize,
      offsetX: (width - gridW) / 2,
      offsetY: 0,
      gridW,
      gridH,
    };
  });
  // vertical offsets: stack centered in each box
  let yCursor = 0;
  layouts.forEach((l, gi) => {
    l.offsetY = gi * boxH + (boxH - l.gridH) / 2;
    yCursor = gi * boxH + boxH;
  });

  const w = fillContainer ? '100%' : width;
  const h = fillContainer ? '100%' : height;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">`;

  grids.forEach((g, gi) => {
    const { cellSize, offsetX, offsetY } = layouts[gi];
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const cx = offsetX + c * cellSize;
        const cy = offsetY + r * cellSize;
        const isOrigin = g.origin && g.origin.row === r && g.origin.col === c;
        svg += `<rect x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${isOrigin ? 'rgba(58,42,10,0.15)' : 'transparent'}" stroke="${color}" stroke-width="1"/>`;
        if (isOrigin) {
          svg += `<circle cx="${(cx + cellSize / 2).toFixed(2)}" cy="${(cy + cellSize / 2).toFixed(2)}" r="${Math.max(1, cellSize * 0.1).toFixed(2)}" fill="${color}"/>`;
        }
        const symKey = g.cells && g.cells[`${r}-${c}`];
        if (symKey && symKey !== 'empty') {
          const sym = getSymbolByKey(symKey);
          if (sym) {
            const s = cellSize * 0.65;
            const sx = cx + (cellSize - s) / 2;
            const sy = cy + (cellSize - s) / 2;
            svg += `<g transform="translate(${sx.toFixed(2)},${sy.toFixed(2)})" color="${color}">${sym.render(s)}</g>`;
          }
        }
      }
    }
  });

  const cellCenter = (gi, r, c) => {
    const { cellSize, offsetX, offsetY } = layouts[gi];
    return { x: offsetX + c * cellSize + cellSize / 2, y: offsetY + r * cellSize + cellSize / 2 };
  };
  for (const conn of (connections || [])) {
    const a = cellCenter(conn.from.gridIndex, conn.from.row, conn.from.col);
    const b = cellCenter(conn.to.gridIndex, conn.to.row, conn.to.col);
    svg += `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${color}" stroke-width="2"/>`;
  }

  svg += '</svg>';
  return svg;
}

// Convert an SVG string to an HTMLImageElement for canvas drawing.
export function svgToImage(svg) {
  return new Promise((resolve) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}