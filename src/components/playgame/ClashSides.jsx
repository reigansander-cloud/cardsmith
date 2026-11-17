import React from 'react';
import CardObject from './CardObject';
import { useShrinkToFitArea } from './useShrinkToFitArea';
import { useDropZone } from '@/context/PointerDragContext';
import { extraSpaceUnits } from './cardFootprint';
import { Check } from 'lucide-react';

function ClashSide({ cards, bf, playerIndex, playerName, selectedCardId, groupIds, entries, supertypes, onDrop, makeDragStart, onSelect, onCardDrop, onHoverEnter, onHoverLeave, onDoubleClick, computeSideTotal }) {
  const { ref: cardsRef, cardWidth, wraps } = useShrinkToFitArea(cards.length, { minWidth: 50, maxWidth: 180, gap: 4, aspectRatio: 1.4, extraUnits: extraSpaceUnits(cards, entries) });
  const total = computeSideTotal ? computeSideTotal(cards, bf, playerIndex) : null;
  const dropProps = useDropZone((payload) => onDrop(payload, { zone: 'battlefield', battlefield_id: bf?.id, player_index: playerIndex }));

  return (
    <div ref={cardsRef} className={`flex-1 border border-border rounded-lg p-2 min-h-0 ${wraps ? 'overflow-y-auto' : 'overflow-hidden'} relative`} data-section={`battlefield:${playerIndex}:${bf?.id || ''}`} {...dropProps}>
      {total && (
        <div className={`absolute top-1 right-2 text-4xl font-black pointer-events-none z-20 drop-shadow-lg ${total.hasX ? 'text-red-500' : 'text-foreground'}`}>
          {total.hasX ? '?' : total.total}
        </div>
      )}
      {playerIndex !== undefined && playerName && (
        <div className="absolute bottom-1 right-2 w-8 h-8 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-xs font-bold text-primary pointer-events-none z-10">
          {playerName[0]?.toUpperCase() || '?'}
        </div>
      )}
      <div className={`flex gap-1 flex-wrap min-h-full ${wraps ? 'items-start' : 'items-center'}`}>
        {cards.map((card) => (
          <CardObject key={card.id} card={card} entry={entries[card.entry_id]} entries={entries} supertypes={supertypes} targetWidth={cardWidth} selectedCardId={selectedCardId} groupIds={groupIds}
            location={{ zone: 'battlefield', player_index: playerIndex, battlefield_id: bf.id }}
            onPointerDown={makeDragStart(card, 'battlefield', playerIndex, bf.id)} onSelect={onSelect} onCardDrop={onCardDrop} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={onDoubleClick ? () => onDoubleClick(card.id) : undefined} />
        ))}
      </div>
    </div>
  );
}

// The Ready button fills a participant's clash area while a clash is being
// staged. Pressing it locks in your own selection; it reflects your ready
// state and whether every opponent actually fighting has readied up.
function ReadyPanel({ myReady, oppReady, mySelectionCount, onDeclareReady }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 min-h-0">
      <button
        onClick={myReady ? undefined : onDeclareReady}
        disabled={myReady}
        className={`w-full max-w-sm flex-1 min-h-[80px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-colors ${myReady ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 cursor-default' : 'border-primary bg-primary/10 hover:bg-primary/20 text-primary cursor-pointer'}`}
      >
        {myReady ? <Check size={32} /> : null}
        <span className="text-2xl font-black tracking-wide">{myReady ? 'Ready' : 'Ready Up'}</span>
        <span className="text-xs font-medium opacity-80">{myReady ? 'Locked in — waiting for opponent' : `${mySelectionCount} card${mySelectionCount === 1 ? '' : 's'} staged`}</span>
      </button>
      <div className="text-xs text-muted-foreground">
        {oppReady ? 'Opponent is ready' : 'Opponent is selecting…'}
      </div>
    </div>
  );
}

function SpectatingBox({ label = 'Spectating' }) {
  return (
    <div className="flex-1 min-h-[40px] rounded-lg border border-border/20 flex items-center justify-center">
      <p className="text-xs text-muted-foreground/30">{label}</p>
    </div>
  );
}

// Renders the focused battlefield. While a clash is being staged, ONLY the
// players actually fighting on this battlefield (participants) get the Ready
// flow — everyone else (e.g. a third player in a 3-player game who isn't
// part of this fight) just sees a spectating placeholder and is never
// blocked on. Once every participant is ready, the staged cards land on the
// battlefield and normal side rendering resumes.
const ClashSides = React.memo(function ClashSides({ activeBf, participants, myPlayerIndex, playerNames, selectedCardId, groupIds, entries, supertypes, onDrop, makeDragStart, onSelect, onCardDrop, onHoverEnter, onHoverLeave, computeSideTotal, onDoubleClick, onAreaMouseDown, onAreaMouseMove, onAreaMouseUp, onAreaMouseLeave, clashInProgress, myReady, readyMap, mySelectionCount, onDeclareReady }) {
  const iAmParticipant = participants.includes(myPlayerIndex);
  const oppParticipants = participants.filter((p) => p !== myPlayerIndex);
  const staging = clashInProgress && !!activeBf;
  return (
    <div className="flex-1 flex flex-col gap-1 p-2 overflow-hidden min-h-0 relative" onContextMenu={(e) => e.preventDefault()} onMouseDown={onAreaMouseDown} onMouseMove={onAreaMouseMove} onMouseUp={onAreaMouseUp} onMouseLeave={onAreaMouseLeave}>
      {activeBf ? (
        <>
          <div className="flex flex-col gap-1 flex-1 min-h-0">
            {staging ? (
              iAmParticipant ? (
                <ReadyPanel myReady={myReady} oppReady={oppParticipants.every((p) => readyMap?.[p])} mySelectionCount={mySelectionCount} onDeclareReady={onDeclareReady} />
              ) : (
                <SpectatingBox label="Clash in progress" />
              )
            ) : (
              oppParticipants.map((p) => (
                <ClashSide key={p} cards={activeBf.sides?.[p] || []} bf={activeBf} playerIndex={p} playerName={playerNames?.[p]} selectedCardId={selectedCardId} groupIds={groupIds} entries={entries} supertypes={supertypes} onDrop={onDrop} makeDragStart={makeDragStart} onSelect={onSelect} onCardDrop={onCardDrop} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} computeSideTotal={computeSideTotal} onDoubleClick={onDoubleClick} />
              ))
            )}
          </div>
          {staging ? (
            iAmParticipant ? (
              <div className="flex-1 min-h-[60px] rounded-lg border-2 border-dashed border-emerald-500/40 flex flex-col items-center justify-center gap-1 bg-emerald-500/5">
                <span className="text-sm font-semibold text-emerald-400">{mySelectionCount > 0 ? `${mySelectionCount} card${mySelectionCount === 1 ? '' : 's'} staged` : 'Select your cards'}</span>
                <span className="text-[11px] text-muted-foreground">Click your cards anywhere to stage them for the clash</span>
              </div>
            ) : (
              <SpectatingBox />
            )
          ) : iAmParticipant ? (
            <ClashSide cards={activeBf.sides?.[myPlayerIndex] || []} bf={activeBf} playerIndex={myPlayerIndex} playerName={playerNames?.[myPlayerIndex]} selectedCardId={selectedCardId} groupIds={groupIds} entries={entries} supertypes={supertypes} onDrop={onDrop} makeDragStart={makeDragStart} onSelect={onSelect} onCardDrop={onCardDrop} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} computeSideTotal={computeSideTotal} onDoubleClick={onDoubleClick} />
          ) : (
            <SpectatingBox />
          )}
        </>
      ) : (
        <>
          <div className="flex-1 min-h-[40px] rounded-lg border border-border/20 flex items-center justify-center"><p className="text-xs text-muted-foreground/30">Select a battlefield</p></div>
          <div className="flex-1 min-h-[40px] rounded-lg border border-border/20" />
        </>
      )}
    </div>
  );
});

export default ClashSides;