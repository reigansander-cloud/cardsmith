import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Square } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const BORDER_PX = Math.round(0.125 * 300); // 1/8" at 300 DPI

function loadImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

export default function BorderTool({ className, iconSize = 14 }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [processing, setProcessing] = useState(false);

  const handleButtonClick = () => fileInputRef.current?.click();

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    setProcessing(true);
    try {
      let count = 0;
      for (const file of files) {
        const img = await loadImage(file);
        if (!img) continue;

        const canvas = document.createElement('canvas');
        canvas.width = img.width + 2 * BORDER_PX;
        canvas.height = img.height + 2 * BORDER_PX;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, BORDER_PX, BORDER_PX);

        const baseName = file.name.replace(/\.[^.]+$/, '');
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${baseName}_bordered.png`;
        a.click();

        count++;
        await new Promise(r => setTimeout(r, 250));
      }
      toast({ title: 'Done', description: `${count} image(s) downloaded with 1/8" border.` });
    } catch (error) {
      toast({ title: 'Border failed', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleButtonClick} disabled={processing} className={className}>
        <Square size={iconSize} className="mr-2" /> {processing ? 'Adding...' : 'Add Border'}
      </Button>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
    </>
  );
}