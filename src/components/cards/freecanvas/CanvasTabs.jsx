import React from 'react';
import { X, Plus } from 'lucide-react';

export default function CanvasTabs({ canvases, activeIndex, onSelect, onClose, onAdd, accentClass }) {
  if (!canvases || canvases.length === 0) return null;
  return (
    <div className="flex items-center gap-0.5 pl-4" data-no-deselect>
      {canvases.map((c, i) => (
        <div
          key={c.id}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md cursor-pointer text-xs font-medium transition-colors ${
            i === activeIndex ? accentClass || 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          onClick={() => onSelect(i)}
        >
          <span>{c.name || `Canvas ${i + 1}`}</span>
          {canvases.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(i); }}
              className="hover:bg-primary-foreground/20 rounded p-0.5"
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}
      {canvases.length < 5 && (
        <button
          onClick={onAdd}
          className="px-2 py-1.5 rounded-t-md cursor-pointer text-muted-foreground hover:bg-muted/50"
          title="Add canvas"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}