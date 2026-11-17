// Conflict-free syncing for the Play Clans table (the Game record).
//
// Why: the Game record is written by every player at once. Before, the whole
// write carried one sequence number, so (1) two players acting at the same
// moment could have one move thrown away as "stale", and (2) per-player lists
// like `players`, `hands`, `discards` were overwritten whole, so my energy
// change could wipe out yours.
//
// Now every top-level field F carries a version `_fv_F`, and every list field
// also carries one version per slot `_ev_F` (slot i = player i, battlefield i,
// ...). A change only overwrites what it actually touched, and the newest
// version of each field / slot wins everywhere: in every browser (this file)
// and in the database (merge_versioned() in supabase/schema.sql, same rules).
//
// Versions are Lamport clocks seeded from the wall clock: never lower than
// anything this page has seen, with a random tail so two browsers never tie.

const BUILTIN = new Set(['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'last_update_client_id', 'update_seq']);
const FV = (k) => `_fv_${k}`;
const EV = (k) => `_ev_${k}`;
export const isMetaKey = (k) => k.startsWith('_fv_') || k.startsWith('_ev_');

let clock = 0;
const tag = Math.floor(Math.random() * 1000);

export function nextVersion() {
  clock = Math.max(clock + 1, Date.now());
  return clock * 1000 + tag;
}

function observe(v) {
  if (typeof v === 'number' && Number.isFinite(v)) clock = Math.max(clock, Math.floor(v / 1000));
}

export function observeVersions(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_fv_')) observe(obj[k]);
    else if (k.startsWith('_ev_') && Array.isArray(obj[k])) obj[k].forEach(observe);
  }
}

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

// Which slots of a list changed: a Set of indexes, or 'all' if the list was
// added, removed, or changed length (a "structural" change).
export function diffIndices(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) return 'all';
  const s = new Set();
  for (let i = 0; i < after.length; i++) if (!same(before[i], after[i])) s.add(i);
  return s;
}

// Combines two dirty markers for the same field.
export function unionDirty(a, b) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (a === true || b === true) return true;   // a whole (non-list) field
  if (a === 'all' || b === 'all') return 'all'; // a restructured list
  return new Set([...a, ...b]);                 // changed slots of a list
}

// Adds version keys to an outgoing patch.
//   local: the record as this browser has it right now (after the change)
//   dirty: { field: Set(changed slots) | 'all' | true }
// Fields without slot info (or when we don't know the local versions) are
// stamped as a whole/structural change.
export function stampPatch(patch, local = null, dirty = {}) {
  const v = nextVersion();
  const out = { ...patch };
  for (const k of Object.keys(patch)) {
    if (isMetaKey(k) || BUILTIN.has(k)) continue;
    if (FV(k) in patch) continue; // already stamped by the caller
    const val = patch[k];
    if (Array.isArray(val)) {
      const d = dirty[k];
      const lev = local?.[EV(k)];
      const lS = local?.[FV(k)];
      const elementwise = d instanceof Set && Array.isArray(lev) && typeof lS === 'number' && lev.length === val.length;
      if (elementwise) {
        out[EV(k)] = lev.map((x, i) => (d.has(i) ? v : x));
        out[FV(k)] = lS;
      } else {
        out[FV(k)] = v;
        out[EV(k)] = val.map(() => v);
      }
    } else {
      out[FV(k)] = v;
    }
  }
  return out;
}

// Merges a record (or partial record) received from someone else into ours.
//   protect(k): null, 'all', or a Set of slots for field k that this browser
//               changed but hasn't sent yet (those stay as they are here).
//   escalate(k): called when someone else restructured list k while we have
//               unsent slot edits in it; ours will then be re-sent whole.
export function mergeVersioned(local, incoming, protect = () => null, escalate = () => {}) {
  if (!incoming) return local;
  observeVersions(incoming);
  if (!local) return incoming;
  const out = { ...local };
  let changed = false;
  const set = (k, v) => { if (out[k] !== v) { out[k] = v; changed = true; } };

  for (const k of Object.keys(incoming)) {
    if (isMetaKey(k)) continue;
    const p = protect(k);
    const inVal = incoming[k];
    const iS = incoming[FV(k)];
    const lS = local[FV(k)];
    if (BUILTIN.has(k)) { if (k !== 'last_update_client_id') set(k, inVal); continue; }
    if (p === 'all') continue;

    if (typeof iS !== 'number') {
      // Unversioned (e.g. a game started before this update): take it unless
      // we hold a versioned copy or an unsent edit.
      if (typeof lS !== 'number' && !p) set(k, inVal);
      continue;
    }

    const iE = incoming[EV(k)];
    const lE = local[EV(k)];
    if (Array.isArray(iE) && Array.isArray(inVal)) {
      const localOk = typeof lS === 'number' && Array.isArray(lE) && Array.isArray(local[k]);
      if (!localOk || iS > lS) {
        if (p) { escalate(k); continue; }
        set(k, inVal); set(FV(k), iS); set(EV(k), iE);
        continue;
      }
      if (iS < lS) continue;
      const lv = local[k];
      if (inVal.length !== lv.length || iE.length !== lv.length || lE.length !== lv.length) continue;
      let arr = null; let ev = null;
      for (let i = 0; i < inVal.length; i++) {
        if (p instanceof Set && p.has(i)) continue;
        if (iE[i] > lE[i]) {
          if (!arr) { arr = lv.slice(); ev = lE.slice(); }
          arr[i] = inVal[i]; ev[i] = iE[i];
        }
      }
      if (arr) { set(k, arr); set(EV(k), ev); }
    } else {
      if (p) continue;
      if (typeof lS !== 'number' || iS > lS) { set(k, inVal); set(FV(k), iS); }
    }
  }
  return changed ? out : local;
}
