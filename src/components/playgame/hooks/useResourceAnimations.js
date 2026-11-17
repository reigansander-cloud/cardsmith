import { useState, useCallback } from 'react';

// Manages resource (flags/support/energy) change animations and flash states.
// Animations fire directly from mutation handlers — no tree-diffing effects.
export function useResourceAnimations() {
  const [resourceAnims, setResourceAnims] = useState([]);
  const [resourceFlash, setResourceFlash] = useState({});

  const emitResourceAnim = useCallback((pIdx, res, delta) => {
    if (delta === 0) return;
    const id = Date.now() + Math.random();
    setResourceAnims((prev) => [...prev, { playerIndex: pIdx, resource: res, delta, id }]);
    setResourceFlash((prev) => ({ ...prev, [`${pIdx}_${res}`]: delta > 0 ? 'pos' : 'neg' }));
    setTimeout(() => setResourceFlash((prev) => { const np = { ...prev }; delete np[`${pIdx}_${res}`]; return np; }), 400);
    setTimeout(() => setResourceAnims((prev) => prev.filter((a) => a.id !== id)), 1500);
  }, []);

  return { resourceAnims, resourceFlash, emitResourceAnim };
}