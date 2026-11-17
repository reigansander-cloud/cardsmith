import React, { useState } from 'react';
import MiniEntry from '../MiniEntry';
import { useDropZone } from '@/context/PointerDragContext';

const TOKEN_COLORS = {
  damage: '#dc2626', armor: '#2563eb', charge: '#ca8a04',
  support: '#ffffff', other: '#28a745', duration: '#7c3aed',
};

const TABS = [
  { key: 'discard', label: 'Graveyard' },
  { key: 'banished', label: 'Banished' },
  { key: 'deleted', label: 'Deleted' },
];

// Tabbed graveyard sidebar. Three tabs: Graveyard, Banished, Deleted.
// Drag cards onto tabs to move them between zones. Click a card to add charge,
// right-click to remove charge. Deleted tab doesn't show a count.
export default function SidebarDiscard({ discards, banished, deleted, entries, supertypes, onDiscardDragStart, onCardClick, playerIndex, onDrop, onChargeChange, initialTab = 'discard' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const zones = { discard: discards, banished: banished, deleted: deleted };
  const cards = zones[activeTab] || [];
  const containerDrop = useDropZone((payload) => onDrop(payload, { zone: activeTab, player_index: playerIndex }));
  const tabDrops = {
    discard: useDropZone((payload) => onDrop(payload, { zone: 'discard', player_index: playerIndex })),
    banished: useDropZone((payload) => onDrop(payload, { zone: 'banished', player_index: playerIndex })),
    deleted: useDropZone((payload) => onDrop(payload, { zone: 'deleted', player_index: playerIndex })),
  };

  return (
    <div className="flex flex-col gap-2 p-3" {...containerDrop}>
      <div className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            {...tabDrops[tab.key]}
            className={`px-5 py-2.5 text-lg rounded-t transition-colors ${activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
          >
            {tab.label}{tab.key !== 'deleted' && ` (${zones[tab.key]?.length || 0})`}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground/50">Drag cards onto tabs to move. Click: +charge, right-click: −charge.</p>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">Empty</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {cards.map((card) => (
            <div key={card.id} onPointerDown={onDiscardDragStart(card, playerIndex)} onClick={() => onChargeChange(card.id, null, 'charge', 1)} onContextMenu={(e) => { e.preventDefault(); onChargeChange(card.id, null, 'charge', -1); }} className="relative cursor-grab hover:scale-105 transition-transform" style={{ touchAction: 'none' }}>
              <MiniEntry entry={entries[card.entry_id]} supertypes={supertypes} targetWidth={130} />
              {card?.tokens && (
                <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
                  {Object.entries(card.tokens).map(([key, val]) => {
                    if (!val || val === 0) return null;
                    const bg = TOKEN_COLORS[key] || '#666';
                    return <div key={key} className="text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none" style={{ background: bg, color: bg === '#ffffff' ? '#000' : '#fff' }}>{val}</div>;
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