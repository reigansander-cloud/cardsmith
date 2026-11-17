export const GLOBAL_FOLDER_ID = '__global__';

// Merge folder-specific assets with global (clans-wide) assets, deduping by the
// given key. Folder-specific entries take precedence (kept first).
export function mergeAssets(folder, global, key) {
  const seen = new Set();
  const out = [];
  for (const item of [...(folder || []), ...(global || [])]) {
    const k = item[key];
    if (k == null || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}