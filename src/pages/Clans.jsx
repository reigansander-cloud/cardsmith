import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Layers, Plus, LayoutTemplate, Flag, BookOpen, Settings, Trash2, Swords } from 'lucide-react';
import FolderIconsDialog from '@/components/folder/FolderIconsDialog';
import EditingUsersBar from '@/components/folder/EditingUsersBar';
import { useGlobalAssets, refreshGlobalAssets } from '@/hooks/useGlobalAssets';

// The "Clans" hub: a disabled Deck Manager banner + folder cards that each
// open a dedicated folder page. A Review button in the header goes to the
// flagged-entries review page.
export default function Clans() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retryDisabled, setRetryDisabled] = useState(false);
  const retryTimerRef = useRef(null);
  const navigate = useNavigate();
  const globalAssets = useGlobalAssets();
  const globalIcons = globalAssets?.icons || [];
  const globalStats = globalAssets?.stats || [];
  const globalKeywords = globalAssets?.keywords || [];
  const globalCapitalized = globalAssets?.capitalized || [];
  const globalIconWords = globalAssets?.iconWords || [];
  const globalSupertypes = globalAssets?.supertypes || [];
  const [assetsOpen, setAssetsOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await base44.entities.Folder.list('-created_date', 100);
      // Alphabetical by name (case-insensitive) so the folder grid stays
      // predictable as clans are added.
      setFolders(
        (list || [])
          .filter((f) => f.name !== 'AI Bots')
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
      );
    } catch (err) {
      const status = err?.status || err?.response?.status;
      const body = err?.data || err?.response?.data || err?.message || 'Unknown error';
      setLoadError({ status, body });
    }
    setLoading(false);
  };

  // Disable the retry button for 3s after an error appears or a retry is clicked
  const armRetry = useCallback(() => {
    setRetryDisabled(true);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => setRetryDisabled(false), 3000);
  }, []);
  useEffect(() => {
    if (loadError) armRetry();
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, [loadError, armRetry]);
  const handleRetry = () => { armRetry(); load(); };

  useEffect(() => { load(); }, []);

  const createFolder = async () => {
    const folder = await base44.entities.Folder.create({ name: 'New Folder' });
    navigate(`/folder/${folder.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <h1 className="text-lg font-bold font-heading text-foreground">Clans</h1>
              <EditingUsersBar />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto min-w-0 flex-shrink [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => navigate('/clans/rules')}>
                <BookOpen size={14} className="mr-2" /> Rules
              </Button>
              <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => navigate('/clans/review')}>
                <Flag size={14} className="mr-2" /> Review
              </Button>
              <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => navigate('/clans/recently-deleted')}>
                <Trash2 size={14} className="mr-2" /> Recently Deleted
              </Button>
              <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => setAssetsOpen(true)}>
                <Settings size={14} className="mr-2" /> Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-8">
          <div className="w-full max-w-3xl flex flex-col gap-4">
          <div className="flex gap-4 w-full">
            <button
              className="group flex flex-col items-center gap-3 flex-1 px-6 py-4 rounded-lg border-2 border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-all"
              onClick={() => navigate('/play')}
            >
              <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Swords size={30} className="text-primary" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground text-lg">Play Clans</div>
                <div className="text-sm text-muted-foreground mt-0.5">Start a tabletop game</div>
              </div>
            </button>
            <button
              className="group flex flex-col items-center gap-3 flex-1 px-6 py-4 rounded-lg border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all"
              onClick={() => navigate('/decks')}
            >
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <LayoutTemplate size={30} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground text-lg">Deck Manager</div>
                <div className="text-sm text-muted-foreground mt-0.5">Build and print decks</div>
              </div>
            </button>
          </div>

            {loadError && !loading && (
              <div className="w-full flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">Failed to load folders.</p>
                <div className="text-xs text-muted-foreground/70 font-mono bg-muted/50 rounded px-3 py-2 max-w-md break-all">
                  {loadError.status ? `Status ${loadError.status}: ` : ''}{typeof loadError.body === 'string' ? loadError.body : JSON.stringify(loadError.body)}
                </div>
                <Button variant="outline" size="sm" disabled={retryDisabled} onClick={handleRetry}>
                  Try again
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              {folders.map((f) => (
                <button
                  key={f.id}
                  className="group flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-200"
                  onClick={() => navigate(`/folder/${f.id}`)}
                >
                  <div
                    className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors"
                    style={f.color ? { backgroundColor: f.color } : undefined}
                  >
                    <Layers size={30} className="text-muted-foreground group-hover:text-primary transition-colors" style={f.color ? { color: 'rgba(0,0,0,0.45)' } : undefined} />
                  </div>
                  <div className="font-semibold text-foreground text-sm text-center truncate w-full">{f.name}</div>
                </button>
              ))}
              <button
                className="group flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-200 min-h-[120px]"
                onClick={createFolder}
              >
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Plus size={30} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="font-semibold text-foreground text-sm text-center">New Folder</div>
              </button>
            </div>
          </div>
        </div>
      </div>
      <FolderIconsDialog
        open={assetsOpen}
        onOpenChange={setAssetsOpen}
        folderId="__global__"
        title="Clans Assets"
        icons={globalIcons}
        onIconsChange={refreshGlobalAssets}
        stats={globalStats}
        onStatsChange={refreshGlobalAssets}
        keywords={globalKeywords}
        onKeywordsChange={refreshGlobalAssets}
        capitalized={globalCapitalized}
        onCapitalizedChange={refreshGlobalAssets}
        iconWords={globalIconWords}
        onIconWordsChange={refreshGlobalAssets}
        supertypes={globalSupertypes}
        onSupertypesChange={refreshGlobalAssets}
      />
    </div>
  );
}