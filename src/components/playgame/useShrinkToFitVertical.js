import { useRef, useState, useLayoutEffect } from 'react';

// Measures a vertical container and computes a card width that shrinks to fit
// a single column. When cards would shrink below minWidth, the width clamps to
// minWidth so the section scrolls vertically. Attach the returned ref to the
// flex column container that holds the items.
// ResizeObserver callbacks are rAF-throttled to run at most once per frame.
export function useShrinkToFitVertical(count, { minWidth = 50, maxWidth = 110, gap = 4, aspectRatio = 1.4 } = {}) {
  const ref = useRef(null);
  const [cardWidth, setCardWidth] = useState(maxWidth);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rafId = null;
    const compute = () => {
      rafId = null;
      const style = getComputedStyle(el);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const inner = el.clientHeight - padY;
      if (count === 0 || inner <= 0) { setCardWidth(maxWidth); return; }
      const itemHeight = maxWidth * aspectRatio;
      const idealHeight = (inner - (count - 1) * gap) / count;
      if (idealHeight >= itemHeight) setCardWidth(maxWidth);
      else {
        const idealWidth = idealHeight / aspectRatio;
        if (idealWidth >= minWidth) setCardWidth(idealWidth);
        else setCardWidth(minWidth);
      }
    };
    const scheduleCompute = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(compute);
    };
    scheduleCompute();
    const ro = new ResizeObserver(scheduleCompute);
    ro.observe(el);
    return () => { if (rafId != null) cancelAnimationFrame(rafId); ro.disconnect(); };
  }, [count, minWidth, maxWidth, gap, aspectRatio]);

  return { ref, cardWidth };
}