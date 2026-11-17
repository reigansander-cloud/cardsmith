import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const MAX_LONG_SIDE = 1500;

function capDims(nw, nh) {
  const long = Math.max(nw, nh);
  if (long <= MAX_LONG_SIDE) return { w: nw, h: nh };
  const scale = MAX_LONG_SIDE / long;
  return { w: Math.round(nw * scale), h: Math.round(nh * scale) };
}

function loadDims(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(capDims(img.naturalWidth, img.naturalHeight));
    img.onerror = () => resolve({ w: 461, h: 709 });
    img.src = url;
  });
}

export default function CardColorPicker({ value, onChange }) {
  const [colors, setColors] = useState([]);
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    base44.entities.SevenWondersColor.list().then(setColors).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = async (c) => {
    const dims = await loadDims(c.baseImageUrl);
    onChange({ baseImageUrl: c.baseImageUrl, bannerImageUrl: c.bannerImageUrl, cardWidth: dims.w, cardHeight: dims.h });
    setOpen(false);
  };

  const current = colors.find(c => c.baseImageUrl === value);

  return (
    <div className="flex items-center gap-2">
      <div ref={pickerRef} className="relative">
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          {current ? (
            <span className="w-4 h-4 rounded-full mr-1 border border-border" style={{ background: current.color }} />
          ) : (
            <span className="w-4 h-4 rounded-full mr-1 border border-dashed border-muted-foreground/50" />
          )}
          <span className="text-xs">{current ? current.name : 'Choose'}</span>
          <ChevronDown size={14} className="ml-1" />
        </Button>
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-xl p-2 grid grid-cols-5 gap-2 w-64 max-h-64 overflow-y-auto">
            {colors.length === 0 && (
              <p className="col-span-5 text-xs text-muted-foreground text-center py-4">No colors yet. Add some in the icon manager.</p>
            )}
            {colors.map(c => (
              <button
                key={c.id}
                className={`flex flex-col items-center gap-1 p-1 rounded border transition-colors ${value === c.baseImageUrl ? 'border-primary bg-primary/15' : 'border-transparent hover:border-border hover:bg-muted/50'}`}
                title={c.name}
                onClick={() => select(c)}
              >
                <span className="w-8 h-8 rounded-full border border-border" style={{ background: c.color }} />
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {value && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ baseImageUrl: '', bannerImageUrl: '' })} className="h-8">
          Clear
        </Button>
      )}
    </div>
  );
}