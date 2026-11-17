import React, { useRef, useEffect, useState } from 'react';
import MiniEntry from './MiniEntry';
import CardObject from './CardObject';
import { useDropZone } from '@/context/PointerDragContext';
import { useZoomHover } from './ZoomHoverPopup';
import { Check } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// A single player's card zone within a battlefield in the wide view.
// Cards are fully draggable/droppable — same handlers as the normal view.
function WideBfZone({ cards, bf, playerIndex, playerName, entries, supertypes, onDrop, makeDragStart, onSelect, onCardDrop, onHoverEnter, onHoverLeave, onDoubleClick, selectedCardId, groupIds, computeSideTotal, inFocus }) {
  const dropProps = useDropZone((payload) => onDrop(payload, { zone: 'battlefield', battlefield_id: bf?.id, player_index: playerIndex }));
  const total = computeSideTotal ? computeSideTotal(cards, bf, playerIndex, inFocus) : null;
  return (
    <div className="flex-1 min-h-0 min-w-0 border border-white/60 rounded-md p-0.5 relative overflow-y-auto [scrollbar-gutter:stable]"
      data-section={`battlefield:${playerIndex}:${bf?.id || ''}`} {...dropProps}>
      {total && (
        <div className={`absolute top-0 right-0.5 text-xs font-black pointer-events-none z-20 leading-none ${total.hasX ? 'text-red-500' : 'text-foreground'}`}>
          {total.hasX ? '?' : total.total}
        </div>
      )}
      <div className="flex gap-0.5 flex-wrap items-start min-h-full">
        {cards.length === 0 ? (
          <p className="text-[8px] text-muted-foreground/20 m-auto">—</p>
        ) : cards.map((card) => (
          <CardObject key={card.id} card={card} entry={entries[card.entry_id]} entries={entries} supertypes={supertypes} targetWidth={42}
            selectedCardId={selectedCardId} groupIds={groupIds}
            location={{ zone: 'battlefield', player_index: playerIndex, battlefield_id: bf.id }}
            onPointerDown={makeDragStart(card, 'battlefield', playerIndex, bf.id)} onSelect={onSelect} onCardDrop={onCardDrop}
            onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={onDoubleClick ? () => onDoubleClick(card.id) : undefined} />
        ))}
      </div>
      {playerName && (
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-primary/30 border border-primary text-[7px] flex items-center justify-center text-primary pointer-events-none">{playerName[0]?.toUpperCase()}</div>
      )}
    </div>
  );
}

// The battlefield card/icon, centered above the zones. Clicking focuses it in the sidebar.
function WideBfCard({ bf, entries, supertypes, onClick }) {
  const { hoverEnter, hoverLeave } = useZoomHover();
  const bfEntry = bf.type === 'card' ? entries[bf.card_entry_id] : null;
  return (
    <div className="flex justify-center flex-shrink-0 cursor-pointer"
      data-bf-id={bf.id}
      onClick={onClick}
      onMouseEnter={() => hoverEnter(bfEntry ? { type: 'battlefield', entry: bfEntry, supertypes } : { type: 'battlefield-number', numberValue: bf.number_value })}
      onMouseLeave={hoverLeave}>
      {bf.type === 'card' && entries[bf.card_entry_id] ? (
        <MiniEntry entry={entries[bf.card_entry_id]} supertypes={supertypes} targetWidth={55} />
      ) : (
        <div className="flex items-center justify-center rounded-lg border-2 border-border bg-card" style={{ width: 55, height: 38 }}>
          <span className="text-base font-bold">{bf.number_value}</span>
        </div>
      )}
    </div>
  );
}

// Compact Ready Up panel — shown over the clashing battlefield's opponent zone
// for participants while a clash is staging.
function ReadyPanel({ myReady, oppReady, mySelectionCount, onDeclareReady }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1 p-1 min-h-0 rounded-md">
      <button
        onClick={myReady ? undefined : onDeclareReady}
        disabled={myReady}
        className={`w-full flex-1 min-h-[40px] rounded-md border-2 flex flex-col items-center justify-center gap-0.5 transition-colors ${myReady ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 cursor-default' : 'border-primary bg-primary/10 hover:bg-primary/20 text-primary cursor-pointer'}`}
      >
        {myReady ? <Check size={18} /> : null}
        <span className="text-xs font-black tracking-wide">{myReady ? 'Ready' : 'Ready Up'}</span>
        <span className="text-[8px] font-medium opacity-80">{myReady ? 'Waiting' : `${mySelectionCount} staged`}</span>
      </button>
      <div className="text-[8px] text-muted-foreground">{oppReady ? 'Opp ready' : 'Opp selecting…'}</div>
    </div>
  );
}

// Compact staging indicator — shown over the clashing battlefield's own zone
// for participants while a clash is staging.
function StagingIndicator({ mySelectionCount }) {
  return (
    <div className="flex-1 min-h-0 rounded-md border-2 border-dashed border-emerald-500/40 flex flex-col items-center justify-center gap-0.5 bg-emerald-500/5 p-1">
      <span className="text-[10px] font-semibold text-emerald-400">{mySelectionCount > 0 ? `${mySelectionCount} staged` : 'Select cards'}</span>
      <span className="text-[7px] text-muted-foreground text-center leading-tight">Click your cards to stage</span>
    </div>
  );
}

function SpectatingBox({ label = 'Spectating' }) {
  return (
    <div className="flex-1 min-h-[30px] rounded-md border border-border/20 flex items-center justify-center">
      <p className="text-[8px] text-muted-foreground/30">{label}</p>
    </div>
  );
}

// Unified battlefield: card centered on top, zones side-by-side below for wider rows.
// When a clash is staging on this battlefield, the staging UI (Ready Up / staging
// indicator) replaces the zones for participants; non-participants see a spectating box.
function WideBf({ bf, entries, supertypes, myPlayerIndex, oppIndices, playerNames, active, dimmed, onClick, onDrop, makeDragStart, onSelect, onCardDrop, onHoverEnter, onHoverLeave, onDoubleClick, selectedCardId, groupIds, staging, iAmParticipant, myReady, oppReady, mySelectionCount, onDeclareReady, computeSideTotal }) {
  return (
    <div className={`flex flex-col gap-1 flex-1 min-w-0 min-h-0 rounded-lg p-1 transition-all duration-200 ${active ? 'ring-2 ring-primary bg-primary/10 shadow-[0_0_12px_-2px_hsl(var(--primary))]' : ''} ${dimmed ? 'opacity-40' : ''}`}>
      <WideBfCard bf={bf} entries={entries} supertypes={supertypes} onClick={onClick} />
      <div className="flex flex-col gap-1 flex-1 min-h-0">
        {oppIndices.map((oi) => (
          staging ? (
            iAmParticipant ? <ReadyPanel key={oi} myReady={myReady} oppReady={oppReady} mySelectionCount={mySelectionCount} onDeclareReady={onDeclareReady} /> : <SpectatingBox key={oi} label="Clash in progress" />
          ) : (
            <WideBfZone key={oi} cards={bf.sides?.[oi] || []} bf={bf} playerIndex={oi} playerName={playerNames[oi]} entries={entries} supertypes={supertypes} onDrop={onDrop} makeDragStart={makeDragStart} onSelect={onSelect} onCardDrop={onCardDrop} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={onDoubleClick} selectedCardId={selectedCardId} groupIds={groupIds} computeSideTotal={computeSideTotal} inFocus={active} />
          )
        ))}
        {staging ? (
          iAmParticipant ? <StagingIndicator mySelectionCount={mySelectionCount} /> : <SpectatingBox />
        ) : (
          <WideBfZone cards={bf.sides?.[myPlayerIndex] || []} bf={bf} playerIndex={myPlayerIndex} playerName={playerNames[myPlayerIndex]} entries={entries} supertypes={supertypes} onDrop={onDrop} makeDragStart={makeDragStart} onSelect={onSelect} onCardDrop={onCardDrop} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={onDoubleClick} selectedCardId={selectedCardId} groupIds={groupIds} computeSideTotal={computeSideTotal} inFocus={active} />
        )}
      </div>
    </div>
  );
}

// Zoomed-out bird's-eye view of all 5 battlefields with their card zones.
// Local-only — the opponent sees this only if they toggle it on themselves.
// Layout: 3 columns — left (opponent BF top, your BF bottom), center (neutral),
// right (opponent BF top, your BF bottom). Each battlefield card sits centered
// above its two zones for wider rows. No dimming unless a battlefield is in focus.
//
// Scroll wheel zooms the whole view in/out (even while a hover popup is open);
// when zoomed in, click-drag pans around. The wheel handler stops propagation
// so the hover-popup's scale-on-scroll doesn't fire while the wide view is active.
export default function WideView({ battlefields, focusedBfId, entries, supertypes, myPlayerIndex, opponentIndices, playerNames, onBfClick, onDrop, makeDragStart, onSelect, onCardDrop, onHoverEnter, onHoverLeave, onDoubleClick, selectedCardId, groupIds, onAreaMouseDown, onAreaMouseMove, onAreaMouseUp, onAreaMouseLeave, clashBfId, clashStaging, participants, myReady, readyMap, mySelectionCount, onDeclareReady, computeSideTotal }) {
  const containerRef = useRef(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const panRef = useRef(null);

  const oppBfs = battlefields.filter((b) => opponentIndices.includes(b.owner));
  const neutralBf = battlefields.find((b) => b.owner === -1 || b.owner === undefined);
  const myBfs = battlefields.filter((b) => b.owner === myPlayerIndex);
  const leftOpp = oppBfs[0], rightOpp = oppBfs[1];
  const leftMine = myBfs[0], rightMine = myBfs[1];
  const hasFocus = !!focusedBfId;

  // Native non-passive wheel listener on the wide view container: zooms the
  // view toward the cursor and stops propagation so the hover-popup scale-on-
  // scroll (a window-level listener) never fires while wide view is active.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const { scale, tx, ty } = viewRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      let ns = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
      let ntx = 0, nty = 0;
      if (ns > 1) {
        ntx = cx - (cx - tx) * (ns / scale);
        nty = cy - (cy - ty) * (ns / scale);
        const minTx = Math.min(0, rect.width - rect.width * ns);
        const minTy = Math.min(0, rect.height - rect.height * ns);
        ntx = clamp(ntx, minTx, 0);
        nty = clamp(nty, minTy, 0);
      }
      setView({ scale: ns, tx: ntx, ty: nty });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = (e) => {
    if (viewRef.current.scale > 1 && e.button === 1) {
      panRef.current = { mx: e.clientX, my: e.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty };
      e.preventDefault();
      return;
    }
    onAreaMouseDown(e);
  };
  const handleMouseMove = (e) => {
    if (panRef.current) {
      const el = containerRef.current;
      const rect = el.getBoundingClientRect();
      const ns = viewRef.current.scale;
      const minTx = Math.min(0, rect.width - rect.width * ns);
      const minTy = Math.min(0, rect.height - rect.height * ns);
      const ntx = clamp(panRef.current.tx + (e.clientX - panRef.current.mx), minTx, 0);
      const nty = clamp(panRef.current.ty + (e.clientY - panRef.current.my), minTy, 0);
      setView((v) => ({ ...v, tx: ntx, ty: nty }));
      return;
    }
    onAreaMouseMove(e);
  };
  const handleMouseUp = (e) => {
    if (panRef.current) { panRef.current = null; return; }
    onAreaMouseUp(e);
  };
  const handleMouseLeave = (e) => {
    if (panRef.current) { panRef.current = null; return; }
    onAreaMouseLeave(e);
  };

  const renderBf = (bf) => {
    if (!bf) return null;
    const staging = clashStaging && clashBfId === bf.id;
    const iAmParticipant = participants.includes(myPlayerIndex);
    const oppParticipants = participants.filter((p) => p !== myPlayerIndex);
    const oppReady = oppParticipants.every((p) => readyMap?.[p]);
    return (
      <WideBf bf={bf} entries={entries} supertypes={supertypes} myPlayerIndex={myPlayerIndex} oppIndices={opponentIndices} playerNames={playerNames}
        active={bf.id === focusedBfId} dimmed={hasFocus && bf.id !== focusedBfId}
        onClick={() => onBfClick(bf.id)} onDrop={onDrop} makeDragStart={makeDragStart} onSelect={onSelect} onCardDrop={onCardDrop}
        onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={onDoubleClick} selectedCardId={selectedCardId} groupIds={groupIds}
        staging={staging} iAmParticipant={iAmParticipant} myReady={myReady} oppReady={oppReady} mySelectionCount={mySelectionCount} onDeclareReady={onDeclareReady} computeSideTotal={computeSideTotal} />
    );
  };

  const zoomed = view.scale > 1;
  return (
    <div ref={containerRef} className="flex-1 overflow-hidden min-h-0 relative"
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}
      style={{ cursor: zoomed ? (panRef.current ? 'grabbing' : 'grab') : 'default' }}>
      <div className="flex gap-1 p-2 w-full h-full" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`, transformOrigin: '0 0' }}>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {renderBf(leftOpp)}
          {renderBf(leftMine)}
        </div>
        {neutralBf && (
          <div className="flex flex-col flex-1 min-w-0">
            {renderBf(neutralBf)}
          </div>
        )}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {renderBf(rightOpp)}
          {renderBf(rightMine)}
        </div>
      </div>
    </div>
  );
}