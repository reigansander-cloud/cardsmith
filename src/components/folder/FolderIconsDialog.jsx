import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Trash2, Plus, X, ArrowLeftRight, GripVertical, Type } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { STANDARD_STATS, STAT_COLORS, statColor } from '@/lib/folderPreview';
import { buildTabOrder, tabOrderDocId } from '@/lib/tabOrder';
import ReplaceAllSection from '@/components/folder/ReplaceAllSection';
import ExportFactionButton from '@/components/folder/ExportFactionButton';
import { AssetValueEditor } from '@/components/folder/AssetValueEditor';
import { applyWordTransformToScope, replaceIconUrlInScope, replaceIconWithTextInScope } from '@/lib/bulkApply';

const TEMPLATE_LABELS = { permanent: 'Permanent', instant: 'Instant', modifier: 'Modifier', battlefield: 'Battlefield', income: 'Income' };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function SectionCard({ title, action, className = '', children }) {
  return (
    <div className={`rounded-lg border border-border bg-card/40 p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{title}</Label>
        {action}
      </div>
      {children}
    </div>
  );
}

// Per-folder icons manager. Also shows the folder's custom stats, keywords,
// and supertypes. Each asset type lives in its own clearly divided section
// card; keywords get their own column on the right.
export default function FolderIconsDialog({ open, onOpenChange, folderId, folderName, icons, onIconsChange, stats, onStatsChange, keywords, onKeywordsChange, capitalized, onCapitalizedChange, iconWords, onIconWordsChange, supertypes = [], onSupertypesChange, folderColor, onFolderColorChange, title = 'Folder Assets' }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [newStatName, setNewStatName] = useState('');
  const [newStatColor, setNewStatColor] = useState('#9ca3af');
  const [newKeyword, setNewKeyword] = useState('');
  const [newCapitalized, setNewCapitalized] = useState('');
  const [newIconWord, setNewIconWord] = useState('');
  const [iconWordUploading, setIconWordUploading] = useState(false);
  const [kwTab, setKwTab] = useState('keywords');
  const iconWordFileRef = useRef(null);
  const replaceIconWordFileRef = useRef(null);
  const [replaceIconWordTarget, setReplaceIconWordTarget] = useState(null);
  const [newSuperName, setNewSuperName] = useState('');
  const [newSuperTemplate, setNewSuperTemplate] = useState('permanent');
  const [migrating, setMigrating] = useState(null);
  const [iconUsage, setIconUsage] = useState({});
  const [replacing, setReplacing] = useState(null);
  const [bulkApplying, setBulkApplying] = useState(null);
  const [tabOrder, setTabOrder] = useState(null);
  const [tabOrderRecordId, setTabOrderRecordId] = useState(null);
  const { toast } = useToast();
  const scope = folderId === '__global__' ? { type: 'global' } : { type: 'folder', folderId };

  const loadUsage = async () => {
    try {
      const query = folderId === '__global__' ? {} : { folder_id: folderId };
      const entries = await base44.entities.CardEntry.filter(query, '-created_date', 500);
      const map = {};
      (entries || []).forEach((e) => {
        (e.cost_icons || []).forEach((u) => { if (u) map[u] = (map[u] || 0) + 1; });
      });
      setIconUsage(map);
    } catch {}
  };

  const loadTabOrder = async () => {
    try {
      const docs = await base44.entities.RulesDoc.filter({ folder_id: tabOrderDocId(folderId) }, '-created_date', 5);
      if (docs && docs.length) {
        setTabOrderRecordId(docs[0].id);
        setTabOrder(JSON.parse(docs[0].content));
      } else {
        setTabOrderRecordId(null);
        setTabOrder(null);
      }
    } catch { setTabOrder(null); }
  };

  useEffect(() => {
    if (open) { loadUsage(); loadTabOrder(); }
     
  }, [open, folderId, icons]);

  const performReplace = async (newIcon) => {
    const oldUrl = replacing?.url;
    if (!oldUrl) return;
    setReplacing(null);
    try {
      const query = folderId === '__global__' ? { cost_icons: oldUrl } : { folder_id: folderId, cost_icons: oldUrl };
      const entries = await base44.entities.CardEntry.filter(query, '-created_date', 500);
      const updates = (entries || []).map((e) => ({
        id: e.id,
        cost_icons: (e.cost_icons || []).map((u) => (u === oldUrl ? newIcon.url : u)),
      }));
      if (updates.length) {
        await base44.entities.CardEntry.bulkUpdate(updates);
      }
      toast({ description: `Replaced on ${updates.length} card${updates.length === 1 ? '' : 's'}` });
      loadUsage();
    } catch (err) {
      toast({ title: 'Replace failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.FolderIcon.create({ folder_id: folderId, name: file.name.replace(/\.[^.]+$/, ''), url: file_url });
      }
      onIconsChange();
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const deleteIcon = async (id) => {
    await base44.entities.FolderIcon.delete(id);
    onIconsChange();
  };

  const saveIconValue = async (icon, value) => {
    try { await base44.entities.FolderIcon.update(icon.id, { value }); onIconsChange(); } catch {}
  };

  const saveKeywordValue = async (kw, value) => {
    try { await base44.entities.FolderKeyword.update(kw.id, { value }); onKeywordsChange(); } catch {}
  };

  const addStat = async () => {
    const name = newStatName.trim();
    if (!name) return;
    if (STANDARD_STATS.includes(name)) {
      toast({ title: 'Reserved name', description: 'PRWS, Amr, Dur are built-in stats.', variant: 'destructive' });
      return;
    }
    if (stats.some((s) => s.name === name)) {
      toast({ title: 'Already exists', description: 'A stat with that name already exists.', variant: 'destructive' });
      return;
    }
    await base44.entities.FolderStat.create({ folder_id: folderId, name, color: newStatColor });
    setNewStatName('');
    setNewStatColor('#9ca3af');
    onStatsChange();
  };

  const deleteStat = async (id) => {
    await base44.entities.FolderStat.delete(id);
    onStatsChange();
  };

  const addKeyword = async () => {
    const word = newKeyword.trim();
    if (!word) return;
    if (keywords.some((k) => k.word.toLowerCase() === word.toLowerCase())) { setNewKeyword(''); return; }
    await base44.entities.FolderKeyword.create({ folder_id: folderId, word });
    setNewKeyword('');
    onKeywordsChange();
    setBulkApplying('keyword');
    try {
      const res = await applyWordTransformToScope(scope, 'keyword', word);
      toast({ title: 'Keyword added', description: res.entryCount ? `Bolded ${res.total} occurrence${res.total === 1 ? '' : 's'} across ${res.entryCount} entr${res.entryCount === 1 ? 'y' : 'ies'}.` : 'No existing entries contained this word.' });
    } catch (err) { toast({ title: 'Apply failed', description: err.message, variant: 'destructive' }); }
    finally { setBulkApplying(null); }
  };

  const deleteKeyword = async (id) => {
    try {
      await base44.entities.FolderKeyword.delete(id);
      onKeywordsChange();
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const addCapitalized = async () => {
    const word = newCapitalized.trim();
    if (!word) return;
    if ((capitalized || []).some((k) => k.word.toLowerCase() === word.toLowerCase())) { setNewCapitalized(''); return; }
    await base44.entities.FolderCapitalized.create({ folder_id: folderId, word });
    setNewCapitalized('');
    onCapitalizedChange();
    setBulkApplying('capitalize');
    try {
      const res = await applyWordTransformToScope(scope, 'capitalize', word);
      toast({ title: 'Word added', description: res.entryCount ? `Capitalized ${res.total} occurrence${res.total === 1 ? '' : 's'} across ${res.entryCount} entr${res.entryCount === 1 ? 'y' : 'ies'}.` : 'No existing entries contained this word.' });
    } catch (err) { toast({ title: 'Apply failed', description: err.message, variant: 'destructive' }); }
    finally { setBulkApplying(null); }
  };

  const deleteCapitalized = async (id) => {
    try {
      await base44.entities.FolderCapitalized.delete(id);
      onCapitalizedChange();
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const addIconWord = async (file) => {
    const word = newIconWord.trim();
    if (!word) return;
    if (!file) { iconWordFileRef.current?.click(); return; }
    setIconWordUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.FolderIconWord.create({ folder_id: folderId, word, icon_url: file_url });
      setNewIconWord('');
      onIconWordsChange();
      setBulkApplying('icon');
      try {
        const res = await applyWordTransformToScope(scope, 'icon', word, file_url);
        toast({ title: 'Icon word added', description: res.entryCount ? `Replaced ${res.total} occurrence${res.total === 1 ? '' : 's'} across ${res.entryCount} entr${res.entryCount === 1 ? 'y' : 'ies'}.` : 'No existing entries contained this word.' });
      } catch (err) { toast({ title: 'Apply failed', description: err.message, variant: 'destructive' }); }
      finally { setBulkApplying(null); }
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIconWordUploading(false);
      if (iconWordFileRef.current) iconWordFileRef.current.value = '';
    }
  };

  const deleteIconWord = async (id) => {
    try {
      await base44.entities.FolderIconWord.delete(id);
      onIconWordsChange();
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const startReplaceIconWord = (iw) => {
    setReplaceIconWordTarget(iw);
    replaceIconWordFileRef.current?.click();
  };

  const replaceIconWord = async (file) => {
    const target = replaceIconWordTarget;
    setReplaceIconWordTarget(null);
    if (!target || !file) return;
    setBulkApplying('icon');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.FolderIconWord.update(target.id, { icon_url: file_url });
      const res = await replaceIconUrlInScope(scope, target.icon_url, file_url);
      onIconWordsChange();
      toast({ title: 'Icon replaced', description: res.entryCount ? `Replaced ${res.total} occurrence${res.total === 1 ? '' : 's'} across ${res.entryCount} entr${res.entryCount === 1 ? 'y' : 'ies'}.` : 'No entries used this icon.' });
    } catch (err) {
      toast({ title: 'Replace failed', description: err.message, variant: 'destructive' });
    } finally {
      setBulkApplying(null);
      if (replaceIconWordFileRef.current) replaceIconWordFileRef.current.value = '';
    }
  };

  const replaceIconWordWithText = async (iw) => {
    const text = window.prompt(`Replace the "${iw.word}" icon with text:`, iw.word);
    if (text === null) return;
    setBulkApplying('icon');
    try {
      const res = await replaceIconWithTextInScope(scope, iw.icon_url, text);
      await base44.entities.FolderIconWord.delete(iw.id);
      onIconWordsChange();
      toast({ title: 'Icon replaced with text', description: res.entryCount ? `Replaced ${res.total} occurrence${res.total === 1 ? '' : 's'} across ${res.entryCount} entr${res.entryCount === 1 ? 'y' : 'ies'}.` : 'No entries used this icon.' });
    } catch (err) {
      toast({ title: 'Replace failed', description: err.message, variant: 'destructive' });
    } finally {
      setBulkApplying(null);
    }
  };

  const addSupertype = async () => {
    const name = newSuperName.trim();
    if (!name) return;
    if (supertypes.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: 'Already exists', description: 'A supertype with that name already exists.', variant: 'destructive' });
      return;
    }
    const sortOrder = supertypes.reduce((mx, s) => Math.max(mx, s.sort_order || 0), -1) + 1;
    await base44.entities.FolderSupertype.create({ folder_id: folderId, name, template_type: newSuperTemplate, sort_order: sortOrder });
    setNewSuperName('');
    setNewSuperTemplate('permanent');
    onSupertypesChange();
  };

  const requestDeleteSupertype = async (s) => {
    if (folderId !== '__global__' && s.folder_id === '__global__') return;
    try {
      const folderQuery = folderId === '__global__' ? {} : { folder_id: folderId };
      const [nonToken, token] = await Promise.all([
        base44.entities.CardEntry.filter({ ...folderQuery, supertype: s.name }, '-created_date', 500),
        base44.entities.CardEntry.filter({ ...folderQuery, token_type: s.name }, '-created_date', 500),
      ]);
      const count = (nonToken || []).length + (token || []).length;
      if (count === 0) {
        await base44.entities.FolderSupertype.delete(s.id);
        onSupertypesChange();
        return;
      }
      const candidates = supertypes.filter((x) => x.id !== s.id && x.template_type === s.template_type);
      if (candidates.length === 0) {
        toast({ title: 'Cannot delete', description: `${count} entries use "${cap(s.name)}" and no other ${TEMPLATE_LABELS[s.template_type] || s.template_type} supertype exists to migrate them to.`, variant: 'destructive' });
        return;
      }
      setMigrating({ id: s.id, name: s.name, count, candidates, target: candidates[0].name });
    } catch {}
  };

  const confirmMigrateAndDelete = async () => {
    if (!migrating) return;
    try {
      const folderQuery = folderId === '__global__' ? {} : { folder_id: folderId };
      let more = true;
      while (more) {
        const res = await base44.entities.CardEntry.updateMany({ ...folderQuery, supertype: migrating.name }, { $set: { supertype: migrating.target } });
        more = res && res.has_more;
      }
      more = true;
      while (more) {
        const res = await base44.entities.CardEntry.updateMany({ ...folderQuery, token_type: migrating.name }, { $set: { token_type: migrating.target } });
        more = res && res.has_more;
      }
      await base44.entities.FolderSupertype.delete(migrating.id);
      onSupertypesChange();
    } catch {}
    setMigrating(null);
  };

  const cancelMigrate = () => setMigrating(null);

  // Only show this folder's own supertypes in the settings list; global
  // supertypes are managed from the Clans page. The full `supertypes` array
  // (including globals) is still used for duplicate-name checks and migration
  // candidates below.
  const displaySupertypes = supertypes.filter((s) => s.folder_id === folderId);
  const orderedItems = buildTabOrder(tabOrder, displaySupertypes.map((s) => s.name));

  const onDragEnd = async (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const next = [...orderedItems];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setTabOrder(next);
    const content = JSON.stringify(next);
    try {
      if (tabOrderRecordId) await base44.entities.RulesDoc.update(tabOrderRecordId, { content });
      else {
        const doc = await base44.entities.RulesDoc.create({ folder_id: tabOrderDocId(folderId), content });
        setTabOrderRecordId(doc.id);
      }
      const updates = supertypes
        .filter((s) => folderId === '__global__' || s.folder_id === folderId)
        .map((s) => ({ id: s.id, sort_order: next.indexOf(s.name) }));
      await base44.entities.FolderSupertype.bulkUpdate(updates);
      onSupertypesChange();
    } catch (err) {
      toast({ title: 'Reorder failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          <div className="space-y-3">
            <SectionCard title="Supertypes">
              <p className="text-[11px] text-muted-foreground mb-2">{folderId === '__global__' ? 'Global supertype tabs — shown in all folders. Each uses a render template.' : 'Folder-specific supertypes (in addition to the global ones). Each uses a render template.'} Drag the handle to reorder.</p>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="supertypes">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1 mb-2">
                      {orderedItems.map((name, index) => {
                        const sup = supertypes.find((s) => s.name === name);
                        const isGlobal = folderId !== '__global__' && sup?.folder_id === '__global__';
                        return (
                          <Draggable key={name} draggableId={name} index={index}>
                            {(prov) => (
                              <div ref={prov.innerRef} {...prov.draggableProps} className="flex items-center gap-2 text-sm group rounded">
                                <span {...prov.dragHandleProps} className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0 px-0.5">
                                  <GripVertical size={14} />
                                </span>
                                <span className="flex-1 font-medium text-foreground">{cap(name)}</span>
                                {isGlobal ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">Global</span>
                                ) : (
                                  <>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">{TEMPLATE_LABELS[sup?.template_type] || sup?.template_type}</span>
                                    <button onClick={() => requestDeleteSupertype(sup)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              {migrating && (
                <div className="mt-2 p-2 rounded border border-amber-300 bg-amber-50/50">
                  <p className="text-xs text-amber-900 mb-1.5">{migrating.count} entries use "{cap(migrating.name)}". Migrate them to:</p>
                  <div className="flex items-center gap-2">
                    <select value={migrating.target} onChange={(e) => setMigrating((m) => ({ ...m, target: e.target.value }))} className="h-8 rounded-md border border-border bg-background px-2 text-xs flex-1">
                      {migrating.candidates.map((c) => <option key={c.id} value={c.name}>{cap(c.name)}</option>)}
                    </select>
                    <Button size="sm" className="h-8" onClick={confirmMigrateAndDelete}>Migrate &amp; Delete</Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={cancelMigrate}>Cancel</Button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input value={newSuperName} onChange={(e) => setNewSuperName(e.target.value)} placeholder="New supertype name" className="h-8 text-sm" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSupertype(); } }} />
                <select value={newSuperTemplate} onChange={(e) => setNewSuperTemplate(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                  <option value="permanent">Permanent</option>
                  <option value="instant">Instant</option>
                  <option value="modifier">Modifier</option>
                  <option value="battlefield">Battlefield</option>
                  <option value="income">Income</option>
                </select>
                <Button size="sm" className="h-8" onClick={addSupertype}>
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>
            </SectionCard>

            {folderId !== '__global__' && (
              <SectionCard title="Folder Color">
                <p className="text-[11px] text-muted-foreground mb-2">Background color for entries in this folder — shown in the folder, deck manager, and review.</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={folderColor || '#ffffff'} onChange={(e) => onFolderColorChange?.(e.target.value)} className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer" />
                  <Input value={folderColor || ''} onChange={(e) => onFolderColorChange?.(e.target.value)} placeholder="#ffffff" className="h-8 text-sm flex-1" />
                  <Button size="sm" variant="outline" className="h-8" onClick={() => onFolderColorChange?.('')}>Reset</Button>
                </div>
              </SectionCard>
            )}

            {folderId !== '__global__' && (
              <SectionCard title="Export">
                <p className="text-[11px] text-muted-foreground mb-2">Download an Excel spreadsheet of every card in this folder. Icons are reverted to their corresponding words where a mapping is defined.</p>
                <ExportFactionButton folderId={folderId} folderName={folderName} />
              </SectionCard>
            )}

            <SectionCard
              title="Icons"
              action={
                <Button variant="outline" size="sm" className="h-8" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload size={14} className="mr-2" /> {uploading ? 'Uploading…' : 'Upload'}
                </Button>
              }
            >
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
              <p className="text-[10px] text-muted-foreground mb-2">Right-click an icon to set its point value (used in review evaluation).</p>
              {icons.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">No icons yet. The first icon is used for cost bars.</p>
              ) : replacing ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">Replace "{replacing.name}" — pick a replacement:</p>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setReplacing(null)}>Cancel</Button>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {icons.filter((i) => i.url !== replacing.url).length === 0 ? (
                      <p className="text-xs text-muted-foreground col-span-full py-2">No other icons available.</p>
                    ) : icons.filter((i) => i.url !== replacing.url).map((i) => (
                      <button key={i.id} onClick={() => performReplace(i)} className="rounded-md border border-border bg-muted/30 p-1.5 hover:border-primary transition-colors">
                        <img src={i.url} alt={i.name} className="w-full h-12 object-contain" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  {icons.map((icon) => {
                    const used = (iconUsage[icon.url] || 0) > 0;
                    return (
                    <AssetValueEditor key={icon.id} value={icon.value || 0} onSave={(v) => saveIconValue(icon, v)}>
                    <div className="relative group rounded-md border border-border bg-muted/30 p-1.5">
                      <img src={icon.url} alt={icon.name} className="w-full h-12 object-contain" />
                      {!!icon.value && <span className="absolute -top-1.5 -left-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">{icon.value}</span>}
                      <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setReplacing(icon)}
                          title="Replace on all cards using this icon"
                          className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                        >
                          <ArrowLeftRight size={11} />
                        </button>
                        <button
                          onClick={() => deleteIcon(icon.id)}
                          disabled={used}
                          title={used ? `Used on ${iconUsage[icon.url]} card(s) — replace instead` : 'Delete'}
                          className={`w-5 h-5 rounded-full flex items-center justify-center ${used ? 'bg-muted-foreground/40 text-muted-foreground cursor-not-allowed' : 'bg-destructive text-destructive-foreground'}`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    </AssetValueEditor>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Custom Stats">
              <div className="space-y-1.5 mb-2">
                {STANDARD_STATS.map((name) => (
                  <div key={name} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded" style={{ background: STAT_COLORS[name] }} />
                    <span className="text-foreground">{name}</span>
                    <span className="text-xs text-muted-foreground">(built-in)</span>
                  </div>
                ))}
                {stats.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-sm group">
                    <span className="w-5 h-5 rounded" style={{ background: statColor(s.name, s.color) }} />
                    <span className="text-foreground flex-1">{s.name}</span>
                    <button onClick={() => deleteStat(s.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input value={newStatName} onChange={(e) => setNewStatName(e.target.value)} placeholder="New stat name" className="h-8 text-sm" />
                <input type="color" value={newStatColor} onChange={(e) => setNewStatColor(e.target.value)} className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer" />
                <Button size="sm" className="h-8" onClick={addStat}>
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>
            </SectionCard>
          </div>

          <div>
            <SectionCard title="Keywords" className="h-full flex flex-col">
              <div className="flex gap-1 mb-2 border-b border-border">
                <button onClick={() => setKwTab('keywords')} className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${kwTab === 'keywords' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Keywords</button>
                <button onClick={() => setKwTab('capitalized')} className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${kwTab === 'capitalized' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Capitalized</button>
                <button onClick={() => setKwTab('icons')} className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${kwTab === 'icons' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Icons</button>
              </div>
              {kwTab === 'keywords' && (
                <>
                  <p className="text-[11px] text-muted-foreground mb-2">These words always render bolded in ability text. End a keyword with " ?" to bold it together with a following number. Right-click a keyword to set its point value (used in review evaluation).</p>
                  <div className="space-y-1.5 mb-2 flex-1 overflow-y-auto">
                    {keywords.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No keywords yet.</p>
                    ) : (
                      keywords.map((k) => (
                        <AssetValueEditor key={k.id} value={k.value || 0} onSave={(v) => saveKeywordValue(k, v)}>
                          <div className="flex items-center gap-2 text-sm group">
                            <span className="font-bold text-foreground flex-1 break-words">{k.word}</span>
                            {!!k.value && <span className="bg-primary/15 text-primary text-[10px] font-bold rounded px-1.5 py-0.5 flex-shrink-0">{k.value}</span>}
                            <button onClick={() => deleteKeyword(k.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </AssetValueEditor>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="New keyword" className="h-8 text-sm" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }} />
                    <Button size="sm" className="h-8" onClick={addKeyword} disabled={!!bulkApplying}>
                      <Plus size={14} className="mr-1" /> {bulkApplying === 'keyword' ? '…' : 'Add'}
                    </Button>
                  </div>
                </>
              )}
              {kwTab === 'capitalized' && (
                <>
                  <p className="text-[11px] text-muted-foreground mb-2">These words always have their first letter capitalized in ability text.</p>
                  <div className="space-y-1.5 mb-2 flex-1 overflow-y-auto">
                    {(capitalized || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No capitalized words yet.</p>
                    ) : (
                      (capitalized || []).map((k) => (
                        <div key={k.id} className="flex items-center gap-2 text-sm group">
                          <span className="font-medium text-foreground flex-1 break-words">{k.word}</span>
                          <button onClick={() => deleteCapitalized(k.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={newCapitalized} onChange={(e) => setNewCapitalized(e.target.value)} placeholder="New word" className="h-8 text-sm" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCapitalized(); } }} />
                    <Button size="sm" className="h-8" onClick={addCapitalized} disabled={!!bulkApplying}>
                      <Plus size={14} className="mr-1" /> {bulkApplying === 'capitalize' ? '…' : 'Add'}
                    </Button>
                  </div>
                </>
              )}
              {kwTab === 'icons' && (
                <>
                  <p className="text-[11px] text-muted-foreground mb-2">These words are replaced by their icon in ability text. Takes priority over bold and capitalize. Type a word, then upload its icon.</p>
                  <input ref={iconWordFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = (e.target.files || [])[0]; if (f) addIconWord(f); }} />
                  <input ref={replaceIconWordFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = (e.target.files || [])[0]; if (f) replaceIconWord(f); }} />
                  <div className="space-y-1.5 mb-2 flex-1 overflow-y-auto">
                    {(iconWords || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No icon words yet.</p>
                    ) : (
                      (iconWords || []).map((iw) => (
                        <div key={iw.id} className="flex items-center gap-2 text-sm group">
                          <img src={iw.icon_url} alt="" className="w-6 h-6 object-contain flex-shrink-0 rounded border border-border bg-muted/30" />
                          <span className="font-medium text-foreground flex-1 break-words">{iw.word}</span>
                          <button onClick={() => replaceIconWordWithText(iw)} disabled={!!bulkApplying} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Replace icon with text">
                            <Type size={14} />
                          </button>
                          <button onClick={() => startReplaceIconWord(iw)} disabled={!!bulkApplying} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Replace icon">
                            <ArrowLeftRight size={14} />
                          </button>
                          <button onClick={() => deleteIconWord(iw.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={newIconWord} onChange={(e) => setNewIconWord(e.target.value)} placeholder="New word" className="h-8 text-sm flex-1" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIconWord(); } }} />
                    <Button size="sm" variant="outline" className="h-8" onClick={() => iconWordFileRef.current?.click()} disabled={iconWordUploading || !!bulkApplying || !newIconWord.trim()}>
                      <Upload size={14} className="mr-1" /> {bulkApplying === 'icon' ? 'Applying…' : iconWordUploading ? 'Uploading…' : 'Upload Icon'}
                    </Button>
                  </div>
                </>
              )}
            </SectionCard>
          </div>
          <div className="md:col-span-2">
            <SectionCard title="Replace All">
              <ReplaceAllSection scope={folderId === '__global__' ? { type: 'global' } : { type: 'folder', folderId }} icons={icons} />
            </SectionCard>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}