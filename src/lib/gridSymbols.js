// Grid cell symbol definitions
// Each symbol has a key, label, category, and render function returning SVG content
export const GRID_SYMBOLS = [
  // Basic
  { key: 'empty', label: 'Empty', category: 'basic', render: () => '' },
  { key: 'x', label: 'X', category: 'basic', render: (s) => `<line x1="${s*0.2}" y1="${s*0.2}" x2="${s*0.8}" y2="${s*0.8}" stroke="currentColor" stroke-width="2"/><line x1="${s*0.8}" y1="${s*0.2}" x2="${s*0.2}" y2="${s*0.8}" stroke="currentColor" stroke-width="2"/>` },
  { key: 'circle', label: 'Circle', category: 'basic', render: (s) => `<circle cx="${s/2}" cy="${s/2}" r="${s*0.3}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'plus', label: 'Plus', category: 'basic', render: (s) => `<line x1="${s/2}" y1="${s*0.15}" x2="${s/2}" y2="${s*0.85}" stroke="currentColor" stroke-width="2"/><line x1="${s*0.15}" y1="${s/2}" x2="${s*0.85}" y2="${s/2}" stroke="currentColor" stroke-width="2"/>` },
  { key: 'star', label: 'Star', category: 'basic', render: (s) => {
    const cx=s/2, cy=s/2, r=s*0.35, ri=s*0.15;
    let pts=[];
    for(let i=0;i<5;i++){
      const a1=(i*72-90)*Math.PI/180, a2=((i*72+36)-90)*Math.PI/180;
      pts.push(`${cx+r*Math.cos(a1)},${cy+r*Math.sin(a1)}`);
      pts.push(`${cx+ri*Math.cos(a2)},${cy+ri*Math.sin(a2)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="currentColor"/>`;
  }},
  // Arrows
  { key: 'arrow_up', label: '↑ Up', category: 'arrows', render: (s) => `<line x1="${s/2}" y1="${s*0.8}" x2="${s/2}" y2="${s*0.2}" stroke="currentColor" stroke-width="2"/><polyline points="${s*0.3},${s*0.4} ${s/2},${s*0.2} ${s*0.7},${s*0.4}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'arrow_down', label: '↓ Down', category: 'arrows', render: (s) => `<line x1="${s/2}" y1="${s*0.2}" x2="${s/2}" y2="${s*0.8}" stroke="currentColor" stroke-width="2"/><polyline points="${s*0.3},${s*0.6} ${s/2},${s*0.8} ${s*0.7},${s*0.6}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'arrow_left', label: '← Left', category: 'arrows', render: (s) => `<line x1="${s*0.8}" y1="${s/2}" x2="${s*0.2}" y2="${s/2}" stroke="currentColor" stroke-width="2"/><polyline points="${s*0.4},${s*0.3} ${s*0.2},${s/2} ${s*0.4},${s*0.7}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'arrow_right', label: '→ Right', category: 'arrows', render: (s) => `<line x1="${s*0.2}" y1="${s/2}" x2="${s*0.8}" y2="${s/2}" stroke="currentColor" stroke-width="2"/><polyline points="${s*0.6},${s*0.3} ${s*0.8},${s/2} ${s*0.6},${s*0.7}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'arrow_up_left', label: '↖ Up-Left', category: 'arrows', render: (s) => `<line x1="${s*0.75}" y1="${s*0.75}" x2="${s*0.25}" y2="${s*0.25}" stroke="currentColor" stroke-width="2"/><polyline points="${s*0.25},${s*0.5} ${s*0.25},${s*0.25} ${s*0.5},${s*0.25}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'arrow_up_right', label: '↗ Up-Right', category: 'arrows', render: (s) => `<line x1="${s*0.25}" y1="${s*0.75}" x2="${s*0.75}" y2="${s*0.25}" stroke="currentColor" stroke-width="2"/><polyline points="${s*0.5},${s*0.25} ${s*0.75},${s*0.25} ${s*0.75},${s*0.5}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'arrow_down_left', label: '↙ Down-Left', category: 'arrows', render: (s) => `<line x1="${s*0.75}" y1="${s*0.25}" x2="${s*0.25}" y2="${s*0.75}" stroke="currentColor" stroke-width="2"/><polyline points="${s*0.25},${s*0.5} ${s*0.25},${s*0.75} ${s*0.5},${s*0.75}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'arrow_down_right', label: '↘ Down-Right', category: 'arrows', render: (s) => `<line x1="${s*0.25}" y1="${s*0.25}" x2="${s*0.75}" y2="${s*0.75}" stroke="currentColor" stroke-width="2"/><polyline points="${s*0.75},${s*0.5} ${s*0.75},${s*0.75} ${s*0.5},${s*0.75}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  // Lines
  { key: 'line_vertical', label: '│ Vertical', category: 'lines', render: (s) => `<line x1="${s/2}" y1="${s*0.1}" x2="${s/2}" y2="${s*0.9}" stroke="currentColor" stroke-width="2"/>` },
  { key: 'line_horizontal', label: '─ Horizontal', category: 'lines', render: (s) => `<line x1="${s*0.1}" y1="${s/2}" x2="${s*0.9}" y2="${s/2}" stroke="currentColor" stroke-width="2"/>` },
  { key: 'line_diag_tl_br', label: '╲ Diagonal TL-BR', category: 'lines', render: (s) => `<line x1="${s*0.15}" y1="${s*0.15}" x2="${s*0.85}" y2="${s*0.85}" stroke="currentColor" stroke-width="2"/>` },
  { key: 'line_diag_tr_bl', label: '╱ Diagonal TR-BL', category: 'lines', render: (s) => `<line x1="${s*0.85}" y1="${s*0.15}" x2="${s*0.15}" y2="${s*0.85}" stroke="currentColor" stroke-width="2"/>` },
  // Corners
  { key: 'corner_top_right', label: '┐ Top→Right', category: 'corners', render: (s) => `<polyline points="${s/2},${s*0.1} ${s/2},${s/2} ${s*0.9},${s/2}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'corner_right_bottom', label: '┘ Right→Bottom', category: 'corners', render: (s) => `<polyline points="${s*0.9},${s/2} ${s/2},${s/2} ${s/2},${s*0.9}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'corner_bottom_left', label: '└ Bottom→Left', category: 'corners', render: (s) => `<polyline points="${s/2},${s*0.9} ${s/2},${s/2} ${s*0.1},${s/2}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'corner_left_top', label: '┌ Left→Top', category: 'corners', render: (s) => `<polyline points="${s*0.1},${s/2} ${s/2},${s/2} ${s/2},${s*0.1}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'corner_top_left', label: '┑ Top→Left', category: 'corners', render: (s) => `<polyline points="${s/2},${s*0.1} ${s/2},${s/2} ${s*0.1},${s/2}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'corner_left_bottom', label: '┕ Left→Bottom', category: 'corners', render: (s) => `<polyline points="${s*0.1},${s/2} ${s/2},${s/2} ${s/2},${s*0.9}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'corner_bottom_right', label: '┙ Bottom→Right', category: 'corners', render: (s) => `<polyline points="${s/2},${s*0.9} ${s/2},${s/2} ${s*0.9},${s/2}" fill="none" stroke="currentColor" stroke-width="2"/>` },
  { key: 'corner_right_top', label: '┒ Right→Top', category: 'corners', render: (s) => `<polyline points="${s*0.9},${s/2} ${s/2},${s/2} ${s/2},${s*0.1}" fill="none" stroke="currentColor" stroke-width="2"/>` },
];

export function getSymbolByKey(key) {
  return GRID_SYMBOLS.find(s => s.key === key);
}

export const SYMBOL_CATEGORIES = [
  { key: 'basic', label: 'Basic' },
  { key: 'arrows', label: 'Arrows' },
  { key: 'lines', label: 'Lines' },
  { key: 'corners', label: 'Corners' },
];