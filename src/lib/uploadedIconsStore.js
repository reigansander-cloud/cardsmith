// Module-level shared store of icons for the free-canvas icon manager.
// Icons are transient (in-memory only) — they are NOT persisted to the
// database. They are bundled with the canvas when it is saved as a template
// (see freeCanvasTemplates.saveTemplate) and restored when that template is
// loaded. The collected "Icons" folder, the text icon picker, and the cost
// bar all read this same pool and stay in sync.
let icons = [];
const listeners = new Set();

const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `icon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function emit() {
  listeners.forEach((l) => l(icons));
}

export function getUploadedIcons() {
  return icons;
}

export function subscribeUploadedIcons(cb) {
  listeners.add(cb);
  cb(icons);
  return () => listeners.delete(cb);
}

export function addUploadedIcon(icon) {
  const entry = { id: icon.id || genId(), name: icon.name || 'icon', url: icon.url, ...(icon.width ? { width: icon.width } : {}) };
  icons = [...icons, entry];
  emit();
  return entry;
}

export function removeUploadedIcon(id) {
  icons = icons.filter((i) => i.id !== id);
  emit();
}

export function updateUploadedIcon(id, patch) {
  icons = icons.map((i) => (i.id === id ? { ...i, ...patch } : i));
  emit();
}

// Replace the entire pool — used when loading a saved template's icons.
export function setUploadedIcons(next) {
  icons = Array.isArray(next)
    ? next.map((i) => ({ id: i.id || genId(), name: i.name || 'icon', url: i.url, ...(i.width ? { width: i.width } : {}) }))
    : [];
  emit();
}