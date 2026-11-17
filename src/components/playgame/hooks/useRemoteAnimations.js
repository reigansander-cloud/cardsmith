import { useEffect, useRef } from 'react';

// Builds a map of cardId -> { tokenType: value } for all visible cards
// (excludes cards in either player's hand since hand cards are private).
function buildTokenMap(state) {
  const map = {};
  const indexCards = (cards) => {
    (cards || []).forEach((c) => {
      if (c.tokens && Object.keys(c.tokens).length > 0) map[c.id] = { ...c.tokens };
      if (c.attachments) c.attachments.forEach((a) => {
        if (a.tokens && Object.keys(a.tokens).length > 0) map[a.id] = { ...a.tokens };
      });
    });
  };
  for (let i = 0; i < 2; i++) {
    indexCards(state?.rearguards?.[i] || []);
    indexCards(state?.side_cards?.[i] || []);
    indexCards(state?.discards?.[i] || []);
    indexCards(state?.banished?.[i] || []);
    indexCards(state?.deleted?.[i] || []);
  }
  (state?.battlefields || []).forEach((bf) => {
    for (let i = 0; i < 2; i++) indexCards(bf.sides?.[i] || []);
  });
  return map;
}

// Detects changes from remote (other player's) updates and emits animations
// for them. Uses localUpdateRef to skip changes made locally — those are
// already animated by the mutation handlers in useCardInteractions.
export function useRemoteAnimations({ game, emitResourceAnim, emitTokenAnim, localUpdateRef }) {
  const prevRef = useRef(null);

  useEffect(() => {
    const wasLocal = localUpdateRef.current;
    localUpdateRef.current = false;

    const state = game?.state || {};
    const players = game?.players || [];

    const snapshot = {
      hands: [0, 1].map((i) => (state.hands?.[i] || []).length),
      discards: [0, 1].map((i) => (state.discards?.[i] || []).length),
      decks: [0, 1].map((i) => (state.decks?.[i] || []).length),
      resources: players.map((p) => ({ flags: p?.flags || 0, support: p?.support || 0, energy: p?.energy || 0 })),
      cardTokens: buildTokenMap(state),
    };

    const prev = prevRef.current;
    prevRef.current = snapshot;

    if (!prev || wasLocal) return;

    // Resource changes (flags, support, energy)
    for (let i = 0; i < 2; i++) {
      const oldR = prev.resources[i] || { flags: 0, support: 0, energy: 0 };
      const newR = snapshot.resources[i] || { flags: 0, support: 0, energy: 0 };
      for (const res of ['flags', 'support', 'energy']) {
        const delta = (newR[res] || 0) - (oldR[res] || 0);
        if (delta !== 0) emitResourceAnim(i, res, delta);
      }
    }

    // Section count changes (hand, discard, deck)
    for (let i = 0; i < 2; i++) {
      const handDelta = snapshot.hands[i] - prev.hands[i];
      if (handDelta !== 0) emitResourceAnim(i, 'hand', handDelta);
      const discardDelta = snapshot.discards[i] - prev.discards[i];
      if (discardDelta !== 0) emitResourceAnim(i, 'discard', discardDelta);
      const deckDelta = snapshot.decks[i] - prev.decks[i];
      if (deckDelta !== 0) emitResourceAnim(i, 'deck', deckDelta);
    }

    // Token changes on visible cards (not in hands)
    const newTokens = snapshot.cardTokens;
    const oldTokens = prev.cardTokens;
    const allCardIds = new Set([...Object.keys(newTokens), ...Object.keys(oldTokens)]);
    for (const cardId of allCardIds) {
      const nt = newTokens[cardId] || {};
      const ot = oldTokens[cardId] || {};
      const allKeys = new Set([...Object.keys(nt), ...Object.keys(ot)]);
      for (const key of allKeys) {
        const delta = (nt[key] || 0) - (ot[key] || 0);
        if (delta !== 0) emitTokenAnim(cardId, key, delta);
      }
    }
  }, [game, emitResourceAnim, emitTokenAnim, localUpdateRef]);
}