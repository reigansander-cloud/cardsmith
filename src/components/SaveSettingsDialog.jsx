import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderOpen, Upload, X, Save, Trash2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { getTemplates, saveTemplate, deleteTemplate } from '@/lib/freeCanvasTemplates';
import { getUploadedIcons } from '@/lib/uploadedIconsStore';
import { defaultTabForTemplate, getTagsForTab, createTag } from '@/lib/databaseApi';
import TagChip from '@/components/tags/TagChip';
import TagCreateForm from '@/components/tags/TagCreateForm';

const FORMATS = [
  { key: 'png', label: 'PNG' },
  { key: 'jpg', label: 'JPG' },
  { key: 'psd', label: 'PSD' },
  { key: 'cs', label: 'CS' },
];
const BG_TYPES = [
  { key: 'color', label: 'Color' },
  { key: 'image', label: 'Image' },
  { key: 'none', label: 'None' },
];

function Toggle({ checked, onChange, title }) {
  return (
    <button
      type="button"
      onClick={onChange}
      title={title}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'left-4' : 'left-0.5'}`} />
    </button>
  );
}

function SegButtons({ value, options, onChange }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <Button key={o.key} size="sm" variant={value === o.key ? 'default' : 'outline'} onClick={() => onChange(o.key)} className="h-8">
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function CopyBackgroundBlock({ config, setConfig, allowPsd, onUpload, uploading }) {
  const formats = allowPsd ? FORMATS : FORMATS.filter((f) => f.key !== 'psd' && f.key !== 'cs');
  return (
    <div className="space-y-2.5 rounded-md border border-border bg-muted/20 p-2.5">
      <Label className="text-[11px] text-muted-foreground">Background</Label>
      <SegButtons value={config.bgType} options={BG_TYPES} onChange={(k) => setConfig({ ...config, bgType: k })} />
      {config.bgType === 'color' && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={config.bgColor}
            onChange={(e) => setConfig({ ...config, bgColor: e.target.value })}
            className="w-9 h-9 rounded cursor-pointer bg-transparent border border-border p-0.5"
          />
          <Input value={config.bgColor} onChange={(e) => setConfig({ ...config, bgColor: e.target.value })} className="w-32 font-mono text-xs" />
        </div>
      )}
      {config.bgType === 'image' && (
        <div className="space-y-1.5">
          {config.bgImage ? (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded border border-border overflow-hidden bg-muted/30 flex-shrink-0">
                <img src={config.bgImage} alt="bg" className="w-full h-full object-cover" />
              </div>
              <Button variant="outline" size="sm" onClick={() => setConfig({ ...config, bgImage: '' })} className="flex-1">
                <X size={14} className="mr-2" /> Remove
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={onUpload} disabled={uploading} className="w-full justify-start">
              <Upload size={14} className="mr-2" /> {uploading ? 'Uploading...' : 'Upload image'}
            </Button>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Format</Label>
        <SegButtons value={config.format} options={formats} onChange={(k) => setConfig({ ...config, format: k })} />
      </div>
    </div>
  );
}

export default function SaveSettingsDialog({
  open,
  onOpenChange,
  template,
  saveToDatabase,
  setSaveToDatabase,
  dbNeedsReview,
  setDbNeedsReview,
  dbTab,
  setDbTab,
  dbTags,
  setDbTags,
  existingTabs,
  saveOptionsEnabled,
  setSaveOptionsEnabled,
  exportMargin,
  setExportMargin,
  exportRotated,
  setExportRotated,
  defaultDirHandle,
  onChooseDirectory,
  primaryFormat,
  setPrimaryFormat,
  saveCopy,
  setSaveCopy,
  copy,
  setCopy,
  copyDirHandle,
  onChooseCopyDirectory,
  projectData,
}) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [tabMode, setTabMode] = useState('existing');
  const [newTabText, setNewTabText] = useState('');
  const [tabTags, setTabTags] = useState([]);
  const copyFileRef = useRef(null);

  const allowPsd = template === 'free_canvas';
  const isFreeCanvas = template === 'free_canvas';

  useEffect(() => {
    if (open) {
      setTemplates(getTemplates());
      setName('');
      const def = defaultTabForTemplate(template);
      const current = dbTab || def;
      if (existingTabs.includes(current)) {
        setTabMode('existing');
      } else {
        setTabMode('new');
        setNewTabText(current);
      }
    }
  }, [open]);  

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCopy((c) => ({ ...c, bgImage: file_url }));
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const closeAndToast = (title, description) => {
    toast({ title, description });
    onOpenChange(false);
  };

  const handleSaveNew = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveTemplate(trimmed, projectData, getUploadedIcons());
    closeAndToast('Template saved', `"${trimmed}" was saved as a project template.`);
  };
  const handleReplace = (templateName) => {
    saveTemplate(templateName, projectData, getUploadedIcons());
    closeAndToast('Template updated', `"${templateName}" was updated.`);
  };
  const handleDelete = (templateName) => {
    deleteTemplate(templateName);
    closeAndToast('Template deleted', `"${templateName}" was deleted.`);
  };

  const handleCreateTag = async ({ name, color, icon }) => {
    const t = (name || '').trim();
    if (!t || !dbTab) return;
    try {
      await createTag(t, dbTab, { color, icon });
      setTabTags((prev) => (prev.some((x) => x.name === t) ? prev : [...prev, { name: t, color, icon }]));
      setDbTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
    } catch (err) {
      toast({ title: 'Tag failed', description: err.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!dbTab) { setTabTags([]); return; }
    getTagsForTab(dbTab).then(setTabTags).catch(() => setTabTags([]));
    setDbTags([]);
  }, [open, dbTab]);  

  const cols = isFreeCanvas ? 'grid grid-cols-3 gap-4' : 'grid grid-cols-2 gap-4';
  const tabSelectValue = tabMode === 'existing'
    ? (existingTabs.includes(dbTab) ? dbTab : (existingTabs[0] || ''))
    : '__new__';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isFreeCanvas ? 'max-w-4xl' : 'max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>Save Settings</DialogTitle>
        </DialogHeader>
        <div className={cols}>
          {/* Column 1: Save to Database */}
          <section className="space-y-3 border border-border rounded-lg p-3 bg-card/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Save to Database</Label>
              <Toggle checked={saveToDatabase} onChange={() => setSaveToDatabase(!saveToDatabase)} title="Toggle save to database" />
            </div>
            {saveToDatabase && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Needs review</Label>
                  <Toggle checked={dbNeedsReview} onChange={() => setDbNeedsReview((v) => !v)} title="Flag for review" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Database tab</Label>
                  <select
                    value={tabSelectValue}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setTabMode('new');
                        const def = newTabText || defaultTabForTemplate(template);
                        if (!newTabText) setNewTabText(def);
                        setDbTab(def);
                      } else {
                        setTabMode('existing');
                        setDbTab(e.target.value);
                      }
                    }}
                    className="w-full h-8 rounded-md border border-border bg-muted/30 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {existingTabs.map((t) => <option key={t} value={t}>{t}</option>)}
                    <option value="__new__">＋ New tab…</option>
                  </select>
                  {tabMode === 'new' && (
                    <Input
                      value={newTabText}
                      onChange={(e) => { setNewTabText(e.target.value); setDbTab(e.target.value); }}
                      placeholder="New tab name"
                      className="bg-muted/30 border-border h-8 text-xs"
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Tags</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {tabTags.map((t) => {
                      const on = dbTags.includes(t.name);
                      return (
                        <TagChip
                          key={t.name}
                          tag={t}
                          onClick={() => setDbTags(on ? dbTags.filter((x) => x !== t.name) : [...dbTags, t.name])}
                          className={on ? 'ring-1 ring-primary' : 'opacity-70 hover:opacity-100'}
                        />
                      );
                    })}
                    {dbTags.filter((t) => !tabTags.some((tt) => tt.name === t)).map((t) => (
                      <TagChip key={t} tag={{ name: t }} onClick={() => setDbTags(dbTags.filter((x) => x !== t))} className="ring-1 ring-primary" />
                    ))}
                  </div>
                  <TagCreateForm tab={dbTab} onCreate={handleCreateTag} />
                </div>
              </div>
            )}
          </section>

          {/* Column 2: Save Options */}
          <section className="space-y-3 border border-border rounded-lg p-3 bg-card/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Save File</Label>
              <Toggle checked={saveOptionsEnabled} onChange={() => setSaveOptionsEnabled(!saveOptionsEnabled)} title="Toggle save options" />
            </div>
            {saveOptionsEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">1/8" border</Label>
                    <p className="text-[11px] text-muted-foreground">Add a 1/8 inch margin.</p>
                  </div>
                  <Toggle checked={exportMargin} onChange={() => setExportMargin(!exportMargin)} title="Toggle border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Format</Label>
                  <SegButtons
                    value={primaryFormat}
                    options={allowPsd ? FORMATS : FORMATS.filter((f) => f.key !== 'psd' && f.key !== 'cs')}
                    onChange={setPrimaryFormat}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Save folder</Label>
                  <Button variant="outline" size="sm" onClick={onChooseDirectory} className="w-full justify-start">
                    <FolderOpen size={14} className="mr-2" /> {defaultDirHandle ? defaultDirHandle.name : 'Choose folder...'}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">Save rotated</Label>
                    <p className="text-[11px] text-muted-foreground">Rotate exports 90° clockwise.</p>
                  </div>
                  <Toggle checked={exportRotated} onChange={() => setExportRotated(!exportRotated)} title="Toggle rotated" />
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <div>
                    <Label className="text-xs font-medium">Save a copy</Label>
                    <p className="text-[11px] text-muted-foreground">A second file with its own settings.</p>
                  </div>
                  <Toggle checked={saveCopy} onChange={() => setSaveCopy(!saveCopy)} title="Toggle copy" />
                </div>
                {saveCopy && (
                  <div className="space-y-2">
                    <CopyBackgroundBlock
                      config={copy}
                      setConfig={setCopy}
                      allowPsd={allowPsd}
                      onUpload={() => copyFileRef.current?.click()}
                      uploading={uploading}
                    />
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Copy destination</Label>
                      <Button variant="outline" size="sm" onClick={onChooseCopyDirectory} className="w-full justify-start">
                        <FolderOpen size={14} className="mr-2" /> {copyDirHandle ? copyDirHandle.name : 'Choose folder...'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Column 3 (free canvas only): Templates */}
          {isFreeCanvas && (
            <section className="space-y-3 border border-border rounded-lg p-3 bg-card/40">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project Templates</Label>
              <p className="text-[11px] text-muted-foreground">Saves all open canvas tabs as one project template.</p>
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Template name"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNew(); }}
                  className="bg-muted/30 border-border h-9"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveNew} disabled={!name.trim()} className="whitespace-nowrap">
                  <Save size={12} className="mr-1" /> Save
                </Button>
              </div>
              {templates.length > 0 && (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {templates.map((t) => (
                    <div key={t.name} className="flex items-center justify-between gap-2 p-2 rounded-md border border-border">
                      <span className="text-sm truncate">{t.name}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleReplace(t.name)} className="h-7 px-2">
                          <RefreshCw size={12} className="mr-1" /> Replace
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(t.name)} className="text-destructive h-7 px-2">
                          <Trash2 size={12} className="mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        <input ref={copyFileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}