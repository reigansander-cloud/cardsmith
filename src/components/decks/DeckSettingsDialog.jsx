import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, User, Layers } from 'lucide-react';

const DEFAULTS = {
  regular: { fabled: 1, normal: 3, basic: 6 },
  battlefield: { fabled: 1, normal: 2, basic: 4 },
};

// Global deck settings dialog. Lets the builder adjust the max-copy limits
// per card type, split into Regular Cards and Battlefields sections.
// Values are stored in a single DeckSetting record and apply to all decks.
export default function DeckSettingsDialog({ open, onOpenChange, copyLimits, onSave }) {
  const [limits, setLimits] = useState({
    regular: { ...DEFAULTS.regular, ...(copyLimits?.regular || {}) },
    battlefield: { ...DEFAULTS.battlefield, ...(copyLimits?.battlefield || {}) },
  });

  useEffect(() => {
    if (open) {
      setLimits({
        regular: { ...DEFAULTS.regular, ...(copyLimits?.regular || {}) },
        battlefield: { ...DEFAULTS.battlefield, ...(copyLimits?.battlefield || {}) },
      });
    }
  }, [copyLimits, open]);

  const handleSave = () => {
    const clean = (sec) => ({
      fabled: Math.max(1, Number(limits[sec].fabled) || 1),
      normal: Math.max(1, Number(limits[sec].normal) || 1),
      basic: Math.max(1, Number(limits[sec].basic) || 1),
    });
    onSave({ regular: clean('regular'), battlefield: clean('battlefield') });
    onOpenChange(false);
  };

  const sections = [
    { key: 'regular', label: 'Regular Cards', rows: [
      { key: 'fabled', label: 'Fabled', icon: Crown, color: 'text-amber-500' },
      { key: 'normal', label: 'Normal', icon: Layers, color: 'text-muted-foreground' },
      { key: 'basic', label: 'Basic', icon: User, color: 'text-blue-500' },
    ]},
    { key: 'battlefield', label: 'Battlefields', rows: [
      { key: 'fabled', label: 'Fabled', icon: Crown, color: 'text-amber-500' },
      { key: 'normal', label: 'Normal', icon: Layers, color: 'text-muted-foreground' },
      { key: 'basic', label: 'Basic', icon: User, color: 'text-blue-500' },
    ]},
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deck Settings</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">Maximum copies allowed per card type. Applies to all decks.</p>
        <div className="space-y-4 py-1">
          {sections.map((sec) => (
            <div key={sec.key} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">{sec.label}</div>
              {sec.rows.map((r) => {
                const Icon = r.icon;
                return (
                  <div key={r.key} className="flex items-center gap-2">
                    <Icon size={16} className={r.color} />
                    <span className="text-sm flex-1">{r.label} copy limit</span>
                    <Input
                      type="number"
                      min={1}
                      value={limits[sec.key][r.key]}
                      onChange={(e) => setLimits((p) => ({ ...p, [sec.key]: { ...p[sec.key], [r.key]: e.target.value } }))}
                      className="w-20 h-8 text-center"
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}