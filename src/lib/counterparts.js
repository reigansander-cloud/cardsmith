// Counterpart faces. An entry may carry any number of alternative faces, each
// with the same options as a normal entry. In play a card rotates
// front -> counterpart 1 -> counterpart 2 -> ... -> facedown -> front; exports
// use them for the flipped TTS sheet and as separate printed cards.

export const counterpartsOf = (entry) =>
  (entry && Array.isArray(entry.counterparts) ? entry.counterparts.filter(Boolean) : []);

export const hasCounterparts = (entry) => counterpartsOf(entry).length > 0;

// A card's display states: the front (0), one per counterpart, then facedown
// (the last state). Cards with no counterparts therefore have exactly two.
export const stateCountFor = (entry) => counterpartsOf(entry).length + 2;

export const counterpartAt = (entry, state) =>
  (state >= 1 ? counterpartsOf(entry)[state - 1] || null : null);

export const isFaceDownState = (entry, state) => (state || 0) === stateCountFor(entry) - 1;

// The entry-like object a card shows in a given state: the base entry on the
// front, one of its counterparts mid-rotation, or null when facedown.
export const displayEntryFor = (entry, state) => {
  if (!entry) return null;
  if (!state) return entry;
  const cp = counterpartAt(entry, state);
  if (!cp) return null;
  return { ...cp, id: entry.id, folder_id: entry.folder_id, needs_review: entry.needs_review };
};

// Current state of a card record. Cards created before counterparts existed only
// carry the legacy `flipped` flag, which maps to the facedown state.
export const cardStateOf = (card, entry) => {
  if (!card) return 0;
  if (typeof card.state === 'number') return card.state;
  return card.flipped ? stateCountFor(entry) - 1 : 0;
};

// A blank counterpart inheriting the base entry's supertype / token type so it
// renders with the same template as the card it belongs to.
export const newCounterpart = (entry) => ({
  name: '',
  influence: '',
  ability: '',
  flavor_text: '',
  subtype: '',
  supertype: entry?.supertype || 'permanent',
  token_type: entry?.token_type || 'permanent',
  cost: 0,
  cost_icons: [],
  cost_question: [],
  stats: [],
  income_symbol: '',
  bonus_mode: 'cost',
  bonus_cost_icons: [],
  bonus_ability: '',
  text_color: '',
});