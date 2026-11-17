import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const EDITABLE_FIELDS = ['name', 'cost', 'cost_icons', 'influence', 'ability', 'subtype', 'supertype', 'token_type', 'stats', 'fabled', 'basic', 'needs_review', 'income_symbol', 'bonus_mode', 'bonus_cost_icons', 'bonus_ability'];

function pickEditable(e) {
  const out = {};
  EDITABLE_FIELDS.forEach((f) => { out[f] = e[f]; });
  return out;
}

function entryEqual(a, b) {
  if (!a || !b) return false;
  return EDITABLE_FIELDS.every((f) => JSON.stringify(a[f]) === JSON.stringify(b[f]));
}

// Live-synced review entries: all entries flagged for review across all
// folders. Same debounced-save / realtime-sync / echo-suppression pattern as
// useLiveEntries, but cross-folder and filtered by needs_review. When an entry
// is unflagged (needs_review set to false) it is removed from the list.
export function useLiveReviewEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const entriesRef = useRef([]);
  entriesRef.current = entries;
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;
  const pendingRef = useRef({}); // entryId -> { timeout, fields }
  const savedSnapshotsRef = useRef({}); // entryId -> [{ ...editableFields, ts }]

  const reload = useCallback(async () => {
    try {
      const list = await base44.entities.CardEntry.filter({ needs_review: true }, '-created_date', 500);
      setEntries(list || []);
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  const persistEntry = useCallback((entryId, fields) => {
    const local = entriesRef.current.find((e) => e.id === entryId);
    const snapshot = pickEditable({ ...(local || {}), ...fields });
    const arr = (savedSnapshotsRef.current[entryId] ||= []).filter((s) => Date.now() - s.ts < 10000);
    arr.push({ ...snapshot, ts: Date.now() });
    savedSnapshotsRef.current[entryId] = arr;
    return base44.entities.CardEntry.update(entryId, fields).catch(() => {});
  }, []);

  const updateEntry = useCallback((entryId, fields) => {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...fields } : e)));
    const existing = pendingRef.current[entryId] || { fields: {} };
    const merged = { ...existing.fields, ...fields };
    if (existing.timeout) clearTimeout(existing.timeout);
    const timeout = setTimeout(() => {
      delete pendingRef.current[entryId];
      persistEntry(entryId, merged);
    }, 400);
    pendingRef.current[entryId] = { timeout, fields: merged };
  }, [persistEntry]);

  const flushEntry = useCallback((entryId) => {
    const p = pendingRef.current[entryId];
    if (!p) return;
    clearTimeout(p.timeout);
    delete pendingRef.current[entryId];
    persistEntry(entryId, p.fields);
  }, [persistEntry]);

  const toggleReview = useCallback(async (entry) => {
    const next = !entry.needs_review;
    const fields = { needs_review: next };
    if (next) {
      fields.flagged_by_id = user?.id || '';
      fields.flagged_by_name = user?.full_name || user?.email || 'Anonymous';
    } else {
      fields.flagged_by_id = '';
      fields.flagged_by_name = '';
    }
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...fields } : e)));
    try {
      await persistEntry(entry.id, fields);
      if (!next) {
        await base44.entities.EntryComment.deleteMany({ entry_id: entry.id });
        setSelectedId(null);
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      }
    } catch {}
  }, [persistEntry, user]);

  const selectEntry = useCallback((entry) => setSelectedId(entry.id), []);
  const deselect = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    const unsub = base44.entities.CardEntry.subscribe((event) => {
      const d = event.data;
      if (!d) return;
      if (event.type === 'delete') {
        setEntries((prev) => prev.filter((e) => e.id !== event.id));
        return;
      }
      // Only handle entries that are flagged for review
      if (!d.needs_review) {
        setEntries((prev) => prev.filter((e) => e.id !== event.id));
        return;
      }
      // suppress echoes of our own writes
      const snaps = savedSnapshotsRef.current[event.id];
      if (snaps && snaps.length) {
        const idx = snaps.findIndex((s) => entryEqual(s, d));
        if (idx >= 0) { snaps.splice(idx, 1); return; }
      }
      // don't clobber the entry this user is actively editing
      if (selectedIdRef.current === event.id) return;
      setEntries((p) => (
        p.some((e) => e.id === event.id)
          ? p.map((e) => (e.id === event.id ? { ...e, ...d } : e))
          : [d, ...p]
      ));
    });
    return unsub;
  }, []);

  // flush any pending debounced saves on unmount
  useEffect(() => () => {
    Object.entries(pendingRef.current).forEach(([entryId, p]) => {
      clearTimeout(p.timeout);
      persistEntry(entryId, p.fields);
    });
    pendingRef.current = {};
  }, [persistEntry]);

  return { entries, selectedId, selectEntry, deselect, updateEntry, flushEntry, toggleReview, reload, loading };
}