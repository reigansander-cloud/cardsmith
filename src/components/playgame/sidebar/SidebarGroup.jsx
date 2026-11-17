import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCw, ArrowDown } from 'lucide-react';

const TOKEN_TYPES = [
  { key: 'support', label: 'Sup', color: '#ffffff' },
  { key: 'charge', label: 'Chg', color: '#ca8a04' },
  { key: 'damage', label: 'Dmg', color: '#dc2626' },
  { key: 'other', label: 'Oth', color: '#28a745' },
  { key: 'armor', label: 'Arm', color: '#2563eb' },
  { key: 'duration', label: 'Dur', color: '#7c3aed' },
];

// Group sidebar — applies flip, exhaust, and token changes to all selected
// cards. Exhaust toggles all to exhausted if any is readied, otherwise readies
// all. Token changes apply to all but cannot reduce below 0. Clear All resets
// all tokens; Clear Sup resets only support tokens.
export default function SidebarGroup({ cardIds, onGroupExhaust, onGroupFlip, onGroupTokenChange, onGroupClearTokens, onGroupClearSupport }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h4 className="text-base font-bold text-foreground">Group ({cardIds.length} cards)</h4>
      <div className="flex gap-2">
        <Button onClick={() => onGroupExhaust(cardIds)} variant="outline" size="sm" className="text-sm h-9">
          <RotateCw size={16} className="mr-1" /> Exhaust All
        </Button>
        <Button onClick={() => onGroupFlip(cardIds)} variant="outline" size="sm" className="text-sm h-9">
          <ArrowDown size={16} className="mr-1" /> Flip All
        </Button>
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-semibold text-muted-foreground">Tokens (apply to all)</h4>
          <div className="flex gap-1">
            <button onClick={() => onGroupClearSupport(cardIds)} className="px-3 py-1 text-xs rounded bg-muted/50 text-muted-foreground hover:bg-muted">Clear Sup</button>
            <button onClick={() => onGroupClearTokens(cardIds)} className="px-3 py-1 text-xs rounded bg-destructive/10 text-destructive hover:bg-destructive/20">Clear All</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-2">
          {TOKEN_TYPES.map((t, i) => (
            <div key={t.key} className={`flex items-center gap-2 px-1 ${i % 2 === 0 ? 'border-r border-border/30' : ''}`}>
              <span className="text-sm w-10" style={{ color: t.color === '#ffffff' ? '#ccc' : t.color }}>{t.label}</span>
              <button onClick={() => onGroupTokenChange(cardIds, t.key, -1)} className="w-9 h-9 rounded bg-destructive/10 text-destructive text-sm flex items-center justify-center">−</button>
              <button onClick={() => onGroupTokenChange(cardIds, t.key, 1)} className="w-9 h-9 rounded bg-primary/10 text-primary text-sm flex items-center justify-center">+</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}