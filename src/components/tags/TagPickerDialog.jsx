import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TagChip from './TagChip';
import TagCreateForm from './TagCreateForm';

// tabTags: [{ name, color, icon }]
// cardTags: [string]
// onToggle(name), onCreate({ name, color, icon })
export default function TagPickerDialog({ open, onOpenChange, tabTags = [], cardTags = [], onToggle, onCreate }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage tags</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Tags in this tab — click to add or remove</p>
            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-1">
              {tabTags.length === 0 && <p className="text-xs text-muted-foreground">No tags in this tab yet.</p>}
              {tabTags.map((t) => {
                const on = cardTags.includes(t.name);
                return (
                  <TagChip
                    key={t.name}
                    tag={t}
                    onClick={() => onToggle(t.name)}
                    className={on ? 'ring-1 ring-primary' : 'opacity-70 hover:opacity-100'}
                  />
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Create a new tag</p>
            <TagCreateForm onCreate={onCreate} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}