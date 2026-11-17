// Shared bits for the migration scripts (run on your computer with Node).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Reads KEY=value lines from .env.local / .env / migration/.env (first wins).
export function loadEnv() {
  const env = {};
  for (const f of [path.join(ROOT, 'migration', '.env'), path.join(ROOT, '.env.local'), path.join(ROOT, '.env')]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return { ...env, ...process.env };
}

export function adminClient() {
  if (globalThis.__TEST_SUPABASE__) return globalThis.__TEST_SUPABASE__;
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(`
Missing settings. Create the file migration/.env with:

  SUPABASE_URL=https://YOUR-PROJECT.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=...   (Supabase: Project Settings -> API -> service_role / secret key)

That key can do anything in your project: keep it on your computer, never
commit it (migration/.env is already in .gitignore) and never put it in a
VITE_ variable.`);
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Files hosted by Base44 (uploads, media, fonts).
export const BASE44_URL_RE = /https?:\/\/(?:[a-z0-9-]+\.)*(?:base44\.(?:app|com)|qtrypzzcjebvfcihiynt\.supabase\.co)\/[^\s"'`)<>\]\\]+/gi;

const MAP_FILE = path.join(ROOT, 'migration', 'file-map.json');

// Downloads Base44-hosted files and re-uploads them to the Supabase "uploads"
// bucket. Remembers what it already copied (migration/file-map.json), so
// running again is quick and doesn't duplicate files.
export function makeFileCopier(supabase, { prefix = 'imported', bucket = 'uploads' } = {}) {
  const map = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {};
  const failed = new Set();
  const save = () => fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 1));

  async function copy(url) {
    if (map[url]) return map[url];
    if (failed.has(url)) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
      const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 10);
      const dest = `${prefix}/${hash}_${name}`;
      const { error } = await supabase.storage.from(bucket).upload(dest, buf, {
        contentType: res.headers.get('content-type') || undefined, cacheControl: '31536000', upsert: true,
      });
      if (error) throw error;
      map[url] = supabase.storage.from(bucket).getPublicUrl(dest).data.publicUrl;
      save();
      return map[url];
    } catch (err) {
      failed.add(url);
      console.warn(`  ! could not copy ${url}: ${err.message || err}`);
      return null;
    }
  }

  // Copies (with a few at a time in parallel) every Base44 URL found in the
  // given strings.
  async function copyAll(urls, concurrency = 4) {
    const list = Array.from(new Set(urls)).filter((u) => !map[u]);
    let i = 0; let done = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (i < list.length) {
        const u = list[i++];
        await copy(u);
        done++;
        if (done % 20 === 0 || done === list.length) process.stdout.write(`  files: ${done}/${list.length}\r`);
      }
    }));
    if (list.length) process.stdout.write('\n');
  }

  const rewrite = (text) => text.replace(BASE44_URL_RE, (u) => map[u] || u);
  return { copyAll, rewrite, map, failed };
}

export function findUrls(text) {
  return text.match(BASE44_URL_RE) || [];
}
