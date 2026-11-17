import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { applyClanStates, BIOTIDE_CLAN } from '@/lib/clanStates';
import { createGameSync } from '@/lib/gameSync';

// Top-level Game fields that used to live nested inside the single `state`
// blob. Splitting them out means a move that only touches (say) a
// battlefield doesn't have to clone/send everyone's hands, discards,
// banished pile, decks, etc. on every single write.
//
// `state` itself still exists as a Game field, but from here on it only
// carries `clash` (small, short-lived) plus whatever legacy zone data is
// still sitting in an old/in-progress game that hasn't been touched since
// this migration.
const ZONE_FIELDS = [
  'hands', 'decks', 'tokens', 'discards', 'income_options', 'selected_income',
  'revealed_income', 'battlefields', 'battlefield_pools', 'bf_dealt',
  'rearguards', 'side_cards', 'banished', 'deleted', 'new_zones',
  'new_zone_enabled', 'custom_sections', 'arrows',
];

// Builds the read view the rest of the app already expects at `game.state`.
// For each zone, prefers the new top-level field; falls back to the old
// nested `state.<zone>` location for a game that predates this migration
// and hasn't had that zone written to since. `clash`/`coord_version` (and
// anything else genuinely small) just live directly on `state` as before.
function buildStateView(g) {
  if (!g) return {};
  const legacy = g.state || {};
  const view = { ...legacy };
  for (const key of ZONE_FIELDS) {
    if (g[key] !== undefined) view[key] = g[key];
  }
  return view;
}

// Strips zone keys back out of a `state`-shaped object. Defends against a
// caller that built its write from the full merged view (e.g. clone(view))
// and is still carrying zone keys in what it returns — those belong in
// their own top-level fields via updateZones, not nested back under
// `state`, where they'd be invisible (top-level always wins in
// buildStateView) while still costing the clone/transmit.
function stripZones(obj) {
  if (!obj) return obj;
  const out = { ...obj };
  for (const key of ZONE_FIELDS) delete out[key];
  return out;
}

// Live copy of one Game (synced by lib/gameSync.js) plus the card data the
// table needs. Loads CardEntry data once when the game transitions to
// 'playing'.
export function useGame(gameId) {
  const { user } = useAuth();
  const [game, setGame] = useState(null);
  const [entries, setEntries] = useState({});
  const [supertypes, setSupertypes] = useState([]);
  const [folderEntries, setFolderEntries] = useState({});
  const [folderColors, setFolderColors] = useState({});
  const [foghollowColor, setFoghollowColor] = useState(null);
  // Folder ids of clans in play that grant their player's cards an extra state.
  const [clanFolderIds, setClanFolderIds] = useState(null);
  const [loading, setLoading] = useState(!!gameId);
  const gameRef = useRef(null);
  const entriesLoadedRef = useRef(false);
  const entriesRef = useRef({});
  // All syncing (sending our moves, merging everyone else's, resyncing)
  // lives in lib/gameSync.js; this hook just mirrors its copy into React.
  const syncRef = useRef(null);

  useEffect(() => {
    gameRef.current = null;
    setGame(null);
    if (!gameId) { setLoading(false); return; }
    setLoading(true);
    const sync = createGameSync({
      gameId,
      base44,
      onChange: (g) => { gameRef.current = g; setGame(g); },
      onLoaded: () => setLoading(false),
    });
    syncRef.current = sync;
    sync.start();
    return () => { sync.stop(); if (syncRef.current === sync) syncRef.current = null; };
  }, [gameId]);

  const applyLocal = useCallback((updates) => { syncRef.current?.apply(updates); }, []);
  const flushUpdates = useCallback(() => { syncRef.current?.flush(); }, []);
  const scheduleFlush = useCallback(() => { syncRef.current?.scheduleFlush(); }, []);


  useEffect(() => {
    if (!game || game.status !== 'playing' || entriesLoadedRef.current) return;
    entriesLoadedRef.current = true;
    loadGameEntries(game).catch(() => { entriesLoadedRef.current = false; });
  }, [game?.status]);

  useEffect(() => { entriesRef.current = entries; }, [entries]);

  // Dynamically load entries that appear in the state after the initial load
  // (e.g. cards drawn from the token tab). Without this the opponent doesn't
  // have the entry and sees the card as a facedown back.
  useEffect(() => {
    if (!game || game.status !== 'playing') return;
    const st = buildStateView(game);
    const ids = new Set();
    const collect = (cards) => (cards || []).forEach((c) => { if (c.entry_id) ids.add(c.entry_id); collect(c.attachments); });
    (st.hands || []).forEach(collect);
    (st.rearguards || []).forEach(collect);
    (st.side_cards || []).forEach(collect);
    (st.new_zones || []).forEach(collect);
    (st.discards || []).forEach(collect);
    (st.battlefields || []).forEach((bf) => { if (bf.card_entry_id) ids.add(bf.card_entry_id); (bf.sides || []).forEach(collect); });
    (st.custom_sections || []).forEach((secs) => (secs || []).forEach((s) => (s.entry_ids || []).forEach((id) => id && ids.add(id))));
    const missing = Array.from(ids).filter((id) => !entriesRef.current[id]);
    if (!missing.length) return;
    base44.functions.invoke('GetEntriesByIds', { ids: missing }).then((res) => {
      const newEntries = res.data?.entries || [];
      if (newEntries.length) setEntries((prev) => { const u = { ...prev }; newEntries.forEach((e) => { u[e.id] = e; }); return u; });
    }).catch(() => {});
    // Zone data now mostly lives at the top level, so this needs to re-run
    // whenever the game object itself changes (cheap — it just bails out
    // above once nothing is missing), not just when game.state changes.
  }, [game, game?.status]);

  async function loadGameEntries(g) {
    const state = buildStateView(g);
    const allEntryIds = new Set();
    const collectCards = (cards) => {
      (cards || []).forEach((c) => {
        if (c.entry_id) allEntryIds.add(c.entry_id);
        collectCards(c.attachments);
      });
    };
    (state.decks || []).forEach((d) => d.forEach((item) => { const eid = typeof item === 'object' ? item.entry_id : item; if (eid) allEntryIds.add(eid); }));
    (state.tokens || []).forEach((ts) => ts.forEach((t) => t.entry_id && allEntryIds.add(t.entry_id)));
    (state.hands || []).forEach(collectCards);
    (state.discards || []).forEach(collectCards);
    (state.rearguards || []).forEach(collectCards);
    (state.side_cards || []).forEach(collectCards);
    (state.banished || []).forEach(collectCards);
    (state.battlefields || []).forEach((bf) => {
      if (bf.card_entry_id) allEntryIds.add(bf.card_entry_id);
      (bf.sides || []).forEach(collectCards);
    });
    (state.battlefield_pools || []).forEach((piles) => (piles || []).forEach((pile) => (pile || []).forEach((id) => id && allEntryIds.add(id))));
    (state.income_options || []).forEach((opts) => opts.forEach((id) => id && allEntryIds.add(id)));
    (state.selected_income || []).forEach((id) => id && allEntryIds.add(id));
    (g.players || []).forEach((p) => {
      if (p.income_entry_id) allEntryIds.add(p.income_entry_id);
      (p.battlefield_piles || []).forEach((pile) => (pile || []).forEach((id) => id && allEntryIds.add(id)));
    });

    const ids = Array.from(allEntryIds).filter(Boolean);
    const [res, su] = await Promise.all([
      ids.length ? base44.functions.invoke('GetEntriesByIds', { ids }) : Promise.resolve({ data: { entries: [] } }),
      base44.entities.FolderSupertype.list('sort_order', 500),
    ]);
    const entryMap = {};
    (res.data?.entries || []).forEach((e) => { entryMap[e.id] = e; });

    // Load current player's folder entries for the tokens sidebar supertype tabs
    let folderGrouped = {};
    try {
      const myIdx = g.players?.findIndex((p) => p.user_id === user?.id) ?? -1;
      const myDeckId = myIdx >= 0 ? g.players[myIdx].deck_id : '';
      if (myDeckId) {
        const deck = await base44.entities.Deck.get(myDeckId);
        if (deck?.folder_id) {
          const folderSupertypeNames = new Set((su || []).filter((s) => s.folder_id === deck.folder_id).map((s) => s.name));
          const folderEntriesList = await base44.entities.CardEntry.filter({ folder_id: deck.folder_id }, '-created_date', 500);
          (folderEntriesList || []).forEach((e) => {
            if (e.supertype === 'token') return;
            if (folderSupertypeNames.has(e.supertype)) {
              if (!folderGrouped[e.supertype]) folderGrouped[e.supertype] = [];
              folderGrouped[e.supertype].push(e.id);
            }
            if (!entryMap[e.id]) entryMap[e.id] = e;
          });
        }
      }
    } catch {}

    setEntries(entryMap);
    setFolderEntries(folderGrouped);
    const seen = new Set();
    setSupertypes((su || []).filter((s) => { if (seen.has(s.name)) return false; seen.add(s.name); return true; }));
    try {
      const folders = await base44.entities.Folder.list('-created_date', 200);
      const fc = {};
      const folderById = {};
      (folders || []).forEach((f) => { if (f.color) fc[f.id] = f.color; folderById[f.id] = f; });
      setFolderColors(fc);
      // Foghollow: if any deck in the game is associated with a folder named
      // "Foghollow", enable the Mst token (colored with that folder's color;
      // each Mst token increases the card's influence by 2).
      const deckResults = await Promise.all((g.players || []).map((p) => p.deck_id ? base44.entities.Deck.get(p.deck_id).catch(() => null) : null));
      let fhColor = null;
      for (const d of deckResults) {
        if (!d?.folder_id) continue;
        const f = folderById[d.folder_id];
        if (f && f.name === 'Foghollow') { fhColor = f.color || '#6b7280'; break; }
      }
      setFoghollowColor(fhColor);
      // Biotide: a clan in play whose cards each gain an extra state.
      const clanIds = new Set();
      deckResults.forEach((d) => {
        const f = d?.folder_id ? folderById[d.folder_id] : null;
        if (f && f.name === BIOTIDE_CLAN) clanIds.add(f.id);
      });
      setClanFolderIds(clanIds);
    } catch {}
  }

  const myPlayerIndex = game?.players?.findIndex((p) => p.user_id === user?.id) ?? -1;

  const updateGame = useCallback((updates) => {
    if (!gameId) return;
    const current = gameRef.current;
    applyLocal(updates);
    const hasPhase = 'phase' in updates;
    const hasState = 'state' in updates;
    const hasPlayers = 'players' in updates;
    const coordChanged = hasState && !!updates.state && updates.state.coord_version !== current?.state?.coord_version;
    if (hasPhase || (hasPlayers && !hasState) || coordChanged) {
      flushUpdates();
    } else {
      scheduleFlush();
    }
  }, [gameId, scheduleFlush, flushUpdates, applyLocal]);

  // Single entry point for coordination writes (phase transitions, ready
  // flags, clash ops). Stamps coord_version into the state blob and flushes
  // immediately — never debounced — so the opponent sees the change at once
  // and a stale debounced write can never land after it and revert it.
  //
  // `updates.state` / `updates.players` may be a plain value (old style) or
  // a function. Prefer functions: they're evaluated against the hook's own
  // freshest known value (from gameRef, synchronous, never stale), instead
  // of requiring the caller to have already cloned a value off a React
  // prop — which can lag behind by an optimistic update or two during a
  // fast sequence of actions, and since this replaces the whole clash
  // object / whole players array, writing from a stale copy can silently
  // clobber a change someone else just made.
  const updateCoordination = useCallback((updates) => {
    if (!gameId) return;
    const current = gameRef.current;
    if (!current) return;
    const view = buildStateView(current);
    const stateArg = typeof updates.state === 'function' ? updates.state(view) : updates.state;
    const playersArg = typeof updates.players === 'function' ? updates.players(current.players || []) : updates.players;
    const newState = stripZones({ ...(current.state || {}), ...(stateArg || {}), coord_version: Date.now() });
    const finalUpdates = { ...updates, state: newState };
    if ('players' in updates) finalUpdates.players = playersArg;
    applyLocal(finalUpdates);
    flushUpdates();
  }, [gameId, flushUpdates, applyLocal]);

  const updateState = useCallback((stateUpdater) => {
    if (!gameId) return;
    const current = gameRef.current;
    if (!current) return;
    const newState = stripZones(stateUpdater(current.state || {}));
    applyLocal({ state: newState });
    scheduleFlush();
  }, [gameId, scheduleFlush, applyLocal]);

  const updatePlayers = useCallback((playerUpdater) => {
    if (!gameId) return;
    const current = gameRef.current;
    if (!current) return;
    const newPlayers = playerUpdater(current.players || []);
    applyLocal({ players: newPlayers });
    // Flush immediately (not debounced) so the opponent sees resource changes
    // at once. With the debounce, the pending-players protection in the
    // subscription merge blocked the opponent's changes from merging during
    // the 300ms window, and then this flush overwrote them on the server.
    flushUpdates();
  }, [gameId, flushUpdates, applyLocal]);

  // For zone data (hands, decks, battlefields, discards, etc). The updater
  // receives the same merged view `state.<zone>` reads have always seen
  // (via buildStateView, so old and new games look identical to it), and
  // returns the mutated version of that view. Only the zone keys named in
  // `zones` are pulled out of the result and sent — everything else the
  // updater's view carried is ignored, so a move that only touches e.g.
  // ['battlefields'] never clones or transmits anyone's hands, decks,
  // discards, banished pile, etc.
  //
  // IMPORTANT for whoever writes the updater: list every zone key it
  // actually mutates in `zones`. A zone mutated but left out of that list
  // will be silently dropped — it'll look right locally (optimistic
  // update) but never reach the server, and the opponent won't see it.
  const updateZones = useCallback((stateUpdater, zones, opts) => {
    if (!gameId) return;
    const current = gameRef.current;
    if (!current) return;
    const view = buildStateView(current);
    const ns = stateUpdater(view);
    const updates = {};
    (zones || []).forEach((z) => { updates[z] = ns[z]; });
    applyLocal(updates);
    // A caller that also makes an immediately-following updateCoordination
    // call for the same user action (e.g. resolving a clash) doesn't need
    // this — that call's own flush sweeps up whatever's still queued here
    // too, landing as one combined write. Pass immediate:true for a call
    // that stands alone and shouldn't wait out the 300ms debounce.
    if (opts?.immediate) flushUpdates(); else scheduleFlush();
  }, [gameId, scheduleFlush, flushUpdates, applyLocal]);

  // Public view: `game.state` is always the merged read view (new top-level
  // zone fields overlaid on whatever's still nested for an old game), so
  // every existing `state.hands` / `state.battlefields` / etc. read
  // anywhere in the app keeps working unchanged regardless of where the
  // data actually lives.
  // Entries as they are seen in play: clan-in-play states layered on top of the
  // stored entry data (see clanStates.js).
  const gameEntries = useMemo(() => applyClanStates(entries, clanFolderIds), [entries, clanFolderIds]);

  const publicGame = useMemo(() => {
    if (!game) return game;
    return { ...game, state: buildStateView(game) };
  }, [game]);

  return { game: publicGame, entries: gameEntries, supertypes, folderEntries, folderColors, foghollowColor, loading, user, myPlayerIndex, updateGame, updateCoordination, updateState, updatePlayers, updateZones };
}