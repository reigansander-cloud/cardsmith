import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Plus, Crown, User } from 'lucide-react';
import { hasInfluence, renderType, supertypeLabel, STANDARD_STATS, STAT_COLORS, INCOME_SYMBOLS } from '@/lib/folderPreview';
import AbilityEditor from './AbilityEditor';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// The editable field set shared by a folder entry and each of its counterparts.
// `entry` is the object being edited and `set(fields)` merges fields into it —
// the parent decides where that object lives (the entry itself, or an item in
// its counterparts array). `namesSlot` lets the entry pass in the unused-names
// picker without the counterparts inheriting it.
export default function EntryEditFields({
  entry, set, icons = [], folderStats = [], keywords = [], capitalized = [],
  iconWords = [], supertypes = [], autoFormat = true, nameMatch = false, namesSlot = null, showSupertype = false,
}) {
  const [flavorActive, setFlavorActive] = useState(false);

  const rt = renderType(entry, supertypes);
  const isIncome = rt === 'income';
  const isBattlefield = rt === 'battlefield';
  const isToken = entry.supertype === 'token';
  const noSubtype = isIncome || isBattlefield;
  const noStats = isIncome || isBattlefield;
  const showInfluence = hasInfluence(entry, supertypes);
  const costIcons = entry.cost_icons || [];
  const stats = entry.stats || [];
  const tokenDefault = entry.token_type || supertypes[0]?.name || 'permanent';
  // Supertype choices, shared by the token-type select and the counterpart
  // supertype select. Falls back to the legacy 'permanent' when the folder
  // defines no supertypes yet.
  const supertypeOptions = supertypes.length ? supertypes.map((s) => s.name) : ['permanent'];

  const statOptions = [
    ...STANDARD_STATS.map((n) => ({ name: n, color: STAT_COLORS[n] })),
    ...folderStats.map((s) => ({ name: s.name, color: s.color })),
    ...(entry.flavor_text || flavorActive ? [] : [{ name: 'Flavor Text', color: '#9ca3af' }]),
  ];

  const addStat = () => set({ stats: [...stats, { name: 'Pws', value: '', color: STAT_COLORS.Pws }] });
  const updateStat = (i, fields) => set({ stats: stats.map((s, idx) => (idx === i ? { ...s, ...fields } : s)) });
  const removeStat = (i) => set({ stats: stats.filter((_, idx) => idx !== i) });
  const pickStat = (i, name) => {
    if (name === 'Flavor Text') {
      const s = stats[i];
      set({ stats: stats.filter((_, idx) => idx !== i), flavor_text: s?.value || '' });
      setFlavorActive(true);
      return;
    }
    const def = statOptions.find((o) => o.name === name);
    updateStat(i, { name, color: def ? def.color : '#9ca3af' });
  };

  const addCostIcon = (url) => set({ cost_icons: [...costIcons, url], cost: (entry.cost || 0) + 1 });
  const removeCostIcon = (i) => {
    const next = costIcons.filter((_, idx) => idx !== i);
    const nextQ = (entry.cost_question || []).filter((_, idx) => idx !== i);
    set({ cost_icons: next, cost: next.length, cost_question: nextQ });
  };
  const toggleCostQuestion = (i) => {
    const cq = [...(entry.cost_question || [])];
    while (cq.length <= i) cq.push(false);
    cq[i] = !cq[i];
    set({ cost_question: cq });
  };
  const addBonusCostIcon = (url) => set({ bonus_cost_icons: [...(entry.bonus_cost_icons || []), url] });
  const removeBonusCostIcon = (i) => set({ bonus_cost_icons: (entry.bonus_cost_icons || []).filter((_, idx) => idx !== i) });
  const setIncomeSymbol = (url) => set({ income_symbol: entry.income_symbol === url ? '' : url });

  const cycleFabled = () => {
    if (!entry.fabled && !entry.basic) set({ fabled: true, basic: false });
    else if (entry.fabled) set({ fabled: false, basic: true });
    else set({ fabled: false, basic: false });
  };

  return (
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-center gap-2">
        <Input value={entry.name || ''} onChange={(e) => set({ name: e.target.value })} readOnly={isIncome} className={`h-8 text-sm font-semibold flex-1 min-w-0 ${nameMatch ? 'text-red-600' : 'text-neutral-900'} placeholder:text-neutral-400 ${isIncome ? 'cursor-default opacity-80' : ''}`} placeholder={isIncome ? 'Income #…' : 'Name'} />
        {namesSlot}
        <span className="hidden lg:inline text-xs italic text-neutral-500 truncate flex-shrink-0">{supertypeLabel(entry)}</span>
        {!noSubtype && <Input value={entry.subtype || ''} onChange={(e) => set({ subtype: e.target.value })} className="h-8 text-xs italic w-28 min-w-0 text-neutral-900 placeholder:text-neutral-400" placeholder="Subtype" />}
        <button onClick={(e) => { e.stopPropagation(); cycleFabled(); }} className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${entry.fabled ? 'text-amber-500 bg-amber-50' : entry.basic ? 'text-blue-500 bg-blue-50' : 'text-neutral-400 hover:bg-black/5'}`} title={entry.fabled ? 'Fabled — limited to 1 copy in decks' : entry.basic ? 'Basic — up to 6 copies in decks' : 'Mark as Fabled'}>
          {entry.basic && !entry.fabled ? <User size={16} /> : <Crown size={16} />}
        </button>
      </div>
      {isToken && (
        <select value={tokenDefault} onChange={(e) => set({ token_type: e.target.value })} className="w-full h-8 rounded-md border border-black/10 bg-white/60 px-2 text-sm text-neutral-900">
          {supertypeOptions.map((name) => <option key={name} value={name}>{cap(name)}</option>)}
        </select>
      )}
      {showSupertype && (
        <select value={entry.supertype || ''} onChange={(e) => set({ supertype: e.target.value })} className="w-full h-8 rounded-md border border-black/10 bg-white/60 px-2 text-sm text-neutral-900">
          {/* The entry's own supertype stays selectable even when the folder no
              longer defines it, so the select always shows the current value. */}
          {entry.supertype && !supertypeOptions.includes(entry.supertype) && (
            <option value={entry.supertype}>{cap(entry.supertype)}</option>
          )}
          {supertypeOptions.map((name) => <option key={name} value={name}>{cap(name)}</option>)}
        </select>
      )}
      {isIncome && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-neutral-500 flex-shrink-0">Symbol:</span>
          {INCOME_SYMBOLS.map((url) => (
            <button key={url} onClick={(e) => { e.stopPropagation(); setIncomeSymbol(url); }} className={`w-7 h-7 rounded border flex items-center justify-center flex-shrink-0 ${entry.income_symbol === url ? 'border-primary bg-primary/10' : 'border-black/10 bg-black/5 hover:border-primary'}`} title="Type symbol">
              <img src={url} alt="" className="w-5 h-5 object-contain" />
            </button>
          ))}
        </div>
      )}
      {/* Cost bar editor (the one exception to the read-only layout) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {icons.length === 0 ? (
          <span className="text-[11px] text-neutral-500">Add icons via Icons &amp; Stats</span>
        ) : (
          <>
            {icons.map((ic) => (
              <button key={ic.id} onClick={(e) => { e.stopPropagation(); addCostIcon(ic.url); }} className="w-7 h-7 rounded border border-black/10 bg-black/5 flex items-center justify-center hover:border-primary flex-shrink-0" title={`Add ${ic.name}`}>
                <img src={ic.url} alt={ic.name} className="w-5 h-5 object-contain" />
              </button>
            ))}
            {costIcons.length > 0 && <div className="w-px h-6 bg-border flex-shrink-0" />}
            {costIcons.map((url, i) => (
              <div key={i} className="relative flex-shrink-0">
                <button onClick={(e) => { e.stopPropagation(); removeCostIcon(i); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); toggleCostQuestion(i); }} className="w-7 h-7 rounded border border-primary bg-primary/10 flex items-center justify-center hover:bg-primary/20 flex-shrink-0" title="Remove from cost — right-click to toggle ?">
                  <img src={url} alt="" className="w-5 h-5 object-contain" />
                </button>
                {entry.cost_question?.[i] && (
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center leading-none z-10 pointer-events-none" style={{ width: 26, height: 26, fontFamily: 'CaesarDressing, cursive', fontSize: 24, color: '#000' }}>?</span>
                )}
              </div>
            ))}
          </>
        )}
      </div>
      <AbilityEditor value={entry.ability || ''} onChange={(v) => set({ ability: v })} icons={icons} folderStats={folderStats} keywords={keywords} capitalized={capitalized} iconWords={iconWords} autoFormat={autoFormat} />
      {isIncome && (
        <div className="space-y-1.5 rounded-md border border-black/10 p-2">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-neutral-500 flex-shrink-0">Bonus:</span>
            <button onClick={(e) => { e.stopPropagation(); set({ bonus_mode: 'cost' }); }} className={`px-2 py-0.5 text-[11px] rounded ${entry.bonus_mode !== 'ability' ? 'bg-primary text-primary-foreground' : 'text-neutral-500 hover:bg-black/5'}`}>Cost</button>
            <button onClick={(e) => { e.stopPropagation(); set({ bonus_mode: 'ability' }); }} className={`px-2 py-0.5 text-[11px] rounded ${entry.bonus_mode === 'ability' ? 'bg-primary text-primary-foreground' : 'text-neutral-500 hover:bg-black/5'}`}>Ability</button>
          </div>
          {entry.bonus_mode === 'ability' ? (
            <AbilityEditor value={entry.bonus_ability || ''} onChange={(v) => set({ bonus_ability: v })} icons={icons} folderStats={folderStats} keywords={keywords} capitalized={capitalized} iconWords={iconWords} autoFormat={autoFormat} />
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {icons.length === 0 ? (
                <span className="text-[11px] text-neutral-500">Add icons via Icons &amp; Stats</span>
              ) : (
                <>
                  {icons.map((ic) => (
                    <button key={ic.id} onClick={(e) => { e.stopPropagation(); addBonusCostIcon(ic.url); }} className="w-7 h-7 rounded border border-black/10 bg-black/5 flex items-center justify-center hover:border-primary flex-shrink-0" title={`Add ${ic.name}`}>
                      <img src={ic.url} alt={ic.name} className="w-5 h-5 object-contain" />
                    </button>
                  ))}
                  {(entry.bonus_cost_icons || []).length > 0 && <div className="w-px h-6 bg-border flex-shrink-0" />}
                  {(entry.bonus_cost_icons || []).map((url, i) => (
                    <button key={i} onClick={(e) => { e.stopPropagation(); removeBonusCostIcon(i); }} className="w-7 h-7 rounded border border-primary bg-primary/10 flex items-center justify-center hover:bg-primary/20 flex-shrink-0" title="Remove">
                      <img src={url} alt="" className="w-5 h-5 object-contain" />
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {!noStats && stats.length > 0 && (
        <div className="space-y-1.5">
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <select value={s.name === 'PRWS' || s.name === 'Atk' ? 'Pws' : s.name} onChange={(e) => pickStat(i, e.target.value)} className="h-7 text-xs rounded-md border border-black/10 bg-white/60 px-1 flex-1 min-w-0 text-neutral-900">
                {statOptions.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
              <Input value={s.value} onChange={(e) => updateStat(i, { value: e.target.value })} className="h-7 text-xs w-12 px-1 text-neutral-900 placeholder:text-neutral-400" placeholder="Val" />
              <button onClick={() => removeStat(i)} className="text-destructive px-0.5"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {!noStats && (entry.flavor_text || flavorActive) && (
        <div className="flex items-start gap-1">
          <span className="text-xs italic text-muted-foreground/70 flex-shrink-0 pt-1.5">Flavor</span>
          <textarea
            value={entry.flavor_text || ''}
            onChange={(e) => set({ flavor_text: e.target.value })}
            placeholder="Flavor text…"
            className="flex-1 min-w-0 h-14 text-xs italic rounded-md border border-black/10 bg-white/60 px-2 py-1 text-neutral-700 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={() => { set({ flavor_text: '' }); setFlavorActive(false); }} className="text-destructive px-0.5 pt-1"><X size={14} /></button>
        </div>
      )}
      {!noStats && <Button variant="outline" size="sm" className="h-7 w-full" onClick={addStat}><Plus size={14} className="mx-auto" /></Button>}
    </div>
  );
}