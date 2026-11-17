import { base44 } from '@/api/base44Client';
import { renderType, isStructureEntry } from '@/lib/folderPreview';

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Initializes game state from every player's deck (2 or 3 players): fetches
// entries, categorizes them (deck / battlefield / income / token), shuffles
// decks, and adds the neutral 12 battlefield. Each player's two battlefield
// areas are dealt after every player splits their battlefield deck via the
// start-of-game popup (see GameTable). All per-player state arrays are sized
// to the player count.
export async function initializeGameState(gameId, players) {
  const N = players.length;
  const decks = await Promise.all(players.map((p) => base44.entities.Deck.get(p.deck_id)));

  const entryIds = new Set();
  decks.forEach((d) => { (d.cards || []).forEach((c) => entryIds.add(c.card_id)); });

  const tokenResults = await Promise.all(
    decks.map((d) =>
      d.folder_id
        ? base44.entities.CardEntry.filter({ folder_id: d.folder_id, supertype: 'token' }, '-created_date', 500).catch(() => [])
        : Promise.resolve([])
    )
  );
  tokenResults.forEach((tokens) => tokens.forEach((t) => entryIds.add(t.id)));

  const ids = Array.from(entryIds).filter(Boolean);
  const [res, su] = await Promise.all([
    ids.length ? base44.functions.invoke('GetEntriesByIds', { ids }) : Promise.resolve({ data: { entries: [] } }),
    base44.entities.FolderSupertype.list('sort_order', 500),
  ]);

  const entryMap = {};
  (res.data?.entries || []).forEach((e) => { entryMap[e.id] = e; });
  const seen = new Set();
  const supertypes = (su || []).filter((s) => { if (seen.has(s.name)) return false; seen.add(s.name); return true; });

  const emptyArr = () => Array.from({ length: N }, () => []);
  const state = {
    hands: emptyArr(),
    decks: emptyArr(),
    tokens: emptyArr(),
    discards: emptyArr(),
    income_options: emptyArr(),
    selected_income: Array.from({ length: N }, () => ''),
    revealed_income: [],
    battlefields: [],
    battlefield_pools: Array.from({ length: N }, () => [[], []]),
    bf_dealt: false,
    rearguards: emptyArr(),
    side_cards: emptyArr(),
    banished: emptyArr(),
    deleted: emptyArr(),
    new_zones: emptyArr(),
    new_zone_enabled: Array.from({ length: N }, () => false),
    custom_sections: emptyArr(),
    arrows: [],
    clash: { battlefield_id: '', participants: [], staging: false, selections: {}, ready: {} },
  };

  // battlefieldPools[i] holds [pile0, pile1]; at init all of player i's
  // battlefield cards go into pile0. The player splits them via the
  // start-of-game popup; until then pile1 is empty.
  const battlefieldPools = Array.from({ length: N }, () => [[], []]);

  for (let i = 0; i < N; i++) {
    const deck = decks[i];
    const deckEntryIds = [];
    const incomePool = [];
    const tokenPool = [];

    (tokenResults[i] || []).forEach((t) => {
      tokenPool.push({ entry_id: t.id, influence: t.influence || '' });
    });

    for (const dc of (deck.cards || [])) {
      const entry = entryMap[dc.card_id];
      if (!entry) continue;
      const rt = renderType(entry, supertypes);
      for (let c = 0; c < (dc.copies || 1); c++) {
        if (rt === 'battlefield') battlefieldPools[i][0].push(dc.card_id);
        else if (rt === 'income') incomePool.push(dc.card_id);
        else if (entry.supertype === 'token') tokenPool.push({ entry_id: dc.card_id, influence: entry.influence || '' });
        else deckEntryIds.push(dc.card_id);
      }
    }

    shuffleArray(deckEntryIds);
    // AI players draw 16 cards at the start; remaining cards stay in the deck.
    if (players[i].is_ai) {
      const drawCount = Math.min(16, deckEntryIds.length);
      state.hands[i] = deckEntryIds.slice(0, drawCount).map((eid) => ({
        id: `card_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        entry_id: eid, influence: '',
        tokens: { damage: 0, armor: 0, charge: 0, support: 0, duration: 0, other: 0 },
        attachments: [], exhausted: false, flipped: false, state: 0,
        is_attachment: false,
        is_structure: isStructureEntry(entryMap[eid], supertypes),
        stacking: false, stack_count: 1,
      }));
      state.decks[i] = deckEntryIds.slice(drawCount);
    } else {
      state.decks[i] = deckEntryIds;
    }
    state.tokens[i] = tokenPool;
    state.income_options[i] = incomePool;

    // Group tokens that share a word in their card name into auto-generated
    // custom pool tabs named after the shared word. Tokens are duplicated
    // (referenced) — the original token pile keeps them, and each matching
    // word gets its own tab listing every token whose name contains it.
    const wordToTokenIds = {};
    (tokenResults[i] || []).forEach((t) => {
      const words = (t.name || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      words.forEach((w) => {
        if (!wordToTokenIds[w]) wordToTokenIds[w] = [];
        if (!wordToTokenIds[w].includes(t.id)) wordToTokenIds[w].push(t.id);
      });
    });
    const autoSections = [];
    Object.entries(wordToTokenIds).forEach(([word, ids]) => {
      if (ids.length >= 2) {
        autoSections.push({
          id: `cs_${Date.now()}_${i}_${word}_${Math.random().toString(36).slice(2, 6)}`,
          name: word.charAt(0).toUpperCase() + word.slice(1),
          entry_ids: [...ids],
        });
      }
    });
    state.custom_sections[i] = autoSections;
  }

  // Neutral 12 battlefield — all players participate (owner/viewer = -1).
  state.battlefields.push({ id: `bf_0`, owner: -1, viewer: -1, label: 'Battlefield 12', type: 'number', number_value: 12, sides: emptyArr() });

  const playersWithSplit = players.map((p, i) => ({ ...p, battlefield_split_done: false, battlefield_piles: [battlefieldPools[i][0], []] }));
  // Split the locally-built state object: `clash` stays nested under
  // `state`, everything else (hands, decks, battlefields, ...) is written
  // as its own top-level field so per-move writes only touch the zones
  // that actually changed.
  const { clash, ...zones } = state;
  await base44.entities.Game.update(gameId, { status: 'playing', state: { clash }, players: playersWithSplit, ...zones });
}