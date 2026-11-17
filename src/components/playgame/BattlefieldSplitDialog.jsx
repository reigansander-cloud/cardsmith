import React, { useState } from 'react';
import MiniEntry from './MiniEntry';
import { Button } from '@/components/ui/button';

// Shown at game start so each player can split their battlefield deck into two
// piles. Selection is tracked by index (not entry id) so duplicate copies of
// the same battlefield are chosen individually.
//
// pileLabels names the two piles. In a 2-player game these are "Area 1" /
// "Area 2" (both piles are seen by the same single opponent). In a 3-player
// game each pile is labeled with the name of the opponent who will see (draw
// from) that pile.
export default function BattlefieldSplitDialog({ battlefieldIds, entries, supertypes, onConfirm, pileLabels = ['Area 1', 'Area 2'] }) {
  const [selected, setSelected] = useState(() => new Set());
  const toggle = (idx) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    return next;
  });
  const pile0 = battlefieldIds.filter((_, i) => selected.has(i));
  const pile1 = battlefieldIds.filter((_, i) => !selected.has(i));
  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-40 p-4">
      <div className="bg-card border border-border rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold text-foreground mb-2">Split Your Battlefields</h3>
        <p className="text-sm text-muted-foreground mb-4">Tap the battlefields <span className="text-primary font-semibold">{pileLabels[0]}</span> will see. The rest go to <span className="font-semibold">{pileLabels[1]}</span>. Each copy is chosen individually.</p>
        {battlefieldIds.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No battlefields in your deck — your areas will use the default Battlefield 12.</p>
        ) : (
          <div className="flex gap-3 flex-wrap justify-center mb-4">
            {battlefieldIds.map((id, i) => (
              <button key={i} onClick={() => toggle(i)} className={`rounded-lg transition-transform hover:scale-105 ${selected.has(i) ? 'ring-4 ring-primary' : 'opacity-70 hover:opacity-100'}`}>
                <MiniEntry entry={entries[id]} supertypes={supertypes} targetWidth={140} />
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <div className="text-xs text-muted-foreground">
            <span className="text-primary font-semibold">{pileLabels[0]}: {pile0.length}</span> &nbsp;·&nbsp; <span className="font-semibold">{pileLabels[1]}: {pile1.length}</span>
          </div>
          <Button onClick={() => onConfirm(pile0, pile1)}>Confirm</Button>
        </div>
      </div>
    </div>
  );
}