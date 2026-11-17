import React, { useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { base44 } from '@/api/base44Client';

const FRAME_STYLES = [
  { key: 'ornate', label: 'Ornate' },
  { key: 'plain', label: 'Plain' },
  { key: 'double', label: 'Double' },
  { key: 'bold', label: 'Bold' },
  { key: 'etched', label: 'Etched' },
];

const FONT_OPTIONS = [
  { key: 'CaesarDressing', label: 'Caesar' },
  { key: 'Rye', label: 'Rye' },
  { key: 'Poiret One', label: 'Poiret' },
  { key: 'Naluka', label: 'Naluka' },
  { key: 'Alte DIN 1451 Mittelschrift', label: 'DIN' },
  { key: 'Albert Sans', label: 'Albert' },
  { key: 'Inter', label: 'Inter' },
];

export default function PlayingCardEditor({ data, onChange, onNameChange }) {
  const {
    value = 'A',
    suitIconUrl = '',
    accentColor = '#1a1a2e',
    contentTitle = '',
    content = '',
    frameStyle = 'ornate',
    artworkUrl = '',
    artworkOffset = 0,
    headerText = '',
    abilitiesText = '',
    showHeader = false,
    showAbilities = false,
    showContentTitle = false,
    showContent = false,
    abilitiesIconUrl = '',
    fontFamily = 'CaesarDressing',
  } = data || {};
  const fileRef = useRef(null);
  const artworkRef = useRef(null);
  const contentRef = useRef(null);
  const contentIconRef = useRef(null);
  const abilitiesRef = useRef(null);
  const abilitiesIconRef = useRef(null);
  const abilitiesBoxIconRef = useRef(null);

  const update = (fields) => {
    onChange({ ...data, ...fields });
    if (fields.value !== undefined && onNameChange) onNameChange(fields.value);
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update({ suitIconUrl: file_url });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleAbilitiesIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update({ abilitiesIconUrl: file_url });
    if (abilitiesBoxIconRef.current) abilitiesBoxIconRef.current.value = '';
  };

  const handleArtworkUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update({ artworkUrl: file_url });
    if (artworkRef.current) artworkRef.current.value = '';
  };

  const insertIcon = async (e, field, el) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const tag = `[icon:${file_url}]`;
    const current = data[field] || '';
    if (el) {
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const next = current.slice(0, start) + tag + current.slice(end);
      update({ [field]: next });
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + tag.length;
        el.focus();
      });
    } else {
      update({ [field]: current + tag });
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-3 [&>*]:bg-card [&>*]:border [&>*]:border-border [&>*]:rounded-lg [&>*]:p-4">
      <div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Value</Label>
            <Input
              value={value}
              onChange={(e) => update({ value: e.target.value })}
              placeholder="A, 2–10..."
              className="bg-muted/30 border-border"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Font</Label>
            <select
              value={fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-muted/30 px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {FONT_OPTIONS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Suit Icon</Label>
            <div className="flex items-center gap-1">
              {suitIconUrl && <img src={suitIconUrl} alt="" className="w-9 h-9 object-contain border border-border rounded" />}
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload size={14} />
              </Button>
              {suitIconUrl && (
                <Button variant="ghost" size="sm" onClick={() => update({ suitIconUrl: '' })}>
                  <X size={14} />
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Color</Label>
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="w-9 h-9 rounded border border-border cursor-pointer bg-transparent"
              />
              <Input
                value={accentColor}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="w-full bg-muted/30 border-border"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Frame Style</Label>
        <div className="flex items-center gap-2">
          {FRAME_STYLES.map((s) => (
            <Button
              key={s.key}
              variant={frameStyle === s.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => update({ frameStyle: s.key })}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs text-muted-foreground">Artwork (center frame)</Label>
          {artworkUrl && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Position</span>
              <Slider
                value={[artworkOffset]}
                onValueChange={(v) => update({ artworkOffset: v[0] })}
                min={-100}
                max={100}
                className="w-24"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {artworkUrl && <img src={artworkUrl} alt="" className="w-12 h-12 object-cover border border-border rounded" />}
          <Button variant="outline" size="sm" onClick={() => artworkRef.current?.click()}>
            <Upload size={14} className="mr-2" /> Upload
          </Button>
          {artworkUrl && (
            <Button variant="ghost" size="sm" onClick={() => update({ artworkUrl: '' })}>
              <X size={14} />
            </Button>
          )}
          <input ref={artworkRef} type="file" accept="image/*" className="hidden" onChange={handleArtworkUpload} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">Fills the center frame. Use the Optional Sections below to add a header plate and abilities box.</p>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Optional Sections</Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'showHeader', label: 'Header' },
            { key: 'showAbilities', label: 'Abilities' },
            { key: 'showContentTitle', label: 'Content Title' },
            { key: 'showContent', label: 'Content' },
          ].map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{s.label}</span>
              <button
                onClick={() => update({ [s.key]: !data[s.key] })}
                className={`relative w-9 h-5 rounded-full transition-colors ${data[s.key] ? 'bg-primary' : 'bg-muted'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${data[s.key] ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {showHeader && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Header Text</Label>
          <Input
            value={headerText}
            onChange={(e) => update({ headerText: e.target.value })}
            placeholder="Title on the top plate"
            className="bg-muted/30 border-border"
          />
        </div>
      )}

      {showAbilities && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Abilities</Label>
          <textarea
            ref={abilitiesRef}
            value={abilitiesText}
            onChange={(e) => update({ abilitiesText: e.target.value })}
            placeholder="Abilities text on the bottom box..."
            rows={3}
            className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center gap-2 mt-1">
            <Button variant="outline" size="sm" onClick={() => abilitiesIconRef.current?.click()}>
              <Upload size={14} className="mr-2" /> Upload icon
            </Button>
            <input ref={abilitiesIconRef} type="file" accept="image/*" className="hidden" onChange={(e) => insertIcon(e, 'abilitiesText', abilitiesRef.current)} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Insert icons inline into the abilities box.</p>
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Abilities box icon (left side)</Label>
            <div className="flex items-center gap-2">
              {abilitiesIconUrl && <img src={abilitiesIconUrl} alt="" className="w-10 h-10 object-contain border border-border rounded" />}
              <Button variant="outline" size="sm" onClick={() => abilitiesBoxIconRef.current?.click()}>
                <Upload size={14} className="mr-2" /> Upload
              </Button>
              {abilitiesIconUrl && (
                <Button variant="ghost" size="sm" onClick={() => update({ abilitiesIconUrl: '' })}>
                  <X size={14} />
                </Button>
              )}
              <input ref={abilitiesBoxIconRef} type="file" accept="image/*" className="hidden" onChange={handleAbilitiesIconUpload} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sits on the left of the abilities box, pushing text right.</p>
          </div>
        </div>
      )}

      {showContentTitle && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Content Title</Label>
          <Input
            value={contentTitle}
            onChange={(e) => update({ contentTitle: e.target.value })}
            placeholder="Optional title for the center text"
            className="bg-muted/30 border-border"
          />
        </div>
      )}

      {showContent && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Content</Label>
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => update({ content: e.target.value })}
            placeholder="Add text here to replace the center suit icons..."
            rows={4}
            className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center gap-2 mt-1">
            <Button variant="outline" size="sm" onClick={() => contentIconRef.current?.click()}>
              <Upload size={14} className="mr-2" /> Upload icon
            </Button>
            <input ref={contentIconRef} type="file" accept="image/*" className="hidden" onChange={(e) => insertIcon(e, 'content', contentRef.current)} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Upload icons to insert inline (not saved to your library). While content is present, the center suit icons are hidden.</p>
        </div>
      )}

    </div>
  );
}