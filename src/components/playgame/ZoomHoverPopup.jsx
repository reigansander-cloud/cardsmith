import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import MiniEntry from './MiniEntry';

const CARD_BACK_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/516417bcba_ec1ad09b0_CardBack.png';
const POPUP_DELAY = 350;
const BASE_POPUP_WIDTH = 256;
const DEFAULT_SCALE = 3.5;
const MIN_SCALE = 1.5;
const MAX_SCALE = 8;

const TOKEN_COLORS = {
  damage: '#dc2626',
  armor: '#2563eb',
  charge: '#ca8a04',
  support: '#ffffff',
  other: '#28a745',
  duration: '#7c3aed',
};

// Zoom Hover: after a brief delay, shows a hovered card or battlefield at a
// large size near the cursor for easy reading. Enabled via a Tools toggle.
export const ZoomHoverContext = createContext({ hoverEnter: () => {}, hoverLeave: () => {} });

export function ZoomHoverProvider({ enabled, instant, scale, setScale, arrowDragging, selectionBoxActive, children }) {
  const [popupItem, setPopupItem] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const popupRef = useRef(null);
  const timerRef = useRef(null);
  const pendingRef = useRef(null);
  const draggingRef = useRef(false);
  const arrowDraggingRef = useRef(false);
  arrowDraggingRef.current = !!arrowDragging;
  const selBoxRef = useRef(false);
  selBoxRef.current = !!selectionBoxActive;
  const popupVisibleRef = useRef(false);
  popupVisibleRef.current = !!popupItem;
  const popupWidth = Math.round(BASE_POPUP_WIDTH * ((scale ?? DEFAULT_SCALE) / DEFAULT_SCALE));
  const delay = instant ? 0 : POPUP_DELAY;

  // Measure the rendered popup so we can place the cursor in its bottom-left
  // quadrant and keep it within the viewport.
  useLayoutEffect(() => {
    if (!popupItem || !popupRef.current) { setDims({ w: 0, h: 0 }); return; }
    const measure = () => {
      const r = popupRef.current.getBoundingClientRect();
      setDims({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(popupRef.current);
    return () => ro.disconnect();
  }, [popupItem]);

  const hoverEnter = useCallback((item, immediate = false) => {
    if (!enabled || draggingRef.current || arrowDraggingRef.current || selBoxRef.current) return;
    pendingRef.current = item;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (immediate || instant) { setPopupItem(item); return; }
    timerRef.current = setTimeout(() => { if (pendingRef.current) setPopupItem(pendingRef.current); }, delay);
  }, [enabled, instant, delay]);

  const hoverLeave = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    pendingRef.current = null;
    setPopupItem(null);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    const onMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Suppress hover popups while a card drag is in progress.
  useEffect(() => {
    const onDragStart = () => { draggingRef.current = true; if (timerRef.current) clearTimeout(timerRef.current); pendingRef.current = null; setPopupItem(null); };
    const onDragEnd = () => { draggingRef.current = false; };
    window.addEventListener('dragstart', onDragStart, true);
    window.addEventListener('dragend', onDragEnd, true);
    window.addEventListener('drop', onDragEnd, true);
    return () => {
      window.removeEventListener('dragstart', onDragStart, true);
      window.removeEventListener('dragend', onDragEnd, true);
      window.removeEventListener('drop', onDragEnd, true);
    };
  }, []);

  // Suppress hover popups while an arrow is being drawn (right-click drag).
  useEffect(() => {
    if (!arrowDragging) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;
    setPopupItem(null);
  }, [arrowDragging]);

  // Suppress hover popups while a selection box is being drawn.
  useEffect(() => {
    if (!selectionBoxActive) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;
    setPopupItem(null);
  }, [selectionBoxActive]);

  // While a popup is visible, the scroll wheel adjusts its scale (persisted
  // for the rest of the game session for this user).
  useEffect(() => {
    const onWheel = (e) => {
      if (!popupVisibleRef.current) return;
      e.preventDefault();
      const step = e.shiftKey ? 0.5 : 0.25;
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + (e.deltaY < 0 ? step : -step))));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  let popupContent = null;
  if (popupItem) {
    if (popupItem.faceDown) {
      popupContent = <img src={CARD_BACK_URL} alt="" draggable={false} style={{ width: popupWidth, borderRadius: 6 }} />;
    } else if (popupItem.entry) {
      popupContent = (
        <div className="relative">
          <MiniEntry entry={popupItem.entry} supertypes={popupItem.supertypes} targetWidth={popupWidth} influenceOverride={popupItem.influenceOverride} />
          {popupItem.tokens && (
            <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
              {Object.entries(popupItem.tokens).map(([key, val]) => {
                if (!val || val === 0) return null;
                const bg = TOKEN_COLORS[key] || '#666';
                return (
                  <div key={key} className="text-sm font-bold rounded-full w-6 h-6 flex items-center justify-center leading-none shadow" style={{ background: bg, color: bg === '#ffffff' ? '#000' : '#fff' }}>
                    {val}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    } else if (popupItem.type === 'battlefield-number') {
      popupContent = (
        <div className="flex items-center justify-center bg-card border-2 border-border rounded-lg" style={{ width: popupWidth, height: popupWidth * 0.7 }}>
          <span className="text-6xl font-bold text-foreground">{popupItem.numberValue}</span>
        </div>
      );
    }
  }

  return (
    <ZoomHoverContext.Provider value={{ hoverEnter, hoverLeave }}>
      {children}
      {popupContent && (
        <div ref={popupRef} className="fixed pointer-events-none z-50" style={{
          left: Math.max(0, Math.min(mousePos.x - dims.w * 0.36, window.innerWidth - dims.w)),
          top: Math.max(0, Math.min(mousePos.y - dims.h * 0.75, window.innerHeight - dims.h)),
        }}>
          {popupContent}
        </div>
      )}
    </ZoomHoverContext.Provider>
  );
}

export function useZoomHover() { return useContext(ZoomHoverContext); }