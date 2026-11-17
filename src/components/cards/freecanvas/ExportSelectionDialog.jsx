import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export default function ExportSelectionDialog({ open, onOpenChange, canvases, onExport }) {
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open && canvases) setSelected(canvases.map((_, i) => i));
  }, [open, canvases]);

  const toggle = (i) => {
    setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-no-deselect>
        <DialogHeader>
          <DialogTitle>Export canvases</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {canvases?.map((c, i) => (
            <label key={c.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/50">
              <Checkbox checked={selected.includes(i)} onCheckedChange={() => toggle(i)} />
              <span className="text-sm">{c.name || `Canvas ${i + 1}`}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={selected.length === 0} onClick={() => onExport(selected)}>
            Export {selected.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}