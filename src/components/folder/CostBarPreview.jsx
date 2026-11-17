import React from 'react';

// Small "?" badge on the top-left corner of a cost icon.
// borderColor is white on folder-colored backgrounds, folder-colored on white.
function QuestionBadge({ size, borderColor }) {
  const s = Math.max(18, size * 0.7);
  const strokeW = Math.max(1.6, s * 0.14);
  return (
    <div style={{
      position: 'absolute', top: -4, left: 1,
      width: s, height: s,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: s * 1.22, fontFamily: 'CaesarDressing, cursive',
      color: '#000',
      WebkitTextStroke: `${strokeW}px ${borderColor}`,
      paintOrder: 'stroke fill',
      pointerEvents: 'none', zIndex: 1, lineHeight: 1,
    }}>?</div>
  );
}

// Renders the cost bar from the chosen cost icons (layer.costIcons).
//  - Default: icons sized to the box height; if they overflow the width,
//    switch to x-mode (one icon + xN).
//  - fit mode (layer.fit): icons shrink to fit both width and height so up to
//    N icons sit side by side (used by the Income dual cost bars).
export default function CostBarPreview({ layer }) {
  const { x, y, w, h, costIcons, costQuestion, fit, questionBorderColor } = layer;
  const icons = costIcons || [];
  const questions = costQuestion || [];
  if (icons.length === 0) return null;
  const border = questionBorderColor || '#fff';

  if (fit) {
    const size = Math.min(h, Math.floor(w / icons.length));
    const total = size * icons.length;
    return (
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: total, height: size }}>
          {icons.map((url, i) => (
            <div key={i} style={{ position: 'relative', height: size, width: size }}>
              <img src={url} alt="" draggable={false} style={{ height: size, width: size, objectFit: 'contain', pointerEvents: 'none' }} />
              {questions[i] && <QuestionBadge size={size} borderColor={border} />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const size = h;
  const xMode = icons.length * size > w;

  if (xMode) {
    return (
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <div style={{ position: 'relative', height: size, width: size }}>
          <img src={icons[0]} alt="" draggable={false} style={{ height: size, width: size, objectFit: 'contain', pointerEvents: 'none' }} />
          {questions[0] && <QuestionBadge size={size} borderColor={border} />}
        </div>
        <span style={{ fontSize: (layer.fontSize || 25) * 1.4, color: '#000', fontWeight: 'bold' }}>×{icons.length}</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icons.map((url, i) => (
        <div key={i} style={{ position: 'relative', height: size, width: size }}>
          <img src={url} alt="" draggable={false} style={{ height: size, width: size, objectFit: 'contain', pointerEvents: 'none' }} />
          {questions[i] && <QuestionBadge size={size} borderColor={border} />}
        </div>
      ))}
    </div>
  );
}