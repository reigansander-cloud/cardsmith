import React, { useRef, useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Copy, Shapes, Pencil, Eraser, Move, Folder, ChevronDown, ChevronRight, Edit3, Sparkles, Eye, EyeOff, Wrench, Type, Crown } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import AddShapeDialog from './AddShapeDialog';
import ImageEffectsEditor from './ImageEffectsEditor';
import LayerPreview from './LayerPreview';
import ToolLayerDialog from './ToolLayerDialog';
import CostBarEditor from './CostBarEditor';
import GridLayerEditor from './GridLayerEditor';
import { useCustomFonts } from '@/lib/customFonts';
import { Slider } from '@/components/ui/slider';
import { useUploadedIcons } from '@/hooks/useUploadedIcons';
import { addCollected } from '@/lib/freeCanvasAssetsStore';
import SavedColorPicker from './SavedColorPicker';
import { useSavedColors } from '@/hooks/useFreeCanvasAssets';

const FONT_OPTIONS = [
  { value: '"Inter", sans-serif', label: 'Inter' },
  { value: '"Albert Sans", sans-serif', label: 'Albert Sans' },
  { value: '"JetBrains Mono", monospace', label: 'JetBrains Mono' },
  { value: '"Poiret One", cursive', label: 'Poiret One' },
  { value: 'Rye, cursive', label: 'Rye' },
  { value: 'CaesarDressing, cursive', label: 'Caesar Dressing' },
];

const genId = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function FreeCanvasEditor({ data, onChange, onNameChange, selectedIds, onSelectElements, shrunkIds, mode = 'all' }) {
  const fileRef = useRef(null);
  const textContentRef = useRef(null);
  const [showShapeDialog, setShowShapeDialog] = useState(false);
  const [showToolDialog, setShowToolDialog] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [layerCtx, setLayerCtx] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!layerCtx) return;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setLayerCtx(null);
    };
    const onScroll = () => setLayerCtx(null);
    const onKey = (e) => { if (e.key === 'Escape') setLayerCtx(null); };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [layerCtx]);
  const elements = data?.elements || [];
  const cw = data?.cardWidth || 360;
  const ch = data?.cardHeight || 504;
  const selected = selectedIds.length === 1 ? elements.find(el => el.id === selectedIds[0] && el.type !== 'folder') : null;
  const { fonts: customFonts } = useCustomFonts();
  const fontOptions = [...FONT_OPTIONS, ...customFonts.map(f => ({ value: `"${f.name}", sans-serif`, label: f.name }))];
  const uploadedIcons = useUploadedIcons();
  const savedColors = useSavedColors();

  // When a text layer is first selected, focus its content and select all so typing replaces it.
  useEffect(() => {
    if (selected?.type !== 'text') return;
    const ta = textContentRef.current;
    if (!ta) return;
    const raf = requestAnimationFrame(() => { ta.focus(); ta.select(); });
    return () => cancelAnimationFrame(raf);
  }, [selected?.id, selected?.type]);

  const update = (fields) => onChange({ ...data, ...fields });

  const updateElement = (id, fields) => {
    update({ elements: elements.map(el => el.id === id ? { ...el, ...fields } : el) });
  };

  const toggleTitleCrown = () => {
    if (!selected) return;
    if (selected.titleCrown) {
      updateElement(selected.id, { titleCrown: false });
    } else {
      update({ elements: elements.map(el => ({ ...el, titleCrown: el.id === selected.id })) });
    }
  };

  const toggleCostCrown = () => {
    if (!selected) return;
    if (selected.costCrown) {
      updateElement(selected.id, { costCrown: false });
    } else {
      update({ elements: elements.map(el => ({ ...el, costCrown: el.id === selected.id })) });
    }
  };

  const removeElement = (id) => {
    update({
      elements: elements
        .filter(el => el.id !== id)
        .map(el => el.folderId === id ? { ...el, folderId: undefined } : el),
      connections: (data.connections || []).filter(c => c.fromId !== id && c.toId !== id),
    });
    if (selectedIds.includes(id)) onSelectElements?.(selectedIds.filter(x => x !== id));
  };

  // Folder helpers
  const topLevelItems = elements.filter(el => el.type === 'folder' || !el.folderId);
  const getChildren = (folderId) => elements.filter(el => el.folderId === folderId);

  const createFolder = () => {
    const folderId = genId();
    const folder = { id: folderId, type: 'folder', name: 'Folder', collapsed: false };
    const selectedEls = selectedIds.filter(id => elements.find(e => e.id === id)?.type !== 'folder');
    if (selectedEls.length === 0) return;
    const newElements = [folder, ...elements.map(el =>
      selectedEls.includes(el.id) ? { ...el, folderId } : el
    )];
    update({ elements: newElements });
    onSelectElements?.([folderId]);
  };

  const toggleCollapse = (folderId) => {
    const folder = elements.find(el => el.id === folderId);
    updateElement(folderId, { collapsed: !folder?.collapsed });
  };

  const collectElement = (elId) => {
    const el = elId ? elements.find(e => e.id === elId) : null;

    // Folder collection: children become a popover of individual buttons
    if (el?.type === 'folder') {
      const children = getChildren(elId);
      if (children.length === 0) return;
      addCollected({
        name: el.name || 'Folder',
        type: 'folder',
        elements: children.map(child => {
          const { id, folderId, ...rest } = child;
          return JSON.parse(JSON.stringify(rest));
        }),
      });
      const childIds = new Set(children.map(c => c.id));
      update({
        elements: elements.filter(e => e.id !== elId && !childIds.has(e.id)),
        connections: (data.connections || []).filter(c => !childIds.has(c.fromId) && !childIds.has(c.toId)),
      });
      onSelectElements?.(selectedIds.filter(x => x !== elId && !childIds.has(x)));
      return;
    }

    // Multi-select: if the clicked element is part of a multi-selection, collect all selected
    const targetIds = (elId && selectedIds.length > 1 && selectedIds.includes(elId)) ? selectedIds : (elId ? [elId] : selectedIds);
    const selectedEls = elements.filter(e => targetIds.includes(e.id) && e.type !== 'folder');
    if (selectedEls.length === 0) return;
    addCollected({
      name: layerLabel(selectedEls[0]),
      type: 'group',
      elements: selectedEls.map(e => {
        const { id, folderId, ...rest } = e;
        return JSON.parse(JSON.stringify(rest));
      }),
    });
    const collectedIds = new Set(selectedEls.map(e => e.id));
    update({
      elements: elements
        .filter(e => !collectedIds.has(e.id))
        .map(e => collectedIds.has(e.folderId) ? { ...e, folderId: undefined } : e),
      connections: (data.connections || []).filter(c => !collectedIds.has(c.fromId) && !collectedIds.has(c.toId)),
    });
    onSelectElements?.(selectedIds.filter(x => !collectedIds.has(x)));
  };

  const startRename = (el) => {
    setRenamingId(el.id);
    setRenameValue(el.name || (el.type === 'text' ? (el.content || '').slice(0, 20) : ''));
  };

  const commitRename = () => {
    if (renamingId) {
      const trimmed = renameValue.trim();
      if (trimmed) updateElement(renamingId, { name: trimmed });
      setRenamingId(null);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const srcFolder = source.droppableId === 'elements' ? null : source.droppableId.replace('folder-', '');
    const dstFolder = destination.droppableId === 'elements' ? null : destination.droppableId.replace('folder-', '');

    let element;
    if (srcFolder === null) {
      element = topLevelItems[source.index];
    } else {
      element = getChildren(srcFolder)[source.index];
    }
    if (!element) return;
    if (element.type === 'folder' && dstFolder !== null) return; // can't nest folders

    // Remove element from its current list
    let newTopLevel = topLevelItems.filter(el => el.id !== element.id);
    const childrenMap = {};
    for (const folder of elements.filter(el => el.type === 'folder')) {
      childrenMap[folder.id] = getChildren(folder.id).filter(el => el.id !== element.id);
    }

    const updatedElement = { ...element, folderId: dstFolder };

    if (dstFolder === null) {
      newTopLevel.splice(destination.index, 0, updatedElement);
    } else {
      if (!childrenMap[dstFolder]) childrenMap[dstFolder] = [];
      childrenMap[dstFolder].splice(destination.index, 0, updatedElement);
    }

    // Rebuild flat elements array: top-level items followed by their children
    const newElements = [];
    for (const item of newTopLevel) {
      newElements.push(item);
      if (item.type === 'folder') {
        newElements.push(...(childrenMap[item.id] || []));
      }
    }
    update({ elements: newElements });
  };

  const loadAspectRatio = (url) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width / img.height);
    img.onerror = () => resolve(1);
    img.src = url;
  });

  const insertElement = (newEl) => {
    const idx = selectedIds.length > 0 ? elements.findIndex(el => el.id === selectedIds[0]) : -1;
    const insertAt = idx >= 0 ? idx : 0;
    const newElements = [...elements];
    newElements.splice(insertAt, 0, newEl);
    update({ elements: newElements });
    onSelectElements?.([newEl.id]);
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newEls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const aspectRatio = await loadAspectRatio(file_url);
      newEls.push({
        id: genId(),
        type: 'image',
        name: file.name.replace(/\.[^.]+$/, ''),
        x: 10, y: 10, width: Math.round(cw * 0.5),
        aspectRatio,
        url: file_url,
      });
    }
    if (newEls.length === 0) return;
    const idx = selectedIds.length > 0 ? elements.findIndex(el => el.id === selectedIds[0]) : -1;
    const insertAt = idx >= 0 ? idx : 0;
    const newElements = [...elements];
    newElements.splice(insertAt, 0, ...newEls);
    update({ elements: newElements });
    onSelectElements?.([newEls[newEls.length - 1].id]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const addText = () => {
    insertElement({
      id: genId(),
      type: 'text',
      x: Math.round(cw * 0.2), y: Math.round(ch * 0.2), width: Math.round(cw * 0.6), height: Math.round(ch * 0.15),
      content: 'New text',
      fontSize: 14,
      fontFamily: '"Inter", sans-serif',
      color: '#000000',
      align: 'left',
      bold: false,
      italic: false,
      underline: false,
      shrinkToFit: true,
    });
  };

  const addShape = (config) => {
    insertElement({
      id: genId(),
      type: 'shape',
      x: Math.round(cw * 0.3), y: Math.round(ch * 0.3), width: Math.round(cw * 0.3), height: Math.round(ch * 0.3),
      shape: config.shape,
      filled: config.filled,
      strokeWidth: config.strokeWidth,
      color: config.color,
    });
  };

  const addDrawing = () => {
    const newEl = {
      id: genId(),
      type: 'drawing',
      x: 0, y: 0, width: cw, height: ch, rotation: 0,
      strokes: [],
      drawColor: '#000000',
      drawSize: 6,
      tool: 'brush',
      pixelArt: false,
      pixelSize: 16,
    };
    update({ elements: [newEl, ...elements] });
    onSelectElements?.([newEl.id]);
  };

  const addCostBar = () => {
    insertElement({
      id: genId(),
      type: 'costbar',
      x: Math.round(cw * 0.2), y: Math.round(ch * 0.2), width: Math.round(cw * 0.3), height: Math.round(ch * 0.1), rotation: 0,
      costs: [],
      align: 'left',
    });
  };

  const addGrid = () => {
    insertElement({
      id: genId(),
      type: 'grid',
      x: Math.round(cw * 0.2), y: Math.round(ch * 0.2), width: Math.round(cw * 0.3), height: Math.round(ch * 0.3), rotation: 0,
      grids: [{ rows: 3, cols: 3, origin: { row: 1, col: 1 }, cells: {} }],
      connections: [],
    });
  };

  const addTool = (kind) => {
    setShowToolDialog(false);
    if (kind === 'costbar') addCostBar();
    else if (kind === 'grid') addGrid();
  };

  const applyFormat = (tag) => {
    if (!selected || selected.type !== 'text') return;
    const ta = textContentRef.current;
    const content = selected.content || '';
    const open = `[${tag}]`, close = `[/${tag}]`;
    if (ta) {
      const start = ta.selectionStart ?? content.length;
      const end = ta.selectionEnd ?? content.length;
      if (start !== end) {
        const sel = content.slice(start, end);
        if (sel.startsWith(open) && sel.endsWith(close)) {
          const inner = sel.slice(open.length, sel.length - close.length);
          const next = content.slice(0, start) + inner + content.slice(end);
          updateElement(selected.id, { content: next });
          requestAnimationFrame(() => { ta.selectionStart = start; ta.selectionEnd = start + inner.length; ta.focus(); });
        } else {
          const next = content.slice(0, start) + open + sel + close + content.slice(end);
          updateElement(selected.id, { content: next });
          requestAnimationFrame(() => { ta.selectionStart = start + open.length; ta.selectionEnd = end + open.length; ta.focus(); });
        }
        return;
      }
    }
    if (tag === 'b') updateElement(selected.id, { bold: !selected.bold });
    else if (tag === 'i') updateElement(selected.id, { italic: !selected.italic });
    else if (tag === 'u') updateElement(selected.id, { underline: !selected.underline });
  };

  const insertTextIconTag = (url) => {
    const tag = `[icon:${url}]`;
    const current = selected.content || '';
    const el = textContentRef.current;
    if (el) {
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const next = current.slice(0, start) + tag + current.slice(end);
      updateElement(selected.id, { content: next });
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + tag.length;
        el.focus();
      });
    } else {
      updateElement(selected.id, { content: current + tag });
    }
  };

  const duplicateElement = (id) => {
    const idx = elements.findIndex(el => el.id === id);
    if (idx < 0) return;
    const orig = elements[idx];
    if (orig.type === 'folder') {
      const newFolderId = genId();
      const newFolder = { ...orig, id: newFolderId, name: `${orig.name || 'Folder'} copy`, collapsed: false };
      const children = getChildren(id);
      const newChildren = children.map(child => ({
        ...child, id: genId(), folderId: newFolderId, x: child.x + 10, y: child.y + 10,
      }));
      const newElements = [...elements];
      newElements.splice(idx, 0, newFolder, ...newChildren);
      update({ elements: newElements });
      onSelectElements?.([newFolderId, ...newChildren.map(c => c.id)]);
    } else {
      const copy = { ...orig, id: genId(), x: orig.x + 10, y: orig.y + 10 };
      const newElements = [...elements];
      newElements.splice(idx, 0, copy);
      update({ elements: newElements });
      onSelectElements?.([copy.id]);
    }
  };

  const layerLabel = (el) => {
    if (el.type === 'folder') return el.name || 'Folder';
    if (el.type === 'image') return el.name || 'Image';
    if (el.type === 'shape') return (el.shape || 'rectangle').charAt(0).toUpperCase() + (el.shape || 'rectangle').slice(1);
    if (el.type === 'drawing') return 'Drawing';
    if (el.type === 'costbar') return 'Cost Bar';
    if (el.type === 'grid') return 'Grid';
    return (el.content || '').slice(0, 24) || 'empty';
  };

  const handleLayerContextMenu = (e, el) => {
    e.preventDefault();
    e.stopPropagation();
    setLayerCtx({ id: el.id, x: e.clientX, y: e.clientY });
  };

  const closeLayerCtx = () => setLayerCtx(null);

  const layerCtxEl = layerCtx ? elements.find(e => e.id === layerCtx.id) : null;

  const renameInput = (
    <input
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      onBlur={commitRename}
      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
      onClick={(e) => e.stopPropagation()}
      autoFocus
      className="text-xs flex-1 bg-muted/30 border border-primary rounded px-1 py-0.5 focus:outline-none min-w-0"
    />
  );

  const renderLayerRow = (el, prov, onClickHandler, selectedClass) => (
    <div
      ref={prov.innerRef}
      {...prov.draggableProps}
      className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors border ${selectedClass} ${el.hidden ? 'opacity-40' : ''}`}
      onClick={onClickHandler}
      onContextMenu={(e) => handleLayerContextMenu(e, el)}
    >
      <span {...prov.dragHandleProps} onClick={(e) => e.stopPropagation()} className="flex items-center cursor-grab active:cursor-grabbing" title="Drag to reorder">
        <LayerPreview el={el} />
      </span>
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {renamingId === el.id ? renameInput : <span className="text-xs flex-1 truncate">{layerLabel(el)}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-3 [&>*]:bg-card [&>*]:border [&>*]:border-border [&>*]:rounded-lg [&>*]:p-4">
      {mode !== 'properties' && (
      <div className="grid grid-cols-5 gap-1">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="h-9 p-0" title="Upload image">
          <Upload size={16} />
        </Button>
        <Button variant="outline" size="sm" onClick={addText} className="h-9 p-0" title="Add text">
          <Type size={16} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowShapeDialog(true)} className="h-9 p-0" title="Add shape">
          <Shapes size={16} />
        </Button>
        <Button variant="outline" size="sm" onClick={addDrawing} className="h-9 p-0" title="Add drawing">
          <Pencil size={16} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowToolDialog(true)} className="h-9 p-0" title="Add tool layer">
          <Wrench size={16} />
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>
      )}

      {mode !== 'properties' && elements.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Elements</Label>
            <Button variant="ghost" size="sm" onClick={createFolder} disabled={selectedIds.length === 0} className="h-6 px-2 text-xs">
              <Folder size={12} className="mr-1" /> Folder
            </Button>
          </div>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="elements">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                  {topLevelItems.map((el, index) => (
                    <Draggable key={el.id} draggableId={el.id} index={index}>
                      {(prov) => {
                        if (el.type === 'folder') {
                          return (
                            <div ref={prov.innerRef} {...prov.draggableProps}>
                              <div
                                className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors border ${
                                  selectedIds.includes(el.id) ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/50 border-transparent'
                                }`}
                                onClick={(e) => {
                                  const childIds = getChildren(el.id).map(c => c.id);
                                  const allIds = [el.id, ...childIds];
                                  if (e.ctrlKey || e.metaKey) {
                                    if (selectedIds.includes(el.id)) {
                                      onSelectElements?.(selectedIds.filter(x => !allIds.includes(x)));
                                    } else {
                                      onSelectElements?.([...new Set([...selectedIds, ...allIds])]);
                                    }
                                  } else {
                                    onSelectElements?.(allIds);
                                  }
                                }}
                                onContextMenu={(e) => handleLayerContextMenu(e, el)}
                              >
                                <span {...prov.dragHandleProps} onClick={(e) => e.stopPropagation()} className="flex items-center cursor-grab active:cursor-grabbing" title="Drag to reorder">
                                  <button onClick={(e) => { e.stopPropagation(); toggleCollapse(el.id); }} className="text-muted-foreground hover:text-foreground">
                                    {el.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                  <Folder size={16} className="text-muted-foreground flex-shrink-0" />
                                </span>
                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                  {renamingId === el.id ? renameInput : <span className="text-xs flex-1 truncate">{el.name || 'Folder'}</span>}
                                </div>
                              </div>
                              {!el.collapsed && (
                                <Droppable droppableId={`folder-${el.id}`}>
                                  {(childProv) => (
                                    <div ref={childProv.innerRef} {...childProv.droppableProps} className="ml-4 space-y-1">
                                      {getChildren(el.id).map((child, childIndex) => (
                                        <Draggable key={child.id} draggableId={child.id} index={childIndex}>
                                          {(cProv) => renderLayerRow(
                                            child,
                                            cProv,
                                            (e) => {
                                              if (e.ctrlKey || e.metaKey) {
                                                if (selectedIds.includes(child.id)) {
                                                  onSelectElements?.(selectedIds.filter(x => x !== child.id));
                                                } else {
                                                  onSelectElements?.([...selectedIds, child.id]);
                                                }
                                              } else {
                                                onSelectElements?.([child.id]);
                                              }
                                            },
                                            selectedIds.includes(child.id) ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/50 border-transparent'
                                          )}
                                        </Draggable>
                                      ))}
                                      {childProv.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              )}
                            </div>
                          );
                        }
                        return renderLayerRow(
                          el,
                          prov,
                          (e) => {
                            if (e.ctrlKey || e.metaKey) {
                              if (selectedIds.includes(el.id)) {
                                onSelectElements?.(selectedIds.filter(x => x !== el.id));
                              } else {
                                onSelectElements?.([...selectedIds, el.id]);
                              }
                            } else if (e.shiftKey && selectedIds.length > 0) {
                              const anchorIdx = topLevelItems.findIndex(x => x.id === selectedIds[0]);
                              if (anchorIdx !== -1) {
                                const [lo, hi] = anchorIdx < index ? [anchorIdx, index] : [index, anchorIdx];
                                onSelectElements?.(topLevelItems.slice(lo, hi + 1).map(x => x.id));
                              } else {
                                onSelectElements?.([el.id]);
                              }
                            } else {
                              onSelectElements?.([el.id]);
                            }
                          },
                          selectedIds.includes(el.id) ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/50 border-transparent'
                        );
                      }}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}

      {mode !== 'elements' && selected && (
        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              {selected.type === 'image' ? 'Image Properties' : selected.type === 'shape' ? 'Shape Properties' : selected.type === 'drawing' ? 'Drawing Properties' : selected.type === 'costbar' ? 'Cost Bar Properties' : selected.type === 'grid' ? 'Grid Properties' : 'Text Properties'}
            </Label>
            {selected.type === 'text' && (
              <button
                onClick={toggleTitleCrown}
                className={`p-1 rounded-md transition-colors ${selected.titleCrown ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                title={selected.titleCrown ? 'Remove title crown' : 'Set as title (file name)'}
              >
                <Crown size={14} />
              </button>
            )}
            {selected.type === 'costbar' && (
              <button
                onClick={toggleCostCrown}
                className={`p-1 rounded-md transition-colors ${selected.costCrown ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                title={selected.costCrown ? 'Remove cost crown' : 'Set as card cost'}
              >
                <Crown size={14} />
              </button>
            )}
          </div>

          {selected.type === 'image' && (
            <ImageEffectsEditor
              effects={selected.effects}
              onChange={(effects) => updateElement(selected.id, { effects })}
            />
          )}

          {selected.type === 'text' && (
            <>
              <div>
                <Label className="text-xs mb-1 block">Content</Label>
                <textarea
                  ref={textContentRef}
                  value={selected.content || ''}
                  onChange={(e) => updateElement(selected.id, { content: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      const k = e.key.toLowerCase();
                      if (k === 'b') { e.preventDefault(); applyFormat('b'); }
                      else if (k === 'i') { e.preventDefault(); applyFormat('i'); }
                      else if (k === 'u') { e.preventDefault(); applyFormat('u'); }
                    }
                  }}
                  rows={3}
                  className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {uploadedIcons.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground mt-2">Add icons via the Icons manager to insert them into text.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {uploadedIcons.map(icon => (
                      <button key={icon.id} onClick={() => insertTextIconTag(icon.url)} className="w-9 h-9 rounded-md border border-border bg-muted/30 flex items-center justify-center hover:border-primary transition-colors" title={icon.name}>
                        <img src={icon.url} alt={icon.name} className="w-7 h-7 object-contain" draggable={false} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs mb-1 block">Font Size</Label>
                  <Input
                    type="number" min="6" max="72"
                    value={selected.fontSize || 14}
                    onChange={(e) => updateElement(selected.id, { fontSize: parseInt(e.target.value) || 14 })}
                    className={`bg-muted/30 border-border w-24 ${shrunkIds?.has(selected.id) ? 'text-red-500 border-red-500' : ''}`}
                    title={shrunkIds?.has(selected.id) ? 'Auto-shrunk to fit — actual size is smaller than shown' : ''}
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs mb-1 block">Font</Label>
                  <select
                    value={selected.fontFamily || '"Inter", sans-serif'}
                    onChange={(e) => updateElement(selected.id, { fontFamily: e.target.value })}
                    className="w-full h-9 rounded-md border border-border bg-muted/30 px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {fontOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Border</Label>
                <div className="flex items-center gap-2">
                  {selected.border && (
                    <Input
                      type="number" min="1" max="20"
                      value={selected.borderWidth || 2}
                      onChange={(e) => updateElement(selected.id, { borderWidth: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="bg-muted/30 border-border w-16 h-8"
                    />
                  )}
                  <button
                    onClick={() => updateElement(selected.id, { border: !selected.border })}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${selected.border ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${selected.border ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label className="text-xs">Shrink to fit</Label>
                  <p className="text-[11px] text-muted-foreground">Auto-shrink text that exceeds the border.</p>
                </div>
                <button
                  onClick={() => updateElement(selected.id, { shrinkToFit: selected.shrinkToFit === false })}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${selected.shrinkToFit !== false ? 'bg-primary' : 'bg-muted'}`}
                  title="Toggle shrink to fit"
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${selected.shrinkToFit !== false ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant={selected.bold ? 'default' : 'outline'} size="sm" onClick={() => applyFormat('b')} className="h-8 w-8 p-0" title="Bold (Ctrl+B)">
                  <Bold size={14} />
                </Button>
                <Button variant={selected.italic ? 'default' : 'outline'} size="sm" onClick={() => applyFormat('i')} className="h-8 w-8 p-0" title="Italic (Ctrl+I)">
                  <Italic size={14} />
                </Button>
                <Button variant={selected.underline ? 'default' : 'outline'} size="sm" onClick={() => applyFormat('u')} className="h-8 w-8 p-0" title="Underline (Ctrl+U)">
                  <Underline size={14} />
                </Button>
                <div className="flex gap-1 ml-1">
                  {[{ val: 'left', icon: AlignLeft }, { val: 'center', icon: AlignCenter }, { val: 'right', icon: AlignRight }].map(({ val, icon: Icon }) => (
                    <Button key={val} variant={selected.align === val ? 'default' : 'outline'} size="sm" onClick={() => updateElement(selected.id, { align: val })} className="h-8 w-8 p-0">
                      <Icon size={14} />
                    </Button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <SavedColorPicker
                    value={selected.color || '#000000'}
                    onChange={(v) => updateElement(selected.id, { color: v })}
                    className="w-8 h-8"
                    title="Text color"
                  />
                </div>
              </div>
              {savedColors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {savedColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateElement(selected.id, { color: c })}
                      className={`w-6 h-6 rounded border transition-transform hover:scale-110 ${selected.color === c ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {selected.type === 'shape' && (
          <>
          <div>
            <Label className="text-xs mb-1 block">Shape</Label>
            <select
              value={selected.shape || 'rectangle'}
              onChange={(e) => updateElement(selected.id, { shape: e.target.value })}
              className="w-full h-9 rounded-md border border-border bg-muted/30 px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="rectangle">Rectangle</option>
              <option value="ellipse">Ellipse</option>
              <option value="triangle">Triangle</option>
              <option value="diamond">Diamond</option>
              <option value="line">Line</option>
              <option value="rounded">Rounded Square</option>
            </select>
          </div>
          {selected.pips !== undefined && (
            <div>
              <Label className="text-xs mb-1 block">Dice pips</Label>
              <select
                value={selected.pips || ''}
                onChange={(e) => updateElement(selected.id, { pips: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full h-9 rounded-md border border-border bg-muted/30 px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">No pips</option>
                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} pip{n !== 1 ? 's' : ''}</option>)}
              </select>
            </div>
          )}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SavedColorPicker
                    value={selected.color || '#000000'}
                    onChange={(v) => updateElement(selected.id, { color: v })}
                    className="w-8 h-8"
                    title="Shape color"
                  />
                  <Label className="text-xs">Filled in completely</Label>
                </div>
                <button
                  onClick={() => updateElement(selected.id, { filled: !selected.filled })}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${selected.filled ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${selected.filled ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
              {!selected.filled && (
                <div>
                  <Label className="text-xs mb-1 block">Border thickness (px)</Label>
                  <Input
                    type="number" min="1" max="40"
                    value={selected.strokeWidth || 3}
                    onChange={(e) => updateElement(selected.id, { strokeWidth: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="bg-muted/30 border-border w-24"
                  />
                </div>
              )}
              {!selected.filled && (
                <div>
                  <Label className="text-xs mb-1 block">Line style</Label>
                  <select
                    value={selected.lineStyle || 'straight'}
                    onChange={(e) => updateElement(selected.id, { lineStyle: e.target.value })}
                    className="w-full h-9 rounded-md border border-border bg-muted/30 px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="straight">Straight</option>
                    <option value="drawn">Drawn</option>
                    <option value="choppy">Choppy</option>
                  </select>
                </div>
              )}
            </>
          )}

          {selected.type === 'drawing' && (
            <>
              <div className="flex items-center gap-2">
                <Button variant={selected.tool === 'brush' ? 'default' : 'outline'} size="sm" onClick={() => updateElement(selected.id, { tool: 'brush' })} className="h-8 w-8 p-0" title="Brush">
                  <Pencil size={14} />
                </Button>
                <Button variant={selected.tool === 'eraser' ? 'default' : 'outline'} size="sm" onClick={() => updateElement(selected.id, { tool: 'eraser' })} className="h-8 w-8 p-0" title="Eraser">
                  <Eraser size={14} />
                </Button>
                <Button variant={selected.tool === 'move' ? 'default' : 'outline'} size="sm" onClick={() => updateElement(selected.id, { tool: 'move' })} className="h-8 w-8 p-0" title="Move / Resize">
                  <Move size={14} />
                </Button>
                <div className="ml-auto flex items-center gap-1">
                  <SavedColorPicker
                    value={selected.drawColor || '#000000'}
                    onChange={(v) => updateElement(selected.id, { drawColor: v })}
                    className="w-8 h-8"
                    title="Brush color"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Brush size (px)</Label>
                <Input
                  type="number" min="1" max="60"
                  value={selected.drawSize || 6}
                  onChange={(e) => updateElement(selected.id, { drawSize: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="bg-muted/30 border-border w-24"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Pixel art mode</Label>
                <button
                  onClick={() => updateElement(selected.id, { pixelArt: !selected.pixelArt })}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${selected.pixelArt ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${selected.pixelArt ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
              {selected.pixelArt && (
                <div>
                  <Label className="text-xs mb-1 block">Pixel grid size</Label>
                  <select
                    value={selected.pixelSize || 16}
                    onChange={(e) => updateElement(selected.id, { pixelSize: parseInt(e.target.value) })}
                    className="w-full h-9 rounded-md border border-border bg-muted/30 px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {[8, 12, 16, 24, 32, 48, 64].map(n => <option key={n} value={n}>{n}×{n} grid</option>)}
                  </select>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => updateElement(selected.id, { strokes: [] })} className="w-full">
                <Trash2 size={14} className="mr-2" /> Clear Drawing
              </Button>
            </>
          )}

          {selected.type === 'costbar' && (
            <CostBarEditor element={selected} onUpdate={(fields) => updateElement(selected.id, fields)} />
          )}

          {selected.type === 'grid' && (
            <GridLayerEditor element={selected} onUpdate={(fields) => updateElement(selected.id, fields)} />
          )}

          <Button variant="destructive" size="sm" onClick={() => removeElement(selected.id)} className="w-full">
            <Trash2 size={14} className="mr-2" /> Delete Element
          </Button>
        </div>
      )}

      {mode !== 'elements' && selected && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Transform</Label>
          <div className="grid grid-cols-5 gap-1.5">
            <div>
              <Label className="text-[10px] mb-1 block">X</Label>
              <Input type="number" value={Math.round(selected.x)} onChange={(e) => updateElement(selected.id, { x: parseFloat(e.target.value) || 0 })} className="bg-muted/30 border-border h-8 px-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] mb-1 block">Y</Label>
              <Input type="number" value={Math.round(selected.y)} onChange={(e) => updateElement(selected.id, { y: parseFloat(e.target.value) || 0 })} className="bg-muted/30 border-border h-8 px-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] mb-1 block">W</Label>
              <Input type="number" value={Math.round(selected.width)} onChange={(e) => updateElement(selected.id, { width: parseFloat(e.target.value) || 0 })} className="bg-muted/30 border-border h-8 px-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] mb-1 block">H</Label>
              {selected.type === 'image' ? (
                <Input disabled value="auto" className="bg-muted/20 border-border h-8 px-1 text-xs text-muted-foreground" />
              ) : (
                <Input type="number" value={Math.round(selected.height)} onChange={(e) => updateElement(selected.id, { height: parseFloat(e.target.value) || 0 })} className="bg-muted/30 border-border h-8 px-1 text-xs" />
              )}
            </div>
            <div>
              <Label className="text-[10px] mb-1 block">Rot°</Label>
              <Input type="number" value={Math.round(selected.rotation || 0)} onChange={(e) => updateElement(selected.id, { rotation: parseFloat(e.target.value) || 0 })} className="bg-muted/30 border-border h-8 px-1 text-xs" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px]">Opacity</Label>
              <span className="text-[10px] text-muted-foreground">{Math.round((selected.opacity != null ? selected.opacity : 1) * 100)}%</span>
            </div>
            <Slider value={[Math.round((selected.opacity != null ? selected.opacity : 1) * 100)]} min={0} max={100} step={1} onValueChange={(v) => updateElement(selected.id, { opacity: v[0] / 100 })} />
          </div>
        </div>
      )}

      {mode !== 'properties' && elements.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Upload artwork or add text boxes, then drag to position and resize on the card.
        </p>
      )}

      {mode !== 'properties' && <AddShapeDialog open={showShapeDialog} onOpenChange={setShowShapeDialog} onAdd={addShape} />}
      <ToolLayerDialog open={showToolDialog} onOpenChange={setShowToolDialog} onChoose={addTool} />

      {layerCtx && layerCtxEl && (
          <div ref={menuRef} className="fixed z-[101] bg-popover border border-border rounded-md shadow-lg py-1 min-w-[120px]" style={{ left: layerCtx.x, top: layerCtx.y }} data-no-deselect>
            <button onClick={() => { updateElement(layerCtxEl.id, { hidden: !layerCtxEl.hidden }); closeLayerCtx(); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50">
              {layerCtxEl.hidden ? <><EyeOff size={12} /> Show</> : <><Eye size={12} /> Hide</>}
            </button>
            <button onClick={() => { startRename(layerCtxEl); closeLayerCtx(); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50">
              <Edit3 size={12} /> Rename
            </button>
            <button onClick={() => { collectElement(layerCtxEl.id); closeLayerCtx(); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50">
              <Sparkles size={12} /> Collect
            </button>
            <button onClick={() => { duplicateElement(layerCtxEl.id); closeLayerCtx(); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50">
              <Copy size={12} /> Duplicate
            </button>
            <button onClick={() => { removeElement(layerCtxEl.id); closeLayerCtx(); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-destructive">
              <Trash2 size={12} /> Delete
            </button>
          </div>
      )}
    </div>
  );
}