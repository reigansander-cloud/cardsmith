import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import SavedColorPicker from './SavedColorPicker';

export default function FillDialog({ open, onOpenChange, color, onColorChange, onApply }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-no-deselect>
        <DialogHeader>
          <DialogTitle>Fill selection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Fill color</Label>
            <div className="flex items-center gap-2">
              <SavedColorPicker
                value={color || '#ff0000'}
                onChange={v => onColorChange(v)}
                className="w-9 h-9"
                title="Fill color"
              />
              <Input
                value={color || '#ff0000'}
                onChange={e => onColorChange(e.target.value)}
                className="w-32 font-mono text-xs"
              />
            </div>
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