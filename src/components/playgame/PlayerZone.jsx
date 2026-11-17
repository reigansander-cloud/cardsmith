import React from 'react';
import CardObject from './CardObject';
import { useShrinkToFit } from './useShrinkToFit';
import { Flag } from 'lucide-react';
import { useDropZone } from '@/context/PointerDragContext';

const FLAG_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/3ec46ed99e_9ce494615_Flag1.png';
const ENERGY_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/839feccb4f_dfe4137f3_energy2.png';
const SUPPORT_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/dc6b34353b_9bcbb8d33_Action.png';
const CARD_BACK_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/516417bcba_ec1ad09b0_CardBack.png';

// Bottom 1/4 — player's private zone. Token pile, deck, discard, resources,
// and hand. Energy/Flags use icons on light backgrounds. Hand cards are large
// and wrap to new rows when there are too many.
export default function PlayerZone({ game, state, entries, supertypes, myPlayerIndex, onDrop, onDraw, onTokenDragStart, onDiscardDragStart, onCardDragStart, onCardClick, onCardDrop, onResourceClick, onEndRound, onSelectTokens, onSelectDiscard, selection, onHoverEnter, onHoverLeave, onToggleExhausted, resourceAnims, resourceFlash, onDeckDragStart, onDeckRightClick, onAreaMouseDown, onAreaMouseMove, onAreaMouseUp, onAreaMouseLeave }) {
  const me = (game.players || [])[myPlayerIndex];
  const myHand = state.hands?.[myPlayerIndex] || [];
  const myDeck = state.decks?.[myPlayerIndex] || [];
  const myTokens = state.tokens?.[myPlayerIndex] || [];
  const myDiscards = state.discards?.[myPlayerIndex] || [];
  const { ref: handRef, cardWidth: handCardWidth, wraps: handWraps } = useShrinkToFit(myHand.length, { minWidth: 60, maxWidth: 90, gap: 4 });
  const flashBg = (res) => { const f = (resourceFlash || {})[`${myPlayerIndex}_${res}`]; return f === 'pos' ? 'bg-green-500' : f === 'neg' ? 'bg-red-500' : 'bg-foreground/90'; };
  const flashBgMuted = (res) => { const f = (resourceFlash || {})[`${myPlayerIndex}_${res}`]; return f === 'pos' ? 'bg-green-500' : f === 'neg' ? 'bg-red-500' : 'bg-muted/50 hover:bg-muted'; };
  const deckDrop = useDropZone((payload) => onDrop(payload, { zone: 'deck', player_index: myPlayerIndex }));
  const graveyardDrop = useDropZone((payload) => onDrop(payload, { zone: 'discard', player_index: myPlayerIndex }));
  const handDrop = useDropZone((payload) => onDrop(payload, { zone: 'hand', player_index: myPlayerIndex }));

  return (
    <div className="h-[18vh] min-h-[110px] border-t border-border bg-card/30 flex">
      <div className="flex flex-col gap-1 p-2 border-r border-border w-28 flex-shrink-0">
        <button onClick={() => onResourceClick(myPlayerIndex, 'support', 1)} onContextMenu={(e) => { e.preventDefault(); onResourceClick(myPlayerIndex, 'support', -1); }} className={`relative flex items-center justify-center gap-1.5 p-1.5 rounded transition-colors duration-150 ${flashBg('support')} text-background text-xs`}>
          <img src={SUPPORT_ICON_URL} className="w-3.5 h-3.5 object-contain" /><span className="font-bold">{me?.support || 0}</span>
          {(resourceAnims || []).filter(a => a.resource === 'support').map(a => (<span key={a.id} className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold animate-resource-pop pointer-events-none ${a.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>{a.delta > 0 ? '+' : ''}{a.delta}</span>))}
        </button>
        <button onClick={() => onResourceClick(myPlayerIndex, 'energy', 1)} onContextMenu={(e) => { e.preventDefault(); onResourceClick(myPlayerIndex, 'energy', -1); }} className={`relative flex items-center justify-center gap-1.5 p-1.5 rounded transition-colors duration-150 ${flashBg('energy')} text-background text-xs`}>
          <img src={ENERGY_ICON_URL} className="w-4 h-4 object-contain" /><span className="font-bold">{me?.energy || 0}</span>
          {(resourceAnims || []).filter(a => a.resource === 'energy').map(a => (<span key={a.id} className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold animate-resource-pop pointer-events-none ${a.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>{a.delta > 0 ? '+' : ''}{a.delta}</span>))}
        </button>
        <button onClick={() => onResourceClick(myPlayerIndex, 'flags', 1)} onContextMenu={(e) => { e.preventDefault(); onResourceClick(myPlayerIndex, 'flags', -1); }} className={`relative flex items-center justify-center gap-1.5 p-1.5 rounded transition-colors duration-150 ${flashBg('flags')} text-background text-xs`}>
          <img src={FLAG_ICON_URL} className="w-4 h-5 object-cover rounded" /><span className="font-bold">{me?.flags || 0}</span>
          {(resourceAnims || []).filter(a => a.resource === 'flags').map(a => (<span key={a.id} className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold animate-resource-pop pointer-events-none ${a.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>{a.delta > 0 ? '+' : ''}{a.delta}</span>))}
        </button>
        <button onClick={() => onResourceClick(myPlayerIndex, 'other', 1)} onContextMenu={(e) => { e.preventDefault(); onResourceClick(myPlayerIndex, 'other', -1); }} className={`relative flex items-center justify-center gap-1.5 p-1.5 rounded transition-colors duration-150 ${flashBg('other')} text-background text-xs`}>
          <span className="font-bold text-base leading-none">?</span><span className="font-bold">{me?.other || 0}</span>
          {(resourceAnims || []).filter(a => a.resource === 'other').map(a => (<span key={a.id} className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold animate-resource-pop pointer-events-none ${a.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>{a.delta > 0 ? '+' : ''}{a.delta}</span>))}
        </button>
      </div>

      <div className="flex flex-col gap-1 p-2 border-r border-border w-28 flex-shrink-0">
        <button onClick={onSelectTokens} className={`flex items-center gap-2 p-1.5 rounded text-xs ${selection?.type === 'tokens' ? 'bg-primary/20' : 'bg-muted/50 hover:bg-muted'}`}>
          <span>Tokens ({myTokens.length})</span>
        </button>
        <div onClick={onDraw} onContextMenu={(e) => { e.preventDefault(); onDeckRightClick(); }} {...deckDrop} className={`relative flex items-center gap-2 p-1.5 rounded text-xs cursor-grab transition-colors duration-150 ${flashBgMuted('deck')}`}>
          <img src={CARD_BACK_URL} className="w-7 h-9 rounded object-cover" alt="Deck" onPointerDown={onDeckDragStart} style={{ touchAction: 'none' }} />
          <span>Deck ({myDeck.length})</span>
          {(resourceAnims || []).filter(a => a.resource === 'deck').map(a => (<span key={a.id} className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold animate-resource-pop pointer-events-none whitespace-nowrap ${a.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>{a.delta > 0 ? '+' : ''}{a.delta}</span>))}
        </div>
        <button data-anim-source={`graveyard-${myPlayerIndex}`} onClick={onSelectDiscard} {...graveyardDrop} className={`relative flex items-center gap-2 p-1.5 rounded text-xs transition-colors duration-150 ${selection?.type === 'discard' ? 'bg-primary/20' : flashBgMuted('discard')}`}>
          <span>Graveyard ({myDiscards.length})</span>
          {(resourceAnims || []).filter(a => a.resource === 'discard').map(a => (<span key={a.id} className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold animate-resource-pop pointer-events-none whitespace-nowrap ${a.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>{a.delta > 0 ? '+' : ''}{a.delta}</span>))}
        </button>
      </div>

      <div ref={handRef} data-anim-source={`hand-${myPlayerIndex}`} className={`flex-1 flex flex-wrap gap-1 p-2 items-center min-w-0 ${handWraps ? 'overflow-y-auto' : 'overflow-hidden'} relative`} data-section={`hand:${myPlayerIndex}`} onContextMenu={(e) => e.preventDefault()} onMouseDown={onAreaMouseDown} onMouseMove={onAreaMouseMove} onMouseUp={onAreaMouseUp} onMouseLeave={onAreaMouseLeave} {...handDrop}>
        {myHand.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 m-auto">Click deck to draw cards</p>
        ) : (
          myHand.map((card) => (
            <CardObject
              key={card.id} card={card} entry={entries[card.entry_id]} entries={entries} supertypes={supertypes} targetWidth={handCardWidth}
              location={{ zone: 'hand', player_index: myPlayerIndex }}
              onPointerDown={onCardDragStart(card, 'hand', myPlayerIndex)} onSelect={onCardClick} onCardDrop={onCardDrop}
              onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={() => onToggleExhausted(card.id)}
            />
          ))
        )}
      </div>
      <button onClick={onEndRound} className={`flex-shrink-0 w-20 m-1 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-colors ${me?.end_round_pressed ? 'border-muted bg-muted/20 text-muted-foreground' : 'border-primary bg-primary/10 hover:bg-primary/20 text-primary'}`}>
        <Flag size={24} />
        <span className="text-[10px] font-bold text-center leading-tight">{(game.round || 0) === 0 ? 'Start' : me?.end_round_pressed ? 'Waiting...' : 'End Round'}</span>
      </button>
    </div>
  );
}