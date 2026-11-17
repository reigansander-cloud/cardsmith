import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const DEFAULT_BANNER = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/0e4d67779c_07b28f54f_GreenBanner.png';

export default function CostBannerPicker({ value, onChange }) {
  const [banners, setBanners] = useState([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    base44.entities.SevenWondersBanner.list().then(setBanners).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      try { await base44.entities.SevenWondersBanner.create({ name: file.name.replace(/\.[^.]+$/, ''), url: file_url }); } catch {}
      setBanners(prev => [...prev, { id: `tmp_${Date.now()}`, name: file.name, url: file_url }]);
      onChange(file_url);
      setOpen(false);
    } catch {}
    if (inputRef.current) inputRef.current.value = '';
  };

  const current = value || DEFAULT_BANNER;

  return (
    <div className="flex items-center gap-2">
      <div ref={pickerRef} className="relative">
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          <img src={current} alt="" className="w-5 h-16 object-cover mr-1 rounded-sm" />
          <ChevronDown size={14} />
        </Button>
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-xl p-2 grid grid-cols-4 gap-1 w-64 max-h-64 overflow-y-auto">
            <button
              className={`flex items-center justify-center w-14 h-20 rounded border transition-colors ${current === DEFAULT_BANNER ? 'border-primary bg-primary/15' : 'border-transparent hover:border-border hover:bg-muted/50'}`}
              title="Green Banner"
              onClick={() => { onChange(DEFAULT_BANNER); setOpen(false); }}
            >
              <img src={DEFAULT_BANNER} alt="Green Banner" className="w-full h-full object-cover rounded" />
            </button>
            {banners.map(b => (
              <button
                key={b.id}
                className={`flex items-center justify-center w-14 h-20 rounded border transition-colors ${current === b.url ? 'border-primary bg-primary/15' : 'border-transparent hover:border-border hover:bg-muted/50'}`}
                title={b.name}
                onClick={() => { onChange(b.url); setOpen(false); }}
              >
                <img src={b.url} alt={b.name} className="w-full h-full object-cover rounded" />
              </button>
            ))}
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload size={14} className="mr-1" /> Upload
      </Button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}