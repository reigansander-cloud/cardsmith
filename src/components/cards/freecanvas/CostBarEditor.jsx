import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, AlignLeft, AlignCenter, AlignRight, Shuffle, Dice5 } from 'lucide-react';
import { useUploadedIcons } from '@/hooks/useUploadedIcons';

// Groups consecutive identical cost icons into { url, name, count } for display.
export function condenseCosts(costs = []) {
  const out = [];
  for (const c of costs) {
    const last = out[out.length - 1];
    if (last && last.url === c.url) last.count += 1;
    else out.push({ url: c.url, name: c.name, count: 1 });
  }
  return out;
}

// Parse a quantity string that may be a single number ("3") or a range ("2-5")
// into a concrete integer count.
function parseQty(str) {
  const s = (str || '').trim();
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) {
    const lo = Math.max(0, parseInt(m[1], 10));
    const hi = Math.max(lo, parseInt(m[2], 10));
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : Math.max(0, n);
}

export default function CostBarEditor({ element, onUpdate }) {
  const costs = element.costs || [];
  const align = element.align || 'left';
  const iconx = element.iconx !== false;
  const randomize = element.randomize === true;
  const enabledIcons = element.enabledIcons || [];
  const randomQty = element.randomQty != null ? element.randomQty : '1';
  const available = useUploadedIcons();

  const addCost = (sym) => {
    onUpdate({ costs: [...costs, { url: sym.url, name: sym.name }] });
  };

  const toggleEnabled = (sym) => {
    const exists = enabledIcons.some((e) => e.url === sym.url);
    const next = exists ? enabledIcons.filter((e) => e.url !== sym.url) : [...enabledIcons, sym];
    onUpdate({ enabledIcons: next });
  };

  const isEnabled = (url) => enabledIcons.some((e) => e.url === url);

  const doRandomize = () => {
    if (!enabledIcons.length) return;
    const qty = parseQty(randomQty);
    if (qty <= 0) return;
    const next = [];
    for (let i = 0; i < qty; i++) {
      const pick = enabledIcons[Math.floor(Math.random() * enabledIcons.length)];
      next.push({ url: pick.url, name: pick.name });
    }
    onUpdate({ costs: next });
  };

  const condensed = condenseCosts(costs);

  return (
    <div className="space-y-3">
      {/* Combined options row: icon× toggle, alignment, randomize toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onUpdate({ iconx: !iconx })}
          title="Icon× mode — show × count instead of drawing each icon"
          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${iconx ? 'bg-primary' : 'bg-muted'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${iconx ? 'left-4' : 'left-0.5'}`} />
        </button>
        <div className="flex gap-1">
          {[{ v: 'left', Icon: AlignLeft }, { v: 'center', Icon: AlignCenter }, { v: 'right', Icon: AlignRight }].map(({ v, Icon }) => (
            <Button key={v} variant={align === v ? 'default' : 'outline'} size="sm" onClick={() => onUpdate({ align: v })} className="h-8 w-8 p-0">
              <Icon size={14} />
            </Button>
          ))}
        </div>
        <Button
          variant={randomize ? 'default' : 'outline'}
          size="sm"
          onClick={() => onUpdate({ randomize: !randomize })}
          className="h-8"
          title="Randomize mode — pick icons to enable, then roll a random cost"
        >
          <Shuffle size={14} className="mr-1" /> Random
        </Button>
      </div>
      {!iconx && (
        <p className="text-[11px] text-muted-foreground -mt-1">Draws each cost icon separately instead of showing a × count.</p>
      )}

      {randomize && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-2">
          <Dice5 size={14} className="text-muted-foreground flex-shrink-0" />
          <Button size="sm" onClick={doRandomize} disabled={!enabledIcons.length} className="h-8">
            <Shuffle size={14} className="mr-1" /> Roll
          </Button>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[11px] text-muted-foreground">Qty</span>
            <Input
              value={randomQty}
              onChange={(e) => onUpdate({ randomQty: e.target.value })}
              placeholder="3 or 2-5"
              className="h-8 w-20 text-xs"
            />
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Costs in bar</Label>
        {condensed.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {randomize ? 'Press Roll to generate a cost.' : 'Click an icon below to add it.'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {condensed.map((g, i) => (
              <div key={i} className="relative group flex items-center gap-0.5 bg-muted/30 rounded px-1 py-0.5">
                <img src={g.url} alt={g.name} className="w-5 h-5 object-contain" />
                {g.count > 1 && <span className="text-[10px] font-medium">×{g.count}</span>}
                <button
                  onClick={() => {
                    let removed = false;
                    const next = [];
                    for (const c of costs) {
                      if (!removed && c.url === g.url) { removed = true; continue; }
                      next.push(c);
                    }
                    onUpdate({ costs: next });
                  }}
                  className="ml-0.5 text-muted-foreground hover:text-destructive"
                  title="Remove one"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">
          {randomize ? 'Enabled icons (click to toggle)' : 'Available icons'}
        </Label>
        {available.length === 0 ? (
          <p className="text-xs text-muted-foreground">No icons yet. Add some via the Icons manager.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {available.map((sym, idx) => {
              const enabled = randomize && isEnabled(sym.url);
              return (
                <button
                  key={sym.id || idx}
                  onClick={() => (randomize ? toggleEnabled(sym) : addCost(sym))}
                  title={sym.name}
                  className={`p-1 rounded transition-colors ${enabled ? 'bg-primary/30 ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                >
                  <img src={sym.url} alt={sym.name} className="w-7 h-7 object-contain" />
                </button>
              );
            })}
          </div>
        )}
        {randomize && enabledIcons.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">{enabledIcons.length} icon{enabledIcons.length === 1 ? '' : 's'} enabled.</p>
        )}
      </div>
    </div>
  );
}