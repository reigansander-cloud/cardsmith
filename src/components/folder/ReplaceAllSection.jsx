import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Search, Image as ImageIcon } from 'lucide-react';

const ENTRY_TEXT_FIELDS = ['name', 'ability', 'subtype', 'influence'];

// Literal substring replace (case-sensitive). Returns new value + count.
function replaceInString(str, find, repl) {
  if (!str || !find) return { value: str, count: 0 };
  const count = str.split(find).length - 1;
  if (count === 0) return { value: str, count: 0 };
  return { value: str.split(find).join(repl), count };
}

// Ability markup tags ([b]..[/b], [i]..[/i], [color:hex]..[/color], [icon:url])
// are hidden formatting — searches/replaces must look through them, not into them.
const TAG_PATTERN = '\\[(?:\\/?b|\\/?i|color:[^\\]]+|\\/color|icon:[^\\]]+)\\]';

function stripTags(str) {
  if (!str) return str;
  return str.replace(new RegExp(TAG_PATTERN, 'g'), '');
}

// Replace `find` with `repl` only in the visible text of a markup string,
// leaving [b]/[i]/[color]/[icon] tags untouched.
function replaceInVisibleText(str, find, repl) {
  if (!str || !find) return { value: str, count: 0 };
  const re = new RegExp(TAG_PATTERN, 'g');
  const parts = [];
  let last = 0;
  let count = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) {
      const seg = str.slice(last, m.index);
      const occ = seg.split(find).length - 1;
      count += occ;
      parts.push(occ > 0 ? seg.split(find).join(repl) : seg);
    }
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < str.length) {
    const seg = str.slice(last);
    const occ = seg.split(find).length - 1;
    count += occ;
    parts.push(occ > 0 ? seg.split(find).join(repl) : seg);
  }
  if (count === 0) return { value: str, count: 0 };
  return { value: parts.join(''), count };
}

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

// Deck-manager-style match: name, subtype, ability, or any stat value.
function entryMatches(entry, term) {
  const t = term.toLowerCase();
  if (!t) return false;
  if ((entry.name || '').toLowerCase().includes(t)) return true;
  if ((entry.subtype || '').toLowerCase().includes(t)) return true;
  if (stripTags(entry.ability || '').toLowerCase().includes(t)) return true;
  if ((entry.stats || []).some((s) => (s.value || '').toLowerCase().includes(t))) return true;
  return false;
}

function snippet(text, term, len = 60) {
  const visible = stripTags(text || '');
  if (!visible) return '';
  const idx = visible.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return visible.slice(0, len);
  const start = Math.max(0, idx - 15);
  const end = Math.min(visible.length, idx + term.length + 30);
  return (start > 0 ? '…' : '') + visible.slice(start, end) + (end < visible.length ? '…' : '');
}

export default function ReplaceAllSection({ scope, icons = [] }) {
  const [find, setFind] = useState('');
  const [repl, setRepl] = useState('');
  const [replaceIcon, setReplaceIcon] = useState(null); // icon url or null
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [entries, setEntries] = useState(null);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [folders, setFolders] = useState({});
  const { toast } = useToast();

  const term = find.trim();
  const iconMode = !!replaceIcon;

  // Debounced live search across the scope's entries (deck-manager style).
  useEffect(() => {
    if (!term) { setEntries(null); setResult(null); return; }
    let cancelled = false;
    setLoadingEntries(true);
    const handle = setTimeout(async () => {
      try {
        const q = scope.type === 'global' ? {} : { folder_id: scope.folderId };
        const all = await fetchAll((skip) => base44.entities.CardEntry.filter(q, '-created_date', 500, skip));
        if (cancelled) return;
        setEntries(all);
        if (scope.type === 'global') {
          const fl = await fetchAll((skip) => base44.entities.Folder.filter({}, '-created_date', 500, skip));
          if (cancelled) return;
          const m = {};
          fl.forEach((f) => { m[f.id] = f.name || 'Untitled'; });
          setFolders(m);
        }
      } catch {
        // ignore — user can retry by editing the query
      } finally {
        if (!cancelled) setLoadingEntries(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [term, scope]);

  const matches = useMemo(() => {
    if (!entries || !term) return [];
    return entries.filter((e) => entryMatches(e, term));
  }, [entries, term]);

  const run = async () => {
    if (!term) return;
    setRunning(true);
    setResult(null);
    try {
      const replValue = iconMode ? `[icon:${replaceIcon}]` : repl;
      let total = 0;
      const updates = [];
      for (const e of matches) {
        let changed = false;
        const next = { id: e.id };
        const fields = iconMode ? ['ability'] : ENTRY_TEXT_FIELDS;
        for (const f of fields) {
          if (e[f] != null && e[f] !== '') {
            const { value, count } = f === 'ability'
              ? replaceInVisibleText(String(e[f]), term, replValue)
              : replaceInString(String(e[f]), term, replValue);
            if (count > 0) { next[f] = value; total += count; changed = true; }
          }
        }
        if (!iconMode && e.stats && e.stats.length) {
          let sc = false;
          const ns = e.stats.map((s) => {
            if (s.value != null && s.value !== '') {
              const { value, count } = replaceInString(String(s.value), term, replValue);
              if (count > 0) { total += count; sc = true; return { ...s, value }; }
            }
            return s;
          });
          if (sc) { next.stats = ns; changed = true; }
        }
        if (changed) updates.push(next);
      }
      for (let i = 0; i < updates.length; i += 500) {
        await base44.entities.CardEntry.bulkUpdate(updates.slice(i, i + 500));
      }

      // Rules docs: text mode only.
      let ruleCount = 0;
      if (!iconMode) {
        const rules = await fetchAll((skip) =>
          base44.entities.RulesDoc.filter(scope.type === 'global' ? {} : { folder_id: scope.folderId }, '-created_date', 500, skip));
        const ruleUpdates = [];
        for (const r of rules) {
          if (r.content) {
            const { value, count } = replaceInString(r.content, term, replValue);
            if (count > 0) { ruleUpdates.push({ id: r.id, content: value }); total += count; ruleCount++; }
          }
        }
        for (let i = 0; i < ruleUpdates.length; i += 500) {
          await base44.entities.RulesDoc.bulkUpdate(ruleUpdates.slice(i, i + 500));
        }
      }

      setResult({ total, entryCount: updates.length, ruleCount });
      // Reflect changes locally so the preview list stays accurate.
      setEntries((prev) => prev ? prev.map((e) => {
        const u = updates.find((u) => u.id === e.id);
        return u ? { ...e, ...u } : e;
      }) : prev);
    } catch (err) {
      toast({ title: 'Replace failed', description: err.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        {scope.type === 'global'
          ? "Searches every folder's entries (and rules) for exact text and replaces all occurrences."
          : "Searches this folder's entries (and rules) for exact text and replaces all occurrences."}
      </p>
      <div className="relative">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="Find — searches name, subtype, ability, stats"
          className="h-8 text-sm pl-7"
        />
      </div>
      {term && (
        <div className="text-[11px] text-muted-foreground">
          {loadingEntries ? 'Searching…' : `${matches.length} matching entr${matches.length === 1 ? 'y' : 'ies'}`}
        </div>
      )}
      {term && matches.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-background/50 divide-y divide-border">
          {matches.slice(0, 50).map((e) => (
            <div key={e.id} className="px-2 py-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground truncate flex-1">{e.name || 'Untitled'}</span>
                {scope.type === 'global' && folders[e.folder_id] && (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{folders[e.folder_id]}</span>
                )}
              </div>
              <p className="text-muted-foreground truncate">{snippet(e.ability || e.name || '', term)}</p>
            </div>
          ))}
          {matches.length > 50 && (
            <div className="px-2 py-1 text-[10px] text-muted-foreground">+{matches.length - 50} more</div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={repl}
          onChange={(e) => { setRepl(e.target.value); if (replaceIcon) setReplaceIcon(null); }}
          placeholder={iconMode ? 'Replacing with icon' : 'Replace with (text)'}
          className="h-8 text-sm"
          disabled={iconMode}
        />
        <Button size="sm" className="h-8 flex-shrink-0" onClick={run} disabled={!term || running || matches.length === 0}>
          {running ? '…' : `Replace all${matches.length ? ` (${matches.length})` : ''}`}
        </Button>
      </div>
      {icons && icons.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ImageIcon size={11} /> Or replace with an icon (ability text only)
            {iconMode && (
              <button onClick={() => setReplaceIcon(null)} className="ml-auto text-destructive hover:underline">clear</button>
            )}
          </p>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {icons.map((ic) => (
              <button
                key={ic.id || ic.url}
                onClick={() => setReplaceIcon(ic.url)}
                className={`w-7 h-7 rounded border flex items-center justify-center flex-shrink-0 ${replaceIcon === ic.url ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                title={ic.name || 'icon'}
              >
                <img src={ic.url} alt={ic.name || ''} className="w-5 h-5 object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}
      {result && (
        <p className="text-xs text-muted-foreground">
          Replaced {result.total} occurrence{result.total === 1 ? '' : 's'} across {result.entryCount} entr{result.entryCount === 1 ? 'y' : 'ies'}{result.ruleCount ? ` and ${result.ruleCount} rule section${result.ruleCount === 1 ? '' : 's'}` : ''}.
        </p>
      )}
    </div>
  );
}