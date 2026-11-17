import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// Manages a folder's list of unused card names. Names added here become
// available to assign to entries via the "N" button on each entry card.
export default function FolderNamesDialog({ open, onOpenChange, folderId, names, onNamesChange }) {
  const [newName, setNewName] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (!open) { setNewName(''); setBulkText(''); } }, [open]);

  const addOne = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await base44.entities.FolderName.create({ folder_id: folderId, name });
      setNewName('');
      onNamesChange();
    } catch (err) {
      toast({ title: 'Add failed', description: err.message, variant: 'destructive' });
    } finally { setAdding(false); }
  };

  const addBulk = async () => {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setAdding(true);
    try {
      await base44.entities.FolderName.bulkCreate(lines.map((name) => ({ folder_id: folderId, name })));
      setBulkText('');
      onNamesChange();
    } catch (err) {
      toast({ title: 'Add failed', description: err.message, variant: 'destructive' });
    } finally { setAdding(false); }
  };

  const remove = async (id) => {
    try { await base44.entities.FolderName.delete(id); onNamesChange(); } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Unused Names</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter a name"
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOne(); } }}
            />
            <Button size="sm" className="h-8" onClick={addOne} disabled={adding || !newName.trim()}>
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>
          <div className="rounded-md border border-border p-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Bulk add (one per line)</div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'Name one\nName two\nName three'}
              className="w-full h-24 text-xs rounded-md border border-border bg-background px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex justify-end mt-1.5">
              <Button size="sm" variant="outline" className="h-7" onClick={addBulk} disabled={adding || !bulkText.trim()}>
                <Plus size={12} className="mr-1" /> Add all
              </Button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {names.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">No unused names yet.</p>
            ) : (
              names.map((n) => (
                <div key={n.id} className="flex items-center gap-2 text-sm group rounded px-1 py-0.5 hover:bg-muted/40">
                  <span className="flex-1 text-foreground truncate">{n.name}</span>
                  <button onClick={() => remove(n.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}