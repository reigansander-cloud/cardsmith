import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCustomFonts, addCustomFont, removeCustomFont } from '@/lib/customFonts';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

export default function FontManagerPanel() {
  const { fonts, refresh } = useCustomFonts();
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const { toast } = useToast();

  const handleAdd = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: 'Name required', description: 'Enter a font name before uploading.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const created = await base44.entities.Font.create({ name: trimmed, url: file_url });
      addCustomFont(created);
      setName('');
      toast({ title: 'Font added', description: `${trimmed} is now available site-wide.` });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (font) => {
    try {
      await base44.entities.Font.delete(font.id);
      removeCustomFont(font.id);
      toast({ title: 'Font removed', description: `${font.name} deleted.` });
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-medium">Add a new font</Label>
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Font name"
            className="bg-muted/30 border-border h-9"
          />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="whitespace-nowrap">
            <Upload size={14} className="mr-2" /> {uploading ? 'Uploading...' : 'Upload'}
          </Button>
          <input ref={fileRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleAdd} />
        </div>
        <p className="text-[11px] text-muted-foreground">Upload a font file (TTF/OTF/WOFF). Added fonts are saved permanently to the site.</p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium">Added fonts</Label>
        {fonts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No custom fonts yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {fonts.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-2 p-2 rounded-md border border-border">
                <span className="text-sm truncate" style={{ fontFamily: `"${f.name}", sans-serif` }}>{f.name}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive h-7 px-2">
                      <Trash2 size={12} className="mr-1" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{f.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>This removes the font from the site. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(f)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}