// Shared in-app clipboard for free canvas elements, so copied/cut selections
// can be pasted back into the canvas as their own layers.
let clipboard = [];

export function getClipboard() {
  return clipboard;
}

export function setClipboard(items) {
  clipboard = Array.isArray(items) ? items : [];
}

export function clearClipboard() {
  clipboard = [];
}