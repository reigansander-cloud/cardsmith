// Helpers for the icon-based entry search used by the folder and deck manager
// search bars. An entry "has" an icon when the icon URL appears in its cost
// bar(s), income symbol, or inline [icon:url] tag inside ability text.

export function entryHasIcon(entry, url) {
  if (!url) return true;
  if ((entry.cost_icons || []).includes(url)) return true;
  if ((entry.bonus_cost_icons || []).includes(url)) return true;
  if (entry.income_symbol === url) return true;
  const tag = `[icon:${url}]`;
  if (entry.ability && entry.ability.includes(tag)) return true;
  if (entry.bonus_ability && entry.bonus_ability.includes(tag)) return true;
  return false;
}

// Build a deduped {url, name} icon list from FolderIcon + FolderIconWord
// sources (folder-scoped and global). Folder icons are named; icon-word
// entries are labelled by their mapped word.
export function collectSearchIcons(folderIcons, folderIconWords, globalIcons, globalIconWords) {
  const map = new Map();
  const add = (url, name) => { if (url && !map.has(url)) map.set(url, { url, name: name || '' }); };
  (globalIcons || []).forEach((ic) => add(ic.url, ic.name));
  (folderIcons || []).forEach((ic) => add(ic.url, ic.name));
  (globalIconWords || []).forEach((iw) => add(iw.icon_url, iw.word));
  (folderIconWords || []).forEach((iw) => add(iw.icon_url, iw.word));
  return Array.from(map.values());
}