// Default hotkey bindings. Each action maps to an array of key strings.
// Only exhaust/unexhaust has multiple keys by default (e + q).
// Key format: single key like 'e', 'f', 'delete', or modifier combo 'ctrl+c'.
export const DEFAULT_HOTKEYS = {
  exhaust: ['e', 'q'],
  flip: ['f'],
  graveyard: ['g'],
  shuffle: ['r'],
  delete: ['delete'],
  copy: ['ctrl+c'],
  paste: ['ctrl+v'],
  addSupport: ['1'],
  addDamage: ['2'],
  addArmor: ['3'],
};

export const HOTKEY_LABELS = {
  exhaust: 'Exhaust / Unexhaust',
  flip: 'Flip',
  graveyard: 'Send to Graveyard',
  shuffle: 'Shuffle Positions',
  delete: 'Delete Card',
  copy: 'Copy Card',
  paste: 'Paste Card',
  addSupport: 'Add Support Token',
  addDamage: 'Add Damage Token',
  addArmor: 'Add Armor Token',
};

// Returns true if the keyboard event matches any key in the binding array.
export function matchesHotkey(e, binding) {
  if (!binding || binding.length === 0) return false;
  const k = e.key.toLowerCase();
  for (const b of binding) {
    if (b.includes('+')) {
      const [mod, key] = b.split('+');
      if (mod === 'ctrl' && e.ctrlKey && k === key) return true;
    } else {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && k === b) return true;
    }
  }
  return false;
}

// Formats a key string for display in the UI.
export function formatKey(key) {
  if (key === ' ') return 'Space';
  if (key === 'delete') return 'Del';
  if (key === 'backspace') return 'Bksp';
  if (key === 'enter') return 'Enter';
  if (key === 'escape') return 'Esc';
  if (key.startsWith('ctrl+')) return 'Ctrl+' + key.slice(5).toUpperCase();
  return key.length === 1 ? key.toUpperCase() : key;
}