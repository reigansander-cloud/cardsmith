import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Minus, Search, Download, Printer, Trash2, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { updateDeck, deleteDeck, sortCardsByTags, getTagsForTab, getTabsFromTags, cardMatchesCost } from '@/lib/databaseApi';
import { exportDeckTTS, exportDeckPrint } from '@/lib/deckExport';
import TagFilterDropdown from '@/components/database/TagFilterDropdown';
import CostFilterDropdown from '@/components/database/CostFilterDropdown';

export default function DeckEditor({ deck, onBack }) {
  const { toast } = useToast();
  const [cards, setCards] = useState(deck.cards || []);
  const [deckCards, setDeckCards] = useState([]);
  const [browseCards, setBrowseCards] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [tabTags, setTabTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedCosts, setSelectedCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [hoverRect, setHoverRect] = useState(null);
  const [filter, setFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deckName, setDeckName] = useState(deck.name);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Mount: load only the deck's referenced cards (by ID) + tabs from tags.
  // The card picker does not load until a tab is selected.
  useEffect(() => {
    (async () => {
      const ids = [...new Set((deck.cards || []).map((e) => e.card_id).filter(Boolean))];
      const [fetched, tabList] = await Promise.all([
        Promise.all(ids.map((id) => base44.entities.DatabaseCard.get(id).catch(() => null))),
        getTabsFromTags(),
      ]);
      setDeckCards(fetched.filter(Boolean));
      setTabs(tabList);
      setLoading(false);
    })();
  }, [deck.id]);

  // When a tab is selected, load that tab's cards + tags for the picker.
  useEffect(() => {
    if (!activeTab) { setBrowseCards([]); setTabTags([]); return; }
    let cancelled = false;
    (async () => {
      setPickerLoading(true);
      const isAll = activeTab === '__all__';
      const [list, tags] = await Promise.all([
        isAll
          ? base44.entities.DatabaseCard.list('-updated_date', 500)
          : base44.entities.DatabaseCard.filter({ tab: activeTab }),
        isAll
          ? base44.entities.Tag.list().catch(() => [])
          : getTagsForTab(activeTab).catch(() => []),
      ]);
      if (cancelled) return;
      setBrowseCards(list || []);
      setTabTags(isAll ? (tags || []).map((t) => ({ name: t.name, color: t.color, icon: t.icon })) : tags);
      setPickerLoading(false);
      setSelectedTags([]);
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  const cardById = useMemo(() => {
    const m = new Map();
    (deckCards || []).forEach((c) => m.set(c.id, c));
    return m;
  }, [deckCards]);

  const deckEntries = useMemo(
    () => cards.map((e) => ({ ...e, card: cardById.get(e.card_id) })).filter((e) => e.card),
    [cards, cardById]
  );

  const persist = (next) => setCards(next);

  const handleBack = async () => {
    try {
      await updateDeck(deck.id, { cards });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
    onBack();
  };

  const startRename = () => { setNameInput(deckName); setEditingName(true); };
  const commitRename = async () => {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (!trimmed || trimmed === deckName) return;
    try {
      await updateDeck(deck.id, { name: trimmed });
      setDeckName(trimmed);
      toast({ title: 'Deck renamed' });
    } catch (err) {
      toast({ title: 'Rename failed', description: err.message, variant: 'destructive' });
    }
  };

  const addCard = (cardId) => {
    const picked = browseCards.find((c) => c.id === cardId);
    if (picked && !cardById.has(cardId)) setDeckCards((prev) => [...prev, picked]);
    const existing = cards.find((e) => e.card_id === cardId);
    const next = existing
      ? cards.map((e) => (e.card_id === cardId ? { ...e, copies: e.copies + 1 } : e))
      : [...cards, { card_id: cardId, copies: 1 }];
    persist(next);
  };

  const increment = (cardId) => {
    persist(cards.map((e) => (e.card_id === cardId ? { ...e, copies: e.copies + 1 } : e)));
  };

  const decrement = (cardId) => {
    const existing = cards.find((e) => e.card_id === cardId);
    if (!existing) return;
    let next;
    if (existing.copies <= 1) next = cards.filter((e) => e.card_id !== cardId);
    else next = cards.map((e) => (e.card_id === cardId ? { ...e, copies: e.copies - 1 } : e));
    persist(next);
  };

  const filteredDb = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let list = sortCardsByTags(browseCards);
    if (f) {
      list = list.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(f) ||
          (c.tags || []).some((t) => t.toLowerCase().includes(f))
      );
    }
    if (selectedTags.length > 0) {
      list = list.filter((c) => selectedTags.every((t) => (c.tags || []).includes(t)));
    }
    if (selectedCosts.length > 0) {
      list = list.filter((c) => cardMatchesCost(c.cost, selectedCosts));
    }
    return list;
  }, [browseCards, filter, selectedTags, selectedCosts]);

  const handleExportTTS = async () => {
    setExporting(true);
    try {
      await exportDeckTTS(deckEntries, deck.name);
      toast({ title: 'TTS export ready' });
    } catch (err) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPrint = async () => {
    setExporting(true);
    try {
      await exportDeckPrint(deckEntries, deck.name);
    } catch (err) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    await deleteDeck(deck.id);
    toast({ title: 'Deck deleted' });
    onBack();
  };

  const totalCopies = deckEntries.reduce((s, e) => s + (e.copies || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <ArrowLeft size={18} />
              </button>
              {editingName ? (
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    else if (e.key === 'Escape') setEditingName(false);
                  }}
                  onBlur={commitRename}
                  autoFocus
                  className="text-lg font-bold font-heading bg-transparent border-b border-primary outline-none px-1 max-w-[220px]"
                />
              ) : (
                <>
                  <h1 className="text-lg font-bold font-heading text-foreground truncate">{deckName}</h1>
                  <button onClick={startRename} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" title="Rename deck">
                    <Pencil size={14} />
                  </button>
                </>
              )}
              <span className="text-xs text-muted-foreground hidden sm:inline flex-shrink-0">{deckEntries.length} unique · {totalCopies} total</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handleExportTTS} disabled={exporting || deckEntries.length === 0}>
                <Download size={14} className="mr-2" /> TTS
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPrint} disabled={exporting || deckEntries.length === 0}>
                <Printer size={14} className="mr-2" /> Print
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={handleDelete} title="Delete deck">
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 lg:h-[calc(100vh-3.5rem)]">
        {/* Deck list */}
        <div className="relative flex flex-col rounded-lg border border-border bg-card overflow-hidden min-h-[240px] lg:min-h-0">
          <div className="px-3 py-2 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Deck ({deckEntries.length})
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-muted-foreground p-3">Loading…</p>
            ) : deckEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">Empty. Add cards from the database →</p>
            ) : (
              <div className="divide-y divide-border">
                {deckEntries.map((e) => (
                  <div
                    key={e.card_id}
                    onMouseEnter={(ev) => { setHoveredId(e.card_id); setHoverRect(ev.currentTarget.getBoundingClientRect()); }}
                    onMouseLeave={() => setHoveredId((h) => (h === e.card_id ? null : h))}
                    className="w-full flex items-center gap-2 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{e.card.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {e.copies}×{e.card.tags && e.card.tags.length ? ' · ' + e.card.tags.join(', ') : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => decrement(e.card_id)}
                      className="w-6 h-6 rounded flex items-center justify-center border border-border hover:bg-muted"
                      title="Remove copy"
                    >
                      <Minus size={12} />
                    </button>
                    <button
                      onClick={() => increment(e.card_id)}
                      className="w-6 h-6 rounded flex items-center justify-center border border-border hover:bg-muted"
                      title="Add copy"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Database column */}
        <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden min-h-[240px] lg:min-h-0">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-wrap">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="h-8 rounded-md border border-border bg-muted/30 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]"
            >
              <option value="">Select tab…</option>
              <option value="__all__">All tabs</option>
              {tabs.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <TagFilterDropdown tags={tabTags} selectedTags={selectedTags} onTagsChange={setSelectedTags} />
            <CostFilterDropdown selectedCosts={selectedCosts} onCostsChange={setSelectedCosts} />
            <div className="relative flex-1 min-w-[140px]">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter cards…"
                className="h-8 pl-7 text-xs bg-muted/30 border-border"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {!activeTab ? (
              <p className="text-xs text-muted-foreground p-3">Select a tab to browse cards.</p>
            ) : pickerLoading ? (
              <p className="text-xs text-muted-foreground p-3">Loading…</p>
            ) : filteredDb.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">No cards match.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredDb.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => addCard(c.id)}
                    className="group rounded-md border border-border overflow-hidden hover:border-primary transition-colors text-left"
                  >
                    {c.png_url ? (
                      <img src={c.png_url} alt={c.name} className="w-full aspect-[3/4] object-contain bg-muted/20" />
                    ) : (
                      <div className="w-full aspect-[3/4] bg-muted/30 flex items-center justify-center text-[10px] text-muted-foreground">No PNG</div>
                    )}
                    <div className="px-1.5 py-1 flex items-center gap-1">
                      <Plus size={11} className="text-muted-foreground flex-shrink-0 group-hover:text-primary" />
                      <p className="text-[11px] font-medium truncate">{c.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {hoveredId && hoverRect && cardById.get(hoveredId)?.png_url && (
        <div
          className="fixed z-50 pointer-events-none hidden lg:block"
          style={{ top: hoverRect.top, left: hoverRect.right + 8 }}
        >
          <img src={cardById.get(hoveredId).png_url} alt="" className="w-56 rounded-lg border border-border shadow-xl bg-card" />
        </div>
      )}
    </div>
  );
}