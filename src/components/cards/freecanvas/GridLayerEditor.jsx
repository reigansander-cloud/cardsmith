import React, { useCallback } from 'react';
import GridSettings from '../GridSettings';
import GridEditor from '../GridEditor';

// Properties panel for a free-canvas grid layer.
// Mirrors the towers/tactical grid editor, operating on the element's own
// grids + connections via onUpdate.
export default function GridLayerEditor({ element, onUpdate }) {
  const grids = element.grids || [];
  const connections = element.connections || [];

  const handleSymbolChange = useCallback((gridIndex, row, col, symbolKey) => {
    const next = [...grids];
    const cells = { ...next[gridIndex].cells };
    if (symbolKey === 'empty') delete cells[`${row}-${col}`];
    else cells[`${row}-${col}`] = symbolKey;
    next[gridIndex] = { ...next[gridIndex], cells };
    onUpdate({ grids: next });
  }, [grids, onUpdate]);

  const handleOriginMove = useCallback((gridIndex, row, col) => {
    const next = [...grids];
    next[gridIndex] = { ...next[gridIndex], origin: { row, col } };
    onUpdate({ grids: next });
  }, [grids, onUpdate]);

  const handleConnectionEnd = useCallback((from, to) => {
    if (from.gridIndex === to.gridIndex && from.row === to.row && from.col === to.col) return;
    const exists = connections.some(c =>
      c.from.gridIndex === from.gridIndex && c.from.row === from.row && c.from.col === from.col &&
      c.to.gridIndex === to.gridIndex && c.to.row === to.row && c.to.col === to.col
    );
    if (exists) return;
    onUpdate({ connections: [...connections, { from, to }] });
  }, [connections, onUpdate]);

  const handleClearConnections = useCallback((gridIndex, row, col) => {
    onUpdate({
      connections: connections.filter(c =>
        !(c.from.gridIndex === gridIndex && c.from.row === row && c.from.col === col) &&
        !(c.to.gridIndex === gridIndex && c.to.row === row && c.to.col === col)
      ),
    });
  }, [connections, onUpdate]);

  const gridHandlers = { handleSymbolChange, handleOriginMove, handleConnectionEnd, handleClearConnections };

  return (
    <div className="space-y-3">
      <GridSettings grids={grids} onChange={(g) => onUpdate({ grids: g })} />
      {grids.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Grid Editor</div>
          <div className="bg-muted/20 rounded-lg p-3 overflow-x-auto">
            <GridEditor grids={grids} connections={connections} gridHandlers={gridHandlers} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Click a cell to set its symbol or move the origin. Drag between cells to connect them.
          </p>
        </div>
      )}
    </div>
  );
}