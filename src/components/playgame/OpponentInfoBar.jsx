import React from 'react';
import { useDropZone } from '@/context/PointerDragContext';

const FLAG_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/3ec46ed99e_9ce494615_Flag1.png';
const HAND_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/24860d1845_ce30fcbd1_Card10.png';
const ENERGY_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/839feccb4f_dfe4137f3_energy2.png';
const SUPPORT_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/dc6b34353b_9bcbb8d33_Action.png';

export function ResourceBadge({ icon, value, anims, flash, animSource }) {
  return (
    <div className="relative" data-anim-source={animSource}>
      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors duration-150 ${flash === 'pos' ? 'bg-green-500' : flash === 'neg' ? 'bg-red-500' : 'bg-foreground/90'} text-background`}>
        {icon}<span className="font-bold">{value}</span>
      </span>
      {anims.map((a) => (
        <span key={a.id} className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold animate-resource-pop pointer-events-none whitespace-nowrap ${a.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
          {a.delta > 0 ? '+' : ''}{a.delta}
        </span>
      ))}
    </div>
  );
}

// Per-opponent resource bar: name, flags, support, hand count, energy, and
// graveyard. In a 3-player table one of these renders for each opponent,
// stacked vertically below the shared GlobalToolsBar.
const OpponentInfoBar = React.memo(function OpponentInfoBar({ oppName, oppFlags, oppSupport, oppEnergy, oppOther, oppHandCount, oppDiscardCount, oppIndex, onGraveyardClick, onDrop, resourceAnims, resourceFlash }) {
  const oppAnims = (res) => resourceAnims.filter((a) => a.resource === res && a.playerIndex === oppIndex);
  const oppFlash = (res) => resourceFlash[`${oppIndex}_${res}`];
  const graveyardDrop = useDropZone((payload) => onDrop(payload, { zone: 'discard', player_index: oppIndex }));
  return (
    <div className="flex items-center gap-2 px-4 py-1 border-b border-border/50 bg-card/30 text-xs flex-shrink-0">
      <span className="font-medium text-foreground">{oppName}</span>
      <span className="text-muted-foreground/30">|</span>
      <ResourceBadge icon={<img src={FLAG_ICON_URL} className="w-4 h-5 object-cover rounded" />} value={oppFlags} anims={oppAnims('flags')} flash={oppFlash('flags')} />
      <ResourceBadge icon={<img src={SUPPORT_ICON_URL} className="w-3 h-3 object-contain" />} value={oppSupport} anims={oppAnims('support')} flash={oppFlash('support')} />
      <ResourceBadge icon={<img src={HAND_ICON_URL} className="w-4 h-5 object-cover rounded" />} value={oppHandCount} anims={oppAnims('hand')} flash={oppFlash('hand')} animSource={`hand-${oppIndex}`} />
      <ResourceBadge icon={<img src={ENERGY_ICON_URL} className="w-3 h-3 object-contain" />} value={oppEnergy} anims={oppAnims('energy')} flash={oppFlash('energy')} />
      <ResourceBadge icon={<span className="font-bold text-sm leading-none">?</span>} value={oppOther || 0} anims={oppAnims('other')} flash={oppFlash('other')} />
      <button data-anim-source={`graveyard-${oppIndex}`} onClick={onGraveyardClick} {...graveyardDrop} className={`relative px-2 py-0.5 rounded text-xs transition-colors duration-150 ${oppFlash('discard') === 'pos' ? 'bg-green-500' : oppFlash('discard') === 'neg' ? 'bg-red-500' : 'bg-muted/50 hover:bg-muted'}`}>Graveyard ({oppDiscardCount}){oppAnims('discard').map((a) => (<span key={a.id} className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold animate-resource-pop pointer-events-none whitespace-nowrap ${a.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>{a.delta > 0 ? '+' : ''}{a.delta}</span>))}</button>
    </div>
  );
});

export default OpponentInfoBar;