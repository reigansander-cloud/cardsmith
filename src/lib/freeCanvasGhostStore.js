// Transient ghost-preview of a collected element that will be added to the
// canvas. Shared between CollectedButtons (producer) and FreeCanvasCanvas
// (consumer) so the live preview can render a 30% opacity copy at the
// element's start position/size while the start-settings popup is open.
let ghost = null;
const listeners = new Set();

export function getGhost() {
  return ghost;
}

export function setGhost(g) {
  ghost = g;
  listeners.forEach((l) => l(ghost));
}

export function clearGhost() {
  ghost = null;
  listeners.forEach((l) => l(null));
}

export function subscribeGhost(cb) {
  listeners.add(cb);
  cb(ghost);
  return () => listeners.delete(cb);
}