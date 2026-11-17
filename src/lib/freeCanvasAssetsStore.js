// Module-level shared store for free-canvas assets that must persist across all
// canvas tabs in a session and be bundled into saved templates: the saved color
// palette and the collected elements. Uploaded icons live in uploadedIconsStore.
// Both stores follow the same subscribe/emit pattern.
let colors = [];
let collected = [];
const colorListeners = new Set();
const collectedListeners = new Set();

const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function emitColors() { colorListeners.forEach((l) => l(colors)); }
function emitCollected() { collectedListeners.forEach((l) => l(collected)); }

// --- Saved colors ---
export function getColors() { return colors; }
export function subscribeColors(cb) { colorListeners.add(cb); cb(colors); return () => colorListeners.delete(cb); }
export function addColor(hex) {
  const v = (hex || '').toLowerCase();
  if (!v || colors.includes(v)) return;
  colors = [...colors, v];
  emitColors();
}
export function removeColor(hex) {
  const v = (hex || '').toLowerCase();
  colors = colors.filter((c) => c !== v);
  emitColors();
}
export function setColors(next) {
  colors = Array.isArray(next)
    ? next.map((c) => (typeof c === 'string' ? c.toLowerCase() : c)).filter(Boolean)
    : [];
  emitColors();
}

// --- Collected elements ---
export function getCollected() { return collected; }
export function subscribeCollected(cb) { collectedListeners.add(cb); cb(collected); return () => collectedListeners.delete(cb); }
export function addCollected(item) {
  const entry = { id: item.id || genId(), ...item };
  collected = [...collected, entry];
  emitCollected();
  return entry;
}
export function updateCollected(id, patch) {
  collected = collected.map((c) => (c.id === id ? { ...c, ...patch } : c));
  emitCollected();
}
export function removeCollected(id) {
  collected = collected.filter((c) => c.id !== id);
  emitCollected();
}
export function setCollectedItems(next) {
  collected = Array.isArray(next) ? next.map((c) => ({ ...c })) : [];
  emitCollected();
}