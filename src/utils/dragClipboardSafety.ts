// dragClipboardSafety.ts
// Purely additive safety net: does not replace existing drag-and-drop logic.
// Forces any in-progress drag to clean up whenever an interruption occurs
// (focus loss, tab hidden, drag/pointer cancellation, or a mouseup that
// never reached the card's own handlers), and provides a hardened
// clipboard-copy helper. Also logs *why* a forced cleanup happened, so a
// future occurrence leaves a concrete trail instead of no evidence.

type CleanupFn = () => void;
const activeDragCleanups = new Set<CleanupFn>();

/** Call this the moment a drag operation begins, passing a function that
 *  resets whatever state that drag set (e.g. setIsDragging(false), clear a
 *  dragged-card id, remove a "dragging" CSS class). Returns an "unregister"
 *  function — call it when the drag ends normally through its usual path. */
export function registerDragCleanup(cleanup: CleanupFn): () => void {
  activeDragCleanups.add(cleanup);
  return () => activeDragCleanups.delete(cleanup);
}

function forceResetAllDrags(reason: string) {
  if (activeDragCleanups.size === 0) return;
  console.warn(`[drag-safety] forcing drag cleanup due to: ${reason}`);
  for (const cleanup of activeDragCleanups) {
    try { cleanup(); } catch (err) { console.error('[drag-safety] cleanup threw', err); }
  }
  activeDragCleanups.clear();
}

let installed = false;
export function installDragSafetyNet() {
  if (installed) return; // idempotent — safe even if called more than once
  installed = true;

  window.addEventListener('blur', () => forceResetAllDrags('window lost focus'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) forceResetAllDrags('tab became hidden');
  });
  window.addEventListener('dragend', () => forceResetAllDrags('native dragend fired'), true);
  window.addEventListener('pointercancel', () => forceResetAllDrags('pointercancel fired'), true);
  // Fallback: mouse released anywhere while a drag is active, even if the
  // card's own drop/dragend/pointerup handler never received the event
  // (e.g. released outside the window or over an iframe).
  window.addEventListener('mouseup', () => forceResetAllDrags('global mouseup fallback'), true);
}

/** Hardened clipboard copy: modern Async Clipboard API first, wrapped in
 *  try/catch, with a legacy execCommand fallback only if that API is
 *  unavailable — and that fallback always cleans up its temporary element
 *  even on failure. */
export async function safeCopyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.error('[clipboard-safety] navigator.clipboard.writeText failed', err);
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch (err) {
    console.error('[clipboard-safety] execCommand fallback failed', err);
    return false;
  }
}