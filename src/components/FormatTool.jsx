import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LayoutGrid } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

const CROP_PX = Math.round(0.125 * 300); // 1/8" at 300 DPI

function loadImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

export default function FormatTool({ className, iconSize = 14 }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filename, setFilename] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [applyCrop, setApplyCrop] = useState(false);

  const handleButtonClick = () => fileInputRef.current?.click();

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles(files);
    setFilename('');
    setShowDialog(true);
    e.target.value = '';
  };

  const handleConfirm = async () => {
    if (selectedFiles.length === 0) return;
    setProcessing(true);
    try {
      const images = (await Promise.all(selectedFiles.map(loadImage))).filter(Boolean);
      if (images.length === 0) {
        toast({ title: 'No valid images', variant: 'destructive' });
        return;
      }

      const prepared = images.map((img) => {
        if (!applyCrop) return { img, sx: 0, sy: 0, sw: img.width, sh: img.height };
        const crop = Math.min(CROP_PX, Math.floor(Math.min(img.width, img.height) / 2));
        return { img, sx: crop, sy: crop, sw: img.width - 2 * crop, sh: img.height - 2 * crop };
      });

      const cellW = Math.max(...prepared.map((c) => c.sw));
      const cellH = Math.max(...prepared.map((c) => c.sh));

      const n = prepared.length;
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);

      const canvas = document.createElement('canvas');
      canvas.width = cols * cellW;
      canvas.height = rows * cellH;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      prepared.forEach((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.drawImage(c.img, c.sx, c.sy, c.sw, c.sh, col * cellW, row * cellH, c.sw, c.sh);
      });

      let out = canvas;
      const MAX = 4096;
      if (canvas.width > MAX || canvas.height > MAX) {
        const scale = Math.min(MAX / canvas.width, MAX / canvas.height);
        out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(canvas.width * scale));
        out.height = Math.max(1, Math.round(canvas.height * scale));
        const octx = out.getContext('2d');
        octx.fillStyle = '#ffffff';
        octx.fillRect(0, 0, out.width, out.height);
        octx.drawImage(canvas, 0, 0, out.width, out.height);
      }

      const fname = (filename.trim() || 'formatted_grid') + `_${cols}x${rows}.png`;

      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fname,
            types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
          });
          const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (err) {
          if (err.name !== 'AbortError') {
            const a = document.createElement('a');
            a.href = out.toDataURL('image/png');
            a.download = fname;
            a.click();
          }
        }
      } else {
        const a = document.createElement('a');
        a.href = out.toDataURL('image/png');
        a.download = fname;
        a.click();
      }

      setShowDialog(false);
    } catch (error) {
      toast({ title: 'Format failed', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleButtonClick} className={className}>
        <LayoutGrid size={iconSize} className="mr-2" /> TTS
      </Button>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Format Images</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedFiles.length} image(s) selected. They will be arranged in a grid with no margins. Toggle the crop option below to trim 1/8" from each edge.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyCrop}
                onChange={(e) => setApplyCrop(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-foreground">Crop 1/8" from each edge</span>
            </label>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Filename</Label>
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Enter filename..."
                className="bg-muted/30 border-border"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={processing}>
              {processing ? 'Processing...' : 'Save Grid'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}