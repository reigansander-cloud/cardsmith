import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { subtypeText } from '@/lib/folderPreview';
import { useToast } from '@/components/ui/use-toast';

// Shows the 15 most recently deleted entries. Each can be restored to its
// original folder or permanently destroyed. Older deletions are purged.
export default function RecentlyDeleted() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [list, fl] = await Promise.all([
        base44.entities.DeletedEntry.list('-created_date', 15),
        base44.entities.Folder.list('-created_date', 200),
      ]);
      setItems(list || []);
      const m = {};
      (fl || []).forEach((f) => { m[f.id] = f.name; });
      setFolders(m);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const restore = async (item) => {
    try {
      await base44.entities.CardEntry.create({
        folder_id: item.folder_id, name: item.name, cost: item.cost, cost_icons: item.cost_icons,
        influence: item.influence, ability: item.ability, subtype: item.subtype, supertype: item.supertype,
        token_type: item.token_type, stats: item.stats, fabled: item.fabled, needs_review: item.needs_review,
        income_symbol: item.income_symbol, bonus_mode: item.bonus_mode, bonus_cost_icons: item.bonus_cost_icons, bonus_ability: item.bonus_ability,
      });
      await base44.entities.DeletedEntry.delete(item.id);
      toast({ description: `Restored "${item.name}"` });
      load();
    } catch (err) {
      toast({ title: 'Restore failed', description: err.message, variant: 'destructive' });
    }
  };

  const permanentDelete = async (item) => {
    try {
      await base44.entities.DeletedEntry.delete(item.id);
      load();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="h-14 flex items-center gap-3">
            <Link to="/clans" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold font-heading text-foreground">Recently Deleted</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">Last 15 — older entries are permanently lost</span>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No recently deleted entries.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate uppercase">{item.name || 'Untitled'}</p>
                  <p className="text-xs text-muted-foreground truncate">{subtypeText(item)} · {folders[item.folder_id] || 'Unknown folder'}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => restore(item)}>
                  <RotateCcw size={14} className="mr-2" /> Restore
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => permanentDelete(item)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}