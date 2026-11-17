import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export default function DeckFiltersDialog({
  open, onOpenChange,
  folders,
  supertypes, selectedSupertypes, setSelectedSupertypes,
  costOptions, selectedCosts, setSelectedCosts,
  newCardsOnly, setNewCardsOnly,
  sortBySupertype, setSortBySupertype,
  viewDeckOnly, setViewDeckOnly,
  associatedFolderId, onAssociate,
}) {
  const toggleSuper = (s) => {
    setSelectedSupertypes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };
  const toggleCost = (c) => {
    setSelectedCosts((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Folder association</p>
            <select
              value={associatedFolderId || ''}
              onChange={(e) => onAssociate?.(e.target.value)}
              className="w-full h-8 rounded-md border border-border bg-muted/30 px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">None</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">When associated, the deck draws from that folder and all its tokens appear in their own section (1 copy each, locked).</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Supertypes</p>
            <div className="flex flex-wrap gap-2">
              {supertypes.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSuper(s)}
                  className={`px-3 py-1.5 text-xs rounded-md border capitalize ${selectedSupertypes.includes(s) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Costs</p>
            <div className="flex flex-wrap gap-2">
              {costOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCost(c)}
                  className={`w-10 h-9 text-xs rounded-md border ${selectedCosts.includes(c) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">None selected = all costs.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Options</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={newCardsOnly} onCheckedChange={() => setNewCardsOnly(!newCardsOnly)} />
                <span className="text-foreground">New cards only</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={viewDeckOnly} onCheckedChange={() => setViewDeckOnly(!viewDeckOnly)} />
                <span className="text-foreground">View deck</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={sortBySupertype} onCheckedChange={() => setSortBySupertype(!sortBySupertype)} />
                <span className="text-foreground">Sort by supertype</span>
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Default sort is by cost.</p>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}