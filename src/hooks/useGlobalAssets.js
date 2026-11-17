import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Session-level cache for the five global-asset collections. Fetched once via
// the GetGlobalAssets backend function (a single client call) and reused
// across every page that needs global icons / stats / keywords / capitalized /
// supertypes. refreshGlobalAssets() invalidates and re-fetches — call it after
// the Clans settings dialog mutates any global asset so every page stays live.

let cache = null;
let fetchPromise = null;
const listeners = new Set();

function notify(data) {
  cache = data;
  listeners.forEach((l) => l(data));
}

function fetchOnce() {
  if (fetchPromise) return fetchPromise;
  fetchPromise = base44.functions.invoke('GetGlobalAssets', {})
    .then((res) => { notify(res.data); return res.data; })
    .catch((err) => { fetchPromise = null; throw err; })
    .finally(() => { fetchPromise = null; });
  return fetchPromise;
}

// Force a fresh fetch (bypasses any in-flight request) and notify every mounted
// hook consumer. Returns a promise resolving to the new data.
export function refreshGlobalAssets() {
  cache = null;
  fetchPromise = null;
  return fetchOnce();
}

// Returns the cached global assets, or null while loading on first mount.
// Auto-fetches once per session; subsequent mounts reuse the cache.
export function useGlobalAssets() {
  const [data, setData] = useState(cache);

  useEffect(() => {
    listeners.add(setData);
    if (cache) {
      setData(cache);
    } else {
      fetchOnce().then((d) => setData(d)).catch(() => {});
    }
    return () => { listeners.delete(setData); };
  }, []);

  return data;
}