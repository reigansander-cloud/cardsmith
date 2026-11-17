import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderOpen, Layers, FileJson, ClipboardPaste } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { parsePsdToElements } from '@/lib/psdExport';
import { useToast } from '@/components/ui/use-toast';

export default function FreeCanvasStartDialog({ open, onOpenChange, onSizeSelect, onTemplateSelect, onOpenFile, onOpenPsd, onOpenCs }) {
  const [customSize, setCustomSize] = useState({ w: 360, h: 504 });
  const [uploading, setUploading] = useState(false);
  const [clipboardReady, setClipboardReady] = useState(false);
  const fileRef = useRef(null);
  const psdFileRef = useRef(null);
  const csFileRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    checkClipboard();
    const onFocus = () => checkClipboard();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [open]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const img = new Image();
      img.onload = () => {
        onOpenFile(file_url, img.width, img.height);
        if (fileRef.current) fileRef.current.value = '';
      };
      img.onerror = () => {
        onOpenFile(file_url, 360, 504);
        if (fileRef.current) fileRef.current.value = '';
      };
      img.src = file_url;
    } catch (err) {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  const checkClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) { setClipboardReady(false); return; }
      const items = await navigator.clipboard.read();
      const hasImage = items.some(it => it.types.some(t => t.startsWith('image/')));
      setClipboardReady(hasImage);
    } catch {
      setClipboardReady(false);
    }
  };

  const handleClipboard = async () => {
    if (!clipboardReady) return;
    setUploading(true);
    try {
      const items = await navigator.clipboard.read();
      const item = items.find(it => it.types.some(t => t.startsWith('image/')));
      if (!item) { toast({ title: 'No image on clipboard', variant: 'destructive' }); return; }
      const type = item.types.find(t => t.startsWith('image/'));
      const blob = await item.getType(type);
      const file = new File([blob], 'clipboard-image.png', { type });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const img = new Image();
      img.onload = () => onOpenFile(file_url, img.width, img.height);
      img.onerror = () => onOpenFile(file_url, 360, 504);
      img.src = file_url;
    } catch (err) {
      toast({ title: 'Clipboard import failed', description: err?.message || 'Could not read the clipboard.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handlePsdFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { width, height, elements } = await parsePsdToElements(file, (blob) => base44.integrations.Core.UploadFile({ file: blob }));
      onOpenPsd(width, height, elements);
    } catch (err) {
      toast({ title: 'PSD import failed', description: err?.message || 'Could not read the PSD file.', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (psdFileRef.current) psdFileRef.current.value = '';
    }
  };

  const handleCsFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = parsed && parsed.data ? parsed.data : parsed;
      if (!data || typeof data !== 'object') throw new Error('Invalid CS file');
      onOpenCs(data);
    } catch (err) {
      toast({ title: 'CS import failed', description: err?.message || 'Could not read the CS file.', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (csFileRef.current) csFileRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-no-deselect>
        <DialogHeader>
          <DialogTitle>New Free Canvas</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
              onClick={() => onSizeSelect(360, 504)}
            >
              <div className="bg-muted rounded-md border border-border" style={{ width: 48, height: 67 }} />
              <div className="text-center">
                <div className="font-semibold text-xs">Standard</div>
                <div className="text-[10px] text-muted-foreground">360 × 504</div>
              </div>
            </button>
            <button
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
              onClick={() => onSizeSelect(850, 550)}
            >
              <div className="bg-muted rounded-md border border-border" style={{ width: 72, height: 47 }} />
              <div className="text-center">
                <div className="font-semibold text-xs">Paper</div>
                <div className="text-[10px] text-muted-foreground">850 × 550</div>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-border hover:border-primary transition-all">
            <span className="font-semibold text-xs flex-shrink-0">Custom</span>
            <Input
              type="number" min="1"
              value={customSize.w}
              onChange={(e) => setCustomSize(s => ({ ...s, w: Math.max(1, Number(e.target.value) || 0) }))}
              className="w-20 bg-muted/30 border-border h-8"
            />
            <span className="text-muted-foreground text-xs">×</span>
            <Input
              type="number" min="1"
              value={customSize.h}
              onChange={(e) => setCustomSize(s => ({ ...s, h: Math.max(1, Number(e.target.value) || 0) }))}
              className="w-20 bg-muted/30 border-border h-8"
            />
            <Button
              size="sm"
              className="ml-auto"
              disabled={!(customSize.w > 0 && customSize.h > 0)}
              onClick={() => onSizeSelect(customSize.w, customSize.h)}
            >
              Create
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="h-auto py-4 flex-col gap-2">
              <FolderOpen size={20} />
              <span className="text-xs font-semibold">{uploading ? 'Uploading...' : 'Open from file'}</span>
            </Button>
            <Button variant="outline" onClick={handleClipboard} disabled={uploading || !clipboardReady} className="h-auto py-4 flex-col gap-2">
              <ClipboardPaste size={20} />
              <span className="text-xs font-semibold">{uploading ? 'Uploading...' : 'Open from clipboard'}</span>
            </Button>
            <Button variant="outline" onClick={() => psdFileRef.current?.click()} disabled={uploading} className="h-auto py-4 flex-col gap-2">
              <Layers size={20} />
              <span className="text-xs font-semibold">{uploading ? 'Importing...' : 'Open PSD'}</span>
            </Button>
            <Button variant="outline" onClick={() => csFileRef.current?.click()} disabled={uploading} className="h-auto py-4 flex-col gap-2">
              <FileJson size={20} />
              <span className="text-xs font-semibold">{uploading ? 'Opening...' : 'Open CS'}</span>
            </Button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <input ref={psdFileRef} type="file" accept=".psd" className="hidden" onChange={handlePsdFile} />
          <input ref={csFileRef} type="file" accept=".cs,application/json" className="hidden" onChange={handleCsFile} />
        </div>
      </DialogContent>
    </Dialog>
  );
}