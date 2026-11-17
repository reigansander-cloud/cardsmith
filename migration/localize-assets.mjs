// =============================================================================
// Copies the images/fonts that are hard-coded in the app's source code and
// still point at Base44's servers (banners, cost icons, the Caesar Dressing
// font, ...) into your Supabase storage, and rewrites the links in src/.
// Run once, then commit the changed files:
//
//   npm run localize-assets
//
// Needs migration/.env (see lib.mjs). Safe to run again.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { adminClient, makeFileCopier, findUrls, ROOT } from './lib.mjs';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|tsx?|css|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = [...walk(path.join(ROOT, 'src')), path.join(ROOT, 'index.html')];
const hits = files.map((f) => [f, fs.readFileSync(f, 'utf8')]).filter(([, t]) => findUrls(t).length);
const urls = hits.flatMap(([, t]) => findUrls(t));
console.log(`${new Set(urls).size} Base44-hosted files referenced in ${hits.length} source files.`);
if (!urls.length) process.exit(0);

const copier = makeFileCopier(adminClient(), { prefix: 'app-assets' });
await copier.copyAll(urls);
let changed = 0;
for (const [f, text] of hits) {
  const next = copier.rewrite(text);
  if (next !== text) { fs.writeFileSync(f, next); changed++; console.log(`  updated ${path.relative(ROOT, f)}`); }
}
console.log(`Done. ${changed} files updated${copier.failed.size ? `, ${copier.failed.size} links could not be copied` : ''}.`);
