import React from 'react';
import MiniEntry from '../MiniEntry';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

const symbolType = (url) => {
  if (!url) return null;
  if (url.includes('rock')) return 'rock';
  if (url.includes('paper')) return 'paper';
  if (url.includes('scissors')) return 'scissors';
  return null;
};

const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

// Shows both players' revealed income cards — opponent first, then you.
// A strong green glow marks the winning card (rock-paper-scissors).
export default function SidebarIncome({ game, state, entries, supertypes, onAckIncome, myPlayerIndex }) {
  const revealed = state.revealed_income || [];
  const oppIndex = myPlayerIndex === 0 ? 1 : 0;
  const oppIncome = revealed.find((r) => r.player_index === oppIndex);
  const myIncome = revealed.find((r) => r.player_index === myPlayerIndex);

  const oppSym = oppIncome ? symbolType(entries[oppIncome.entry_id]?.income_symbol) : null;
  const mySym = myIncome ? symbolType(entries[myIncome.entry_id]?.income_symbol) : null;
  let winner = null;
  if (oppSym && mySym && oppSym !== mySym) winner = BEATS[mySym] === oppSym ? 'me' : 'opp';

  const oppBorder = winner === 'opp' ? { border: '4px solid #22c55e', borderRadius: 6 } : winner === 'me' ? { border: '4px solid #ef4444', borderRadius: 6 } : undefined;
  const myBorder = winner === 'me' ? { border: '4px solid #22c55e', borderRadius: 6 } : winner === 'opp' ? { border: '4px solid #ef4444', borderRadius: 6 } : undefined;

  return (
    <div className="flex flex-col gap-5 p-5">
      <h4 className="text-xl font-bold text-foreground">Income Revealed</h4>
      {oppIncome && entries[oppIncome.entry_id] && (
        <div className="flex justify-center" style={oppBorder}>
          <MiniEntry entry={entries[oppIncome.entry_id]} supertypes={supertypes} targetWidth={190} />
        </div>
      )}
      {myIncome && entries[myIncome.entry_id] && (
        <div className="flex justify-center" style={myBorder}>
          <MiniEntry entry={entries[myIncome.entry_id]} supertypes={supertypes} targetWidth={190} />
        </div>
      )}
      <Button onClick={onAckIncome} size="lg" className="w-full text-base">
        <Check size={18} className="mr-2" /> Acknowledge
      </Button>
    </div>
  );
}