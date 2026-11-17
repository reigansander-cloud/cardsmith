// Clan-in-play effects.
//
// Some clans change how their player's cards behave just by being in play (a
// deck from that clan's folder is in the game) — detected the same way the
// Foghollow Mst token is (see useGame.js).
//
// Biotide: every card of that clan gains an extra state ("Scaled Egg") its
// owner can rotate into, exactly like a counterpart face. The state is layered
// onto the in-memory entry map when the game loads, so card rotation, the
// influence readout, previews and hover popups all pick it up with no other
// changes. Nothing is ever written back to the stored entries.

export const BIOTIDE_CLAN = 'Biotide';

// The state Biotide adds: a unit that transforms during the Income Phase. It
// keeps the host card's folder, so it renders on Biotide's card background.
export const SCALED_EGG = {
  name: 'Scaled Egg',
  supertype: 'unit',
  token_type: 'permanent',
  ability: 'Transforms during Income Phase',
  influence: '1',
  flavor_text: '',
  subtype: '',
  cost: 0,
  cost_icons: [],
  cost_question: [],
  stats: [],
  income_symbol: '',
  bonus_mode: 'cost',
  bonus_cost_icons: [],
  bonus_ability: '',
  text_color: '',
};

// Returns a copy of the entry map in which every entry belonging to one of
// `clanFolderIds` carries the clan's extra state. When no clan with states is
// in play the map is returned untouched.
export function applyClanStates(entryMap, clanFolderIds) {
  if (!entryMap || !clanFolderIds || clanFolderIds.size === 0) return entryMap;
  const out = {};
  Object.entries(entryMap).forEach(([id, entry]) => {
    if (!entry || !clanFolderIds.has(entry.folder_id)) {
      out[id] = entry;
      return;
    }
    const existing = Array.isArray(entry.counterparts) ? entry.counterparts : [];
    if (existing.some((cp) => cp && cp.name === SCALED_EGG.name)) {
      out[id] = entry;
      return;
    }
    out[id] = { ...entry, counterparts: [...existing, SCALED_EGG] };
  });
  return out;
}