import { renderType, isStructureEntry } from '@/lib/folderPreview';
import { stateCountFor, cardStateOf, displayEntryFor } from '@/lib/counterparts';

export const TOKEN_COLORS = { damage: '#dc2626', armor: '#2563eb', charge: '#ca8a04', support: '#ffffff', other: '#28a745', duration: '#7c3aed', mst: '#6b7280' };

export const clone = (s) => structuredClone(s);

export const makeCard = (entryId, influence = '', entries, supertypes) => {
  const entry = entries?.[entryId];
  const isAttachment = entry ? renderType(entry, supertypes) === 'modifier' : false;
  const isStructure = entry ? isStructureEntry(entry, supertypes) : false;
  return {
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    entry_id: entryId, influence,
    tokens: { damage: 0, armor: 0, charge: 0, support: 0, duration: 0, other: 0, mst: 0 },
    attachments: [], exhausted: false, flipped: false, state: 0,
    is_attachment: isAttachment,
    is_structure: isStructure,
    stacking: false,
    stack_count: 1,
  };
};

// --- Counterpart rotation -------------------------------------------------
// A card shows its front, then each of its entry's counterparts in turn, then
// its back. `flipped` is kept in sync so anything that only cares whether a
// card is face-down (deck handling, animations) keeps working unchanged.

export const setCardFront = (card) => { if (card) { card.state = 0; card.flipped = false; } };

export const setCardFaceDown = (card, entry) => { if (card) { card.state = stateCountFor(entry) - 1; card.flipped = true; } };

// Advance a card to its next display state (wraps back around to the front).
export const cycleCardState = (card, entry) => {
  if (!card) return;
  const n = stateCountFor(entry);
  const next = (cardStateOf(card, entry) + 1) % n;
  card.state = next;
  card.flipped = next === n - 1;
};

// The face a card currently shows (null once it is face-down).
export const entryForCard = (card, entries) => {
  const base = entries?.[card?.entry_id];
  return displayEntryFor(base, cardStateOf(card, base));
};

export const isCardFaceDown = (card, entries) => {
  const base = entries?.[card?.entry_id];
  return cardStateOf(card, base) === stateCountFor(base) - 1;
};

// When a card is played from hand onto the board (battlefield or rearguard),
// grant it armor/duration counters equal to its Amr/Dur stats. Modifier
// values (prefixed with + or -) are skipped here — they only apply to the
// parent card when the card is played attached (see applyModifierToParent).
export const applyStatsOnPlay = (card, entries) => {
  if (!card || !entries) return;
  const entry = entries[card.entry_id];
  if (!entry?.stats) return;
  card.tokens = card.tokens || {};
  for (const stat of entry.stats) {
    if (/^[+-]/.test(stat.value)) continue; // modifier — handled on attach
    const v = parseInt(stat.value);
    if (isNaN(v) || v <= 0) continue;
    if (stat.name === 'Amr') card.tokens.armor = v;
    else if (stat.name === 'Dur') card.tokens.duration = v;
  }
};

// When a modifier card (Amr/Dur starting with + or -) is attached to another
// card, the parent gains that much armor/duration instead of the modifier
// card gaining it itself.
export const applyModifierToParent = (child, parent, entries) => {
  if (!child || !parent || !entries) return;
  const entry = entries[child.entry_id];
  if (!entry?.stats) return;
  parent.tokens = parent.tokens || {};
  for (const stat of entry.stats) {
    if (!/^[+-]/.test(stat.value)) continue;
    const v = parseInt(stat.value);
    if (isNaN(v)) continue;
    if (stat.name === 'Amr') parent.tokens.armor = Math.max(0, (parent.tokens.armor || 0) + v);
    else if (stat.name === 'Dur') parent.tokens.duration = Math.max(0, (parent.tokens.duration || 0) + v);
  }
};

export const searchCards = (cards, fn) => { cards.forEach((c) => { fn(c); if (c.attachments) searchCards(c.attachments, fn); }); };

export const findAll = (ns, fn) => {
  const N = Math.max((ns.hands || []).length, (ns.rearguards || []).length, (ns.discards || []).length, 2);
  for (let i = 0; i < N; i++) { searchCards(ns.hands[i] || [], fn); searchCards(ns.rearguards[i] || [], fn); searchCards(ns.discards[i] || [], fn); searchCards(ns.side_cards?.[i] || [], fn); searchCards(ns.banished?.[i] || [], fn); searchCards(ns.deleted?.[i] || [], fn); searchCards(ns.new_zones?.[i] || [], fn); }
  for (const bf of ns.battlefields) for (let i = 0; i < (bf.sides || []).length; i++) searchCards(bf.sides[i] || [], fn);
};

export const removeCardById = (ns, cardId) => {
  const N = Math.max((ns.hands || []).length, (ns.rearguards || []).length, (ns.discards || []).length, 2);
  for (let i = 0; i < N; i++) {
    for (const zone of ['hands', 'rearguards', 'discards', 'side_cards', 'banished', 'deleted', 'new_zones']) {
      const arr = ns[zone]?.[i] || [];
      const idx = arr.findIndex((c) => c.id === cardId);
      if (idx >= 0) return arr.splice(idx, 1)[0];
      for (const c of arr) {
        if (c.attachments) {
          const aIdx = c.attachments.findIndex((a) => a.id === cardId);
          if (aIdx >= 0) return c.attachments.splice(aIdx, 1)[0];
        }
      }
    }
  }
  for (const bf of ns.battlefields || []) {
    for (let i = 0; i < (bf.sides || []).length; i++) {
      const side = bf.sides?.[i] || [];
      const idx = side.findIndex((c) => c.id === cardId);
      if (idx >= 0) return side.splice(idx, 1)[0];
      for (const c of side) {
        if (c.attachments) {
          const aIdx = c.attachments.findIndex((a) => a.id === cardId);
          if (aIdx >= 0) return c.attachments.splice(aIdx, 1)[0];
        }
      }
    }
  }
  return null;
};

export const addCardToZone = (ns, card, dropTarget, beforeCardId) => {
  let arr, set;
  if (dropTarget.zone === 'battlefield') {
    const bf = ns.battlefields.find((b) => b.id === dropTarget.battlefield_id);
    if (!bf) return;
    arr = bf.sides[dropTarget.player_index] || [];
    set = (a) => { bf.sides[dropTarget.player_index] = a; };
  } else {
    const key = { hand: 'hands', rearguard: 'rearguards', discard: 'discards', banished: 'banished', deleted: 'deleted', side_cards: 'side_cards', new_zone: 'new_zones' }[dropTarget.zone];
    if (!key) return;
    if (!ns[key]) ns[key] = Array.from({ length: Math.max((ns.hands || []).length, 2) }, () => []);
    arr = ns[key][dropTarget.player_index] || [];
    set = (a) => { ns[key][dropTarget.player_index] = a; };
  }
  if (beforeCardId) {
    const idx = arr.findIndex((c) => c.id === beforeCardId);
    if (idx >= 0) { set([...arr.slice(0, idx), card, ...arr.slice(idx)]); return; }
  }
  set([...arr, card]);
};

export const findArrowEl = (endpoint) => {
  if (!endpoint) return null;
  if (endpoint.startsWith('card:')) return document.querySelector(`[data-card-id="${endpoint.slice(5)}"]`);
  if (endpoint.startsWith('bf:')) return document.querySelector(`[data-bf-id="${endpoint.slice(3)}"]`);
  return document.querySelector(`[data-card-id="${endpoint}"]`);
};