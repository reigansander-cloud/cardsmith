import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import PipelineEntryCard from './PipelineEntryCard';
import { renderType } from '@/lib/folderPreview';

// Default pipeline column. Cards not assigned to a custom pipeline fall here.
const DEFAULT_PIPELINES = [
  { id: '__deck__', name: 'Deck List', type: 'default' },
];

// Popup showing every deck card organized into pipeline columns, plus
// dedicated tabs for the folder's Battlefield and Income entries (add/remove
// from the deck). Pipeline column orders persist (card_order for the default
// column, each pipeline's card_ids for customs). The dragging card is portaled
// to document.body so it escapes the dialog's centering transform (which would
// otherwise offset it from the cursor).
export default function DeckPipelinesDialog({ open, onOpenChange, deckEntries, folderEntries, supertypes, folderColorMap, pipelines, onPipelinesChange, cardOrder, onCardOrderChange, onAdd, onIncrement, onDecrement }) {
  const [tab, setTab] = useState('pipelines');
  const customPipelines = pipelines || [];

  const isHiddenType = (entry) => {
    const rt = renderType(entry, supertypes);
    return rt === 'battlefield' || rt === 'income';
  };

  const customAssignment = useMemo(() => {
    const m = {};
    customPipelines.forEach((p) => (p.card_ids || []).forEach((cid) => { m[cid] = p.id; }));
    return m;
  }, [customPipelines]);

  const byId = useMemo(() => {
    const m = {};
    (deckEntries || []).forEach((c) => { m[c.card_id] = c; });
    return m;
  }, [deckEntries]);

  const deckCountMap = useMemo(() => {
    const m = {};
    (deckEntries || []).forEach((c) => { m[c.card_id] = c.copies; });
    return m;
  }, [deckEntries]);

  const allPipelines = useMemo(
    () => [...DEFAULT_PIPELINES, ...customPipelines.map((p) => ({ id: p.id, name: p.name, type: 'custom' }))],
    [customPipelines]
  );

  const cardsByPipeline = useMemo(() => {
    const map = {};
    allPipelines.forEach((p) => { map[p.id] = []; });
    // Custom pipelines render in their stored card_ids order; battlefields and
    // income are hidden from pipeline columns (they live in their own tabs).
    customPipelines.forEach((p) => {
      (p.card_ids || []).forEach((cid) => {
        const c = byId[cid];
        if (c && !isHiddenType(c.entry)) map[p.id].push(c);
      });
    });
    // Default column: stored card_order first, then any deck cards not yet
    // tracked (e.g. newly added) appended in deck order. Hidden types skipped.
    const seen = new Set();
    (cardOrder || []).forEach((cid) => {
      const c = byId[cid];
      if (c && !customAssignment[cid] && !isHiddenType(c.entry)) { map['__deck__'].push(c); seen.add(cid); }
    });
    (deckEntries || []).forEach((c) => {
      if (!seen.has(c.card_id) && !customAssignment[c.card_id] && !isHiddenType(c.entry)) map['__deck__'].push(c);
    });
    return map;
  }, [deckEntries, customAssignment, customPipelines, allPipelines, cardOrder, byId, supertypes]);

  const bfEntries = useMemo(
    () => (folderEntries || []).filter((e) => renderType(e, supertypes) === 'battlefield'),
    [folderEntries, supertypes]
  );
  const incomeEntries = useMemo(
    () => (folderEntries || []).filter((e) => renderType(e, supertypes) === 'income'),
    [folderEntries, supertypes]
  );

  const bfInDeck = useMemo(
    () => (deckEntries || []).some((c) => renderType(c.entry, supertypes) === 'battlefield'),
    [deckEntries, supertypes]
  );
  const incomeInDeck = useMemo(
    () => (deckEntries || []).some((c) => renderType(c.entry, supertypes) === 'income'),
    [deckEntries, supertypes]
  );

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const srcCol = source.droppableId;
    const destCol = destination.droppableId;
    const destList = cardsByPipeline[destCol] || [];

    if (srcCol === destCol) {
      if (destCol === '__deck__') {
        const ids = destList.map((c) => c.card_id);
        const [moved] = ids.splice(source.index, 1);
        ids.splice(destination.index, 0, moved);
        onCardOrderChange(ids);
      } else {
        const next = customPipelines.map((p) => ({ ...p, card_ids: [...(p.card_ids || [])] }));
        const pipe = next.find((p) => p.id === destCol);
        if (pipe) {
          const ids = pipe.card_ids;
          const [moved] = ids.splice(source.index, 1);
          ids.splice(destination.index, 0, moved);
        }
        onPipelinesChange(next);
      }
      return;
    }

    const nextPipelines = customPipelines.map((p) => ({ ...p, card_ids: (p.card_ids || []).filter((id) => id !== draggableId) }));
    let nextCardOrder = [...(cardOrder || [])];

    if (srcCol === '__deck__') {
      nextCardOrder = nextCardOrder.filter((id) => id !== draggableId);
    }
    if (destCol === '__deck__') {
      const ids = destList.map((c) => c.card_id);
      ids.splice(destination.index, 0, draggableId);
      nextCardOrder = ids;
    } else {
      const target = nextPipelines.find((p) => p.id === destCol);
      if (target) {
        const ids = [...target.card_ids];
        ids.splice(destination.index, 0, draggableId);
        target.card_ids = ids;
      }
    }

    if (srcCol === '__deck__' || destCol === '__deck__') onCardOrderChange(nextCardOrder);
    onPipelinesChange(nextPipelines);
  };

  const addPipeline = () => {
    const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    onPipelinesChange([...customPipelines, { id, name: 'New Pipeline', card_ids: [] }]);
  };
  const renamePipeline = (id, name) => onPipelinesChange(customPipelines.map((p) => (p.id === id ? { ...p, name } : p)));
  const deletePipeline = (id) => onPipelinesChange(customPipelines.filter((p) => p.id !== id));

  const renderEntryGrid = (list) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 overflow-y-auto max-h-[68vh] no-scrollbar p-1">
      {list.length === 0 ? (
        <p className="col-span-full text-xs text-muted-foreground p-3">No entries in this folder.</p>
      ) : list.map((e) => {
        const copies = deckCountMap[e.id] || 0;
        return (
          <div key={e.id} className={copies === 0 ? 'opacity-40' : ''}>
            <PipelineEntryCard
              entry={e}
              copies={copies}
              onAdd={() => onAdd(e.id)}
              onIncrement={() => onIncrement(e.id)}
              onDecrement={() => onDecrement(e.id)}
              supertypes={supertypes}
              folderColor={folderColorMap[e.folder_id] || ''}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw]">
        <div className="flex items-center justify-between mb-3">
          <DialogTitle>Deck Pipelines</DialogTitle>
          <div className="flex gap-2 pr-8">
            <Button variant={tab === 'pipelines' ? 'default' : 'outline'} size="sm" onClick={() => setTab('pipelines')}>Pipelines</Button>
            <Button variant={tab === 'battlefields' ? 'default' : 'outline'} size="sm" onClick={() => setTab('battlefields')} className={bfInDeck ? '' : 'opacity-50'}>Battlefields</Button>
            <Button variant={tab === 'income' ? 'default' : 'outline'} size="sm" onClick={() => setTab('income')} className={incomeInDeck ? '' : 'opacity-50'}>Income</Button>
          </div>
        </div>

        {tab === 'pipelines' && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {allPipelines.map((p) => (
                <Droppable droppableId={p.id} key={p.id}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="w-52 flex-shrink-0 rounded-lg border border-border bg-card/50 flex flex-col max-h-[68vh]">
                      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
                        {p.type === 'custom' ? (
                          <Input
                            value={p.name}
                            onChange={(e) => renamePipeline(p.id, e.target.value)}
                            className="h-7 text-xs font-semibold border-transparent bg-transparent px-0 focus-visible:border-border"
                          />
                        ) : (
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{p.name}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">{(cardsByPipeline[p.id] || []).reduce((sum, c) => sum + (c.copies || 0), 0)}</span>
                        {p.type === 'custom' && (
                          <button onClick={() => deletePipeline(p.id)} className="text-muted-foreground hover:text-destructive" title="Delete pipeline">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 min-h-[100px] no-scrollbar">
                        {(cardsByPipeline[p.id] || []).map((c, idx) => (
                          <Draggable draggableId={c.card_id} index={idx} key={c.card_id}>
                            {(prov, snapshot) => {
                              const node = (
                                <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} className={snapshot.isDragging ? 'shadow-2xl rounded-lg' : ''}>
                                  <PipelineEntryCard
                                    entry={c.entry}
                                    copies={c.copies}
                                    onIncrement={() => onIncrement(c.card_id)}
                                    onDecrement={() => onDecrement(c.card_id)}
                                    supertypes={supertypes}
                                    folderColor={folderColorMap[c.entry.folder_id] || ''}
                                  />
                                </div>
                              );
                              return snapshot.isDragging ? createPortal(node, document.body) : node;
                            }}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
              <div className="w-40 flex-shrink-0 flex items-start pt-3">
                <Button variant="outline" size="sm" onClick={addPipeline}>
                  <Plus size={14} className="mr-1" /> Add Pipeline
                </Button>
              </div>
            </div>
          </DragDropContext>
        )}

        {tab === 'battlefields' && renderEntryGrid(bfEntries)}
        {tab === 'income' && renderEntryGrid(incomeEntries)}
      </DialogContent>
    </Dialog>
  );
}