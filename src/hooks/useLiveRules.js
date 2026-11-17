import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import { sanitizeRulesHtml } from '@/lib/rulesSanitizer';

// Live-synced rules sections for a folder: optimistic local updates on every
// keystroke, debounced per-section API saves, and a realtime subscription so
// other users see changes. The section a user is actively editing is protected
// from being clobbered by remote updates (editing is gated by edit locks in
// the editor, not here). Follows the same pattern as useLiveEntries.
export function useLiveRules(folderId) {
  const [sections, setSections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const sectionsRef = useRef([]);
  sectionsRef.current = sections;
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;
  const pendingRef = useRef({}); // docId -> { timeout, html }
  const savedSnapshotsRef = useRef({}); // docId -> [{ content, ts }]

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await base44.entities.RulesDoc.filter({ folder_id: folderId }, 'created_date', 500);
        if (cancelled) return;
        if (list && list.length) {
          // Sanitize existing sections that have bloated/foreign HTML and
          // persist the cleaned version back to the server.
          list.forEach((doc) => {
            const cleaned = sanitizeRulesHtml(doc.content);
            if (cleaned !== doc.content) {
              doc.content = cleaned;
              base44.entities.RulesDoc.update(doc.id, { content: cleaned }).catch(() => {});
            }
          });
          setSections(list);
        } else {
          const created = await base44.entities.RulesDoc.create({ folder_id: folderId, content: '' });
          if (cancelled) return;
          setSections([created]);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [folderId]);

  const persistSection = useCallback((docId, html) => {
    const cleaned = sanitizeRulesHtml(html);
    const arr = (savedSnapshotsRef.current[docId] ||= []).filter((s) => Date.now() - s.ts < 10000);
    arr.push({ content: cleaned, ts: Date.now() });
    savedSnapshotsRef.current[docId] = arr;
    const doSave = (n) => base44.entities.RulesDoc.update(docId, { content: cleaned }).catch((err) => {
      // retry twice with backoff, then surface the real reason so the user
      // knows their edit didn't land instead of silently losing it
      if (n < 2) return new Promise((r) => setTimeout(r, 800)).then(() => doSave(n + 1));
      const reason = err?.message || err?.error || err?.details || 'network error';
      toast({ description: `Couldn't save a rules section — ${reason}. Your edit is kept here; try again in a moment.` });
    });
    return doSave(0);
  }, []);

  const updateSection = useCallback((docId, html) => {
    setSections((prev) => prev.map((s) => (s.id === docId ? { ...s, content: html } : s)));
    const existing = pendingRef.current[docId];
    if (existing && existing.timeout) clearTimeout(existing.timeout);
    const timeout = setTimeout(() => { delete pendingRef.current[docId]; persistSection(docId, html); }, 400);
    pendingRef.current[docId] = { timeout, html };
  }, [persistSection]);

  const flushSection = useCallback((docId) => {
    const p = pendingRef.current[docId];
    if (!p) return;
    clearTimeout(p.timeout);
    delete pendingRef.current[docId];
    persistSection(docId, p.html);
  }, [persistSection]);

  const addSection = useCallback(async () => {
    try {
      const created = await base44.entities.RulesDoc.create({ folder_id: folderId, content: '' });
      // Idempotent: the realtime echo for this create can land before this
      // continuation runs. Merge by id instead of duplicating.
      setSections((prev) => prev.some((s) => s.id === created.id) ? prev.map((s) => (s.id === created.id ? { ...s, ...created } : s)) : [...prev, created]);
      return created;
    } catch {}
  }, [folderId]);

  const deleteSection = useCallback(async (docId) => {
    const p = pendingRef.current[docId];
    if (p) { clearTimeout(p.timeout); delete pendingRef.current[docId]; }
    setSections((prev) => prev.filter((s) => s.id !== docId));
    if (selectedIdRef.current === docId) setSelectedId(null);
    try { await base44.entities.RulesDoc.delete(docId); } catch {}
  }, []);

  const selectSection = useCallback((docId) => setSelectedId(docId), []);
  const deselect = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    const unsub = base44.entities.RulesDoc.subscribe((event) => {
      const d = event.data;
      if (!d || d.folder_id !== folderId) return;
      if (event.type === 'delete') { setSections((prev) => prev.filter((s) => s.id !== event.id)); return; }
      // suppress echoes of our own writes
      const snaps = savedSnapshotsRef.current[event.id];
      if (snaps && snaps.length) {
        const idx = snaps.findIndex((s) => s.content === d.content);
        if (idx >= 0) { snaps.splice(idx, 1); return; }
      }
      // don't clobber the section this user is actively editing
      if (selectedIdRef.current === event.id) return;
      setSections((p) => (
        p.some((s) => s.id === event.id)
          ? p.map((s) => (s.id === event.id ? { ...s, ...d } : s))
          : [...p, d]
      ));
    });
    return unsub;
  }, [folderId]);

  const flushAll = useCallback(() => {
    Object.entries(pendingRef.current).forEach(([docId, p]) => {
      clearTimeout(p.timeout);
      delete pendingRef.current[docId];
      persistSection(docId, p.html);
    });
  }, [persistSection]);

  // flush any pending debounced saves on unmount
  useEffect(() => () => flushAll(), [flushAll]);

  // Flush pending saves the moment the page is hidden or unloaded. React's
  // unmount cleanup may not run (or its in-flight request may not finish) when
  // the tab is closed or the user navigates away, so we also flush on
  // pagehide / visibilitychange to give each save the best chance to land
  // before the page tears down.
  useEffect(() => {
    const handler = () => flushAll();
    const onVis = () => { if (document.visibilityState === 'hidden') flushAll(); };
    window.addEventListener('pagehide', handler);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', handler);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [flushAll]);

  return { sections, selectedId, selectSection, deselect, updateSection, flushSection, addSection, deleteSection };
}