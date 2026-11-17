import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Users, ArrowLeft, Trash2 } from 'lucide-react';

// Lobby: deck selection + game creation (vs AI or multiplayer). Also shows
// open lobby games that other players have created, available to join.
export default function GameLobby({ onNavigate }) {
  const { user } = useAuth();
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [starting, setStarting] = useState(false);
  const [openLobbies, setOpenLobbies] = useState([]);
  const [activeGames, setActiveGames] = useState([]);

  useEffect(() => { base44.entities.Deck.list('-updated_date', 100).then((list) => setDecks((list || []).filter((d) => d.name !== 'AI Deck'))).catch(() => {}); }, []);

  const [folders, setFolders] = useState({});
  useEffect(() => {
    base44.entities.Folder.list('-created_date', 200).then((list) => {
      const m = {};
      (list || []).forEach((f) => { m[f.id] = f; });
      setFolders(m);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const refresh = () => {
      base44.entities.Game.filter({ status: 'lobby' }).then(setOpenLobbies).catch(() => {});
      // Active (in-progress) games the current user is a player in — these
      // can be rejoined. The game is persisted on the server, so leaving and
      // coming back resumes the same state.
      if (user?.id) base44.entities.Game.filter({ status: 'playing' }).then((gs) => {
        const all = gs || [];
        const mine = all.filter((g) => (g.players || []).some((p) => p.user_id === user.id));
        // A user should only have one active game at a time — if a more recent
        // game exists, auto-delete the older ones so stale sessions don't pile up.
        if (mine.length > 1) {
          mine.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
          mine.slice(1).forEach((g) => { base44.entities.Game.delete(g.id).catch(() => {}); });
        }
        setActiveGames(all);
      }).catch(() => {});
    };
    refresh();
    // Every move in every running game is a Game change, so re-list at most
    // about once a second instead of re-downloading all games on each move.
    let timer = null;
    const unsub = base44.entities.Game.subscribe(() => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; refresh(); }, 1000);
    });
    return () => { if (timer) clearTimeout(timer); unsub(); };
  }, [user?.id]);

  const createMultiplayer = async () => {
    if (!selectedDeck || starting) return;
    setStarting(true);
    try {
      const deckName = decks.find((d) => d.id === selectedDeck)?.name || 'Deck';
      const game = await base44.entities.Game.create({
        status: 'lobby', host_id: user.id, host_name: user.full_name || user.email, round: 0, phase: 'main',
        players: [{ user_id: user.id, user_name: user.full_name || user.email, deck_id: selectedDeck, deck_name: deckName, ready: true, is_ai: false, support: 0, energy: 0, flags: 0, end_round_pressed: false, income_selected: false, income_ack: false }],
        state: {},
      });
      onNavigate(`/play/${game.id}`);
    } catch (err) { console.error(err); }
    setStarting(false);
  };

  const deleteGame = async (gameId) => {
    try { await base44.entities.Game.delete(gameId); } catch (err) { console.error(err); }
  };

  const joinGame = async (lobby) => {
    if (!selectedDeck || starting) return;
    setStarting(true);
    try {
      const deckName = decks.find((d) => d.id === selectedDeck)?.name || 'Deck';
      // Added in one atomic step on the server, so two people joining at the
      // same moment both get in (and joining twice doesn't add you twice).
      await base44.entities.Game.append(lobby.id, 'players', { user_id: user.id, user_name: user.full_name || user.email, deck_id: selectedDeck, deck_name: deckName, ready: true, is_ai: false, support: 0, energy: 0, flags: 0, end_round_pressed: false, income_selected: false, income_ack: false }, { uniqueBy: 'user_id' });
      onNavigate(`/play/${lobby.id}`);
    } catch (err) { console.error(err); }
    setStarting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="h-14 flex items-center gap-3">
            <button onClick={() => onNavigate('/clans')} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-bold font-heading text-foreground">Play Clans</h1>
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Choose Your Deck</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {decks.length === 0 ? <p className="text-sm text-muted-foreground">No decks found. Create a deck first.</p> : decks.map((d) => {
              const folderColor = folders[d.folder_id]?.color;
              const hasColor = !!folderColor;
              return (
              <button key={d.id} onClick={() => setSelectedDeck(d.id)} style={hasColor ? { backgroundColor: folderColor } : undefined} className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${hasColor ? `${selectedDeck === d.id ? 'border-black ring-2 ring-black/30' : 'border-black/10 hover:border-black/30'} text-black` : `${selectedDeck === d.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'}`}`}>
                <div className={`font-medium text-sm ${hasColor ? 'text-black' : 'text-foreground'}`}>{d.name}</div>
                <div className={`text-xs mt-0.5 ${hasColor ? 'text-black/70' : 'text-muted-foreground'}`}>{folders[d.folder_id]?.name || 'No folder'}</div>
              </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={createMultiplayer} disabled={!selectedDeck || starting} className="w-full"><Users size={16} className="mr-2" /> Create Multiplayer Game</Button>
        </div>
        {activeGames.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Active Games</h2>
            <div className="flex flex-col gap-2">
              {activeGames.map((g) => {
                const isMine = (g.players || []).some((p) => p.user_id === user?.id);
                const opps = (g.players || []).filter((p) => p.user_id !== user?.id);
                return (
                  <div key={g.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card">
                    <div>
                      <div className="font-medium text-foreground text-sm">{isMine ? `vs ${opps.map((p) => p.user_name).join(', ') || 'Waiting…'}` : (g.players || []).map((p) => p.user_name).join(' vs ')}</div>
                      <div className="text-xs text-muted-foreground">Round {g.round || 0} · {g.phase}</div>
                    </div>
                    <div className="flex gap-2">
                      {isMine && <Button onClick={() => onNavigate(`/play/${g.id}`)} size="sm">Rejoin</Button>}
                      <Button onClick={() => deleteGame(g.id)} size="sm" variant="ghost" className="px-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {openLobbies.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Open Games</h2>
            <div className="flex flex-col gap-2">
              {openLobbies.map((lobby) => (
                <div key={lobby.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card">
                  <div>
                    <div className="font-medium text-foreground text-sm">{lobby.host_name}'s Game</div>
                    <div className="text-xs text-muted-foreground">{lobby.players?.length || 0}/3 players</div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => joinGame(lobby)} disabled={!selectedDeck || starting} size="sm">Join</Button>
                    <Button onClick={() => deleteGame(lobby.id)} size="sm" variant="ghost" className="px-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}