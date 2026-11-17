import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, BookOpen, Settings, Plus, Trash2, Type, Search } from 'lucide-react';
import EntryCard from '@/components/folder/EntryCard';
import EntryPreview from '@/components/folder/EntryPreview';
import FolderIconsDialog from '@/components/folder/FolderIconsDialog';
import FolderNamesDialog from '@/components/folder/FolderNamesDialog';
import ConfirmDeleteFolder from '@/components/folder/ConfirmDeleteFolder';
import { mergeAssets } from '@/lib/globalAssets';
import { subtypeText } from '@/lib/folderPreview';
import { counterpartsOf } from '@/lib/counterparts';
import { entryHasIcon, collectSearchIcons } from '@/lib/iconSearch';
import IconSearchPopup from '@/components/folder/IconSearchPopup';
import { useGlobalAssets } from '@/hooks/useGlobalAssets';
import { buildTabOrder, tabOrderDocId } from '@/lib/tabOrder';
import { useLiveEntries } from '@/hooks/useLiveEntries';
import { useEditLocks } from '@/hooks/useEditLocks';
import EditingUsersBar from '@/components/folder/EditingUsersBar';
import { appUrl } from '@/lib/appUrl';

// Supertypes are managed globally from the Clans page (folder_id = '__global__').

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// Session cache of every entry's {id, folder_id, folder_name, name} across all
// folders, fetched once via the GetAllEntryNames backend function and reused
// across folder navigations for cross-folder duplicate-name detection.
let globalEntryNamesCache = null;

export default function FolderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [folder, setFolder] = useState(null);
  const [icons, setIcons] = useState([]);
  const [stats, setStats] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [capitalized, setCapitalized] = useState([]);
  const [iconWords, setIconWords] = useState([]);
  const [folderSupertypes, setFolderSupertypes] = useState([]);
  const [tabOrder, setTabOrder] = useState(null);
  const globalAssets = useGlobalAssets();
  const globalIcons = globalAssets?.icons || [];
  const globalStats = globalAssets?.stats || [];
  const globalKeywords = globalAssets?.keywords || [];
  const globalCapitalized = globalAssets?.capitalized || [];
  const globalIconWords = globalAssets?.iconWords || [];
  const supertypes = useMemo(() => {
    const seen = new Set();
    const merged = [];
    [...(globalAssets?.supertypes || []), ...folderSupertypes].forEach((s) => {
      if (!seen.has(s.name)) { seen.add(s.name); merged.push(s); }
    });
    return merged;
  }, [globalAssets, folderSupertypes]);
  const [activeTab, setActiveTab] = useState('permanent');
  const [iconsOpen, setIconsOpen] = useState(false);
  const [namesOpen, setNamesOpen] = useState(false);
  const [unusedNames, setUnusedNames] = useState([]);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [iconFilter, setIconFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [allEntryNames, setAllEntryNames] = useState(globalEntryNamesCache || []);

  // Fetch the cross-folder name list once per session for duplicate-name detection.
  useEffect(() => {
    if (globalEntryNamesCache) { setAllEntryNames(globalEntryNamesCache); return; }
    let cancelled = false;
    base44.functions.invoke('GetAllEntryNames', {}).then((res) => {
      const list = res?.data?.entries || [];
      if (!cancelled) { globalEntryNamesCache = list; setAllEntryNames(list); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const { entries, selectedId, selectEntry, deselect, updateEntry, flushEntry, createEntry, duplicateEntry, deleteEntry, toggleReview } = useLiveEntries(id);
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;

  // folder name live sync
  const [editingName, setEditingName] = useState(false);
  const editingNameRef = useRef(false);
  editingNameRef.current = editingName;
  const folderRef = useRef(null);
  folderRef.current = folder;
  const namePendingRef = useRef(null);
  const savedNamesRef = useRef([]);

  const handleLostLock = useCallback((itemId, userName) => {
    if (itemId === id) {
      setEditingName(false);
      toast({ description: `${userName} took over editing the folder name` });
    } else if (selectedIdRef.current === itemId) {
      deselect();
      toast({ description: `${userName} took over editing this entry` });
    }
  }, [deselect, id, toast]);

  const { isLockedByOther, acquire, release } = useEditLocks(id, handleLostLock);

  const handleSelect = (entry) => {
    const lock = isLockedByOther(entry.id);
    if (lock) { toast({ description: `${lock.userName} is editing this entry` }); return; }
    if (selectedId && selectedId !== entry.id) { flushEntry(selectedId); release('entry', selectedId); }
    selectEntry(entry);
    acquire('entry', entry.id, undefined, undefined, { supertype: entry.supertype, entry_name: entry.name });
  };
  const handleDeselect = () => {
    if (selectedId) { flushEntry(selectedId); release('entry', selectedId); }
    deselect();
  };

  const loadSupertypes = useCallback(async () => {
    try {
      const folderSup = await base44.entities.FolderSupertype.filter({ folder_id: id }, 'sort_order', 200);
      setFolderSupertypes(folderSup || []);
    } catch {}
  }, [id]);

  const loadTabOrder = useCallback(async () => {
    try {
      const docs = await base44.entities.RulesDoc.filter({ folder_id: tabOrderDocId(id) }, '-created_date', 5);
      if (docs && docs.length) setTabOrder(JSON.parse(docs[0].content));
      else setTabOrder(null);
    } catch { setTabOrder(null); }
  }, [id]);

  const loadNames = useCallback(async () => {
    try {
      const list = await base44.entities.FolderName.filter({ folder_id: id }, '-created_date', 500);
      setUnusedNames(list || []);
    } catch { setUnusedNames([]); }
  }, [id]);

  const loadAll = useCallback(async () => {
    try {
      const [f, ic, st, kw, cap, iw] = await Promise.all([
        base44.entities.Folder.get(id),
        base44.entities.FolderIcon.filter({ folder_id: id }, '-created_date', 200),
        base44.entities.FolderStat.filter({ folder_id: id }, '-created_date', 200),
        base44.entities.FolderKeyword.filter({ folder_id: id }, '-created_date', 200),
        base44.entities.FolderCapitalized.filter({ folder_id: id }, '-created_date', 200),
        base44.entities.FolderIconWord.filter({ folder_id: id }, '-created_date', 200),
      ]);
      setFolder(f);
      setIcons(ic || []);
      setStats(st || []);
      setKeywords(kw || []);
      setCapitalized(cap || []);
      setIconWords(iw || []);
    } catch {}
    await loadSupertypes();
    await loadTabOrder();
    await loadNames();
    setLoading(false);
  }, [id, loadSupertypes, loadTabOrder, loadNames]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // The search bar can't be collapsed manually once opened — switching folders
  // (or otherwise leaving this one) is what closes it and clears its state.
  useEffect(() => {
    setSearch('');
    setSearchOpen(false);
    setIconFilter('');
  }, [id]);

  // Deep-link: ?entry=ID switches to the entry's tab and scrolls to it
  const [searchParams, setSearchParams] = useSearchParams();
  const [scrollTarget, setScrollTarget] = useState(null);
  useEffect(() => {
    const entryId = searchParams.get('entry');
    if (!entryId || !entries.length) return;
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    setActiveTab(entry.supertype);
    setSearchParams({}, { replace: true });
    setScrollTarget(entryId);
  }, [searchParams, entries, setSearchParams]);
  // Scroll once the target entry is actually rendered on the active tab
  useEffect(() => {
    if (!scrollTarget) return;
    const el = document.getElementById(`entry-${scrollTarget}`);
    if (!el) return; // not on the active tab yet — retries when activeTab/entries change
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScrollTarget(null);
  }, [scrollTarget, activeTab, entries, loading]);

  // keep the tab row in sync across users
  useEffect(() => {
    const unsub = base44.entities.FolderSupertype.subscribe((event) => {
      const d = event.data;
      if (!d || (d.folder_id !== id && d.folder_id !== '__global__')) return;
      loadSupertypes();
    });
    return unsub;
  }, [id, loadSupertypes]);

  // Tab order is stored in a RulesDoc — only reload it when that doc changes
  // (i.e. when tabs are reordered), not on every supertype add/remove.
  useEffect(() => {
    const docId = tabOrderDocId(id);
    const unsub = base44.entities.RulesDoc.subscribe((event) => {
      const d = event.data;
      if (!d || d.folder_id !== docId) return;
      loadTabOrder();
    });
    return unsub;
  }, [id, loadTabOrder]);

  // realtime folder updates (name)
  useEffect(() => {
    const unsub = base44.entities.Folder.subscribe((event) => {
      if (event.id !== id) return;
      const d = event.data;
      if (!d) return;
      const idx = savedNamesRef.current.findIndex((s) => s.name === d.name);
      if (idx >= 0) { savedNamesRef.current.splice(idx, 1); return; }
      if (editingNameRef.current) return; // protect local while editing
      setFolder(d);
    });
    return unsub;
  }, [id]);

  const renameFolder = (name) => {
    setFolder((prev) => ({ ...prev, name }));
    if (namePendingRef.current) clearTimeout(namePendingRef.current);
    namePendingRef.current = setTimeout(() => {
      namePendingRef.current = null;
      savedNamesRef.current = savedNamesRef.current.filter((s) => Date.now() - s.ts < 10000);
      savedNamesRef.current.push({ name, ts: Date.now() });
      base44.entities.Folder.update(id, { name }).catch(() => {});
    }, 400);
  };

  const flushName = () => {
    if (namePendingRef.current) {
      clearTimeout(namePendingRef.current);
      namePendingRef.current = null;
      const f = folderRef.current;
      if (f) {
        savedNamesRef.current = savedNamesRef.current.filter((s) => Date.now() - s.ts < 10000);
        savedNamesRef.current.push({ name: f.name, ts: Date.now() });
        base44.entities.Folder.update(id, { name: f.name }).catch(() => {});
      }
    }
  };

  const setFolderColor = (color) => {
    setFolder((prev) => (prev ? { ...prev, color } : prev));
    base44.entities.Folder.update(id, { color }).catch(() => {});
  };

  const handleNameFocus = () => {
    if (isLockedByOther(id)) return;
    setEditingName(true);
    acquire('folder_name', id);
  };
  const handleNameBlur = () => {
    setEditingName(false);
    release('folder_name', id);
    flushName();
  };

  // flush pending name save on unmount
  useEffect(() => () => {
    if (namePendingRef.current) {
      clearTimeout(namePendingRef.current);
      const f = folderRef.current;
      if (f) base44.entities.Folder.update(id, { name: f.name }).catch(() => {});
    }
  }, []);

  // if the active tab's supertype was removed, fall back to the first tab
  useEffect(() => {
    if (!supertypes.length) return;
    const names = supertypes.map((s) => s.name);
    if (!names.includes(activeTab)) {
      setActiveTab(names[0]);
    }
  }, [supertypes, activeTab]);

  const sortedSupertypes = useMemo(
    () => [...supertypes].sort((a, b) => {
      const aGlobal = a.folder_id === '__global__' ? 0 : 1;
      const bGlobal = b.folder_id === '__global__' ? 0 : 1;
      if (aGlobal !== bGlobal) return aGlobal - bGlobal;
      return (a.sort_order || 0) - (b.sort_order || 0);
    }),
    [supertypes]
  );

  const orderedTabs = useMemo(() => {
    const built = buildTabOrder(tabOrder, sortedSupertypes.map((s) => s.name));
    // Always show global supertype tabs first, folder-specific to the right.
    const globalNames = new Set(supertypes.filter((s) => s.folder_id === '__global__').map((s) => s.name));
    const globalTabs = built.filter((n) => globalNames.has(n));
    const folderTabs = built.filter((n) => !globalNames.has(n));
    return [...globalTabs, ...folderTabs];
  }, [tabOrder, sortedSupertypes, supertypes]);

  const matchesSearch = (entry, term) => {
    const name = (entry.name || '').toLowerCase();
    const sub = (subtypeText(entry) || '').toLowerCase();
    const ab = (entry.ability || '').toLowerCase();
    return name.includes(term) || sub.includes(term) || ab.includes(term);
  };
  const searchTerm = search.trim().toLowerCase();
  const searchActive = searchTerm.length > 0;
  const iconActive = !!iconFilter;
  // Icons available to the icon filter: this folder's + global FolderIcon and
  // FolderIconWord entries (the keyword-icon lists).
  const searchIcons = useMemo(
    () => collectSearchIcons(icons, iconWords, globalIcons, globalIconWords),
    [icons, iconWords, globalIcons, globalIconWords]
  );
  // When searching (text or icon), show every matching entry across all tabs
  // (the active tab no longer filters); keep the actively-edited entry visible
  // even if its text stops matching mid-edit so it doesn't vanish under cursor.
  const tabEntries = (searchActive || iconActive)
    ? entries.filter((e) => (!searchActive || matchesSearch(e, searchTerm) || e.id === selectedId) && (!iconActive || entryHasIcon(e, iconFilter)))
    : activeTab === 'token'
      ? [...entries.filter((e) => e.supertype === 'token')].sort((a, b) => (a.token_type || '').localeCompare(b.token_type || '') || (a.cost || 0) - (b.cost || 0))
      : entries.filter((e) => e.supertype === activeTab);
  const entryCounts = useMemo(() => {
    const m = {};
    entries.forEach((e) => { m[e.supertype] = (m[e.supertype] || 0) + 1; });
    return m;
  }, [entries]);
  const selected = entries.find((e) => e.id === selectedId) || null;
  const allIcons = mergeAssets(icons, globalIcons, 'url');
  const allStats = mergeAssets(stats, globalStats, 'name');
  const allKeywords = mergeAssets(keywords, globalKeywords, 'word');
  const allCapitalized = mergeAssets(capitalized, globalCapitalized, 'word');
  const allIconWords = mergeAssets(iconWords, globalIconWords, 'word');

  const handleCreate = () => {
    const tpl = supertypes.find((s) => s.name === activeTab)?.template_type;
    createEntry(activeTab, activeTab === 'token' ? (supertypes.find((s) => s.name !== 'token')?.name || 'permanent') : undefined, tpl);
  };
  const handleCopy = (entry) => {
    const tpl = entry.supertype === 'token'
      ? supertypes.find((s) => s.name === entry.token_type)?.template_type
      : supertypes.find((s) => s.name === entry.supertype)?.template_type;
    duplicateEntry(entry, tpl);
  };

  const addCustomStat = async (name, color) => {
    if (stats.some((s) => s.name === name)) return;
    const created = await base44.entities.FolderStat.create({ folder_id: id, name, color });
    setStats((prev) => [...prev, created]);
  };

  // Assign an unused name to an entry: delete the name record, refresh the
  // list, and update the entry's title in one go.
  const consumeUnusedName = async (record, entryId) => {
    try { await base44.entities.FolderName.delete(record.id); } catch {}
    loadNames();
    updateEntry(entryId, { name: record.name });
  };

  // When an entry is named (e.g. a newly created card being titled), remove
  // that name from the folder's unused-names list if it was sitting there.
  const consumeNameIfUnused = useCallback(async (name) => {
    const n = (name || '').trim();
    if (!n) return;
    const match = unusedNames.find((u) => u.name === n);
    if (!match) return;
    try { await base44.entities.FolderName.delete(match.id); } catch {}
    loadNames();
  }, [unusedNames, loadNames]);

  const handleUpdate = useCallback((entryId, fields) => {
    if (fields && fields.name !== undefined) consumeNameIfUnused(fields.name);
    updateEntry(entryId, fields);
  }, [updateEntry, consumeNameIfUnused]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteFolder = () => setDeleteOpen(true);
  const confirmDeleteFolder = async () => {
    setDeleteOpen(false);
    try {
      await base44.entities.CardEntry.deleteMany({ folder_id: id });
      await base44.entities.FolderIcon.deleteMany({ folder_id: id });
      await base44.entities.FolderStat.deleteMany({ folder_id: id });
      await base44.entities.FolderKeyword.deleteMany({ folder_id: id });
      await base44.entities.FolderCapitalized.deleteMany({ folder_id: id });
      await base44.entities.FolderIconWord.deleteMany({ folder_id: id });
      await base44.entities.FolderName.deleteMany({ folder_id: id });
      await base44.entities.Folder.delete(id);
      window.location.href = appUrl('/clans');
    } catch {}
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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30 overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="h-14 flex items-center gap-3 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', touchAction: 'pan-x', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
            <Link to="/clans" className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <ArrowLeft size={18} />
            </Link>
            <Input
              value={folder?.name || ''}
              onChange={(e) => renameFolder(e.target.value)}
              onFocus={handleNameFocus}
              onBlur={handleNameBlur}
              readOnly={!!isLockedByOther(id)}
              className="h-8 text-base font-heading font-bold border-transparent bg-transparent hover:border-border focus-visible:border-border w-40 flex-shrink-0"
            />
            <EditingUsersBar />
            <div className="flex-1" />
            <div className="flex items-center gap-1 flex-shrink-0">
              {searchOpen ? (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setSearch(''); }}
                      placeholder="Search entries…"
                      className="h-8 pl-8 w-40 text-sm bg-muted/30 border-border"
                    />
                  </div>
                  <IconSearchPopup icons={searchIcons} selectedUrl={iconFilter} onSelect={setIconFilter} />
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)} title="Search entries">
                  <Search size={14} />
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleCreate} className="flex-shrink-0">
              <Plus size={14} className="mr-2" /> New Entry
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNamesOpen(true)} className="flex-shrink-0">
              <Type size={14} className="mr-2" /> Names
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/folder/${id}/rules`)} className="flex-shrink-0">
              <BookOpen size={14} className="mr-2" /> Rules
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIconsOpen(true)} className="flex-shrink-0">
              <Settings size={14} className="mr-2" /> Settings
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive flex-shrink-0" onClick={deleteFolder}>
              <Trash2 size={14} />
            </Button>
          </div>
          <div className="pb-2 flex items-center gap-1 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', touchAction: 'pan-x', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
            {orderedTabs.map((name) => (
              <button
                key={name}
                onClick={() => setActiveTab(name)}
                className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap flex-shrink-0 flex flex-col items-center leading-tight ${
                  activeTab === name ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span className="text-sm font-medium">{cap(name)}</span>
                <span className="text-[9px] opacity-50">{entryCounts[name] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-4 flex gap-4" onClick={handleDeselect}>
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 gap-2.5">
            {tabEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full py-8 text-center">{searchActive ? 'No entries match your search.' : 'No entries yet.'}</p>
            ) : (
              tabEntries.map((entry) => (
                <div key={entry.id} id={`entry-${entry.id}`}>
                <EntryCard
                  entry={entry}
                  highlight={searchActive ? search.trim() : ''}
                  allEntries={selectedId === entry.id ? entries : undefined}
                  allEntryNames={selectedId === entry.id ? allEntryNames : undefined}
                  onJumpEntry={(folderId, sId) => navigate(`/folder/${folderId || id}?entry=${sId}`)}
                  folderStats={allStats}
                  icons={allIcons}
                  keywords={allKeywords}
                  capitalized={allCapitalized}
                  iconWords={allIconWords}
                  supertypes={supertypes}
                  folderColor={folder?.color || ''}
                  selected={selectedId === entry.id}
                  onSelect={handleSelect}
                  onUpdate={handleUpdate}
                  onDelete={deleteEntry}
                  onCopy={handleCopy}
                  onToggleReview={toggleReview}
                  lockedBy={isLockedByOther(entry.id)}
                  unusedNames={selectedId === entry.id ? unusedNames : undefined}
                  onConsumeUnusedName={consumeUnusedName}
                />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-center sticky top-32 self-start max-h-[calc(100vh-9rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {selected ? (
            <>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Preview</h3>
              <div className="flex flex-col items-center gap-4">
                <EntryPreview entry={selected} icons={allIcons} supertypes={supertypes} folderColor={folder?.color || ''} />
                {counterpartsOf(selected).map((cp, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Counterpart {i + 1}</span>
                    <EntryPreview entry={{ ...cp, folder_id: selected.folder_id }} icons={allIcons} supertypes={supertypes} folderColor={folder?.color || ''} />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center max-w-[360px]">
                Live preview — changes save and sync as you edit.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ width: 360, height: 504, border: '1px dashed var(--border)', borderRadius: 8 }}>
              <p className="text-sm">Click an entry to preview</p>
            </div>
          )}
        </div>
      </div>

      <FolderIconsDialog
        open={iconsOpen}
        onOpenChange={setIconsOpen}
        folderId={id}
        folderName={folder?.name}
        icons={icons}
        onIconsChange={loadAll}
        stats={stats}
        onStatsChange={loadAll}
        keywords={keywords}
        onKeywordsChange={loadAll}
        capitalized={capitalized}
        onCapitalizedChange={loadAll}
        iconWords={iconWords}
        onIconWordsChange={loadAll}
        supertypes={supertypes}
        onSupertypesChange={loadSupertypes}
        folderColor={folder?.color || ''}
        onFolderColorChange={setFolderColor}
      />
      <ConfirmDeleteFolder open={deleteOpen} onOpenChange={setDeleteOpen} folderName={folder?.name} onConfirm={confirmDeleteFolder} />
      <FolderNamesDialog open={namesOpen} onOpenChange={setNamesOpen} folderId={id} names={unusedNames} onNamesChange={loadNames} />
    </div>
  );
}