import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Confirmation dialog for deleting a folder. The user must type the folder's
// exact name before the destructive button enables.
export default function ConfirmDeleteFolder({ open, onOpenChange, folderName, onConfirm }) {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (open) setTyped(''); }, [open]);
  const match = typed.trim() === (folderName || '').trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete folder</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently deletes the folder and all of its entries. Type the folder name to confirm:
        </p>
        <p className="text-sm font-semibold text-foreground">{folderName}</p>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Folder name" autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!match} onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}