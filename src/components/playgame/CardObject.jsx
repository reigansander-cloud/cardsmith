import React from 'react';
import MiniEntry from './MiniEntry';
import { useZoomHover } from './ZoomHoverPopup';
import { usePointerDrag, useDropZone } from '@/context/PointerDragContext';
import { cardStateOf, displayEntryFor } from '@/lib/counterparts';

const TOKEN_COLORS = {
  damage: '#dc2626',
  armor: '#2563eb',
  charge: '#ca8a04',
  support: '#ffffff',
  prowess: '#8b0000',
  other: '#28a745',
  duration: '#7c3aed',
  mst: '#6b7280',
};

const CARD_BACK_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/516417bcba_ec1ad09b0_CardBack.png';

export const TokenAnimContext = React.createContext([]);
export const AdjustInfluenceContext = React.createContext({ clash: true, rearguard: false, hand: true });
export const SmallTokensContext = React.createContext(false);
export const HighlightCardContext = React.createContext(null);
export const TokenPopupContext = React.createContext(null);
export const MstTokenColorContext = React.createContext(null);
// { active: bool, selectedIds: Set<string>, locked: bool } — cards the local
// player has staged for the current clash are highlighted with a ring.
export const ClashSelectionContext = React.createContext({ active: false, selectedIds: new Set(), locked: false });

// Card on the table. Attachments render behind (offset down-LEFT, each further
// left) and are independently clickable/hoverable — they don't rotate with an
// exhausted parent. Double-click toggles exhausted. Strength Mod has no badge.
export default function CardObject({ card, entry, entries, supertypes = [], targetWidth = 60, faceDown = false, location, onPointerDown, onSelect, onCardDrop, onHoverEnter, onHoverLeave, onDoubleClick, selectedCardId, groupIds }) {
  const tokenAnims = React.useContext(TokenAnimContext);
  const adjustInfluenceObj = React.useContext(AdjustInfluenceContext);
  const smallTokens = React.useContext(SmallTokensContext);
  const highlightCardId = React.useContext(HighlightCardContext);
  const tokenPopupCtx = React.useContext(TokenPopupContext);
  const mstColor = React.useContext(MstTokenColorContext);
  const clashSel = React.useContext(ClashSelectionContext);
  const isClashSelected = clashSel.active && clashSel.selectedIds.has(card?.id);
  // Counterpart rotation: the card shows its front, then each counterpart, then
  // its back. `shownEntry` is the face currently on display (null when facedown).
  const shownEntry = displayEntryFor(entry, cardStateOf(card, entry));
  const { hoverEnter: zoomEnter, hoverLeave: zoomLeave } = useZoomHover();
  const { startDrag } = usePointerDrag();
  const attachDropProps = useDropZone(onCardDrop ? (payload) => onCardDrop(payload, card, location) : null);
  const zone = location?.zone;
  const adjustInfluence = zone === 'battlefield' ? adjustInfluenceObj.clash : (zone === 'rearguard' || zone === 'side_cards') ? adjustInfluenceObj.rearguard : zone === 'hand' ? adjustInfluenceObj.hand : false;
  const myAnims = tokenAnims.filter((a) => a.cardId === card?.id);
  const stackCount = card?.stack_count || 1;
  const baseInfluenceStr = card?.influence !== undefined && card?.influence !== '' ? card.influence : (shownEntry?.influence || '');
  const isQuestion = baseInfluenceStr === '?';
  const isModifier = !isQuestion && !!baseInfluenceStr && (baseInfluenceStr[0] === '+' || baseInfluenceStr[0] === '-');
  const infNum = isQuestion ? 0 : (parseInt(baseInfluenceStr) || 0);
  const mst = card?.tokens?.mst || 0;
  const mstBoost = 2 * mst;
  const effectiveInf = infNum * stackCount + mstBoost;
  const damage = card?.tokens?.damage || 0;
  const support = card?.tokens?.support || 0;
  const showBack = faceDown || !shownEntry;
  const hasAttachments = card?.attachments?.length > 0 && entries && !showBack;
  // Cards with attachments stay visible even when damage meets/exceeds their
  // influence — the attachment keeps the unit in play.
  const isDimmed = effectiveInf > 0 && damage >= effectiveInf + support && !hasAttachments;
  // Modifier attachments (+/- influence) adjust this card's influence value.
  const attMod = (card?.attachments || []).reduce((sum, a) => {
    if (a.flipped) return sum;
    const aEntry = entries?.[a.entry_id];
    const aInf = a.influence !== undefined && a.influence !== '' ? a.influence : (aEntry?.influence || '');
    if (aInf && (aInf[0] === '+' || aInf[0] === '-')) {
      const modSupport = a.tokens?.support || 0;
      const modDamage = a.tokens?.damage || 0;
      return sum + ((parseInt(aInf) || 0) + modSupport - modDamage) * (a.stack_count || 1);
    }
    return sum;
  }, 0);
  let influenceOverride = null;
  if (adjustInfluence && !isQuestion) {
    const adjusted = infNum + attMod + support - damage + mstBoost;
    const entryInfNum = parseInt(shownEntry?.influence || '') || 0;
    if (isModifier) {
      // In-play modifiers render like normal cards (filled, with +/- sign),
      // only while above/below base. Outlines are reserved for attached
      // modifiers (handled in the attachment render below).
      if (adjusted !== entryInfNum) {
        const text = (adjusted >= 0 ? '+' : '') + adjusted;
        const color = adjusted < entryInfNum ? '#8b0000' : '#006400';
        influenceOverride = { text, color };
      }
    } else if ((infNum > 0 || attMod !== 0) && adjusted !== entryInfNum) {
      influenceOverride = { text: String(adjusted), color: adjusted < entryInfNum ? '#8b0000' : '#006400' };
    }
  }
  const isExhausted = card?.exhausted;
  const attCount = hasAttachments ? card.attachments.length : 0;

  const isToken = shownEntry?.supertype === 'token';
  const tokenScale = smallTokens && isToken ? 0.8 : 1;
  const effectiveWidth = targetWidth * tokenScale;
  const extraLeft = (attCount ? effectiveWidth * 0.35 * attCount : 0) + (isExhausted ? effectiveWidth * 0.2 : 0);
  const extraRight = isExhausted ? effectiveWidth * 0.2 : 0;
  const attScale = hasAttachments ? 0.8 : 1;
  const totalScale = attScale * tokenScale;

  const handleAttDragStart = (att) => (e) => {
    e.stopPropagation();
    startDrag(e, { type: 'card', card: att, card_id: att.id, source_zone: 'attachment', source_player_index: location?.player_index, source_battlefield_id: location?.battlefield_id });
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onClick={() => onSelect?.(card, location)}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(card); }}
      onMouseEnter={() => { onHoverEnter?.(card?.id); zoomEnter({ type: 'card', entry: shownEntry, supertypes, faceDown: showBack, tokens: card?.tokens, influence: card?.influence, stackCount: card?.stack_count, influenceOverride }, location?.zone === 'hand'); }}
      onMouseLeave={() => { onHoverLeave?.(); zoomLeave(); }}
      {...attachDropProps}
      onContextMenu={tokenPopupCtx ? (e) => {
        const cardEl = e.target.closest('[data-card-id]');
        if (!cardEl) return;
        e.preventDefault();
        if (!tokenPopupCtx.wasDrag()) { const r = cardEl.getBoundingClientRect(); tokenPopupCtx.show(cardEl.dataset.cardId, r.right, r.top); }
      } : undefined}
      data-card-id={card?.id}
      className={`group relative cursor-grab select-none flex-shrink-0 ${isDimmed ? 'opacity-40' : ''} ${(selectedCardId === card?.id || (groupIds?.includes(card?.id))) ? 'ring-2 ring-primary rounded' : ''} ${highlightCardId === card?.id ? 'ring-4 ring-yellow-400 rounded-lg animate-pulse z-10' : ''} ${isClashSelected ? 'ring-4 ring-emerald-400 rounded-lg z-10' : ''}`}
      style={{ width: effectiveWidth, marginLeft: extraLeft, marginRight: extraRight, ...(onPointerDown ? { touchAction: 'none' } : {}) }}
    >
      <div style={totalScale !== 1 ? { transform: `scale(${totalScale})`, transformOrigin: 'top left' } : undefined}>
      {/* Attachments — behind, offset down-LEFT, each further left, independently interactable */}
      {hasAttachments && card.attachments.map((att, i) => {
        const attShowBack = att.flipped || !entries[att.entry_id];
        const attInf = att.influence !== undefined && att.influence !== '' ? att.influence : (entries[att.entry_id]?.influence || '');
        const attIsModifier = !attShowBack && attInf && (attInf[0] === '+' || attInf[0] === '-');
        let attInfluenceOverride = null;
        if (adjustInfluence && attIsModifier) {
          const attBase = parseInt(attInf) || 0;
          const attEntryInf = parseInt(entries[att.entry_id]?.influence || '') || 0;
          const live = attBase + (att.tokens?.support || 0) - (att.tokens?.damage || 0);
          const text = (live >= 0 ? '+' : '') + live;
          const color = live > attEntryInf ? '#006400' : live < attEntryInf ? '#8b0000' : '#000000';
          attInfluenceOverride = { text, color, outline: true };
        }
        return (
          <div key={att.id} onPointerDown={handleAttDragStart(att)} data-card-id={att.id} className={`absolute ${att.exhausted ? 'rotate-90' : ''} ${(selectedCardId === att.id || groupIds?.includes(att.id)) ? 'ring-2 ring-primary rounded' : ''}`} style={{ top: '25%', left: `${-35 * (i + 1)}%`, width: targetWidth, zIndex: -i, touchAction: 'none' }}
            onClick={(e) => { e.stopPropagation(); onSelect?.(att, { ...location, zone: 'attachment', parent_id: card.id }); }}
            onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(att); }}
            onMouseEnter={(e) => { e.stopPropagation(); onHoverEnter?.(att.id); zoomEnter({ type: 'card', entry: entries[att.entry_id], supertypes, faceDown: attShowBack, tokens: att.tokens, influence: att.influence, stackCount: att.stack_count }); }}
            onMouseLeave={(e) => { e.stopPropagation(); onHoverLeave?.(); zoomLeave(); }}
          >
            {attShowBack ? <img src={CARD_BACK_URL} alt="Card Back" draggable={false} className="w-full object-cover" style={{ borderRadius: 3 }} /> : <MiniEntry entry={entries[att.entry_id]} supertypes={supertypes} targetWidth={targetWidth} influenceOverride={attInfluenceOverride} />}
          </div>
        );
      })}
      {/* Main card — rotated 90° when exhausted */}
      <div className={`relative ${isExhausted ? 'rotate-90' : ''}`} style={{ width: targetWidth, zIndex: 1, pointerEvents: 'none', ...(showBack ? { height: targetWidth * 1.4 } : {}) }}>
        {stackCount > 1 && (
          <div className="absolute bottom-0.5 left-0.5 text-[10px] font-bold bg-black/70 text-white rounded-full px-1.5 py-0.5 leading-none z-10 pointer-events-none">x{stackCount}</div>
        )}
        {showBack ? (
          <img src={CARD_BACK_URL} alt="Card Back" draggable={false} className="w-full h-full object-cover" style={{ borderRadius: 3 }} />
        ) : (
          <MiniEntry entry={shownEntry} supertypes={supertypes} targetWidth={targetWidth} influenceOverride={influenceOverride} />
        )}
        {card?.tokens && (
          <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5 group-hover:opacity-70 transition-opacity">
            {Object.entries(card.tokens).map(([key, val]) => {
              if (!val || val === 0) return null;
              const bg = key === 'mst' ? (mstColor || '#6b7280') : (TOKEN_COLORS[key] || '#666');
              return (
                <div key={key} className="text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none" style={{ background: bg, color: bg === '#ffffff' ? '#000' : '#fff' }}>
                  {val}
                </div>
              );
            })}
          </div>
        )}
        {myAnims.map((a) => (
          <div key={a.id} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-resource-pop pointer-events-none z-20 flex items-center justify-center rounded-full font-black whitespace-nowrap" style={{ width: a.text ? targetWidth * 0.9 : targetWidth * 0.5, height: targetWidth * 0.5, background: a.color, color: a.color === '#ccc' ? '#000' : '#fff', fontSize: a.text ? targetWidth * 0.16 : targetWidth * 0.26, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
            {a.text || `${a.delta > 0 ? '+' : ''}${a.delta}`}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}