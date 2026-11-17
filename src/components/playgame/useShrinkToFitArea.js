import { useRef, useState, useLayoutEffect } from 'react';

// Like useShrinkToFit, but the card WIDTH also considers the container's height
// so cards fill the available area instead of capping at maxWidth when there's
// vertical room. A binary search over card width finds the largest width whose
// predicted rows fit the height. Whether the section actually SCROLLS (`wraps`)
// is then decided by measuring the real laid-out content (scrollHeight vs
// clientHeight), which is robust to per-row width variation the binary search's
// average can't predict (one row holding an exhausted + attached card).
// Hysteresis prevents scrollbar-feedback oscillation at the fit boundary.
export function useShrinkToFitArea(count, { minWidth = 50, maxWidth = 180, gap = 4, aspectRatio = 1.4, extraUnits = 0 } = {}) {
  const ref = useRef(null);
  const [cardWidth, setCardWidth] = useState(maxWidth);
  const [wraps, setWraps] = useState(false);

  // Card-width sizing via binary search over the predicted layout.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rafId = null;
    const compute = () => {
      rafId = null;
      const style = getComputedStyle(el);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const innerW = el.clientWidth - padX;
      const innerH = el.clientHeight - padY;
      if (count === 0 || innerW <= 0 || innerH <= 0) { setCardWidth(maxWidth); return; }
      const widthFactor = 1 + (count > 0 ? extraUnits / count : 0);
      let lo = minWidth, hi = maxWidth, best = minWidth;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        const cardsPerRow = Math.max(1, Math.floor((innerW + gap) / (mid * widthFactor + gap)));
        const rows = Math.ceil(count / cardsPerRow);
        const totalH = rows * mid * aspectRatio + (rows - 1) * gap;
        if (totalH <= innerH) { best = mid; lo = mid; } else { hi = mid; }
        if (hi - lo < 0.5) break;
      }
      setCardWidth(Math.max(minWidth, Math.min(best, maxWidth)));
    };
    const scheduleCompute = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(compute);
    };
    scheduleCompute();
    const ro = new ResizeObserver(scheduleCompute);
    ro.observe(el);
    return () => { if (rafId != null) cancelAnimationFrame(rafId); ro.disconnect(); };
  }, [count, minWidth, maxWidth, gap, aspectRatio, extraUnits]);

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