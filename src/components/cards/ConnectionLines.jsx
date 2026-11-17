import React, { useEffect, useState, useCallback } from 'react';

export default function ConnectionLines({ connections, containerRef }) {
  const [lines, setLines] = useState([]);

  const calculateLines = useCallback(() => {
    if (!containerRef?.current || !connections?.length) {
      setLines([]);
      return;
    }
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const newLines = [];

    connections.forEach((conn, idx) => {
      const fromCell = container.querySelector(
        `[data-grid="${conn.from.gridIndex}"][data-row="${conn.from.row}"][data-col="${conn.from.col}"]`
      );
      const toCell = container.querySelector(
        `[data-grid="${conn.to.gridIndex}"][data-row="${conn.to.row}"][data-col="${conn.to.col}"]`
      );
      if (fromCell && toCell) {
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        newLines.push({
          key: idx,
          x1: fromRect.left + fromRect.width / 2 - containerRect.left,
          y1: fromRect.top + fromRect.height / 2 - containerRect.top,
          x2: toRect.left + toRect.width / 2 - containerRect.left,
          y2: toRect.top + toRect.height / 2 - containerRect.top
        });
      }
    });
    setLines(newLines);
  }, [connections, containerRef]);

  useEffect(() => {
    calculateLines();
    const timer = setInterval(calculateLines, 200);
    return () => clearInterval(timer);
  }, [calculateLines]);

  if (!lines.length) return null;

  return (
    <svg
      className="absolute pointer-events-none"
      style={{ zIndex: 1, top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
    >
      {lines.map(line => (
        <line
          key={line.key}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="hsl(38, 80%, 55%)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}