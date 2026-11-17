import { base44 } from '@/api/base44Client';
import { INCOME_SYMBOLS } from '@/lib/folderPreview';

// AI_BOT_FOLDER_NAME and AI_DECK_NAME are used to find existing AI assets.
const AI_FOLDER_NAME = 'AI Bots';
const AI_DECK_NAME = 'AI Deck';

// Ensures an AI deck exists (creates the folder, supertypes, entries, and deck
// if missing). Returns the deck ID. The AI deck has 40 "AI Bot" Unit cards
// (6 influence) and 10 "AI Battleground" cards (5 influence, no cost/ability).
// All cards have a black folder background with white text (text_color override).
export async function ensureAIDeck() {
  // Find or create the AI folder
  let folders = await base44.entities.Folder.filter({ name: AI_FOLDER_NAME });
  let folder = folders[0];
  if (!folder) folder = await base44.entities.Folder.create({ name: AI_FOLDER_NAME, color: '#000000' });
  else if (folder.color !== '#000000') await base44.entities.Folder.update(folder.id, { color: '#000000' });

  // Find or create supertypes in the AI folder
  const existingSups = await base44.entities.FolderSupertype.filter({ folder_id: folder.id });
  let unitSup = existingSups.find((s) => s.template_type === 'permanent');
  if (!unitSup) unitSup = await base44.entities.FolderSupertype.create({ folder_id: folder.id, name: 'Unit', template_type: 'permanent', sort_order: 0 });
  let bfSup = existingSups.find((s) => s.template_type === 'battlefield');
  if (!bfSup) bfSup = await base44.entities.FolderSupertype.create({ folder_id: folder.id, name: 'AI Battleground', template_type: 'battlefield', sort_order: 1 });
  let incomeSup = existingSups.find((s) => s.template_type === 'income');
  if (!incomeSup) incomeSup = await base44.entities.FolderSupertype.create({ folder_id: folder.id, name: 'Income', template_type: 'income', sort_order: 2 });

  // Find or create AI Bot entry
  let botEntries = await base44.entities.CardEntry.filter({ folder_id: folder.id, name: 'AI Bot' });
  let botEntry = botEntries[0];
  if (!botEntry) botEntry = await base44.entities.CardEntry.create({ folder_id: folder.id, name: 'AI Bot', supertype: unitSup.name, influence: '6', cost: 0, ability: '', text_color: '#ffffff' });
  else if (botEntry.text_color !== '#ffffff') await base44.entities.CardEntry.update(botEntry.id, { text_color: '#ffffff' });

  // Find or create AI Battleground entry
  let bfEntries = await base44.entities.CardEntry.filter({ folder_id: folder.id, name: 'AI Battleground' });
  let bfEntry = bfEntries[0];
  if (!bfEntry) bfEntry = await base44.entities.CardEntry.create({ folder_id: folder.id, name: 'AI Battleground', supertype: bfSup.name, influence: '5', cost: 0, ability: '', text_color: '#ffffff' });
  else if (bfEntry.text_color !== '#ffffff') await base44.entities.CardEntry.update(bfEntry.id, { text_color: '#ffffff' });

  // Find or create AI income entries (Scissors, Paper, Rock) — empty cards
  // used only as random income options for the AI during income selection.
  const incomeNames = ['Scissors', 'Paper', 'Rock'];
  const incomeEntryIds = [];
  for (let s = 0; s < INCOME_SYMBOLS.length; s++) {
    let ieResults = await base44.entities.CardEntry.filter({ folder_id: folder.id, name: incomeNames[s] });
    let ie = ieResults[0];
    if (!ie) ie = await base44.entities.CardEntry.create({ folder_id: folder.id, name: incomeNames[s], supertype: incomeSup.name, influence: '', cost: 0, ability: '', income_symbol: INCOME_SYMBOLS[s], bonus_mode: 'cost', bonus_cost_icons: [], text_color: '#ffffff' });
    else if (ie.text_color !== '#ffffff' || ie.income_symbol !== INCOME_SYMBOLS[s]) await base44.entities.CardEntry.update(ie.id, { text_color: '#ffffff', income_symbol: INCOME_SYMBOLS[s] });
    incomeEntryIds.push(ie.id);
  }

  // Find or create AI Deck (no folder_id — avoids auto-including token entries)
  let decks = await base44.entities.Deck.filter({ name: AI_DECK_NAME });
  let deck = decks[0];
  const cards = [{ card_id: botEntry.id, copies: 40 }, { card_id: bfEntry.id, copies: 10 }, ...incomeEntryIds.map((id) => ({ card_id: id, copies: 1 }))];
  if (!deck) deck = await base44.entities.Deck.create({ name: AI_DECK_NAME, cards });
  else await base44.entities.Deck.update(deck.id, { cards });

  return deck.id;
}