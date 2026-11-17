import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Edit3, Trash2, ImageIcon, Dices, Combine } from 'lucide-react';
import CollectedElementPreview from './CollectedElementPreview';
import { useUploadedIcons } from '@/hooks/useUploadedIcons';
import { useCollected } from '@/hooks/useFreeCanvasAssets';
import { updateCollected, removeCollected, setCollectedItems } from '@/lib/freeCanvasAssetsStore';
import { updateUploadedIcon } from '@/lib/uploadedIconsStore';
import { setGhost, clearGhost } from '@/lib/freeCanvasGhostStore';

const DICE_FOLDER_ICON = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/6cab52676d_fbf166904_perspective-dice-six-faces-three1.png';
const isDiceFolder = (item) => item.type === 'folder' && item.elements?.some(el => el.type === 'shape' && 'pips' in el);

const genId = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const buildGhost = (el, width, startX, startY, ar) => {
  const ratio = ar || el.aspectRatio || (el.height ? el.width / el.height : 1);
  const height = el.type === 'image' ? width / (ratio || 1) : (el.height ? el.height : width);
  return { ...el, width, height, x: startX, y: startY, aspectRatio: ratio };
};

const loadNaturalAspectRatio = (url) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img.width / img.height || 1);
  img.onerror = () => resolve(1);
  img.src = url;
});

export default function CollectedButtons({ data, onChange, isActive = true }) {
  const [contextMenu, setContextMenu] = useState(null);
  const [renamingColId, setRenamingColId] = useState(null);
  const [renameColValue, setRenameColValue] = useState('');
  const [openFolderId, setOpenFolderId] = useState(null);
  const [combineSourceId, setCombineSourceId] = useState(null);
  const [editPopup, setEditPopup] = useState(null);
  const [iconsOpen, setIconsOpen] = useState(false);

  const elements = data?.elements || [];
  const collected = useCollected();
  const uploadedIcons = useUploadedIcons();

  const closeEdit = () => { setEditPopup(null); clearGhost(); };

  const commitField = (field, val) => {
    if (!editPopup) return;
    const next = { ...editPopup, [field]: val };
    const ar = editPopup.aspectRatio || editPopup.ghost.aspectRatio || 1;
    next.ghost = {
      ...editPopup.ghost,
      x: next.startX,
      y: next.startY,
      width: next.width,
      height: next.width / (ar || 1),
    };
    setEditPopup(next);
    editPopup.apply({ [field]: val });
    setGhost(next.ghost);
  };

  const setElementStartFields = (folderId, elIndex, fields, ar) => {
    const folder = collected.find(c => c.id === folderId);
    if (!folder) return;
    const newElements = folder.elements.map((el, i) => {
      if (i !== elIndex) return el;
      const updated = { ...el };
      if (fields.width !== undefined) {
        updated.width = fields.width;
        if (el.type !== 'image') updated.height = Math.round(fields.width / (ar || 1));
      }
      if (fields.startX !== undefined) updated.startX = fields.startX;
      if (fields.startY !== undefined) updated.startY = fields.startY;
      return updated;
    });
    updateCollected(folderId, { elements: newElements });
  };

  // Close popups + clear ghost when the workspace becomes inactive or unmounts.
  useEffect(() => {
    if (isActive) return;
    setEditPopup(null);
    setContextMenu(null);
    setIconsOpen(false);
    setOpenFolderId(null);
    clearGhost();
  }, [isActive]);
  useEffect(() => () => clearGhost(), []);

  useEffect(() => {
    if (!combineSourceId) return;
    const onKey = (e) => { if (e.key === 'Escape') setCombineSourceId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combineSourceId]);

  useEffect(() => {
    if (!editPopup) return;
    const onKey = (e) => { if (e.key === 'Escape') closeEdit(); };
    const onScroll = () => closeEdit();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll, true); };
  }, [editPopup]);

  const addCollected = (item) => {
    const isGroup = item.type === 'group' || (item.type !== 'folder' && item.elements.length > 1);
    const newEls = item.elements.map(el => {
      const { folderId, startX, startY, ...rest } = JSON.parse(JSON.stringify(el));
      return isGroup ? { ...rest, id: genId() } : { ...rest, id: genId(), x: startX ?? 30, y: startY ?? 30 };
    });
    onChange({ ...data, elements: [...newEls, ...elements] });
  };

  const insertCollectedElement = (el) => {
    const { folderId, startX, startY, ...rest } = JSON.parse(JSON.stringify(el));
    onChange({ ...data, elements: [{ ...rest, id: genId(), x: startX ?? 30, y: startY ?? 30 }, ...elements] });
  };

  const pickRandomFromFolder = (item) => {
    if (!item.elements?.length) return;
    const el = item.elements[Math.floor(Math.random() * item.elements.length)];
    insertCollectedElement(el);
  };

  const toggleRandom = (itemId) => {
    const it = collected.find(c => c.id === itemId);
    if (it) updateCollected(itemId, { random: !it.random });
    setContextMenu(null);
  };

  const startCombine = (itemId) => {
    setCombineSourceId(itemId);
    setContextMenu(null);
  };

  const doCombine = (sourceId, targetId) => {
    if (sourceId === targetId) { setCombineSourceId(null); return; }
    const a = collected.find(c => c.id === sourceId);
    const b = collected.find(c => c.id === targetId);
    setCombineSourceId(null);
    if (!a || !b) return;
    const aElements = a.elements || [];
    const bElements = b.elements || [];
    let nextCollected;
    if (b.type === 'folder') {
      nextCollected = collected
        .filter(c => c.id !== sourceId)
        .map(c => c.id === targetId ? { ...c, elements: [...bElements, ...aElements] } : c);
    } else {
      const newFolder = {
        id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: b.name || a.name || 'Combined',
        type: 'folder',
        elements: [...aElements, ...bElements],
      };
      nextCollected = [];
      for (const c of collected) {
        if (c.id === sourceId) continue;
        if (c.id === targetId) nextCollected.push(newFolder);
        else nextCollected.push(c);
      }
    }
    setCollectedItems(nextCollected);
  };

  const handleColContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ itemId: item.id, x: e.clientX, y: e.clientY });
  };

  const startColRename = (item) => {
    setRenamingColId(item.id);
    setRenameColValue(item.name || '');
    setContextMenu(null);
  };

  const commitColRename = () => {
    if (renamingColId) {
      const trimmed = renameColValue.trim();
      if (trimmed) updateCollected(renamingColId, { name: trimmed });
      setRenamingColId(null);
    }
  };

  const deleteCollected = (itemId) => {
    removeCollected(itemId);
    setContextMenu(null);
  };

  if (collected.length === 0 && uploadedIcons.length === 0) {
    return null;
  }

  const openEditForIcon = async (e, icon) => {
    e.preventDefault();
    e.stopPropagation();
    const defaultW = Math.round((data?.cardWidth || 360) * 0.132);
    const startW = icon.width || defaultW;
    const startX = icon.startX ?? 30;
    const startY = icon.startY ?? 30;
    const ar = await loadNaturalAspectRatio(icon.url);
    const height = startW / (ar || 1);
    const ghost = { type: 'image', url: icon.url, name: icon.name, width: startW, height, x: startX, y: startY, aspectRatio: ar };
    setEditPopup({ screenX: e.clientX, screenY: e.clientY, popover: 'icons', width: startW, startX, startY, aspectRatio: ar, apply: (f) => updateUploadedIcon(icon.id, f), ghost });
    setGhost(ghost);
  };

  const openEditForFolderEl = async (e, item, el, ei) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = el.width || 60;
    const startX = el.startX ?? 30;
    const startY = el.startY ?? 30;
    let ar = el.aspectRatio || (el.height ? el.width / el.height : null);
    if (!ar && el.type === 'image' && el.url) ar = await loadNaturalAspectRatio(el.url);
    ar = ar || 1;
    const ghost = buildGhost(el, startW, startX, startY, ar);
    setEditPopup({ screenX: e.clientX, screenY: e.clientY, popover: 'folder', folderId: item.id, elIndex: ei, width: startW, startX, startY, aspectRatio: ar, apply: (f) => setElementStartFields(item.id, ei, f, ar), ghost });
    setGhost(ghost);
  };

  return (
    <>
        <Popover open={editPopup?.popover === 'icons' ? true : iconsOpen} onOpenChange={(o) => { if (!editPopup) setIconsOpen(o); }}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="aspect-square w-full flex-col h-auto p-1 gap-0.5">
              <ImageIcon size={24} className="flex-shrink-0" />
              <span className="text-[9px] truncate w-full text-center leading-tight">Icons</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-56 p-1.5 bg-white text-black [&_span]:text-black" data-no-deselect>
            {uploadedIcons.length === 0 ? (
              <p className="text-[11px] text-center py-3">No icons yet. Add some via the Icons manager.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {uploadedIcons.map(icon => {
                  const defaultW = Math.round((data?.cardWidth || 360) * 0.132);
                  const startW = icon.width || defaultW;
                  return (
                    <button key={icon.id} onClick={async () => { const ar = await loadNaturalAspectRatio(icon.url); insertCollectedElement({ type: 'image', width: startW, aspectRatio: ar, url: icon.url, name: icon.name, startX: icon.startX, startY: icon.startY }); }} onContextMenu={(e) => openEditForIcon(e, icon)} className="h-12 p-1 rounded hover:bg-muted/50 transition-colors flex items-center justify-center" title={`${icon.name} — right-click to set start size & position`}>
                      <img src={icon.url} alt={icon.name} className="w-8 h-8 object-contain" />
                    </button>
                  );
                })}
              </div>
            )}
          </PopoverContent>
        </Popover>
        {collected.map((item) =>
          renamingColId === item.id ? (
            <input
              key={item.id}
              value={renameColValue}
              onChange={(e) => setRenameColValue(e.target.value)}
              onBlur={commitColRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitColRename(); if (e.key === 'Escape') setRenamingColId(null); }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="aspect-square w-full text-[10px] text-center bg-muted/30 border border-primary rounded px-1 focus:outline-none"
            />
          ) : item.type === 'folder' ? (
            <Popover key={item.id} open={(item.random || !!combineSourceId) ? false : openFolderId === item.id} onOpenChange={(o) => { if (!item.random && !combineSourceId && !editPopup) setOpenFolderId(o ? item.id : null); }}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" onContextMenu={(e) => handleColContextMenu(e, item)} onClick={(e) => { if (combineSourceId) { e.preventDefault(); if (combineSourceId === item.id) setCombineSourceId(null); else doCombine(combineSourceId, item.id); } else if (item.random) { e.preventDefault(); pickRandomFromFolder(item); } }} className={`relative aspect-square w-full flex-col h-auto p-1 gap-0.5 ${combineSourceId ? (combineSourceId === item.id ? 'ring-2 ring-primary' : 'ring-2 ring-accent animate-pulse') : (item.random ? 'ring-2 ring-primary' : '')}`} title={combineSourceId ? (combineSourceId === item.id ? 'Cancel combine' : `Combine ${item.name}`) : (item.random ? `${item.name} (random)` : item.name)}>
                  {isDiceFolder(item) ? (
                    <img src={DICE_FOLDER_ICON} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
                  ) : (
                    <Sparkles size={24} className="flex-shrink-0" />
                  )}
                  <span className="text-[9px] truncate w-full text-center leading-tight">{item.name}</span>
                  {item.random && (
                    <span className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground rounded-full p-0.5" title="Random mode">
                      <Dices size={10} />
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-56 p-1.5 bg-white text-black [&_span]:text-black" data-no-deselect>
                <div className="grid grid-cols-3 gap-1">
                  {item.elements.map((el, ei) => (
                    <button key={ei} onClick={() => insertCollectedElement(el)} onContextMenu={(e) => openEditForFolderEl(e, item, el, ei)} className="h-12 p-1 rounded hover:bg-muted/50 transition-colors flex items-center justify-center" title={`${el.name || el.type} — right-click to set start size & position`}>
                      <CollectedElementPreview el={el} size={28} />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <Button key={item.id} variant="outline" size="sm" onClick={() => { if (combineSourceId) { if (combineSourceId === item.id) setCombineSourceId(null); else doCombine(combineSourceId, item.id); } else addCollected(item); }} onContextMenu={(e) => handleColContextMenu(e, item)} className={`relative aspect-square w-full flex-col h-auto p-1 gap-0.5 ${combineSourceId ? (combineSourceId === item.id ? 'ring-2 ring-primary' : 'ring-2 ring-accent animate-pulse') : ''}`} title={combineSourceId ? (combineSourceId === item.id ? 'Cancel combine' : `Combine ${item.name}`) : item.name}>
              {item.elements[0]?.type === 'image' ? (
                <img src={item.elements[0].url} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
              ) : item.elements[0]?.type === 'shape' ? (
                <div className="w-6 h-6 flex-shrink-0"><CollectedElementPreview el={{ ...item.elements[0], color: '#ffffff' }} size={24} /></div>
              ) : item.elements[0]?.type === 'text' ? (
                <span className="text-2xl font-bold leading-none flex-shrink-0">T</span>
              ) : (
                <Sparkles size={24} className="flex-shrink-0" />
              )}
              <span className="text-[9px] truncate w-full text-center leading-tight">{item.name}</span>
            </Button>
          )
        )}
      {editPopup && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={closeEdit} onContextMenu={(e) => { e.preventDefault(); closeEdit(); }} />
          <div className="fixed z-[101] bg-popover border border-border rounded-md shadow-lg p-2 w-52" style={{ left: editPopup.screenX, top: editPopup.screenY, transform: 'translateY(-100%)' }} data-no-deselect>
            <Label className="text-[10px] text-muted-foreground mb-1.5 block">Start size &amp; position</Label>
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <Label className="text-[10px] mb-1 block">W</Label>
                <Input type="number" value={Math.round(editPopup.width)} onChange={(e) => commitField('width', parseFloat(e.target.value) || 0)} className="bg-muted/30 border-border h-8 px-1 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] mb-1 block">X</Label>
                <Input type="number" value={Math.round(editPopup.startX)} onChange={(e) => commitField('startX', parseFloat(e.target.value) || 0)} className="bg-muted/30 border-border h-8 px-1 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] mb-1 block">Y</Label>
                <Input type="number" value={Math.round(editPopup.startY)} onChange={(e) => commitField('startY', parseFloat(e.target.value) || 0)} className="bg-muted/30 border-border h-8 px-1 text-xs" />
              </div>
            </div>
          </div>
        </>
      )}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div className="fixed z-[101] bg-popover border border-border rounded-md shadow-lg py-1 min-w-[100px]" style={{ left: contextMenu.x, top: contextMenu.y, transform: 'translateY(-100%)' }} data-no-deselect>
            {(() => { const it = collected.find(c => c.id === contextMenu.itemId); return it?.type === 'folder' ? (
              <button onClick={() => toggleRandom(contextMenu.itemId)} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50">
                <Dices size={12} /> {it.random ? 'Disable Random' : 'Enable Random'}
              </button>
            ) : null; })()}
            <button onClick={() => startCombine(contextMenu.itemId)} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50">
              <Combine size={12} /> Combine
            </button>
            <button onClick={() => startColRename(collected.find(c => c.id === contextMenu.itemId))} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50">
              <Edit3 size={12} /> Rename
            </button>
            <button onClick={() => deleteCollected(contextMenu.itemId)} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-destructive">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}