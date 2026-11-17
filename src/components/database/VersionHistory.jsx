import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RotateCcw, Trash2, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function VersionHistory({ card, onChanged }) {
  const { toast } = useToast();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const pngRef = useRef(null);
  const csRef = useRef(null);
  const [pendingPng, setPendingPng] = useState(null);
  const [pendingCs, setPendingCs] = useState(null);

  const isFreeCanvas = card?.template === 'free_canvas';

  const load = async () => {
    const list = await base44.entities.CardVersion.filter({ card_id: card.id }, '-version_number', 100);
    setVersions(list || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [card.id]);

  const revert = async (v) => {
    const curVersions = await base44.entities.CardVersion.filter({ card_id: card.id });
    const nextVersion = (curVersions || []).reduce((m, x) => Math.max(m, x.version_number || 0), 0) + 1;
    await base44.entities.CardVersion.create({
      card_id: card.id,
      version_number: nextVersion,
      png_url: card.png_url,
      cs_url: card.cs_url,
    });
    await base44.entities.DatabaseCard.update(card.id, { png_url: v.png_url, cs_url: v.cs_url });
    await base44.entities.CardVersion.delete(v.id);
    toast({ title: 'Reverted', description: `Restored version ${v.version_number}.` });
    onChanged?.();
    load();
  };

  const remove = async (v) => {
    await base44.entities.CardVersion.delete(v.id);
    toast({ title: 'Version deleted' });
    load();
  };

  const onPickPng = (e) => {
    const f = e.target.files?.[0];
    if (f) setPendingPng(f);
    e.target.value = '';
  };
  const onPickCs = (e) => {
    const f = e.target.files?.[0];
    if (f) setPendingCs(f);
    e.target.value = '';
  };

  const uploadVersion = async () => {
    if (!pendingPng || !pendingCs) {
      toast({ title: 'Both files required', description: 'Upload a PNG and a CS file.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const [{ file_url: png_url }, { file_url: cs_url }] = await Promise.all([
        base44.integrations.Core.UploadFile({ file: pendingPng }),
        base44.integrations.Core.UploadFile({ file: pendingCs }),
      ]);
      const curVersions = await base44.entities.CardVersion.filter({ card_id: card.id });
      const nextVersion = (curVersions || []).reduce((m, x) => Math.max(m, x.version_number || 0), 0) + 1;
      await base44.entities.CardVersion.create({ card_id: card.id, version_number: nextVersion, png_url, cs_url });
      toast({ title: 'Version uploaded' });
      setPendingPng(null);
      setPendingCs(null);
      load();
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Current</p>
        {isFreeCanvas ? (
          <Button variant="outline" size="sm" onClick={uploadVersion} disabled={busy || !pendingPng || !pendingCs}>
            <Upload size={12} className="mr-1" /> {busy ? 'Uploading…' : 'Upload version'}
          </Button>
        ) : null}
      </div>

      {isFreeCanvas && (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2.5">
          <p className="text-[11px] text-muted-foreground">Upload a PNG and a CS file to add a history version.</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">PNG</Label>
              <Button variant="outline" size="sm" onClick={() => pngRef.current?.click()} className="w-full justify-start truncate">
                <Upload size={12} className="mr-1" /> {pendingPng ? pendingPng.name : 'Choose PNG'}
              </Button>
              <input ref={pngRef} type="file" accept="image/png,image/*" className="hidden" onChange={onPickPng} />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">CS</Label>
              <Button variant="outline" size="sm" onClick={() => csRef.current?.click()} className="w-full justify-start truncate">
                <Upload size={12} className="mr-1" /> {pendingCs ? pendingCs.name : 'Choose CS'}
              </Button>
              <input ref={csRef} type="file" accept=".cs,application/json" className="hidden" onChange={onPickCs} />
            </div>
          </div>
        </div>
      )}
      {!isFreeCanvas && (
        <p className="text-[11px] text-muted-foreground">History uploads are only available for Free Canvas cards.</p>
      )}

      <div className="flex items-center gap-3 rounded-md border border-primary/40 bg-primary/5 p-2">
        <img src={card.png_url} alt="current" className="w-12 h-16 object-contain rounded border border-border" />
        <div className="text-sm">
          <p className="font-medium">{card.name}</p>
          <p className="text-xs text-muted-foreground">Live version · {new Date(card.updated_date || card.created_date).toLocaleString()}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground uppercase tracking-wider pt-2">History</p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : versions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No previous versions.</p>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-md border border-border p-2">
              <img src={v.png_url} alt={`v${v.version_number}`} className="w-12 h-16 object-contain rounded border border-border" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Version {v.version_number}</p>
                <p className="text-xs text-muted-foreground truncate">{new Date(v.created_date).toLocaleString()}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => revert(v)} title="Revert to this version">
                <RotateCcw size={12} className="mr-1" /> Revert
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(v)} title="Delete version">
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}