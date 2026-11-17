import React from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';

export default function GridSettings({ grids, onChange }) {
  const addGrid = () => {
    if (grids.length >= 4) return;
    onChange([...grids, { rows: 3, cols: 3, origin: { row: 1, col: 1 }, cells: {} }]);
  };

  const removeGrid = (idx) => {
    if (grids.length <= 1) return;
    onChange(grids.filter((_, i) => i !== idx));
  };

  const updateGrid = (idx, field, value) => {
    const updated = [...grids];
    const g = { ...updated[idx] };

    if (field === 'rows' || field === 'cols') {
      const v = Math.min(6, Math.max(2, value));
      g[field] = v;
      if (g.origin.row >= (field === 'rows' ? v : g.rows)) g.origin = { ...g.origin, row: 0 };
      if (g.origin.col >= (field === 'cols' ? v : g.cols)) g.origin = { ...g.origin, col: 0 };
    }

    updated[idx] = g;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Grids ({grids.length}/4)
        </span>
        {grids.length < 4 && (
          <button
            className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
            onClick={addGrid}
          >+ Add Grid</button>
        )}
      </div>
      {grids.map((grid, idx) => (
        <div key={idx} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-10">
            Grid {idx + 1}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              className="w-5 h-5 flex items-center justify-center rounded border border-border hover:border-primary transition-colors"
              onClick={() => updateGrid(idx, 'rows', grid.rows - 1)}
            ><Minus size={10} /></button>
            <span className="text-xs text-foreground font-mono w-8 text-center">{grid.rows}×{grid.cols}</span>
            <button
              className="w-5 h-5 flex items-center justify-center rounded border border-border hover:border-primary transition-colors"
              onClick={() => updateGrid(idx, 'rows', grid.rows + 1)}
            ><Plus size={10} /></button>
          </div>
          <span className="text-[9px] text-muted-foreground">R</span>
          <div className="flex items-center gap-1.5">
            <button
              className="w-5 h-5 flex items-center justify-center rounded border border-border hover:border-primary transition-colors"
              onClick={() => updateGrid(idx, 'cols', grid.cols - 1)}
            ><Minus size={10} /></button>
            <span className="text-xs text-foreground font-mono w-4 text-center">{grid.cols}</span>
            <button
              className="w-5 h-5 flex items-center justify-center rounded border border-border hover:border-primary transition-colors"
              onClick={() => updateGrid(idx, 'cols', grid.cols + 1)}
            ><Plus size={10} /></button>
          </div>
          <span className="text-[9px] text-muted-foreground">C</span>
          {grids.length > 1 && (
            <button
              className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => removeGrid(idx)}
            ><Trash2 size={13} /></button>
          )}
        </div>
      ))}
    </div>
  );
}