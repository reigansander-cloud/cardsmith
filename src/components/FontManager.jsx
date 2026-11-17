import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import FontManagerPanel from '@/components/FontManagerPanel';

export default function FontManager({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-no-deselect>
        <DialogHeader>
          <DialogTitle>Font manager</DialogTitle>
        </DialogHeader>
        <FontManagerPanel />
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}