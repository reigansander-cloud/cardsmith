import React, { useState, useRef, useEffect } from 'react';
import { CARD_ICONS } from '@/lib/cardIcons';
import IconRenderer from './IconRenderer';
import { base44 } from '@/api/base44Client';

export default function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [uploaded, setUploaded] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    base44.entities.TacticalIcon.list().then(setUploaded).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const allIcons = [...CARD_ICONS, ...uploaded.map(u => ({ key: u.url, label: u.name, url: u.url }))];

  return (
    <div ref={ref} className="relative">
      <button
        className="w-10 h-10 flex items-center justify-center rounded-lg border border-border hover:border-primary bg-card transition-colors"
        onClick={() => setOpen(!open)}
      >
        <IconRenderer iconKey={value} size={24} className="text-primary" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 right-0 bg-card border border-border rounded-lg shadow-xl p-2 grid grid-cols-3 gap-1 w-44 max-h-64 overflow-y-auto">
          {allIcons.map(icon => (
            <button
              key={icon.key}
              className={`w-12 h-12 flex items-center justify-center rounded border transition-colors ${
                value === icon.key ? 'border-primary bg-primary/15' : 'border-transparent hover:border-border hover:bg-muted/50'
              }`}
              title={icon.label}
              onClick={() => { onChange(icon.key); setOpen(false); }}
            >
              <IconRenderer iconKey={icon.key} size={28} className="text-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}