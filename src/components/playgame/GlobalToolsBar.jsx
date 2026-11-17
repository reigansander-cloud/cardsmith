import React from 'react';
import { Wrench, Shuffle, Plus, Eye } from 'lucide-react';
import { useDropZone } from '@/context/PointerDragContext';
import { ResourceBadge } from './OpponentInfoBar';

const INCOME_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/b1aa77c882_7e41f4dbc_paper.png';
const DICE_FIRE_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/0e73905ee3_ec1db7f8e_dice-fire.png';
const FLAG_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/3ec46ed99e_9ce494615_Flag1.png';
const HAND_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/24860d1845_ce30fcbd1_Card10.png';
const ENERGY_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/839feccb4f_dfe4137f3_energy2.png';

// Shared tools strip shown once at the top of the table. In a 2-player game
// the single opponent's resources/hand/graveyard are rendered inline so the
// top bar is the only bar. In 3-player the opponent info is shown per-opponent
// below this bar instead (oppName is undefined).
const GlobalToolsBar = React.memo(function GlobalToolsBar({ round, meEndRoundPressed, adjustInfluence, onToolsClick, toolToggles, onIncomeClick, onDiceClick, onRandomClick, onWideViewClick, wideViewOn, onLeaveGame, oppName, oppFlags, oppSupport, oppEnergy, oppOther, oppHandCount, oppDiscardCount, oppIndex, onGraveyardClick, onDrop, resourceAnims, resourceFlash }) {
  const hasOpp = !!oppName;
  const oppAnims = (res) => (resourceAnims || []).filter((a) => a.resource === res && a.playerIndex === oppIndex);
  const oppFlash = (res) => (resourceFlash || {})[`${oppIndex}_${res}`];
  const graveyardDrop = useDropZone((payload) => onDrop?.(payload, { zone: 'discard', player_index: oppIndex }));
  return (
    <div className="flex items-center gap-2 px-4 py-1 border-b border-border bg-card/50 text-xs flex-shrink-0">
      <span className="text-muted-foreground">Round {round}</span>
      {meEndRoundPressed && <span className="text-primary">✓ End Round</span>}
      {hasOpp && (
        <>
          <span className="text-muted-foreground/30">|</span>
          <span className="font-medium text-foreground">{oppName}</span>
          <span className="text-muted-foreground/30">|</span>
          <ResourceBadge icon={<img src={FLAG_ICON_URL} className="w-4 h-5 object-cover rounded" />} value={oppFlags} anims={oppAnims('flags')} flash={oppFlash('flags')} />
          <ResourceBadge icon={<Plus size={12} className="text-background" />} value={oppSupport} anims={oppAnims('support')} flash={oppFlash('support')} />
          <ResourceBadge icon={<img src={HAND_ICON_URL} className="w-4 h-5 object-cover rounded" />} value={oppHandCount} anims={oppAnims('hand')} flash={oppFlash('hand')} animSource={`hand-${oppIndex}`} />
          <ResourceBadge icon={<img src={ENERGY_ICON_URL} className="w-3 h-3 object-contain" />} value={oppEnergy} anims={oppAnims('energy')} flash={oppFlash('energy')} />
          <ResourceBadge icon={<span className="font-bold text-sm leading-none">?</span>} value={oppOther || 0} anims={oppAnims('other')} flash={oppFlash('other')} />
          <button data-anim-source={`graveyard-${oppIndex}`} onClick={onGraveyardClick} {...graveyardDrop} className={`relative px-2 py-0.5 rounded text-xs transition-colors duration-150 ${oppFlash('discard') === 'pos' ? 'bg-green-500' : oppFlash('discard') === 'neg' ? 'bg-red-500' : 'bg-muted/50 hover:bg-muted'}`}>Graveyard ({oppDiscardCount}){oppAnims('discard').map((a) => (<span key={a.id} className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold animate-resource-pop pointer-events-none whitespace-nowrap ${a.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>{a.delta > 0 ? '+' : ''}{a.delta}</span>))}</button>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        {toolToggles?.income && <button onClick={onIncomeClick} className="p-1 rounded bg-muted/50 hover:bg-muted transition-colors duration-150"><img src={INCOME_ICON_URL} className="w-5 h-5 object-contain" alt="Income" /></button>}
        {toolToggles?.dice && <button onClick={onDiceClick} className="p-1 rounded bg-muted/50 hover:bg-muted transition-colors duration-150"><img src={DICE_FIRE_URL} className="w-5 h-5 object-contain" alt="Dice" /></button>}
        {toolToggles?.random && <button onClick={onRandomClick} className="p-1 rounded bg-muted/50 hover:bg-muted transition-colors duration-150"><Shuffle size={16} /></button>}
        {toolToggles?.wideView && <button onClick={onWideViewClick} className={`p-1 rounded transition-colors duration-150 ${wideViewOn ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`} title="Wide View"><Eye size={16} /></button>}
        <button onClick={onToolsClick} className={`p-1 rounded ${adjustInfluence ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`} title="Tools"><Wrench size={14} /></button>
        <button onClick={onLeaveGame} className="px-2 py-0.5 rounded bg-destructive/10 text-destructive text-xs hover:bg-destructive/20">Leave</button>
      </div>
    </div>
  );
});

export default GlobalToolsBar;