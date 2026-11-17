import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Shapes } from 'lucide-react';
import DicePipDialog from './DicePipDialog';

const ICONS = [
  { name: 'Bleeding Eye', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/20c7064bbc_0ab04b331_bleeding-eye.png' },
  { name: 'Dice', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/f9d24c3e58_ea2683ee8_perspective-dice-six-faces-three.png' },
  { name: 'Throne', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/ea2eb884d5_6fa45cef7_stone-throne1.png' },
  { name: 'Scales', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/e2d4c9f352_160ec7491_scales.png' },
  { name: 'Direction', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/41e885df14_88e2c1004_direction-signs1.png' },
  { name: 'Chalice', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/da3d632228_e1d4c9981_pouring-chalice.png' },
  { name: 'Ace', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/42a1a5af50_67cbc5708_ace.png' },
  { name: 'Arrow Dunk', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/b3e9d54f28_573d12d06_arrow-dunk.png', small: true },
  { name: 'Cycle', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/e4de782998_d25bac5c5_cycle.png', small: true },
  { name: 'Stone Throne', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/81d40b0c0f_237790979_stone-throne1.png', small: true },
  { name: 'Upgrade', url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/0457c5047b_c5f4b3634_upgrade.png', small: true },
];

const genId = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const loadAspectRatio = (url) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img.width / img.height);
  img.onerror = () => resolve(1);
  img.src = url;
});

export default function HalfPaperToolbar({ data, onChange }) {
  const cardW = data?.cardWidth || 850;
  const cardH = data?.cardHeight || 550;
  const elements = data?.elements || [];
  const [diceDialogOpen, setDiceDialogOpen] = useState(false);

  const insertAt = (newEl) => {
    onChange({ ...data, elements: [newEl, ...elements] });
  };

  const inchW = (inches) => (inches * 100 / cardW) * 100;
  const inchH = (inches) => (inches * 100 / cardH) * 100;

  const addRect = () => {
    insertAt({
      id: genId(), type: 'shape', x: 30, y: 30,
      width: inchW(3.675), height: inchH(2.625),
      shape: 'rectangle', filled: false, strokeWidth: 6, color: '#000000',
    });
  };

  const addCoin = () => {
    insertAt({
      id: genId(), type: 'shape', x: 30, y: 30,
      width: inchW(0.81), height: inchH(0.81),
      shape: 'ellipse', filled: false, strokeWidth: 6, color: '#000000',
    });
  };

  const addSquare = () => {
    insertAt({
      id: genId(), type: 'shape', x: 30, y: 30,
      width: inchW(1.21), height: inchH(1.21),
      shape: 'rectangle', filled: false, strokeWidth: 6, color: '#000000',
    });
  };

  const addDice = (pips) => {
    insertAt({
      id: genId(), type: 'shape', x: 30, y: 30,
      width: inchW(0.5), height: inchH(0.5),
      shape: 'rounded', filled: false, strokeWidth: 6, color: '#000000',
      ...(pips ? { pips } : {}),
    });
  };

  const addIcon = async (url, name, small) => {
    const aspectRatio = await loadAspectRatio(url);
    insertAt({
      id: genId(), type: 'image', name,
      x: 30, y: 30, width: small ? 5 : 10, aspectRatio, url,
    });
  };

  const isFullPaper = cardH >= 1100;

  const toggleFullPaper = () => {
    onChange({ ...data, cardHeight: isFullPaper ? 550 : 1100 });
  };

  return (
    <div className="w-16 flex-shrink-0" data-no-deselect>
      <div className="sticky top-20 flex flex-col gap-2">
        <Button
          variant={isFullPaper ? 'default' : 'outline'}
          size="sm"
          onClick={toggleFullPaper}
          className="h-16 w-full flex flex-col gap-1 items-center justify-center text-[10px] leading-tight"
          title="Toggle full paper (double height)"
        >
          <div className="w-5 h-7 border-2 border-current rounded-sm" />
          Full
        </Button>
        <Button variant="outline" size="sm" onClick={addRect} className="h-16 w-full flex flex-col gap-1 items-center justify-center text-[10px] leading-tight" title="3.5×2.5 inch card">
          <div className="w-7 h-5 border-2 border-current rounded-sm" />
          3.5×2.5
        </Button>
        <Button variant="outline" size="sm" onClick={addCoin} className="h-16 w-full flex flex-col gap-1 items-center justify-center text-[10px] leading-tight" title="Circle">
          <div className="w-5 h-5 border-2 border-current rounded-full" />
          Circle
        </Button>
        <Button variant="outline" size="sm" onClick={addSquare} className="h-16 w-full flex flex-col gap-1 items-center justify-center text-[10px] leading-tight" title="Square">
          <div className="w-5 h-5 border-2 border-current rounded-sm" />
          Square
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDiceDialogOpen(true)} className="h-16 w-full flex flex-col gap-1 items-center justify-center text-[10px] leading-tight" title="Rounded square">
          <div className="w-4 h-4 border-2 border-current rounded-md" />
          Dice
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-16 w-full flex flex-col gap-1 items-center justify-center text-[10px] leading-tight">
              <Shapes size={16} />
              Icons
            </Button>
          </PopoverTrigger>
          <PopoverContent side="left" align="start" className="w-48 p-1.5" data-no-deselect>
            <div className="grid grid-cols-3 gap-1">
              {ICONS.map(icon => (
                <button
                  key={icon.url}
                  onClick={() => addIcon(icon.url, icon.name, icon.small)}
                  className="p-0.5 rounded hover:bg-muted/50 transition-colors flex items-center justify-center"
                  title={icon.name}
                >
                  <img src={icon.url} alt={icon.name} className={icon.small ? 'w-[8px] h-[8px] object-contain' : 'w-[15px] h-[15px] object-contain'} />
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <DicePipDialog
        open={diceDialogOpen}
        onOpenChange={setDiceDialogOpen}
        onSelect={(pips) => addDice(pips)}
      />
    </div>
  );
}