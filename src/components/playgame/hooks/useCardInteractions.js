import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { isStructureEntry } from '@/lib/folderPreview';
import { makeCard, findAll, removeCardById, addCardToZone, clone, applyStatsOnPlay, applyModifierToParent, setCardFront, setCardFaceDown, cycleCardState, entryForCard, isCardFaceDown } from '../gameUtils';
import { usePointerDrag } from '@/context/PointerDragContext';
import { matchesHotkey } from '@/lib/hotkeys';

// Zones that findAll()/removeCardById()/addCardToZone() can touch when locating
// or moving an arbitrary card by id. Kept as a safe superset rather than
// resolving the single true zone per call, since attachment locations lose
// their parent zone type in the cardIndex lookup.
const CARD_ZONES = ['hands', 'rearguards', 'discards', 'side_cards', 'banished', 'deleted', 'new_zones', 'battlefields'];
// moveCard/handleAttach's stacking branch additionally touch decks and custom_sections.
const MOVE_ZONES = [...CARD_ZONES, 'decks', 'custom_sections'];

// Encapsulates all card interaction logic: drag/drop, token/influence changes,
// keyboard shortcuts, selection box, and card mutation helpers. Returns a stable
// set of callbacks plus the selection-box state for overlay rendering.
export function useCardInteractions({
  game, state, entries, supertypes, myPlayerIndex, players, battlefields,
  updateState, updateSharedState, updatePlayers, updateGame, updateCoordination, updateZones,
  emitTokenAnim, emitResourceAnim, emitClearAnim,
  selection, setSelection, group, setGroup,
  clearArrows, startArrowDrag, startBfArrowDrag,
  hotkeys = {},
}) {
  const [selBox, setSelBox] = useState(null);
  // My staged clash picks. Deliberately NOT synced anywhere until I press
  // Ready — nobody else needs to see them while I'm picking, so there's
  // nothing to sync and nothing to race. Resets automatically whenever a
  // fresh staging round starts (the key below goes through null every time
  // a clash ends, guaranteeing the next one starts clean even if it's the
  // same battlefield again).
  const [myClashPicks, setMyClashPicks] = useState([]);
  const clashRoundKey = state.clash?.staging ? `${state.clash.battlefield_id}` : null;
  useEffect(() => { setMyClashPicks([]); }, [clashRoundKey]);
  const { startDrag } = usePointerDrag();
  const hoveredRef = useRef(null);
  const clipboardRef = useRef(null);
  const findCardRef = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const selectionRef = useRef(null);
  const selectAreaRef = useRef(null);
  const selBoxRef = useRef(null);
  selBoxRef.current = selBox;
  selectionRef.current = selection;

  // Card index for O(1) lookups
  const cardIndex = useMemo(() => {
    const map = new Map();
    const indexCards = (cards, loc) => {
      (cards || []).forEach((c) => {
        map.set(c.id, { card: c, location: loc });
        if (c.attachments) c.attachments.forEach((a) => map.set(a.id, { card: a, location: { ...loc, zone: 'attachment', parent_id: c.id } }));
      });
    };
    const N = Math.max((state.hands || []).length, (state.rearguards || []).length, (state.discards || []).length, 2);
    for (let i = 0; i < N; i++) {
      indexCards(state.hands?.[i] || [], { zone: 'hand', player_index: i });
      indexCards(state.rearguards?.[i] || [], { zone: 'rearguard', player_index: i });
      indexCards(state.discards?.[i] || [], { zone: 'discard', player_index: i });
      indexCards(state.side_cards?.[i] || [], { zone: 'side_cards', player_index: i });
      indexCards(state.banished?.[i] || [], { zone: 'banished', player_index: i });
      indexCards(state.deleted?.[i] || [], { zone: 'deleted', player_index: i });
      indexCards(state.new_zones?.[i] || [], { zone: 'new_zone', player_index: i });
    }
    for (const bf of battlefields) for (let i = 0; i < (bf.sides || []).length; i++) indexCards(bf.sides?.[i] || [], { zone: 'battlefield', player_index: i, battlefield_id: bf.id });
    return map;
  }, [state, battlefields]);
  const cardIndexRef = useRef(cardIndex);
  cardIndexRef.current = cardIndex;

  const findCard = useCallback((cardId) => cardIndexRef.current.get(cardId) || null, []);
  findCardRef.current = findCard;

  const toggleExhausted = useCallback((cardId) => {
    updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (c.id === cardId) c.exhausted = !c.exhausted; }); return ns; }, CARD_ZONES);
  }, [updateZones]);
  // Cycles a card through its display states: front, each counterpart, then back.
  const toggleFlipped = useCallback((cardId) => {
    updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (c.id === cardId) cycleCardState(c, entries[c.entry_id]); }); return ns; }, CARD_ZONES);
  }, [updateZones, entries]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (matchesHotkey(e, hotkeys.copy)) {
        if (selectionRef.current?.type === 'group' && selectionRef.current.card_ids.length > 0) {
          const items = [];
          for (const cid of selectionRef.current.card_ids) { const found = findCardRef.current(cid); if (found) items.push({ entry_id: found.card.entry_id, influence: found.card.influence }); }
          if (items.length > 0) clipboardRef.current = items;
        } else {
          const cardId = hoveredRef.current;
          if (cardId) { const found = findCardRef.current(cardId); if (found) clipboardRef.current = [{ entry_id: found.card.entry_id, influence: found.card.influence }]; }
        }
        e.preventDefault(); return;
      }
      if (matchesHotkey(e, hotkeys.paste)) {
        if (clipboardRef.current && clipboardRef.current.length > 0) {
          const el = document.elementFromPoint(mousePosRef.current.x, mousePosRef.current.y);
          const sectionEl = el?.closest && el.closest('[data-section]');
          let target;
          if (sectionEl) { const parts = sectionEl.dataset.section.split(':'); target = { zone: parts[0], player_index: parseInt(parts[1]), battlefield_id: parts[2] || undefined }; }
          else target = { zone: 'hand', player_index: myPlayerIndex };
          updateZones((s) => { const ns = clone(s); for (const item of clipboardRef.current) { addCardToZone(ns, makeCard(item.entry_id, item.influence || '', entries, supertypes), { zone: target.zone, player_index: target.player_index, battlefield_id: target.battlefield_id }); } return ns; }, CARD_ZONES);
        }
        e.preventDefault(); return;
      }
      if (matchesHotkey(e, hotkeys.delete)) {
        let cardIds = [];
        if (selectionRef.current?.type === 'group') cardIds = selectionRef.current.card_ids;
        else if (selectionRef.current?.type === 'card') cardIds = [selectionRef.current.card_id];
        else if (hoveredRef.current) cardIds = [hoveredRef.current];
        if (cardIds.length > 0) {
          updateZones((s) => { const ns = clone(s); for (const cid of cardIds) { const card = removeCardById(ns, cid); if (card) { if (card.attachments?.length > 0) { const atts = card.attachments; card.attachments = []; ns.deleted[myPlayerIndex] = [...(ns.deleted[myPlayerIndex] || []), card, ...atts]; } else { ns.deleted[myPlayerIndex] = [...(ns.deleted[myPlayerIndex] || []), card]; } } } return ns; }, CARD_ZONES);
          setSelection(null); setGroup([]);
        }
        e.preventDefault(); return;
      }
      // Group shortcuts: r = shuffle positions, f = flip all, e/q = exhaust all
      if (selectionRef.current?.type === 'group' && selectionRef.current.card_ids.length > 0) {
        const cardIds = selectionRef.current.card_ids;
        if (matchesHotkey(e, hotkeys.shuffle)) {
          updateZones((s) => {
            const ns = clone(s);
            const zones = new Map();
            for (const cid of cardIds) {
              const found = findCardRef.current(cid);
              if (!found) continue;
              const loc = found.location;
              const key = `${loc.zone}:${loc.player_index}:${loc.battlefield_id || ''}`;
              if (!zones.has(key)) zones.set(key, { ...loc, ids: [] });
              zones.get(key).ids.push(cid);
            }
            for (const [, info] of zones) {
              let arr;
              if (info.zone === 'hand') arr = ns.hands[info.player_index];
              else if (info.zone === 'rearguard') arr = ns.rearguards[info.player_index];
              else if (info.zone === 'side_cards') arr = ns.side_cards[info.player_index];
              else if (info.zone === 'new_zone') arr = ns.new_zones[info.player_index];
              else if (info.zone === 'discard') arr = ns.discards[info.player_index];
              else if (info.zone === 'battlefield') { const bf = ns.battlefields.find((b) => b.id === info.battlefield_id); if (bf) arr = bf.sides[info.player_index]; }
              if (!arr) continue;
              const indices = info.ids.map((id) => arr.findIndex((c) => c.id === id)).filter((i) => i >= 0);
              if (indices.length < 2) continue;
              const selected = indices.map((i) => arr[i]);
              for (let i = selected.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [selected[i], selected[j]] = [selected[j], selected[i]]; }
              indices.forEach((idx, i) => { arr[idx] = selected[i]; });
            }
            return ns;
          }, CARD_ZONES);
          e.preventDefault(); return;
        }
        if (matchesHotkey(e, hotkeys.flip)) {
          updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (cardIds.includes(c.id)) cycleCardState(c, entries[c.entry_id]); }); return ns; }, CARD_ZONES);
          e.preventDefault(); return;
        }
        if (matchesHotkey(e, hotkeys.exhaust)) {
          updateZones((s) => { const ns = clone(s); const cards = []; findAll(ns, (c) => { if (cardIds.includes(c.id)) cards.push(c); }); const anyReadied = cards.some((c) => !c.exhausted); cards.forEach((c) => { c.exhausted = anyReadied; }); return ns; }, CARD_ZONES);
          e.preventDefault(); return;
        }
      }
      const cardId = hoveredRef.current;
      if (!cardId) return;
      if (matchesHotkey(e, hotkeys.addSupport)) { handleTokenChangeRef.current?.(cardId, null, 'support', 1); e.preventDefault(); return; }
      if (matchesHotkey(e, hotkeys.addDamage)) { handleTokenChangeRef.current?.(cardId, null, 'damage', 1); e.preventDefault(); return; }
      if (matchesHotkey(e, hotkeys.addArmor)) { handleTokenChangeRef.current?.(cardId, null, 'armor', 1); e.preventDefault(); return; }
      if (matchesHotkey(e, hotkeys.exhaust)) { toggleExhausted(cardId); e.preventDefault(); }
      else if (matchesHotkey(e, hotkeys.flip)) { toggleFlipped(cardId); e.preventDefault(); }
      else if (matchesHotkey(e, hotkeys.graveyard)) { sendToGraveyardRef.current?.(cardId); e.preventDefault(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleExhausted, toggleFlipped, updateZones, myPlayerIndex, entries, supertypes, setSelection, setGroup, hotkeys]);

  // Track mouse position for paste targeting
  useEffect(() => {
    const handleMove = (e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  const handleHoverEnter = useCallback((id) => { hoveredRef.current = id; }, []);
  const handleHoverLeave = useCallback(() => { hoveredRef.current = null; }, []);
  const sendToGraveyardRef = useRef(null);
  const handleTokenChangeRef = useRef(null);

  const moveCard = useCallback((dragData, dropTarget, beforeCardId) => {
    updateZones((s) => {
      const ns = clone(s);
      if (dragData.type === 'token') {
        addCardToZone(ns, makeCard(dragData.entry_id, dragData.influence || '', entries, supertypes), dropTarget, beforeCardId);
        if (dragData.custom_section) {
          const sections = ns.custom_sections?.[dragData.custom_section.player_index] || [];
          const sec = sections.find((s2) => s2.id === dragData.custom_section.section_id);
          if (sec) {
            const idx = sec.entry_ids.indexOf(dragData.entry_id);
            if (idx >= 0) sec.entry_ids.splice(idx, 1);
          }
        }
        return ns;
      }
      // Reorder within the same stacked deck
      if (dropTarget.zone === 'deck' && dragData.source_zone === 'deck' && dragData.source_player_index === dropTarget.player_index) {
        const d = [...(ns.decks[dropTarget.player_index] || [])];
        if (!d.length || typeof d[0] !== 'object') return s;
        const cardIds = dragData.group_card_ids || [dragData.card_id];
        const reordered = [];
        const remaining = [];
        for (const dc of d) { if (cardIds.includes(dc.id)) reordered.push(dc); else remaining.push(dc); }
        if (dropTarget.before_card_id) { const idx = remaining.findIndex((dc) => dc.id === dropTarget.before_card_id); if (idx >= 0) remaining.splice(idx, 0, ...reordered); else remaining.push(...reordered); }
        else { remaining.push(...reordered); }
        ns.decks[dropTarget.player_index] = remaining;
        return ns;
      }
      // Drop into deck from another zone
      if (dropTarget.zone === 'deck') {
        const d = [...(ns.decks[dropTarget.player_index] || [])];
        const isStacked = d.length > 0 && typeof d[0] === 'object';
        const cardIds = dragData.group_card_ids || [dragData.card_id];
        for (const cid of cardIds) {
          const card = removeCardById(ns, cid);
          if (!card) continue;
          card.tokens = {};
          if (isStacked) {
            const deckCard = { id: card.id, entry_id: card.entry_id, flipped: false };
            if (dropTarget.before_card_id) { const idx = d.findIndex((dc) => dc.id === dropTarget.before_card_id); if (idx >= 0) d.splice(idx, 0, deckCard); else d.unshift(deckCard); }
            else d.unshift(deckCard);
          } else { const ri = Math.floor(Math.random() * (d.length + 1)); d.splice(ri, 0, card.entry_id); }
        }
        ns.decks[dropTarget.player_index] = d;
        return ns;
      }
      // Draw from deck (source) — stacked draws from top, shuffled is random
      if (dragData.type === 'deck' || dragData.source_zone === 'deck') {
        const d = [...(ns.decks[dragData.source_player_index] || [])];
        if (!d.length) return s;
        if (typeof d[0] === 'object') {
          if (dragData.card_id) {
            const idx = d.findIndex((dc) => dc.id === dragData.card_id);
            if (idx < 0) return s;
            const deckCard = d.splice(idx, 1)[0];
            ns.decks[dragData.source_player_index] = d;
            const card = makeCard(deckCard.entry_id, '', entries, supertypes);
            if (!dragData.forceFaceUp && deckCard.flipped) setCardFaceDown(card, entries[deckCard.entry_id]); else setCardFront(card);
            addCardToZone(ns, card, dropTarget, beforeCardId);
          } else {
            const deckCard = d.shift();
            ns.decks[dragData.source_player_index] = d;
            const card = makeCard(deckCard.entry_id, '', entries, supertypes);
            setCardFaceDown(card, entries[deckCard.entry_id]);
            addCardToZone(ns, card, dropTarget, beforeCardId);
          }
        } else {
          const idx = Math.floor(Math.random() * d.length);
          const entryId = d.splice(idx, 1)[0];
          ns.decks[dragData.source_player_index] = d;
          const card = makeCard(entryId, '', entries, supertypes);
          setCardFaceDown(card, entries[entryId]);
          addCardToZone(ns, card, dropTarget, beforeCardId);
        }
        return ns;
      }
      if (dropTarget.zone === 'battlefield') { const bf = ns.battlefields.find((b) => b.id === dropTarget.battlefield_id); if (!bf) return s; }
      const cardIds = dragData.group_card_ids || [dragData.card_id];
      const fromDiscardOrToken = dragData.type === 'discard' || dragData.type === 'token';
      const useBefore = cardIds.length === 1 ? beforeCardId : undefined;
      // Clear all tokens when a card moves to hand, to graveyard, or out of graveyard
      const clearAllTokens = dropTarget.zone === 'hand' || dropTarget.zone === 'discard' || fromDiscardOrToken;
      // Playing a card from hand onto the board grants armor counters equal to
      // the card's Amr stat.
      const isPlayFromHand = dragData.source_zone === 'hand' && (dropTarget.zone === 'battlefield' || dropTarget.zone === 'rearguard');
      for (const cid of cardIds) {
        let sourceCard = null;
        findAll(ns, (c) => { if (c.id === cid) sourceCard = c; });
        const isStacked = sourceCard?.stacking && (sourceCard.stack_count || 1) > 1;
        const sameZone = dragData.source_zone === dropTarget.zone &&
                         dragData.source_player_index === dropTarget.player_index &&
                         (dragData.source_battlefield_id || '') === (dropTarget.battlefield_id || '');
        if (isStacked && (!sameZone || !useBefore)) {
          const newCard = makeCard(sourceCard.entry_id, sourceCard.influence || '', entries, supertypes);
          newCard.stacking = sourceCard.stacking;
          newCard.stack_count = 1;
          newCard.tokens = clearAllTokens ? {} : { ...sourceCard.tokens };
          if (isPlayFromHand) applyStatsOnPlay(newCard, entries);
          newCard.exhausted = sourceCard.exhausted;
          if (typeof sourceCard.state === 'number') newCard.state = sourceCard.state;
          newCard.flipped = sourceCard.flipped;
          addCardToZone(ns, newCard, dropTarget, useBefore);
          findAll(ns, (c) => { if (c.id === cid) c.stack_count = (c.stack_count || 1) - 1; });
        } else {
          const card = removeCardById(ns, cid);
          if (!card) continue;
          if (clearAllTokens) card.tokens = {};
          if (isPlayFromHand) applyStatsOnPlay(card, entries);
          if (card.attachments?.length > 0 && (dropTarget.zone === 'hand' || dropTarget.zone === 'discard')) {
            const atts = card.attachments;
            card.attachments = [];
            if (clearAllTokens) atts.forEach((a) => { a.tokens = {}; });
            addCardToZone(ns, card, dropTarget, useBefore);
            for (const att of atts) addCardToZone(ns, att, dropTarget);
          } else {
            addCardToZone(ns, card, dropTarget, useBefore);
          }
        }
      }
      return ns;
    }, MOVE_ZONES);
  }, [updateZones, entries, supertypes]);

  const handleAttach = useCallback((dragData, targetCard, targetLocation) => {
    if (targetLocation.zone === 'hand') {
      moveCard(dragData, { zone: targetLocation.zone, player_index: targetLocation.player_index });
      return;
    }
    if (dragData.group_card_ids && dragData.group_card_ids.length > 1) {
      moveCard(dragData, { zone: targetLocation.zone, player_index: targetLocation.player_index, battlefield_id: targetLocation.battlefield_id });
      return;
    }
    if (targetCard.stacking) {
      const dragEntryId = dragData.card?.entry_id || dragData.entry_id;
      const dragEntry = dragEntryId ? entries[dragEntryId] : null;
      const targetEntry = entries[targetCard.entry_id];
      if (dragEntry && targetEntry && dragEntry.name === targetEntry.name) {
        updateZones((s) => {
          const ns = clone(s);
          if (dragData.type === 'token') {
            findAll(ns, (c) => { if (c.id === targetCard.id) c.stack_count = (c.stack_count || 1) + 1; });
          } else {
            let draggedCard = null;
            findAll(ns, (c) => { if (c.id === dragData.card_id) draggedCard = c; });
            if (draggedCard?.stacking && (draggedCard.stack_count || 1) > 1) {
              draggedCard.stack_count = (draggedCard.stack_count || 1) - 1;
            } else {
              removeCardById(ns, dragData.card_id);
            }
            findAll(ns, (c) => { if (c.id === targetCard.id) c.stack_count = (c.stack_count || 1) + 1; });
          }
          return ns;
        }, CARD_ZONES);
        return;
      }
    }
    if (!dragData.card?.is_attachment && dragData.type !== 'token') {
      moveCard(dragData, { zone: targetLocation.zone, player_index: targetLocation.player_index, battlefield_id: targetLocation.battlefield_id }, targetCard.id);
      return;
    }
    updateZones((s) => {
      const ns = clone(s);
      let sc = null;
      if (dragData.type === 'token') sc = makeCard(dragData.entry_id, dragData.influence || '', entries, supertypes);
      else sc = removeCardById(ns, dragData.card_id);
      if (!sc) return s;
      findAll(ns, (c) => { if (c.id === targetCard.id) { c.attachments = c.attachments || []; c.attachments.push(sc); applyModifierToParent(sc, c, entries); } });
      return ns;
    }, CARD_ZONES);
  }, [updateZones, moveCard, entries, supertypes]);

  const handleDrop = useCallback((payload, dropTarget) => {
    clearArrows();
    let target = dropTarget;
    if (target.zone === 'battlefield' && target.player_index === undefined) target = { ...target, player_index: payload.source_player_index ?? myPlayerIndex };
    moveCard(payload, target, target.before_card_id);
  }, [clearArrows, moveCard, myPlayerIndex]);

  // During a clash selection phase, clicking your own on-board cards stages
  // (or un-stages) them for the clash instead of opening the sidebar. Once
  // you've readied up, clicks fall back to normal selection.
  const SELECTABLE_ZONES = ['hand', 'rearguard', 'side_cards', 'new_zone', 'battlefield'];
  const iAmClashing = !!state.clash?.staging && (state.clash.participants || []).includes(myPlayerIndex);
  const iAmClashReady = !!state.clash?.ready?.[myPlayerIndex];
  const handleCardClick = useCallback((card, location) => {
    if (iAmClashing && !iAmClashReady) {
      if (location && location.player_index === myPlayerIndex && location.zone !== 'attachment' && SELECTABLE_ZONES.includes(location.zone)) {
        setMyClashPicks((prev) => (prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id]));
      }
      return;
    }
    setGroup([]); setSelection({ type: 'card', card_id: card.id }); clearArrows();
  }, [iAmClashing, iAmClashReady, myPlayerIndex, setGroup, setSelection, clearArrows]);

  const handleTokenChange = useCallback((cardId, _loc, tokenType, delta) => {
    updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (c.id === cardId) { c.tokens = c.tokens || {}; c.tokens[tokenType] = Math.max(0, (c.tokens[tokenType] || 0) + delta); } }); return ns; }, CARD_ZONES);
    emitTokenAnim(cardId, tokenType, delta);
  }, [updateZones, emitTokenAnim]);
  handleTokenChangeRef.current = handleTokenChange;

  const handleInfluenceChange = useCallback((cardId, _loc, value) => {
    updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (c.id === cardId) c.influence = value; }); return ns; }, CARD_ZONES);
  }, [updateZones]);

  const handleDetach = useCallback((parentId, attId, location) => {
    updateZones((s) => {
      const ns = clone(s);
      let det = null;
      findAll(ns, (c) => { if (c.id === parentId && c.attachments) { const i = c.attachments.findIndex((a) => a.id === attId); if (i >= 0) det = c.attachments.splice(i, 1)[0]; } });
      if (det) {
        if (location.zone === 'rearguard') ns.rearguards[location.player_index] = [...(ns.rearguards[location.player_index] || []), det];
        else if (location.zone === 'battlefield') { const bf = ns.battlefields.find((b) => b.id === location.battlefield_id); if (bf) bf.sides[location.player_index] = [...(bf.sides[location.player_index] || []), det]; }
        else if (location.zone === 'side_cards') ns.side_cards[location.player_index] = [...(ns.side_cards[location.player_index] || []), det];
        else ns.hands[location.player_index] = [...(ns.hands[location.player_index] || []), det];
      }
      return ns;
    }, CARD_ZONES);
  }, [updateZones]);

  const handleDuplicate = useCallback((card, location) => {
    if (location.zone === 'attachment') return;
    const newCard = makeCard(card.entry_id, card.influence || '', entries, supertypes);
    updateZones((s) => { const ns = clone(s); addCardToZone(ns, newCard, { zone: location.zone, player_index: location.player_index, battlefield_id: location.battlefield_id }); return ns; }, CARD_ZONES);
  }, [entries, supertypes, updateZones]);

  const handleClearTokens = useCallback((cardId) => {
    const c = cardIndexRef.current.get(cardId)?.card;
    if (c?.tokens && Object.values(c.tokens).some((v) => v > 0)) emitClearAnim(cardId);
    updateZones((s) => { const ns = clone(s); findAll(ns, (cc) => { if (cc.id === cardId) cc.tokens = {}; }); return ns; }, CARD_ZONES);
  }, [updateZones, emitClearAnim]);

  const handleClearSupport = useCallback((cardId) => {
    const sup = cardIndexRef.current.get(cardId)?.card?.tokens?.support || 0;
    if (sup > 0) emitTokenAnim(cardId, 'support', -sup);
    updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (c.id === cardId) { c.tokens = c.tokens || {}; c.tokens.support = 0; } }); return ns; }, CARD_ZONES);
  }, [updateZones, emitTokenAnim]);

  const handleToggleAttachment = useCallback((cardId) => {
    updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (c.id === cardId) c.is_attachment = !c.is_attachment; }); return ns; }, CARD_ZONES);
  }, [updateZones]);

  const handleToggleStacking = useCallback((cardId) => {
    updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (c.id === cardId) c.stacking = !c.stacking; }); return ns; }, CARD_ZONES);
  }, [updateZones]);

  const handleToggleStructure = useCallback((cardId) => {
    updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (c.id === cardId) c.is_structure = !c.is_structure; }); return ns; }, CARD_ZONES);
  }, [updateZones]);

  const handleResolveTotal = useCallback((bfId, pIdx, val) => {
    updateZones((s) => { const ns = clone(s); const bf = ns.battlefields.find((b) => b.id === bfId); if (bf) { bf.resolved_totals = bf.resolved_totals || {}; bf.resolved_totals[pIdx] = val; } return ns; }, ['battlefields']);
  }, [updateZones]);

  const drawCard = useCallback(() => {
    updateZones((s) => {
      const ns = clone(s);
      const d = [...(ns.decks[myPlayerIndex] || [])];
      if (!d.length) return s;
      if (typeof d[0] === 'object') {
        const deckCard = d.shift();
        ns.decks[myPlayerIndex] = d;
        const card = makeCard(deckCard.entry_id, '', entries, supertypes);
        setCardFront(card);
        ns.hands[myPlayerIndex] = [...(ns.hands[myPlayerIndex] || []), card];
      } else {
        const i = Math.floor(Math.random() * d.length);
        const eid = d.splice(i, 1)[0];
        ns.decks[myPlayerIndex] = d;
        ns.hands[myPlayerIndex] = [...(ns.hands[myPlayerIndex] || []), makeCard(eid, '', entries, supertypes)];
      }
      return ns;
    }, ['decks', 'hands']);
  }, [updateZones, myPlayerIndex, entries, supertypes]);

  const adjustResource = useCallback((pIdx, res, delta) => {
    updatePlayers((ps) => { const np = clone(ps); if (np[pIdx]) { np[pIdx][res] = Math.max(0, (np[pIdx][res] || 0) + delta); } return np; });
    emitResourceAnim(pIdx, res, delta);
  }, [updatePlayers, emitResourceAnim]);

  // Declaring a clash focuses the battlefield and opens the selection phase:
  // each player stages cards from anywhere on their board, then readies up.
  // Once everyone is ready the staged cards move onto the battlefield (handled
  // in GameTable). Declaring again while a clash is already open just refocuses.
  const declareClash = useCallback((bfId) => {
    const bf = battlefields.find((b) => b.id === bfId);
    if (!bf) return;
    if (state.clash?.staging) {
      updateCoordination({ state: (s) => ({ ...s, clash: { ...s.clash, battlefield_id: bfId } }) });
      setSelection({ type: 'battlefield', battlefield_id: bfId }); setGroup([]);
      return;
    }
    const participants = (bf.owner === -1 || bf.owner === undefined)
      ? players.map((_, i) => i)
      : [bf.owner, bf.viewer].filter((v) => v >= 0);
    updateCoordination({
      state: (s) => ({
        ...s,
        clash: {
          battlefield_id: bfId,
          participants,
          staging: true,
          selections: {},
          ready: Object.fromEntries(participants.map((p) => [p, false])),
        },
      }),
    });
    setSelection({ type: 'battlefield', battlefield_id: bfId }); setGroup([]);
  }, [state, players, battlefields, updateCoordination, setSelection, setGroup]);

  const declareReady = useCallback(() => {
    if (!state.clash?.staging) return;
    updateCoordination({
      state: (s) => {
        const ns = clone(s);
        ns.clash.selections[myPlayerIndex] = myClashPicks;
        ns.clash.ready[myPlayerIndex] = true;
        for (const pi of ns.clash.participants) {
          if (pi === myPlayerIndex || !players[pi]?.is_ai || ns.clash.ready[pi]) continue;
          const pool = [...(s.rearguards?.[pi] || []), ...(s.hands?.[pi] || [])];
          const ids = pool.map((c) => c.id).sort(() => Math.random() - 0.5);
          ns.clash.selections[pi] = ids.slice(0, Math.min(4, ids.length));
          ns.clash.ready[pi] = true;
        }
        return ns;
      },
    });
  }, [state, players, myPlayerIndex, myClashPicks, updateCoordination]);

  const endClash = useCallback((bfId) => {
    updateZones((s) => {
      const ns = { ...s, battlefields: clone(s.battlefields), rearguards: clone(s.rearguards) };
      const bf = ns.battlefields.find((b) => b.id === bfId);
      if (bf) {
        for (let pi = 0; pi < players.length; pi++) {
          const side = [...(bf.sides[pi] || [])];
          const remaining = [];
          for (const card of side) {
            const entry = entries[card.entry_id];
            const isStructure = card.is_structure ?? isStructureEntry(entry, supertypes);
            card.exhausted = true;
            if (card.tokens?.support > 0) emitTokenAnim(card.id, 'support', -card.tokens.support);
            card.tokens = card.tokens || {};
            card.tokens.support = 0;
            if (isStructure) remaining.push(card);
            else ns.rearguards[pi] = [...(ns.rearguards[pi] || []), card];
          }
          bf.sides[pi] = remaining;
        }
      }
      return ns;
    }, ['battlefields', 'rearguards']);
    updateCoordination({
      state: (s) => ({ ...s, clash: { battlefield_id: '', participants: [], staging: false, selections: {}, ready: {} } }),
      players: (ps) => {
        const np = clone(ps);
        for (let pi = 0; pi < np.length; pi++) {
          const oldSupport = np[pi]?.support || 0;
          if (oldSupport > 0) emitResourceAnim(pi, 'support', -oldSupport);
          if (np[pi]) np[pi].support = 0;
        }
        return np;
      },
    });
    setMyClashPicks([]);
    setSelection(null);
  }, [players, entries, supertypes, emitTokenAnim, emitResourceAnim, updateZones, updateCoordination, setSelection]);

  // Destroying a battlefield ends any clash on it (structures stay, everything
  // else falls back to rearguard) and replaces it with a fresh draw from its
  // owner's pool. Rebuilt on the same "queue zone writes via updateZones, then
  // flush clash/players via updateCoordination in the same tick" pattern as
  // endClash, reading only from the hook's fresh internal state (never from
  // the `state`/`players` props, which can lag a render or two behind and
  // silently clobber a very recent change from the other player).
  const destroyBf = useCallback((bfId) => {
    updateZones((s) => {
      const ns = { ...s, battlefields: clone(s.battlefields), rearguards: clone(s.rearguards), battlefield_pools: clone(s.battlefield_pools) };
      const bf = ns.battlefields.find((b) => b.id === bfId);
      if (!bf) return s;
      const owner = bf.owner ?? -1;

      // End clash: move non-structures to rearguard, keep structures in place
      for (let pi = 0; pi < players.length; pi++) {
        const side = [...(bf.sides[pi] || [])];
        const remaining = [];
        for (const card of side) {
          const entry = entries[card.entry_id];
          const isStructure = card.is_structure ?? isStructureEntry(entry, supertypes);
          card.exhausted = true;
          if (isStructure) {
            remaining.push(card);
          } else {
            if (card.tokens?.support > 0) emitTokenAnim(card.id, 'support', -card.tokens.support);
            card.tokens = card.tokens || {};
            card.tokens.support = 0;
            ns.rearguards[pi] = [...(ns.rearguards[pi] || []), card];
          }
        }
        bf.sides[pi] = remaining;
      }

      // Replace battlefield with a new one drawn from this area's own pile, preserving structure sides
      const poolIdx = bf.pool_index ?? 0;
      const pool = owner >= 0 ? [...(ns.battlefield_pools?.[owner]?.[poolIdx] || [])] : [];
      let newBf;
      if (pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        const entryId = pool.splice(idx, 1)[0];
        newBf = { id: `bf_${Date.now()}`, owner, viewer: bf.viewer, pool_index: poolIdx, label: entries[entryId]?.name || 'Battlefield', type: 'card', card_entry_id: entryId, sides: bf.sides };
      } else {
        newBf = { id: `bf_${Date.now()}`, owner, viewer: bf.viewer, pool_index: poolIdx, label: 'Battlefield 12', type: 'number', number_value: 12, sides: bf.sides };
      }
      ns.battlefields = ns.battlefields.map((b) => b.id === bfId ? newBf : b);
      if (owner >= 0) {
        ns.battlefield_pools = ns.battlefield_pools || Array.from({ length: players.length }, () => [[], []]);
        ns.battlefield_pools[owner] = ns.battlefield_pools[owner] || [[], []];
        ns.battlefield_pools[owner][poolIdx] = pool;
      }
      return ns;
    }, ['battlefields', 'rearguards', 'battlefield_pools']);
    updateCoordination({
      players: (ps) => {
        const np = clone(ps);
        for (let pi = 0; pi < np.length; pi++) {
          const oldSupport = np[pi]?.support || 0;
          if (oldSupport > 0) emitResourceAnim(pi, 'support', -oldSupport);
          if (np[pi]) np[pi].support = 0;
        }
        return np;
      },
    });
    setSelection(null);
  }, [players, entries, supertypes, emitTokenAnim, emitResourceAnim, updateZones, updateCoordination, setSelection]);

  const adjustAdvantage = useCallback((bfId, pIdx, delta) => {
    updateZones((s) => { const ns = clone(s); const bf = ns.battlefields.find((b) => b.id === bfId); if (bf) { bf.advantage = bf.advantage || [0, 0]; bf.advantage[pIdx] = Math.max(0, (bf.advantage[pIdx] || 0) + delta); } return ns; }, ['battlefields']);
  }, [updateZones]);

  const computeSideTotal = useCallback((cards, bf, pIdx, inFocus = true) => {
    let total = 0, hasX = false;
    const influenceStr = (c) => {
      if (c.influence !== undefined && c.influence !== '') return c.influence;
      return (entryForCard(c, entries)?.influence || '');
    };
    const addCard = (c) => {
      if (!isCardFaceDown(c, entries)) {
        const infStr = influenceStr(c);
        const stackCount = c.stack_count || 1;
        if (infStr === '?') hasX = true;
        else total += (parseInt(infStr) || 0) * stackCount;
      }
      total += ((c.tokens?.support || 0) - (c.tokens?.damage || 0)) * (c.stack_count || 1);
    };
    (cards || []).forEach((c) => {
      // Modifier attachments (+/- influence) adjust the parent's influence
      // instead of contributing to the total on their own; other attachments
      // contribute their own influence to the total.
      let parentBoost = 0;
      (c.attachments || []).forEach((a) => {
        const aInf = influenceStr(a);
        if (!isCardFaceDown(a, entries) && aInf && (aInf[0] === '+' || aInf[0] === '-')) {
          parentBoost += (parseInt(aInf) || 0) * (a.stack_count || 1);
          total += ((a.tokens?.support || 0) - (a.tokens?.damage || 0)) * (a.stack_count || 1);
        } else {
          addCard(a);
        }
      });
      if (!isCardFaceDown(c, entries)) {
        const infStr = influenceStr(c);
        const stackCount = c.stack_count || 1;
        if (infStr === '?') hasX = true;
        else total += (parseInt(infStr) || 0) * stackCount + parentBoost;
      }
      total += ((c.tokens?.support || 0) - (c.tokens?.damage || 0)) * (c.stack_count || 1);
    });
    if (inFocus) total += (players?.[pIdx]?.support || 0);
    if (hasX && bf?.resolved_totals?.[pIdx] !== undefined) return { total: bf.resolved_totals[pIdx] + (inFocus ? (players?.[pIdx]?.support || 0) : 0), hasX: false };
    return { total, hasX };
  }, [entries, players]);

  const makeDragStart = useCallback((card, srcZone, pIdx, bfId, opts) => (e) => {
    const groupIdsForDrag = group.length > 1 && group.includes(card.id) ? group : null;
    startDrag(e, { type: 'card', card, card_id: card.id, source_zone: srcZone, source_player_index: pIdx, source_battlefield_id: bfId, group_card_ids: groupIdsForDrag, ...(opts || {}) });
  }, [group, startDrag]);

  const makeTokenDragStart = useCallback((token, pIdx) => (e) => { startDrag(e, { type: 'token', entry_id: token.entry_id, influence: token.influence, source_player_index: pIdx }); }, [startDrag]);

  const makeDiscardDragStart = useCallback((card, pIdx) => (e) => { startDrag(e, { type: 'discard', card, card_id: card.id, source_player_index: pIdx }); }, [startDrag]);

  const makeDeckDragStart = useCallback(() => (e) => { const deck = state.decks?.[myPlayerIndex] || []; if (!deck.length) return; startDrag(e, { type: 'deck', source_zone: 'deck', source_player_index: myPlayerIndex }); }, [state.decks, myPlayerIndex, startDrag]);

  const makeCustomSectionDragStart = useCallback((entryId, influence, sectionId, pIdx) => (e) => {
    startDrag(e, { type: 'token', entry_id: entryId, influence, source_player_index: pIdx, custom_section: { section_id: sectionId, player_index: pIdx } });
  }, [startDrag]);

  const handleAddCustomSection = useCallback(() => {
    updateZones((s) => {
      const ns = clone(s);
      ns.custom_sections = ns.custom_sections || [[], []];
      ns.custom_sections[myPlayerIndex] = ns.custom_sections[myPlayerIndex] || [];
      const num = ns.custom_sections[myPlayerIndex].length + 1;
      ns.custom_sections[myPlayerIndex].push({ id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: `Pool ${num}`, entry_ids: [] });
      return ns;
    }, ['custom_sections']);
  }, [updateZones, myPlayerIndex]);

  const handleAddToCustomSection = useCallback((sectionId, payload) => {
    const entryId = payload?.entry_id || payload?.card?.entry_id;
    if (!entryId) return;
    updateZones((s) => {
      const ns = clone(s);
      ns.custom_sections = ns.custom_sections || [[], []];
      ns.custom_sections[myPlayerIndex] = ns.custom_sections[myPlayerIndex] || [];
      const sec = ns.custom_sections[myPlayerIndex].find((s2) => s2.id === sectionId);
      if (sec) sec.entry_ids = [...sec.entry_ids, entryId];
      return ns;
    }, ['custom_sections']);
  }, [updateZones, myPlayerIndex]);

  const handleRemoveCustomSection = useCallback((sectionId) => {
    updateZones((s) => {
      const ns = clone(s);
      ns.custom_sections = ns.custom_sections || [[], []];
      ns.custom_sections[myPlayerIndex] = (ns.custom_sections[myPlayerIndex] || []).filter((s2) => s2.id !== sectionId);
      return ns;
    }, ['custom_sections']);
  }, [updateZones, myPlayerIndex]);

  // Draw: move a random card from a custom pool to your hand (consumes it).
  const handleDrawFromPool = useCallback((sectionId) => {
    updateZones((s) => {
      const ns = clone(s);
      ns.custom_sections = ns.custom_sections || [[], []];
      ns.custom_sections[myPlayerIndex] = ns.custom_sections[myPlayerIndex] || [];
      const sec = ns.custom_sections[myPlayerIndex].find((s2) => s2.id === sectionId);
      if (!sec || !sec.entry_ids.length) return s;
      const idx = Math.floor(Math.random() * sec.entry_ids.length);
      const entryId = sec.entry_ids.splice(idx, 1)[0];
      ns.hands[myPlayerIndex] = [...(ns.hands[myPlayerIndex] || []), makeCard(entryId, '', entries, supertypes)];
      return ns;
    }, ['custom_sections', 'hands']);
  }, [updateZones, myPlayerIndex, entries, supertypes]);

  // Pull: create a copy of a random card from a custom pool into your hand
  // (pool is not consumed).
  const handlePullFromPool = useCallback((sectionId) => {
    updateZones((s) => {
      const ns = clone(s);
      ns.custom_sections = ns.custom_sections || [[], []];
      ns.custom_sections[myPlayerIndex] = ns.custom_sections[myPlayerIndex] || [];
      const sec = ns.custom_sections[myPlayerIndex].find((s2) => s2.id === sectionId);
      if (!sec || !sec.entry_ids.length) return s;
      const entryId = sec.entry_ids[Math.floor(Math.random() * sec.entry_ids.length)];
      ns.hands[myPlayerIndex] = [...(ns.hands[myPlayerIndex] || []), makeCard(entryId, '', entries, supertypes)];
      return ns;
    }, ['custom_sections', 'hands']);
  }, [updateZones, myPlayerIndex, entries, supertypes]);

  const handleTokenCharge = useCallback((tokenIndex, delta) => { updateZones((s) => { const ns = clone(s); const t = (ns.tokens[myPlayerIndex] || [])[tokenIndex]; if (t) t.charge = Math.max(0, (t.charge || 0) + delta); return ns; }, ['tokens']); }, [updateZones, myPlayerIndex]);

  const handleGroupExhaust = useCallback((cardIds) => { updateZones((s) => { const ns = clone(s); const cards = []; findAll(ns, (c) => { if (cardIds.includes(c.id)) cards.push(c); }); const anyReadied = cards.some((c) => !c.exhausted); cards.forEach((c) => { c.exhausted = anyReadied; }); return ns; }, CARD_ZONES); }, [updateZones]);

  const handleGroupFlip = useCallback((cardIds) => { updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (cardIds.includes(c.id)) cycleCardState(c, entries[c.entry_id]); }); return ns; }, CARD_ZONES); }, [updateZones, entries]);

  const handleGroupTokenChange = useCallback((cardIds, tokenType, delta) => { updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (cardIds.includes(c.id)) { c.tokens = c.tokens || {}; c.tokens[tokenType] = Math.max(0, (c.tokens[tokenType] || 0) + delta); } }); return ns; }, CARD_ZONES); cardIds.forEach((id) => emitTokenAnim(id, tokenType, delta)); }, [updateZones, emitTokenAnim]);

  const handleGroupClearTokens = useCallback((cardIds) => { cardIds.forEach((id) => { const c = cardIndexRef.current.get(id)?.card; if (c?.tokens && Object.values(c.tokens).some((v) => v > 0)) emitClearAnim(id); }); updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (cardIds.includes(c.id)) c.tokens = {}; }); return ns; }, CARD_ZONES); }, [updateZones, emitClearAnim]);

  const handleGroupClearSupport = useCallback((cardIds) => { cardIds.forEach((id) => { const sup = cardIndexRef.current.get(id)?.card?.tokens?.support || 0; if (sup > 0) emitTokenAnim(id, 'support', -sup); }); updateZones((s) => { const ns = clone(s); findAll(ns, (c) => { if (cardIds.includes(c.id)) { c.tokens = c.tokens || {}; c.tokens.support = 0; } }); return ns; }, CARD_ZONES); }, [updateZones, emitTokenAnim]);

  // Selection box + right-click arrow handlers — use refs for selBox to keep callbacks stable
  const handleAreaMouseDown = useCallback((e) => {
    if (e.button === 2) {
      const cardEl = e.target.closest('[data-card-id]');
      const bfEl = e.target.closest('[data-bf-id]');
      if (cardEl) { e.preventDefault(); startArrowDrag(e, cardEl.dataset.cardId); }
      else if (bfEl) { e.preventDefault(); startBfArrowDrag(e, bfEl.dataset.bfId); }
    } else if (e.button === 0) {
      if (e.target.closest('[data-card-id]') || e.target.closest('[data-bf-id]')) return;
      const rect = e.currentTarget.getBoundingClientRect();
      selectAreaRef.current = e.currentTarget;
      setSelBox({ areaLeft: rect.left, areaTop: rect.top, startX: e.clientX - rect.left, startY: e.clientY - rect.top, x: e.clientX - rect.left, y: e.clientY - rect.top });
      setGroup([]); setSelection(null); clearArrows();
    }
  }, [startArrowDrag, startBfArrowDrag, setGroup, setSelection, clearArrows]);

  const handleAreaMouseMove = useCallback((e) => {
    const sb = selBoxRef.current;
    if (sb && selectAreaRef.current) { const rect = selectAreaRef.current.getBoundingClientRect(); setSelBox({ ...sb, x: e.clientX - rect.left, y: e.clientY - rect.top }); }
  }, []);

  const handleAreaMouseUp = useCallback(() => {
    const sb = selBoxRef.current;
    if (sb && selectAreaRef.current) {
      const area = selectAreaRef.current; const rect = area.getBoundingClientRect();
      const x1 = Math.min(sb.startX, sb.x), y1 = Math.min(sb.startY, sb.y), x2 = Math.max(sb.startX, sb.x), y2 = Math.max(sb.startY, sb.y);
      if (Math.abs(x2 - x1) >= 5 && Math.abs(y2 - y1) >= 5) {
        const cardEls = area.querySelectorAll('[data-card-id]');
        const selected = [];
        cardEls.forEach((el) => { const cr = el.getBoundingClientRect(); const cx1 = cr.left - rect.left, cy1 = cr.top - rect.top, cx2 = cx1 + cr.width, cy2 = cy1 + cr.height; if (cx1 < x2 && cx2 > x1 && cy1 < y2 && cy2 > y1) selected.push(el.dataset.cardId); });
        if (selected.length > 1) { setGroup(selected); setSelection({ type: 'group', card_ids: selected }); }
      }
      setSelBox(null); selectAreaRef.current = null;
    }
  }, [setGroup, setSelection]);

  const handleAreaMouseLeave = useCallback(() => {
    if (selBoxRef.current) { setSelBox(null); selectAreaRef.current = null; }
  }, []);

  const stackDeck = useCallback((pIdx) => {
    updateZones((s) => {
      const ns = clone(s);
      const d = [...(ns.decks[pIdx] || [])];
      const entryIds = d.map((item) => typeof item === 'object' ? item.entry_id : item);
      for (let i = entryIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [entryIds[i], entryIds[j]] = [entryIds[j], entryIds[i]];
      }
      ns.decks[pIdx] = entryIds.map((entryId) => ({
        id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        entry_id: entryId,
        flipped: true,
      }));
      return ns;
    }, ['decks']);
  }, [updateZones]);

  // deck_viewing is NOT a split-out zone field (it's small/UI-transient), so it
  // still lives on the nested `state` object and is written via updateState,
  // alongside the separate updateZones() call for the decks array itself.
  const shuffleDeck = useCallback((pIdx) => {
    updateZones((s) => {
      const ns = clone(s);
      const d = [...(ns.decks[pIdx] || [])];
      ns.decks[pIdx] = d.map((item) => typeof item === 'object' ? item.entry_id : item);
      return ns;
    }, ['decks']);
    updateState((s) => {
      const ns = clone(s);
      ns.deck_viewing = ns.deck_viewing || {};
      delete ns.deck_viewing[pIdx];
      return ns;
    });
  }, [updateZones, updateState]);

  const viewDeck = useCallback((pIdx) => {
    const d = state.decks?.[pIdx] || [];
    if (!d.length || typeof d[0] !== 'object') return;
    const allFaceUp = d.every((dc) => !dc.flipped);
    updateZones((s) => {
      const ns = clone(s);
      const dd = [...(ns.decks[pIdx] || [])];
      ns.decks[pIdx] = dd.map((dc) => ({ ...dc, flipped: allFaceUp }));
      return ns;
    }, ['decks']);
    if (!allFaceUp) {
      updateState((s) => {
        const ns = clone(s);
        ns.deck_viewing = ns.deck_viewing || {};
        ns.deck_viewing[pIdx] = Date.now();
        return ns;
      });
    }
  }, [state.decks, updateZones, updateState]);

  const drawRandomToMoments = useCallback((entryId) => {
    updateZones((s) => {
      const ns = clone(s);
      const card = makeCard(entryId, '', entries, supertypes);
      setCardFront(card);
      ns.hands[myPlayerIndex] = [...(ns.hands[myPlayerIndex] || []), card];
      return ns;
    }, ['hands']);
  }, [updateZones, entries, supertypes, myPlayerIndex]);

  // Send a card to its owner's graveyard (discard pile). Reuses moveCard so
  // tokens are cleared and attachments follow the same rules as a drag.
  const sendToGraveyard = useCallback((cardId) => {
    const found = findCardRef.current(cardId);
    if (!found) return;
    const { card, location } = found;
    if (location.zone === 'discard' || location.zone === 'attachment') return;
    moveCard({ card, card_id: cardId, source_zone: location.zone, source_player_index: location.player_index, source_battlefield_id: location.battlefield_id }, { zone: 'discard', player_index: location.player_index });
  }, [moveCard]);
  sendToGraveyardRef.current = sendToGraveyard;

  return {
    selBox,
    toggleExhausted, toggleFlipped,
    moveCard, handleAttach, handleDrop, handleCardClick,
    handleTokenChange, handleInfluenceChange, handleDetach, handleDuplicate,
    handleClearTokens, handleClearSupport, handleToggleAttachment, handleToggleStacking, handleToggleStructure,
    handleResolveTotal, drawCard, declareClash, declareReady, endClash, destroyBf, adjustAdvantage,
    adjustResource, computeSideTotal, stackDeck, shuffleDeck, viewDeck, myClashPicks,
    makeDragStart, makeTokenDragStart, makeDiscardDragStart, makeDeckDragStart,
    handleTokenCharge, handleGroupExhaust, handleGroupFlip, handleGroupTokenChange,
    handleGroupClearTokens, handleGroupClearSupport,
    handleAreaMouseDown, handleAreaMouseMove, handleAreaMouseUp, handleAreaMouseLeave,
    handleHoverEnter, handleHoverLeave,
    findCard, drawRandomToMoments, sendToGraveyard,
    makeCustomSectionDragStart, handleAddCustomSection, handleAddToCustomSection, handleRemoveCustomSection,
    handleDrawFromPool, handlePullFromPool,
  };
}