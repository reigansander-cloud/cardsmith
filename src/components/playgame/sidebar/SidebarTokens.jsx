import React, { useState } from 'react';
import MiniEntry from '../MiniEntry';
import { Shuffle, Plus, X, ArrowDownToLine, Copy } from 'lucide-react';
import { useDropZone } from '@/context/PointerDragContext';

function CustomSectionTab({ section, active, onClick, onDrop, onRemove }) {
  const dropProps = useDropZone((payload) => onDrop(section.id, payload));
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        {...dropProps}
        className={`px-2 py-1 text-xs rounded-t ${active ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
      >
        {section.name}
      </button>
      <button
        onClick={onRemove}
        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={8} />
      </button>
    </div>
  );
}

// Token pile + folder supertype tabs + custom draw pools. Custom pools are
// finite: dragging a card out consumes it from the list. Drag token/supertype
// cards onto a pool tab or its content area to add entries.
export default function SidebarTokens({ tokens, entries, supertypes, onTokenDragStart, onCardClick, playerIndex, onTokenChargeChange, folderEntries, onDrawRandom, customSections, onAddCustomSection, onAddToCustomSection, onCustomSectionDragStart, onRemoveCustomSection, onDrawFromPool, onPullFromPool }) {
  const [activeTab, setActiveTab] = useState('tokens');
  const supertypeNames = folderEntries ? Object.keys(folderEntries).filter((k) => (folderEntries[k] || []).length > 0) : [];
  const orderedSupertypes = supertypes.map((s) => s.name).filter((name) => supertypeNames.includes(name));
  const allSupertypeTabs = [...orderedSupertypes, ...supertypeNames.filter((n) => !orderedSupertypes.includes(n))];
  const customSectionsList = customSections || [];

  const activeCustomSection = customSectionsList.find((s) => s.id === activeTab) || null;
  const contentDrop = useDropZone((payload) => { if (activeCustomSection) onAddToCustomSection(activeCustomSection.id, payload); });

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        <button onClick={() => setActiveTab('tokens')} className={`px-2 py-1 text-xs rounded-t ${activeTab === 'tokens' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>Tokens</button>
        {allSupertypeTabs.map((name) => (
          <button key={name} onClick={() => setActiveTab(name)} className={`px-2 py-1 text-xs rounded-t capitalize ${activeTab === name ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>{name}</button>
        ))}
        {customSectionsList.map((sec) => (
          <CustomSectionTab key={sec.id} section={sec} active={activeTab === sec.id} onClick={() => setActiveTab(sec.id)} onDrop={onAddToCustomSection} onRemove={() => onRemoveCustomSection(sec.id)} />
        ))}
        <button onClick={onAddCustomSection} className="px-1.5 py-1 text-xs rounded-t bg-muted/50 text-muted-foreground hover:bg-muted flex items-center">
          <Plus size={12} />
        </button>
      </div>

      {activeTab === 'tokens' ? (
        <>
          <h4 className="text-sm font-bold text-foreground">Token Pile ({tokens.length})</h4>
          <p className="text-xs text-muted-foreground/50">Click to add charge, right-click to remove.</p>
          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Empty</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {tokens.map((t, i) => (
                <div key={i} onPointerDown={onTokenDragStart(t, playerIndex)} onClick={() => onTokenChargeChange(i, 1)} onContextMenu={(e) => { e.preventDefault(); onTokenChargeChange(i, -1); }} className="relative cursor-grab hover:scale-105 transition-transform" style={{ touchAction: 'none' }}>
                  <MiniEntry entry={entries[t.entry_id]} supertypes={supertypes} targetWidth={130} />
                  {(t.charge || 0) > 0 && <div className="absolute top-0.5 right-0.5 bg-yellow-500 text-black text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">{t.charge}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      ) : activeCustomSection ? (
        <>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">{activeCustomSection.name} ({activeCustomSection.entry_ids.length})</h4>
            <div className="flex gap-1">
              <button onClick={() => onDrawFromPool(activeCustomSection.id)} disabled={!activeCustomSection.entry_ids.length} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                <ArrowDownToLine size={12} /> Draw
              </button>
              <button onClick={() => onPullFromPool(activeCustomSection.id)} disabled={!activeCustomSection.entry_ids.length} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                <Copy size={12} /> Pull
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/50">Draw moves a random card to your hand. Pull copies one.</p>
          <div
            className="grid grid-cols-3 gap-2 min-h-[80px] rounded border border-dashed border-border/50 p-2"
            {...contentDrop}
          >
            {activeCustomSection.entry_ids.length === 0 ? (
              <p className="col-span-3 text-xs text-muted-foreground/40 text-center self-center">Drop cards here</p>
            ) : (
              activeCustomSection.entry_ids.map((id, i) => {
                const entry = entries[id];
                if (!entry) return null;
                return (
                  <div key={i} onPointerDown={onCustomSectionDragStart(id, entry.influence || '', activeCustomSection.id, playerIndex)} className="relative cursor-grab hover:scale-105 transition-transform" style={{ touchAction: 'none' }}>
                    <MiniEntry entry={entry} supertypes={supertypes} targetWidth={130} />
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground capitalize">{activeTab} ({folderEntries[activeTab]?.length || 0})</h4>
            <button onClick={() => { const ids = folderEntries[activeTab]; if (ids?.length) onDrawRandom(ids[Math.floor(Math.random() * ids.length)]); }} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
              <Shuffle size={12} /> Draw Random
            </button>
          </div>
          <p className="text-xs text-muted-foreground/50">Drag to duplicate onto the table.</p>
          <div className="grid grid-cols-3 gap-2">
            {(folderEntries[activeTab] || []).map((id) => {
              const entry = entries[id];
              if (!entry) return null;
              return (
                <div key={id} onPointerDown={onTokenDragStart({ entry_id: id, influence: entry.influence || '' }, playerIndex)} className="relative cursor-grab hover:scale-105 transition-transform" style={{ touchAction: 'none' }}>
                  <MiniEntry entry={entry} supertypes={supertypes} targetWidth={130} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}