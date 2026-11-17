import React from 'react';
import { GRID_SYMBOLS, SYMBOL_CATEGORIES } from '@/lib/gridSymbols';
import SymbolRenderer from './SymbolRenderer';

export default function SymbolPicker({ onSelect, onClose }) {
  return (
    <div
      className="absolute z-50 bg-card border border-border rounded-lg shadow-xl p-2 w-56"
      onClick={(e) => e.stopPropagation()}
    >
      {SYMBOL_CATEGORIES.map(cat => (
        <div key={cat.key} className="mb-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-1">
            {cat.label}
          </div>
          <div className="flex flex-wrap gap-1">
            {GRID_SYMBOLS.filter(s => s.category === cat.key).map(sym => (
              <button
                key={sym.key}
                className="w-7 h-7 flex items-center justify-center rounded border border-border hover:border-primary hover:bg-primary/10 transition-colors"
                title={sym.label}
                onClick={() => { onSelect(sym.key); onClose(); }}
              >
                {sym.key === 'empty' ? (
                  <span className="text-[9px] text-muted-foreground">∅</span>
                ) : (
                  <SymbolRenderer symbolKey={sym.key} size={16} />
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}