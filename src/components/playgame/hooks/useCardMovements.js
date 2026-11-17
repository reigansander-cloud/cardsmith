import { useLayoutEffect, useRef } from 'react';

// Builds a map of cardId -> { zone, player_index, battlefield_id } for all
// cards in visible board zones (rearguard, side_cards, battlefield sides).
// Excludes hands (private), discards/banished/deleted (sidebar-only).
export function buildZoneMap(state) {
  const map = {};
  const indexCards = (cards, zone, pi, bfId) => {
    (cards || []).forEach((c) => {
      map[c.id] = { zone, player_index: pi, battlefield_id: bfId };
    });
  };
  const N = Math.max((state.rearguards || []).length, (state.side_cards || []).length, (state.new_zones || []).length, 2);
  for (let i = 0; i < N; i++) {
    indexCards(state.rearguards?.[i] || [], 'rearguard', i);
    indexCards(state.side_cards?.[i] || [], 'side_cards', i);
    indexCards(state.new_zones?.[i] || [], 'new_zone', i);
  }
  (state.battlefields || []).forEach((bf) => {
    for (let i = 0; i < (bf.sides || []).length; i++) indexCards(bf.sides?.[i] || [], 'battlefield', i, bf.id);
  });
  return map;
}

// Flat map of cardId -> card object (with entry_id) across all zones so we can
// look up a card's entry to check if it's a token, and find where a
// disappeared card went (hand or discard).
export function buildCardMap(state) {
  const map = {};
  const indexCards = (cards) => {
    (cards || []).forEach((c) => { map[c.id] = c; });
  };
  const N = Math.max((state.rearguards || []).length, (state.hands || []).length, (state.discards || []).length, 2);
  for (let i = 0; i < N; i++) {
    indexCards(state.rearguards?.[i] || []);
    indexCards(state.side_cards?.[i] || []);
    indexCards(state.hands?.[i] || []);
    indexCards(state.discards?.[i] || []);
    indexCards(state.new_zones?.[i] || []);
  }
  (state.battlefields || []).forEach((bf) => {
    for (let i = 0; i < (bf.sides || []).length; i++) indexCards(bf.sides?.[i] || []);
  });
  return map;
}

// Animates a card moving from one zone to another. The approach:
//
//  - Board-to-board ('visible'): clone the card's OWN previously-captured
//    markup (saved at its old position, so its inline pixel sizes already
//    match the from-zone). The clone is created immediately — before paint —
//    so it's visible at the source from frame 0 (no empty gap / flicker at
//    the destination, which is hidden). Two frames later, once shrink-to-fit
//    has committed the destination's real shrunk card width, the corrected
//    destination is measured and the clone flies there, scaling uniformly
//    from the from-zone size to the to-zone size.
//
//  - Spawn / from-hidden ('spawn', 'hidden'): the card is appearing fresh
//    (it wasn't on the board last frame), so there's no flicker risk from
//    waiting — the clone is built from the real destination card AFTER the
//    double-rAF correction, so it's at the correct shrunk size, then animated
//    from the source position (badge / spawn point) to the destination.
//
// All positions are read from getBoundingClientRect(), which already accounts
// for any ancestor CSS transform — so the wide view's zoom is inherently
// applied: if the view is zoomed 2×, both fromPos and destPos are 2× larger
// in screen space, and the clone (in fixed position) matches.
function animateMovement(m) {
  const destEl = document.querySelector(`[data-card-id="${m.cardId}"]`);
  if (!destEl) return;

  const originalOpacity = destEl.style.opacity;
  destEl.style.opacity = '0';

  const styleClone = (clone) => {
    clone.style.position = 'fixed';
    clone.style.top = '0';
    clone.style.left = '0';
    clone.style.margin = '0';
    clone.style.zIndex = '40';
    clone.style.pointerEvents = 'none';
    clone.style.transformOrigin = 'top left';
  };

  // Board-to-board: clone the source markup immediately (no flicker), then
  // measure the corrected destination and fly there.
  if (m.from === 'visible' && m.fromPos?.html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = m.fromPos.html;
    const clone = wrapper.firstElementChild;
    if (!clone) { destEl.style.opacity = originalOpacity; return; }
    clone.removeAttribute('data-card-id');
    styleClone(clone);
    clone.style.width = `${m.fromPos.width}px`;
    clone.style.height = `${m.fromPos.height}px`;
    clone.style.transform = `translate(${m.fromPos.x}px, ${m.fromPos.y}px) scale(1)`;
    clone.style.opacity = '0.85';
    document.body.appendChild(clone);

    // Wait for shrink-to-fit to correct the destination, then measure and fly.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const r = destEl.getBoundingClientRect();
        const destPos = { x: r.left, y: r.top, width: r.width, height: r.height };
        const endScale = m.fromPos.width ? destPos.width / m.fromPos.width : 1;
        clone.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease-out 0.5s';
        clone.offsetHeight;
        clone.style.transform = `translate(${destPos.x}px, ${destPos.y}px) scale(${endScale})`;
        clone.style.opacity = '0';
        setTimeout(() => { destEl.style.opacity = originalOpacity; }, 500);
        setTimeout(() => { if (clone.parentNode) clone.parentNode.removeChild(clone); }, 700);
      });
    });
    return;
  }

  // Spawn / from-hidden: build the clone from the real destination card after
  // shrink-to-fit has corrected its size.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const r = destEl.getBoundingClientRect();
      const destPos = { x: r.left, y: r.top, width: r.width, height: r.height };

      const clone = destEl.cloneNode(true);
      clone.removeAttribute('data-card-id');
      styleClone(clone);
      clone.style.width = `${destPos.width}px`;
      clone.style.height = `${destPos.height}px`;
      document.body.appendChild(clone);

      let startPos, startScale, startOpacity;
      if (m.from === 'spawn') {
        startPos = destPos;
        startScale = 0;
        startOpacity = '0';
      } else {
        startPos = m.sourcePos;
        startScale = destPos.width ? m.sourcePos.width / destPos.width : 1;
        startOpacity = '0.85';
      }

      clone.style.transform = `translate(${startPos.x}px, ${startPos.y}px) scale(${startScale})`;
      clone.style.opacity = startOpacity;
      clone.offsetHeight;

      if (m.from === 'spawn') {
        clone.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out';
        requestAnimationFrame(() => {
          clone.style.transform = `translate(${destPos.x}px, ${destPos.y}px) scale(1)`;
          clone.style.opacity = '0.9';
        });
        setTimeout(() => {
          destEl.style.opacity = originalOpacity;
          clone.style.transition = 'opacity 0.15s ease-out';
          clone.style.opacity = '0';
        }, 500);
      } else {
        clone.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease-out 0.5s';
        requestAnimationFrame(() => {
          clone.style.transform = `translate(${destPos.x}px, ${destPos.y}px) scale(1)`;
          clone.style.opacity = '0';
        });
        setTimeout(() => { destEl.style.opacity = originalOpacity; }, 500);
      }
      setTimeout(() => { if (clone.parentNode) clone.parentNode.removeChild(clone); }, 700);
    });
  });
}

// Animates a card shrinking from its board position to a hand or graveyard
// destination — the reverse of being played. Uses the saved outerHTML from
// the previous render to create the clone (the real card is already gone).
function animateShrink(m) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = m.html;
  const clone = wrapper.firstElementChild;
  if (!clone) return;
  clone.removeAttribute('data-card-id');
  clone.style.position = 'fixed';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.margin = '0';
  clone.style.zIndex = '40';
  clone.style.pointerEvents = 'none';
  clone.style.width = `${m.fromPos.width}px`;
  clone.style.height = `${m.fromPos.height}px`;
  clone.style.transformOrigin = 'top left';
  document.body.appendChild(clone);

  const endScale = m.fromPos.width ? m.destPos.width / m.fromPos.width : 0.3;
  clone.style.transform = `translate(${m.fromPos.x}px, ${m.fromPos.y}px) scale(1)`;
  clone.style.opacity = '0.85';
  clone.offsetHeight;

  clone.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease-out 0.4s';
  requestAnimationFrame(() => {
    clone.style.transform = `translate(${m.destPos.x}px, ${m.destPos.y}px) scale(${endScale})`;
    clone.style.opacity = '0';
  });

  setTimeout(() => {
    if (clone.parentNode) clone.parentNode.removeChild(clone);
  }, 700);
}

// Detects card zone changes from remote (opponent) updates and animates the
// movement. Uses useLayoutEffect to capture positions and hide the destination
// card before the browser paints, preventing a flash at the new position.
//
// localUpdateRef is read but NOT reset here — useRemoteAnimations (which runs
// as a useEffect, after this useLayoutEffect) owns the reset. This ensures
// both hooks see the correct wasLocal value for the same render. When wasLocal
// is true, ALL animations are skipped — you never see animations for actions
// you caused; the opponent sees them on their remote update.
export function useCardMovements({ game, myPlayerIndex, localUpdateRef, entries, ownAnimations }) {
  const prevZonesRef = useRef(null);
  const prevPhaseRef = useRef(null);
  const prevPositionsRef = useRef({});
  const prevHandsRef = useRef(null);
  const prevDiscardsRef = useRef(null);

  useLayoutEffect(() => {
    const wasLocal = localUpdateRef.current;
    const state = game?.state || {};
    const phase = game?.phase;

    const currentZones = buildZoneMap(state);
    const cardMap = buildCardMap(state);

    const prevZones = prevZonesRef.current;
    const prevPhase = prevPhaseRef.current;
    const prevPositions = prevPositionsRef.current;

    const prevHands = prevHandsRef.current;
    const prevDiscards = prevDiscardsRef.current;

    // Store current zones/phase/hands/discards synchronously for the next
    // comparison. Positions are captured separately (post-correction) below.
    prevZonesRef.current = currentZones;
    prevPhaseRef.current = phase;
    const NN = Math.max((state.hands || []).length, (state.discards || []).length, 2);
    prevHandsRef.current = Array.from({ length: NN }, (_, i) => (state.hands?.[i] || []).map((c) => c.id));
    prevDiscardsRef.current = Array.from({ length: NN }, (_, i) => (state.discards?.[i] || []).map((c) => c.id));

    // Capture post-correction positions for the next render's move detection.
    // Shrink-to-fit corrects card widths via rAF + setState, so the real
    // (shrunk) sizes only land in the DOM a couple of frames after this layout
    // effect — measuring synchronously here would snapshot the too-large max
    // widths, making the next move's fromPos (and thus the clone's start size)
    // way too large. Two rAFs lets the correction commit first. This runs on
    // EVERY render (including phase transitions and skipped frames) so
    // prevPositions never goes stale.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const positions = {};
        document.querySelectorAll('[data-card-id]').forEach((el) => {
          const rect = el.getBoundingClientRect();
          positions[el.dataset.cardId] = { x: rect.left, y: rect.top, width: rect.width, height: rect.height, html: el.outerHTML };
        });
        prevPositionsRef.current = positions;
      });
    });

    // Skip first run and phase transitions (rally moves many cards at once).
    // Local updates are skipped unless "Own Animations" is on — then you see
    // the same movement animations for your own actions that your opponent sees.
    if (!prevZones || (wasLocal && !ownAnimations)) return;
    if (phase !== prevPhase) return;

    // --- Cards that appeared or moved between visible zones ---
    for (const [cardId, newZone] of Object.entries(currentZones)) {
      const oldZone = prevZones[cardId];

      if (!oldZone) {
        // Card appeared in a visible zone from a hidden zone.
        if (!ownAnimations && newZone.player_index === myPlayerIndex) continue;
        const card = cardMap[cardId];
        const entry = card ? entries?.[card.entry_id] : null;
        if (entry?.supertype === 'token') {
          // Token: spawn in place and grow
          animateMovement({ cardId, from: 'spawn', destZone: newZone.zone });
        } else {
          // Non-token (from hand or graveyard): grow from that player's badge
          const pi = newZone.player_index;
          const wasInGraveyard = prevDiscards?.[pi]?.includes(cardId);
          const sourceSelector = wasInGraveyard ? `graveyard-${pi}` : `hand-${pi}`;
          const sourceEl = document.querySelector(`[data-anim-source="${sourceSelector}"]`);
          if (!sourceEl) continue;
          const sr = sourceEl.getBoundingClientRect();
          animateMovement({
            cardId,
            from: 'hidden',
            destZone: newZone.zone,
            sourcePos: { x: sr.left, y: sr.top, width: sr.width, height: sr.height },
          });
        }
      } else if (
        oldZone.zone !== newZone.zone ||
        oldZone.player_index !== newZone.player_index ||
        oldZone.battlefield_id !== newZone.battlefield_id
      ) {
        // Card moved between visible zones (e.g. rearguard → battlefield).
        if (!ownAnimations && newZone.player_index === myPlayerIndex && oldZone.player_index === myPlayerIndex) continue;
        const fromPos = prevPositions[cardId];
        if (!fromPos) continue;
        animateMovement({
          cardId,
          from: 'visible',
          destZone: newZone.zone,
          fromPos,
        });
      }
    }

    // --- Cards that disappeared from visible zones (to hand or graveyard) ---
    for (const [cardId, oldZone] of Object.entries(prevZones)) {
      if (currentZones[cardId]) continue; // still visible, handled above
      const prevPos = prevPositions[cardId];
      if (!prevPos || !prevPos.html) continue;

      // Find where the card went
      let destSelector = null;
      const NN = Math.max((state.hands || []).length, (state.discards || []).length, 2);
      for (let i = 0; i < NN; i++) {
        if ((state.hands?.[i] || []).some((c) => c.id === cardId)) { destSelector = `hand-${i}`; break; }
        if ((state.discards?.[i] || []).some((c) => c.id === cardId)) { destSelector = `graveyard-${i}`; break; }
      }
      if (!destSelector) continue; // went to banished/deleted/elsewhere — skip

      const destEl = document.querySelector(`[data-anim-source="${destSelector}"]`);
      if (!destEl) continue;
      const dr = destEl.getBoundingClientRect();
      animateShrink({
        cardId,
        fromPos: prevPos,
        html: prevPos.html,
        destPos: { x: dr.left, y: dr.top, width: dr.width, height: dr.height },
      });
    }
  }, [game, myPlayerIndex, entries]);
}