import React, { useRef } from 'react';
import GridDisplay from './GridDisplay';
import ConnectionLines from './ConnectionLines';

// Interactive grid editor for the side panel — lets users click cells to set
// symbols, drag between cells to draw connections, and move the origin.
export default function GridEditor({ grids, connections, gridHandlers }) {
  const containerRef = useRef(null);
  const gridCount = grids.length;
  const gridAreaW = 172;
  const gridAreaH = Math.floor(200 / Math.max(gridCount, 1));
  const maxCellW = Math.floor(gridAreaW / Math.max(...grids.map(g => g.cols), 2)) - 1;
  const maxCellH = Math.floor(gridAreaH / Math.max(...grids.map(g => g.rows), 2)) - 1;
  const maxCellSize = Math.min(maxCellW, maxCellH, 36);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div className="flex flex-col gap-1.5 w-fit">
        {grids.map((grid, idx) => (
          <GridDisplay
            key={idx}
            grid={grid}
            gridIndex={idx}
            maxCellSize={maxCellSize}
            interactive={true}
            onSymbolChange={gridHandlers.handleSymbolChange}
            onOriginMove={gridHandlers.handleOriginMove}
            onConnectionStart={() => {}}
            onConnectionEnd={gridHandlers.handleConnectionEnd}
            onClearConnections={gridHandlers.handleClearConnections}
          />
        ))}
      </div>
      <ConnectionLines connections={connections} containerRef={containerRef} />
    </div>
  );
}