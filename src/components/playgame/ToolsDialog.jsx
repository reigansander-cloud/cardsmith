import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { HOTKEY_LABELS, formatKey } from '@/lib/hotkeys';

const TOOL_LABELS = { income: 'Income Options', dice: 'Dice', random: 'Random', wideView: 'Wide View' };

const STRENGTH_KEYS = [
  { key: 'clash', label: 'Live Strength Clash' },
  { key: 'rearguard', label: 'Live Strength Rearguard' },
  { key: 'hand', label: 'Live Strength Hand' },
];

const SECTION_EXPLANATIONS = {
  strength: "Shows each card's live influence total on the board — base influence plus support tokens minus damage tokens, multiplied by stack count. Turn it on per zone: Clash (active battlefield), Rearguard, or Hand.",
  display: "Small Tokens shrinks token cards to 80% on the battlefield for clarity. Zoom Hover shows a large preview when you hover a card or battlefield; scroll while it's open to change its scale. Instant Zoom Hover removes the hover delay so popups appear instantly everywhere, not just in your hand. Own Animations shows the card movement animations for your own actions too — the same grow/shrink/move animations your opponent sees — instead of hiding them. Hovering a card in a Live Strength zone shows its influence value colored — green when boosted, red when reduced, black when unchanged.",
  board: "New Zone adds an extra unlabeled drop area beside your rearguard for stashing cards in a custom spot during the game.",
  toolbar: "Chooses which utility buttons appear in the opponent top bar: Income Options (view both players' income choices), Dice (roll a random die face), Random (click a zone to flash a random card there for 3 seconds), and Wide View (toggle a zoomed-out bird's-eye view of all 5 battlefields with their card zones — local only, opponent sees it only if they toggle it on themselves).",
  hotkeys: "Click any key chip and press a new key to rebind it. Use the + button to add extra keys to an action. Click × on a chip to remove it (minimum 1 key per action). Reset restores all defaults.",
};

function ToolSection({ id, title, onHover, onLeave, children }) {
  return (
    <div
      className="border border-border/60 rounded-lg p-3 space-y-2"
      onMouseEnter={(e) => onHover(id, e.currentTarget)}
      onMouseLeave={onLeave}
    >
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange, muted }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm font-medium ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// Tools popup — sectionized toggles. Hovering a section shows a popup that
// fully explains what its toggles do.
export default function ToolsDialog({ toolToggles, onToggleTool, adjustInfluence, onToggleAdjustInfluence, smallTokens, onToggleSmallTokens, zoomHover, onToggleZoomHover, instantZoomHover, onToggleInstantZoomHover, ownAnimations, onToggleOwnAnimations, newZone, onToggleNewZone, hotkeys, onUpdateHotkey, onResetHotkeys, onClose }) {
  const [infoPopup, setInfoPopup] = useState(null);
  const [listeningFor, setListeningFor] = useState(null);

  // When a key chip is clicked, capture the next keypress to rebind it.
  // Uses capture phase + stopPropagation so the game's keyboard handler
  // doesn't also fire during rebinding.
  useEffect(() => {
    if (!listeningFor) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setListeningFor(null); return; }
      const key = e.ctrlKey ? `ctrl+${e.key.toLowerCase()}` : e.key.toLowerCase();
      if (['control', 'shift', 'alt', 'meta'].includes(key)) return;
      const current = hotkeys[listeningFor.action] || [];
      const keys = [...current];
      if (listeningFor.index >= 0 && listeningFor.index < keys.length) keys[listeningFor.index] = key;
      else keys.push(key);
      onUpdateHotkey(listeningFor.action, keys);
      setListeningFor(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [listeningFor, hotkeys, onUpdateHotkey]);

  const handleHover = (id, el) => {
    const r = el.getBoundingClientRect();
    setInfoPopup({ text: SECTION_EXPLANATIONS[id], top: r.top, left: r.right + 10 });
  };
  const handleLeave = () => setInfoPopup(null);

  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Tools</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-3">
          <ToolSection id="strength" title="Live Strength" onHover={handleHover} onLeave={handleLeave}>
            {STRENGTH_KEYS.map(({ key, label }) => (
              <ToggleRow key={key} label={label} checked={adjustInfluence[key]} onChange={() => onToggleAdjustInfluence(key)} />
            ))}
          </ToolSection>
          <ToolSection id="display" title="Display" onHover={handleHover} onLeave={handleLeave}>
            <ToggleRow label="Small Tokens" checked={smallTokens} onChange={onToggleSmallTokens} />
            <ToggleRow label="Zoom Hover" checked={zoomHover} onChange={onToggleZoomHover} />
            <ToggleRow label="Instant Zoom Hover" checked={instantZoomHover} onChange={onToggleInstantZoomHover} muted />
            <ToggleRow label="Own Animations" checked={ownAnimations} onChange={onToggleOwnAnimations} />
          </ToolSection>
          <ToolSection id="board" title="Board" onHover={handleHover} onLeave={handleLeave}>
            <ToggleRow label="New Zone" checked={newZone} onChange={onToggleNewZone} />
          </ToolSection>
          <ToolSection id="toolbar" title="Top Bar Tools" onHover={handleHover} onLeave={handleLeave}>
            {['income', 'dice', 'random', 'wideView'].map((tool) => (
              <ToggleRow key={tool} label={TOOL_LABELS[tool]} checked={toolToggles[tool] || false} onChange={() => onToggleTool(tool)} />
            ))}
          </ToolSection>
          </div>
          <div>
          <ToolSection id="hotkeys" title="Hotkeys" onHover={handleHover} onLeave={handleLeave}>
            {Object.entries(HOTKEY_LABELS).map(([action, label]) => (
              <div key={action} className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground flex-shrink-0">{label}</span>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {(hotkeys[action] || []).map((key, idx) => (
                    <div key={idx} className="relative group">
                      <button
                        className={`px-2 py-0.5 rounded text-xs font-mono border ${listeningFor?.action === action && listeningFor?.index === idx ? 'border-primary bg-primary/10 text-primary animate-pulse' : 'border-border bg-muted text-foreground hover:border-primary/50'}`}
                        onClick={() => setListeningFor({ action, index: idx })}
                      >
                        {listeningFor?.action === action && listeningFor?.index === idx ? 'Press…' : formatKey(key)}
                      </button>
                      {(hotkeys[action] || []).length > 1 && (
                        <button
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); onUpdateHotkey(action, (hotkeys[action] || []).filter((_, i) => i !== idx)); }}
                        >×</button>
                      )}
                    </div>
                  ))}
                  <button
                    className="px-1.5 py-0.5 rounded text-xs border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    onClick={() => setListeningFor({ action, index: -1 })}
                  >+</button>
                </div>
              </div>
            ))}
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline mt-1"
              onClick={onResetHotkeys}
            >Reset to defaults</button>
          </ToolSection>
          </div>
        </div>
        {infoPopup && (
          <div
            className="fixed z-50 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg text-xs leading-relaxed text-popover-foreground pointer-events-none"
            style={{ top: Math.max(8, Math.min(infoPopup.top, window.innerHeight - 200)), left: Math.min(infoPopup.left, window.innerWidth - 280) }}
          >
            {infoPopup.text}
          </div>
        )}
      </div>
    </div>
  );
}