import React from 'react';
import { X } from 'lucide-react';
import MiniEntry from './MiniEntry';

// Closable popup showing income option cards: opponent on top, yours below,
// each row ordered by income symbol.
export default function IncomeOptionsDialog({ incomeOptions, entries, supertypes, playerNames, myPlayerIndex, onClose }) {
  const sortBySymbol = (ids) => [...(ids || [])].sort((a, b) => {
    const sa = entries[a]?.income_symbol || '';
    const sb = entries[b]?.income_symbol || '';
    if (sa !== sb) return sa < sb ? -1 : 1;
    return 0;
  });

  const renderRow = (pi, label) => {
    const sorted = sortBySymbol(incomeOptions?.[pi] || []);
    return (
      <div className="flex flex-col items-center gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
        <div className="flex gap-2 flex-wrap justify-center max-w-2xl">
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground">No income options</p>
          ) : (
            sorted.map((id) => (
              <MiniEntry key={id} entry={entries[id]} supertypes={supertypes} targetWidth={120} />
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Income Options</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="flex flex-col gap-6 items-center">
          {(incomeOptions || []).map((_, pi) => (
            <React.Fragment key={pi}>
              {renderRow(pi, `${playerNames[pi] || `Player ${pi + 1}`}${pi === myPlayerIndex ? ' — You' : ' — Opponent'}`)}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}