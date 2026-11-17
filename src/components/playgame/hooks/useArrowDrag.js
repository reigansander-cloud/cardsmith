import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { clone, findArrowEl } from '../gameUtils';

// Manages arrow drag state, global arrow drag listeners, and the rAF-throttled
// computation of arrow SVG paths from card positions.
//
// The drag is driven by REFS (arrowDragRef / arrowDragMovedRef / arrowStartPosRef)
// and global listeners attached ONCE on mount, rather than React state gated
// behind an async effect. This makes the mouseup handler immune to other
// capture-phase listeners — notably the drag-safety net in main.jsx, whose
// capture-phase mouseup fires forceResetAllDrags BEFORE this hook's bubble
// mouseup and used to clear the drag state mid-event, so arrows never attached.
// We also do NOT register a cleanup with the safety net, so it has nothing to
// tear down for arrow drags; blur/visibility aborts are handled locally.
export function useArrowDrag({ state, updateZones, setSelection, setGroup, group, onDragEngaged }) {
  const [arrowDrag, setArrowDrag] = useState(null); // for overlay rendering only
  const [arrowMousePos, setArrowMousePos] = useState(null);
  const [arrowPaths, setArrowPaths] = useState([]);
  const arrowDragRef = useRef(null);
  const arrowDragMovedRef = useRef(false);
  const arrowStartPosRef = useRef(null);
  const onDragEngagedRef = useRef(onDragEngaged);
  onDragEngagedRef.current = onDragEngaged;
  const updateZonesRef = useRef(updateZones);
  updateZonesRef.current = updateZones;
  const rafRef = useRef(null);
  const arrowsRef = useRef(state.arrows || []);
  arrowsRef.current = state.arrows || [];

  // Position-changed flag: cheap signature of card IDs in position-affecting zones.
  // Only changes when cards are added/removed/reordered — not when tokens/influence change.
  const positionKey = useMemo(() => {
    const parts = [];
    for (let i = 0; i < 2; i++) {
      parts.push((state.hands?.[i] || []).map((c) => c.id).join(','));
      parts.push((state.rearguards?.[i] || []).map((c) => c.id).join(','));
      parts.push((state.side_cards?.[i] || []).map((c) => c.id).join(','));
      parts.push((state.discards?.[i] || []).map((c) => c.id).join(','));
    }
    for (const bf of (state.battlefields || [])) {
      parts.push((bf.sides?.[0] || []).map((c) => c.id).join(','));
      parts.push((bf.sides?.[1] || []).map((c) => c.id).join(','));
    }
    return parts.join('|');
  }, [state]);

  // Throttled arrow path computation — runs at most once per frame via rAF.
  useLayoutEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const paths = [];
      for (const arrow of (arrowsRef.current || [])) {
        const fromEl = findArrowEl(arrow.from);
        const toEl = findArrowEl(arrow.to);
        if (!fromEl || !toEl) continue;
        const fr = fromEl.getBoundingClientRect();
        const tr = toEl.getBoundingClientRect();
        const x1 = fr.left + fr.width / 2, y1 = fr.top + fr.height / 2;
        const x2 = tr.left + tr.width / 2, y2 = tr.top + tr.height / 2;
        const mx = (x1 + x2) / 2 + (y2 - y1) * 0.3, my = (y1 + y2) / 2 - (x2 - x1) * 0.3;
        paths.push({ id: arrow.id, d: `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}` });
      }
      setArrowPaths(paths);
    });
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [state.arrows, positionKey]);

  // Global arrow drag listeners — attached once on mount, read from refs.
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      const drag = arrowDragRef.current;
      if (!drag) return;
      if (!arrowDragMovedRef.current) {
        const start = arrowStartPosRef.current;
        if (start) {
          const dx = e.clientX - start.x, dy = e.clientY - start.y;
          if (dx * dx + dy * dy < 36) return; // ~6px threshold before arrow drag engages
        }
        arrowDragMovedRef.current = true;
        onDragEngagedRef.current?.();
      }
      setArrowMousePos({ x: e.clientX, y: e.clientY });
    };
    // Suppress the native context menu while an arrow drag is in progress so
    // the right-button release doesn't pop the browser menu over the target.
    const handleGlobalContextMenu = (e) => { if (arrowDragMovedRef.current) e.preventDefault(); };
    const handleGlobalMouseUp = (e) => {
      const drag = arrowDragRef.current;
      if (drag && arrowDragMovedRef.current) {
        // elementFromPoint is trustworthy during a drag; e.target is not
        // (overlays / pointer capture can redirect it).
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const cardEl = el && el.closest('[data-card-id]');
        const bfEl = el && el.closest('[data-bf-id]');
        let toId = null;
        if (cardEl) toId = `card:${cardEl.dataset.cardId}`;
        else if (bfEl) toId = `bf:${bfEl.dataset.bfId}`;
        if (toId && !drag.fromIds.includes(toId)) {
          updateZonesRef.current((s) => { const ns = clone(s); const newArrows = drag.fromIds.map((fromId) => ({ id: `arrow_${Date.now()}_${Math.random()}`, from: fromId, to: toId })); ns.arrows = [...(ns.arrows || []), ...newArrows]; return ns; }, ['arrows']);
        }
      }
      // Clear drag state but leave arrowDragMovedRef set so the contextmenu
      // event that follows right-button release sees wasDrag()===true and
      // skips the token popup. It resets on the next startArrowDrag.
      arrowDragRef.current = null;
      arrowStartPosRef.current = null;
      setArrowDrag(null);
      setArrowMousePos(null);
    };
    const handleAbort = () => {
      arrowDragRef.current = null;
      arrowDragMovedRef.current = false;
      arrowStartPosRef.current = null;
      setArrowDrag(null);
      setArrowMousePos(null);
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('contextmenu', handleGlobalContextMenu, true);
    window.addEventListener('blur', handleAbort);
    document.addEventListener('visibilitychange', handleAbort);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('contextmenu', handleGlobalContextMenu, true);
      window.removeEventListener('blur', handleAbort);
      document.removeEventListener('visibilitychange', handleAbort);
    };
  }, []);

  const clearArrows = useCallback(() => {
    if (!(state.arrows || []).length) return;
    updateZones((s) => { const ns = clone(s); ns.arrows = []; return ns; }, ['arrows']);
  }, [state.arrows, updateZones]);

  const startArrowDrag = useCallback((e, cardId) => {
    const isGroup = group.length > 1 && group.includes(cardId);
    const fromIds = isGroup ? group.map((id) => `card:${id}`) : [`card:${cardId}`];
    arrowDragRef.current = { fromIds, cardId };
    arrowDragMovedRef.current = false;
    arrowStartPosRef.current = { x: e.clientX, y: e.clientY };
    setArrowDrag({ fromIds, cardId });
    setArrowMousePos({ x: e.clientX, y: e.clientY });
  }, [group]);

  const startBfArrowDrag = useCallback((e, bfId) => {
    arrowDragRef.current = { fromIds: [`bf:${bfId}`] };
    arrowDragMovedRef.current = false;
    arrowStartPosRef.current = { x: e.clientX, y: e.clientY };
    setArrowDrag({ fromIds: [`bf:${bfId}`] });
    setArrowMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  return { arrowDrag, arrowMousePos, arrowPaths, clearArrows, startArrowDrag, startBfArrowDrag, findArrowEl, arrowDragMovedRef };
}