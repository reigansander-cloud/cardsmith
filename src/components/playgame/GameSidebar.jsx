import React from 'react';
import { X } from 'lucide-react';
import SidebarCard from './sidebar/SidebarCard';
import SidebarTokens from './sidebar/SidebarTokens';
import SidebarDiscard from './sidebar/SidebarDiscard';
import SidebarBattlefield from './sidebar/SidebarBattlefield';
import SidebarIncome from './sidebar/SidebarIncome';
import SidebarGroup from './sidebar/SidebarGroup';
import SidebarDeck from './sidebar/SidebarDeck';

const TITLES = { card: 'Card Details', tokens: 'Token Pile', discard: 'Graveyard', battlefield: 'Battlefield', group: 'Group', banished: 'Banished', deck: 'Deck' };

// Right sidebar container. Sticky header with title + close button, then
// scrollable content that switches based on selection or game phase.
export default function GameSidebar({
  selection, game, state, entries, supertypes, myPlayerIndex, onClose,
  onTokenChange, onDetach, onCardClick, onDeclareClash, onResolveTotal,
  onDrop, makeDragStart, onTokenDragStart, onDiscardDragStart, onCardDrop,
  onAckIncome, computeSideTotal, findCard,
  onToggleExhausted, onToggleFlipped, onHoverEnter, onHoverLeave,
  onEndClash, onAdvantageChange, onDestroyBf, onChargeChange, onTokenChargeChange,
  onGroupExhaust, onGroupFlip, onGroupTokenChange, onGroupClearTokens, onGroupClearSupport, onDuplicate, onClearTokens, onClearSupport, onSendToGraveyard, onInfluenceChange, onToggleAttachment, onToggleStacking, onToggleStructure, onStackDeck, onViewDeck, onShuffleDeck, folderEntries, onDrawRandom, customSections, onAddCustomSection, onAddToCustomSection, onCustomSectionDragStart, onRemoveCustomSection, onDrawFromPool, onPullFromPool,
  selectedCardId, groupIds, oppName, myName, wideViewOn,
}) {
  const title = selection ? (TITLES[selection.type] || '') : '';
  const myIncomeAcked = !!game.players?.[myPlayerIndex]?.income_ack;
  const showHeader = !!selection && !(game.phase === 'income_reveal' && !myIncomeAcked);

  let content;
  if (game.phase === 'income_reveal' && !myIncomeAcked) {
    content = <SidebarIncome game={game} state={state} entries={entries} supertypes={supertypes} onAckIncome={onAckIncome} myPlayerIndex={myPlayerIndex} />;
  } else if (game.phase === 'income_reveal' && myIncomeAcked) {
    content = <div className="p-4 text-sm text-muted-foreground">Waiting for opponent to acknowledge income…</div>;
  } else if (!selection) {
    content = <div className="p-4 text-sm text-muted-foreground">Click a card, token pile, discard pile, or battlefield to view details.</div>;
  } else if (selection.type === 'card') {
    const found = findCard(selection.card_id);
    content = found
      ? <SidebarCard card={found.card} location={found.location} entries={entries} supertypes={supertypes} myPlayerIndex={myPlayerIndex} onTokenChange={onTokenChange} onDetach={onDetach} onCardClick={onCardClick} onToggleExhausted={onToggleExhausted} onToggleFlipped={onToggleFlipped} onDuplicate={onDuplicate} onClearTokens={onClearTokens} onClearSupport={onClearSupport} onSendToGraveyard={onSendToGraveyard} onInfluenceChange={onInfluenceChange} onToggleAttachment={onToggleAttachment} onToggleStacking={onToggleStacking} onToggleStructure={onToggleStructure} />
      : <div className="p-4 text-sm text-muted-foreground">Card not found.</div>;
  } else if (selection.type === 'tokens') {
    content = <SidebarTokens tokens={state.tokens?.[myPlayerIndex] || []} entries={entries} supertypes={supertypes} onTokenDragStart={onTokenDragStart} onCardClick={onCardClick} playerIndex={myPlayerIndex} onTokenChargeChange={onTokenChargeChange} folderEntries={folderEntries} onDrawRandom={onDrawRandom} customSections={customSections} onAddCustomSection={onAddCustomSection} onAddToCustomSection={onAddToCustomSection} onCustomSectionDragStart={onCustomSectionDragStart} onRemoveCustomSection={onRemoveCustomSection} onDrawFromPool={onDrawFromPool} onPullFromPool={onPullFromPool} />;
  } else if (selection.type === 'discard') {
    const pIdx = selection.playerIndex ?? myPlayerIndex;
    content = <SidebarDiscard key={(selection.tab || 'discard') + ':' + (selection.playerIndex ?? '')} initialTab={selection.tab || 'discard'} discards={state.discards?.[pIdx] || []} banished={state.banished?.[pIdx] || []} deleted={state.deleted?.[pIdx] || []} entries={entries} supertypes={supertypes} onDiscardDragStart={onDiscardDragStart} onCardClick={onCardClick} playerIndex={pIdx} onDrop={onDrop} onChargeChange={onChargeChange} />;
  } else if (selection.type === 'deck') {
    const pIdx = selection.playerIndex ?? myPlayerIndex;
    content = <SidebarDeck deck={state.decks?.[pIdx] || []} entries={entries} supertypes={supertypes} playerIndex={pIdx} onStackDeck={() => onStackDeck(pIdx)} onViewDeck={() => onViewDeck(pIdx)} onShuffleDeck={() => onShuffleDeck(pIdx)} onDrop={onDrop} makeDragStart={makeDragStart} />;
  } else if (selection.type === 'group') {
    content = <SidebarGroup cardIds={selection.card_ids} onGroupExhaust={onGroupExhaust} onGroupFlip={onGroupFlip} onGroupTokenChange={onGroupTokenChange} onGroupClearTokens={onGroupClearTokens} onGroupClearSupport={onGroupClearSupport} />;
  } else if (selection.type === 'battlefield') {
    const bf = (state.battlefields || []).find((b) => b.id === selection.battlefield_id);
    content = bf
      ? <SidebarBattlefield battlefield={bf} isActive={state.clash?.battlefield_id === bf.id} clashInProgress={!!state.clash?.staging} entries={entries} supertypes={supertypes} myPlayerIndex={myPlayerIndex} oppName={oppName} myName={myName} selectedCardId={selectedCardId} groupIds={groupIds} wideViewOn={wideViewOn} onDeclareClash={onDeclareClash} onDrop={onDrop} makeDragStart={makeDragStart} onCardClick={onCardClick} onCardDrop={onCardDrop} computeSideTotal={computeSideTotal} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onDoubleClick={onToggleExhausted} onEndClash={onEndClash} onAdvantageChange={onAdvantageChange} onDestroyBf={onDestroyBf} />
      : <div className="p-4 text-sm text-muted-foreground">Battlefield not found.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className="flex items-center justify-between p-3 border-b border-border flex-shrink-0">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">{content}</div>
    </div>
  );
}