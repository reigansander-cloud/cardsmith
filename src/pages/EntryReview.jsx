import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, Flag } from 'lucide-react';
import EntryCard from '@/components/folder/EntryCard';
import EntryCommentSection from '@/components/folder/EntryCommentSection';
import CardEvaluationPanel from '@/components/folder/CardEvaluationPanel';
import { mergeAssets } from '@/lib/globalAssets';
import { useGlobalAssets } from '@/hooks/useGlobalAssets';
import { useLiveReviewEntries } from '@/hooks/useLiveReviewEntries';
import { useEditLocks } from '@/hooks/useEditLocks';
import { useToast } from '@/components/ui/use-toast';
import EditingUsersBar from '@/components/folder/EditingUsersBar';
import DeflagOnParButton from '@/components/folder/DeflagOnParButton';

// Public review page: lists every entry flagged for review across all folders.
// Uses the same debounced-save / edit-lock / realtime-sync pattern as the
// folder page, so editing a review entry behaves identically to editing one
// in its folder (including cross-folder lock visibility).
export default function EntryReview() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const { entries, selectedId, selectEntry, deselect, updateEntry, flushEntry, toggleReview, reload, loading } = useLiveReviewEntries();

  const [icons, setIcons] = useState([]);
  const [stats, setStats] = useState([]);
  const [iconWords, setIconWords] = useState([]);
  const [folderKeywords, setFolderKeywords] = useState([]);
  const [aiOverview, setAiOverview] = useState(null);

  const handleDeleteAiOverview = async () => {
    if (!aiOverview?.id) return;
    try { await base44.entities.EntryComment.delete(aiOverview.id); } catch {}
    setAiOverview(null);
  };
  const globalAssets = useGlobalAssets();
  const globalIcons = globalAssets?.icons || [];
  const globalStats = globalAssets?.stats || [];
  const globalKeywords = globalAssets?.keywords || [];
  const globalCapitalized = globalAssets?.capitalized || [];
  const globalIconWords = globalAssets?.iconWords || [];
  const [supertypes, setSupertypes] = useState([]);
  const [folderColorMap, setFolderColorMap] = useState({});
  const [lastCommentByEntry, setLastCommentByEntry] = useState({});

  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;

  const handleLostLock = useCallback((itemId, userName) => {
    if (selectedIdRef.current === itemId) {
      deselect();
      toast({ description: `${userName} took over editing this entry` });
    }
  }, [deselect, toast]);

  // null folderId = cross-folder mode: load all locks, subscribe to all events
  const { isLockedByOther, acquire, release } = useEditLocks(null, handleLostLock);

  const handleSelect = (entry) => {
    const lock = isLockedByOther(entry.id);
    if (lock) { toast({ description: `${lock.userName} is editing this entry` }); return; }
    if (selectedId && selectedId !== entry.id) { flushEntry(selectedId); release('entry', selectedId); }
    selectEntry(entry);
    acquire('entry', entry.id, entry.folder_id, 'review', { supertype: entry.supertype, entry_name: entry.name });
  };
  const handleDeselect = () => {
    if (selectedId) { flushEntry(selectedId); release('entry', selectedId); }
    deselect();
  };

  // Track the most recent commenter per entry so we can dim entries where the
  // current user was the last to flag or comment.
  const fetchComments = async () => {
    try {
      const list = await base44.entities.EntryComment.list('-created_date', 1000);
      const map = {};
      (list || []).forEach((c) => {
        if (c.entry_id && !(c.entry_id in map)) {
          map[c.entry_id] = { created_by_id: c.created_by_id, author_name: c.author_name };
        }
      });
      setLastCommentByEntry(map);
    } catch {}
  };

  useEffect(() => {
    fetchComments();
    const unsub = base44.entities.EntryComment.subscribe(() => { fetchComments(); });
    return unsub;
  }, []);

  useEffect(() => {
    base44.entities.FolderSupertype.list('sort_order', 500).then((sl) => {
      const seen = new Set();
      setSupertypes((sl || []).filter((s) => { if (seen.has(s.name)) return false; seen.add(s.name); return true; }));
    }).catch(() => {});
    base44.entities.Folder.list('-created_date', 200).then((fl) => {
      const m = {};
      (fl || []).forEach((f) => { m[f.id] = f.color || ''; });
      setFolderColorMap(m);
    }).catch(() => {});
  }, []);

  // Global icons/stats/keywords/capitalized come from the shared session cache
  // (useGlobalAssets) — no per-page fetch needed.

  const selected = entries.find((e) => e.id === selectedId) || null;

  // Deep-link: ?entry=ID scrolls to an entry without selecting it
  const [searchParams, setSearchParams] = useSearchParams();
  const [scrollTarget, setScrollTarget] = useState(null);
  useEffect(() => {
    const entryId = searchParams.get('entry');
    if (!entryId || !entries.length) return;
    setSearchParams({}, { replace: true });
    setScrollTarget(entryId);
  }, [searchParams, entries, setSearchParams]);
  useEffect(() => {
    if (!scrollTarget) return;
    const el = document.getElementById(`entry-${scrollTarget}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScrollTarget(null);
  }, [scrollTarget, entries, loading]);

  const allIcons = mergeAssets(icons, globalIcons, 'url');
  const allStats = mergeAssets(stats, globalStats, 'name');
  const allKeywords = globalKeywords;
  const allCapitalized = globalCapitalized;
  const allIconWords = mergeAssets(iconWords, globalIconWords, 'word');
  const iconValueMap = useMemo(() => {
    const m = {};
    (allIcons || []).forEach((ic) => { if (ic.url) m[ic.url] = ic.value || 0; });
    return m;
  }, [allIcons]);
  const keywordEntries = useMemo(() => [...(globalKeywords || []), ...(folderKeywords || [])], [globalKeywords, folderKeywords]);

  useEffect(() => {
    if (!selected) { setIcons([]); setStats([]); setIconWords([]); setFolderKeywords([]); return; }
    (async () => {
      try {
        const [ic, st, iw, kw] = await Promise.all([
          base44.entities.FolderIcon.filter({ folder_id: selected.folder_id }, '-created_date', 200),
          base44.entities.FolderStat.filter({ folder_id: selected.folder_id }, '-created_date', 200),
          base44.entities.FolderIconWord.filter({ folder_id: selected.folder_id }, '-created_date', 200),
          base44.entities.FolderKeyword.filter({ folder_id: selected.folder_id }, '-created_date', 200),
        ]);
        setIcons(ic || []);
        setStats(st || []);
        setIconWords(iw || []);
        setFolderKeywords(kw || []);
      } catch { setIcons([]); setStats([]); setIconWords([]); setFolderKeywords([]); }
    })();
  }, [selectedId, selected?.folder_id]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/clans" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <h1 className="text-lg font-bold font-heading text-foreground flex items-center gap-2">
                <Flag size={18} className="text-primary" /> Review
              </h1>
              <EditingUsersBar />
            </div>
            <DeflagOnParButton onDone={reload} />
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-4 flex gap-4" onClick={handleDeselect}>
        <div className="flex-1 min-w-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No entries flagged for review.</p>
          ) : (
            <div className="space-y-2.5">
              {entries.map((entry) => (
                <div key={entry.id} id={`entry-${entry.id}`}>
                  <EntryCard
                    entry={entry}
                    folderStats={allStats}
                    icons={allIcons}
                    keywords={allKeywords}
                    capitalized={allCapitalized}
                    iconWords={allIconWords}
                    supertypes={supertypes}
                    folderColor={folderColorMap[entry.folder_id] || ''}
                    selected={selectedId === entry.id}
                    editable={isAuthenticated}
                    onSelect={handleSelect}
                    onUpdate={updateEntry}
                    onToggleReview={toggleReview}
                    lockedBy={isLockedByOther(entry.id)}
                    dimmed={user ? (entry.flagged_by_id === user.id || (lastCommentByEntry[entry.id]?.created_by_id === user.id)) : false}
                    flaggedByName={entry.flagged_by_name || ''}
                  />
                  {selectedId === entry.id && (
                    <div className="lg:hidden mt-1 mb-1 bg-card border border-border rounded-lg p-4" onClick={(e) => e.stopPropagation()}>
                      <CardEvaluationPanel entry={entry} iconValueMap={iconValueMap} keywordEntries={keywordEntries} aiOverview={aiOverview?.text} onDeleteAiOverview={handleDeleteAiOverview} />
                      <EntryCommentSection entry={entry} onAiOverviewChange={setAiOverview} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 hidden lg:block">
          {selected ? (
            <div className="sticky top-20 bg-card border border-border rounded-lg p-4 h-[calc(100vh-7rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <CardEvaluationPanel entry={selected} iconValueMap={iconValueMap} keywordEntries={keywordEntries} aiOverview={aiOverview?.text} onDeleteAiOverview={handleDeleteAiOverview} />
              <div className="flex-1 min-h-0 flex flex-col">
                <EntryCommentSection entry={selected} onAiOverviewChange={setAiOverview} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center text-muted-foreground h-[60vh] border border-dashed border-border rounded-lg">
              <p className="text-sm">Select an entry to view and add comments</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}