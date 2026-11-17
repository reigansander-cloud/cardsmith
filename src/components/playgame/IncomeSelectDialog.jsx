import React from 'react';
import MiniEntry from './MiniEntry';

const RUN_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/a0eaf5cb77_188e5e7b1_run.png';

// Full-screen overlay shown during the income_select phase. Renders one row
// per player in player-index order so all players' options are visible. Every
// player's options are shown face-up so you can make an informed decision; only
// the current player's row is clickable. A rally toggle sits in the top-right.
export default function IncomeSelectDialog({ players, state, entries, supertypes, myPlayerIndex, rallyToggle, onToggleRally, onSelectIncome }) {
  const sortBySymbol = (ids) => [...(ids || [])].sort((a, b) => {
    const sa = entries[a]?.income_symbol || '';
    const sb = entries[b]?.income_symbol || '';
    if (sa !== sb) return sa < sb ? -1 : 1;
    return 0;
  });

  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-40 p-4">
      <div className="bg-card border border-border rounded-lg p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onToggleRally}
          className={`absolute top-4 right-4 p-2 rounded-lg border-2 transition-colors ${rallyToggle ? 'border-primary bg-primary/20' : 'border-border bg-muted/50'}`}
          title="Rally: move non-structure cards from battlefields to rearguard and ready all cards"
        >
          <img src={RUN_ICON_URL} className="w-8 h-8" alt="Rally" />
        </button>
        <h3 className="text-2xl font-bold text-foreground mb-6">Select Income Option</h3>
        <div className="flex flex-col gap-6 items-center">
          {players.map((p, pi) => {
            const isMe = pi === myPlayerIndex;
            const opts = sortBySymbol(state.income_options?.[pi] || []);
            const selected = p.income_selected;
            return (
              <div key={pi} className="flex flex-col items-center gap-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {p.user_name || `Player ${pi + 1}`}{isMe ? ' — You' : ''}{selected ? ' ✓' : ''}
                </h4>
                <div className="flex gap-2 flex-wrap justify-center">
                  {opts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No income options</p>
                  ) : isMe ? (
                    opts.map((id) => (
                      <button key={id} onClick={() => onSelectIncome(id)} className="hover:scale-105 transition-transform">
                        <MiniEntry entry={entries[id]} supertypes={supertypes} targetWidth={160} />
                      </button>
                    ))
                  ) : (
                    opts.map((id) => (
                      <MiniEntry key={id} entry={entries[id]} supertypes={supertypes} targetWidth={160} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}