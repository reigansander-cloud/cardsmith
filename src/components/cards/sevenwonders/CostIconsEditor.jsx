import React, { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { X, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import IconValueDialog from './IconValueDialog';

const COIN_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/a51bc3998c_1e86e7293_Coin2.png';
const CLOTH_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/5c071fce34_ff8125e36_Cloth.png';
const PAPYRUS_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/3e01259f19_a087dac51_Papyrus.png';
const GLASS_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/05fa066373_1d4684fcf_Glass.png';

const DEFAULT_ICONS = [
  { id: 'default_ore', name: 'Ore', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/90c5039ba0_578492634_ore.png' },
  { id: 'default_wood', name: 'Wood', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/17115f96f8_ef3525ccf_Wood.png' },
  { id: 'default_coin', name: 'Coin', url: COIN_URL, isCoin: true },
  { id: 'default_cloth', name: 'Cloth', url: CLOTH_URL, shape: 'octagon' },
  { id: 'default_papyrus', name: 'Papyrus', url: PAPYRUS_URL, shape: 'octagon' },
  { id: 'default_glass', name: 'Glass', url: GLASS_URL, shape: 'octagon' },
];

export default function CostIconsEditor({ value, onChange }) {
  const [icons, setIcons] = useState([]);
  const [dialog, setDialog] = useState(null);
  const inputRef = useRef(null);
  const costIcons = value || [];
  const allIcons = [...DEFAULT_ICONS, ...icons];

  useEffect(() => {
    base44.entities.SevenWondersCostIcon.list().then(setIcons).catch(() => {});
  }, []);

  const addIcon = (icon) => {
    if (icon.isCoin) {
      setDialog({ mode: 'add', icon });
      return;
    }
    const entry = { id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, url: icon.url };
    if (icon.shape) entry.shape = icon.shape;
    onChange([...costIcons, entry]);
  };

  const editValue = (id) => {
    const ic = costIcons.find(c => c.id === id);
    if (!ic) return;
    setDialog({ mode: 'edit', id, initialValue: ic.value ?? '' });
  };

  const handleConfirm = (val) => {
    if (dialog.mode === 'add') {
      const entry = { id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, url: dialog.icon.url, value: val };
      onChange([...costIcons, entry]);
    } else if (dialog.mode === 'edit') {
      onChange(costIcons.map(c => c.id === dialog.id ? { ...c, value: val } : c));
    }
    setDialog(null);
  };

  const removeIcon = (id) => onChange(costIcons.filter(ic => ic.id !== id));

  const moveIcon = (id, dir) => {
    const idx = costIcons.findIndex(ic => ic.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= costIcons.length) return;
    const next = [...costIcons];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      try { await base44.entities.SevenWondersCostIcon.create({ name: file.name.replace(/\.[^.]+$/, ''), url: file_url }); } catch {}
      setIcons(prev => [...prev, { id: `tmp_${Date.now()}`, name: file.name, url: file_url }]);
      addIcon({ url: file_url });
    } catch {}
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Add Cost Icon</Label>
        <div className="flex flex-wrap gap-1">
          {allIcons.map(ic => (
            <button
              key={ic.id}
              title={ic.isCoin ? `Add ${ic.name} (enter a value)` : `Add ${ic.name}`}
              onClick={() => addIcon(ic)}
              className="w-9 h-9 rounded-full border border-border hover:border-primary flex items-center justify-center bg-background transition-colors"
            >
              <img src={ic.url} alt={ic.name} className="w-7 h-7 object-contain" />
            </button>
          ))}
        </div>
      </div>

      {costIcons.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cost Icons</Label>
          {costIcons.map((ic, i) => (
            <div key={ic.id} className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-transparent hover:bg-muted/50">
              <img src={ic.url} alt="" className="w-6 h-6 rounded-full" />
              {ic.value != null && (
                <>
                  <span className="text-xs text-muted-foreground">= {ic.value}</span>
                  <button onClick={(e) => { e.stopPropagation(); editValue(ic.id); }} className="text-muted-foreground hover:text-foreground" title="Edit value">
                    <Pencil size={12} />
                  </button>
                </>
              )}
              <button onClick={(e) => { e.stopPropagation(); moveIcon(ic.id, -1); }} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ChevronUp size={12} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); moveIcon(ic.id, 1); }} disabled={i === costIcons.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ChevronDown size={12} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); removeIcon(ic.id); }} className="text-muted-foreground hover:text-destructive ml-auto">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <IconValueDialog
        open={!!dialog}
        title="Coin Value"
        initialValue={dialog?.initialValue ?? ''}
        onConfirm={handleConfirm}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}