import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Maximize, RotateCw, Crop } from 'lucide-react';

const POINT_NAMES = ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'];
const rotatePoint90CW = (p) => POINT_NAMES[(POINT_NAMES.indexOf(p) + 2) % 8];

// Rotate the whole canvas 90° clockwise: swap dimensions, rotate every layer's
// position/size, invert image aspect ratios, bump each layer's rotation +90,
// and remap connection anchor points.
const rotateCanvas90CW = (data) => {
  const cardW = data.cardWidth || 360;
  const cardH = data.cardHeight || 504;
  const elements = (data.elements || []).map(el => {
    const rot = Math.round(((el.rotation || 0) + 90) % 360);
    if (el.type === 'image') {
      const ar = el.aspectRatio || (el.height ? el.width / el.height : 1);
      const hPx = el.width / ar;
      return { ...el, x: cardH - el.y - hPx, y: el.x, width: hPx, aspectRatio: 1 / ar, rotation: rot };
    }
    return { ...el, x: cardH - el.y - el.height, y: el.x, width: el.height, height: el.width, rotation: rot };
  });
  const connections = (data.connections || []).map(c => ({
    ...c,
    fromPoint: rotatePoint90CW(c.fromPoint),
    toPoint: rotatePoint90CW(c.toPoint),
  }));
  return { ...data, cardWidth: cardH, cardHeight: cardW, elements, connections };
};

// Resize the canvas to newW/newH while keeping every layer at its fixed pixel
// position, so shrinking crops the edges and growing adds canvas space.
// Layers are stored in pixel coordinates, so resizing the canvas keeps every
// layer at its fixed pixel position — shrinking crops the edges, growing adds space.
const cropCanvas = (data, newW, newH) => ({ ...data, cardWidth: newW, cardHeight: newH });

export default function FormatMenu({ data, onChange, exportColorCopy, cropZoom = 1, onCropZoomChange }) {
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSize, setCropSize] = useState({ w: 360, h: 504 });

  const isFullPage = (data?.cardHeight || 550) >= 1100;

  useEffect(() => {
    if (cropOpen) {
      setCropSize({ w: Math.round(data?.cardWidth || 360), h: Math.round(data?.cardHeight || 504) });
      onCropZoomChange?.(1);
    } else {
      onCropZoomChange?.(1);
    }
  }, [cropOpen]);

  const toggleFullPage = () => {
    onChange({ ...data, cardHeight: isFullPage ? 550 : 1100 });
  };

  const handleRotate = () => {
    onChange(rotateCanvas90CW(data));
  };

  const applyCrop = () => {
    const newW = Math.max(50, Math.round(cropSize.w));
    const newH = Math.max(50, Math.round(cropSize.h));
    onChange(cropCanvas(data, newW, newH));
    setCropOpen(false);
    onCropZoomChange?.(1);
  };

  const triggerBase = exportColorCopy
    ? 'border-border text-muted-foreground hover:bg-muted/30'
    : 'border-background/30 text-background hover:bg-background/10';

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${triggerBase} ${isFullPage ? 'bg-primary text-primary-foreground border-primary' : ''}`}
            title="Format options"
          >
            <Maximize size={14} />
            Format
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-44 p-1.5" data-no-deselect>
          <button
            onClick={toggleFullPage}
            className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted/50 ${isFullPage ? 'text-primary' : ''}`}
          >
            <Maximize size={14} /> Full page
          </button>
          <button
            onClick={handleRotate}
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted/50"
          >
            <RotateCw size={14} /> Rotate 90°
          </button>
          <button
            onClick={() => setCropOpen(true)}
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted/50"
          >
            <Crop size={14} /> Crop…
          </button>
        </PopoverContent>
      </Popover>

      <Dialog open={cropOpen} onOpenChange={setCropOpen}>
        <DialogContent className="max-w-sm" data-no-deselect>
          <DialogHeader>
            <DialogTitle>Crop canvas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-[11px] text-muted-foreground">
              Resize the canvas in pixels. Layers stay at their fixed pixel positions, so a smaller size crops the edges.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Width (px)</Label>
                <Input
                  type="number" min="50"
                  value={cropSize.w}
                  onChange={(e) => setCropSize(s => ({ ...s, w: parseInt(e.target.value) || 0 }))}
                  className="bg-muted/30 border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Height (px)</Label>
                <Input
                  type="number" min="50"
                  value={cropSize.h}
                  onChange={(e) => setCropSize(s => ({ ...s, h: parseInt(e.target.value) || 0 }))}
                  className="bg-muted/30 border-border"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Zoom: {cropZoom.toFixed(1)}×</Label>
              <input
                type="range" min="1" max="3" step="0.1" value={cropZoom}
                onChange={(e) => onCropZoomChange?.(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-[11px] text-muted-foreground">Enlarge the preview while you crop.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCropOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={applyCrop}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}