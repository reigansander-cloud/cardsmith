import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Layers, Plus, Trash2, Settings } from 'lucide-react';
import EditingUsersBar from '@/components/folder/EditingUsersBar';
import DeckSettingsDialog from '@/components/decks/DeckSettingsDialog';
import { useDeckSettings } from '@/hooks/useDeckSettings';

export default function Decks() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { limits, updateLimits } = useDeckSettings();

  const load = async () => {
    try {
      const list = await base44.entities.Deck.list('-created_date', 200);
      setDecks((list || []).filter((d) => d.name !== 'AI Deck'));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const [folders, setFolders] = useState({});
  useEffect(() => {
    base44.entities.Folder.list('-created_date', 200).then((list) => {
      const m = {};
      (list || []).forEach((f) => { m[f.id] = f; });
      setFolders(m);
    }).catch(() => {});
  }, []);

  const createDeck = async () => {
    const deck = await base44.entities.Deck.create({ name: 'New Deck', cards: [] });
    navigate(`/deck/${deck.id}`);
  };

  const deleteDeck = async (id) => {
    await base44.entities.Deck.delete(id);
    setDecks((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/clans" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <h1 className="text-lg font-bold font-heading text-foreground">Deck Manager</h1>
              <EditingUsersBar />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings size={14} className="mr-2" /> Settings
              </Button>
              <Button variant="outline" size="sm" onClick={createDeck}>
                <Plus size={14} className="mr-2" /> New Deck
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">Loading…</p>
          ) : decks.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">No decks yet.</p>
          ) : decks.map((d) => {
            const folderColor = folders[d.folder_id]?.color;
            const hasColor = !!folderColor;
            return (
            <div key={d.id} className={`group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${hasColor ? 'border-black/10' : 'border-border bg-card hover:border-primary hover:bg-primary/5'}`} style={hasColor ? { backgroundColor: folderColor } : undefined}>
              <button className="flex flex-col items-center gap-2 w-full" onClick={() => navigate(`/deck/${d.id}`)}>
                <div className={`w-16 h-16 rounded-lg flex items-center justify-center transition-colors ${hasColor ? 'bg-black/10' : 'bg-muted group-hover:bg-primary/10'}`}>
                  <Layers size={30} className={`transition-colors ${hasColor ? 'text-black/70' : 'text-muted-foreground group-hover:text-primary'}`} />
                </div>
                <div className={`font-semibold text-sm text-center truncate w-full ${hasColor ? 'text-black' : 'text-foreground'}`}>{d.name}</div>
                <div className={`text-xs ${hasColor ? 'text-black/70' : 'text-muted-foreground'}`}>{folders[d.folder_id]?.name || 'No folder'}</div>
              </button>
              <button onClick={() => deleteDeck(d.id)} className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity ${hasColor ? 'text-black/70' : 'text-destructive'}`} title="Delete deck">
                <Trash2 size={14} />
              </button>
            </div>
            );
          })}
          <button
            className="group flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary hover:bg-primary/5 transition-all min-h-[120px]"
            onClick={createDeck}
          >
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Plus size={30} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="font-semibold text-foreground text-sm text-center">New Deck</div>
          </button>
        </div>
      </div>
      <DeckSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        copyLimits={limits}
        onSave={updateLimits}
      />
    </div>
  );
}