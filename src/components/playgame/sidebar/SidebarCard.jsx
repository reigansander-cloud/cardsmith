import React from 'react';
import MiniEntry from '../MiniEntry';
import { Button } from '@/components/ui/button';
import { Unlink, RotateCw, ArrowDown, Copy, Link2, Layers, Building2 } from 'lucide-react';
import { isStructureEntry } from '@/lib/folderPreview';
import { cardStateOf, displayEntryFor, stateCountFor, counterpartsOf } from '@/lib/counterparts';

const CARD_BACK_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/516417bcba_ec1ad09b0_CardBack.png';

const TOKEN_COLORS = {
  damage: '#dc2626',
  armor: '#2563eb',
  charge: '#ca8a04',
  support: '#ffffff',
  prowess: '#8b0000',
  other: '#28a745',
  duration: '#7c3aed',
};

const TOKEN_TYPES = [
  { key: 'support', label: 'Sup', color: '#ffffff' },
  { key: 'damage', label: 'Dmg', color: '#dc2626' },
  { key: 'prowess', label: 'Pwr', color: '#8b0000' },
  { key: 'charge', label: 'Chg', color: '#ca8a04' },
  { key: 'other', label: 'Oth', color: '#28a745' },
  { key: 'armor', label: 'Arm', color: '#2563eb' },
  { key: 'duration', label: 'Dur', color: '#7c3aed' },
];

// Card detail view. Token buttons: + on left, − on right. Each token change
// pops a colored ±N animation on the card. Detach places the attachment in
// the same section as its parent card (not hand).
export default function SidebarCard({ card, location, entries, supertypes, myPlayerIndex, onTokenChange, onDetach, onCardClick, onToggleExhausted, onToggleFlipped, onDuplicate, onClearTokens, onClearSupport, onSendToGraveyard, onInfluenceChange, onToggleAttachment, onToggleStacking, onToggleStructure }) {
  if (!card) return <p className="p-4 text-base text-muted-foreground">Card not found.</p>;
  const baseEntry = entries[card.entry_id];
  const stateIdx = cardStateOf(card, baseEntry);
  const entry = displayEntryFor(baseEntry, stateIdx);
  // Face shown here: the current state's face, or the front when the card is
  // face-down but visible to its owner.
  const shownEntry = entry || baseEntry;
  const faceDown = stateIdx === stateCountFor(baseEntry) - 1;
  const isStructure = card.is_structure ?? isStructureEntry(baseEntry, supertypes);
  const counterparts = counterpartsOf(baseEntry);
  const isHidden = faceDown && location?.player_index !== myPlayerIndex && (location?.zone === 'battlefield' || location?.zone === 'rearguard');

  const handleTokenClick = (tokenType, delta) => {
    onTokenChange(card.id, location, tokenType, delta);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex gap-3 items-start">
        <div className="relative flex justify-center">
          {isHidden ? (
            <img src={CARD_BACK_URL} className="object-cover rounded" style={{ width: 280, height: 392 }} alt="Hidden card" />
          ) : (
            <MiniEntry entry={shownEntry} supertypes={supertypes} targetWidth={280} />
          )}
          {card?.tokens && (
            <div className="absolute top-1 right-1 flex flex-col gap-1">
              {Object.entries(card.tokens).map(([key, val]) => {
                if (!val || val === 0) return null;
                const bg = TOKEN_COLORS[key] || '#666';
                return (
                  <div key={key} className="text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center leading-none" style={{ background: bg, color: bg === '#ffffff' ? '#000' : '#fff' }}>
                    {val}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {!isHidden && (
            <input
              type="text"
              inputMode="text"
              value={card.influence !== undefined && card.influence !== '' && card.influence !== '?' ? card.influence : (shownEntry?.influence && shownEntry.influence !== '?' ? shownEntry.influence : '')}
              onChange={(e) => onInfluenceChange(card.id, location, e.target.value)}
              placeholder="?"
              className="w-12 h-12 text-center text-base font-bold rounded border border-border bg-background text-foreground"
            />
          )}
          <Button onClick={() => onToggleExhausted(card.id)} variant={card.exhausted ? 'secondary' : 'outline'} size="icon" className="h-10 w-10">
            <RotateCw size={18} />
          </Button>
          <Button onClick={() => onToggleFlipped(card.id)} variant={stateIdx > 0 ? 'secondary' : 'outline'} size="icon" className="h-10 w-10" title={stateCountFor(baseEntry) > 2 ? `Rotate face (${stateIdx + 1}/${stateCountFor(baseEntry)})` : 'Flip'}>
            <ArrowDown size={18} />
          </Button>
          <div className="border-t border-border/50 my-1" />
          <Button onClick={() => onDuplicate(card, location)} variant="outline" size="icon" className="h-10 w-10" title="Duplicate">
            <Copy size={18} />
          </Button>
          {location?.zone !== 'attachment' && (
            <Button onClick={() => onToggleAttachment(card.id)} variant={card.is_attachment ? 'secondary' : 'outline'} size="icon" className="h-10 w-10" title={card.is_attachment ? 'Attachment mode (drag onto a card to attach)' : 'Turn into attachment'}>
              <Link2 size={18} />
            </Button>
          )}
          {location?.zone !== 'attachment' && (
            <Button onClick={() => onToggleStacking(card.id)} variant={card.stacking ? 'secondary' : 'outline'} size="icon" className="h-10 w-10" title={card.stacking ? 'Stacking mode (drag same-name cards to stack)' : 'Turn into stack'}>
              <Layers size={18} />
            </Button>
          )}
          {location?.zone !== 'attachment' && (
            <Button onClick={() => onToggleStructure(card.id)} variant={isStructure ? 'secondary' : 'outline'} size="icon" className="h-10 w-10" title={isStructure ? 'Structure (stays during clash resolution, destruction, and new rounds)' : 'Count as structure'}>
              <Building2 size={18} />
            </Button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-semibold text-muted-foreground">Tokens</h4>
          <div className="flex gap-1">
            <button onClick={() => onSendToGraveyard?.(card.id)} className="px-3 py-1 text-xs rounded bg-muted/50 text-muted-foreground hover:bg-muted">Graveyard</button>
            <button onClick={() => onClearSupport(card.id)} className="px-3 py-1 text-xs rounded bg-muted/50 text-muted-foreground hover:bg-muted">Clear Sup</button>
            <button onClick={() => onClearTokens(card.id)} className="px-3 py-1 text-xs rounded bg-destructive/10 text-destructive hover:bg-destructive/20">Clear All</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-2">
          {TOKEN_TYPES.map((t, i) => {
            return (
              <div key={t.key} className={`flex items-center gap-2 px-1 ${i % 2 === 0 ? 'border-r border-border/30' : ''}`}>
                <span className="text-sm w-10" style={{ color: t.color === '#ffffff' ? '#ccc' : t.color }}>{t.label}</span>
                <button onClick={() => handleTokenClick(t.key, -1)} className="w-9 h-9 rounded bg-destructive/10 text-destructive text-sm flex items-center justify-center">−</button>
                <span className="text-lg font-bold w-8 text-center">{card.tokens?.[t.key] || 0}</span>
                <button onClick={() => handleTokenClick(t.key, 1)} className="w-9 h-9 rounded bg-primary/10 text-primary text-sm flex items-center justify-center">+</button>
              </div>
            );
          })}
        </div>
      </div>

      {card.attachments?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">Alterations ({card.attachments.length})</h4>
          <div className="flex flex-col gap-2">
            {card.attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-3 p-2 rounded bg-muted/30">
                <button onClick={() => onCardClick(att, { zone: 'attachment', parent_id: card.id })} className="flex-shrink-0">
                  <MiniEntry entry={entries[att.entry_id]} supertypes={supertypes} targetWidth={80} />
                </button>
                <span className="text-sm text-foreground flex-1 truncate">{entries[att.entry_id]?.name || 'Unknown'}</span>
                <button onClick={() => onDetach(card.id, att.id, location)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded" title="Detach to same section">
                  <Unlink size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isHidden && counterparts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">Counterparts ({counterparts.length})</h4>
          <div className="flex flex-col gap-2">
            {counterparts.map((cp, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/30">
                <div className="flex-shrink-0">
                  <MiniEntry entry={displayEntryFor(baseEntry, i + 1)} supertypes={supertypes} targetWidth={80} />
                </div>
                <span className="text-sm text-foreground flex-1 truncate">{cp?.name || `Counterpart ${i + 1}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}