import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function SevenWondersColorManager() {
  const { toast } = useToast();
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState('#8D674E');
  const [baseFile, setBaseFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const baseInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const load = async () => {
    try { setColors(await base44.entities.SevenWondersColor.list()); } catch {}
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!name.trim() || !baseFile || !bannerFile) {
      toast({ title: 'Name, base image, and cost banner are all required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { file_url: baseImageUrl } = await base44.integrations.Core.UploadFile({ file: baseFile });
      const { file_url: bannerImageUrl } = await base44.integrations.Core.UploadFile({ file: bannerFile });
      await base44.entities.SevenWondersColor.create({ name: name.trim(), color: colorHex, baseImageUrl, bannerImageUrl });
      setName('');
      setColorHex('#8D674E');
      setBaseFile(null);
      setBannerFile(null);
      if (baseInputRef.current) baseInputRef.current.value = '';
      if (bannerInputRef.current) bannerInputRef.current.value = '';
      await load();
      toast({ title: 'Color added' });
    } catch (err) {
      toast({ title: 'Failed to add color', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.SevenWondersColor.delete(id);
      setColors(colors.filter(c => c.id !== id));
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Card Colors</h4>
      <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
        <Input placeholder="Color name (e.g. Green)" value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Swatch</Label>
          <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => baseInputRef.current?.click()}>
            <Upload size={14} className="mr-1" /> {baseFile ? baseFile.name : 'Base image'}
          </Button>
          <input ref={baseInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setBaseFile(e.target.files?.[0] || null)} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => bannerInputRef.current?.click()}>
            <Upload size={14} className="mr-1" /> {bannerFile ? bannerFile.name : 'Cost banner'}
          </Button>
          <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
        </div>
        <Button size="sm" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Add color'}
        </Button>
      </div>
      {colors.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">No card colors yet.</p>
      ) : (
        <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
          {colors.map(c => (
            <div key={c.id} className="relative group flex flex-col items-center">
              <div className="w-full aspect-square border border-border rounded-lg" style={{ background: c.color }} />
              <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">{c.name}</span>
              <button
                onClick={() => handleDelete(c.id)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}