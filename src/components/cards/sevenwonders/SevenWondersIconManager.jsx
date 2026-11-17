import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import DrawButton from '@/components/DrawButton';
import SevenWondersColorManager from './SevenWondersColorManager';

function IconSection({ label, entity }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const load = async () => { try { setItems(await base44.entities[entity].list()); } catch {} };
  useEffect(() => { load(); }, [entity]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities[entity].create({ name: file.name.replace(/\.[^.]+$/, ''), url: file_url });
      }
      await load();
      toast({ title: `${label} uploaded` });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDraw = async (url) => {
    try {
      await base44.entities[entity].create({ name: 'drawing', url });
      await load();
      toast({ title: 'Drawing added' });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities[entity].delete(id);
      setItems(items.filter(i => i.id !== id));
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading}>
          <Upload size={14} className="mr-2" /> {loading ? 'Uploading...' : 'Upload'}
        </Button>
        <DrawButton label="Draw" canvasSize={512} onSave={handleDraw} />
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">No {label.toLowerCase()} yet — upload or draw some.</p>
      ) : (
        <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
          {items.map(icon => (
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
  );
}

const TABS = [
  { key: 'cost', label: 'Cost Icons' },
  { key: 'ability', label: 'Ability Icons' },
  { key: 'colors', label: 'Colors' },
];

export default function SevenWondersIconManager({ open, onOpenChange }) {
  const [tab, setTab] = useState('cost');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage 7 Wonders Icons</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 border-b border-border mb-3">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {tab === 'cost' && <IconSection label="Cost Icons" entity="SevenWondersCostIcon" />}
          {tab === 'ability' && <IconSection label="Ability Icons" entity="SevenWondersAbilityIcon" />}
          {tab === 'colors' && <SevenWondersColorManager />}
        </div>
      </DialogContent>
    </Dialog>
  );
}