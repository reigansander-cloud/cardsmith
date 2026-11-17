import { useState, useCallback } from 'react';
import { TOKEN_COLORS } from '../gameUtils';

// Manages token change animations. Animations fire directly from mutation
// handlers — no tree-diffing effects.
export function useTokenAnimations() {
  const [tokenAnims, setTokenAnims] = useState([]);

  const emitTokenAnim = useCallback((cardId, tokenType, delta) => {
    if (delta === 0) return;
    const color = TOKEN_COLORS[tokenType] || '#666';
    const id = Date.now() + Math.random();
    setTokenAnims((prev) => [...prev, { cardId, delta, color: color === '#ffffff' ? '#ccc' : color, id }]);
    setTimeout(() => setTokenAnims((prev) => prev.filter((a) => a.id !== id)), 1500);
  }, []);

  const emitClearAnim = useCallback((cardId) => {
    const id = Date.now() + Math.random();
    setTokenAnims((prev) => [...prev, { cardId, delta: 0, color: '#ef4444', text: 'CLEAR', id }]);
    setTimeout(() => setTokenAnims((prev) => prev.filter((a) => a.id !== id)), 1500);
  }, []);

  return { tokenAnims, emitTokenAnim, emitClearAnim };
}