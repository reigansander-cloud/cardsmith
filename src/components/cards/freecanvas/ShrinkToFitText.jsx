import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';

// Renders text content that shrinks to fit its container when "shrinkToFit" is on.
// The stored fontSize never changes; when shrinking is active the parent is notified
// so the editor can mark the font-size input red.
export default function ShrinkToFitText({ el, children, onShrunkChange }) {
  const measureRef = useRef(null);
  const containerRef = useRef(null);
  const lastRef = useRef(null);
  const [scale, setScale] = useState(1);
  const shrinkToFit = el.shrinkToFit !== false;

  const baseStyle = {
    fontSize: `${el.fontSize || 14}px`,
    color: el.color || '#000000',
    textAlign: el.align || 'left',
    fontWeight: el.bold ? 'bold' : 'normal',
    fontStyle: el.italic ? 'italic' : 'normal',
    textDecoration: el.underline ? 'underline' : 'none',
    lineHeight: 1.3,
    fontFamily: el.fontFamily || 'Inter, sans-serif',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    boxSizing: 'border-box',
  };

  const report = useCallback((isShrunk) => {
    if (lastRef.current !== isShrunk) {
      lastRef.current = isShrunk;
      onShrunkChange?.(el.id, isShrunk);
    }
  }, [el.id, onShrunkChange]);

  useLayoutEffect(() => {
    if (!shrinkToFit) {
      setScale(1);
      report(false);
      return;
    }
    const node = measureRef.current;
    if (!node) return;
    const measure = () => {
      const availW = node.clientWidth;
      const availH = node.clientHeight;
      const base = el.fontSize || 14;
      let chosen = base;
      // Step down in 1px increments to the smallest integer font size that fits.
      while (chosen > 6) {
        node.style.fontSize = `${chosen}px`;
        if (node.scrollHeight <= availH && node.scrollWidth <= availW) break;
        chosen -= 1;
      }
      node.style.fontSize = `${base}px`;
      setScale(chosen / base);
      report(chosen < base);
    };
    measure();
    // Observe the container (not the measure node) — measure mutates the
    // measure node's font size, so observing it would loop.
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [el.content, el.fontSize, el.fontFamily, el.bold, el.italic, el.underline, el.align, el.width, el.height, el.border, el.borderWidth, shrinkToFit, report]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden pointer-events-none select-none relative"
      style={{ ...baseStyle, ...(el.border ? { border: `${el.borderWidth || 2}px solid ${el.color || '#000000'}` } : {}) }}
    >
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{ ...baseStyle, position: 'absolute', inset: 0, visibility: 'hidden', overflow: 'visible', pointerEvents: 'none' }}
      >
        {children}
      </div>
      <div style={{ ...baseStyle, fontSize: `${(el.fontSize || 14) * scale}px`, position: 'relative', width: '100%', height: '100%' }}>
        {children}
      </div>
    </div>
  );
}