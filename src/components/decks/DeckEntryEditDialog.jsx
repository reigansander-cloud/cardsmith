import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EntryCard from '@/components/folder/EntryCard';
import { mergeAssets } from '@/lib/globalAssets';

const EDITABLE_FIELDS = ['name', 'cost', 'cost_icons', 'influence', 'ability', 'subtype', 'supertype', 'token_type', 'stats', 'fabled', 'needs_review', 'income_symbol', 'bonus_mode', 'bonus_cost_icons', 'bonus_ability'];

function copyEditable(e) {
  const out = {};
  EDITABLE_FIELDS.forEach((f) => { out[f] = e[f]; });
  return out;
}

// Opens a folder-style EntryCard editor for an entry from the deck manager.
// Loads the entry's folder assets (icons, stats, keywords, capitalized) plus
// the global ones, debounces saves back to CardEntry, and syncs the parent.
export default function DeckEntryEditDialog({ open, onOpenChange, entry, supertypes = [], folderColor = '', onEntryChange, onEntryDeleted }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [working, setWorking] = useState(null);
  const [icons, setIcons] = useState([]);
  const [stats, setStats] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [capitalized, setCapitalized] = useState([]);
  const pendingRef = useRef(null);

  // Reset the working copy whenever a different entry is opened.
  useEffect(() => {
    if (open && entry) setWorking({ ...entry });
  }, [open, entry?.id]);

  // Load folder + global assets for this entry's folder.
  useEffect(() => {
    if (!open || !entry?.folder_id) return;
    const fid = entry.folder_id;
    Promise.all([
      base44.entities.FolderIcon.filter({ folder_id: fid }, '-created_date', 200).catch(() => []),
      base44.entities.FolderStat.filter({ folder_id: fid }, '-created_date', 200).catch(() => []),
      base44.entities.FolderKeyword.filter({ folder_id: fid }, '-created_date', 200).catch(() => []),
      base44.entities.FolderCapitalized.filter({ folder_id: fid }, '-created_date', 200).catch(() => []),
      base44.entities.FolderIcon.filter({ folder_id: '__global__' }, '-created_date', 200).catch(() => []),
      base44.entities.FolderStat.filter({ folder_id: '__global__' }, '-created_date', 200).catch(() => []),
      base44.entities.FolderKeyword.filter({ folder_id: '__global__' }, '-created_date', 200).catch(() => []),
      base44.entities.FolderCapitalized.filter({ folder_id: '__global__' }, '-created_date', 200).catch(() => []),
    ]).then(([ic, st, kw, cap, gic, gst, gkw, gcap]) => {
      setIcons(mergeAssets(ic, gic, 'url'));
      setStats(mergeAssets(st, gst, 'name'));
      setKeywords(mergeAssets(kw, gkw, 'word'));
      setCapitalized(mergeAssets(cap, gcap, 'word'));
    });
  }, [open, entry?.folder_id]);

  const flush = useCallback(() => {
    if (!pendingRef.current) return;
    const { id, fields } = pendingRef.current;
    pendingRef.current = null;
    base44.entities.CardEntry.update(id, fields).catch(() => {});
  }, []);

  const handleUpdate = useCallback((entryId, fields) => {
    setWorking((prev) => prev ? { ...prev, ...fields } : prev);
    onEntryChange?.(entryId, fields);
    pendingRef.current = { id: entryId, fields: { ...(pendingRef.current?.fields || {}), ...fields } };
    if (pendingRef.current.timer) clearTimeout(pendingRef.current.timer);
    pendingRef.current.timer = setTimeout(() => {
      const p = pendingRef.current;
      if (!p) return;
      pendingRef.current = null;
      base44.entities.CardEntry.update(p.id, p.fields).catch(() => {});
    }, 400);
  }, [onEntryChange]);

  const handleDelete = useCallback(async (entryId) => {
    try {
      const e = working || entry;
      if (e) {
        await base44.entities.DeletedEntry.create({
          folder_id: e.folder_id, ...copyEditable(e),
        });
      }
      await base44.entities.CardEntry.delete(entryId);
      onEntryDeleted?.(entryId);
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  }, [working, entry, onEntryDeleted, onOpenChange, toast]);

  const handleCopy = useCallback(async (e) => {
    try {
      await base44.entities.CardEntry.create({ folder_id: e.folder_id, ...copyEditable(e) });
      toast({ description: 'Duplicate created in folder' });
    } catch (err) {
      toast({ title: 'Duplicate failed', description: err.message, variant: 'destructive' });
    }
  }, [toast]);

  const handleToggleReview = useCallback(async (e) => {
    const next = !e.needs_review;
    const fields = { needs_review: next };
    if (next) {
      fields.flagged_by_id = user?.id || '';
      fields.flagged_by_name = user?.full_name || user?.email || 'Anonymous';
    } else {
      fields.flagged_by_id = '';
      fields.flagged_by_name = '';
    }
    handleUpdate(e.id, fields);
    if (!next) { base44.entities.EntryComment.deleteMany({ entry_id: e.id }).catch(() => {}); }
  }, [handleUpdate, user]);

  // flush any pending save when the dialog closes
  useEffect(() => () => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timer);
      base44.entities.CardEntry.update(pendingRef.current.id, pendingRef.current.fields).catch(() => {});
      pendingRef.current = null;
    }
  }, []);

  if (!working) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) flush(); onOpenChange(o); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Entry</DialogTitle>
        </DialogHeader>
        <EntryCard
          entry={working}
          folderStats={stats}
          icons={icons}
          keywords={keywords}
          capitalized={capitalized}
          supertypes={supertypes}
          folderColor={folderColor}
          selected
          editable
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onCopy={handleCopy}
          onToggleReview={handleToggleReview}
        />
      </DialogContent>
    </Dialog>
  );
}