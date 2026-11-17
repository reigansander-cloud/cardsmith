import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import SavedColorPicker from './SavedColorPicker';

function ColorField({ value, onChange }) {
  return (
    <SavedColorPicker value={value} onChange={onChange} className="w-7 h-7" title="Effect color" />
  );
}

function NumField({ value, onChange, min, max }) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={e => onChange(parseInt(e.target.value) || 0)}
      className="w-16 h-7"
    />
  );
}

function Field({ label, children }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function EffectPanel({ label, enabled, onToggle, children }) {
  return (
    <div className="border border-border rounded-md p-2 bg-muted/10 space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}{enabled ? '' : ' (off)'}</Label>
        <button
          onClick={onToggle}
          className={`relative w-8 h-4 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}
        >
          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${enabled ? 'left-3.5' : 'left-0.5'}`} />
        </button>
      </div>
      {enabled && <div className="flex flex-wrap items-center gap-2 pt-1">{children}</div>}
    </div>
  );
}

const TABS = [
  { key: 'outline', label: 'Outline' },
  { key: 'frame', label: 'Frame' },
  { key: 'shadow', label: 'Shadow' },
  { key: 'colorize', label: 'Colorize' },
];

export default function ImageEffectsEditor({ effects, onChange }) {
  const fx = effects || {};
  const set = (key, val) => onChange({ ...fx, [key]: val });
  const toggle = (key, def) => set(key, fx[key] ? null : def);
  const [tab, setTab] = useState('outline');

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Effects</Label>
      <div className="grid grid-cols-4 gap-1">
        {TABS.map(t => {
          const active = tab === t.key;
          const on = !!fx[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs px-2 py-1.5 rounded-md border transition-colors ${
                active ? 'bg-primary text-primary-foreground border-primary'
                       : on ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'outline' && (
        <EffectPanel label="Outline" enabled={!!fx.outline} onToggle={() => toggle('outline', { color: '#000000', width: 3 })}>
          <ColorField value={(fx.outline || {}).color || '#000000'} onChange={v => set('outline', { ...fx.outline, color: v })} />
          <Field label="Width">
            <NumField value={(fx.outline || {}).width || 3} min={1} max={40} onChange={v => set('outline', { ...fx.outline, width: Math.max(1, v) })} />
          </Field>
        </EffectPanel>
      )}

      {tab === 'frame' && (
        <EffectPanel label="Frame" enabled={!!fx.frame} onToggle={() => toggle('frame', { color: '#3a2a0a', width: 8 })}>
          <ColorField value={(fx.frame || {}).color || '#3a2a0a'} onChange={v => set('frame', { ...fx.frame, color: v })} />
          <Field label="Width">
            <NumField value={(fx.frame || {}).width || 8} min={1} max={60} onChange={v => set('frame', { ...fx.frame, width: Math.max(1, v) })} />
          </Field>
        </EffectPanel>
      )}

      {tab === 'shadow' && (
        <EffectPanel label="Drop Shadow" enabled={!!fx.shadow} onToggle={() => toggle('shadow', { color: '#000000', opacity: 0.5, blur: 10, x: 4, y: 4 })}>
          <ColorField value={(fx.shadow || {}).color || '#000000'} onChange={v => set('shadow', { ...fx.shadow, color: v })} />
          <Field label="Opacity">
            <Input type="number" min="0" max="1" step="0.1" value={(fx.shadow || {}).opacity ?? 0.5} onChange={e => set('shadow', { ...fx.shadow, opacity: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })} className="w-14 h-7" />
          </Field>
          <Field label="X"><NumField value={(fx.shadow || {}).x || 0} onChange={v => set('shadow', { ...fx.shadow, x: v })} /></Field>
          <Field label="Y"><NumField value={(fx.shadow || {}).y || 0} onChange={v => set('shadow', { ...fx.shadow, y: v })} /></Field>
          <Field label="Blur"><NumField value={(fx.shadow || {}).blur || 0} min={0} max={60} onChange={v => set('shadow', { ...fx.shadow, blur: Math.max(0, v) })} /></Field>
        </EffectPanel>
      )}

      {tab === 'colorize' && (
        <EffectPanel label="Colorize" enabled={!!fx.colorize} onToggle={() => toggle('colorize', { color: '#ff0000', amount: 50 })}>
          <ColorField value={(fx.colorize || {}).color || '#ff0000'} onChange={v => set('colorize', { ...fx.colorize, color: v })} />
          <Field label="Amount">
            <input type="range" min="0" max="100" step="5" value={(fx.colorize || {}).amount ?? 50} onChange={e => set('colorize', { ...fx.colorize, amount: parseInt(e.target.value) })} className="w-20 accent-primary" />
          </Field>
        </EffectPanel>
      )}
    </div>
  );
}