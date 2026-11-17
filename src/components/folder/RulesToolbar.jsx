import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, ImageIcon, Palette } from 'lucide-react';

const SIZES = [12, 14, 16, 18, 24, 32];
const COLORS = ['#1f2937', '#ffffff', '#b91c1c', '#ea580c', '#ca8a04', '#15803d', '#1d4ed8', '#7c3aed', '#db2777', '#6b7280'];

// Formatting toolbar for the Rules editor. All buttons keep the editor focused
// (mousedown preventDefault) so document.execCommand acts on the live selection;
// the icon picker restores a saved range before inserting.
export default function RulesToolbar({ onBold, onItalic, onUnderline, onSetSize, onColor, onAlign, icons, onInsertIcon }) {
  const [customColor, setCustomColor] = useState('#1f2937');

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 font-bold" onMouseDown={(e) => e.preventDefault()} onClick={onBold} title="Bold">
        <Bold size={16} />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 italic" onMouseDown={(e) => e.preventDefault()} onClick={onItalic} title="Italic">
        <Italic size={16} />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 underline" onMouseDown={(e) => e.preventDefault()} onClick={onUnderline} title="Underline">
        <Underline size={16} />
      </Button>
      <div className="w-px h-6 bg-border mx-1" />
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => onAlign('justifyLeft')} title="Align left">
        <AlignLeft size={16} />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => onAlign('justifyCenter')} title="Align center">
        <AlignCenter size={16} />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => onAlign('justifyRight')} title="Align right">
        <AlignRight size={16} />
      </Button>
      <div className="w-px h-6 bg-border mx-1" />
      <select
        className="h-8 rounded-md border border-border bg-muted/30 px-1 text-xs"
        value=""
        onChange={(e) => { if (e.target.value) onSetSize(parseInt(e.target.value)); }}
        title="Font size"
      >
        <option value="">Size</option>
        {SIZES.map((s) => <option key={s} value={s}>{s}px</option>)}
      </select>
      <div className="w-px h-6 bg-border mx-1" />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onMouseDown={(e) => e.preventDefault()} title="Text color">
            <Palette size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56" align="end">
          <div className="text-xs font-medium mb-2 text-muted-foreground">Text color</div>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {COLORS.map((c) => (
              <button
                key={c}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onColor(c)}
                className="w-8 h-8 rounded-md border border-border"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <span>Custom</span>
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              onBlur={(e) => onColor(e.target.value)}
              className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
            />
          </label>
        </PopoverContent>
      </Popover>
      <div className="w-px h-6 bg-border mx-1" />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2" onMouseDown={(e) => e.preventDefault()} title="Insert icon">
            <ImageIcon size={16} className="mr-1" /> Icon
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="text-xs font-medium mb-2 text-muted-foreground">Insert an icon</div>
          {(!icons || icons.length === 0) ? (
            <div className="text-xs text-muted-foreground py-4 text-center">No icons available.</div>
          ) : (
            <div className="grid grid-cols-6 gap-2 max-h-60 overflow-y-auto">
              {icons.map((ic) => (
                <button key={ic.id} className="aspect-square rounded border border-border bg-muted/30 hover:border-primary flex items-center justify-center p-1" title={ic.name} onMouseDown={(e) => e.preventDefault()} onClick={() => onInsertIcon(ic.url, ic.name)}>
                  <img src={ic.url} alt={ic.name} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}