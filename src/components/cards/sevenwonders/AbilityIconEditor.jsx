import React, { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import IconValueDialog from './IconValueDialog';

const COIN_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/a51bc3998c_1e86e7293_Coin2.png';
const WREATH_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/27629e376a_9a6f793ed_VPWreath2.png';
const NAVAL_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/860baa0332_f18e8fcc9_NavalStrength.png';

const DEFAULT_ABILITY_ICONS = [
  { id: 'ability_coin', name: 'Coin', url: COIN_URL, valueStyle: 'black' },
  { id: 'ability_wreath', name: 'Wreath (VP)', url: WREATH_URL, valueStyle: 'black' },
  { id: 'ability_naval', name: 'Naval', url: NAVAL_URL, valueStyle: 'white' },
];

const TITLES = { value: 'Ability Value', coin: 'Coin Modifier Value', vp: 'VP Modifier Value' };

const newId = () => `ab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function AbilityIconEditor({ value, onChange, activatedSlash, onActivatedSlashChange }) {
  const [uploaded, setUploaded] = useState([]);
  const [dialog, setDialog] = useState(null);
  const inputRef = useRef(null);
  const icons = value || [];
  const allPicker = [...DEFAULT_ABILITY_ICONS, ...uploaded];

  useEffect(() => {
    base44.entities.SevenWondersAbilityIcon.list().then(setUploaded).catch(() => {});
  }, []);

  const addIcon = (icon) => {
    onChange([...icons, { id: newId(), url: icon.url, valueStyle: icon.valueStyle || 'black', value: '', coinModifier: null, vpModifier: null, neighborArrow: null, played: false }]);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      try { await base44.entities.SevenWondersAbilityIcon.create({ name: file.name.replace(/\.[^.]+$/, ''), url: file_url }); } catch {}
      setUploaded(prev => [...prev, { id: `tmp_${Date.now()}`, name: file.name, url: file_url }]);
      addIcon({ url: file_url, valueStyle: 'black' });
    } catch {}
    if (inputRef.current) inputRef.current.value = '';
  };

  const updateIcon = (idx, fields) => onChange(icons.map((ic, i) => i === idx ? { ...ic, ...fields } : ic));
  const removeIcon = (idx) => onChange(icons.filter((_, i) => i !== idx));

  const openValueDialog = (idx) => setDialog({ idx, mode: 'value', initialValue: icons[idx].value || '' });
  const openCoinDialog = (idx) => setDialog({ idx, mode: 'coin', initialValue: icons[idx].coinModifier?.value || '1' });
  const openVpDialog = (idx) => setDialog({ idx, mode: 'vp', initialValue: icons[idx].vpModifier?.value || '1' });

  const handleCoinClick = (idx) => {
    if (icons[idx].coinModifier) openCoinDialog(idx);
    else updateIcon(idx, { coinModifier: { value: '1' } });
  };
  const handleVpClick = (idx) => {
    if (icons[idx].vpModifier) openVpDialog(idx);
    else updateIcon(idx, { vpModifier: { value: '1' } });
  };
  const NEIGHBOR_LABEL = { left: '←', right: '→', both: '↔' };
  const cycleNeighbor = (idx) => {
    const cur = icons[idx].neighborArrow;
    const next = !cur ? 'left' : cur === 'left' ? 'right' : cur === 'right' ? 'both' : null;
    updateIcon(idx, { neighborArrow: next });
  };
  const togglePlayed = (idx) => updateIcon(idx, { played: !icons[idx].played });
  const handleRemove = () => {
    const { idx, mode } = dialog || {};
    if (mode === 'coin') updateIcon(idx, { coinModifier: null });
    else if (mode === 'vp') updateIcon(idx, { vpModifier: null });
    setDialog(null);
  };

  const handleConfirm = (val) => {
    const { idx, mode } = dialog;
    if (mode === 'value') updateIcon(idx, { value: val });
    else if (mode === 'coin') updateIcon(idx, { coinModifier: { ...(icons[idx].coinModifier || {}), value: val } });
    else if (mode === 'vp') updateIcon(idx, { vpModifier: { ...(icons[idx].vpModifier || {}), value: val } });
    setDialog(null);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Add Ability Icon</Label>
        <div className="flex flex-wrap gap-1">
          {allPicker.map(ic => (
            <button
              key={ic.id}
              title={`Add ${ic.name}`}
              onClick={() => addIcon(ic)}
              className="w-9 h-9 rounded-full border border-border hover:border-primary flex items-center justify-center bg-background transition-colors"
            >
              <img src={ic.url} alt={ic.name} className="w-7 h-7 object-contain" />
            </button>
          ))}
        </div>
      </div>

      {icons.length > 0 && (
        <div className="flex items-center justify-between bg-muted/20 rounded-md p-2">
          <Label className="text-xs text-muted-foreground">Activated (slash between icons)</Label>
          <Button variant={activatedSlash ? "default" : "outline"} size="sm" onClick={() => onActivatedSlashChange?.(!activatedSlash)}>
            {activatedSlash ? 'On' : 'Off'}
          </Button>
        </div>
      )}

      {icons.map((ability, idx) => (
        <div key={ability.id} className="space-y-2 border border-border rounded-md p-2">
          <div className="flex items-center gap-2">
            <img src={ability.url} alt="" className="w-10 h-10 object-contain rounded bg-muted/30" />
            <Button variant="outline" size="sm" onClick={() => openValueDialog(idx)}>
              <Pencil size={12} className="mr-1" /> {ability.value ? `Value: ${ability.value}` : 'Set Value'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => removeIcon(idx)} className="ml-auto"><X size={14} /></Button>
          </div>
          <div className="flex gap-1">
            <Button variant={ability.coinModifier ? "default" : "outline"} size="sm" onClick={() => handleCoinClick(idx)} className="h-7 px-2 text-[11px]">
              {ability.coinModifier ? `Coin ${ability.coinModifier.value}` : 'Coin'}
            </Button>
            <Button variant={ability.vpModifier ? "default" : "outline"} size="sm" onClick={() => handleVpClick(idx)} className="h-7 px-2 text-[11px]">
              {ability.vpModifier ? `VP ${ability.vpModifier.value}` : 'VP'}
            </Button>
            <Button variant={ability.neighborArrow ? "default" : "outline"} size="sm" onClick={() => cycleNeighbor(idx)} className="h-7 px-2 text-[11px]">
              {ability.neighborArrow ? `Neighbor ${NEIGHBOR_LABEL[ability.neighborArrow]}` : 'Neighbor'}
            </Button>
            <Button variant={ability.played ? "default" : "outline"} size="sm" onClick={() => togglePlayed(idx)} className="h-7 px-2 text-[11px]">
              Played
            </Button>
          </div>
        </div>
      ))}

      <IconValueDialog
        open={!!dialog}
        title={dialog ? TITLES[dialog.mode] : ''}
        initialValue={dialog?.initialValue ?? ''}
        onConfirm={handleConfirm}
        onCancel={() => setDialog(null)}
        onRemove={handleRemove}
      />
    </div>
  );
}