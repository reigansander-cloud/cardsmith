import React from 'react';
import MiniEntry from '../MiniEntry';
import CardObject from '../CardObject';
import { Button } from '@/components/ui/button';
import { Swords, Trash2 } from 'lucide-react';
import { useShrinkToFit } from '../useShrinkToFit';
import { extraSpaceUnits } from '../cardFootprint';
import { useDropZone } from '@/context/PointerDragContext';

function BfSide({ cards, bf, playerIndex, playerName, selectedCardId, groupIds, entries, supertypes, onDrop, makeDragStart, onSelect, onCardDrop, onHoverEnter, onHoverLeave, onDoubleClick, computeSideTotal }) {
  const { ref: cardsRef, cardWidth, wraps } = useShrinkToFit(cards.length, { minWidth: 50, maxWidth: 100, gap: 4, extraUnits: extraSpaceUnits(cards, entries) });
  const total = computeSideTotal ? computeSideTotal(cards, bf, playerIndex) : null;
  const dropProps = useDropZone((payload) => onDrop(payload, { zone: 'battlefield', battlefield_id: bf?.id, player_index: playerIndex }));
  return (
    <div className={`border border-border rounded-lg p-1.5 ${cards.length > 0 ? 'min-h-[171px]' : 'min-h-[105px]'} relative`}
      data-section={`battlefield:${playerIndex}:${bf?.id || ''}`}
      {...dropProps}>
      {total && (
        <div className={`absolute top-0.5 right-1 text-lg font-black pointer-events-none z-20 ${total.hasX ? 'text-red-500' : 'text-foreground'}`}>
          {total.hasX ? '?' : total.total}
        </div>
      )}
      {playerName && (
        <div className="absolute bottom-0.5 right-1 w-5 h-5 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-[9px] font-bold text-primary pointer-events-none z-10">
          {playerName[0]?.toUpperCase() || '?'}
        </div>
      )}
      <div ref={cardsRef} className={`flex gap-1 flex-wrap px-1 py-0.5 overflow-y-auto ${wraps ? 'items-start' : 'items-center'} min-h-[171px] max-h-[819px]`}>
        {cards.length === 0 ? (
          <p className="text-xs text-muted-foreground/30 m-auto">No cards</p>
        ) : cards.map((card) => (
          <CardObject key={card.id} card={card} entry={entries[card.entry_id]} entries={entries} supertypes={supertypes} targetWidth={cardWidth} selectedCardId={selectedCardId} groupIds={groupIds}
            location={{ zone: 'battlefield', player_index: playerIndex, battlefield_id: bf.id }}
            onPointerDown={makeDragStart(card, 'battlefield', playerIndex, bf.id)} onCardDrop={onCardDrop} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={onDoubleClick ? () => onDoubleClick(card.id) : undefined} />
        ))}
      </div>
    </div>
  );
}

// Sidebar battlefield view. The Clash button focuses the battlefield. Advantage
// dials sit in a vertical column to the LEFT of a smaller battlefield preview
// (opponent on top, yours on the bottom), freeing vertical space for the card
// zones below to render larger/taller.
function AdvDial({ label, value, onDec, onInc }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <button onClick={onDec} className="w-6 h-6 rounded bg-destructive/10 text-destructive text-sm font-bold">−</button>
        <span className="font-bold w-7 text-center text-red-500">{value}</span>
        <button onClick={onInc} className="w-6 h-6 rounded bg-primary/10 text-primary text-sm font-bold">+</button>
      </div>
    </div>
  );
}

export default function SidebarBattlefield({ battlefield, isActive, clashInProgress, entries, supertypes, myPlayerIndex, oppName, myName, selectedCardId, groupIds, wideViewOn, onDeclareClash, onEndClash, onAdvantageChange, onDestroyBf, onDrop, makeDragStart, onCardClick, onCardDrop, onHoverEnter, onHoverLeave, onDoubleClick, computeSideTotal }) {
  const oppIndex = myPlayerIndex === 0 ? 1 : 0;
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex gap-2">
        <Button onClick={() => onDeclareClash(battlefield.id)} size="sm" disabled={clashInProgress} className="text-sm h-9 flex-1">{clashInProgress ? 'Clashing…' : 'Clash'}</Button>
        <Button onClick={() => onEndClash(battlefield.id)} disabled={!isActive || clashInProgress} size="sm" variant="destructive" className="text-sm h-9 flex-1">
          <Swords size={16} className="mr-1" /> End Clash
        </Button>
        <Button onClick={() => onDestroyBf(battlefield.id)} size="sm" variant="outline" className="text-sm h-9">
          <Trash2 size={16} />
        </Button>
      </div>
      {/* Advantage dials (left, vertical) + smaller battlefield preview (right) */}
      <div className="flex gap-2 items-center justify-center">
        <div className="flex flex-col gap-2 flex-shrink-0">
          <AdvDial label="Opp Adv" value={battlefield.advantage?.[oppIndex] || 0} onDec={() => onAdvantageChange(battlefield.id, oppIndex, -1)} onInc={() => onAdvantageChange(battlefield.id, oppIndex, 1)} />
          <AdvDial label="Your Adv" value={battlefield.advantage?.[myPlayerIndex] || 0} onDec={() => onAdvantageChange(battlefield.id, myPlayerIndex, -1)} onInc={() => onAdvantageChange(battlefield.id, myPlayerIndex, 1)} />
        </div>
        <div className="flex justify-center">
          {battlefield.type === 'card' && entries[battlefield.card_entry_id] ? (
            <MiniEntry entry={entries[battlefield.card_entry_id]} supertypes={supertypes} targetWidth={225} />
          ) : (
            <div className="flex items-center justify-center rounded-lg border-2 border-border bg-card" style={{ width: 225, height: 158 }}>
              <span className="text-4xl font-bold">{battlefield.number_value}</span>
            </div>
          )}
        </div>
      </div>
      {!wideViewOn && (
        <>
          <BfSide cards={battlefield.sides?.[oppIndex] || []} bf={battlefield} playerIndex={oppIndex} playerName={oppName} selectedCardId={selectedCardId} groupIds={groupIds} entries={entries} supertypes={supertypes} onDrop={onDrop} makeDragStart={makeDragStart} onSelect={onCardClick} onCardDrop={onCardDrop} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={onDoubleClick} computeSideTotal={computeSideTotal} />
          <BfSide cards={battlefield.sides?.[myPlayerIndex] || []} bf={battlefield} playerIndex={myPlayerIndex} playerName={myName} selectedCardId={selectedCardId} groupIds={groupIds} entries={entries} supertypes={supertypes} onDrop={onDrop} makeDragStart={makeDragStart} onSelect={onCardClick} onCardDrop={onCardDrop} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={onDoubleClick} computeSideTotal={computeSideTotal} />
        </>
      )}
    </div>
  );
}