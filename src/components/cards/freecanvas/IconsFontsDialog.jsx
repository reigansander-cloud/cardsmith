import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import DrawButton from '@/components/DrawButton';
import { useUploadedIcons } from '@/hooks/useUploadedIcons';
import { addUploadedIcon, removeUploadedIcon } from '@/lib/uploadedIconsStore';
import { useSavedColors } from '@/hooks/useFreeCanvasAssets';
import { addColor, removeColor } from '@/lib/freeCanvasAssetsStore';
import FontManagerPanel from '@/components/FontManagerPanel';

export default function IconsFontsDialog({ open, onOpenChange }) {
  const { toast } = useToast();
  const icons = useUploadedIcons();
  const colors = useSavedColors();
  const [loading, setLoading] = useState(false);
  const [newColor, setNewColor] = useState('#ff0000');

  const handleAddColor = () => {
    addColor(newColor);
    toast({ title: 'Color saved' });
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        addUploadedIcon({ name: file.name.replace(/\.[^.]+$/, ''), url: file_url });
      }
      toast({ title: 'Icons uploaded' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleDraw = (url) => {
    addUploadedIcon({ name: 'drawing', url });
    toast({ title: 'Drawing added' });
  };

  const handleDelete = (id) => {
    removeUploadedIcon(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-4xl" data-no-deselect>
        <DialogHeader>
          <DialogTitle>Icons &amp; Fonts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Icons</h3>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => document.getElementById('icons-fonts-upload').click()} disabled={loading}>
                <Upload size={14} className="mr-2" /> {loading ? 'Uploading...' : 'Upload Icons'}
              </Button>
              <DrawButton label="Draw" canvasSize={512} onSave={handleDraw} />
              <input id="icons-fonts-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
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
            <p className="text-[11px] text-muted-foreground">Icons added here appear in the collected Icons folder, text icon picker, and cost bars.</p>
          </div>
          <div className="space-y-3 md:border-l md:border-border md:pl-6">
            <h3 className="text-sm font-semibold">Colors</h3>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-9 h-9 rounded cursor-pointer bg-transparent border border-border p-0.5"
              />
              <Button variant="outline" size="sm" onClick={handleAddColor}>
                <Plus size={14} className="mr-2" /> Save color
              </Button>
            </div>
            {colors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No colors saved yet.</p>
            ) : (
              <div className="grid grid-cols-8 gap-2 max-h-[400px] overflow-y-auto">
                {colors.map((c) => (
                  <div key={c} className="relative group">
                    <div className="aspect-square border border-border rounded-lg" style={{ backgroundColor: c }} title={c} />
                    <button
                      onClick={() => removeColor(c)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove color"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Saved colors appear in every color picker across all elements and canvas tabs.</p>
          </div>
          <div className="space-y-3 md:border-l md:border-border md:pl-6">
            <h3 className="text-sm font-semibold">Fonts</h3>
            <FontManagerPanel />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}