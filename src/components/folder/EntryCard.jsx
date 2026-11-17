import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Trash2, Flag, Lock, Copy, Layers } from 'lucide-react';
import { hasInfluence, statColor, statLabel, supertypeLabel, renderType } from '@/lib/folderPreview';
import EntryEditFields from './EntryEditFields';
import EntryHoverContent from '@/components/decks/EntryHoverContent';
import { counterpartsOf, newCounterpart } from '@/lib/counterparts';
import { markupToHtml } from '@/lib/abilityMarkup';
import RichHighlighted from '@/components/decks/RichHighlighted';
import { findSimilarEntriesGlobal, hasNameMatchGlobal } from '@/lib/entrySimilarity';
import EntryFlagCommentsPopup from './EntryFlagCommentsPopup';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// A single entry. Read-only until clicked (when editable), then all fields
// become editable. Edit mode mirrors the read-only layout; only the cost bar
// differs (it becomes an icon picker).
//
// An entry may also carry counterpart faces — alternative versions of the card
// stored on the entry itself. They render as extra sections in the same entry,
// each with the full set of entry options.
export default function EntryCard({ entry, folderStats, icons, keywords, capitalized, iconWords, supertypes = [], folderColor = '', selected, editable = true, onSelect, onUpdate, onDelete, onCopy, onToggleReview, lockedBy, dimmed = false, flaggedByName = '', allEntries, allEntryNames, onJumpEntry, unusedNames, onConsumeUnusedName, highlight = '' }) {
  const showInfluence = hasInfluence(entry, supertypes);
  const rt = renderType(entry, supertypes);
  const isIncome = rt === 'income';
  const flagged = !!entry.needs_review;
  const [similarEntries, setSimilarEntries] = useState([]);
  const [showSimilarPopup, setShowSimilarPopup] = useState(false);
  const [showNamesPopup, setShowNamesPopup] = useState(false);
  const [showCommentsPopup, setShowCommentsPopup] = useState(false);
  const namesAvailable = (unusedNames || []).length > 0;

  // Debounced duplicate scan: names checked across all folders (allEntryNames,
  // fetched once via GetAllEntryNames), abilities checked within this folder.
  useEffect(() => {
    if (!selected || !editable) { setSimilarEntries([]); return; }
    const t = setTimeout(() => setSimilarEntries(findSimilarEntriesGlobal(entry, allEntries, allEntryNames)), 300);
    return () => clearTimeout(t);
  }, [entry.name, entry.ability, allEntries, allEntryNames, selected, editable]);

  const nameMatch = hasNameMatchGlobal(entry, allEntryNames, allEntries);
  const set = (fields) => onUpdate(entry.id, fields);
  const bg = folderColor || '#fafaf7';

  // Counterparts are extra faces stored on the entry itself; every edit
  // replaces the whole array, which is what the entry save expects.
  const counterparts = counterpartsOf(entry);
  const addCounterpart = () => set({ counterparts: [...counterparts, newCounterpart(entry)] });
  const updateCounterpart = (i, fields) =>
    set({ counterparts: counterparts.map((c, idx) => (idx === i ? { ...c, ...fields } : c)) });
  const removeCounterpart = (i) =>
    set({ counterparts: counterparts.filter((_, idx) => idx !== i) });
  // Shared editor props — identical field set for the entry and each counterpart.
  const editCtx = { icons, folderStats, keywords, capitalized, iconWords, supertypes };

  // Unused-name picker, offered only on the main entry's name field.
  const namesSlot = namesAvailable ? (
    <div className="relative flex-shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setShowNamesPopup((v) => !v); }}
        className="w-8 h-8 rounded border border-black/10 bg-black/5 flex items-center justify-center text-sm font-bold text-neutral-700 hover:border-primary hover:bg-primary/10"
        title="Pick an unused name"
      >
        N
      </button>
      {showNamesPopup && (
        <>
          <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setShowNamesPopup(false); }} />
          <div className="absolute left-0 top-9 z-30 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg p-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Unused names — click to use</div>
            {(unusedNames || []).map((n) => (
              <button
                key={n.id}
                onClick={(e) => { e.stopPropagation(); setShowNamesPopup(false); onConsumeUnusedName?.(n, entry.id); }}
                className="block text-left w-full rounded hover:bg-muted/50 px-1.5 py-1 text-sm text-foreground whitespace-nowrap"
              >
                {n.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  ) : null;

  const costIcons = entry.cost_icons || [];

  // READ-ONLY MODE
  if (!selected || !editable) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); if (editable && !lockedBy) onSelect?.(entry); }}
        style={{ background: bg }}
        className={`group relative rounded-lg border p-3 transition-colors ${flagged ? 'border-primary' : 'border-black/10'} ${lockedBy ? 'border-amber-300 cursor-not-allowed' : editable ? 'cursor-pointer hover:border-primary' : ''} ${dimmed ? 'opacity-50' : ''}`}
      >
        {lockedBy && (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[10px] z-10">
            <Lock size={10} /> {lockedBy.userName} editing
          </div>
        )}
        {editable && (
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={(e) => e.stopPropagation()}>
            {onCopy && (
              <button onClick={() => onCopy(entry)} className="w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:bg-black/5" title="Duplicate">
                <Copy size={14} />
              </button>
            )}
            <button onClick={() => onToggleReview?.(entry)} className={`w-6 h-6 rounded flex items-center justify-center hover:bg-black/5 ${flagged ? 'text-primary' : 'text-neutral-500'}`} title={flagged ? 'Remove review flag' : 'Flag for review'}>
              <Flag size={14} />
            </button>
            <button onClick={() => onDelete?.(entry.id)} className="w-6 h-6 rounded flex items-center justify-center text-destructive hover:bg-black/5" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        )}
        <div className="relative">
          {flagged && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Flag size={72} className="text-primary/10" />
            </div>
          )}
          <div className="flex gap-3">
            {showInfluence && (
              <div className="text-3xl font-bold text-neutral-900/80 self-center flex-shrink-0 leading-none px-2">
                {entry.influence || 'X'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-sm text-neutral-900 truncate uppercase">{highlight ? <RichHighlighted content={entry.name || 'Untitled'} highlight={highlight} /> : (entry.name || 'Untitled')}</span>
                <span className="text-xs italic text-neutral-500 truncate">{highlight ? <RichHighlighted content={`${supertypeLabel(entry)}${entry.subtype ? ` - ${entry.subtype}` : ''}`} highlight={highlight} /> : <>{supertypeLabel(entry)}{entry.subtype ? ` - ${entry.subtype}` : ''}</>}</span>
              </div>
              {costIcons.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {costIcons.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt="" className="w-5 h-5 object-contain" />
                      {entry.cost_question?.[i] && (
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center leading-none z-10" style={{ width: 23, height: 23, fontFamily: 'CaesarDressing, cursive', fontSize: 22, color: '#000' }}>?</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {entry.ability && (
                <div className="text-xs text-neutral-700 mt-1">
                  {highlight ? <RichHighlighted content={entry.ability} highlight={highlight} /> : <span dangerouslySetInnerHTML={{ __html: markupToHtml(entry.ability) }} />}
                </div>
              )}
              {entry.flavor_text && (
                <div className="text-[10px] italic text-neutral-500 mt-0.5">{entry.flavor_text}</div>
              )}
              {isIncome && entry.income_symbol && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-neutral-500">Symbol:</span>
                  <img src={entry.income_symbol} alt="" className="w-5 h-5 object-contain" />
                </div>
              )}
              {isIncome && (entry.bonus_mode === 'ability' ? entry.bonus_ability : (entry.bonus_cost_icons || []).length > 0) && (
                <div className="mt-1.5 rounded-md border border-black/10 p-1.5">
                  <div className="text-[10px] text-neutral-500 mb-1">Bonus</div>
                  {entry.bonus_mode === 'ability' ? (
                    <div className="text-xs text-neutral-700">
                      {highlight ? <RichHighlighted content={entry.bonus_ability} highlight={highlight} /> : <span dangerouslySetInnerHTML={{ __html: markupToHtml(entry.bonus_ability) }} />}
                    </div>
                  ) : (
                    <div className="flex gap-0.5">
                      {(entry.bonus_cost_icons || []).map((url, i) => (
                        <img key={i} src={url} alt="" className="w-5 h-5 object-contain" />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {(entry.stats || []).length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {entry.stats.map((s, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: statColor(s.name, s.color), border: `1px solid ${statColor(s.name, s.color)}` }}>
                      {statLabel(s.name)} {s.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {flaggedByName && (
          <div className="absolute bottom-1.5 right-1.5 text-[10px] italic text-neutral-500">
            Flagged by {flaggedByName}
          </div>
        )}
        {counterparts.length > 0 && (
          <div className="mt-3 space-y-2">
            {counterparts.map((cp, i) => (
              <div key={i} className="rounded-lg border border-black/10 bg-black/[0.02] p-3">
                <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">Counterpart {i + 1}</div>
                <EntryHoverContent entry={cp} supertypes={supertypes} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // EDIT MODE — mirrors the read-only layout; only the cost bar differs.
  return (
    <div className="rounded-lg border-2 border-primary p-3 relative" style={{ background: bg }} onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-2 flex-shrink-0 w-16 px-1">
          {showInfluence && (
            <Input
              value={entry.influence || ''}
              onChange={(e) => set({ influence: e.target.value })}
              placeholder="X"
              className="h-12 w-16 text-3xl font-bold text-center p-0 text-neutral-900 placeholder:text-neutral-400"
            />
          )}
          <div className="flex gap-1">
            {onCopy && (
              <button onClick={() => onCopy(entry)} className="w-7 h-7 rounded flex items-center justify-center text-neutral-500 hover:bg-black/5" title="Duplicate">
                <Copy size={14} />
              </button>
            )}
            <button onClick={() => onDelete?.(entry.id)} className="w-7 h-7 rounded flex items-center justify-center text-destructive hover:bg-black/5" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="flex gap-1 pt-1 border-t border-black/10 w-full justify-center">
            <div className="relative">
              <button
                onClick={() => onToggleReview?.(entry)}
                onContextMenu={flagged ? (e) => { e.preventDefault(); e.stopPropagation(); setShowCommentsPopup((v) => !v); } : undefined}
                className={`w-7 h-7 rounded flex items-center justify-center ${flagged ? 'text-primary bg-primary/10' : 'text-neutral-500 hover:bg-black/5'}`}
                title={flagged ? 'Unflag (right-click for comments)' : 'Flag for review'}
              >
                <Flag size={14} />
              </button>
              {showCommentsPopup && flagged && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowCommentsPopup(false)} onContextMenu={(e) => { e.preventDefault(); setShowCommentsPopup(false); }} />
                  <div className="absolute left-full top-0 ml-2 z-30">
                    <EntryFlagCommentsPopup entry={entry} onClose={() => setShowCommentsPopup(false)} />
                  </div>
                </>
              )}
            </div>
            <button onClick={addCounterpart} className="w-7 h-7 rounded flex items-center justify-center text-neutral-500 hover:bg-black/5" title="Add counterpart card">
              <Layers size={14} />
            </button>
          </div>
          {similarEntries.length > 0 && (
            <div className="relative pt-1 border-t border-black/10 w-full flex justify-center">
              <button
                onClick={() => setShowSimilarPopup((v) => !v)}
                className="w-full aspect-square rounded border border-red-600 text-red-600 hover:bg-black/5 flex items-center justify-center font-bold"
                title="Name or ability matches other entries in this folder"
              >
                <span className="text-2xl leading-none">!</span>
              </button>
              {showSimilarPopup && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowSimilarPopup(false)} />
                  <div className="absolute left-full top-0 ml-2 z-30 w-64 max-h-[80vh] overflow-y-auto rounded-md border border-border bg-popover shadow-lg p-2 space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Similar entries — click to jump</div>
                    {similarEntries.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { onJumpEntry?.(s.folder_id, s.id); setShowSimilarPopup(false); }}
                        className="block text-left w-full rounded hover:bg-muted/50 p-1 border-b border-border/50 last:border-0 pb-1.5 last:pb-0"
                      >
                        <div className="font-semibold text-foreground uppercase">{s.name || 'Untitled'}</div>
                        <div className="text-[10px] italic text-muted-foreground">{s.folderName || `${cap(s.supertype)}${s.subtype ? ` - ${s.subtype}` : ''}`}</div>
                        {s.ability && <div className="text-[10px] text-muted-foreground mt-0.5" dangerouslySetInnerHTML={{ __html: markupToHtml(s.ability) }} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <EntryEditFields entry={entry} set={set} {...editCtx} nameMatch={nameMatch} namesSlot={namesSlot} />
      </div>

      {counterparts.length > 0 && (
        <div className="mt-3 space-y-2">
          {counterparts.map((cp, i) => (
            <div key={i} className="rounded-lg border border-black/10 bg-white/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">Counterpart {i + 1}</span>
                <button onClick={() => removeCounterpart(i)} className="w-6 h-6 rounded flex items-center justify-center text-destructive hover:bg-black/5" title="Delete counterpart">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col items-center gap-2 flex-shrink-0 w-16 px-1">
                  {hasInfluence(cp, supertypes) && (
                    <Input
                      value={cp.influence || ''}
                      onChange={(e) => updateCounterpart(i, { influence: e.target.value })}
                      placeholder="X"
                      className="h-12 w-16 text-3xl font-bold text-center p-0 text-neutral-900 placeholder:text-neutral-400"
                    />
                  )}
                </div>
                <EntryEditFields entry={cp} set={(fields) => updateCounterpart(i, fields)} {...editCtx} showSupertype />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}