import React, { useRef, useState, useLayoutEffect } from 'react';

// Renders rich text with [b]..[/b], [i]..[/i], [color:hex]..[/color], [icon:url].
function renderRichContent(content, baseItalic = false) {
  if (!content) return null;
  const re = /\[(b|i|\/b|\/i|color:[^\]]+|\/color|icon:[^\]]+)\]/g;
  const out = [];
  let last = 0;
  let m;
  let key = 0;
  let bold = false;
  let italic = baseItalic;
  let color = null;
  const flush = (text) => {
    if (!text) return;
    out.push(
      <span key={key++} style={{ fontWeight: (bold || color) ? 'bold' : 'normal', fontStyle: italic ? 'italic' : 'normal', color: color || undefined, fontFamily: color ? 'CaesarDressing, cursive' : undefined }}>
        {text}
      </span>
    );
  };
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) flush(content.slice(last, m.index));
    const tag = m[1];
    if (tag === 'b') bold = true;
    else if (tag === '/b') bold = false;
    else if (tag === 'i') italic = true;
    else if (tag === '/i') italic = false;
    else if (tag.startsWith('color:')) color = tag.slice(6);
    else if (tag === '/color') color = null;
    else if (tag.startsWith('icon:')) {
      out.push(<img key={key++} src={tag.slice(5)} alt="" draggable={false} style={{ height: '1.35em', verticalAlign: 'middle', display: 'inline-block', pointerEvents: 'none' }} />);
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) flush(content.slice(last));
  return out;
}

export default function PreviewText({ layer }) {
  const { x, y, w, h, fontSize, fontFamily, align, italic, color, content, shrinkToFit, valign, outline } = layer;
  const measureRef = useRef(null);
  const [size, setSize] = useState(fontSize);

  useLayoutEffect(() => {
    if (!shrinkToFit) {
      setSize(fontSize);
      return;
    }
    const node = measureRef.current;
    if (!node) return;
    const measure = () => {
      let s = fontSize;
      node.style.fontSize = `${s}px`;
      while (s > 1 && (node.scrollHeight > h || node.scrollWidth > w)) {
        s -= 1;
        node.style.fontSize = `${s}px`;
      }
      setSize(s);
    };
    measure();
    // Re-measure once web fonts have loaded (their metrics change the fit).
    // A ResizeObserver would loop here, since measure mutates the observed
    // node's font size and re-triggers the observer.
    let cancelled = false;
    if (document.fonts) {
      document.fonts.ready.then(() => { if (!cancelled) measure(); });
    }
    return () => { cancelled = true; };
  }, [content, fontSize, fontFamily, align, italic, w, h, shrinkToFit]);

  const baseStyle = {
    position: 'absolute',
    left: x,
    top: y,
    width: w,
    height: h,
    fontSize: `${size}px`,
    fontFamily,
    textAlign: align,
    fontStyle: italic ? 'italic' : 'normal',
    color: outline ? 'transparent' : color,
    WebkitTextStroke: outline ? `${Math.max(1, Math.round(size * 0.03))}px ${color}` : undefined,
    lineHeight: 1.3,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'hidden',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: valign === 'bottom' ? 'flex-end' : valign === 'center' ? 'center' : 'flex-start',
  };

  return (
    <div style={baseStyle}>
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{ position: 'absolute', visibility: 'hidden', width: w, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily, fontStyle: italic ? 'italic' : 'normal', lineHeight: 1.3, boxSizing: 'border-box', overflow: 'visible' }}
      >
        {renderRichContent(content, italic)}
      </div>
      <div style={{ width: '100%' }}>{renderRichContent(content, italic)}</div>
    </div>
  );
}