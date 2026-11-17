import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Plus, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// onCreate({ name, color, icon })
export default function TagCreateForm({ onCreate }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6b7280');
  const [icon, setIcon] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setIcon(file_url);
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({ name: trimmed, color, icon });
    setName('');
    setIcon('');
    setColor('#6b7280');
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
      <div className="flex items-center gap-1.5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag name"
          className="bg-muted/30 border-border h-8 text-xs flex-1"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        />
        <Button size="sm" onClick={submit} disabled={!name.trim()} className="h-8 px-2">
          <Plus size={14} className="mr-1" /> Add
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer bg-transparent border border-border p-0.5"
          title="Tag color"
        />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="h-8">
          <Upload size={12} className="mr-1.5" /> {uploading ? 'Uploading…' : 'Icon'}
        </Button>
        {icon && (
          <div className="flex items-center gap-1">
            <img src={icon} alt="" className="w-6 h-6 rounded object-cover" />
            <button type="button" onClick={() => setIcon('')} className="text-muted-foreground hover:text-destructive" title="Remove icon">
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}