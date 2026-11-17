// =============================================================================
// Step 2 of moving off Base44: load the export into Supabase.
//
//   npm run import-data                       (uses migration/cardsmith-export.json)
//   npm run import-data -- path/to/export.json
//   npm run import-data -- --skip-files       (don't copy uploaded files)
//
// Needs migration/.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see
// lib.mjs). Run supabase/schema.sql in your project first.
//
// - Every record keeps its Base44 id and dates, so all links between
//   folders, entries, decks and games stay intact.
// - Users are imported as profiles. When someone signs up on the new site
//   (or uses Google) with the same email, they automatically get their old
//   account back: same id, preferences, ownership of comments, etc.
// - Files you uploaded on Base44 (card art, icons, fonts...) are copied into
//   your Supabase storage and every link to them is updated.
// - Safe to run more than once: it updates records instead of duplicating.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { adminClient, makeFileCopier, findUrls, ROOT } from './lib.mjs';

const args = process.argv.slice(2);
const skipFiles = args.includes('--skip-files');
const file = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(ROOT, 'migration', 'cardsmith-export.json'));

// Edit locks only mean "someone has this open right now"; old ones would just
// block editing, so they're not carried over.
const SKIP_ENTITIES = new Set(['EditLock']);
const BUILTIN = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id'];
// Base44 bookkeeping that isn't part of your data.
const DROP_KEYS = new Set(['app_id', 'entity_name', 'is_sample', '_id', '__v']);

const asTimestamp = (v) => {
  if (!v) return null;
  const s = String(v);
  return /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`; // Base44 dates are UTC without a zone marker
};

function toRow(entity, rec) {
  const data = {};
  for (const [k, v] of Object.entries(rec)) {
    if (BUILTIN.includes(k) || DROP_KEYS.has(k)) continue;
    data[k] = v;
  }
  if (entity === 'User') {
    delete data.auth_uid;
    if (data.email) data.email = String(data.email).toLowerCase();
  }
  return {
    id: String(rec.id),
    entity,
    data,
    created_date: asTimestamp(rec.created_date) || new Date().toISOString(),
    updated_date: asTimestamp(rec.updated_date) || asTimestamp(rec.created_date) || new Date().toISOString(),
    created_by: rec.created_by ? String(rec.created_by).toLowerCase() : null,
    created_by_id: rec.created_by_id || null,
  };
}

async function main() {
  if (!fs.existsSync(file)) {
    console.error(`Can't find ${file}.\nRun migration/export-from-base44.js on the old site first and put cardsmith-export.json in the migration folder.`);
    process.exit(1);
  }
  const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
  const supabase = adminClient();

  const { error: pingErr } = await supabase.from('records').select('id', { head: true, count: 'exact' }).limit(1);
  if (pingErr) {
    console.error(`Can't reach the records table: ${pingErr.message}\nDid you run supabase/schema.sql in the SQL Editor?`);
    process.exit(1);
  }

  let rowsByEntity = {};
  for (const [entity, recs] of Object.entries(exp.entities || {})) {
    if (SKIP_ENTITIES.has(entity)) continue;
    rowsByEntity[entity] = (recs || []).filter((r) => r && r.id).map((r) => toRow(entity, r));
  }

  if (!skipFiles) {
    const copier = makeFileCopier(supabase);
    const all = JSON.stringify(rowsByEntity);
    const urls = findUrls(all);
    console.log(`Copying ${new Set(urls).size} files from Base44 to Supabase storage...`);
    await copier.copyAll(urls);
    rowsByEntity = JSON.parse(copier.rewrite(all));
    if (copier.failed.size) console.warn(`${copier.failed.size} files could not be copied (links left as they were).`);
  }

  // Keep a profile that already signed in on the new site linked to its login.
  const { data: existingUsers } = await supabase.from('records').select('id, data').eq('entity', 'User');
  const authById = Object.fromEntries((existingUsers || []).filter((u) => u.data?.auth_uid).map((u) => [u.id, u.data.auth_uid]));

  let total = 0;
  for (const [entity, rows] of Object.entries(rowsByEntity)) {
    if (entity === 'User') rows.forEach((r) => { if (authById[r.id]) r.data.auth_uid = authById[r.id]; });
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from('records').upsert(chunk, { onConflict: 'id' });
      if (error) { console.error(`${entity}: ${error.message}`); process.exit(1); }
    }
    total += rows.length;
    console.log(`${entity.padEnd(26)} ${rows.length}`);
  }

  // A brand-new profile may have been created on the new site before the
  // import (e.g. you signed in to test). If it has the same email as an
  // imported user, hand its login over to the imported (old-id) profile.
  const { data: users } = await supabase.from('records').select('id, data').eq('entity', 'User');
  const byEmail = {};
  for (const u of users || []) {
    const em = (u.data?.email || '').toLowerCase();
    if (em) (byEmail[em] = byEmail[em] || []).push(u);
  }
  for (const list of Object.values(byEmail)) {
    const imported = list.find((u) => !u.data?.auth_uid && rowsByEntity.User?.some((r) => r.id === u.id));
    const fresh = list.find((u) => u.data?.auth_uid && !rowsByEntity.User?.some((r) => r.id === u.id));
    if (imported && fresh) {
      await supabase.from('records').update({ data: { ...imported.data, auth_uid: fresh.data.auth_uid } }).eq('id', imported.id);
      await supabase.from('records').delete().eq('id', fresh.id);
      console.log(`Linked the new login for ${imported.data.email} to their old account.`);
    }
  }

  console.log(`\nDone: ${total} records imported.`);
  if (exp.problems?.length) console.warn('Note: the export reported problems with:', exp.problems.join('; '));
}

main().catch((err) => { console.error(err); process.exit(1); });
