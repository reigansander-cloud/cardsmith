import React, { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import MiniEntry from '../MiniEntry';
import { buildZoneMap, buildCardMap } from './useCardMovements';

const CARD_BACK_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/516417bcba_ec1ad09b0_CardBack.png';

// Builds a fixed-position clone of a card for the animation.
//  - When we have the card's saved outerHTML (it was rendered in the DOM last
//    frame) we clone that — it already reflects the correct face.
//  - Otherwise (opponent's hidden hand / graveyard, no DOM element) we render
//    the card's front via MiniEntry — unless the card was flipped face-down,
//    in which case we show the card back.
function makeClone({ html, entry, supertypes, flipped, width, height }) {
  if (html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const clone = wrapper.firstElementChild;
    if (!clone) return null;
    clone.removeAttribute('data-card-id');
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    return { node: clone, root: null };
  }
  if (flipped) {
    const wrap = document.createElement('div');
    wrap.style.width = `${width}px`;
    wrap.style.height = `${height}px`;
    wrap.style.borderRadius = '6px';
    wrap.style.overflow = 'hidden';
    const img = document.createElement('img');
    img.src = CARD_BACK_URL;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    wrap.appendChild(img);
    return { node: wrap, root: null };
  }
  if (!entry) return null;
  // Render the card front into a detached React root so the animation shows
  // the actual card face for hidden-zone cards (e.g. opponent's hand).
  const container = document.createElement('div');
  container.style.width = `${width}px`;
  container.style.borderRadius = '6px';
  container.style.overflow = 'hidden';
  const root = createRoot(container);
  flushSync(() => {
    root.render(React.createElement(MiniEntry, { entry, supertypes, targetWidth: width }));
  });
  return { node: container, root };
}

function styleClone(clone) {
  clone.style.position = 'fixed';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.margin = '0';
  clone.style.zIndex = '40';
  clone.style.pointerEvents = 'none';
  clone.style.transformOrigin = 'top left';
}

// Card moves from a visible board zone (rearguard / active battlefield) to a
// non-focused battlefield: shrink from its previous position into the bf square.
// bfId (not a pre-measured position) is passed in so the destination is
// measured live, right before the fly-in starts — see the comment in
// useCardMovements.js's animateMovement for why: the battlefield tile's
// width (from useShrinkToFitVertical) can still reflect its previous,
// often-larger size at the instant this card's move commits.
function animateToBf({ fromPos, bfId, html }) {
  const made = makeClone({ html, width: fromPos.width, height: fromPos.height });
  if (!made) return;
  const clone = made.node;
  styleClone(clone);
  document.body.appendChild(clone);
  clone.style.transform = `translate(${fromPos.x}px, ${fromPos.y}px) scale(1)`;
  clone.style.opacity = '0.85';
  clone.offsetHeight;
  clone.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease-out 0.4s';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const bfEl = document.querySelector(`[data-bf-id="${bfId}"]`);
      if (!bfEl) { clone.style.opacity = '0'; return; }
      const r = bfEl.getBoundingClientRect();
      const finalScale = r.width / fromPos.width;
      clone.style.transform = `translate(${r.left}px, ${r.top}px) scale(${finalScale})`;
      clone.style.opacity = '0';
    });
  });
  setTimeout(() => {
    if (clone.parentNode) clone.parentNode.removeChild(clone);
    if (made.root) made.root.unmount();
  }, 700);
}

// Card moves from hand (or graveyard) to a non-focused battlefield: first grow
// from the hand/graveyard origin so the card is readable, then travel to the
// battlefield square while shrinking. Same live-measurement reasoning as
// animateToBf above — bfId is measured just before the fly-in starts.
function animateHandToBf({ sourcePos, bfId, html, entry, supertypes, flipped }) {
  // Reuse the saved DOM html when available (face-up shows the real front,
  // face-down shows the card-back). Only render MiniEntry when there's no DOM
  // element (the opponent's hidden hand).
  const useHtml = html || null;
  const cloneW = useHtml ? sourcePos.width : 80;
  const cloneH = useHtml ? sourcePos.height : 112;
  const made = makeClone({ html: useHtml, entry, supertypes, flipped, width: cloneW, height: cloneH });
  if (!made) return;
  const clone = made.node;
  styleClone(clone);
  document.body.appendChild(clone);

  // Travel from the source to the battlefield and shrink — no grow phase.
  clone.style.transform = `translate(${sourcePos.x}px, ${sourcePos.y}px) scale(0.7)`;
  clone.style.opacity = '0.95';
  clone.offsetHeight;
  clone.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease-out 0.4s';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const bfEl = document.querySelector(`[data-bf-id="${bfId}"]`);
      if (!bfEl) { clone.style.opacity = '0'; return; }
      const r = bfEl.getBoundingClientRect();
      const finalScale = Math.min(r.width / cloneW, 0.7);
      clone.style.transform = `translate(${r.left}px, ${r.top}px) scale(${finalScale})`;
      clone.style.opacity = '0';
    });
  });
  setTimeout(() => {
    if (clone.parentNode) clone.parentNode.removeChild(clone);
    if (made.root) made.root.unmount();
  }, 700);
}

// Animates cards that move to a battlefield that is NOT the active/focused
// one. Runs for both local and remote updates — unlike useCardMovements
// (which skips your own actions), you see these animations for your own cards
// too, since non-focused battlefield cards otherwise just vanish with no
// feedback. From-hand cards grow from the hand then shrink to the battlefield;
// cards already on the board shrink from their previous position.
export function useBfMoveAnimations({ game, entries, supertypes }) {
  const prevZonesRef = useRef(null);
  const prevPositionsRef = useRef({});
  const prevHandsRef = useRef(null);
  const prevDiscardsRef = useRef(null);
  const prevPhaseRef = useRef(null);

  useLayoutEffect(() => {
    const state = game?.state || {};
    const phase = game?.phase;
    const activeBfId = state.active_battlefield_id;

    const currentZones = buildZoneMap(state);
    const cardMap = buildCardMap(state);

    const currentPositions = {};
    document.querySelectorAll('[data-card-id]').forEach((el) => {
      const rect = el.getBoundingClientRect();
      currentPositions[el.dataset.cardId] = { x: rect.left, y: rect.top, width: rect.width, height: rect.height, html: el.outerHTML };
    });
    const bfPositions = {};
    document.querySelectorAll('[data-bf-id]').forEach((el) => {
      const rect = el.getBoundingClientRect();
      bfPositions[el.dataset.bfId] = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    });

    const prevZones = prevZonesRef.current;
    const prevPositions = prevPositionsRef.current;
    const prevHands = prevHandsRef.current;
    const prevDiscards = prevDiscardsRef.current;
    const prevPhase = prevPhaseRef.current;

    prevZonesRef.current = currentZones;
    prevPositionsRef.current = currentPositions;
    prevHandsRef.current = [0, 1].map((i) => (state.hands?.[i] || []).map((c) => c.id));
    prevDiscardsRef.current = [0, 1].map((i) => (state.discards?.[i] || []).map((c) => c.id));
    prevPhaseRef.current = phase;

    if (!prevZones || phase !== prevPhase) return;

    for (const [cardId, newZone] of Object.entries(currentZones)) {
      if (newZone.zone !== 'battlefield') continue;
      if (newZone.battlefield_id === activeBfId) continue;
      const oldZone = prevZones[cardId];
      // Already sitting in this same non-focused battlefield — no move to animate.
      if (oldZone && oldZone.zone === 'battlefield' && oldZone.battlefield_id === newZone.battlefield_id) continue;

      const bfPos = bfPositions[newZone.battlefield_id];
      if (!bfPos) continue;

      const wasInHandIdx = prevHands?.[0]?.includes(cardId) ? 0 : (prevHands?.[1]?.includes(cardId) ? 1 : -1);
      const wasInGraveIdx = prevDiscards?.[0]?.includes(cardId) ? 0 : (prevDiscards?.[1]?.includes(cardId) ? 1 : -1);

      if (wasInHandIdx >= 0 || wasInGraveIdx >= 0) {
        const fromHand = wasInHandIdx >= 0;
        const playerIdx = fromHand ? wasInHandIdx : wasInGraveIdx;
        // Prefer the card's own previous DOM position (local hand cards are
        // rendered); fall back to the zone badge (opponent hand / graveyard).
        let sourcePos = prevPositions[cardId];
        let html = sourcePos?.html;
        if (!sourcePos) {
          const sourceSelector = fromHand ? `hand-${playerIdx}` : `graveyard-${playerIdx}`;
          const sourceEl = document.querySelector(`[data-anim-source="${sourceSelector}"]`);
          if (!sourceEl) continue;
          const sr = sourceEl.getBoundingClientRect();
          sourcePos = { x: sr.left, y: sr.top, width: sr.width, height: sr.height };
          html = null;
        }
        const card = cardMap[cardId];
        const entry = card ? entries?.[card.entry_id] : null;
        animateHandToBf({ sourcePos, bfId: newZone.battlefield_id, html, entry, supertypes, flipped: !!card?.flipped });
      } else if (oldZone && prevPositions[cardId]) {
        animateToBf({ fromPos: prevPositions[cardId], bfId: newZone.battlefield_id, html: prevPositions[cardId].html });
      }
    }
  }, [game, entries, supertypes]);
}