// A drop-in replacement for the Base44 SDK client, backed by Supabase.
//
// The app was written against `base44.entities.X.list/filter/get/create/
// update/delete/subscribe/...`, `base44.auth.*`, `base44.integrations.Core.
// UploadFile` and `base44.functions.invoke`. This object offers the same calls
// with the same shapes, so the rest of the code didn't need to change. All
// data lives in the Supabase `records` table (see supabase/schema.sql).
//
// No `import.meta` in here, so tests can load it under plain Node with a stand-in client.

import { serverFunctions } from './serverFunctions.js';
import { stampPatch, observeVersions, nextVersion } from '../lib/versionedMerge.js';

// Entities whose updates are also sent straight to other players over
// Realtime before the database write finishes, and whose fields carry
// versions so simultaneous changes merge instead of overwriting each other
// (the Play Clans table; see src/lib/versionedMerge.js).
const FAST_ENTITIES = new Set(['Game']);
const VERSIONED_ENTITIES = FAST_ENTITIES;
const MAX_MESSAGE_BYTES = 200_000; // Realtime caps a message at 256 KB on the free plan.

function toError(error, fallbackStatus = 500) {
  if (!error) return null;
  const msg = error.message || String(error);
  let status = error.status || fallbackStatus;
  if (error.code === 'P0002' || /not found/i.test(msg)) status = 404;
  else if (error.code === '28000' || /JWT|not signed in/i.test(msg)) status = 401;
  else if (error.code === '42501') status = 403;
  else if (/rate limit|too many/i.test(msg)) status = 429;
  const e = new Error(msg);
  e.status = status;
  e.response = { status, data: { message: msg } };
  e.data = { message: msg };
  return e;
}

function httpError(status, message) {
  return toError({ status, message }, status);
}

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// list(options) / filter(query, options) — Base44's cursor-page form.
const isPageOptions = (v) => isPlainObject(v) && ('cursor' in v || 'limit' in v || 'sort' in v || 'fields' in v || 'distinct' in v);

export function createBase44Compat(supabase, opts = {}) {
  const appUrl = opts.appUrl || ((p) => p);
  const bucket = opts.bucket || 'uploads';

  async function rpc(name, params) {
    const { data, error } = await supabase.rpc(name, params);
    if (error) throw toError(error);
    return data;
  }

  // ------------------------------------------------------------------ realtime
  const topics = new Map(); // entity -> { channel, listeners: Set }
  const ownClientIds = new Set(); // last_update_client_id values this page has written
  let realtimeAuthed = null;

  async function ensureRealtimeAuth() {
    if (!supabase.realtime?.setAuth) return;
    if (!realtimeAuthed) {
      // No argument: Realtime keeps pulling the current (auto-refreshed)
      // login token itself, so private channels survive token renewals.
      realtimeAuthed = (async () => {
        const { data } = await supabase.auth.getSession();
        if (data?.session) await supabase.realtime.setAuth();
      })().finally(() => { realtimeAuthed = null; });
    }
    return realtimeAuthed;
  }

  function emit(entity, event) {
    if (VERSIONED_ENTITIES.has(entity)) observeVersions(event.data);
    const t = topics.get(entity);
    if (!t) return;
    for (const cb of Array.from(t.listeners)) {
      try { cb(event); } catch (err) { console.error(`[${entity}.subscribe] listener error`, err); }
    }
  }

  async function handleMessage(entity, p) {
    if (!p || typeof p !== 'object') return;
    const ts = p.timestamp || new Date().toISOString();
    try {
      if (p.type === 'bulk') {
        const ids = p.ids || [];
        if (p.op === 'delete') {
          ids.forEach((id) => emit(entity, { type: 'delete', id, data: { id }, timestamp: ts }));
          return;
        }
        for (let i = 0; i < ids.length; i += 200) {
          const rows = await rpc('records_query', { p_entity: entity, p_filter: { id: { $in: ids.slice(i, i + 200) } }, p_sort: null, p_limit: 200, p_skip: 0 });
          (rows || []).forEach((row) => emit(entity, { type: p.op, id: row.id, data: row, timestamp: ts }));
        }
        return;
      }
      if (p.type === 'delete') {
        emit(entity, { type: 'delete', id: p.id, data: p.data || { id: p.id }, timestamp: ts });
        return;
      }
      let data = p.data;
      if (data && data._partial) {
        // Only the changed fields of a big record. Game merges partial
        // updates itself; anything else gets the full record.
        const { _partial, ...rest } = data;
        if (FAST_ENTITIES.has(entity)) data = rest;
        else {
          try { data = await rpc('records_get', { p_entity: entity, p_id: p.id }); }
          catch { return; }
        }
      } else if (data && data._refetch) {
        if (data.last_update_client_id && ownClientIds.has(data.last_update_client_id)) return; // our own write
        try { data = await rpc('records_get', { p_entity: entity, p_id: p.id }); }
        catch { return; }
      }
      emit(entity, { type: p.type, id: p.id, data, timestamp: ts });
    } catch (err) {
      console.error(`[${entity}.subscribe] could not handle message`, err);
    }
  }

  function getTopic(entity) {
    let t = topics.get(entity);
    if (t) return t;
    t = { listeners: new Set(), channel: null, ready: false };
    topics.set(entity, t);
    const channel = supabase.channel(`records:${entity}`, { config: { private: true, broadcast: { self: false } } });
    for (const ev of ['create', 'update', 'delete', 'bulk', 'fast']) {
      channel.on('broadcast', { event: ev }, (msg) => handleMessage(entity, msg?.payload));
    }
    t.channel = channel;
    ensureRealtimeAuth().catch(() => {}).then(() => {
      if (topics.get(entity) !== t) return; // unsubscribed meanwhile
      channel.subscribe((status) => { t.ready = status === 'SUBSCRIBED'; });
    });
    return t;
  }

  function subscribe(entity, cb) {
    const t = getTopic(entity);
    t.listeners.add(cb);
    return () => {
      t.listeners.delete(cb);
      if (t.listeners.size === 0 && topics.get(entity) === t) {
        topics.delete(entity);
        try { supabase.removeChannel(t.channel); } catch { /* ignore */ }
      }
    };
  }

  // Play Clans: hand the change to the other players right away. The database
  // write still happens; versions make the two arrivals merge cleanly.
  function sendFast(entity, id, patch) {
    if (!FAST_ENTITIES.has(entity)) return;
    const t = topics.get(entity);
    if (!t || !t.ready) return;
    const payload = { type: 'update', id, data: { ...patch, id }, timestamp: new Date().toISOString() };
    try {
      if (JSON.stringify(payload).length > MAX_MESSAGE_BYTES) return;
      t.channel.send({ type: 'broadcast', event: 'fast', payload }).catch?.(() => {});
    } catch { /* the database write is still on its way */ }
  }

  // ------------------------------------------------------------------ entities
  const seen = (entity) => (row) => {
    if (VERSIONED_ENTITIES.has(entity)) (Array.isArray(row) ? row : [row]).forEach(observeVersions);
    return row;
  };

  function query(entity, filterObj, sort, limit, skip) {
    return rpc('records_query', {
      p_entity: entity,
      p_filter: filterObj || {},
      p_sort: sort || null,
      p_limit: limit ?? null,
      p_skip: skip || 0,
    }).then((rows) => rows || []).then(seen(entity));
  }

  async function readPage(entity, filterObj, options) {
    const limit = options.limit || 50;
    const skip = options.cursor ? parseInt(options.cursor, 10) || 0 : 0;
    const rows = await query(entity, filterObj, options.sort, limit + 1, skip);
    let items = rows.slice(0, limit);
    if (options.fields) {
      const fields = Array.isArray(options.fields) ? options.fields : String(options.fields).split(',');
      items = items.map((r) => Object.fromEntries([['id', r.id], ...fields.map((f) => [f, r[f]])]));
    }
    if ('distinct' in options) {
      const k = options.distinct;
      return { items: Array.from(new Set(items.map((r) => r[k]))), has_more: rows.length > limit, next_cursor: rows.length > limit ? String(skip + limit) : null };
    }
    return { items, has_more: rows.length > limit, next_cursor: rows.length > limit ? String(skip + limit) : null };
  }

  function entityHandler(entity) {
    return {
      list(sort, limit, skip) {
        if (isPageOptions(sort)) return readPage(entity, {}, sort);
        return query(entity, {}, sort, limit, skip);
      },
      filter(filterObj, sort, limit, skip) {
        if (isPageOptions(sort)) return readPage(entity, filterObj, sort);
        return query(entity, filterObj, sort, limit, skip);
      },
      get(id) {
        if (!id) return Promise.reject(httpError(404, `${entity} not found`));
        return rpc('records_get', { p_entity: entity, p_id: String(id) }).then(seen(entity));
      },
      create(data) {
        if (VERSIONED_ENTITIES.has(entity)) data = stampPatch(data || {});
        return rpc('records_create', { p_entity: entity, p_data: data || {} });
      },
      async bulkCreate(items) {
        const out = [];
        for (let i = 0; i < (items || []).length; i += 500) {
          const rows = await rpc('records_bulk_create', { p_entity: entity, p_items: items.slice(i, i + 500) });
          out.push(...(rows || []));
        }
        return out;
      },
      update(id, patch) {
        patch = patch || {};
        if (VERSIONED_ENTITIES.has(entity)) patch = stampPatch(patch);
        if (patch.last_update_client_id) ownClientIds.add(patch.last_update_client_id);
        sendFast(entity, id, patch);
        return rpc('records_update', { p_entity: entity, p_id: String(id), p_patch: patch }).then(seen(entity));
      },
      // Not in Base44: add an item to a list field atomically (joining a lobby).
      append(id, key, item, { uniqueBy = null } = {}) {
        return rpc('records_append', {
          p_entity: entity, p_id: String(id), p_key: key, p_item: item,
          p_unique_by: uniqueBy, p_version: nextVersion(),
        }).then(seen(entity));
      },
      async bulkUpdate(items) {
        const out = [];
        for (let i = 0; i < (items || []).length; i += 500) {
          const rows = await rpc('records_bulk_update', { p_entity: entity, p_items: items.slice(i, i + 500) });
          out.push(...(rows || []));
        }
        return out;
      },
      updateMany(filterObj, update) {
        return rpc('records_update_many', { p_entity: entity, p_filter: filterObj || {}, p_update: update || {} });
      },
      delete(id) {
        return rpc('records_delete', { p_entity: entity, p_id: String(id) });
      },
      deleteMany(filterObj) {
        return rpc('records_delete_many', { p_entity: entity, p_filter: filterObj || {} });
      },
      subscribe(cb) {
        return subscribe(entity, cb);
      },
    };
  }

  const handlers = new Map();
  const entities = new Proxy({}, {
    get(_, name) {
      if (typeof name !== 'string' || name === 'then') return undefined;
      if (!handlers.has(name)) handlers.set(name, entityHandler(name));
      return handlers.get(name);
    },
  });

  // ---------------------------------------------------------------------- auth
  const absolute = (p) => new URL(appUrl(p || '/'), window.location.origin).toString();
  // Turns "https://site/base/clans?x=1" or "/clans" into "/clans?x=1" (path inside the app).
  const inAppPath = (urlOrPath) => {
    try {
      const u = new URL(urlOrPath || '/', window.location.origin);
      if (u.origin !== window.location.origin) return '/';
      const base = appUrl('/').replace(/\/$/, '');
      let p = u.pathname;
      if (base && p.startsWith(base)) p = p.slice(base.length) || '/';
      return p + u.search;
    } catch { return '/'; }
  };

  let profilePromise = null;

  const auth = {
    async me() {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) throw httpError(401, 'Not signed in');
      if (!profilePromise) profilePromise = rpc('claim_profile', {}).finally(() => { profilePromise = null; });
      const profile = await profilePromise;
      return { ...profile, email: profile.email || data.session.user.email };
    },
    async isAuthenticated() {
      const { data } = await supabase.auth.getSession();
      return !!data?.session;
    },
    async loginViaEmailPassword(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw toError(error, 400);
      return { access_token: data.session?.access_token, user: data.user };
    },
    async loginWithProvider(provider, fromUrl = '/') {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: absolute(inAppPath(fromUrl)) } });
      if (error) throw toError(error, 400);
    },
    async register({ email, password }) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: absolute('/') } });
      if (error) throw toError(error, 400);
      // If email confirmation is switched off in Supabase, the person is
      // already signed in and there's no code to enter.
      return { session: data.session, user: data.user, needsVerification: !data.session };
    },
    async verifyOtp({ email, otpCode }) {
      let res = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'email' });
      if (res.error) res = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
      if (res.error) throw toError(res.error, 400);
      return { access_token: res.data.session?.access_token, user: res.data.user };
    },
    async resendOtp(email) {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw toError(error, 400);
    },
    async resetPasswordRequest(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: absolute('/reset-password') });
      if (error) throw toError(error, 400);
    },
    async resetPassword({ newPassword }) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw toError(error, 400);
    },
    async updateMe(patch) {
      return rpc('update_me', { p_patch: patch || {} });
    },
    async logout(redirectUrl) {
      await supabase.auth.signOut().catch(() => {});
      if (redirectUrl) window.location.href = appUrl('/login');
    },
    redirectToLogin(fromUrl) {
      const back = inAppPath(fromUrl || window.location.href);
      const q = back && back !== '/' ? `?returnTo=${encodeURIComponent(back)}` : '';
      window.location.href = appUrl('/login') + q;
    },
    setToken() { /* Supabase keeps the session itself */ },
  };

  // -------------------------------------------------------------- integrations
  const integrations = {
    Core: {
      async UploadFile({ file }) {
        const safe = String(file?.name || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
        const path = `${new Date().toISOString().slice(0, 7)}/${Math.random().toString(36).slice(2, 10)}_${safe}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          contentType: file?.type || undefined, cacheControl: '31536000', upsert: false,
        });
        if (error) throw toError(error, 400);
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return { file_url: data.publicUrl };
      },
    },
  };

  const base44 = { entities, auth, integrations, supabase };

  // ----------------------------------------------------------------- functions
  // The four Base44 server functions existed to batch reads past Base44's
  // rate limits. Supabase doesn't need that, so they run right here.
  base44.functions = {
    async invoke(name, payload) {
      const fn = serverFunctions[name];
      if (!fn) throw httpError(404, `Unknown function ${name}`);
      const { data } = await supabase.auth.getSession();
      if (!data?.session) throw httpError(401, 'Unauthorized');
      return { data: await fn(base44, payload || {}), status: 200 };
    },
  };

  return base44;
}
