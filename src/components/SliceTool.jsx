import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Scissors, Upload, FolderOpen, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { saveDirHandle, ensurePermission } from '@/lib/dirHandleStore';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function availableName(directory, filename) {
  const dot = filename.lastIndexOf('.');
  const base = dot !== -1 ? filename.slice(0, dot) : filename;
  const ext = dot !== -1 ? filename.slice(dot) : '';
  let candidate = filename;
  let counter = 1;
  while (true) {
    try {
      await directory.getFileHandle(candidate);
      candidate = `${base} (${counter})${ext}`;
      counter++;
    } catch {
      return candidate;
    }
  }
}

export default function SliceTool({ className, iconSize = 14 }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [grid, setGrid] = useState({ w: 2, h: 2 });
  const [saveCount, setSaveCount] = useState(4);
  const [dirHandle, setDirHandle] = useState(null);
  const [slicing, setSlicing] = useState(false);
  const fileRef = useRef(null);

  const total = Math.max(1, grid.w) * Math.max(1, grid.h);

  useEffect(() => {
    if (!imgSrc) { setImgSize({ w: 0, h: 0 }); return; }
    let cancelled = false;
    loadImage(imgSrc).then(img => { if (!cancelled) setImgSize({ w: img.naturalWidth, h: img.naturalHeight }); }).catch(() => {});
    return () => { cancelled = true; };
  }, [imgSrc]);

  useEffect(() => { setSaveCount(total); }, [total]);

  const chooseFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result);
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const chooseFolder = async () => {
    if (!window.showDirectoryPicker) {
      toast({ title: 'Not supported', description: 'Folder selection requires Chrome or Edge on desktop. Slices will download instead.' });
      return;
    }
    try {
      const handle = await window.showDirectoryPicker();
      setDirHandle(handle);
      saveDirHandle('sliceSave', handle);
    } catch (e) {
      if (e?.name !== 'AbortError') toast({ title: 'Folder selection unavailable', description: 'Folder saving works in the published app.' });
    }
  };

  const slice = async () => {
    if (!imgSrc) { toast({ title: 'No image', description: 'Upload a picture first.', variant: 'destructive' }); return; }
    const cols = Math.max(1, Math.floor(grid.w));
    const rows = Math.max(1, Math.floor(grid.h));
    const keep = Math.min(Math.max(1, Math.floor(saveCount)), cols * rows);
    setSlicing(true);
    try {
      const img = await loadImage(imgSrc);
      const cellW = Math.floor(img.naturalWidth / cols);
      const cellH = Math.floor(img.naturalHeight / rows);
      if (cellW < 1 || cellH < 1) {
        toast({ title: 'Image too small', description: `Image is ${img.naturalWidth}×${img.naturalHeight} for a ${cols}×${rows} grid.`, variant: 'destructive' });
        return;
      }
      const folderOk = dirHandle && await ensurePermission(dirHandle);
      let saved = 0;
      for (let i = 0; i < cols * rows && saved < keep; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const canvas = document.createElement('canvas');
        canvas.width = cellW;
        canvas.height = cellH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const name = `Slice ${saved + 1}.png`;
        if (folderOk) {
          const finalName = await availableName(dirHandle, name);
          const fh = await dirHandle.getFileHandle(finalName, { create: true });
          const w = await fh.createWritable();
          await w.write(blob);
          await w.close();
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          a.click();
          URL.revokeObjectURL(url);
        }
        saved++;
      }
      const skipped = cols * rows - saved;
      if (folderOk) toast({ title: 'Sliced', description: `Saved ${saved} slice${saved === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} skipped)` : ''} to ${dirHandle.name}.` });
      else toast({ title: 'Sliced', description: `Downloaded ${saved} slice${saved === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} skipped)` : ''}. Pick a folder to save them together.` });
      setOpen(false);
    } catch (err) {
      toast({ title: 'Slice failed', description: err.message, variant: 'destructive' });
    } finally {
      setSlicing(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className={className}>
        <Scissors size={iconSize} className="mr-2" /> Slice
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Slice a picture</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Picture</Label>
              {imgSrc ? (
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded border border-border overflow-hidden bg-muted/30 flex-shrink-0">
                    <img src={imgSrc} alt="" className="w-full h-full object-contain" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setImgSrc('')}><X size={14} className="mr-1.5" /> Remove</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="w-full justify-start">
                  <Upload size={14} className="mr-2" /> Upload picture
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={chooseFile} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Grid (columns × rows)</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min="1" value={grid.w} onChange={(e) => setGrid(s => ({ ...s, w: Math.max(1, Number(e.target.value) || 1) }))} className="w-24 bg-muted/30 border-border" />
                <span className="text-muted-foreground">×</span>
                <Input type="number" min="1" value={grid.h} onChange={(e) => setGrid(s => ({ ...s, h: Math.max(1, Number(e.target.value) || 1) }))} className="w-24 bg-muted/30 border-border" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Divides the picture into {total} equal slice{total === 1 ? '' : 's'}.</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Slices to save</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max={total}
                  value={saveCount}
                  onChange={(e) => setSaveCount(Math.min(total, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-24 bg-muted/30 border-border"
                />
                <Button variant="outline" size="sm" onClick={() => setSaveCount(total)} disabled={saveCount === total} className="h-9">All</Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Saves the first {Math.min(saveCount, total)} of {total} (row by row, left to right); the rest are skipped.</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Save folder</Label>
              <Button variant="outline" size="sm" onClick={chooseFolder} className="w-full justify-start">
                <FolderOpen size={14} className="mr-2" /> {dirHandle ? dirHandle.name : 'Choose folder'}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1">Without a folder, slices download individually. Folder saving works in the published app.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={slice} disabled={slicing || !imgSrc}>{slicing ? 'Slicing...' : 'Slice'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}