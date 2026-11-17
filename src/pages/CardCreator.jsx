import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { getTemplate } from '@/lib/cardTemplates';
import { getTemplates as getFreeCanvasTemplates } from '@/lib/freeCanvasTemplates';
import { getDefaultCollected, migrateFreeCanvasData } from '@/lib/freeCanvasDefaults';
import { downloadCanvas, downloadBlob } from '@/lib/exportUtils';
import { exportFreeCanvasToPsd } from '@/lib/psdExport';
import { exportCard } from '@/lib/bravadoCanvasRenderer';
import TemplateSelector from '@/components/cards/TemplateSelector';
import CardPreview from '@/components/cards/CardPreview';
import PlayingCardEditor from '@/components/cards/playingcard/PlayingCardEditor';
import GlimpsesEditor from '@/components/cards/glimpses/GlimpsesEditor';
import SevenWondersEditor from '@/components/cards/sevenwonders/SevenWondersEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, ArrowLeft, FolderOpen, Printer, Share2, Magnet, RotateCw, Square, Layers, AlignCenter } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import FormatTool from '@/components/FormatTool';
import BorderTool from '@/components/BorderTool';
import SliceTool from '@/components/SliceTool';
import IconManager from '@/components/IconManager';
import IconsFontsDialog from '@/components/cards/freecanvas/IconsFontsDialog';
import { setUploadedIcons } from '@/lib/uploadedIconsStore';
import { getCollected, setCollectedItems, getColors, setColors } from '@/lib/freeCanvasAssetsStore';
import SevenWondersIconManager from '@/components/cards/sevenwonders/SevenWondersIconManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { ImageIcon } from 'lucide-react';
import { saveDirHandle, loadDirHandle, ensurePermission } from '@/lib/dirHandleStore';
import ColorizeDialog from '@/components/cards/freecanvas/ColorizeDialog';
import FreeCanvasStartDialog from '@/components/cards/freecanvas/FreeCanvasStartDialog';
import SaveSettingsDialog from '@/components/SaveSettingsDialog';
import FreeCanvasWorkspace from '@/components/cards/freecanvas/FreeCanvasWorkspace';
import SelectionTool from '@/components/cards/freecanvas/SelectionTool';
import { saveCardToDatabase, getExistingTabs, defaultTabForTemplate } from '@/lib/databaseApi';
import BackgroundTool from '@/components/BackgroundTool';


function getCardTitle(template, data, cardName) {
  if (!data) return '';
  if (template === 'glimpses') return data.title || '';
  if (template === 'free_canvas') return cardName || '';
  if (template === 'seven_wonders') return cardName || data?.title || '';
  if (template === 'playing_card') return data.headerText || data.value || '';
  return '';
}

const LINE_STYLES = [
  { key: 'straight', label: 'Straight' },
  { key: 'orthogonal', label: 'V/H Path' },
  { key: 'rounded', label: 'Rounded V/H' },
  { key: 'curved', label: 'Curved' },
];

function loadExportCfg(key, def) {
  try {
    const v = localStorage.getItem(key);
    if (v) return { ...def, ...JSON.parse(v) };
  } catch {}
  return def;
}

export default function CardCreator() {
  const { toast } = useToast();

  const [template, setTemplate] = useState(null);
  const [cardName, setCardName] = useState('');
  const [cardData, setCardData] = useState(null);
  const [costSymbols, setCostSymbols] = useState([]);
  const [exportMargin, setExportMargin] = useState(() => {
    try { return localStorage.getItem('exportMargin') === 'true'; } catch { return false; }
  });
  const [exporting, setExporting] = useState(false);
  const [showIconManager, setShowIconManager] = useState(false);
  const [iconsFontsOpen, setIconsFontsOpen] = useState(false);
  const [selectedElementIds, setSelectedElementIds] = useState([]);
  const [snapGuides, setSnapGuides] = useState(() => {
    try {
      const saved = localStorage.getItem('snapGuides');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          return { borders: parsed.borders ?? true, layers: parsed.layers ?? true, rotation: parsed.rotation ?? true, centers: parsed.centers ?? false, strength: parsed.strength ?? 3 };
        }
      }
    } catch {}
    return { borders: true, layers: true, rotation: true, centers: false, strength: 3 };
  });
  const [magicTolerance, setMagicTolerance] = useState(() => {
    try { return parseInt(localStorage.getItem('magicTolerance')) || 72; } catch { return 72; }
  });
  useEffect(() => { try { localStorage.setItem('magicTolerance', String(magicTolerance)); } catch {} }, [magicTolerance]);
  const [linesMode, setLinesMode] = useState(() => {
    try { return localStorage.getItem('linesMode') === 'true'; } catch { return false; }
  });
  const [lineStyle, setLineStyle] = useState(() => {
    try { return localStorage.getItem('lineStyle') || 'straight'; } catch { return 'straight'; }
  });
  const [lineWidth, setLineWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('lineWidth')) || 2; } catch { return 2; }
  });
  const [linesDialogOpen, setLinesDialogOpen] = useState(false);
  const [snapDialogOpen, setSnapDialogOpen] = useState(false);
  const [showSizeDialog, setShowSizeDialog] = useState(false);
  const [customSize, setCustomSize] = useState({ w: 360, h: 504 });
  const [defaultDirHandle, setDefaultDirHandle] = useState(null);
  const [colorCopyDialogOpen, setColorCopyDialogOpen] = useState(false);
  const [exportRotated, setExportRotated] = useState(() => {
    try { return localStorage.getItem('exportRotated') === 'true'; } catch { return false; }
  });
  const [primaryExport, setPrimaryExport] = useState(() => loadExportCfg('savePrimary', { bgType: 'color', bgColor: '#ffffff', bgImage: '', bgImages: [], format: 'png' }));
  const [copyExport, setCopyExport] = useState(() => loadExportCfg('saveCopyCfg', { bgType: 'color', bgColor: '#ffffff', bgImage: '', format: 'png' }));
  const [saveCopy, setSaveCopy] = useState(() => {
    try { return localStorage.getItem('saveCopy') === 'true'; } catch { return false; }
  });
  const [saveToDatabase, setSaveToDatabase] = useState(() => {
    try { return localStorage.getItem('saveToDatabase') === 'true'; } catch { return false; }
  });
  const [dbNeedsReview, setDbNeedsReview] = useState(false);
  const [dbTab, setDbTab] = useState('');
  const [dbTags, setDbTags] = useState([]);
  const [saveOptionsEnabled, setSaveOptionsEnabled] = useState(() => {
    try { return localStorage.getItem('saveOptionsEnabled') !== 'false'; } catch { return true; }
  });
  const [copyDirHandle, setCopyDirHandle] = useState(null);
  const [existingTabs, setExistingTabs] = useState([]);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const lastChangeTimeRef = useRef(0);
  const [selectionMode, setSelectionMode] = useState('off');
  const [colorizeDialogOpen, setColorizeDialogOpen] = useState(false);
  const [colorizeSettings, setColorizeSettings] = useState({ color: '#ff0000', amount: 50 });
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [canvases, setCanvases] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [addCanvasMode, setAddCanvasMode] = useState(false);
  const [arrowsEnabled, setArrowsEnabled] = useState(false);

  const historyMapRef = useRef({});
  const cardDataRef = useRef(null);
  cardDataRef.current = cardData;
  const workspaceRefs = useRef({});

  const getActiveWorkspace = () => {
    const id = canvases[activeIndex]?.id;
    return id ? workspaceRefs.current[id] : null;
  };

  const handleWorkspaceDataChange = () => {};

  const handleCanvasNameChange = (name) => {
    setCanvases(prev => prev.map((c, i) => i === activeIndex ? { ...c, name } : c));
  };

  useEffect(() => {
    try { localStorage.setItem('exportMargin', exportMargin); } catch {}
  }, [exportMargin]);

  useEffect(() => {
    try { localStorage.setItem('snapGuides', JSON.stringify(snapGuides)); } catch {}
  }, [snapGuides]);

  useEffect(() => {
    try { localStorage.setItem('linesMode', linesMode); } catch {}
  }, [linesMode]);

  useEffect(() => {
    try { localStorage.setItem('lineStyle', lineStyle); } catch {}
  }, [lineStyle]);

  useEffect(() => {
    try { localStorage.setItem('lineWidth', String(lineWidth)); } catch {}
  }, [lineWidth]);

  useEffect(() => {
    try { localStorage.setItem('savePrimary', JSON.stringify(primaryExport)); } catch {}
  }, [primaryExport]);

  useEffect(() => {
    try { localStorage.setItem('saveCopyCfg', JSON.stringify(copyExport)); } catch {}
  }, [copyExport]);

  useEffect(() => {
    try { localStorage.setItem('saveCopy', saveCopy); } catch {}
  }, [saveCopy]);

  useEffect(() => {
    try { localStorage.setItem('saveToDatabase', saveToDatabase); } catch {}
  }, [saveToDatabase]);

  useEffect(() => {
    try { localStorage.setItem('saveOptionsEnabled', saveOptionsEnabled); } catch {}
  }, [saveOptionsEnabled]);

  useEffect(() => {
    loadDirHandle('copySave').then(h => { if (h) setCopyDirHandle(h); });
  }, []);

  useEffect(() => {
    if (colorCopyDialogOpen) {
      getExistingTabs().then(setExistingTabs).catch(() => {});
      if (!dbTab) setDbTab(defaultTabForTemplate(template));
    }
  }, [colorCopyDialogOpen]);  

  useEffect(() => {
    try { localStorage.setItem('exportRotated', exportRotated); } catch {}
  }, [exportRotated]);

  const rotateCanvas90CW = (srcCanvas) => {
    const out = document.createElement('canvas');
    out.width = srcCanvas.height;
    out.height = srcCanvas.width;
    const ctx = out.getContext('2d');
    ctx.translate(out.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(srcCanvas, 0, 0);
    return out;
  };

  useEffect(() => {
    loadDirHandle('defaultSave').then(h => { if (h) setDefaultDirHandle(h); });
  }, []);

  useEffect(() => {
    base44.entities.CostSymbol.list().then(setCostSymbols).catch(() => {});
  }, []);

  // Keep the latest undo/redo logic in a ref so the global keydown listener
  // (registered once) always sees the current template/canvases/activeIndex.
  const keydownRef = useRef(null);
  keydownRef.current = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (template === 'free_canvas') {
        getActiveWorkspace()?.undo();
      } else if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
        setCardData(historyRef.current[historyIndexRef.current]);
      }
    } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
      e.preventDefault();
      if (template === 'free_canvas') {
        getActiveWorkspace()?.redo();
      } else if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current++;
        setCardData(historyRef.current[historyIndexRef.current]);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => keydownRef.current?.(e);
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleColorizeRequest = () => {
    setColorizeDialogOpen(true);
  };

  const handleColorizeApply = async () => {
    await getActiveWorkspace()?.applyColorize(colorizeSettings);
    setColorizeDialogOpen(false);
  };

  const handleSelectTemplate = (key) => {
    if (key === 'free_canvas') {
      setShowStartDialog(true);
      return;
    }
    if (key.startsWith('free_canvas_template:')) {
      const name = key.split(':').slice(1).join(':');
      const tmpl = getFreeCanvasTemplates().find(t => t.name === name);
      if (tmpl) {
        const raw = JSON.parse(JSON.stringify(tmpl.data));
        const tabs = Array.isArray(raw?.tabs) ? raw.tabs : [{ name, data: raw }];
        const sharedCollected = raw.collected || [];
        const sharedColors = raw.savedColors || [];
        const builtTabs = tabs.map((t, i) => {
          const migrated = withDefaultCollected(t.data);
          return {
            id: `canvas_${Date.now()}_${i}`,
            name: t.name || `Canvas ${i + 1}`,
            data: { ...migrated, collected: sharedCollected.length ? sharedCollected : migrated.collected, savedColors: sharedColors },
          };
        });
        setTemplate('free_canvas');
        setCardName('');
        setCollectedItems(builtTabs[0]?.data.collected || []);
        setColors(sharedColors);
        setCanvases(builtTabs);
        setActiveIndex(0);
        setUploadedIcons(tmpl.icons || []);
      }
      return;
    }
    const t = getTemplate(key);
    const defaultData = t.defaultData();
    setTemplate(key);
    setCardData(defaultData);
    setCardName('');
    setCanvases([]);
    setActiveIndex(0);
    historyRef.current = [defaultData];
    historyIndexRef.current = 0;
    lastChangeTimeRef.current = 0;
  };

  const withDefaultCollected = (data) => {
    const migrated = migrateFreeCanvasData(data);
    if (!migrated.collected || migrated.collected.length === 0) {
      return { ...migrated, collected: getDefaultCollected(migrated.cardWidth || 360, migrated.cardHeight || 504) };
    }
    return migrated;
  };

  const initFreeCanvas = (data, name) => {
    const finalData = withDefaultCollected(data);
    setCollectedItems(finalData.collected);
    setTemplate('free_canvas');
    setCardName('');
    setShowStartDialog(false);
    setCanvases([{ id: `canvas_${Date.now()}`, name: name || 'Canvas 1', data: finalData }]);
    setActiveIndex(0);
    setUploadedIcons([]);
  };

  const addCanvasWithData = (data, name) => {
    const finalData = withDefaultCollected(data);
    const newCanvas = { id: `canvas_${Date.now()}`, name: name || `Canvas ${canvases.length + 1}`, data: finalData };
    setCanvases(prev => [...prev, newCanvas]);
    setActiveIndex(canvases.length);
    setShowStartDialog(false);
    setCardName('');
  };

  const handleFreeCanvasSize = (cardWidth, cardHeight) => {
    const t = getTemplate('free_canvas');
    const data = { ...t.defaultData(), cardWidth, cardHeight };
    if (addCanvasMode) { setAddCanvasMode(false); addCanvasWithData(data); }
    else { setColors([]); initFreeCanvas(data); }
  };

  const handleTemplateSelect = (templateName, templateData) => {
    const data = JSON.parse(JSON.stringify(templateData));
    if (addCanvasMode) { setAddCanvasMode(false); addCanvasWithData(data, templateName); }
    else { setColors(data.savedColors || []); initFreeCanvas(data, templateName); }
  };

  const handleOpenPsd = (width, height, elements) => {
    const data = {
      ...getTemplate('free_canvas').defaultData(),
      cardWidth: width,
      cardHeight: height,
      elements,
      coordVersion: 2,
    };
    if (addCanvasMode) { setAddCanvasMode(false); addCanvasWithData(data); }
    else { setColors([]); initFreeCanvas(data); }
  };

  const handleOpenFile = (fileUrl, imgWidth, imgHeight) => {
    const data = {
      ...getTemplate('free_canvas').defaultData(),
      cardWidth: imgWidth,
      cardHeight: imgHeight,
      elements: [{
        id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'image',
        name: 'Background',
        x: 0, y: 0, width: 100,
        aspectRatio: imgWidth / imgHeight,
        url: fileUrl,
      }],
    };
    if (addCanvasMode) { setAddCanvasMode(false); addCanvasWithData(data); }
    else { setColors([]); initFreeCanvas(data); }
  };

  const handleOpenCs = (data) => {
    const finalData = withDefaultCollected(data);
    if (addCanvasMode) { setAddCanvasMode(false); addCanvasWithData(finalData); }
    else { setColors(finalData.savedColors || []); initFreeCanvas(finalData); }
  };

  const loadCsTemplate = (csTemplate, data) => {
    if (csTemplate === 'free_canvas') {
      setColors(data.savedColors || []);
      initFreeCanvas(data);
      return;
    }
    const t = getTemplate(csTemplate);
    if (!t) { toast({ title: 'Unknown template', description: csTemplate, variant: 'destructive' }); return; }
    setTemplate(csTemplate);
    setCardData(data);
    setCardName('');
    setCanvases([]);
    setActiveIndex(0);
    historyRef.current = [data];
    historyIndexRef.current = 0;
    lastChangeTimeRef.current = 0;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const csUrl = urlParams.get('cs');
    if (!csUrl) return;
    (async () => {
      try {
        const res = await fetch(csUrl);
        const parsed = await res.json();
        const csTemplate = parsed.template || 'free_canvas';
        const data = parsed.data || parsed;
        loadCsTemplate(csTemplate, data);
      } catch (err) {
        toast({ title: 'CS load failed', description: err.message, variant: 'destructive' });
      }
    })();
     
  }, []);

  const addCanvasTab = () => {
    setAddCanvasMode(true);
    setShowStartDialog(true);
  };

  const switchCanvas = (newIndex) => {
    if (newIndex === activeIndex) return;
    setActiveIndex(newIndex);
  };

  const closeCanvas = (index) => {
    if (canvases.length <= 1) return;
    const removedId = canvases[index]?.id;
    if (removedId) delete workspaceRefs.current[removedId];
    const newCanvases = canvases.filter((_, i) => i !== index);
    const newActive = index <= activeIndex ? Math.max(0, activeIndex - 1) : activeIndex;
    setCanvases(newCanvases);
    setActiveIndex(newActive);
  };

  const handleSelectMode = (mode) => {
    setSelectionMode(mode);
    if (mode === 'off') getActiveWorkspace()?.clearSelection();
  };

  const handleToggleSelect = () => {
    if (selectionMode !== 'off') {
      setSelectionMode('off');
      getActiveWorkspace()?.clearSelection();
    } else {
      setSelectionDialogOpen(true);
    }
  };

  const handleDataChange = (newData) => {
    setCardData(newData);
    cardDataRef.current = newData;

    const now = Date.now();
    const isRapid = now - lastChangeTimeRef.current < 400;
    lastChangeTimeRef.current = now;

    if (isRapid && historyRef.current.length > 0) {
      historyRef.current[historyIndexRef.current] = newData;
    } else {
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(newData);
      while (newHistory.length > 15) newHistory.shift();
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
    }
  };

  const chooseDirectory = async (key, setter) => {
    if (!window.showDirectoryPicker) {
      toast({ title: 'Not supported', description: 'Folder selection requires Chrome or Edge on desktop. Exports will download instead.' });
      return;
    }
    try {
      const handle = await window.showDirectoryPicker();
      setter(handle);
      saveDirHandle(key, handle);
    } catch (e) {
      if (e?.name !== 'AbortError') {
        toast({ title: 'Folder selection unavailable', description: 'Folder saving works in the published app. Exports will download instead.' });
      }
    }
  };

  const getAvailableFilename = async (directory, filename) => {
    const dotIndex = filename.lastIndexOf('.');
    const base = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename;
    const ext = dotIndex !== -1 ? filename.slice(dotIndex) : '';

    let candidate = filename;
    let counter = 1;
    while (true) {
      try {
        // getFileHandle without { create: true } throws NotFoundError if the file
        // doesn't exist yet — that's the signal that this candidate is free to use.
        await directory.getFileHandle(candidate);
        candidate = `${base} (${counter})${ext}`;
        counter++;
      } catch (e) {
        return candidate;
      }
    }
  };

  const saveBlobToDirectory = async (blob, filename, directory) => {
    const finalFilename = await getAvailableFilename(directory, filename);
    const fileHandle = await directory.getFileHandle(finalFilename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return finalFilename;
  };

  const saveCanvasToDirectory = async (canvas, filename, directory, mime = 'image/png') => {
    const finalFilename = await getAvailableFilename(directory, filename);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, mime));
    const fileHandle = await directory.getFileHandle(finalFilename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return finalFilename;
  };

  const getTitleCrownName = (canvasData) => {
    const crown = (canvasData?.elements || []).find(el => el.titleCrown && el.type === 'text');
    if (!crown) return null;
    const text = (crown.content || '').replace(/\[icon:[^\]]+\]/g, '').trim();
    return text || null;
  };

  const pickBgImage = (cfg) => {
    if (cfg.bgType !== 'image') return undefined;
    const imgs = Array.isArray(cfg.bgImages) ? cfg.bgImages.filter(Boolean) : (cfg.bgImage ? [cfg.bgImage] : []);
    if (!imgs.length) return undefined;
    return imgs[Math.floor(Math.random() * imgs.length)];
  };

  const runExport = async (exportData, title, cfg, suffix, dirHandle) => {
    const dir = dirHandle || defaultDirHandle;
    const bgColor = cfg.bgType === 'color' ? cfg.bgColor : undefined;
    const bgImage = pickBgImage(cfg);
    const baseName = (title || 'card') + suffix;

    if (cfg.format === 'psd') {
      if (template !== 'free_canvas') return;
      try {
        const psdBlob = await exportFreeCanvasToPsd(exportData, bgColor, bgImage);
        const psdFilename = baseName + '.psd';
        if (dir && await ensurePermission(dir)) {
          const savedName = await saveBlobToDirectory(psdBlob, psdFilename, dir);
          toast({ title: 'PSD saved', description: `${savedName} → ${dir.name}` });
        } else {
          downloadBlob(psdBlob, psdFilename);
        }
      } catch (err) {
        toast({ title: 'PSD export failed', description: err.message, variant: 'destructive' });
      }
      return;
    }

    if (cfg.format === 'cs') {
      if (template !== 'free_canvas') return;
      try {
        const csPayload = { type: 'cardsmith', version: 1, template: 'free_canvas', data: exportData };
        const csBlob = new Blob([JSON.stringify(csPayload, null, 2)], { type: 'application/json' });
        const csFilename = baseName + '.cs';
        if (dir && await ensurePermission(dir)) {
          const savedName = await saveBlobToDirectory(csBlob, csFilename, dir);
          toast({ title: 'CS file saved', description: `${savedName} → ${dir.name}` });
        } else {
          downloadBlob(csBlob, csFilename);
        }
      } catch (err) {
        toast({ title: 'CS export failed', description: err.message, variant: 'destructive' });
      }
      return;
    }

    const canvas = await exportCard(template, exportData, { margin: exportMargin, bgColor, bgImage });
    if (!canvas) {
      toast({ title: 'Export not supported', description: 'Canvas export is not available for this template.', variant: 'destructive' });
      return;
    }
    let finalCanvas = exportRotated ? rotateCanvas90CW(canvas) : canvas;
    if (cfg.format === 'jpg' && cfg.bgType === 'none') {
      const flat = document.createElement('canvas');
      flat.width = finalCanvas.width;
      flat.height = finalCanvas.height;
      const fctx = flat.getContext('2d');
      fctx.fillStyle = '#ffffff';
      fctx.fillRect(0, 0, flat.width, flat.height);
      fctx.drawImage(finalCanvas, 0, 0);
      finalCanvas = flat;
    }
    const ext = cfg.format === 'jpg' ? 'jpg' : 'png';
    const mime = cfg.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const filename = baseName + '.' + ext;
    if (dir && await ensurePermission(dir)) {
      const savedName = await saveCanvasToDirectory(finalCanvas, filename, dir, mime);
      toast({ title: 'Saved', description: `Saved as ${savedName} to ${dir.name}` });
    } else {
      downloadCanvas(finalCanvas, filename, mime);
    }
  };

  const doDatabaseSave = async (exportData, title) => {
    const finalName = (title || 'card').trim();
    const bgColor = primaryExport.bgType === 'color' ? primaryExport.bgColor : undefined;
    const bgImage = pickBgImage(primaryExport);
    const canvas = await exportCard(template, exportData, { margin: false, bgColor, bgImage });
    if (!canvas) { toast({ title: 'Export not supported', variant: 'destructive' }); return; }
    const finalCanvas = exportRotated ? rotateCanvas90CW(canvas) : canvas;
    const tab = (dbTab || defaultTabForTemplate(template)).trim() || defaultTabForTemplate(template);
    await saveCardToDatabase({ name: finalName, template, tab, tags: dbTags, pngCanvas: finalCanvas, csData: exportData, needsReview: dbNeedsReview });
    toast({ title: 'Saved to database', description: `"${finalName}" was published.` });
  };

  const handleExport = async () => {
    if (!saveOptionsEnabled && !saveToDatabase) {
      toast({ title: 'Nothing to save', description: 'Enable Save Options or Save to Database in Save Settings.' });
      return;
    }
    setExporting(true);
    try {
      const exportData = template === 'free_canvas' ? { ...getActiveWorkspace()?.getData(), collected: getCollected(), savedColors: getColors() } : cardData;
      const title = template === 'free_canvas' ? (getTitleCrownName(exportData) || canvases[activeIndex]?.name || 'canvas') : getCardTitle(template, cardData, cardName);
      if (saveOptionsEnabled) {
        await runExport(exportData, title, primaryExport, '');
        if (saveCopy) await runExport(exportData, title, copyExport, '_copy', copyDirHandle);
      }
      if (saveToDatabase) {
        await doDatabaseSave(exportData, title);
      }
    } catch (error) {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // Database save now flows through doDatabaseSave + handleExport toggles.

  if (!template) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-[1400px] mx-auto px-4">
            <div className="h-14 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold font-heading text-foreground">Card Creator</h1>
              </div>
              <div className="flex items-center gap-3">
                <FormatTool className="h-10 px-4 text-sm" iconSize={16} />
                <BorderTool className="h-10 px-4 text-sm" iconSize={16} />
                <SliceTool className="h-10 px-4 text-sm" iconSize={16} />
                <Button variant="outline" size="sm" className="h-10 px-4 text-sm" onClick={() => window.open('https://proxyprint.taxiera.net/', '_blank')}>
                  <Printer size={16} className="mr-2" /> Print
                </Button>
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-[1400px] mx-auto px-4">
          <TemplateSelector onSelect={handleSelectTemplate} />
        </div>
        <FreeCanvasStartDialog
          open={showStartDialog}
          onOpenChange={setShowStartDialog}
          onSizeSelect={handleFreeCanvasSize}
          onTemplateSelect={handleTemplateSelect}
          onOpenFile={handleOpenFile}
          onOpenPsd={handleOpenPsd}
          onOpenCs={handleOpenCs}
        />
      </div>
    );
  }

  const iconEntity = template === 'glimpses' ? 'UploadedIcon'
    : template === 'seven_wonders' ? 'SevenWondersBase'
    : null;

  const previewColored = primaryExport.bgType !== 'none';
  const previewBgColor = primaryExport.bgType === 'color' ? primaryExport.bgColor : undefined;
  const previewBgImage = primaryExport.bgType === 'image' ? ((Array.isArray(primaryExport.bgImages) && primaryExport.bgImages.filter(Boolean)[0]) || primaryExport.bgImage || undefined) : undefined;
  const saveSettingsActive = saveToDatabase || (saveOptionsEnabled && (exportMargin || saveCopy || primaryExport.format !== 'png' || primaryExport.bgType !== 'none'));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30" data-no-deselect>
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setTemplate(null); setCardData(null); setCanvases([]); }}
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="text-lg font-bold font-heading text-foreground">New Card</h1>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {getTemplate(template)?.label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {template === 'free_canvas' ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIconsFontsOpen(true)}>
                    <ImageIcon size={14} className="mr-2" /> Icons
                  </Button>
                  <Button
                    variant={linesMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (linesMode) {
                        setLinesMode(false);
                      } else {
                        setLinesMode(true);
                        setArrowsEnabled(!!getActiveWorkspace()?.getData()?.arrows);
                        setLinesDialogOpen(true);
                      }
                    }}
                  >
                    <Share2 size={14} className="mr-2" /> Lines
                  </Button>
                  <Button
                    variant={(snapGuides.borders || snapGuides.layers || snapGuides.rotation || snapGuides.centers) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSnapDialogOpen(true)}
                  >
                    <Magnet size={14} className="mr-2" /> Snap
                  </Button>
                  <BackgroundTool config={primaryExport} setConfig={setPrimaryExport} />
                  <Button
                    variant={saveSettingsActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setColorCopyDialogOpen(true)}
                  >
                    <FolderOpen size={14} className="mr-2" /> Save Settings
                  </Button>
                </>
              ) : (
                <>
                  {iconEntity && (
                    <Button variant="outline" size="sm" onClick={() => setShowIconManager(true)}>
                      <ImageIcon size={14} className="mr-2" /> Icons
                    </Button>
                  )}
                  <BackgroundTool config={primaryExport} setConfig={setPrimaryExport} />
                  <Button
                    variant={saveSettingsActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setColorCopyDialogOpen(true)}
                  >
                    <FolderOpen size={14} className="mr-2" /> Save Settings
                  </Button>
                </>
              )}
              <Button variant="default" size="sm" onClick={handleExport} disabled={exporting}>
                <Download size={14} className="mr-2" /> {exporting ? 'Exporting...' : 'Export'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {template === 'free_canvas' ? (
          <div>
            {canvases.map((c, i) => (
              <FreeCanvasWorkspace
                key={c.id}
                ref={el => { if (el) workspaceRefs.current[c.id] = el; }}
                initialData={c.data}
                isActive={i === activeIndex}
                snapGuides={snapGuides}
                linesMode={linesMode}
                lineStyle={lineStyle}
                lineWidth={lineWidth}
                selectionMode={selectionMode}
                magicTolerance={magicTolerance}
                onMagicToleranceChange={setMagicTolerance}
                exportColorCopy={previewColored}
                exportBgColor={previewBgColor}
                exportBgImage={previewBgImage}
                onDataChange={handleWorkspaceDataChange}
                onColorizeRequest={handleColorizeRequest}
                onNameChange={handleCanvasNameChange}
                canvases={canvases}
                activeIndex={activeIndex}
                onSelectTab={switchCanvas}
                onCloseTab={closeCanvas}
                onAddTab={addCanvasTab}
                onSelectMode={handleSelectMode}
                onToggleSelect={handleToggleSelect}
              />
            ))}
          </div>
        ) : (
        <div className="flex gap-6">
          <div className="w-[480px] flex-shrink-0">
            <div className="p-4 sticky top-20 space-y-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <div>
                {template === 'playing_card' && cardData && (
                  <PlayingCardEditor
                    data={cardData}
                    onChange={(newData) => {
                      handleDataChange(newData);
                      if (newData.value !== undefined) setCardName(newData.value);
                    }}
                  />
                )}
                {template === 'glimpses' && cardData && (
                  <GlimpsesEditor
                    data={cardData}
                    onChange={(newData) => {
                      handleDataChange(newData);
                      if (newData.title !== undefined) setCardName(newData.title);
                    }}
                  />
                )}
                {template === 'seven_wonders' && cardData && (
                  <SevenWondersEditor
                    data={cardData}
                    onChange={handleDataChange}
                    onNameChange={setCardName}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className={`${previewColored ? 'bg-card' : 'bg-foreground'} border border-border rounded-xl p-6 sticky top-20`}>
              <div className={`text-xs uppercase tracking-widest mb-4 text-center font-semibold ${previewColored ? 'text-muted-foreground' : 'text-background'}`}>
                Live Preview
              </div>
              <div className="flex justify-center">
                <CardPreview
                  template={template}
                  data={cardData}
                  bgColor={previewColored ? previewBgColor : undefined}
                  bgImage={previewColored ? (previewBgImage || undefined) : undefined}
                />
              </div>
            </div>
          </div>
          </div>
        )}
      </div>

      {template === 'seven_wonders' ? (
        <SevenWondersIconManager open={showIconManager} onOpenChange={setShowIconManager} />
      ) : iconEntity ? (
        <IconManager open={showIconManager} onOpenChange={setShowIconManager} entityName={iconEntity} />
      ) : null}

      <IconsFontsDialog open={iconsFontsOpen} onOpenChange={setIconsFontsOpen} />

      <SaveSettingsDialog
        open={colorCopyDialogOpen}
        onOpenChange={setColorCopyDialogOpen}
        template={template}
        saveToDatabase={saveToDatabase}
        setSaveToDatabase={setSaveToDatabase}
        dbNeedsReview={dbNeedsReview}
        setDbNeedsReview={setDbNeedsReview}
        dbTab={dbTab}
        setDbTab={setDbTab}
        dbTags={dbTags}
        setDbTags={setDbTags}
        existingTabs={existingTabs}
        saveOptionsEnabled={saveOptionsEnabled}
        setSaveOptionsEnabled={setSaveOptionsEnabled}
        exportMargin={exportMargin}
        setExportMargin={setExportMargin}
        exportRotated={exportRotated}
        setExportRotated={setExportRotated}
        defaultDirHandle={defaultDirHandle}
        onChooseDirectory={() => chooseDirectory('defaultSave', setDefaultDirHandle)}
        primaryFormat={primaryExport.format}
        setPrimaryFormat={(f) => setPrimaryExport((p) => ({ ...p, format: f }))}
        saveCopy={saveCopy}
        setSaveCopy={setSaveCopy}
        copy={copyExport}
        setCopy={setCopyExport}
        copyDirHandle={copyDirHandle}
        onChooseCopyDirectory={() => chooseDirectory('copySave', setCopyDirHandle)}
        projectData={{
          tabs: canvases.map(c => ({ name: c.name, data: workspaceRefs.current[c.id]?.getData() || c.data })),
          collected: getCollected(),
          savedColors: getColors(),
        }}
      />
      <Dialog open={linesDialogOpen} onOpenChange={setLinesDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Connection line settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Connection lines</Label>
                <p className="text-[11px] text-muted-foreground">Enable drawing connections between elements.</p>
              </div>
              <button
                onClick={() => setLinesMode(!linesMode)}
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${linesMode ? 'bg-primary' : 'bg-muted'}`}
                title="Toggle connection lines"
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${linesMode ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>
            {linesMode && (
              <>
                <div>
                  <Label className="text-xs font-medium mb-2 block">Line style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {LINE_STYLES.map(s => (
                      <Button
                        key={s.key}
                        variant={lineStyle === s.key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLineStyle(s.key)}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-2 block">Line width (px)</Label>
                  <Input
                    type="number" min="1" max="20"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-muted/30 border-border w-24"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">Direction arrows</Label>
                    <p className="text-[11px] text-muted-foreground">Draw small arrows along lines showing flow direction.</p>
                  </div>
                  <button
                    onClick={() => {
                      const ws = getActiveWorkspace();
                      const d = ws?.getData();
                      const next = !arrowsEnabled;
                      setArrowsEnabled(next);
                      if (d) ws.updateData({ ...d, arrows: next });
                    }}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${arrowsEnabled ? 'bg-primary' : 'bg-muted'}`}
                    title="Toggle direction arrows"
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${arrowsEnabled ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setLinesDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={snapDialogOpen} onOpenChange={setSnapDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Snap guide settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium mb-2 block">Choose which guides to snap to</Label>
              <Button
                variant={snapGuides.rotation ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSnapGuides(s => ({ ...s, rotation: !s.rotation }))}
                className="justify-start w-full"
              >
                <RotateCw size={14} className="mr-2" /> Rotations (45°)
              </Button>
              <Button
                variant={snapGuides.borders ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSnapGuides(s => ({ ...s, borders: !s.borders }))}
                className="justify-start w-full"
              >
                <Square size={14} className="mr-2" /> Card borders
              </Button>
              <Button
                variant={snapGuides.centers ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSnapGuides(s => ({ ...s, centers: !s.centers }))}
                className="justify-start w-full"
              >
                <AlignCenter size={14} className="mr-2" /> Centers (¼, ½, ¾)
              </Button>
              <Button
                variant={snapGuides.layers ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSnapGuides(s => ({ ...s, layers: !s.layers }))}
                className="justify-start w-full"
              >
                <Layers size={14} className="mr-2" /> Other layers
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Snap strength</Label>
                <span className="text-[11px] text-muted-foreground tabular-nums">{snapGuides.strength ?? 3}px</span>
              </div>
              <Slider value={[snapGuides.strength ?? 3]} min={1} max={20} step={1} onValueChange={(v) => setSnapGuides(s => ({ ...s, strength: v[0] }))} />
              <p className="text-[11px] text-muted-foreground">How close an edge needs to be before it snaps into place.</p>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setSnapDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ColorizeDialog
        open={colorizeDialogOpen}
        onOpenChange={setColorizeDialogOpen}
        settings={colorizeSettings}
        onSettingsChange={setColorizeSettings}
        onApply={handleColorizeApply}
      />
      <SelectionTool
        open={selectionDialogOpen}
        onOpenChange={setSelectionDialogOpen}
        mode={selectionMode}
        onModeChange={handleSelectMode}
      />
      <FreeCanvasStartDialog
        open={showStartDialog}
        onOpenChange={(v) => { setShowStartDialog(v); if (!v) setAddCanvasMode(false); }}
        onSizeSelect={handleFreeCanvasSize}
        onTemplateSelect={handleTemplateSelect}
        onOpenFile={handleOpenFile}
        onOpenPsd={handleOpenPsd}
        onOpenCs={handleOpenCs}
      />
    </div>
  );
}