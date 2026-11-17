import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ImageIcon } from 'lucide-react';

// A compact button that opens a popover grid of icons to filter entries by.
// The popover is portaled to document.body with `position: fixed` so it floats
// outside the folder topnav — whose backdrop-blur creates a containing block
// that would otherwise trap and clip a fixed-position popover. Selecting an
// icon closes the popover and shows that icon in the button (click to change).
// `icons` is a list of {url, name?} (deduped by the caller is fine; we dedupe
// again here defensively). Selecting an icon calls onSelect(url); clicking it
// again (or the "All" tile) clears the filter with onSelect('').
export default function IconSearchPopup({ icons, selectedUrl, onSelect, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState(null);
  const deduped = [];
  const seen = new Set();
  (icons || []).forEach((ic) => {
    if (ic?.url && !seen.has(ic.url)) { seen.add(ic.url); deduped.push(ic); }
  });

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right, left: r.left });
    }
    setOpen((v) => !v);
  };

  const choose = (url) => { onSelect(url); setOpen(false); };

  return (
    <div className="flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`h-8 w-8 rounded-md border flex items-center justify-center ${selectedUrl ? 'border-primary bg-primary/10' : 'border-border bg-transparent text-muted-foreground hover:bg-muted'}`}
        title="Filter by icon"
      >
        {selectedUrl ? <img src={selectedUrl} alt="" className="w-4 h-4 object-contain" /> : <ImageIcon size={14} />}
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="fixed z-30 w-72 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg p-2"
            style={align === 'right' ? { top: pos.top, right: pos.right } : { top: pos.top, left: pos.left }}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Filter by icon</div>
            {deduped.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No icons available.</p>
            ) : (
              <div className="grid grid-cols-6 gap-1">
                <button
                  onClick={() => choose('')}
                  className={`aspect-square rounded border flex items-center justify-center text-[9px] ${!selectedUrl ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                  title="No icon filter"
                >
                  All
                </button>
                {deduped.map((ic) => (
                  <button
                    key={ic.url}
                    onClick={() => choose(selectedUrl === ic.url ? '' : ic.url)}
                    className={`aspect-square rounded border flex items-center justify-center p-0.5 ${selectedUrl === ic.url ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                    title={ic.name || 'icon'}
                  >
                    <img src={ic.url} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}