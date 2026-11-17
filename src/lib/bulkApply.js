import { base44 } from '@/api/base44Client';
import { applyKeywordsToAbility, applyCapitalizedToAbility, applyIconWordsToAbility } from '@/lib/abilityMarkup';

// Fetch all matching records, paging safely even if `skip` is unsupported.
async function fetchAll(fetchPage) {
  const all = [];
  const seen = new Set();
  let skip = 0;
  while (skip < 10000) {
    const batch = await fetchPage(skip);
    if (!batch || !batch.length) break;
    let dup = 0;
    for (const item of batch) {
      if (seen.has(item.id)) { dup++; continue; }
      seen.add(item.id); all.push(item);
    }
    if (batch.length < 500) break;
    if (dup === batch.length) break;
    skip += batch.length;
  }
  return all;
}

// Apply a single newly-added keyword/capitalized/icon-word to every entry's
// ability text in the given scope, baking the formatting into the stored text.
// Returns { entryCount, total } for a user-facing result message.
export async function applyWordTransformToScope(scope, type, word, iconUrl) {
  const cleanWord = (word || '').trim();
  if (!cleanWord) return { entryCount: 0, total: 0 };
  const q = scope.type === 'global' ? {} : { folder_id: scope.folderId };
  const all = await fetchAll((skip) => base44.entities.CardEntry.filter(q, '-created_date', 500, skip));

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const countRe = new RegExp(`\\b${escapeRe(cleanWord)}\\b`, 'gi');
  let total = 0;
  const updates = [];
  for (const e of all) {
    if (!e.ability) continue;
    let after;
    if (type === 'keyword') after = applyKeywordsToAbility(e.ability, [cleanWord]);
    else if (type === 'capitalize') after = applyCapitalizedToAbility(e.ability, [cleanWord]);
    else after = applyIconWordsToAbility(e.ability, [{ word: cleanWord, icon_url: iconUrl }]);
    if (after !== e.ability) {
      const occ = (e.ability.match(countRe) || []).length;
      total += occ;
      updates.push({ id: e.id, ability: after });
    }
  }
  for (let i = 0; i < updates.length; i += 500) {
    await base44.entities.CardEntry.bulkUpdate(updates.slice(i, i + 500));
  }
  return { entryCount: updates.length, total };
}

// Replace every `[icon:oldUrl]` tag with plain text across all entries'
// ability text in the scope. Used when an icon-word is swapped back to text.
export async function replaceIconWithTextInScope(scope, oldUrl, text) {
  if (!oldUrl) return { entryCount: 0, total: 0 };
  const find = `[icon:${oldUrl}]`;
  const repl = text || '';
  const q = scope.type === 'global' ? {} : { folder_id: scope.folderId };
  const all = await fetchAll((skip) => base44.entities.CardEntry.filter(q, '-created_date', 500, skip));
  let total = 0;
  const updates = [];
  for (const e of all) {
    if (!e.ability) continue;
    const count = e.ability.split(find).length - 1;
    if (count > 0) {
      total += count;
      updates.push({ id: e.id, ability: e.ability.split(find).join(repl) });
    }
  }
  for (let i = 0; i < updates.length; i += 500) {
    await base44.entities.CardEntry.bulkUpdate(updates.slice(i, i + 500));
  }
  return { entryCount: updates.length, total };
}

// Replace every `[icon:oldUrl]` tag with `[icon:newUrl]` across all entries'
// ability text in the scope. Used when an icon-word's icon is swapped out.
export async function replaceIconUrlInScope(scope, oldUrl, newUrl) {
  if (!oldUrl || !newUrl || oldUrl === newUrl) return { entryCount: 0, total: 0 };
  const find = `[icon:${oldUrl}]`;
  const repl = `[icon:${newUrl}]`;
  const q = scope.type === 'global' ? {} : { folder_id: scope.folderId };
  const all = await fetchAll((skip) => base44.entities.CardEntry.filter(q, '-created_date', 500, skip));
  let total = 0;
  const updates = [];
  for (const e of all) {
    if (!e.ability) continue;
    const count = e.ability.split(find).length - 1;
    if (count > 0) {
      total += count;
      updates.push({ id: e.id, ability: e.ability.split(find).join(repl) });
    }
  }
  for (let i = 0; i < updates.length; i += 500) {
    await base44.entities.CardEntry.bulkUpdate(updates.slice(i, i + 500));
  }
  return { entryCount: updates.length, total };
}