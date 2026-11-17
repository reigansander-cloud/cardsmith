import { useRef, useState, useLayoutEffect } from 'react';

// Measures a container and computes a card width that shrinks to fit a single
// row. The card WIDTH comes from a formula (so cards shrink smoothly as the
// row fills), but whether the section SCROLLS (`wraps`) is decided by measuring
// the real laid-out content: if scrollHeight exceeds clientHeight, cards
// actually wrapped and the section needs vertical scroll. This is robust to
// attachment offsets, exhausted rotation, stacking, and any other margin the
// formula can't predict.
// Hysteresis (turn on eagerly, turn off only with margin) prevents
// oscillation at the fit boundary, since enabling scroll adds a scrollbar that
// narrows the row and feeds back into cardWidth.
// Attach the returned ref to the flex container that holds the cards.
export function useShrinkToFit(count, { minWidth = 50, maxWidth = 100, gap = 4, extraUnits = 0 } = {}) {
  const ref = useRef(null);
  const [cardWidth, setCardWidth] = useState(maxWidth);
  const [wraps, setWraps] = useState(false);

  // Always reserve scrollbar gutter space and allow vertical scroll so the
  // container's width never changes when wraps toggles. Without this, adding
  // a scrollbar (wraps on) narrows the row → cards shrink → content fits →
  // wraps turns off → scrollbar disappears → row widens → cards grow →
  // content overflows → wraps turns on again, creating a visible flicker
  // at the fit boundary. With a stable gutter the width is constant either
  // way, so cardWidth and the wrap decision don't feed back into each other.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.scrollbarGutter = 'stable';
    el.style.overflowY = 'auto';
  }, []);

  // Card-width sizing from the formula.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rafId = null;
    const compute = () => {
      rafId = null;
      const style = getComputedStyle(el);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const inner = el.clientWidth - padX;
      if (count === 0 || inner <= 0) { setCardWidth(maxWidth); return; }
      const totalUnits = count + extraUnits;
      const ideal = (inner - (count - 1) * gap) / totalUnits;
      if (ideal >= maxWidth) setCardWidth(maxWidth);
      else if (ideal >= minWidth) setCardWidth(ideal);
      else setCardWidth(minWidth);
    };
    const scheduleCompute = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(compute);
    };
    scheduleCompute();
    const ro = new ResizeObserver(scheduleCompute);
    ro.observe(el);
    return () => { if (rafId != null) cancelAnimationFrame(rafId); ro.disconnect(); };
  }, [count, minWidth, maxWidth, gap, extraUnits]);

  // Wrap/scroll decision from the real layout, measured after the new cardWidth
  // is committed to the DOM.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (count === 0) { setWraps(false); return; }
      const overflows = el.scrollHeight > el.clientHeight + 1;
      const fits = el.scrollHeight <= el.clientHeight - 4;
      setWraps((prev) => (prev ? !fits : overflows));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count, cardWidth]);

  return { ref, cardWidth, wraps };
}