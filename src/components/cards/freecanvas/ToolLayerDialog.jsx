import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Coins, Grid as GridIcon } from 'lucide-react';

export default function ToolLayerDialog({ open, onOpenChange, onChoose }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-no-deselect>
        <DialogHeader>
          <DialogTitle>Add a tool layer</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => onChoose('costbar')}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Coins size={28} />
            <span className="text-sm font-medium">Cost Bar</span>
            <span className="text-[10px] text-muted-foreground text-center">A row of icon costs that condenses on overflow</span>
          </button>
          <button
            onClick={() => onChoose('grid')}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <GridIcon size={28} />
            <span className="text-sm font-medium">Grid Editor</span>
            <span className="text-[10px] text-muted-foreground text-center">A symbol grid like the towers template</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}