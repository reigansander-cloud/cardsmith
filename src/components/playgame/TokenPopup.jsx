import React from 'react';

const TOKEN_TYPES = [
  { key: 'support', label: 'Support', color: '#ffffff' },
  { key: 'damage', label: 'Damage', color: '#dc2626' },
  { key: 'prowess', label: 'Prowess', color: '#8b0000' },
  { key: 'armor', label: 'Armor', color: '#2563eb' },
  { key: 'charge', label: 'Charge', color: '#ca8a04' },
  { key: 'other', label: 'Other', color: '#28a745' },
  { key: 'duration', label: 'Duration', color: '#7c3aed' },
];

// Floating token-adjuster popup triggered by right-clicking a card. Shows
// 7 token types with +/- buttons, plus Graveyard, Clear All and Clear Support.
// A full-screen backdrop closes the popup on click or right-click.
export default function TokenPopup({ card, x, y, mstColor, onTokenChange, onClearTokens, onClearSupport, onSendToGraveyard, onClose }) {
  if (!card) return <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />;
  const tokens = card.tokens || {};
  const tokenTypes = mstColor
    ? [...TOKEN_TYPES, { key: 'mst', label: 'Mst', color: mstColor }]
    : TOKEN_TYPES;
  const popupWidth = 160;
  const clampedX = Math.min(Math.max(x, 10), window.innerWidth - popupWidth - 10);
  const clampedY = Math.min(Math.max(y, 10), window.innerHeight - 320);

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="fixed z-50 bg-card border border-border rounded-lg shadow-xl p-2" style={{ left: clampedX, top: clampedY, width: popupWidth }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-1">
          {tokenTypes.map((t) => (
            <div key={t.key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color, border: t.color === '#ffffff' ? '1px solid #666' : 'none' }} />
              <span className="text-[11px] flex-1">{t.label}</span>
              <button onClick={() => onTokenChange(card.id, null, t.key, -1)} className="w-5 h-5 rounded bg-destructive/15 text-destructive text-[11px] font-bold hover:bg-destructive/25">−</button>
              <span className="text-xs font-bold w-5 text-center">{tokens[t.key] || 0}</span>
              <button onClick={() => onTokenChange(card.id, null, t.key, 1)} className="w-5 h-5 rounded bg-primary/15 text-primary text-[11px] font-bold hover:bg-primary/25">+</button>
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-2 pt-1.5 border-t border-border">
          <button onClick={() => onSendToGraveyard?.(card.id)} className="flex-1 text-[10px] px-1 py-0.5 rounded bg-muted text-foreground font-medium hover:bg-muted/70">Graveyard</button>
          <button onClick={() => onClearTokens(card.id)} className="flex-1 text-[10px] px-1 py-0.5 rounded bg-destructive/15 text-destructive font-medium hover:bg-destructive/25">Clear All</button>
          <button onClick={() => onClearSupport(card.id)} className="flex-1 text-[10px] px-1 py-0.5 rounded bg-muted text-foreground font-medium hover:bg-muted/70">Clear Sup</button>
        </div>
      </div>
    </>
  );
}