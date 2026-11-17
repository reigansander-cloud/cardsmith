import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Undo2, Eraser, Pencil, Shapes, Square, Circle, Triangle, Minus, Grid } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SHAPE_TOOLS = ['rect', 'ellipse', 'triangle', 'line'];

export default function DrawDialog({ open, onOpenChange, onSave, canvasSize = 720, title = 'Draw' }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const currentRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(10);
  const [tool, setTool] = useState('brush');
  const [pixelArt, setPixelArt] = useState(false);
  const [pixelSize, setPixelSize] = useState(16);
  const [showShapes, setShowShapes] = useState(false);
  const [fill, setFill] = useState(false);
  const [tick, setTick] = useState(0);
  const [saving, setSaving] = useState(false);

  const drawStroke = (ctx, s) => {
    if (!s) return;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = s.size;
    ctx.strokeStyle = s.color || '#000000';
    ctx.fillStyle = s.color || '#000000';
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';

    if (s.shape) {
      const { x: sx, y: sy } = s.start;
      const { x: ex, y: ey } = s.end;
      if (s.shape === 'rect') {
        const x = Math.min(sx, ex), y = Math.min(sy, ey), w = Math.abs(ex - sx), h = Math.abs(ey - sy);
        if (s.fill) ctx.fillRect(x, y, w, h); else ctx.strokeRect(x, y, w, h);
      } else if (s.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse((sx + ex) / 2, (sy + ey) / 2, Math.abs(ex - sx) / 2, Math.abs(ey - sy) / 2, 0, 0, Math.PI * 2);
        if (s.fill) ctx.fill(); else ctx.stroke();
      } else if (s.shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo((sx + ex) / 2, Math.min(sy, ey));
        ctx.lineTo(Math.max(sx, ex), Math.max(sy, ey));
        ctx.lineTo(Math.min(sx, ex), Math.max(sy, ey));
        ctx.closePath();
        if (s.fill) ctx.fill(); else ctx.stroke();
      } else if (s.shape === 'line') {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      return;
    }

    if (!s.points || s.points.length === 0) return;
    if (s.pixelArt) {
      const cellSize = canvasSize / s.pixelSize;
      ctx.fillStyle = s.color || '#000000';
      const drawCell = (cx, cy) => ctx.fillRect(cx, cy, cellSize, cellSize);
      for (let i = 0; i < s.points.length; i++) {
        const p = s.points[i];
        if (i === 0) { drawCell(p.x, p.y); continue; }
        const prev = s.points[i - 1];
        let x0 = prev.x, y0 = prev.y, x1 = p.x, y1 = p.y;
        const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? cellSize : -cellSize, sy = y0 < y1 ? cellSize : -cellSize;
        let err = dx - dy;
        while (true) {
          drawCell(x0, y0);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; x0 += sx; }
          if (e2 < dx) { err += dx; y0 += sy; }
        }
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    }
  };

  const redraw = () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    strokesRef.current.forEach(s => drawStroke(ctx, s));
    if (currentRef.current) drawStroke(ctx, currentRef.current);
    ctx.globalCompositeOperation = 'source-over';
  };

  useEffect(() => {
    if (open) { strokesRef.current = []; currentRef.current = null; setTick(t => t + 1); }
  }, [open]);

  useEffect(() => { redraw(); }, [tick, open]);

  const pos = (e) => {
    const cvs = canvasRef.current;
    const rect = cvs.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width * canvasSize;
    let y = (e.clientY - rect.top) / rect.height * canvasSize;
    if (pixelArt) {
      const cellSize = canvasSize / pixelSize;
      x = Math.round(x / cellSize) * cellSize;
      y = Math.round(y / cellSize) * cellSize;
    }
    return { x, y };
  };

  const onDown = (e) => {
    e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    if (SHAPE_TOOLS.includes(tool)) {
      currentRef.current = { color, size, shape: tool, fill, start: p, end: p };
    } else {
      currentRef.current = { color, size, erase: tool === 'eraser', points: [p], pixelArt, pixelSize };
    }
    redraw();
  };
  const onMove = (e) => {
    if (!currentRef.current) return;
    const p = pos(e);
    if (currentRef.current.shape) currentRef.current.end = p;
    else currentRef.current.points.push(p);
    redraw();
  };
  const onUp = () => {
    if (!currentRef.current) return;
    strokesRef.current.push(currentRef.current);
    currentRef.current = null;
    setTick(t => t + 1);
  };

  const undo = () => { strokesRef.current.pop(); setTick(t => t + 1); };
  const clear = () => { strokesRef.current = []; setTick(t => t + 1); };

  const save = async () => {
    const out = document.createElement('canvas');
    out.width = canvasSize;
    out.height = canvasSize;
    const ctx = out.getContext('2d');
    strokesRef.current.forEach(s => drawStroke(ctx, s));
    ctx.globalCompositeOperation = 'source-over';
    const blob = await new Promise(res => out.toBlob(res, 'image/png'));
    if (!blob) return;
    setSaving(true);
    try {
      const file = new File([blob], 'drawing.png', { type: 'image/png' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onSave && onSave(file_url);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant={tool === 'brush' ? 'default' : 'outline'} size="sm" onClick={() => setTool('brush')} className="h-8 w-8 p-0" title="Brush"><Pencil size={14} /></Button>
            <Button variant={tool === 'eraser' ? 'default' : 'outline'} size="sm" onClick={() => setTool('eraser')} className="h-8 w-8 p-0" title="Eraser"><Eraser size={14} /></Button>
            <Button variant={pixelArt ? 'default' : 'outline'} size="sm" onClick={() => setPixelArt(!pixelArt)} className="h-8" title="Pixel art mode"><Grid size={14} className="mr-1" />Pixel</Button>
            {pixelArt && (
              <select value={pixelSize} onChange={(e) => setPixelSize(parseInt(e.target.value))} className="h-8 rounded-md border border-border bg-muted/30 px-2 text-xs" title="Pixel grid size">
                {[8, 12, 16, 24, 32, 48, 64].map(n => <option key={n} value={n}>{n}×{n}</option>)}
              </select>
            )}
            <Button variant={showShapes ? 'default' : 'outline'} size="sm" onClick={() => setShowShapes(!showShapes)} className="h-8" title="Shapes"><Shapes size={14} className="mr-1" />Shapes</Button>
            {showShapes && (
              <>
                <Button variant={tool === 'rect' ? 'default' : 'outline'} size="sm" onClick={() => setTool('rect')} className="h-8 w-8 p-0" title="Rectangle"><Square size={14} /></Button>
                <Button variant={tool === 'ellipse' ? 'default' : 'outline'} size="sm" onClick={() => setTool('ellipse')} className="h-8 w-8 p-0" title="Ellipse"><Circle size={14} /></Button>
                <Button variant={tool === 'triangle' ? 'default' : 'outline'} size="sm" onClick={() => setTool('triangle')} className="h-8 w-8 p-0" title="Triangle"><Triangle size={14} /></Button>
                <Button variant={tool === 'line' ? 'default' : 'outline'} size="sm" onClick={() => setTool('line')} className="h-8 w-8 p-0" title="Line"><Minus size={14} /></Button>
                <Button variant={fill ? 'default' : 'outline'} size="sm" onClick={() => setFill(!fill)} className="h-8 px-2 text-xs" title="Fill shapes">{fill ? 'Filled' : 'Outline'}</Button>
              </>
            )}
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border border-border p-0.5" title="Color" />
            <Label className="text-xs">Size</Label>
            <Input type="number" min="1" max="80" value={size} onChange={e => setSize(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 h-8" />
            <Button variant="outline" size="sm" onClick={undo} className="h-8" title="Undo"><Undo2 size={14} /></Button>
            <Button variant="outline" size="sm" onClick={clear} className="h-8" title="Clear"><Trash2 size={14} /></Button>
          </div>
          <div
            className="rounded-md border border-border overflow-hidden relative"
            style={{
              width: 380, height: 380,
              backgroundImage: 'linear-gradient(45deg,#9ca3af 25%,transparent 25%),linear-gradient(-45deg,#9ca3af 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#9ca3af 75%),linear-gradient(-45deg,transparent 75%,#9ca3af 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
              backgroundColor: '#d1d5db',
            }}
          >
            {pixelArt && (
              <div className="absolute inset-0 pointer-events-none z-10" style={{
                backgroundImage: 'linear-gradient(to right, #00000020 1px, transparent 1px), linear-gradient(to bottom, #00000020 1px, transparent 1px)',
                backgroundSize: `${380 / pixelSize}px ${380 / pixelSize}px`,
              }} />
            )}
            <canvas
              ref={canvasRef}
              width={canvasSize}
              height={canvasSize}
              style={{ width: 380, height: 380, touchAction: 'none', cursor: 'crosshair' }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Use Drawing'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}