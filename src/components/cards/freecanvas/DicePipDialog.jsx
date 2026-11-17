import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PIP_POSITIONS } from '@/lib/dicePips';

function DiceFacePreview({ value, size = 32 }) {
  const pips = PIP_POSITIONS[value] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="block">
      <rect x="6" y="6" width="88" height="88" rx="18" fill="none" stroke="currentColor" strokeWidth="5" />
      {pips.map(([px, py], i) => (
        <circle key={i} cx={px * 100} cy={py * 100} r="9" fill="currentColor" />
      ))}
    </svg>
  );
}

export default function DicePipDialog({ open, onOpenChange, onSelect }) {
  const handleSelect = (value) => {
    onSelect(value);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-no-deselect>
        <DialogHeader>
          <DialogTitle>Add dice pips?</DialogTitle>
          <DialogDescription>Choose a pip count to add inside the dice shape, or add without pips.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2">
          <Button
            variant="outline"
            onClick={() => handleSelect(null)}
            className="flex flex-col items-center justify-center gap-1 h-auto py-3"
          >
            <div className="w-8 h-8 border-2 border-current rounded-md" />
            <span className="text-[10px]">No pips</span>
          </Button>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <Button
              key={n}
              variant="outline"
              onClick={() => handleSelect(n)}
              className="flex flex-col items-center justify-center gap-1 h-auto py-3"
            >
              <DiceFacePreview value={n} />
              <span className="text-[10px]">{n}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}