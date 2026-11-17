import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getTemplates, saveTemplate, deleteTemplate } from '@/lib/freeCanvasTemplates';
import { Trash2, Save } from 'lucide-react';

export default function SaveTemplateDialog({ open, onOpenChange, canvasData, multipleCanvases }) {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      setTemplates(getTemplates());
      setName('');
    }
  }, [open]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveTemplate(trimmed, canvasData);
    setTemplates(getTemplates());
    setName('');
    onOpenChange(false);
  };

  const handleDelete = (templateName) => {
    deleteTemplate(templateName);
    setTemplates(getTemplates());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-no-deselect>
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
        </DialogHeader>
        {multipleCanvases ? (
          <p className="text-sm text-muted-foreground py-4">
            Cannot save as template when multiple canvases are open. Close other canvases or switch to a single-canvas view first.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Template name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a name for this template"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                className="bg-muted/30 border-border"
                autoFocus
              />
            </div>
            {templates.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Saved templates</Label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {templates.map((t) => (
                    <div key={t.name} className="flex items-center justify-between gap-2 p-2 rounded-md border border-border">
                      <span className="text-sm truncate">{t.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(t.name)} className="text-destructive h-7 px-2">
                        <Trash2 size={12} className="mr-1" /> Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={multipleCanvases || !name.trim()}>
            <Save size={12} className="mr-1" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}