// Keeps one browser's copy of a Play Clans Game in sync with everyone else's.
// Used by useGame (the React side just mirrors `current` into state).
//
// How a move travels now:
//   1. apply() changes our copy at once (optimistic) and notes exactly which
//      fields / per-player slots changed.
//   2. ~40 ms later (one write per burst) flush() stamps those with versions
//      and sends them. The client sends the change straight to the other
//      players over Realtime AND saves it; neither waits for the other.
//   3. Other browsers merge it slot by slot, newest version wins. The
//      database applies the same rule, so everybody converges on the same
//      board, including after a reload.
//   4. A resync (every 5 s, and on tab focus / reconnect) re-reads the saved
//      record in case a live message was missed. Merging is idempotent.
//
// Plain JS with no React and no import.meta, so it can be tested under Node.

import { stampPatch, mergeVersioned, diffIndices, unionDirty, isMetaKey } from './versionedMerge.js';

export function createGameSync({ gameId, base44, onChange, onLoaded, debounceMs = 40, pollMs = 5000 }) {
  let game = null;
  let pending = {};   // changed here, not yet sent
  let dirty = {};     // field -> true | 'all' | Set(changed slots)
  let timer = null;
  let retries = 0;
  let stopped = false;
  let unsub = null;
  let poll = null;
  const clientId = Math.random().toString(36).slice(2);
  const Game = base44.entities.Game;

  function commit(next) {
    if (next === game) return;
    game = next;
    onChange?.(next);
  }

  function queue(before, updates) {
    for (const k of Object.keys(updates)) {
      const d = Array.isArray(updates[k]) ? diffIndices(before?.[k], updates[k]) : true;
      dirty[k] = unionDirty(dirty[k], d);
    }
    pending = { ...pending, ...updates };
  }

  // Apply a local change (top-level fields) to our copy and queue it.
  function apply(updates) {
    const before = game;
    if (before) commit({ ...before, ...updates });
    queue(before, updates);
  }

  const protect = (k) => {
    if (!(k in pending)) return null;
    const d = dirty[k];
    return d instanceof Set ? d : 'all';
  };
  // Someone restructured a list we have unsent slot edits in: keep ours and
  // send the whole list, so everyone ends up with the same copy.
  const escalate = (k) => { dirty[k] = 'all'; };

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (Object.keys(pending).length === 0) return Promise.resolve();
    // Send the fields' CURRENT values, not the copies captured when queued:
    // other players' moves may have been merged into other slots of the same
    // list since, and those must go out with their own versions.
    const updates = {};
    for (const k of Object.keys(pending)) updates[k] = game && k in game ? game[k] : pending[k];
    const d = dirty;
    pending = {};
    dirty = {};
    const stamped = stampPatch(updates, game, d);
    // Remember the new versions locally right away, so an older copy that
    // arrives while this write is on its way can't undo it.
    const versionKeys = {};
    for (const k of Object.keys(stamped)) if (isMetaKey(k)) versionKeys[k] = stamped[k];
    if (game) commit({ ...game, ...versionKeys });

    return Game.update(gameId, { ...stamped, last_update_client_id: clientId }).then(() => {
      retries = 0;
    }).catch((err) => {
      console.error('[Game.update failed]', err?.message || err);
      if (stopped) return;
      // Re-queue (unless changed again since) to be sent with a fresh version.
      for (const k of Object.keys(updates)) {
        if (!(k in pending)) {
          pending[k] = game && k in game ? game[k] : updates[k];
          dirty[k] = unionDirty(dirty[k], d[k]);
        }
      }
      retries += 1;
      if (retries > 6) {
        console.error('[Game.update] giving up on this change after 6 retries; the resync will catch up');
        retries = 0;
        return;
      }
      const delay = Math.min(300 * (2 ** (retries - 1)), 10000) + Math.random() * 300;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; flush(); }, delay);
    });
  }

  function scheduleFlush() {
    if (timer || stopped) return;
    timer = setTimeout(() => { timer = null; flush(); }, debounceMs);
  }

  function mergeIncoming(data) {
    if (!data || stopped) return;
    commit(mergeVersioned(game, data, protect, escalate));
    if (Object.values(dirty).includes('all') && Object.keys(pending).length) scheduleFlush();
  }

  function resync() {
    if (stopped) return Promise.resolve();
    return Game.get(gameId).then(mergeIncoming).catch(() => {});
  }

  const onVisible = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') resync(); };
  const onPageHide = () => { flush(); };

  function start() {
    Game.get(gameId)
      .then((g) => { mergeIncoming(g); onLoaded?.(g); })
      .catch(() => { onLoaded?.(null); });
    unsub = Game.subscribe((event) => {
      if (event.id !== gameId || event.type === 'delete' || !event.data) return;
      if (event.data.last_update_client_id === clientId) return; // our own write echoing back
      mergeIncoming(event.data);
    });
    if (pollMs) poll = setInterval(resync, pollMs);
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', resync);
      window.addEventListener('focus', resync);
      window.addEventListener('pagehide', onPageHide);
    }
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', onVisible);
  }

  function stop() {
    flush();
    stopped = true;
    if (timer) clearTimeout(timer);
    if (poll) clearInterval(poll);
    unsub?.();
    if (typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('online', resync);
      window.removeEventListener('focus', resync);
      window.removeEventListener('pagehide', onPageHide);
    }
    if (typeof document !== 'undefined' && document.removeEventListener) document.removeEventListener('visibilitychange', onVisible);
  }

  return {
    get current() { return game; },
    get hasPending() { return Object.keys(pending).length > 0; },
    clientId, apply, flush, scheduleFlush, mergeIncoming, resync, start, stop,
  };
}
