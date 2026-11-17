import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { registerDragCleanup } from '@/utils/dragClipboardSafety';
import MiniEntry from '@/components/playgame/MiniEntry';

const DROP_ZONE_ATTR = 'data-drop-zone';
const PointerDragContext = createContext(null);

// zoneKey -> { onDrop }. The DOM attribute only ever holds the opaque key;
// the real dropTarget object + handler live here, captured as a closure at
// the exact call site that already defines the dropTarget today.
const dropZoneRegistry = new Map();
let zoneCounter = 0;

// Movement (px) before a pointer-down is promoted to an active drag. Below
// this a press+release is treated as a click, so card select / double-click /
// right-click keep working exactly as before.
const DRAG_THRESHOLD = 5;

/** Register an element as a drop target. `onDrop(payload)` receives the exact
 *  same payload object the drag was started with. Re-registers on every render
 *  so it never closes over stale props. Pass null/undefined to opt out (the
 *  element then carries no drop-zone attribute and registers nothing). */
export function useDropZone(onDrop) {
  const keyRef = useRef(null);
  if (keyRef.current === null) keyRef.current = `dz-${++zoneCounter}`;
  useEffect(() => {
    if (!onDrop) return;
    dropZoneRegistry.set(keyRef.current, { onDrop });
    return () => dropZoneRegistry.delete(keyRef.current);
  });
  return onDrop ? { [DROP_ZONE_ATTR]: keyRef.current } : {};
}

export function PointerDragProvider({ children, entries, supertypes }) {
  const [dragState, setDragState] = useState(null); // { payload, x, y } while dragging, else null
  const dragRef = useRef(null);

  const endDrag = useCallback((dropped, dropZoneEl) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragState(null);
    document.body.style.userSelect = '';
    if (dropped && drag && drag.active && dropZoneEl) {
      const zone = dropZoneRegistry.get(dropZoneEl.getAttribute(DROP_ZONE_ATTR));
      if (zone) zone.onDrop(drag.payload);
    } else if (drag && drag.onCancel) {
      drag.onCancel(drag.payload);
    }
  }, []);

  useEffect(() => {
    function onMove(e) {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.active) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
        drag.active = true;
        document.body.style.userSelect = 'none';
      }
      setDragState({ payload: drag.payload, x: e.clientX, y: e.clientY });
    }
    function onUp(e) {
      const drag = dragRef.current;
      if (!drag) return;
      const el = drag.active ? document.elementFromPoint(e.clientX, e.clientY) : null;
      const zoneEl = el ? el.closest(`[${DROP_ZONE_ATTR}]`) : null;
      endDrag(!!zoneEl, zoneEl);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [endDrag]);

  /** payload = the exact same object each makeXDragStart already builds.
   *  Only the primary pointer button starts a drag; onCancel fires if the
   *  drag ends over no registered drop zone. */
  const startDrag = useCallback((e, payload, { onCancel } = {}) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragRef.current = { payload, onCancel, startX: e.clientX, startY: e.clientY, active: false };
    const unregister = registerDragCleanup(() => {
      dragRef.current = null;
      setDragState(null);
      document.body.style.userSelect = '';
    });
    window.addEventListener('pointerup', () => unregister(), { once: true });
  }, []);

  return (
    <PointerDragContext.Provider value={{ dragState, startDrag }}>
      {children}
      {dragState && (
        <div style={{ position: 'fixed', left: dragState.x, top: dragState.y, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 9999, opacity: 0.85, display: 'flex' }}>
          {(() => {
            const p = dragState.payload;
            const groupIds = p.group_card_ids?.length > 1 ? p.group_card_ids : null;
            const entryIds = groupIds ? groupIds.map(() => p.card?.entry_id ?? p.entry_id) : [p.card?.entry_id ?? p.entry_id];
            return entryIds.slice(0, 4).map((eid, i) => (
              <div key={i} style={{ marginLeft: i > 0 ? -24 : 0 }}>
                <MiniEntry entry={entries?.[eid]} supertypes={supertypes} targetWidth={80} />
              </div>
            ));
          })()}
        </div>
      )}
    </PointerDragContext.Provider>
  );
}

export function usePointerDrag() {
  const ctx = useContext(PointerDragContext);
  if (!ctx) throw new Error('usePointerDrag must be used inside PointerDragProvider');
  return ctx;
}