import { useLayoutEffect, useRef } from 'react';

// Animates battlefield destruction/replacement for both players (local and
// remote). When a battlefield ID changes at the same array position, the old
// battlefield clone shrinks to its center and fades out, then the new
// battlefield element grows from scale 0 to full size.
function animateBfReplace(oldPos, newBfId) {
  // 1. Clone old bf and animate shrink
  const wrapper = document.createElement('div');
  wrapper.innerHTML = oldPos.html;
  const oldClone = wrapper.firstElementChild;
  if (!oldClone) return;
  oldClone.removeAttribute('data-bf-id');
  oldClone.style.position = 'fixed';
  oldClone.style.top = '0';
  oldClone.style.left = '0';
  oldClone.style.margin = '0';
  oldClone.style.zIndex = '40';
  oldClone.style.pointerEvents = 'none';
  oldClone.style.width = `${oldPos.width}px`;
  oldClone.style.height = `${oldPos.height}px`;
  oldClone.style.transformOrigin = 'top left';
  document.body.appendChild(oldClone);
  oldClone.style.transform = `translate(${oldPos.x}px, ${oldPos.y}px) scale(1)`;
  oldClone.style.opacity = '1';
  oldClone.offsetHeight;
  oldClone.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease-out 0.25s';
  requestAnimationFrame(() => {
    oldClone.style.transform = `translate(${oldPos.x + oldPos.width / 2}px, ${oldPos.y + oldPos.height / 2}px) scale(0)`;
    oldClone.style.opacity = '0';
  });
  setTimeout(() => {
    if (oldClone.parentNode) oldClone.parentNode.removeChild(oldClone);
  }, 600);

  // 2. Hide new bf, then grow it after the shrink completes
  const newEl = document.querySelector(`[data-bf-id="${newBfId}"]`);
  if (!newEl) return;
  newEl.style.transformOrigin = 'top left';
  newEl.style.transform = 'scale(0)';
  newEl.style.opacity = '0';
  newEl.offsetHeight;
  setTimeout(() => {
    newEl.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out';
    requestAnimationFrame(() => {
      newEl.style.transform = 'scale(1)';
      newEl.style.opacity = '1';
    });
    setTimeout(() => {
      newEl.style.transition = '';
      newEl.style.transform = '';
      newEl.style.opacity = '';
    }, 500);
  }, 400);
}

// Detects battlefield ID changes between renders and triggers the
// shrink/spawn animation. Runs for both local and remote updates so both
// players see the destruction animation.
export function useBfAnimations({ game }) {
  const prevBfIdsRef = useRef(null);
  const prevPositionsRef = useRef({});

  useLayoutEffect(() => {
    const state = game?.state || {};
    const currentBfIds = (state.battlefields || []).map((bf) => bf.id);

    const currentPositions = {};
    document.querySelectorAll('[data-bf-id]').forEach((el) => {
      const rect = el.getBoundingClientRect();
      currentPositions[el.dataset.bfId] = { x: rect.left, y: rect.top, width: rect.width, height: rect.height, html: el.outerHTML };
    });

    const prevBfIds = prevBfIdsRef.current;
    const prevPositions = prevPositionsRef.current;

    prevBfIdsRef.current = currentBfIds;
    prevPositionsRef.current = currentPositions;

    if (!prevBfIds) return; // skip first run

    for (let i = 0; i < prevBfIds.length; i++) {
      const oldId = prevBfIds[i];
      const newId = currentBfIds[i];
      if (oldId && newId && oldId !== newId) {
        const oldPos = prevPositions[oldId];
        if (oldPos) animateBfReplace(oldPos, newId);
      }
    }
  }, [game]);
}