import React from 'react';
import CardObject from './CardObject';
import { useShrinkToFit } from './useShrinkToFit';
import { useDropZone } from '@/context/PointerDragContext';
import { extraSpaceUnits } from './cardFootprint';

// A rearguard row — fixed height, cards shrink to fit the width, wrap to
// multiple rows (with vertical scroll) when there are too many. A one-card-wide
// Moments slot sits on the right side. When newZoneEnabled is true, an extra
// unlabeled drop zone is inserted between rearguard and Moments at ~1/3 the
// rearguard's width.
export default function RearguardSection({ cards, sideCards = [], newZoneEnabled, newZoneCards = [], entries, supertypes, playerIndex, borderClass, selectedCardId, groupIds, onDrop, makeDragStart, onSelect, onCardDrop, onHoverEnter, onHoverLeave, onDoubleClick, onAreaMouseDown, onAreaMouseMove, onAreaMouseUp, onAreaMouseLeave, compact = false, hideMomentsWhenEmpty = false }) {
  const { ref, cardWidth, wraps } = useShrinkToFit(cards.length, { minWidth: 50, maxWidth: 80, gap: 4, extraUnits: extraSpaceUnits(cards, entries) });
  const { ref: nzRef, cardWidth: nzCardWidth, wraps: nzWraps } = useShrinkToFit(newZoneCards.length, { minWidth: 60, maxWidth: 80, gap: 4, extraUnits: extraSpaceUnits(newZoneCards, entries) });
  const rearguardDrop = useDropZone((payload) => onDrop(payload, { zone: 'rearguard', player_index: playerIndex }));
  const newZoneDrop = useDropZone((payload) => onDrop(payload, { zone: 'new_zone', player_index: playerIndex }));
  const sideCardsDrop = useDropZone((payload) => onDrop(payload, { zone: 'side_cards', player_index: playerIndex }));

  return (
    <div className={`flex ${borderClass} flex-shrink-0 ${compact ? 'h-[80px]' : 'h-[120px]'}`}>
      <div ref={ref} className={`flex flex-wrap gap-1 px-4 py-1 ${wraps ? 'overflow-y-auto items-start' : 'overflow-hidden items-center'} relative`}
        style={{ flexGrow: 1, flexBasis: 0, minWidth: 0 }}
        data-section={`rearguard:${playerIndex}`}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={onAreaMouseDown} onMouseMove={onAreaMouseMove} onMouseUp={onAreaMouseUp} onMouseLeave={onAreaMouseLeave}
        {...rearguardDrop}>
        {cards.map((card) => (
          <CardObject key={card.id} card={card} entry={entries[card.entry_id]} entries={entries} supertypes={supertypes}
            targetWidth={cardWidth}
            selectedCardId={selectedCardId} groupIds={groupIds}
            location={{ zone: 'rearguard', player_index: playerIndex }}
            onPointerDown={makeDragStart(card, 'rearguard', playerIndex)} onSelect={onSelect} onCardDrop={onCardDrop}
            onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={() => onDoubleClick(card.id)} />
        ))}
      </div>
      {newZoneEnabled && (
        <div ref={nzRef} className={`flex flex-wrap gap-1 px-2 py-1 ${nzWraps ? 'overflow-y-auto items-start' : 'overflow-hidden items-center'} border-l border-border/50 relative`}
          style={{ flexGrow: 0.33, flexBasis: 0, minWidth: 0 }}
          data-section={`new_zone:${playerIndex}`}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={onAreaMouseDown} onMouseMove={onAreaMouseMove} onMouseUp={onAreaMouseUp} onMouseLeave={onAreaMouseLeave}
          {...newZoneDrop}>
          {newZoneCards.map((card) => (
            <CardObject key={card.id} card={card} entry={entries[card.entry_id]} entries={entries} supertypes={supertypes}
              targetWidth={nzCardWidth}
              selectedCardId={selectedCardId} groupIds={groupIds}
              location={{ zone: 'new_zone', player_index: playerIndex }}
              onPointerDown={makeDragStart(card, 'new_zone', playerIndex)} onSelect={onSelect} onCardDrop={onCardDrop}
              onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={() => onDoubleClick(card.id)} />
          ))}
        </div>
      )}
      {/* Moments — one card space on the right; hidden when empty in compact
          (3-player) mode to save vertical space. */}
      {(!hideMomentsWhenEmpty || sideCards.length > 0) && (
      <div className="flex-shrink-0 flex flex-col items-center gap-1 px-1 py-1 overflow-y-auto border-l border-border/50"
        data-section={`side_cards:${playerIndex}`}
        style={{ width: 108 }}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={onAreaMouseDown} onMouseMove={onAreaMouseMove} onMouseUp={onAreaMouseUp} onMouseLeave={onAreaMouseLeave}
        {...sideCardsDrop}>
        {sideCards.length === 0 ? (
          <p className="text-[9px] text-muted-foreground/40 m-auto">Moments</p>
        ) : (
          sideCards.map((card) => (
            <CardObject key={card.id} card={card} entry={entries[card.entry_id]} entries={entries} supertypes={supertypes}
              targetWidth={80} selectedCardId={selectedCardId} groupIds={groupIds}
              location={{ zone: 'side_cards', player_index: playerIndex }}
              onPointerDown={makeDragStart(card, 'side_cards', playerIndex)} onSelect={onSelect} onCardDrop={onCardDrop}
              onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={onDoubleClick ? () => onDoubleClick(card.id) : undefined} />
          ))
        )}
      </div>
      )}
    </div>
  );
}