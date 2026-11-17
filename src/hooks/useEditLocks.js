import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const STALE_MS = 60000;
const REFRESH_MS = 20000;

// Presence-based edit locking for a folder. While a user is actively editing
// an item (entry, rules section, or the folder name) they hold a lock that
// prevents other users from editing the same item. Locks refresh while held
// and expire (are ignored) if not refreshed within STALE_MS.
//
// Acquire is async (a server create), so a release can arrive while the
// create is still in flight — e.g. when a user clicks from one item to
// another quickly. We track those pending acquires and, if a release came in
// before the create resolved, delete the just-created lock immediately so it
// doesn't linger as an orphan that blocks other users.
export function useEditLocks(folderId, onLostLock) {
  const [locks, setLocks] = useState({}); // itemId -> { userId, userName, ts, lockId }
  const [me, setMe] = useState(null);
  const locksRef = useRef({});
  locksRef.current = locks;
  const meRef = useRef(null);
  meRef.current = me;
  const myLocksRef = useRef({}); // itemId -> { lockId, ts, interval }
  const pendingRef = useRef(new Set()); // itemIds with an in-flight create
  const releaseAfterCreateRef = useRef(new Set()); // itemIds to delete once their create resolves
  const onLostLockRef = useRef(onLostLock);
  onLostLockRef.current = onLostLock;

  useEffect(() => { base44.auth.me().then(setMe).catch(() => {}); }, []);

  // load existing locks for this folder
  useEffect(() => {
    (async () => {
      try {
        const list = folderId
          ? await base44.entities.EditLock.filter({ folder_id: folderId }, '-created_date', 500)
          : await base44.entities.EditLock.list('-created_date', 500);
        const now = Date.now();
        const map = {};
        (list || []).forEach((l) => {
          if (now - new Date(l.ts).getTime() > STALE_MS) return; // ignore stale
          map[l.item_id] = { userId: l.user_id, userName: l.user_name, ts: l.ts, lockId: l.id };
        });
        setLocks(map);
      } catch {}
    })();
  }, [folderId]);

  const isLockedByOther = useCallback((itemId) => {
    const l = locksRef.current[itemId];
    if (!l) return null;
    if (meRef.current && l.userId === meRef.current.id) return null;
    if (Date.now() - new Date(l.ts).getTime() > STALE_MS) return null;
    return l;
  }, []);

  const release = useCallback((itemType, itemId) => {
    const my = myLocksRef.current[itemId];
    if (my) {
      clearInterval(my.interval);
      delete myLocksRef.current[itemId];
      base44.entities.EditLock.delete(my.lockId).catch(() => {});
    } else if (pendingRef.current.has(itemId)) {
      // acquire still in flight — delete the lock as soon as it lands
      releaseAfterCreateRef.current.add(itemId);
    }
  }, []);

  const acquire = useCallback(async (itemType, itemId, lockFolderId, context, meta) => {
    const fId = lockFolderId || folderId;
    if (!meRef.current) return false;
    const existing = locksRef.current[itemId];
    if (existing && existing.userId !== meRef.current.id && (Date.now() - new Date(existing.ts).getTime() < STALE_MS)) return false;
    if (myLocksRef.current[itemId]) return true; // already holding it
    // a user only ever holds one lock at a time — release everything else first
    Object.keys(myLocksRef.current).forEach((other) => { if (other !== itemId) release(itemType, other); });
    pendingRef.current.forEach((other) => { if (other !== itemId) releaseAfterCreateRef.current.add(other); });
    const ts = new Date().toISOString();
    pendingRef.current.add(itemId);
    let lock;
    try {
      lock = await base44.entities.EditLock.create({
        item_type: itemType, item_id: itemId, folder_id: fId,
        user_id: meRef.current.id, user_name: meRef.current.full_name || meRef.current.email || 'Someone', ts,
        context: context || 'folder',
        supertype: meta?.supertype || '',
        entry_name: meta?.entry_name || '',
      });
    } catch {
      pendingRef.current.delete(itemId);
      return false;
    }
    pendingRef.current.delete(itemId);
    // a release arrived while we were creating — drop the lock right away
    if (releaseAfterCreateRef.current.has(itemId)) {
      releaseAfterCreateRef.current.delete(itemId);
      base44.entities.EditLock.delete(lock.id).catch(() => {});
      return false;
    }
    const interval = setInterval(() => {
      const my = myLocksRef.current[itemId];
      if (!my) return;
      base44.entities.EditLock.update(my.lockId, { ts: new Date().toISOString() }).catch(() => {});
    }, REFRESH_MS);
    myLocksRef.current[itemId] = { lockId: lock.id, ts, interval };
    return true;
  }, [folderId]);

  // realtime lock updates
  useEffect(() => {
    const unsub = base44.entities.EditLock.subscribe((event) => {
      const d = event.data;
      if (!d || (folderId && d.folder_id !== folderId)) return;
      if (event.type === 'delete') {
        setLocks((prev) => {
          const n = { ...prev };
          for (const k in n) if (n[k].lockId === event.id) delete n[k];
          return n;
        });
        return;
      }
      setLocks((prev) => ({ ...prev, [d.item_id]: { userId: d.user_id, userName: d.user_name, ts: d.ts, lockId: d.id } }));
      // conflict resolution: another user locked an item I'm holding
      const my = myLocksRef.current[d.item_id];
      if (my && meRef.current && d.user_id !== meRef.current.id) {
        const myTs = new Date(my.ts).getTime();
        const theirTs = new Date(d.ts).getTime();
        if (theirTs < myTs || (theirTs === myTs && d.id < my.lockId)) {
          release(d.item_type, d.item_id);
          onLostLockRef.current?.(d.item_id, d.user_name);
        }
      }
    });
    return unsub;
  }, [folderId, release]);

  // release all my locks on unmount
  useEffect(() => () => {
    Object.entries(myLocksRef.current).forEach(([itemId, my]) => {
      clearInterval(my.interval);
      base44.entities.EditLock.delete(my.lockId).catch(() => {});
    });
    myLocksRef.current = {};
    pendingRef.current.clear();
    releaseAfterCreateRef.current.clear();
  }, []);

  return { locks, isLockedByOther, acquire, release, me };
}