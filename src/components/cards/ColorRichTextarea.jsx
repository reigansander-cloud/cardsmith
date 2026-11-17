import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Palette, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const TEXT_COLORS = [
  { key: 'black', label: 'Black', hex: '#000000' },
  { key: 'red', label: 'Red', hex: '#c0392b' },
  { key: 'blue', label: 'Blue', hex: '#2471a3' },
  { key: 'green', label: 'Green', hex: '#1e8449' },
  { key: 'gold', label: 'Gold', hex: '#b7950b' },
  { key: 'purple', label: 'Purple', hex: '#7d3c98' },
  { key: 'brown', label: 'Brown', hex: '#6e3b1e' },
  { key: 'orange', label: 'Orange', hex: '#e67e22' },
];

// Format: [color:red]text[/color] or [icon:SymbolName]
export default function ColorRichTextarea({ value, onChange, placeholder, rows = 6, className = '', showIcons = false, label, allSymbols = [] }) {
  const ref = useRef(null);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const symbols = allSymbols.length > 0 ? allSymbols : [];

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault();
      const el = ref.current;
      const { selectionStart: start, selectionEnd: end } = el;
      const marker = e.key === 'b' ? '**' : '_';
      const selected = value.slice(start, end);
      const newVal = value.slice(0, start) + marker + selected + marker + value.slice(end);
      onChange({ target: { value: newVal } });
      setTimeout(() => {
        el.selectionStart = start + marker.length;
        el.selectionEnd = end + marker.length;
        el.focus();
      }, 0);
    }
  };

  const insertColor = (colorKey) => {
    const el = ref.current;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end) || 'text';
    const colorTag = `[color:${colorKey}]${selected}[/color]`;
    const newVal = value.slice(0, start) + colorTag + value.slice(end);
    onChange({ target: { value: newVal } });
    requestAnimationFrame(() => {
      el.selectionStart = start + colorTag.length;
      el.selectionEnd = start + colorTag.length;
    });
  };

  const insertIcon = (symbolName) => {
    const el = ref.current;
    const { selectionStart: start, selectionEnd: end } = el;
    const iconTag = `[icon:${symbolName}]`;
    const newVal = value.slice(0, start) + iconTag + value.slice(end);
    onChange({ target: { value: newVal } });
    requestAnimationFrame(() => {
      el.selectionStart = start + iconTag.length;
      el.selectionEnd = start + iconTag.length;
    });
    setShowSymbolPicker(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-1">
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs">
              <Palette size={12} className="mr-1" />Color
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="grid grid-cols-4 gap-1">
              {TEXT_COLORS.map(c => (
                <button
                  key={c.key}
                  type="button"
                  title={c.label}
                  className="w-8 h-8 rounded-md border-2 border-border hover:border-primary transition-all flex items-center justify-center"
                  style={{ background: c.hex }}
                  onClick={() => insertColor(c.key)}
                />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Select text first to color it</p>
          </PopoverContent>
        </Popover>

        {showIcons && (
          <Popover open={showSymbolPicker} onOpenChange={setShowSymbolPicker}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs">
                <Plus size={12} className="mr-1" />Icon
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Insert Icon</span>
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowSymbolPicker(false)}>
                  <X size={14} />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto">
                {symbols.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.name}
                    className="w-8 h-8 rounded-md border border-border hover:border-primary hover:bg-muted/50 transition-all flex items-center justify-center bg-background"
                    onClick={() => insertIcon(s.name)}
                  >
                    <img src={s.url} alt={s.name} className="w-5 h-5 object-contain" />
                  </button>
                ))}
              </div>
              {symbols.length === 0 && (
                <p className="text-[10px] text-muted-foreground">No icons uploaded yet</p>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={`w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring ${className}`}
      />
    </div>
  );
}