import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getTagsForTab, getTabsFromTags, createTag, saveUploadedCard } from '@/lib/databaseApi';

export default function UploadCardDialog({ open, onOpenChange, onSaved }) {
  const { toast } = useToast();
  const [pngFile, setPngFile] = useState(null);
  const [csFile, setCsFile] = useState(null);
  const [name, setName] = useState('');
  const [tab, setTab] = useState('General');
  const [tabs, setTabs] = useState([]);
  const [tabTags, setTabTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [cost, setCost] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    getTabsFromTags().then(setTabs).catch(() => setTabs([]));
  }, [open]);

  useEffect(() => {
    if (!open || !tab) return;
    getTagsForTab(tab).then(setTabTags).catch(() => setTabTags([]));
    setSelectedTags([]);
  }, [open, tab]);

  const reset = () => {
    setPngFile(null); setCsFile(null); setName(''); setTab('General');
    setSelectedTags([]); setNewTag(''); setCost(0); setTabTags([]);
  };

  const onPngChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPngFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
  };

  const toggleTag = (t) => {
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const addNewTag = async () => {
    const t = (newTag || '').trim();
    if (!t) return;
    try {
      await createTag(t, tab);
      getTagsForTab(tab).then(setTabTags).catch(() => setTabTags([]));
      setSelectedTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
      setNewTag('');
    } catch (err) {
      toast({ title: 'Tag failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    const trimmed = (name || '').trim();
    if (!trimmed) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    if (!pngFile) { toast({ title: 'PNG required', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      await saveUploadedCard({ name: trimmed, tab, tags: selectedTags, cost, pngFile, csFile });
      toast({ title: 'Card uploaded' });
      reset();
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload Card</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">PNG image *</Label>
            <input type="file" accept="image/png,image/*" onChange={onPngChange} className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary file:text-primary-foreground" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CS project file (optional)</Label>
            <input type="file" onChange={(e) => setCsFile(e.target.files?.[0] || null)} className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-muted file:text-foreground" />
            {!csFile && <p className="text-[10px] text-muted-foreground">Without a CS file, this card won't be editable in Card Smith.</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Card name" className="bg-muted/30 border-border h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tab</Label>
              <Input list="upload-tab-list" value={tab} onChange={(e) => setTab(e.target.value)} placeholder="Tab" className="bg-muted/30 border-border h-9" />
              <datalist id="upload-tab-list">{tabs.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cost</Label>
              <Input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className="bg-muted/30 border-border h-9" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tabTags.map((t) => {
                const on = selectedTags.includes(t.name);
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => toggleTag(t.name)}
                    className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground border-border'}`}
                  >
                    {t.name}
                  </button>
                );
              })}
              {tabTags.length === 0 && <p className="text-[10px] text-muted-foreground">No tags in this tab yet.</p>}
            </div>
            <div className="flex gap-1.5">
              <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewTag(); } }} placeholder="New tag" className="bg-muted/30 border-border h-8 text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={addNewTag}><Plus size={12} /></Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={busy || !pngFile || !name.trim()}>
            {busy ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}