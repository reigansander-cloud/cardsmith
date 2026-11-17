// What used to be the four Base44 server functions (base44/functions/*).
// On Base44 they existed to batch reads so the app didn't trip the per-user
// rate limit; on Supabase that limit doesn't exist, so they run in the
// browser through the same entity calls. Same names, same results.

const DEFAULT_SUPERTYPES = [
  { name: 'permanent', template_type: 'permanent', sort_order: 0 },
  { name: 'fortification', template_type: 'permanent', sort_order: 1 },
  { name: 'instant', template_type: 'instant', sort_order: 2 },
  { name: 'modifier', template_type: 'modifier', sort_order: 3 },
  { name: 'token', template_type: 'permanent', sort_order: 4 },
];

const AI_PREFIX = /^\s*AI OVERVIEW\s*:?[^\S\n]*/i;
function firstLine(text) {
  const body = (text || '').replace(AI_PREFIX, '');
  const line = body.split('\n').map((l) => l.trim()).find((l) => l.length > 0) || '';
  return line.replace(/\*/g, '').trim();
}

async function readAll(entity, filterObj, sort) {
  const PAGE = 1000;
  const out = [];
  for (let skip = 0; ; skip += PAGE) {
    const page = await entity.filter(filterObj, sort, PAGE, skip);
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

let seeding = null;

export const serverFunctions = {
  async GetEntriesByIds(base44, { ids }) {
    const list = Array.from(new Set((ids || []).filter(Boolean)));
    const entries = [];
    for (let i = 0; i < list.length; i += 200) {
      entries.push(...await base44.entities.CardEntry.filter({ id: { $in: list.slice(i, i + 200) } }, null, 200));
    }
    return { entries };
  },

  async GetAllEntryNames(base44) {
    const [folders, entries] = await Promise.all([
      readAll(base44.entities.Folder, {}, '-created_date'),
      readAll(base44.entities.CardEntry, {}, '-created_date'),
    ]);
    const folderNames = {};
    for (const f of folders) folderNames[f.id] = f.name || '';
    return {
      entries: entries.map((e) => ({ id: e.id, folder_id: e.folder_id || '', folder_name: folderNames[e.folder_id] || '', name: e.name || '' })),
    };
  },

  async GetGlobalAssets(base44) {
    const s = base44.entities;
    const g = { folder_id: '__global__' };
    const [icons, stats, keywords, capitalized, iconWords] = await Promise.all([
      s.FolderIcon.filter(g, '-created_date', 200),
      s.FolderStat.filter(g, '-created_date', 200),
      s.FolderKeyword.filter(g, '-created_date', 200),
      s.FolderCapitalized.filter(g, '-created_date', 200),
      s.FolderIconWord.filter(g, '-created_date', 200),
    ]);
    let supertypes = await s.FolderSupertype.filter(g, 'sort_order', 200);
    if (!supertypes.some((t) => t.name === 'token')) {
      // Seed the defaults once (guarded so two tabs opening at once don't both seed).
      if (!seeding) {
        seeding = (async () => {
          const fresh = await s.FolderSupertype.filter(g, 'sort_order', 200);
          if (fresh.length === 0) await s.FolderSupertype.bulkCreate(DEFAULT_SUPERTYPES.map((t) => ({ ...g, ...t })));
          else if (!fresh.some((t) => t.name === 'token')) {
            await s.FolderSupertype.create({ ...g, name: 'token', template_type: 'permanent', sort_order: fresh.length });
          }
        })().finally(() => { seeding = null; });
      }
      await seeding;
      supertypes = await s.FolderSupertype.filter(g, 'sort_order', 200);
    }
    return { icons, stats, keywords, capitalized, iconWords, supertypes };
  },

  async DeflagOnParReviews(base44) {
    const comments = await readAll(base44.entities.EntryComment, { text: { $regex: '^\\s*AI OVERVIEW', $options: 'i' } }, '-created_date');
    const latest = {};
    for (const c of comments) {
      if (c.entry_id && !(c.entry_id in latest)) latest[c.entry_id] = c;
    }
    const matching = Object.values(latest)
      .filter((c) => firstLine(c.text).toLowerCase() === 'about on par')
      .map((c) => c.entry_id);
    const flagged = [];
    for (let i = 0; i < matching.length; i += 200) {
      const page = await base44.entities.CardEntry.filter({ id: { $in: matching.slice(i, i + 200) }, needs_review: true }, null, 200);
      page.forEach((e) => flagged.push(e.id));
    }
    if (flagged.length) {
      await base44.entities.CardEntry.bulkUpdate(flagged.map((id) => ({ id, needs_review: false, flagged_by_id: '', flagged_by_name: '' })));
    }
    return { matched: matching.length, updated: flagged.length };
  },
};
