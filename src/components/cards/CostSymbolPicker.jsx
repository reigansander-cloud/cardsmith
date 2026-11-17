import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Minus, Settings } from 'lucide-react';
import IconManager from '@/components/IconManager';

export default function CostSymbolPicker({ costSymbols = [], onChange }) {
  const [available, setAvailable] = useState([]);
  const [showManager, setShowManager] = useState(false);

  const loadSymbols = () => base44.entities.CostSymbol.list().then(setAvailable);

  React.useEffect(() => { loadSymbols(); }, []);

  const updateCount = (id, delta) => {
    const existing = costSymbols.find(cs => cs.id === id);
    if (existing) {
      const newCount = (existing.count || 1) + delta;
      if (newCount <= 0) {
        onChange(costSymbols.filter(cs => cs.id !== id));
      } else {
        onChange(costSymbols.map(cs => cs.id === id ? { ...cs, count: newCount } : cs));
      }
    } else {
      const sym = available.find(a => a.id === id);
      if (sym) onChange([...costSymbols, { id: sym.id, name: sym.name, url: sym.url, count: 1 }]);
    }
  };

  const handleDeleteSymbol = async (sym) => {
    await base44.entities.CostSymbol.delete(sym.id);
    onChange(costSymbols.filter(cs => cs.id !== sym.id));
    loadSymbols();
  };

  const countFor = (id) => costSymbols.find(cs => cs.id === id)?.count || 0;

  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cost Symbols</Label>

      <div className="flex flex-wrap gap-3">
        {available.map(sym => {
          const count = countFor(sym.id);
          return (
            <div key={sym.id} className="group flex flex-col items-center gap-1 relative">
              <div className="relative">
                <img src={sym.url} alt={sym.name} className="w-8 h-8 object-contain" />
                <button
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground hidden group-hover:flex items-center justify-center"
                  onClick={() => handleDeleteSymbol(sym)}
                  title="Delete symbol"
                >
                  <Trash2 size={8} />
                </button>
              </div>
              <span className="text-[9px] text-muted-foreground truncate max-w-[40px] text-center">{sym.name}</span>
              <div className="flex items-center gap-0.5">
                <button className="w-5 h-5 rounded bg-muted/50 hover:bg-muted flex items-center justify-center" onClick={() => updateCount(sym.id, -1)}>
                  <Minus size={10} />
                </button>
                <span className="text-xs w-4 text-center font-medium">{count}</span>
                <button className="w-5 h-5 rounded bg-muted/50 hover:bg-muted flex items-center justify-center" onClick={() => updateCount(sym.id, 1)}>
                  <Plus size={10} />
                </button>
              </div>
            </div>
          );
        })}
        {available.length === 0 && <p className="text-xs text-muted-foreground">No symbols yet — add one below.</p>}
      </div>

      {/* Manage symbols */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowManager(true)}
        className="w-fit"
      >
        <Settings size={14} className="mr-2" />Manage Symbols
      </Button>

      <IconManager
        open={showManager}
        onOpenChange={(o) => { setShowManager(o); if (!o) loadSymbols(); }}
        entityName="CostSymbol"
      />
    </div>
  );
}