import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Square, Circle, PenLine, Copy, Scissors, Palette, PaintBucket, Wand2 } from 'lucide-react';

const SELECT_MODES = [
  { key: 'rectangle', label: 'Rect', Icon: Square },
  { key: 'circle', label: 'Circle', Icon: Circle },
  { key: 'draw', label: 'Draw', Icon: PenLine },
  { key: 'magic', label: 'Wand', Icon: Wand2 },
];

export default function SelectPanel({
  selectionMode, onSelectMode,
  onCopy, onCut, onColorize, onFill,
  hasSelection,
  magicTolerance = 72, onMagicToleranceChange,
}) {
  const selectOn = selectionMode !== 'off';
  const [toleranceOpen, setToleranceOpen] = useState(false);

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2" data-no-deselect>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Select</div>
      <div className="grid grid-cols-4 gap-1">
        {SELECT_MODES.map(({ key, label, Icon }) => {
          const active = selectionMode === key;
          const isWand = key === 'magic';
          const button = (
            <Button
              variant={active ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelectMode(active ? 'off' : key)}
              onContextMenu={isWand ? (e) => { e.preventDefault(); setToleranceOpen(true); } : undefined}
              className="flex-col h-auto py-1.5 px-1"
              title={isWand ? `${label} selection (right-click for tolerance)` : `${label} selection`}
            >
              <Icon size={14} />
              <span className="text-[10px] mt-0.5">{label}</span>
            </Button>
          );
          if (!isWand) return <React.Fragment key={key}>{button}</React.Fragment>;
          return (
            <Popover key={key} open={toleranceOpen} onOpenChange={setToleranceOpen}>
              <PopoverAnchor asChild>{button}</PopoverAnchor>
              <PopoverContent align="start" className="w-56 p-3" data-no-deselect>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Wand tolerance</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{magicTolerance}</span>
                  </div>
                  <Slider value={[magicTolerance]} min={0} max={150} step={1} onValueChange={(v) => onMagicToleranceChange?.(v[0])} />
                  <p className="text-[11px] text-muted-foreground">Higher selects a wider range of similar colors.</p>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
      {selectOn && (
        <div className="grid grid-cols-4 gap-1">
          <Button variant="outline" size="sm" onClick={onCopy} disabled={!hasSelection} className="h-8 px-1 text-xs">
            <Copy size={12} className="mr-1" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={onCut} disabled={!hasSelection} className="h-8 px-1 text-xs">
            <Scissors size={12} className="mr-1" /> Cut
          </Button>
          <Button variant="outline" size="sm" onClick={onColorize} disabled={!hasSelection} className="h-8 px-1 text-xs">
            <Palette size={12} className="mr-1" /> Tint
          </Button>
          <Button variant="outline" size="sm" onClick={onFill} disabled={!hasSelection} className="h-8 px-1 text-xs">
            <PaintBucket size={12} className="mr-1" /> Fill
          </Button>
        </div>
      )}
    </div>
  );
}