import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Trash2, Pencil, Check, X, Tag as TagIcon, Folder } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  createTag, updateTag, deleteTag, renameTab, deleteTab,
} from '@/lib/databaseApi';

const PRESET_COLORS = ['#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];

export default function ManageTagsTabsDialog({ open, onOpenChange, tabs, tags, onChanged }) {
  const { toast } = useToast();
  const [newTag, setNewTag] = useState({ name: '', tab: '', color: PRESET_COLORS[0] });
  const [newTab, setNewTab] = useState('');
  const [editingTagId, setEditingTagId] = useState(null);
  const [editTagName, setEditTagName] = useState('');
  const [editingTab, setEditingTab] = useState(null);
  const [editTabName, setEditTabName] = useState('');
  const [busy, setBusy] = useState(false);

  const sortedTabs = [...(tabs || [])].sort((a, b) => a.localeCompare(b));
  const sortedTags = [...(tags || [])].sort(
    (a, b) => (a.tab || '').localeCompare(b.tab || '') || (a.name || '').localeCompare(b.name || '')
  );

  const handleAddTag = async () => {
    const name = newTag.name.trim();
    const tab = (newTag.tab || '').trim() || 'General';
    if (!name) return;
    setBusy(true);
    try {
      await createTag(name, tab, { color: newTag.color });
      setNewTag({ name: '', tab: newTag.tab, color: newTag.color });
      onChanged && onChanged();
      toast({ title: 'Tag added' });
    } catch (err) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const handleRenameTag = async (id) => {
    const name = editTagName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await updateTag(id, { name });
      setEditingTagId(null);
      onChanged && onChanged();
      toast({ title: 'Tag renamed' });
    } catch (err) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const handleDeleteTag = async (tag) => {
    if (!window.confirm(`Delete tag "${tag.name}"?`)) return;
    setBusy(true);
    try {
      await deleteTag(tag.id);
      onChanged && onChanged();
      toast({ title: 'Tag deleted' });
    } catch (err) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const handleAddTab = async () => {
    const name = newTab.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createTag('General', name, { color: PRESET_COLORS[0] });
      setNewTab('');
      onChanged && onChanged();
      toast({ title: 'Tab added' });
    } catch (err) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const handleRenameTab = async (oldName) => {
    const name = editTabName.trim();
    if (!name || name === oldName) { setEditingTab(null); return; }
    setBusy(true);
    try {
      await renameTab(oldName, name);
      setEditingTab(null);
      onChanged && onChanged();
      toast({ title: 'Tab renamed' });
    } catch (err) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const handleDeleteTab = async (tab) => {
    if (!window.confirm(`Delete tab "${tab}"? Its tags will be removed and its cards moved to "General".`)) return;
    setBusy(true);
    try {
      await deleteTab(tab);
      onChanged && onChanged();
      toast({ title: 'Tab deleted' });
    } catch (err) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-no-deselect>
        <DialogHeader>
          <DialogTitle>Manage Tags & Tabs</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="tags" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="tags"><TagIcon size={14} className="mr-2" /> Tags</TabsTrigger>
            <TabsTrigger value="tabs"><Folder size={14} className="mr-2" /> Tabs</TabsTrigger>
          </TabsList>

          {/* TAGS */}
          <TabsContent value="tags" className="space-y-3 mt-3">
            <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
              <div className="text-xs font-semibold text-muted-foreground">Add tag</div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[120px]">
                  <Label className="text-[10px] text-muted-foreground">Name</Label>
                  <Input
                    value={newTag.name}
                    onChange={(e) => setNewTag((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Tag name"
                    className="h-8"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Label className="text-[10px] text-muted-foreground">Tab</Label>
                  <Input
                    list="manage-tab-list"
                    value={newTag.tab}
                    onChange={(e) => setNewTag((s) => ({ ...s, tab: e.target.value }))}
                    placeholder="General"
                    className="h-8"
                  />
                  <datalist id="manage-tab-list">
                    {sortedTabs.map((t) => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Color</Label>
                  <div className="flex items-center gap-1 h-8">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewTag((s) => ({ ...s, color: c }))}
                        className="w-5 h-5 rounded-full border-2 transition-transform"
                        style={{
                          backgroundColor: c,
                          borderColor: newTag.color === c ? 'hsl(var(--foreground))' : 'transparent',
                          transform: newTag.color === c ? 'scale(1.15)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <Button size="sm" onClick={handleAddTag} disabled={busy || !newTag.name.trim()}>
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>
            </div>

            <div className="max-h-[40vh] overflow-y-auto space-y-1 pr-1">
              {sortedTags.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-6">No tags yet.</div>
              ) : sortedTags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 bg-card">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#6b7280' }} />
                  {editingTagId === tag.id ? (
                    <>
                      <Input
                        value={editTagName}
                        onChange={(e) => setEditTagName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameTag(tag.id)}
                        className="h-7 flex-1"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRenameTag(tag.id)} disabled={busy}>
                        <Check size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTagId(null)} disabled={busy}>
                        <X size={14} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-sm flex-1 truncate">{tag.name}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]">{tag.tab}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingTagId(tag.id); setEditTagName(tag.name); }} disabled={busy}>
                        <Pencil size={13} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTag(tag)} disabled={busy}>
                        <Trash2 size={13} />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* TABS */}
          <TabsContent value="tabs" className="space-y-3 mt-3">
            <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
              <div className="text-xs font-semibold text-muted-foreground">Add tab</div>
              <div className="flex items-center gap-2">
                <Input
                  value={newTab}
                  onChange={(e) => setNewTab(e.target.value)}
                  placeholder="New tab name"
                  className="h-8 flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTab()}
                />
                <Button size="sm" onClick={handleAddTab} disabled={busy || !newTab.trim()}>
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground">A starter "General" tag is created in the new tab so it appears in the database.</div>
            </div>

            <div className="max-h-[40vh] overflow-y-auto space-y-1 pr-1">
              {sortedTabs.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-6">No tabs yet.</div>
              ) : sortedTabs.map((tab) => (
                <div key={tab} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 bg-card">
                  <Folder size={14} className="text-muted-foreground flex-shrink-0" />
                  {editingTab === tab ? (
                    <>
                      <Input
                        value={editTabName}
                        onChange={(e) => setEditTabName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameTab(tab)}
                        className="h-7 flex-1"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRenameTab(tab)} disabled={busy}>
                        <Check size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTab(null)} disabled={busy}>
                        <X size={14} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-sm flex-1 truncate">{tab}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingTab(tab); setEditTabName(tab); }} disabled={busy}>
                        <Pencil size={13} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTab(tab)} disabled={busy}>
                        <Trash2 size={13} />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}