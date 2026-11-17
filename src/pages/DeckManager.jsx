import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Minus, Search, Printer, Filter, Crown, LayoutGrid, BarChart3, Info, Lock, User, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { subtypeText, renderType } from '@/lib/folderPreview';
import DeckEntryCard from '@/components/decks/DeckEntryCard';
import DeckFiltersDialog from '@/components/decks/DeckFiltersDialog';
import DeckStatsDialog from '@/components/decks/DeckStatsDialog';
import DeckPipelinesDialog from '@/components/decks/DeckPipelinesDialog';
import { useDeckSettings } from '@/hooks/useDeckSettings';
import EntryHoverContent from '@/components/decks/EntryHoverContent';
import { hasCounterparts } from '@/lib/counterparts';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { printDeck, ttsDeck } from '@/lib/deckPrint';
import EditingUsersBar from '@/components/folder/EditingUsersBar';
import { useGlobalAssets } from '@/hooks/useGlobalAssets';
import IconSearchPopup from '@/components/folder/IconSearchPopup';
import { entryHasIcon, collectSearchIcons } from '@/lib/iconSearch';

const COST_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'];

function costMatches(cost, selected) {
  const c = Number(cost) || 0;
  return selected.some((opt) => (opt === '10+' ? c >= 10 : c === Number(opt)));
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function DeckManager() {
  const { id } = useParams();
  const { toast } = useToast();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [folders, setFolders] = useState([]);
  const [entries, setEntries] = useState([]);
  const [supertypes, setSupertypes] = useState([]);
  const globalAssets = useGlobalAssets();
  const globalSuperNames = useMemo(() => new Set((globalAssets?.supertypes || []).map((s) => s.name)), [globalAssets]);
  const [folderSuperMap, setFolderSuperMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [iconFilter, setIconFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [loadedFolders, setLoadedFolders] = useState(() => new Set());
  const [folderIconsMap, setFolderIconsMap] = useState({});
  const [folderIconWordsMap, setFolderIconWordsMap] = useState({});
  const [browseLoading, setBrowseLoading] = useState(false);
  const [selectedSupertypes, setSelectedSupertypes] = useState([]);
  const [selectedCosts, setSelectedCosts] = useState([]);
  const [newCardsOnly, setNewCardsOnly] = useState(false);
  const [sortBySupertype, setSortBySupertype] = useState(false);
  const [viewDeckOnly, setViewDeckOnly] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [pipelinesOpen, setPipelinesOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [ttsing, setTtsing] = useState(false);
  const { limits: deckLimits } = useDeckSettings();

  const load = useCallback(async () => {
    try {
      const [d, fl, su] = await Promise.all([
        base44.entities.Deck.get(id),
        base44.entities.Folder.list('-created_date', 200),
        base44.entities.FolderSupertype.list('sort_order', 500),
      ]);
      setDeck(d);
      setCards(d.cards || []);
      setFolders(fl || []);
      if (d.folder_id) setSelectedFolders([d.folder_id]);
      // Supertypes are folder-specific now — load every folder's supertypes
      // and dedupe by name so entries from any folder resolve their template.
      const seen = new Set();
      setSupertypes((su || []).filter((s) => { if (seen.has(s.name)) return false; seen.add(s.name); return true; }));
      // Fetch only the entries referenced by this deck (not all entries).
      const ids = (d.cards || []).map((c) => c.card_id).filter(Boolean);
      if (ids.length) {
        const res = await base44.functions.invoke('GetEntriesByIds', { ids });
        setEntries((prev) => {
          const map = new Map(prev.map((e) => [e.id, e]));
          (res.data?.entries || []).forEach((e) => map.set(e.id, e));
          return Array.from(map.values());
        });
      }
      // Passively pull the associated folder's tokens so they always render in
      // the decklist token section, independent of the browse lazy-load.
      if (d.folder_id) {
        base44.entities.CardEntry.filter({ folder_id: d.folder_id, supertype: 'token' }, '-created_date', 500)
          .then((tokens) => {
            setEntries((prev) => {
              const map = new Map(prev.map((e) => [e.id, e]));
              (tokens || []).forEach((e) => map.set(e.id, e));
              return Array.from(map.values());
            });
          })
          .catch(() => {});
      }
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Secretly record the exit timestamp so the "new cards only" filter can show
  // entries created since the last visit. Saved on unmount (leaving the deck).
  useEffect(() => () => {
    base44.entities.Deck.update(id, { last_edited_date: new Date().toISOString() }).catch(() => {});
  }, [id]);

  // Lazy-load a folder's entries only when it is selected in the filters.
  useEffect(() => {
    if (!selectedFolders || selectedFolders.length === 0) return;
    const toLoad = selectedFolders.filter((fid) => !loadedFolders.has(fid));
    if (toLoad.length === 0) return;
    setBrowseLoading(true);
    Promise.all(toLoad.map((fid) => Promise.all([
      base44.entities.CardEntry.filter({ folder_id: fid }, '-created_date', 500).catch(() => []),
      base44.entities.FolderSupertype.filter({ folder_id: fid }, 'sort_order', 200).catch(() => []),
      base44.entities.FolderIcon.filter({ folder_id: fid }, '-created_date', 200).catch(() => []),
      base44.entities.FolderIconWord.filter({ folder_id: fid }, '-created_date', 200).catch(() => []),
    ])))
      .then((results) => {
        setEntries((prev) => {
          const map = new Map(prev.map((e) => [e.id, e]));
          results.forEach(([ents]) => ents.forEach((e) => map.set(e.id, e)));
          return Array.from(map.values());
        });
        setFolderSuperMap((prev) => {
          const next = { ...prev };
          toLoad.forEach((fid, i) => { next[fid] = results[i][1] || []; });
          return next;
        });
        setFolderIconsMap((prev) => {
          const next = { ...prev };
          toLoad.forEach((fid, i) => { next[fid] = results[i][2] || []; });
          return next;
        });
        setFolderIconWordsMap((prev) => {
          const next = { ...prev };
          toLoad.forEach((fid, i) => { next[fid] = results[i][3] || []; });
          return next;
        });
        setLoadedFolders((prev) => {
          const s = new Set(prev);
          toLoad.forEach((fid) => s.add(fid));
          return s;
        });
      })
      .finally(() => setBrowseLoading(false));
  }, [selectedFolders, loadedFolders]);

  const persist = async (next) => {
    setCards(next);
    try { await base44.entities.Deck.update(id, { cards: next }); } catch {}
  };

  const associateFolder = async (fid) => {
    setDeck((p) => ({ ...p, folder_id: fid }));
    setSelectedFolders(fid ? [fid] : []);
    try { await base44.entities.Deck.update(id, { folder_id: fid }); } catch {}
  };

  const updatePipelines = async (next) => {
    setDeck((p) => ({ ...p, pipelines: next }));
    try { await base44.entities.Deck.update(id, { pipelines: next }); } catch {}
  };

  const updateCardOrder = async (next) => {
    setDeck((p) => ({ ...p, card_order: next }));
    try { await base44.entities.Deck.update(id, { card_order: next }); } catch {}
  };

  const maxCopiesFor = (entry) => {
    const rt = renderType(entry, supertypes);
    const section = rt === 'battlefield' ? deckLimits.battlefield : deckLimits.regular;
    if (entry?.fabled) return section.fabled;
    if (entry?.basic) return section.basic;
    return section.normal;
  };
  const addEntry = (entryId) => {
    const ent = entryById.get(entryId);
    if (deck?.folder_id && ent?.supertype === 'token') return; // tokens auto-included
    const existing = cards.find((c) => c.card_id === entryId);
    if (existing) {
      if (existing.copies >= maxCopiesFor(ent)) return;
      persist(cards.map((c) => (c.card_id === entryId ? { ...c, copies: c.copies + 1 } : c)));
    } else {
      persist([...cards, { card_id: entryId, copies: 1 }]);
    }
  };
  const increment = (entryId) => {
    const ent = entryById.get(entryId);
    const ex = cards.find((c) => c.card_id === entryId);
    if (ex && ex.copies >= maxCopiesFor(ent)) return;
    persist(cards.map((c) => (c.card_id === entryId ? { ...c, copies: c.copies + 1 } : c)));
  };
  const decrement = (entryId) => {
    const ex = cards.find((c) => c.card_id === entryId);
    if (!ex) return;
    const next = ex.copies <= 1
      ? cards.filter((c) => c.card_id !== entryId)
      : cards.map((c) => (c.card_id === entryId ? { ...c, copies: c.copies - 1 } : c));
    persist(next);
  };

  const entryById = useMemo(() => {
    const m = new Map();
    entries.forEach((e) => m.set(e.id, e));
    return m;
  }, [entries]);

  const folderColorMap = useMemo(() => {
    const m = {};
    (folders || []).forEach((f) => { m[f.id] = f.color || ''; });
    return m;
  }, [folders]);

  // Icons available to the icon filter: global + each selected folder's
  // FolderIcon and FolderIconWord (keyword-icon) entries.
  const folderSearchIcons = useMemo(() => {
    const fi = [], fw = [];
    (selectedFolders || []).forEach((fid) => {
      (folderIconsMap[fid] || []).forEach((ic) => fi.push(ic));
      (folderIconWordsMap[fid] || []).forEach((iw) => fw.push(iw));
    });
    return collectSearchIcons(fi, fw, globalAssets?.icons, globalAssets?.iconWords);
  }, [selectedFolders, folderIconsMap, folderIconWordsMap, globalAssets]);

  // Supertypes belonging to the currently-selected folders — drives the
  // filter options and identifies folder-specific supertypes (names not in the
  // global/standard set) that get their own decklist sections.
  const activeSupertypes = useMemo(() => {
    const list = [];
    const seen = new Set();
    (selectedFolders || []).forEach((fid) => {
      (folderSuperMap[fid] || []).forEach((s) => {
        if (!seen.has(s.name)) { seen.add(s.name); list.push(s); }
      });
    });
    return list;
  }, [selectedFolders, folderSuperMap]);

  const folderSpecificNames = useMemo(() => {
    const set = new Set();
    activeSupertypes.forEach((s) => { if (!globalSuperNames.has(s.name)) set.add(s.name); });
    return set;
  }, [activeSupertypes, globalSuperNames]);

  const supertypeNames = useMemo(() => {
    // Global supertypes are always available; folder-specific ones are added
    // for the selected folders. Both are shown in the filter.
    const activeNames = new Set(activeSupertypes.map((s) => s.name));
    const names = (supertypes || [])
      .filter((s) => globalSuperNames.has(s.name) || activeNames.has(s.name))
      .map((s) => s.name);
    if (!names.includes('token')) names.push('token');
    return names;
  }, [supertypes, globalSuperNames, activeSupertypes]);

  const supertypeIndex = useMemo(() => {
    const m = new Map();
    supertypeNames.forEach((n, i) => m.set(n, i));
    return m;
  }, [supertypeNames]);

  const tokenEntries = useMemo(() => {
    if (!deck?.folder_id) return [];
    return entries.filter((e) => e.folder_id === deck.folder_id && e.supertype === 'token');
  }, [deck, entries]);

  const deckEntries = useMemo(() => {
    const userIds = new Set(cards.map((c) => c.card_id));
    const userCards = cards
      .map((c) => ({ ...c, entry: entryById.get(c.card_id) }))
      .filter((c) => c.entry && !(deck?.folder_id && c.entry.supertype === 'token'));
    const tokenCards = tokenEntries
      .filter((e) => !userIds.has(e.id))
      .map((e) => ({ card_id: e.id, copies: 1, entry: e, locked: true }));
    return [...userCards, ...tokenCards];
  }, [cards, entryById, tokenEntries, deck]);

  // Split the decklist into sections: main cards, one per folder-specific
  // supertype, tokens & income, and battlefields. Folder-specific supertypes
  // (names not in the global set) are pulled out of the main section into their
  // own labeled groups.
  const deckSections = useMemo(() => {
    const main = [], tokens = [], income = [], battlefields = [];
    const folderSpecific = {};
    deckEntries.forEach((c) => {
      // Folder-specific supertypes always get their own sections, regardless
      // of their template type (don't let format-type sectioning override).
      if (folderSpecificNames.has(c.entry.supertype)) {
        (folderSpecific[c.entry.supertype] ||= []).push(c);
        return;
      }
      const rt = renderType(c.entry, supertypes);
      if (rt === 'battlefield') battlefields.push(c);
      else if (c.entry.supertype === 'token') tokens.push(c);
      else if (rt === 'income') income.push(c);
      else main.push(c);
    });
    const byCost = (a, b) => {
      const ac = a.entry.cost || 0, bc = b.entry.cost || 0;
      if (ac !== bc) return ac - bc;
      return (a.entry.name || '').toLowerCase().localeCompare((b.entry.name || '').toLowerCase());
    };
    main.sort(byCost);
    tokens.sort(byCost);
    income.sort(byCost);
    battlefields.sort(byCost);
    Object.values(folderSpecific).forEach((arr) => arr.sort(byCost));
    return { main, tokens, income, battlefields, folderSpecific };
  }, [deckEntries, supertypes, folderSpecificNames]);

  const folderSpecificSections = useMemo(
    () => activeSupertypes.filter((s) => folderSpecificNames.has(s.name)),
    [activeSupertypes, folderSpecificNames]
  );

  const renderRow = (c) => (
    <HoverCard key={c.card_id} openDelay={250} closeDelay={150}>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{c.entry.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{subtypeText(c.entry)}</p>
          </div>
          {c.locked ? (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground italic" title="Auto-included token">
              <Lock size={10} /> auto
            </span>
          ) : (
            <>
              <button onClick={() => decrement(c.card_id)} className="w-6 h-6 rounded flex items-center justify-center border border-border hover:bg-muted" title="Remove copy">
                <Minus size={12} />
              </button>
              <span className="text-xs tabular-nums w-5 text-center">{c.copies}</span>
              {c.entry.fabled ? (
                <span className="w-6 h-6 flex items-center justify-center text-amber-500" title="Fabled — limited to 1 copy">
                  <Crown size={14} />
                </span>
              ) : c.entry.basic && c.copies >= maxCopiesFor(c.entry) ? (
                <span className="w-6 h-6 flex items-center justify-center text-blue-500" title="Basic — max copies reached">
                  <User size={14} />
                </span>
              ) : !c.entry.basic && c.copies >= maxCopiesFor(c.entry) ? (
                <span className="w-6 h-6 flex items-center justify-center text-destructive" title="Max copies reached">
                  <X size={14} />
                </span>
              ) : (
                <button onClick={() => increment(c.card_id)} className="w-6 h-6 rounded flex items-center justify-center border border-border hover:bg-muted" title="Add copy">
                  <Plus size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={6} className={`${hasCounterparts(c.entry) ? 'w-[26rem]' : 'w-80'} max-h-[60vh] overflow-y-auto bg-white text-neutral-900 border-black/10`}>
        <EntryHoverContent entry={c.entry} supertypes={supertypes} />
      </HoverCardContent>
    </HoverCard>
  );

  const filtered = useMemo(() => {
    if (viewDeckOnly) {
      const term = search.trim().toLowerCase();
      let list = deckEntries.map((c) => c.entry);
      if (deck?.folder_id) list = list.filter((e) => e.supertype !== 'token');
      if (selectedSupertypes.length) list = list.filter((e) => selectedSupertypes.includes(e.supertype));
      if (selectedCosts.length) list = list.filter((e) => costMatches(e.cost, selectedCosts));
      if (term) {
        list = list.filter((e) => {
          const name = (e.name || '').toLowerCase();
          const sub = (subtypeText(e) || '').toLowerCase();
          const ab = (e.ability || '').toLowerCase();
          return name.includes(term) || sub.includes(term) || ab.includes(term);
        });
      }
      if (iconFilter) list = list.filter((e) => entryHasIcon(e, iconFilter));
      const superIdx = (e) => supertypeIndex.has(e.supertype) ? supertypeIndex.get(e.supertype) : supertypeNames.length;
      const byName = (a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
      const isBottom = (e) => ['battlefield', 'income'].includes(renderType(e, supertypes));
      return [...list].sort((a, b) => {
        if (isBottom(a) !== isBottom(b)) return isBottom(a) ? 1 : -1;
        if (sortBySupertype) {
          if (superIdx(a) !== superIdx(b)) return superIdx(a) - superIdx(b);
          if ((a.cost || 0) !== (b.cost || 0)) return (a.cost || 0) - (b.cost || 0);
          return byName(a, b);
        }
        if ((a.cost || 0) !== (b.cost || 0)) return (a.cost || 0) - (b.cost || 0);
        if (superIdx(a) !== superIdx(b)) return superIdx(a) - superIdx(b);
        return byName(a, b);
      });
    }
    if (!selectedFolders || selectedFolders.length === 0) return [];
    const term = search.trim().toLowerCase();
    let list = entries.filter((e) => selectedFolders.includes(e.folder_id));
    if (deck?.folder_id) list = list.filter((e) => e.supertype !== 'token');
    if (selectedSupertypes.length) list = list.filter((e) => selectedSupertypes.includes(e.supertype));
    if (selectedCosts.length) list = list.filter((e) => costMatches(e.cost, selectedCosts));
    if (newCardsOnly && deck?.last_edited_date) {
      const cutoff = new Date(deck.last_edited_date).getTime();
      list = list.filter((e) => new Date(e.created_date).getTime() > cutoff);
    }
    if (term) {
      list = list.filter((e) => {
        const name = (e.name || '').toLowerCase();
        const sub = (subtypeText(e) || '').toLowerCase();
        const ab = (e.ability || '').toLowerCase();
        return name.includes(term) || sub.includes(term) || ab.includes(term);
      });
    }
    if (iconFilter) list = list.filter((e) => entryHasIcon(e, iconFilter));
    const superIdx = (e) => supertypeIndex.has(e.supertype) ? supertypeIndex.get(e.supertype) : supertypeNames.length;
    const byName = (a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
    return [...list].sort((a, b) => {
      if (sortBySupertype) {
        if (superIdx(a) !== superIdx(b)) return superIdx(a) - superIdx(b);
        if ((a.cost || 0) !== (b.cost || 0)) return (a.cost || 0) - (b.cost || 0);
        return byName(a, b);
      }
      if ((a.cost || 0) !== (b.cost || 0)) return (a.cost || 0) - (b.cost || 0);
      if (superIdx(a) !== superIdx(b)) return superIdx(a) - superIdx(b);
      return byName(a, b);
    });
  }, [entries, deckEntries, selectedFolders, selectedSupertypes, selectedCosts, search, iconFilter, newCardsOnly, sortBySupertype, viewDeckOnly, supertypeIndex, supertypeNames.length]);

  const totalCopies = deckEntries.reduce((s, e) => s + (e.copies || 0), 0);
  const mainCopies = deckSections.main.reduce((s, e) => s + (e.copies || 0), 0);

  const handleEntryChange = useCallback((entryId, fields) => {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...fields } : e)));
  }, []);
  const handleEntryDeleted = useCallback((entryId) => {
    const next = cards.filter((c) => c.card_id !== entryId);
    setCards(next);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    base44.entities.Deck.update(id, { cards: next }).catch(() => {});
  }, [cards, id]);

  const handlePrint = async () => {
    if (deckEntries.length === 0) return;
    setPrinting(true);
    try {
      const n = await printDeck(deckEntries, deck.name, supertypes, folderColorMap);
      toast({ title: 'Deck printed', description: `Saved ${n} cards to "${deck.name}".` });
    } catch (err) {
      toast({ title: 'Print failed', description: err.message, variant: 'destructive' });
    } finally {
      setPrinting(false);
    }
  };

  const handleTTS = async () => {
    if (deckEntries.length === 0) return;
    setTtsing(true);
    try {
      const n = await ttsDeck(deckEntries, deck.name, supertypes, folderColorMap);
      if (n > 0) toast({ title: 'TTS grids saved', description: `${n} cards — a front sheet plus a matching flipped sheet.` });
    } catch (err) {
      toast({ title: 'TTS failed', description: err.message, variant: 'destructive' });
    } finally {
      setTtsing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/decks" className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <ArrowLeft size={18} />
              </Link>
              <Input
                value={deck?.name || ''}
                onChange={(e) => setDeck((p) => ({ ...p, name: e.target.value }))}
                onBlur={(e) => base44.entities.Deck.update(id, { name: e.target.value }).catch(() => {})}
                className="h-8 text-base font-heading font-bold border-transparent bg-transparent hover:border-border focus-visible:border-border w-48 flex-shrink-0"
              />
              <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:inline">{deckEntries.length} unique · {totalCopies} total</span>
              <EditingUsersBar />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTTS} disabled={ttsing || printing || deckEntries.length === 0}>
                <LayoutGrid size={14} className="mr-2" /> {ttsing ? 'TTS…' : 'TTS'}
              </Button>
              <Button variant="default" size="sm" onClick={handlePrint} disabled={printing || deckEntries.length === 0}>
                <Printer size={14} className="mr-2" /> {printing ? 'Printing…' : 'Print'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col max-h-[calc(100vh-7rem)]">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decklist ({mainCopies})</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setStatsOpen(true)} disabled={deckEntries.length === 0}>
                <BarChart3 size={12} className="mr-1" /> Stats
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-7 px-0" onClick={() => setPipelinesOpen(true)} disabled={deckEntries.length === 0} title="Deck pipelines">
                <Info size={14} />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {deckEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">Empty. Click entries to add.</p>
            ) : (
              <div>
                {deckSections.main.length > 0 && (
                  <div className="divide-y divide-border">{deckSections.main.map(renderRow)}</div>
                )}
                {folderSpecificSections.map((s) => {
                  const items = deckSections.folderSpecific[s.name] || [];
                  if (!items.length) return null;
                  return (
                    <React.Fragment key={s.name}>
                      <div className="px-3 py-1 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cap(s.name)} ({items.reduce((sum, e) => sum + e.copies, 0)})</div>
                      <div className="divide-y divide-border">{items.map(renderRow)}</div>
                    </React.Fragment>
                  );
                })}
                {deckSections.income.length > 0 && (
                  <>
                    <div className="px-3 py-1 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Income ({deckSections.income.reduce((s, e) => s + e.copies, 0)})</div>
                    <div className="divide-y divide-border">{deckSections.income.map(renderRow)}</div>
                  </>
                )}
                {deckSections.battlefields.length > 0 && (
                  <>
                    <div className="px-3 py-1 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Battlefields ({deckSections.battlefields.reduce((s, e) => s + e.copies, 0)})</div>
                    <div className="divide-y divide-border">{deckSections.battlefields.map(renderRow)}</div>
                  </>
                )}
                {deckSections.tokens.length > 0 && (
                  <>
                    <div className="px-3 py-1 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tokens ({deckSections.tokens.reduce((s, e) => s + e.copies, 0)})</div>
                    <div className="divide-y divide-border">{deckSections.tokens.map(renderRow)}</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col max-h-[calc(100vh-7rem)]">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, subtype, or text…" className="h-8 pl-8 text-sm bg-muted/30 border-border" />
            </div>
            <IconSearchPopup icons={folderSearchIcons} selectedUrl={iconFilter} onSelect={setIconFilter} />
            <Button variant="outline" size="sm" className="h-8" onClick={() => setFiltersOpen(true)}>
              <Filter size={14} className="mr-2" /> Filters
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {selectedFolders.length === 0 && !viewDeckOnly ? (
              <p className="text-xs text-muted-foreground p-3">Associate a folder in Filters to browse entries.</p>
            ) : browseLoading ? (
              <p className="text-xs text-muted-foreground p-3">Loading entries…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">No entries match.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {filtered.map((e) => (
                  <DeckEntryCard
                    key={e.id}
                    entry={e}
                    highlight={search.trim()}
                    inDeck={!!cards.find((c) => c.card_id === e.id)}
                    copies={cards.find((c) => c.card_id === e.id)?.copies || 0}
                    maxCopies={maxCopiesFor(e)}
                    onAdd={() => addEntry(e.id)}
                    supertypes={supertypes}
                    folderColor={folderColorMap[e.folder_id] || ''}
                    onEntryChange={handleEntryChange}
                    onEntryDeleted={handleEntryDeleted}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DeckFiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        folders={folders}
        associatedFolderId={deck?.folder_id || ''}
        onAssociate={associateFolder}
        supertypes={supertypeNames}
        selectedSupertypes={selectedSupertypes}
        setSelectedSupertypes={setSelectedSupertypes}
        costOptions={COST_OPTIONS}
        selectedCosts={selectedCosts}
        setSelectedCosts={setSelectedCosts}
        newCardsOnly={newCardsOnly}
        setNewCardsOnly={setNewCardsOnly}
        sortBySupertype={sortBySupertype}
        setSortBySupertype={setSortBySupertype}
        viewDeckOnly={viewDeckOnly}
        setViewDeckOnly={setViewDeckOnly}
      />

      <DeckStatsDialog
        open={statsOpen}
        onOpenChange={setStatsOpen}
        deckEntries={deckEntries}
        supertypes={supertypes}
        folderSpecificNames={folderSpecificNames}
      />

      <DeckPipelinesDialog
        open={pipelinesOpen}
        onOpenChange={setPipelinesOpen}
        deckEntries={deckEntries.filter((c) => c.entry.supertype !== 'token')}
        folderEntries={entries.filter((e) => selectedFolders.includes(e.folder_id))}
        supertypes={supertypes}
        folderColorMap={folderColorMap}
        pipelines={deck?.pipelines || []}
        onPipelinesChange={updatePipelines}
        cardOrder={deck?.card_order || []}
        onCardOrderChange={updateCardOrder}
        onAdd={addEntry}
        onIncrement={increment}
        onDecrement={decrement}
      />
    </div>
  );
}