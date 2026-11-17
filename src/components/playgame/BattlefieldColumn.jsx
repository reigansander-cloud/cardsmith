import React from 'react';
import MiniEntry from './MiniEntry';
import { useShrinkToFitVertical } from './useShrinkToFitVertical';
import { useZoomHover } from './ZoomHoverPopup';
import { useDropZone } from '@/context/PointerDragContext';

function BfSquare({ bf, entries, supertypes, myPlayerIndex, targetWidth, active, dimmed, onClick, onDrop }) {
  const { hoverEnter, hoverLeave } = useZoomHover();
  const dropProps = useDropZone((payload) => onDrop(payload, { zone: 'battlefield', battlefield_id: bf.id }));
  const bfEntry = bf.type === 'card' ? entries[bf.card_entry_id] : null;
  const oppCount = (bf.sides || []).reduce((sum, side, i) => (i !== myPlayerIndex ? sum + (side || []).length : sum), 0);
  const myCount = (bf.sides?.[myPlayerIndex] || []).length;
  const oppAdv = (bf.advantage || []).reduce((sum, adv, i) => (i !== myPlayerIndex ? sum + (adv || 0) : sum), 0);
  const myAdv = bf.advantage?.[myPlayerIndex] || 0;
  return (
    <div className={`relative cursor-pointer flex-shrink-0 transition-opacity ${dimmed ? 'opacity-30' : ''} ${active ? 'ring-2 ring-primary rounded-lg' : ''}`}
      data-bf-id={bf.id}
      onClick={onClick}
      onMouseEnter={() => hoverEnter(bfEntry ? { type: 'battlefield', entry: bfEntry, supertypes } : { type: 'battlefield-number', numberValue: bf.number_value })}
      onMouseLeave={hoverLeave}
      {...dropProps}>
      {bf.type === 'card' && entries[bf.card_entry_id] ? <MiniEntry entry={entries[bf.card_entry_id]} supertypes={supertypes} targetWidth={targetWidth} /> : (
        <div className="flex items-center justify-center rounded-lg border-2 border-border bg-card" style={{ width: targetWidth, height: targetWidth * 0.7 }}><span className="text-xl font-bold">{bf.number_value}</span></div>
      )}
      {oppCount > 0 && <div className="absolute top-1 left-0.5 bg-primary text-primary-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{oppCount}</div>}
      {myCount > 0 && <div className="absolute bottom-1 left-0.5 bg-primary text-primary-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{myCount}</div>}
      {oppAdv > 0 && <div className="absolute top-1 right-0.5 bg-red-600 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{oppAdv}</div>}
      {myAdv > 0 && <div className="absolute bottom-1 right-0.5 bg-red-600 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{myAdv}</div>}
    </div>
  );
}

const BattlefieldColumn = React.memo(function BattlefieldColumn({ battlefields, entries, supertypes, myPlayerIndex, activeBfId, onBfClick, onDrop, onAreaMouseDown, onAreaMouseMove, onAreaMouseUp, onAreaMouseLeave }) {
  const { ref: bfColRef, cardWidth: bfWidth } = useShrinkToFitVertical(battlefields.length, { minWidth: 50, maxWidth: 110, gap: 4, aspectRatio: 0.7 });
  return (
    <div ref={bfColRef} className="flex flex-col gap-1 p-2 flex-shrink-0 overflow-hidden" onContextMenu={(e) => e.preventDefault()} onMouseDown={onAreaMouseDown} onMouseMove={onAreaMouseMove} onMouseUp={onAreaMouseUp} onMouseLeave={onAreaMouseLeave}>
      {battlefields.map((bf) => (
        <BfSquare key={bf.id} bf={bf} entries={entries} supertypes={supertypes} myPlayerIndex={myPlayerIndex}
          targetWidth={bfWidth}
          active={bf.id === activeBfId} dimmed={!!activeBfId && bf.id !== activeBfId}
          onClick={() => onBfClick(bf.id)}
          onDrop={onDrop} />
      ))}
    </div>
  );
});

export default BattlefieldColumn;