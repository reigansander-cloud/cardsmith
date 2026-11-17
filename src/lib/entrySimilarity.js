// Lightweight client-side duplicate detection for folder entries. Used only
// over the already-loaded in-memory entry list (no API calls), so it's cheap.
// Name match is case-insensitive exact; ability match is a Sørensen–Dice
// coefficient on character bigrams of the normalized (markup-stripped) text.

// Light suffix-stripping stemmer so tense/plural variants share bigrams
// (attacking→attack, defending→defend, opponents→opponent, declared→declar).
function stem(w) {
  if (w.length > 4 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 3 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

function normalize(text) {
  if (!text) return '';
  const cleaned = text
    .toLowerCase()
    .replace(/\[\/?\w+(?::[^\]]+)?\]/g, ' ') // strip [b][/b][icon:url][color:hex] markup
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\d+/g, '0') // collapse all numbers to the same token so "2" and "4" match
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.split(' ').map(stem).join(' ');
}

function bigrams(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

// 0..1 similarity between two ability strings; 0 if either is empty.
export function textSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = bigrams(na);
  const bb = bigrams(nb);
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0;
  for (const g of ba) if (bb.has(g)) inter++;
  return (2 * inter) / (ba.size + bb.size);
}

// Stopwords removed before the word-overlap signal so function words don't
// inflate similarity between unrelated abilities.
const STOPWORDS = new Set([
  'a','an','the','and','or','but','while','you','your','yours','they','them','their','it','its','this','that','these','those',
  'to','of','at','for','with','without','in','on','by','as','from','into','onto','upon','per',
  'is','are','was','were','be','been','being','do','does','did','have','has','had',
  'not','no','so','than','then','there','here','when','where','which','who','whom','whose','what','why','how',
  'must','may','can','could','would','should','will','shall','might',
  'least','each','time','if','able','otherwise','instead','also'
]);

// Set of stemmed content words (stopwords removed) for overlap comparison.
function contentWords(text) {
  const n = normalize(text);
  if (!n) return new Set();
  return new Set(n.split(' ').filter((w) => w && !STOPWORDS.has(w)));
}

// Overlap coefficient = |A∩B| / min(|A|,|B|). Order-independent; catches
// paraphrases where one chunk's content words are a subset of the other's,
// which character-bigram Dice misses due to word-order differences.
function overlapCoefficient(a, b) {
  const wa = contentWords(a);
  const wb = contentWords(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.min(wa.size, wb.size);
}

const normName = (n) => (n || '').toLowerCase().trim();

// Split an ability into chunks separated by empty lines or periods. Markup
// is stripped first so periods inside [icon:url] / [color:hex] tags don't
// create spurious chunk boundaries.
function splitChunks(text) {
  if (!text) return [];
  const stripped = text.replace(/\[\/?\w+(?::[^\]]+)?\]/g, ' ');
  const parts = stripped.split(/\n\s*\n/);
  const chunks = [];
  for (const p of parts) {
    for (const s of p.split(/(?<=\.)\s+/)) {
      const t = s.trim();
      if (!t) continue;
      // Skip chunks that are entirely bolded — those are keyword definitions
      // (e.g. "[b]Rally[/b]") which naturally recur across many cards.
      const withoutBold = t.replace(/\[b\][\s\S]*?\[\/b\]/gi, ' ');
      const remainder = withoutBold.replace(/\[\/?\w+(?::[^\]]+)?\]/g, ' ').replace(/[^\p{L}\p{N}]/gu, ' ').trim();
      if (!remainder) continue;
      // Skip short chunks (2 or fewer words) — they're too generic to be
      // meaningful for duplicate detection and produce false positives.
      if (remainder.split(/\s+/).length <= 2) continue;
      chunks.push(t);
    }
  }
  return chunks;
}

// True if any chunk of `a` matches any chunk of `b` at ≥ threshold bigram
// similarity OR ≥0.80 stemmed word-overlap (catches reordered paraphrases).
export function chunkMatch(a, b, threshold = 0.92) {
  const ca = splitChunks(a);
  const cb = splitChunks(b);
  if (!ca.length || !cb.length) return false;
  for (const x of ca) {
    for (const y of cb) {
      if (textSimilarity(x, y) >= threshold) return true;
      if (overlapCoefficient(x, y) >= 0.92) return true;
    }
  }
  return false;
}

// Other entries in the folder sharing the same name OR with similar ability
// text (≥92% bigram similarity or ≥92% stemmed word-overlap). The entry
// itself is excluded.
export function findSimilarEntries(entry, allEntries) {
  if (!entry || !allEntries) return [];
  const name = normName(entry.name);
  const ability = entry.ability || '';
  const out = [];
  const seen = new Set();
  for (const e of allEntries) {
    if (!e || e.id === entry.id) continue;
    let match = false;
    if (name && normName(e.name) === name) match = true;
    if (!match && ability.trim() && chunkMatch(ability, e.ability || '')) match = true;
    if (match && !seen.has(e.id)) { seen.add(e.id); out.push(e); }
  }
  return out;
}

// Cross-folder duplicate detection.
//  - NAME matches are checked against allEntryNames (every entry in every
//    folder, fetched once by the GetAllEntryNames backend function).
//  - ABILITY matches (≥92% bigram similarity or ≥92% stemmed word-overlap)
//    are checked only against the current folder's in-memory entries
//    (allEntries), since abilities are lazy-loaded per folder.
// Returns a unified list of {id, folder_id, name, folderName, supertype,
// subtype, ability}. Cross-folder name matches are enriched with
// supertype/subtype/ability when the matching entry happens to be in the
// current folder's loaded entries.
export function findSimilarEntriesGlobal(entry, allEntries, allEntryNames) {
  if (!entry) return [];
  const name = normName(entry.name);
  const ability = entry.ability || '';
  const out = [];
  const seen = new Set();

  // Combined name pool: allEntryNames covers every folder (names only);
  // allEntries enriches the current folder with full data and also catches
  // entries created this session that aren't in the cached global list yet.
  const pool = new Map();
  if (allEntryNames) for (const e of allEntryNames) if (e && e.id) pool.set(e.id, { id: e.id, folder_id: e.folder_id || '', name: e.name || '', folderName: e.folder_name || '', supertype: '', subtype: '', ability: '' });
  if (allEntries) for (const e of allEntries) if (e && e.id) pool.set(e.id, { id: e.id, folder_id: e.folder_id || '', name: e.name || '', folderName: '', supertype: e.supertype || '', subtype: e.subtype || '', ability: e.ability || '' });

  if (name) {
    for (const e of pool.values()) {
      if (e.id === entry.id) continue;
      if (normName(e.name) !== name) continue;
      out.push(e);
      seen.add(e.id);
    }
  }

  if (ability.trim() && allEntries) {
    for (const e of allEntries) {
      if (!e || e.id === entry.id || seen.has(e.id)) continue;
      if (chunkMatch(ability, e.ability || '')) {
        out.push({ id: e.id, folder_id: e.folder_id || '', name: e.name || '', folderName: '', supertype: e.supertype || '', subtype: e.subtype || '', ability: e.ability || '' });
      }
    }
  }

  return out;
}

// True if any other entry (across all folders, plus the current folder's
// in-memory entries for freshly created ones) shares this entry's name.
export function hasNameMatchGlobal(entry, allEntryNames, allEntries) {
  if (!entry || !entry.name) return false;
  const name = normName(entry.name);
  if (!name) return false;
  if (allEntryNames && allEntryNames.some((e) => e && e.id !== entry.id && normName(e.name) === name)) return true;
  if (allEntries && allEntries.some((e) => e && e.id !== entry.id && normName(e.name) === name)) return true;
  return false;
}