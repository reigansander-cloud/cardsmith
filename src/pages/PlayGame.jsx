import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '@/hooks/useGame';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import GameLobby from '@/components/playgame/GameLobby';
import GameTable from '@/components/playgame/GameTable';
import { initializeGameState } from '@/lib/gameInit';
import { ensureAIDeck } from '@/lib/aiDeck';
import { FolderColorContext } from '@/components/playgame/FolderColorContext';
import { PointerDragProvider } from '@/context/PointerDragContext';
import { appUrl } from '@/lib/appUrl';

export default function PlayGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  if (!gameId) return <GameLobby onNavigate={(path) => navigate(path)} />;
  return <GameView gameId={gameId} />;
}

function GameView({ gameId }) {
  const { game, entries, supertypes, folderEntries, folderColors, foghollowColor, loading, user, myPlayerIndex, updateGame, updateCoordination, updateState, updatePlayers, updateZones } = useGame(gameId);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!game) return (
    <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4">
      <p className="text-muted-foreground">Game not found.</p>
      <Button onClick={() => window.location.href = appUrl('/play')}>Back to Lobby</Button>
    </div>
  );

  if (game.status === 'lobby') return <WaitingScreen game={game} user={user} />;

  if (game.status === 'playing') {
    if (myPlayerIndex < 0) return (
      <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4">
        <p className="text-muted-foreground">You are not a player in this game.</p>
        <Button onClick={() => window.location.href = appUrl('/play')}>Back to Lobby</Button>
      </div>
    );
    return <FolderColorContext.Provider value={folderColors}><PointerDragProvider entries={entries} supertypes={supertypes}><GameTable game={game} entries={entries} supertypes={supertypes} folderEntries={folderEntries} foghollowColor={foghollowColor} myPlayerIndex={myPlayerIndex} updateGame={updateGame} updateCoordination={updateCoordination} updateState={updateState} updatePlayers={updatePlayers} updateZones={updateZones} /></PointerDragProvider></FolderColorContext.Provider>;
  }

  return null;
}

function WaitingScreen({ game, user }) {
  const [filling, setFilling] = useState(false);
  const isHost = game.host_id === user?.id;
  const playerCount = game.players?.length || 0;

  const startGame = async () => {
    setFilling(true);
    try {
      await initializeGameState(game.id, game.players);
    } catch (err) { console.error(err); }
    setFilling(false);
  };

  const fillWithAI = async () => {
    setFilling(true);
    try {
      const aiDeckId = await ensureAIDeck();
      await base44.entities.Game.append(game.id, 'players', { user_id: '', user_name: `AI ${playerCount + 1}`, deck_id: aiDeckId, deck_name: 'AI Deck', ready: true, is_ai: true, support: 0, energy: 0, flags: 0, end_round_pressed: false, income_selected: false, income_ack: false });
    } catch (err) { console.error(err); }
    setFilling(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-6">
      <h2 className="text-xl font-bold text-foreground">Waiting Room</h2>
      <p className="text-sm text-muted-foreground">{playerCount} player(s) joined</p>
      <p className="text-sm text-muted-foreground">Share this game ID: <code className="bg-muted px-2 py-0.5 rounded">{game.id}</code></p>
      {isHost ? (
        <div className="flex gap-3">
          <Button onClick={startGame} disabled={filling || playerCount < 2}>{filling ? 'Starting...' : `Start Game (${playerCount} players)`}</Button>
          {playerCount < 3 && <Button onClick={fillWithAI} disabled={filling} variant="outline">Add AI</Button>}
        </div>
      ) : (
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      )}
    </div>
  );
}