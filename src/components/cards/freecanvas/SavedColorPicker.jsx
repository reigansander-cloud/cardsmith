import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { useSavedColors } from '@/hooks/useFreeCanvasAssets';

// A color picker that also surfaces the saved color palette (managed in the
// Icons & Fonts manager) so any element's color picker can reuse saved colors.
// Drop-in for a native <input type="color">: value is a hex string, onChange
// receives the new hex string directly (not an event).
export default function SavedColorPicker({ value, onChange, className, title }) {
  const colors = useSavedColors();
  const [open, setOpen] = useState(false);
  const current = value || '#000000';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title}
          className={`rounded cursor-pointer border border-border p-0.5 ${className || 'w-8 h-8'}`}
          style={{ backgroundColor: current }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" data-no-deselect>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={current}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border border-border p-0.5"
          />
          <Input
            value={current}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 font-mono text-xs h-8"
          />
        </div>
        <div className="mt-2">
          <span className="text-[11px] text-muted-foreground block mb-1">Saved colors</span>
          {colors.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No saved colors yet. Add some in the Icons &amp; Fonts manager.</p>
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); }}
                  className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}