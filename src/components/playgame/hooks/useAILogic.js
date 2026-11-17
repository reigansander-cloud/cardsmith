import { useEffect, useRef } from 'react';
import { clone, applyStatsOnPlay } from '../gameUtils';

// Handles AI player behavior: playing cards to rearguard on round transitions.
// Only runs on the host's client (or the human when all opponents are AI) to
// prevent duplicate updates.
export function useAILogic({ game, state, players, entries, shouldTransition, updateZones }) {
  const lastRoundRef = useRef(-1);

  // AI plays cards from hand to rearguard on round transitions:
  // round 1 → play 4, each subsequent round → play 3 more.
  useEffect(() => {
    if (!shouldTransition) return;
    if (game.round < 1) return;
    if (game.round === lastRoundRef.current) return;
    lastRoundRef.current = game.round;

    const playCount = game.round === 1 ? 4 : 3;

    updateZones((s) => {
      let changed = false;
      const ns = clone(s);
      for (let i = 0; i < (ns.hands || []).length; i++) {
        if (!players[i]?.is_ai) continue;
        const hand = [...(ns.hands[i] || [])];
        const rearguard = [...(ns.rearguards[i] || [])];
        const toPlay = Math.min(playCount, hand.length);
        for (let j = 0; j < toPlay; j++) {
          const card = hand.shift();
          if (card) { applyStatsOnPlay(card, entries); rearguard.push(card); changed = true; }
        }
        ns.hands[i] = hand;
        ns.rearguards[i] = rearguard;
      }
      return changed ? ns : s;
    }, ['hands', 'rearguards']);
  }, [game.round, shouldTransition, players, entries, updateZones]);
}