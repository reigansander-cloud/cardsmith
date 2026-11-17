import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import DrawDialog from './DrawDialog';

// A button that opens the drawing popup. On save, the uploaded drawing's
// file_url is passed to onSave — usable anywhere an upload button appears.
export default function DrawButton({ onSave, label = 'Draw', size = 'sm', variant = 'outline', canvasSize, title = 'Draw instead of uploading', iconOnly = false, className = '' }) {
  const [open, setOpen] = useState(false);

  if (iconOnly) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          title={title}
          className={`w-7 h-7 rounded border border-dashed border-border hover:border-primary flex items-center justify-center bg-background transition-colors ${className}`}
        >
          <Pencil size={12} className="text-muted-foreground" />
        </button>
        <DrawDialog open={open} onOpenChange={setOpen} onSave={onSave} canvasSize={canvasSize} />
      </>
    );
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} title={title} className={className}>
        <Pencil size={14} className="mr-2" /> {label}
      </Button>
      <DrawDialog open={open} onOpenChange={setOpen} onSave={onSave} canvasSize={canvasSize} />
    </>
  );
}