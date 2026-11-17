import { base44 } from '@/api/base44Client';

// Default database tab for a given template key
export const TEMPLATE_LABEL = {
  tactical: 'Towers',
  clans: 'Clans',
  bravado_items: 'Snare',
  bravado_pets: 'Snare',
  bravado_character_sheet: 'Snare',
  bravado_beast: 'Snare',
  bravado_upgrade: 'Snare',
  playing_card: 'Playing Card',
  glimpses: 'Glimpses',
  free_canvas: 'Free Canvas',
  seven_wonders: '7 Wonders',
};

export function defaultTabForTemplate(template) {
  return TEMPLATE_LABEL[template] || 'General';
}

// Derive a numeric card cost from the template's saved data.
// - seven_wonders: number of cost icons
// - playing_card: the value if numeric, else 0
// - free_canvas: number of icons in the crowned cost bar element
export function deriveCardCost(template, data) {
  if (!data) return 0;
  if (template === 'seven_wonders') {
    return Array.isArray(data.costIcons) ? data.costIcons.length : 0;
  }
  if (template === 'playing_card') {
    const n = Number(data.value);
    return Number.isFinite(n) ? n : 0;
  }
  if (template === 'glimpses') {
    const n = Number(data.bannerNumber);
    return Number.isFinite(n) ? n : 0;
  }
  if (template === 'free_canvas') {
    const crown = (data.elements || []).find((el) => el.costCrown && el.type === 'costbar');
    return crown && Array.isArray(crown.costs) ? crown.costs.length : 0;
  }
  return 0;
}

let _userId = null;
async function getUserId() {
  if (_userId) return _userId;
  try {
    const me = await base44.auth.me();
    _userId = me?.id || null;
  } catch {}
  return _userId;
}

// Fetch the set of existing tab names that currently have cards
export async function getExistingTabs() {
  const list = await base44.entities.DatabaseCard.list('-updated_date', 500);
  const tabs = new Set();
  (list || []).forEach((c) => { if (c.tab) tabs.add(c.tab); });
  return [...tabs];
}

// Lightweight tab list built from Tag entities only (no card load).
export async function getTabsFromTags() {
  const list = await base44.entities.Tag.list().catch(() => []);
  const tabSet = new Set();
  (list || []).forEach((t) => { if (t.tab) tabSet.add(t.tab); });
  return [...tabSet].sort((a, b) => a.localeCompare(b));
}

// Unread comment count without loading all cards (comments + reads only).
export async function getUnreadCount() {
  const uid = await getUserId();
  const [comments, reads] = await Promise.all([
    base44.entities.CardComment.list(),
    base44.entities.CommentRead.list(),
  ]);
  const readByCard = new Map();
  (reads || []).forEach((r) => {
    if (r.created_by_id === uid) readByCard.set(r.card_id, new Date(r.last_read_date).getTime());
  });
  const unread = new Set();
  (comments || []).forEach((c) => {
    const readDate = readByCard.get(c.card_id);
    const commentDate = new Date(c.created_date).getTime();
    if (!readDate || commentDate > readDate) unread.add(c.card_id);
  });
  return unread.size;
}

// True if a card's cost matches any of the selected cost buckets (10 = "10+").
export function cardMatchesCost(cardCost, selectedCosts) {
  if (!selectedCosts || selectedCosts.length === 0) return true;
  const raw = cardCost === null || cardCost === undefined || cardCost === '' ? 0 : Number(cardCost);
  const c = Number.isNaN(raw) ? 0 : raw;
  return selectedCosts.some((s) => (s === 10 ? c >= 10 : c === s));
}

// Save a card (PNG canvas + CS data) to the database, overriding same-named cards
// while pushing the previous version into CardVersion history.
export async function saveCardToDatabase({ name, template, tab, tags, pngCanvas, csData, needsReview }) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Card name is required');

  // 1. Upload PNG
  const pngBlob = await new Promise((res) => pngCanvas.toBlob(res, 'image/png'));
  const pngFile = new File([pngBlob], `${trimmed}.png`, { type: 'image/png' });
  const { file_url: png_url } = await base44.integrations.Core.UploadFile({ file: pngFile });

  // 2. Upload CS
  const csPayload = { type: 'cardsmith', version: 1, template, data: csData };
  const csBlob = new Blob([JSON.stringify(csPayload, null, 2)], { type: 'application/json' });
  const csFile = new File([csBlob], `${trimmed}.cs`, { type: 'application/json' });
  const { file_url: cs_url } = await base44.integrations.Core.UploadFile({ file: csFile });

  // 3. Find existing card with same name
  const existing = await base44.entities.DatabaseCard.filter({ name: trimmed });
  const prev = existing && existing.length > 0 ? existing[0] : null;

  const finalTab = (tab || defaultTabForTemplate(template)).trim() || 'General';
  const cost = deriveCardCost(template, csData);

  let cardId;
  if (prev) {
    // Push previous live version into history
    const prevVersions = await base44.entities.CardVersion.filter({ card_id: prev.id });
    const nextVersion = (prevVersions || []).reduce((m, v) => Math.max(m, v.version_number || 0), 0) + 1;
    await base44.entities.CardVersion.create({
      card_id: prev.id,
      version_number: nextVersion,
      png_url: prev.png_url,
      cs_url: prev.cs_url,
    });
    await base44.entities.DatabaseCard.update(prev.id, {
      template,
      tab: finalTab,
      tags: Array.isArray(tags) ? tags : [],
      cost,
      png_url,
      cs_url,
      needs_review: !!needsReview,
    });
    cardId = prev.id;
  } else {
    const created = await base44.entities.DatabaseCard.create({
      name: trimmed,
      template,
      tab: finalTab,
      tags: Array.isArray(tags) ? tags : [],
      cost,
      png_url,
      cs_url,
      needs_review: !!needsReview,
    });
    cardId = created.id;
  }

  // 4. Needs review → post a comment
  if (needsReview) {
    await base44.entities.CardComment.create({ card_id: cardId, text: 'Needs Review' });
  }

  return { id: cardId, name: trimmed, png_url, cs_url };
}

// Upload an external PNG (and optional CS file) as a DatabaseCard, overriding
// any existing card with the same name. Used by the Decks "Add Card" flow.
export async function saveUploadedCard({ name, tab, tags, cost, pngFile, csFile }) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Card name is required');
  const pngName = `${trimmed}.png`;
  const { file_url: png_url } = await base44.integrations.Core.UploadFile({
    file: new File([pngFile], pngName, { type: pngFile.type || 'image/png' }),
  });
  let cs_url = '';
  if (csFile) {
    const csName = `${trimmed}.cs`;
    const { file_url } = await base44.integrations.Core.UploadFile({
      file: new File([csFile], csName, { type: csFile.type || 'application/octet-stream' }),
    });
    cs_url = file_url;
  }
  const finalTab = (tab || 'General').trim() || 'General';
  const existing = await base44.entities.DatabaseCard.filter({ name: trimmed });
  const prev = existing && existing.length > 0 ? existing[0] : null;
  const payload = {
    template: 'uploaded',
    tab: finalTab,
    tags: Array.isArray(tags) ? tags : [],
    cost: Number(cost) || 0,
    png_url,
    cs_url,
    needs_review: false,
  };
  if (prev) {
    await base44.entities.DatabaseCard.update(prev.id, payload);
    return { id: prev.id, name: trimmed, png_url, cs_url };
  }
  const created = await base44.entities.DatabaseCard.create({ name: trimmed, ...payload });
  return { id: created.id, name: trimmed, png_url, cs_url };
}

// Mark all comments on a card as read for the current user
export async function markCardRead(cardId) {
  const uid = await getUserId();
  const now = new Date().toISOString();
  const mine = await base44.entities.CommentRead.filter({ card_id: cardId });
  const own = (mine || []).find((r) => r.created_by_id === uid);
  if (own) {
    await base44.entities.CommentRead.update(own.id, { last_read_date: now });
  } else {
    await base44.entities.CommentRead.create({ card_id: cardId, last_read_date: now });
  }
}

// Returns array of card IDs the current user has unread comments on
export async function getUnreadCardIds() {
  const uid = await getUserId();
  const [cards, comments, reads] = await Promise.all([
    base44.entities.DatabaseCard.list(),
    base44.entities.CardComment.list(),
    base44.entities.CommentRead.list(),
  ]);
  const readByCard = new Map();
  (reads || []).forEach((r) => {
    if (r.created_by_id === uid) readByCard.set(r.card_id, new Date(r.last_read_date).getTime());
  });
  const unread = new Set();
  (comments || []).forEach((c) => {
    const readDate = readByCard.get(c.card_id);
    const commentDate = new Date(c.created_date).getTime();
    if (!readDate || commentDate > readDate) unread.add(c.card_id);
  });
  return { unreadIds: unread, cards, comments };
}

// ---- Tags ----

// Fetch the tag names that belong to a given tab
export async function getTagsForTab(tab) {
  const list = await base44.entities.Tag.filter({ tab });
  return (list || []).map((t) => ({ name: t.name, color: t.color, icon: t.icon }));
}

// Create a new tag for a tab (no-op if an identical tag already exists)
export async function createTag(name, tab, { color, icon } = {}) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const existing = await base44.entities.Tag.filter({ name: trimmed, tab });
  if (existing && existing.length > 0) return existing[0];
  return base44.entities.Tag.create({ name: trimmed, tab, color: color || '#6b7280', icon: icon || '' });
}

export async function updateTag(id, data) {
  return base44.entities.Tag.update(id, data);
}

export async function deleteTag(id) {
  return base44.entities.Tag.delete(id);
}

// Tabs are implicit (derived from tag.tab + card.tab). Rename moves every
// tag and card from oldTab to newTab.
export async function renameTab(oldTab, newTab) {
  const trimmed = (newTab || '').trim();
  if (!trimmed || trimmed === oldTab) return;
  const tags = await base44.entities.Tag.filter({ tab: oldTab });
  if (tags && tags.length) await base44.entities.Tag.bulkUpdate(tags.map((t) => ({ id: t.id, tab: trimmed })));
  const cards = await base44.entities.DatabaseCard.filter({ tab: oldTab });
  if (cards && cards.length) await base44.entities.DatabaseCard.bulkUpdate(cards.map((c) => ({ id: c.id, tab: trimmed })));
}

// Deleting a tab removes its tags and reassigns its cards to "General" so
// nothing becomes unreachable.
export async function deleteTab(tab) {
  const tags = await base44.entities.Tag.filter({ tab });
  if (tags && tags.length) await base44.entities.Tag.deleteMany({ tab });
  const cards = await base44.entities.DatabaseCard.filter({ tab });
  if (cards && cards.length) await base44.entities.DatabaseCard.bulkUpdate(cards.map((c) => ({ id: c.id, tab: 'General' })));
}

// Sort a list of DatabaseCards primarily by their first tag, then by name.
// Cards without tags sort last.
export function sortCardsByTags(cards) {
  return [...(cards || [])].sort((a, b) => {
    const ta = (a.tags && a.tags.length > 0) ? a.tags[0] : '\uffff';
    const tb = (b.tags && b.tags.length > 0) ? b.tags[0] : '\uffff';
    if (ta !== tb) return ta.localeCompare(tb);
    return (a.name || '').localeCompare(b.name || '');
  });
}

// ---- Decks ----

export async function getDecks() {
  const list = await base44.entities.Deck.list('-updated_date', 200);
  return list || [];
}

export async function createDeck({ name }) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Deck name is required');
  return base44.entities.Deck.create({ name: trimmed, cards: [] });
}

export async function updateDeck(id, data) {
  return base44.entities.Deck.update(id, data);
}

export async function deleteDeck(id) {
  return base44.entities.Deck.delete(id);
}