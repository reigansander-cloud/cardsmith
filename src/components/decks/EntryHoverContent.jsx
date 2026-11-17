import React from 'react';
import { hasInfluence, subtypeText, statColor, renderType } from '@/lib/folderPreview';
import { markupToHtml } from '@/lib/abilityMarkup';
import { counterpartsOf } from '@/lib/counterparts';

// Renders one face (the card itself, or one of its counterparts) — full name,
// subtype, influence, cost, stats, ability text and income extras on a light
// surface with dark text.
function face(entry, supertypes) {
  const showInfluence = hasInfluence(entry, supertypes);
  const costIcons = entry.cost_icons || [];
  const stats = entry.stats || [];
  const hasExtras = showInfluence || costIcons.length > 0 || stats.length > 0;
  const isIncome = renderType(entry, supertypes) === 'income';
  const bonusCostIcons = entry.bonus_cost_icons || [];
  const hasBonus = isIncome && (entry.bonus_mode === 'ability' ? !!entry.bonus_ability : bonusCostIcons.length > 0);

  return (
    <div className="space-y-1.5">
      <p className="font-semibold text-sm uppercase text-neutral-900">{entry.name || 'Untitled'}</p>
      <p className="text-xs italic text-neutral-500">{subtypeText(entry)}</p>
      {hasExtras && (
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          {showInfluence && (
            <span className="text-xs text-neutral-700"><span className="text-neutral-500">Influence:</span> {entry.influence || 'X'}</span>
          )}
          {costIcons.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-xs text-neutral-500">Cost:</span>
              {costIcons.map((url, i) => <img key={i} src={url} alt="" className="w-4 h-4 object-contain" />)}
            </span>
          )}
          {stats.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {stats.map((s, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: statColor(s.name, s.color), border: `1px solid ${statColor(s.name, s.color)}` }}>
                  {s.name} {s.value}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {entry.ability && (
        <div className="text-xs text-neutral-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: markupToHtml(entry.ability) }} />
      )}
      {entry.flavor_text && (
        <p className="text-[16px] italic text-neutral-500 leading-relaxed">{entry.flavor_text}</p>
      )}
      {isIncome && entry.income_symbol && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="text-xs text-neutral-500">Symbol:</span>
          <img src={entry.income_symbol} alt="" className="w-5 h-5 object-contain" />
        </div>
      )}
      {hasBonus && (
        <div className="rounded-md border border-black/10 p-1.5">
          <div className="text-[10px] text-neutral-500 mb-1">Bonus</div>
          {entry.bonus_mode === 'ability' ? (
            <div className="text-xs text-neutral-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: markupToHtml(entry.bonus_ability) }} />
          ) : (
            <div className="flex gap-0.5">
              {bonusCostIcons.map((url, i) => <img key={i} src={url} alt="" className="w-5 h-5 object-contain" />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Shared body for the entry hover popup. Each counterpart gets its own row —
// the popup is widened by the caller while a card has counterparts so the rows
// aren't crammed.
export default function EntryHoverContent({ entry, supertypes = [] }) {
  const counterparts = counterpartsOf(entry);
  return (
    <div>
      {face(entry, supertypes)}
      {counterparts.map((cp, i) => (
        <div key={i} className="mt-2 pt-2 border-t border-black/10">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">Counterpart {i + 1}</div>
          {face(cp, supertypes)}
        </div>
      ))}
    </div>
  );
}