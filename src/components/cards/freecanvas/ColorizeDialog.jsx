import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import SavedColorPicker from './SavedColorPicker';

export default function ColorizeDialog({ open, onOpenChange, settings, onSettingsChange, onApply }) {
  const cz = settings || { color: '#ff0000', amount: 50 };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-no-deselect>
        <DialogHeader>
          <DialogTitle>Colorize selection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Direction (color)</Label>
            <div className="flex items-center gap-2">
              <SavedColorPicker
                value={cz.color || '#ff0000'}
                onChange={v => onSettingsChange({ ...cz, color: v })}
                className="w-9 h-9"
                title="Colorize color"
              />
              <Input
                value={cz.color || '#ff0000'}
                onChange={e => onSettingsChange({ ...cz, color: e.target.value })}
                className="w-32 font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Amount</Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0" max="100" step="5"
                value={cz.amount ?? 50}
                onChange={e => onSettingsChange({ ...cz, amount: parseInt(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <span className="text-xs font-mono w-10 text-right">{cz.amount ?? 50}%</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Shifts colors toward the target. White areas are preserved.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={onApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}