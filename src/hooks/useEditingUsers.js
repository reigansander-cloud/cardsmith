import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const STALE_MS = 60000;

// Subscribes to all edit locks across every folder and returns the currently
// active editors (locks refreshed within STALE_MS). Each entry carries the
// folder id, item type, and item id so the UI can render a jump-to link.
export function useEditingUsers() {
  const [editors, setEditors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await base44.entities.EditLock.list('-created_date', 500);
        if (cancelled) return;
        setEditors((list || []).map((l) => ({
          lockId: l.id, userId: l.user_id, userName: l.user_name,
          itemId: l.item_id, itemType: l.item_type, folderId: l.folder_id, ts: l.ts,
          context: l.context || 'folder',
          supertype: l.supertype || '',
          entryName: l.entry_name || '',
        })));
      } catch {}
    })();
    const unsub = base44.entities.EditLock.subscribe((event) => {
      const d = event.data;
      if (!d) return;
      if (event.type === 'delete') {
        setEditors((prev) => prev.filter((e) => e.lockId !== event.id));
        return;
      }
      setEditors((prev) => {
        const next = prev.filter((e) => e.lockId !== d.id);
        next.push({
          lockId: d.id, userId: d.user_id, userName: d.user_name,
          itemId: d.item_id, itemType: d.item_type, folderId: d.folder_id, ts: d.ts,
          context: d.context || 'folder',
          supertype: d.supertype || '',
          entryName: d.entry_name || '',
        });
        return next;
      });
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  const now = Date.now();
  return editors.filter((e) => now - new Date(e.ts).getTime() < STALE_MS);
}