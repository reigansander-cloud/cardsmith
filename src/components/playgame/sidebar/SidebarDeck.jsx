import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Layers, Eye, Shuffle, X } from 'lucide-react';
import MiniEntry from '../MiniEntry';
import CardObject from '../CardObject';
import { useDropZone } from '@/context/PointerDragContext';

// Remembers the last "View Top" count entered during this game session so the
// prompt re-opens with the user's previous value instead of always defaulting 3.
let lastViewTopCount = 3;

function DeckCardSlot({ card, entryId, entries, supertypes, playerIndex, onDrop, makeDragStart, forceFaceUp }) {
  const dropProps = useDropZone((payload) => onDrop(payload, { zone: 'deck', player_index: playerIndex, before_card_id: card?.id }));
  const displayCard = forceFaceUp && card ? { ...card, flipped: false, state: 0 } : card;
  return (
    <div data-card-id={card?.id} {...dropProps}>
      {card ? (
        <CardObject card={displayCard} entry={entries[entryId]} entries={entries} supertypes={supertypes}
          targetWidth={60}
          location={{ zone: 'deck', player_index: playerIndex }}
          onPointerDown={makeDragStart ? makeDragStart(card, 'deck', playerIndex, undefined, forceFaceUp ? { forceFaceUp: true } : undefined) : undefined}
          onSelect={() => {}} />
      ) : (
        <MiniEntry entry={entries[entryId]} supertypes={supertypes} targetWidth={60} />
      )}
    </div>
  );
}

// Sidebar view for a player's deck. Supports two modes:
// - Shuffled (default): deck is an array of entry ID strings, draws are random.
// - Stacked: deck is an array of { id, entry_id, flipped } card objects in a
//   fixed order; draws come from the top. Cards can be dragged in from other
//   zones at a specific position (face-up). View toggles all face-up/face-down.
//   Shuffle converts back to entry ID strings (random draw mode).
export default function SidebarDeck({ deck, entries, supertypes, playerIndex, onStackDeck, onViewDeck, onShuffleDeck, onDrop, makeDragStart }) {
  const isStacked = deck.length > 0 && typeof deck[0] === 'object';
  const allFaceUp = isStacked && deck.every((dc) => !dc.flipped);
  const deckDrop = useDropZone((payload) => onDrop(payload, { zone: 'deck', player_index: playerIndex }));
  const [showViewTopInput, setShowViewTopInput] = useState(false);
  const [viewTopInput, setViewTopInput] = useState(String(lastViewTopCount));
  const [viewTopCount, setViewTopCount] = useState(null);

  const handleViewTopClick = () => { setViewTopInput(String(lastViewTopCount)); setShowViewTopInput(true); };
  const handleViewTopSubmit = (e) => {
    e.preventDefault();
    const n = Math.max(1, parseInt(viewTopInput) || 1);
    lastViewTopCount = n;
    setViewTopCount(n);
    setShowViewTopInput(false);
  };
  const topCards = (isStacked && viewTopCount) ? deck.slice(0, viewTopCount) : [];

  // When shuffled (not stacked), sort display by cost → supertype → influence.
  // Stacked decks keep their draw order intact.
  const sortedDeck = useMemo(() => {
    if (isStacked) return deck;
    const stOrder = {};
    (supertypes || []).forEach((st, i) => { stOrder[st.name] = st.sort_order ?? i; });
    const getInf = (e) => {
      if (!e?.influence) return -1;
      if (e.influence === '?') return 9999;
      return parseInt(e.influence) || 0;
    };
    return [...deck].sort((a, b) => {
      const ea = entries[typeof a === 'object' ? a.entry_id : a];
      const eb = entries[typeof b === 'object' ? b.entry_id : b];
      if (!ea || !eb) return 0;
      if ((ea.cost || 0) !== (eb.cost || 0)) return (ea.cost || 0) - (eb.cost || 0);
      const stDiff = (stOrder[ea.supertype] ?? 999) - (stOrder[eb.supertype] ?? 999);
      if (stDiff !== 0) return stDiff;
      return getInf(ea) - getInf(eb);
    });
  }, [deck, isStacked, entries, supertypes]);

  // Cards remaining in the deck list after the top N are moved to the viewed area.
  const displayDeck = (isStacked && viewTopCount) ? deck.slice(viewTopCount) : sortedDeck;

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-2 border-b border-border flex-shrink-0">
        {isStacked ? (
          <Button size="sm" variant="outline" onClick={onShuffleDeck} className="text-xs h-7 flex-1">
            <Shuffle size={12} className="mr-1" /> Shuffle
          </Button>
        ) : (
          <Button size="sm" variant="default" onClick={onStackDeck} className="text-xs h-7 flex-1">
            <Layers size={12} className="mr-1" /> Stack
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onViewDeck} disabled={!isStacked} className="text-xs h-7 flex-1">
          <Eye size={12} className="mr-1" /> {allFaceUp ? 'Hide' : 'View'}
        </Button>
        <Button size="sm" variant="outline" onClick={handleViewTopClick} disabled={!isStacked} className="text-xs h-7 flex-1">
          <Eye size={12} className="mr-1" /> View Top
        </Button>
      </div>
      {showViewTopInput && (
        <form onSubmit={handleViewTopSubmit} className="p-2 border-b border-border flex-shrink-0 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Top</span>
          <input type="number" min="1" value={viewTopInput} onChange={(e) => setViewTopInput(e.target.value)} autoFocus className="w-16 bg-input text-foreground rounded px-2 py-1 text-xs border border-border" />
          <Button type="submit" size="sm" className="text-xs h-7">Go</Button>
          <button type="button" onClick={() => setShowViewTopInput(false)} className="text-muted-foreground hover:text-foreground ml-auto"><X size={14} /></button>
        </form>
      )}
      {viewTopCount !== null && isStacked && (
        <div className="border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between px-2 pt-2">
            <span className="text-xs font-semibold text-foreground">Top {viewTopCount}</span>
            <button onClick={() => setViewTopCount(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>
          <div className="flex flex-wrap gap-1 px-2 pb-2 pt-1">
            {topCards.length === 0 ? (
              <p className="text-xs text-muted-foreground">Deck is empty</p>
            ) : topCards.map((item, i) => {
              const entryId = typeof item === 'object' ? item.entry_id : item;
              const card = typeof item === 'object' ? item : null;
              return (
                <DeckCardSlot key={card?.id || i} card={card} entryId={entryId} entries={entries} supertypes={supertypes} playerIndex={playerIndex} onDrop={onDrop} makeDragStart={makeDragStart} forceFaceUp />
              );
            })}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 flex flex-wrap gap-1 content-start"
        data-section={`deck:${playerIndex}`}
        {...deckDrop}>
        {displayDeck.length === 0 ? (
          <p className="text-sm text-muted-foreground m-auto">Deck is empty</p>
        ) : (
          displayDeck.map((item, i) => {
            const entryId = typeof item === 'object' ? item.entry_id : item;
            const card = typeof item === 'object' ? item : null;
            return (
              <DeckCardSlot key={card?.id || i} card={card} entryId={entryId} entries={entries} supertypes={supertypes} playerIndex={playerIndex} onDrop={onDrop} makeDragStart={makeDragStart} />
            );
          })
        )}
      </div>
    </div>
  );
}