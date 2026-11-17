import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import DrawButton from '@/components/DrawButton';

export default function IconManager({ open, onOpenChange, entityName = 'UploadedIcon' }) {
  const { toast } = useToast();
  const [icons, setIcons] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadIcons = async () => {
    try {
      const list = await base44.entities[entityName].list();
      setIcons(list);
    } catch (e) {}
  };

  useEffect(() => {
    if (open) loadIcons();
  }, [open]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities[entityName].create({
          name: file.name.replace(/\.[^.]+$/, ''),
          url: file_url
        });
      }
      await loadIcons();
      toast({ title: 'Icons uploaded' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleDraw = async (url) => {
    try {
      await base44.entities[entityName].create({ name: 'drawing', url });
      await loadIcons();
      toast({ title: 'Drawing added' });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities[entityName].delete(id);
      setIcons(icons.filter(i => i.id !== id));
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Icons</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => document.getElementById('icon-manager-upload').click()} disabled={loading}>
              <Upload size={14} className="mr-2" /> {loading ? 'Uploading...' : 'Upload Icons'}
            </Button>
            <DrawButton label="Draw" canvasSize={512} onSave={handleDraw} />
            <input id="icon-manager-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          </div>
          {icons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No icons uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-6 gap-3 max-h-[400px] overflow-y-auto">
              {icons.map(icon => (
                <div key={icon.id} className="relative group">
                  <div className="aspect-square border border-border rounded-lg bg-muted/20 flex items-center justify-center p-2">
                    <img src={icon.url} alt={icon.name} className="w-full h-full object-contain" />
                  </div>
                  <button
                    onClick={() => handleDelete(icon.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}