import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SavedColorPicker from './SavedColorPicker';

const SHAPES = [
  { key: 'rectangle', label: 'Rectangle' },
  { key: 'ellipse', label: 'Ellipse' },
  { key: 'triangle', label: 'Triangle' },
  { key: 'diamond', label: 'Diamond' },
  { key: 'line', label: 'Line' },
  { key: 'rounded', label: 'Rounded' },
];

export default function AddShapeDialog({ open, onOpenChange, onAdd }) {
  const [shape, setShape] = useState('rectangle');
  const [filled, setFilled] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [color, setColor] = useState('#000000');

  const submit = () => {
    onAdd({ shape, filled, strokeWidth: Math.max(1, strokeWidth || 1), color });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-no-deselect>
        <DialogHeader>
          <DialogTitle>Add Shape</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs mb-1 block">Shape</Label>
            <div className="grid grid-cols-3 gap-2">
              {SHAPES.map(s => (
                <button
                  key={s.key}
                  onClick={() => setShape(s.key)}
                  className={`px-2 py-2 rounded-md border text-xs transition-colors ${shape === s.key ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Filled in completely</Label>
            <button
              onClick={() => setFilled(!filled)}
              className={`relative w-9 h-5 rounded-full transition-colors ${filled ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${filled ? 'left-4' : 'left-0.5'}`} />
            </button>
          </div>
          {!filled && (
            <div>
              <Label className="text-xs mb-1 block">Border thickness (px)</Label>
              <Input
                type="number" min="1" max="40"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-muted/30 border-border w-24"
              />
            </div>
          )}
          <div>
            <Label className="text-xs mb-1 block">Color</Label>
            <div className="flex items-center gap-2">
              <SavedColorPicker
                value={color}
                onChange={setColor}
                className="w-9 h-9"
                title="Shape color"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={submit}>Add Shape</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}