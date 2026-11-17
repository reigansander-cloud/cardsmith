import React, { useRef, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { hasInfluence, subtypeText, statColor, renderType } from '@/lib/folderPreview';
import RichHighlighted from './RichHighlighted';
import EntryHoverContent from './EntryHoverContent';
import { hasCounterparts } from '@/lib/counterparts';
import DeckEntryEditDialog from './DeckEntryEditDialog';

// Read-only entry shown in the deck manager search results. Clicking adds a
// copy to the deck (no editor mode). Matched search text is highlighted.
// Uses a light background with dark text (matching the folder entry cards).
// When the name or ability is truncated ("…"), hovering pops up a tooltip with
// the full name, subtype, and ability text.
export default function DeckEntryCard({ entry, highlight, inDeck, copies = 0, maxCopies = 3, onAdd, supertypes = [], folderColor = '', onEntryChange, onEntryDeleted }) {
  const showInfluence = hasInfluence(entry, supertypes);
  const isIncome = renderType(entry, supertypes) === 'income';
  const costIcons = entry.cost_icons || [];
  const bg = folderColor || '#fafaf7';
  const rootRef = useRef(null);
  const [truncated, setTruncated] = useState(false);
  const [flash, setFlash] = useState(null); // null | 'ok' | 'fail'
  const [editOpen, setEditOpen] = useState(false);
  const canAdd = copies < maxCopies;

  const checkTruncation = () => {
    const el = rootRef.current;
    if (!el) return;
    const n = el.querySelector('[data-name]');
    const s = el.querySelector('[data-subtype]');
    const a = el.querySelector('[data-ability]');
    let t = false;
    if (n && n.scrollWidth > n.clientWidth + 1) t = true;
    if (s && s.scrollWidth > s.clientWidth + 1) t = true;
    if (a && a.scrollHeight > a.clientHeight + 1) t = true;
    setTruncated(t);
  };

  const handleClick = () => {
    if (canAdd) {
      setFlash('ok');
      onAdd();
    } else {
      setFlash('fail');
    }
    setTimeout(() => setFlash(null), 350);
  };

  return (
    <HoverCard openDelay={250} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          ref={rootRef}
          onMouseEnter={checkTruncation}
          onClick={handleClick}
          style={{ background: flash === 'fail' ? '#fee2e2' : bg }}
          className={`group relative text-left rounded-lg border border-black/10 p-3 hover:border-primary transition-all duration-150 ${inDeck ? 'opacity-50' : ''} ${flash === 'ok' ? 'scale-95 ring-2 ring-primary' : ''} ${flash === 'fail' ? 'ring-2 ring-red-500' : ''}`}
        >
          {inDeck && copies > 0 && (
            <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary text-primary-foreground z-10">
              x{copies}
            </span>
          )}
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {inDeck && (
              <span className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }} title="In deck">
                <Check size={14} />
              </span>
            )}
            <div
              role="button"
              onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-black/10 cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.08)', color: '#404040' }}
              title="Edit entry"
            >
              <Pencil size={13} />
            </div>
          </div>
          <div className="flex gap-3">
            {(showInfluence || (isIncome && entry.income_symbol)) && (
              <div className="self-center flex-shrink-0 leading-none px-2 flex items-center justify-center">
                {isIncome && entry.income_symbol ? (
                  <img src={entry.income_symbol} alt="" className="w-9 h-9 object-contain" />
                ) : (
                  <span className="text-3xl font-bold text-neutral-900/80">{entry.influence || 'X'}</span>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span data-name className="font-semibold text-sm text-neutral-900 flex-shrink-0 max-w-full min-w-0 truncate uppercase">
                  <RichHighlighted content={entry.name || 'Untitled'} highlight={highlight} />
                </span>
                <span data-subtype className="text-xs italic text-neutral-500 flex-1 min-w-0 truncate">
                  <RichHighlighted content={subtypeText(entry)} highlight={highlight} />
                </span>
              </div>
              {costIcons.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {costIcons.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-5 h-5 object-contain" />
                  ))}
                </div>
              )}
              {entry.ability && (
                <div data-ability className="text-xs text-neutral-700 mt-1 line-clamp-3">
                  <RichHighlighted content={entry.ability} highlight={highlight} />
                </div>
              )}
              {(entry.stats || []).length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {entry.stats.map((s, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: statColor(s.name, s.color), border: `1px solid ${statColor(s.name, s.color)}` }}>
                      {s.name} {s.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={6} className={`${hasCounterparts(entry) ? 'w-[26rem]' : 'w-80'} max-h-[60vh] overflow-y-auto bg-white text-neutral-900 border-black/10`}>
        <EntryHoverContent entry={entry} supertypes={supertypes} />
      </HoverCardContent>
      <DeckEntryEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        entry={entry}
        supertypes={supertypes}
        folderColor={folderColor}
        onEntryChange={onEntryChange}
        onEntryDeleted={onEntryDeleted}
      />
    </HoverCard>
  );
}