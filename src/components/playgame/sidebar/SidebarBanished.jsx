import React from 'react';
import MiniEntry from '../MiniEntry';

const TOKEN_COLORS = {
  damage: '#dc2626', armor: '#2563eb', charge: '#ca8a04',
  support: '#ffffff', other: '#28a745',
};

// Shows the player's banished cards. 3 per row, tokens rendered on card.
export default function SidebarBanished({ banished, entries, supertypes, onCardClick, playerIndex }) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <h4 className="text-sm font-bold text-foreground">Banished ({banished.length})</h4>
      {banished.length === 0 ? (
        <p className="text-sm text-muted-foreground">Empty</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {banished.map((card) => (
            <div key={card.id} className="relative cursor-pointer" onClick={() => onCardClick(card, { zone: 'banished', player_index: playerIndex })}>
              <MiniEntry entry={entries[card.entry_id]} supertypes={supertypes} targetWidth={100} />
              {card?.tokens && (
                <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
                  {Object.entries(card.tokens).map(([key, val]) => {
                    if (!val || val === 0) return null;
                    if (key === 'influence_mod') return null;
                    const bg = TOKEN_COLORS[key] || '#666';
                    return <div key={key} className="text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center" style={{ background: bg, color: bg === '#ffffff' ? '#000' : '#fff' }}>{val}</div>;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}