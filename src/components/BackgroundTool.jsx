import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Image as ImageIcon, Upload, X, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SavedColorPicker from '@/components/cards/freecanvas/SavedColorPicker';

const BG_TYPES = [
  { key: 'color', label: 'Color' },
  { key: 'image', label: 'Image' },
  { key: 'none', label: 'None' },
];

function SegButtons({ value, options, onChange }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <Button key={o.key} size="sm" variant={value === o.key ? 'default' : 'outline'} onClick={() => onChange(o.key)} className="h-8">
          {o.label}
        </Button>
      ))}
    </div>
  );
}

// Resolve the effective image list from either the new bgImages array or a
// legacy single bgImage string.
function getBgImages(config) {
  if (Array.isArray(config.bgImages)) return config.bgImages.filter(Boolean);
  return config.bgImage ? [config.bgImage] : [];
}

export default function BackgroundTool({ config, setConfig }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const images = getBgImages(config);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      setConfig((c) => {
        const existing = getBgImages(c);
        const next = [...existing, ...urls];
        return { ...c, bgImages: next, bgImage: next[0] || '' };
      });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (idx) => {
    setConfig((c) => {
      const existing = getBgImages(c);
      const next = existing.filter((_, i) => i !== idx);
      return { ...c, bgImages: next, bgImage: next[0] || '' };
    });
  };

  const active = config.bgType !== 'none';

  return (
    <>
      <Button variant={active ? 'default' : 'outline'} size="sm" onClick={() => setOpen(true)}>
        <ImageIcon size={14} className="mr-2" /> Background
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Background</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Background</Label>
              <SegButtons value={config.bgType} options={BG_TYPES} onChange={(k) => setConfig({ ...config, bgType: k })} />
            </div>
            {config.bgType === 'color' && (
              <div className="flex items-center gap-2">
                <SavedColorPicker
                  value={config.bgColor}
                  onChange={(v) => setConfig({ ...config, bgColor: v })}
                  className="w-9 h-9"
                  title="Background color"
                />
                <Input
                  value={config.bgColor}
                  onChange={(e) => setConfig({ ...config, bgColor: e.target.value })}
                  className="w-32 font-mono text-xs"
                />
              </div>
            )}
            {config.bgType === 'image' && (
              <div className="space-y-2">
                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {images.map((url, idx) => (
                      <div key={idx} className="relative group w-full aspect-square rounded border border-border overflow-hidden bg-muted/30">
                        <img src={url} alt="bg" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          title="Remove"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full justify-start">
                  {uploading ? <Upload size={14} className="mr-2" /> : <Plus size={14} className="mr-2" />}
                  {uploading ? 'Uploading...' : (images.length ? 'Add more images' : 'Upload images')}
                </Button>
                {images.length > 1 && (
                  <p className="text-[11px] text-muted-foreground">A random one of these {images.length} images is used each time the card is saved.</p>
                )}
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          <DialogFooter>
            <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}