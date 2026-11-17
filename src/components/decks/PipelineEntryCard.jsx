import React from 'react';
import { Plus, Minus, Crown } from 'lucide-react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { hasInfluence, subtypeText, statColor, renderType } from '@/lib/folderPreview';
import RichHighlighted from './RichHighlighted';
import EntryHoverContent from './EntryHoverContent';

// A deck entry shown inside a pipeline column of the Deck Pipelines dialog.
// Renders the same visual as the deck manager search cards (influence or
// income icon, name, subtype, cost, ability, stats) with a hover popup, plus
// copy controls (count, or a crown if Fabled) and +/- buttons.
export default function PipelineEntryCard({ entry, copies, onIncrement, onDecrement, onAdd, supertypes = [], folderColor = '', highlight = '' }) {
  const showInfluence = hasInfluence(entry, supertypes);
  const isIncome = renderType(entry, supertypes) === 'income';
  const costIcons = entry.cost_icons || [];
  const bg = folderColor || '#fafaf7';
  const fabled = !!entry.fabled;

  return (
    <HoverCard openDelay={250} closeDelay={150}>
      <HoverCardTrigger asChild>
        <div className="rounded-lg border border-black/10 p-2 hover:border-primary transition-colors cursor-grab active:cursor-grabbing" style={{ background: bg }}>
          <div className="flex gap-2">
            {(showInfluence || (isIncome && entry.income_symbol)) && (
              <div className="self-center flex-shrink-0 leading-none px-0.5 flex items-center justify-center">
                {isIncome && entry.income_symbol ? (
                  <img src={entry.income_symbol} alt="" className="w-7 h-7 object-contain" />
                ) : (
                  <span className="text-xl font-bold text-neutral-900/80">{entry.influence || 'X'}</span>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="font-semibold text-[11px] text-neutral-900 flex-shrink-0 min-w-0 truncate uppercase">
                  <RichHighlighted content={entry.name || 'Untitled'} highlight={highlight} />
                </span>
                <span className="text-[9px] italic text-neutral-500 flex-1 min-w-0 truncate">{subtypeText(entry)}</span>
              </div>
              {costIcons.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {costIcons.map((url, i) => <img key={i} src={url} alt="" className="w-3.5 h-3.5 object-contain" />)}
                </div>
              )}
              {entry.ability && (
                <div className="text-[10px] text-neutral-700 mt-0.5 line-clamp-2">
                  <RichHighlighted content={entry.ability} highlight={highlight} />
                </div>
              )}
              {(entry.stats || []).length > 0 && (
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {entry.stats.map((s, i) => (
                    <span key={i} className="text-[8px] px-1 py-0.5 rounded" style={{ color: statColor(s.name, s.color), border: `1px solid ${statColor(s.name, s.color)}` }}>
                      {s.name} {s.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-1 mt-1 pt-1 border-t border-black/5">
            {copies === 0 && onAdd ? (
              <button onClick={onAdd} className="w-full h-6 rounded flex items-center justify-center gap-1 border border-black/10 hover:bg-black/5 text-[10px] font-medium text-neutral-700" title="Add to deck">
                <Plus size={11} /> Add
              </button>
            ) : (
              <>
                <button onClick={onDecrement} className="w-5 h-5 rounded flex items-center justify-center border border-black/10 hover:bg-black/5" title="Remove copy">
                  <Minus size={11} />
                </button>
                <span className="text-[11px] tabular-nums w-4 text-center text-neutral-700">{copies}</span>
                {fabled ? (
                  <span className="w-5 h-5 flex items-center justify-center text-amber-500" title="Fabled — limited to 1 copy">
                    <Crown size={12} />
                  </span>
                ) : (
                  <button onClick={onIncrement} className="w-5 h-5 rounded flex items-center justify-center border border-black/10 hover:bg-black/5" title="Add copy">
                    <Plus size={11} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={6} className="w-80 max-h-[60vh] overflow-y-auto bg-white text-neutral-900 border-black/10">
        <EntryHoverContent entry={entry} supertypes={supertypes} />
      </HoverCardContent>
    </HoverCard>
  );
}