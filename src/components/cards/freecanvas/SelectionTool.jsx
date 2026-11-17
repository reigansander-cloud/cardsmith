import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Square, Circle, PenLine, MousePointer2, Wand2 } from 'lucide-react';

const OPTIONS = [
  { key: 'rectangle', label: 'Rectangle', Icon: Square },
  { key: 'circle', label: 'Circle', Icon: Circle },
  { key: 'draw', label: 'Draw', Icon: PenLine },
  { key: 'magic', label: 'Magic Wand', Icon: Wand2 },
];

export default function SelectionTool({ mode, onModeChange, open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-no-deselect>
        <DialogHeader>
          <DialogTitle>Selection tool</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label className="text-xs font-medium">Choose a selection shape</Label>
          <div className="grid grid-cols-2 gap-2">
            {OPTIONS.map(({ key, label, Icon }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  onClick={() => { onModeChange(key); onOpenChange(false); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              );
            })}
          </div>
          {mode !== 'off' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { onModeChange('off'); onOpenChange(false); }}
            >
              <MousePointer2 size={14} className="mr-2" /> Disable selection
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground">
            Draw a selection on the canvas, then use Ctrl+C to copy, Ctrl+X to cut, or Ctrl+U to colorize the selected area of the top selected layer. Magic Wand selects contiguous similar-color pixels on click.
          </p>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}