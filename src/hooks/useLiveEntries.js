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

// Live-synced card entries for a folder: optimistic local updates on every
// keystroke, debounced per-entry API saves, and a realtime subscription so
// other users see changes. The entry a user is actively editing is protected
// from being clobbered by remote updates (editing is gated by edit locks in
// the page, not here).
export function useLiveEntries(folderId) {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const entriesRef = useRef([]);
  entriesRef.current = entries;
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;
  const pendingRef = useRef({}); // entryId -> { timeout, fields }
  const savedSnapshotsRef = useRef({}); // entryId -> [{ ...editableFields, ts }]

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.CardEntry.filter({ folder_id: folderId }, 'cost', 500);
        setEntries(list || []);
      } catch {}
    })();
  }, [folderId]);

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

  const createEntry = useCallback(async (supertype, tokenType, templateType) => {
    const base = {
      folder_id: folderId, cost: 0, influence: '', ability: '', subtype: '',
      supertype, token_type: tokenType, stats: [], fabled: false, basic: false, needs_review: false,
      income_symbol: '', bonus_mode: 'cost', bonus_cost_icons: [], bonus_ability: '',
    };
    base.name = templateType === 'income' ? String(Math.floor(Math.random() * 99999) + 1) : '';
    const entry = await base44.entities.CardEntry.create(base);
    // Idempotent: the realtime echo for this create can land before this
    // continuation runs (the subscription updater prepends when the id isn't
    // found). A blind prepend here would then stack a second copy on top of
    // the realtime one, so merge by id instead of duplicating.
    setEntries((prev) => prev.some((e) => e.id === entry.id) ? prev.map((e) => (e.id === entry.id ? { ...e, ...entry } : e)) : [entry, ...prev]);
    setSelectedId(entry.id);
    return entry;
  }, [folderId]);

  const duplicateEntry = useCallback(async (entry, templateType) => {
    const copy = await base44.entities.CardEntry.create({
      folder_id: folderId,
      name: templateType === 'income' ? String(Math.floor(Math.random() * 99999) + 1) : entry.name,
      cost: entry.cost,
      cost_icons: entry.cost_icons,
      influence: entry.influence,
      ability: entry.ability,
      subtype: entry.subtype,
      supertype: entry.supertype,
      token_type: entry.token_type,
      stats: entry.stats,
      fabled: entry.fabled,
      basic: entry.basic,
      needs_review: entry.needs_review,
      income_symbol: entry.income_symbol,
      bonus_mode: entry.bonus_mode,
      bonus_cost_icons: entry.bonus_cost_icons,
      bonus_ability: entry.bonus_ability,
    });
    setEntries((prev) => {
      if (prev.some((e) => e.id === copy.id)) return prev; // realtime echo already landed
      const idx = prev.findIndex((e) => e.id === entry.id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    return copy;
  }, [folderId]);

  const bulkCreateEntries = useCallback(async (entriesData) => {
    const created = await base44.entities.CardEntry.bulkCreate(entriesData);
    setEntries((prev) => {
      const ids = new Set((created || []).map((c) => c.id));
      const merged = (created || []).map((c) => c);
      return [...merged, ...prev.filter((e) => !ids.has(e.id))];
    });
    return created;
  }, []);

  const deleteEntry = useCallback(async (entryId) => {
    const p = pendingRef.current[entryId];
    if (p) { clearTimeout(p.timeout); delete pendingRef.current[entryId]; }
    const entry = entriesRef.current.find((e) => e.id === entryId);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (selectedIdRef.current === entryId) setSelectedId(null);
    try {
      if (entry) {
        await base44.entities.DeletedEntry.create({
          folder_id: entry.folder_id, name: entry.name, cost: entry.cost, cost_icons: entry.cost_icons,
          influence: entry.influence, ability: entry.ability, subtype: entry.subtype, supertype: entry.supertype,
          token_type: entry.token_type, stats: entry.stats, fabled: entry.fabled, basic: entry.basic, needs_review: entry.needs_review,
          income_symbol: entry.income_symbol, bonus_mode: entry.bonus_mode, bonus_cost_icons: entry.bonus_cost_icons, bonus_ability: entry.bonus_ability,
        });
      }
      await base44.entities.CardEntry.delete(entryId);
      // keep only the 15 most recently deleted entries
      const all = await base44.entities.DeletedEntry.list('-created_date', 100);
      const extras = (all || []).slice(15);
      if (extras.length) await base44.entities.DeletedEntry.deleteMany({ id: { $in: extras.map((e) => e.id) } });
    } catch {}
  }, []);

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
      if (!next) { await base44.entities.EntryComment.deleteMany({ entry_id: entry.id }); }
    } catch {}
  }, [persistEntry, user]);

  const flushEntry = useCallback((entryId) => {
    const p = pendingRef.current[entryId];
    if (!p) return;
    clearTimeout(p.timeout);
    delete pendingRef.current[entryId];
    persistEntry(entryId, p.fields);
  }, [persistEntry]);

  const selectEntry = useCallback((entry) => setSelectedId(entry.id), []);
  const deselect = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    const unsub = base44.entities.CardEntry.subscribe((event) => {
      const d = event.data;
      if (!d || d.folder_id !== folderId) return;
      if (event.type === 'delete') {
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
      // Check for an existing entry inside the updater itself, not against a
      // ref that only catches up after the next render. Otherwise a
      // just-created entry's own realtime echo can race the optimistic add
      // above and get appended a second time, producing two list items with
      // the same id/React key — which is why new entries sometimes appeared
      // twice, and sometimes failed to render at all.
      setEntries((p) => (
        p.some((e) => e.id === event.id)
          ? p.map((e) => (e.id === event.id ? { ...e, ...d } : e))
          : [d, ...p]
      ));
    });
    return unsub;
  }, [folderId]);

  // flush any pending debounced saves on unmount
  useEffect(() => () => {
    Object.entries(pendingRef.current).forEach(([entryId, p]) => {
      clearTimeout(p.timeout);
      persistEntry(entryId, p.fields);
    });
    pendingRef.current = {};
  }, [persistEntry]);

  return { entries, selectedId, selectEntry, deselect, updateEntry, flushEntry, createEntry, duplicateEntry, bulkCreateEntries, deleteEntry, toggleReview };
}