import React from 'react';
import GridCell from './GridCell';

export default function GridDisplay({
  grid, gridIndex, maxCellSize,
  onSymbolChange, onOriginMove, onConnectionStart, onConnectionEnd,
  onClearConnections, interactive = true
}) {
  const { rows, cols, origin, cells } = grid;
  const cellSize = Math.min(maxCellSize, 36);

  return (
    <div className="inline-block" data-grid-index={gridIndex}>
      <div
        className="grid rounded-sm"
        style={{ border: '1px solid #3a2a0a' }}
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`
        }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const cellKey = `${r}-${c}`;
            return (
              <GridCell
                key={cellKey}
                row={r}
                col={c}
                gridIndex={gridIndex}
                cellSize={cellSize}
                symbol={cells?.[cellKey]}
                isOrigin={origin?.row === r && origin?.col === c}
                onSymbolChange={(row, col, sym) => onSymbolChange?.(gridIndex, row, col, sym)}
                onOriginMove={(row, col) => onOriginMove?.(gridIndex, row, col)}
                onConnectionStart={onConnectionStart}
                onConnectionEnd={onConnectionEnd}
                onClearConnections={onClearConnections}
                interactive={interactive}
              />
            );
          })
        )}
      </div>
    </div>
  );
}