// Runs the Base44 -> Supabase import inside the browser (see pages/AdminImport).
// Same rules as migration/import-to-supabase.mjs, but needs no secret keys:
// it runs as the signed-in admin.

const SKIP_ENTITIES = new Set(['EditLock']);
const BUILTIN = new Set(['id', 'created_date', 'updated_date', 'created_by', 'created_by_id']);
const DROP_KEYS = new Set(['app_id', 'entity_name', 'is_sample', '_id', '__v']);
export const BASE44_URL_RE = /https?:\/\/(?:[a-z0-9-]+\.)*(?:base44\.(?:app|com)|qtrypzzcjebvfcihiynt\.supabase\.co)\/[^\s"'`)<>\]\\]+/gi;

const asTimestamp = (v) => {
  if (!v) return null;
  const s = String(v);
  return /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`;
};

export function toRows(exp) {
  const rows = [];
  for (const [entity, recs] of Object.entries(exp?.entities || {})) {
    if (SKIP_ENTITIES.has(entity)) continue;
    for (const rec of recs || []) {
      if (!rec || !rec.id) continue;
      const data = {};
      for (const [k, v] of Object.entries(rec)) if (!BUILTIN.has(k) && !DROP_KEYS.has(k)) data[k] = v;
      if (entity === 'User') { delete data.auth_uid; if (data.email) data.email = String(data.email).toLowerCase(); }
      rows.push({
        id: String(rec.id), entity, data,
        created_date: asTimestamp(rec.created_date),
        updated_date: asTimestamp(rec.updated_date) || asTimestamp(rec.created_date),
        created_by: rec.created_by ? String(rec.created_by).toLowerCase() : null,
        created_by_id: rec.created_by_id || null,
      });
    }
  }
  // Users first, so ownership links resolve; then everything else.
  rows.sort((a, b) => (a.entity === 'User' ? 0 : 1) - (b.entity === 'User' ? 0 : 1));
  return rows;
}

async function sha1hex(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function storagePathFor(url, prefix) {
  const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
  return `${prefix}/${(await sha1hex(url)).slice(0, 10)}_${name}`;
}

// Copies files into the "uploads" bucket. Returns { map: oldUrl -> newUrl, failed: [] }.
export async function copyFiles(supabase, urls, prefix, onProgress) {
  const list = Array.from(new Set(urls));
  const map = {}; const failed = [];
  let i = 0; let done = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < list.length) {
      const url = list[i++];
      try {
        const path = await storagePathFor(url, prefix);
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const { error } = await supabase.storage.from('uploads').upload(path, blob, {
          contentType: blob.type || undefined, cacheControl: '31536000', upsert: true,
        });
        if (error) throw error;
        map[url] = supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl;
      } catch (err) {
        failed.push({ url, error: err?.message || String(err) });
      }
      done++;
      onProgress?.(done, list.length);
    }
  }));
  return { map, failed };
}

export async function importRows(supabase, rows, onProgress) {
  // Send in batches of at most ~1.5 MB.
  let batch = []; let size = 0; let sent = 0;
  const flush = async () => {
    if (!batch.length) return;
    const { error } = await supabase.rpc('admin_import_records', { p_rows: batch });
    if (error) throw new Error(error.message);
    sent += batch.length; batch = []; size = 0;
    onProgress?.(sent, rows.length);
  };
  for (const r of rows) {
    const len = JSON.stringify(r).length;
    if (batch.length && (size + len > 1_500_000 || batch.length >= 300)) await flush();
    batch.push(r); size += len;
  }
  await flush();
  return sent;
}
