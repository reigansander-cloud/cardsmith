import React, { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, X, ChevronDown, FileText, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DrawButton from '@/components/DrawButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function GlimpsesEditor({ data, onChange, onNameChange }) {
  const { title = '', bannerNumber = '', bannerIconUrl = '', bannerIcon2Url = '', artUrl = '', footerText = '', footerText2 = '', textless = false } = data || {};
  const [icons, setIcons] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picker2Open, setPicker2Open] = useState(false);
  const [docTextOpen, setDocTextOpen] = useState(false);
  const [docText, setDocText] = useState('');
  const [section2Added, setSection2Added] = useState(!!footerText2);
  const footerRef = useRef(null);
  const footer2Ref = useRef(null);
  const picker2Ref = useRef(null);

  const DEFAULT_ICONS = [
    { id: 'default_crown', name: 'Crown', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/bf77aa7260_193d28fa7_ICON4.png' },
    { id: 'default_eye', name: 'Eye', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/f86b9ae102_8b7c641d4_ICON3.png' },
    { id: 'default_hourglass', name: 'Hourglass', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/013d958c4c_cff2c146b_ICON2.png' },
    { id: 'default_pillar', name: 'Pillar', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/43a81f84a9_865386231_ICON1.png' },
  ];
  const allIcons = [...DEFAULT_ICONS, ...icons];
  const artInputRef = useRef(null);
  const iconInputRef = useRef(null);
  const pickerRef = useRef(null);

  const update = (fields) => {
    onChange({ ...data, ...fields });
    if (fields.title !== undefined && onNameChange) onNameChange(fields.title);
  };

  useEffect(() => {
    base44.entities.UploadedIcon.list().then(setIcons).catch(() => {});
  }, []);

  useEffect(() => {
    if (footerText2) setSection2Added(true);
  }, [footerText2]);

  useEffect(() => {
    if (!pickerOpen && !picker2Open) return;
    const handler = (e) => {
      if (pickerOpen && pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
      if (picker2Open && picker2Ref.current && !picker2Ref.current.contains(e.target)) setPicker2Open(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen, picker2Open]);

  const handleArtUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      update({ artUrl: file_url });
    } catch (err) {
      // bubble up via parent toast context if needed
    }
    if (artInputRef.current) artInputRef.current.value = '';
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      try { await base44.entities.UploadedIcon.create({ name: file.name.replace(/\.[^.]+$/, ''), url: file_url }); } catch {}
      setIcons(prev => [...prev, { id: `tmp_${Date.now()}`, name: file.name, url: file_url }]);
      update({ bannerIconUrl: file_url });
    } catch (err) {
      // ignore
    }
    if (iconInputRef.current) iconInputRef.current.value = '';
  };

  const BANNER_ICON_SHORTCUTS = {
    Focused: DEFAULT_ICONS[0].url,
    Fragile: DEFAULT_ICONS[3].url,
  };

  const getIconRef = (icon) => {
    const isDefault = DEFAULT_ICONS.some(d => d.url === icon.url);
    return isDefault ? icon.name.toLowerCase() : icon.url;
  };

  const handleDocImport = () => {
    const lines = docText.trim().split('\n');
    if (lines.length < 1) return;
    const newData = { ...data };
    const line1 = lines[0].trim();
    const lastSpace = line1.lastIndexOf(' ');
    if (lastSpace > 0) {
      newData.title = line1.slice(0, lastSpace);
      newData.bannerNumber = line1.slice(lastSpace + 1);
    } else {
      newData.title = line1;
    }
    if (lines.length >= 2) {
      const shortcuts = lines[1].trim().split(/\s+/);
      const iconUrls = shortcuts.map(s => BANNER_ICON_SHORTCUTS[s]).filter(Boolean);
      if (iconUrls[0]) newData.bannerIconUrl = iconUrls[0];
      if (iconUrls[1]) newData.bannerIcon2Url = iconUrls[1];
    }
    if (lines.length >= 3) {
      let footer = lines.slice(2).join('\n').trim();
      const first = footer[0];
      if (first === '>') {
        newData.bannerIcon2Url = DEFAULT_ICONS[1].url; // Eye = Icon 3
        footer = footer.slice(1).trim();
      } else if (first === '=') {
        newData.bannerIcon2Url = DEFAULT_ICONS[0].url; // Crown = Icon 4
        footer = footer.slice(1).trim();
      }
      // Replace keywords and remaining > / = with inline icons
      footer = footer.replace(/Fragile/g, '[icon:pillar]')
        .replace(/Focused/g, '[icon:crown]')
        .replace(/>/g, '[icon:eye]')
        .replace(/=/g, '[icon:hourglass]');
      newData.footerText = footer;
    }
    onChange(newData);
    if (onNameChange) onNameChange(newData.title);
    setDocTextOpen(false);
    setDocText('');
  };

  const insertFooterIcon = (iconRef, refEl, fieldName) => {
    const el = refEl.current;
    if (!el) return;
    const tag = `[icon:${iconRef}]`;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = (data || {})[fieldName] || '';
    const newVal = val.slice(0, start) + tag + val.slice(end);
    update({ [fieldName]: newVal });
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + tag.length;
      el.focus();
    });
  };

  return (
    <div className="space-y-3 [&>*]:bg-card [&>*]:border [&>*]:border-border [&>*]:rounded-lg [&>*]:p-4">
      {/* Title */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Header Title</Label>
        <Input
          value={title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Engraved title..."
          className="bg-muted/30 border-border"
        />
      </div>

      {/* Main Artwork */}
      <div className="pt-4">
        <Label className="text-xs text-muted-foreground mb-1 block">Main Artwork</Label>
        <div className="flex items-center gap-2">
          {artUrl && <img src={artUrl} alt="" className="w-12 h-16 object-cover border border-border rounded" />}
          <Button variant="outline" size="sm" onClick={() => artInputRef.current?.click()}>
            <Upload size={14} className="mr-2" /> Upload
          </Button>
          <DrawButton onSave={(url) => update({ artUrl: url })} />
          {artUrl && (
            <Button variant="ghost" size="sm" onClick={() => update({ artUrl: '' })} className="h-8">
              <X size={14} />
            </Button>
          )}
          <input ref={artInputRef} type="file" accept="image/*" className="hidden" onChange={handleArtUpload} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">Fills the center area (cover crop).</p>
      </div>

      {/* Left Banner */}
      <div className="pt-4 space-y-3">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Left Banner</Label>

        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Banner Number</Label>
          <Input
            value={bannerNumber}
            onChange={(e) => update({ bannerNumber: e.target.value })}
            placeholder="e.g. 7"
            className="bg-muted/30 border-border"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Banner Icon</Label>
          <div className="flex items-center gap-2">
            <div ref={pickerRef} className="relative">
              <Button variant="outline" size="sm" onClick={() => setPickerOpen(!pickerOpen)}>
                {bannerIconUrl ? (
                  <img src={bannerIconUrl} alt="" className="w-5 h-5 object-contain mr-1" />
                ) : (
                  <span className="text-xs text-muted-foreground mr-1">Choose</span>
                )}
                <ChevronDown size={14} />
              </Button>
              {pickerOpen && (
                <div className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-xl p-2 grid grid-cols-4 gap-1 w-56 max-h-56 overflow-y-auto">
                  {allIcons.map(icon => (
                    <button
                      key={icon.id}
                      className={`flex items-center justify-center w-12 h-12 rounded border transition-colors ${
                        bannerIconUrl === icon.url ? 'border-primary bg-primary/15' : 'border-transparent hover:border-border hover:bg-muted/50'
                      }`}
                      title={icon.name}
                      onClick={() => { update({ bannerIconUrl: icon.url }); setPickerOpen(false); }}
                    >
                      <img src={icon.url} alt={icon.name} className="w-8 h-8 object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => iconInputRef.current?.click()}>
              <Upload size={14} className="mr-1" /> Upload
            </Button>
            {bannerIconUrl && (
              <Button variant="ghost" size="sm" onClick={() => update({ bannerIconUrl: '' })} className="h-8">
                <X size={14} /> Clear
              </Button>
            )}
            <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Optional icon shown in the lower segment of the banner.</p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Second Banner Icon</Label>
          <div className="flex items-center gap-2">
            <div ref={picker2Ref} className="relative">
              <Button variant="outline" size="sm" onClick={() => setPicker2Open(!picker2Open)}>
                {bannerIcon2Url ? (
                  <img src={bannerIcon2Url} alt="" className="w-5 h-5 object-contain mr-1" />
                ) : (
                  <span className="text-xs text-muted-foreground mr-1">Choose</span>
                )}
                <ChevronDown size={14} />
              </Button>
              {picker2Open && (
                <div className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-xl p-2 grid grid-cols-4 gap-1 w-56 max-h-56 overflow-y-auto">
                  {allIcons.map(icon => (
                    <button
                      key={icon.id}
                      className={`flex items-center justify-center w-12 h-12 rounded border transition-colors ${
                        bannerIcon2Url === icon.url ? 'border-primary bg-primary/15' : 'border-transparent hover:border-border hover:bg-muted/50'
                      }`}
                      title={icon.name}
                      onClick={() => { update({ bannerIcon2Url: icon.url }); setPicker2Open(false); }}
                    >
                      <img src={icon.url} alt={icon.name} className="w-8 h-8 object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {bannerIcon2Url && (
              <Button variant="ghost" size="sm" onClick={() => update({ bannerIcon2Url: '' })} className="h-8">
                <X size={14} /> Clear
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Adds a third banner segment below the first.</p>
        </div>
      </div>

      {/* Footer Rules Text */}
      {!textless && (
        <div className="pt-4">
          <Label className="text-xs text-muted-foreground mb-1 block">Footer Rules Text</Label>
          <div className="flex flex-wrap gap-1 mb-1">
            {allIcons.map(icon => {
              const ref = getIconRef(icon);
              return (
                <button
                  key={icon.id}
                  title={`Insert ${icon.name}`}
                  onClick={() => insertFooterIcon(ref, footerRef, 'footerText')}
                  className="w-7 h-7 rounded border border-border hover:border-primary flex items-center justify-center bg-background transition-colors"
                >
                  <img src={icon.url} alt={icon.name} className="w-5 h-5 object-contain" />
                </button>
              );
            })}
          </div>
          <textarea
            ref={footerRef}
            value={footerText}
            onChange={(e) => update({ footerText: e.target.value })}
            placeholder="Rules text... use icons above to insert inline"
            rows={4}
            className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {section2Added ? (
            <div className="mt-3 pt-3">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Second Rules Section</Label>
                <Button variant="ghost" size="sm" onClick={() => { setSection2Added(false); update({ footerText2: '' }); }} className="h-6 px-2">
                  <X size={12} /> Remove
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                {allIcons.map(icon => {
                  const ref = getIconRef(icon);
                  return (
                    <button
                      key={icon.id}
                      title={`Insert ${icon.name}`}
                      onClick={() => insertFooterIcon(ref, footer2Ref, 'footerText2')}
                      className="w-7 h-7 rounded border border-border hover:border-primary flex items-center justify-center bg-background transition-colors"
                    >
                      <img src={icon.url} alt={icon.name} className="w-5 h-5 object-contain" />
                    </button>
                  );
                })}
              </div>
              <textarea
                ref={footer2Ref}
                value={footerText2}
                onChange={(e) => update({ footerText2: e.target.value })}
                placeholder="Second rules section..."
                rows={3}
                className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setSection2Added(true)} className="mt-2">
              <Plus size={14} className="mr-1" /> Add Section
            </Button>
          )}
        </div>
      )}

      {/* Doc Text + Textless */}
      <div className="pt-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setDocTextOpen(true)}>
          <FileText size={14} className="mr-1" /> Doc Text
        </Button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => update({ textless: !textless })}
            className={`relative w-9 h-5 rounded-full transition-colors ${textless ? 'bg-primary' : 'bg-muted'}`}
            title="Hide footer and extend artwork to bottom"
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${textless ? 'left-4' : 'left-0.5'}`} />
          </button>
          <span className="text-xs text-muted-foreground whitespace-nowrap">Textless</span>
        </div>
      </div>

      <Dialog open={docTextOpen} onOpenChange={setDocTextOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Doc Text</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Paste card info in this format:</p>
          <pre className="text-[11px] text-muted-foreground bg-muted/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`Name Banner number
Banner icon/s shortcut text
footer rules text

Shortcuts: Focused = Icon 4, Fragile = Icon 1
Footer prefix: > = Icon 3 (banner), = = Icon 4 (banner)
In text: Fragile = Pillar, Focused = Crown, > = Eye, = = Hourglass`}</pre>
          <textarea
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            placeholder={`Knelt To Many Rulers 3
Focused
> In turn order, each opponent chooses...`}
            rows={6}
            className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDocTextOpen(false); setDocText(''); }}>Cancel</Button>
            <Button size="sm" onClick={handleDocImport}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}