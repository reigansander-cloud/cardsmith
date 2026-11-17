import React, { useState, useRef, forwardRef, useImperativeHandle, useCallback, useEffect } from 'react';
import FreeCanvasEditor from './FreeCanvasEditor';
import CardPreview from '@/components/cards/CardPreview';
import CanvasTabs from './CanvasTabs';
import PreviewToolbar from './PreviewToolbar';
import FormatMenu from './FormatMenu';
import SelectPanel from './SelectPanel';
import FillDialog from './FillDialog';
import { colorizeSelections, copySelections, cutSelections, fillSelections, canvasToClipboard, canvasToImageElement, getSelectionRegions } from '@/lib/canvasSelection';
import { setClipboard } from '@/lib/freeCanvasClipboard';
import { clearGhost } from '@/lib/freeCanvasGhostStore';

const FreeCanvasWorkspace = forwardRef(({ initialData, isActive, snapGuides, linesMode, lineStyle, lineWidth, selectionMode, exportColorCopy, exportBgColor, exportBgImage, onDataChange, onColorizeRequest, onNameChange, canvases, activeIndex, onSelectTab, onCloseTab, onAddTab, onSelectMode, onToggleSelect, magicTolerance, onMagicToleranceChange }, ref) => {
  const [data, setData] = useState(initialData);
  const [selectedElementIds, setSelectedElementIds] = useState([]);
  const [selection, setSelection] = useState(null);
  const [fillDialogOpen, setFillDialogOpen] = useState(false);
  const [fillColor, setFillColor] = useState('#ff0000');
  const [previewScale, setPreviewScale] = useState(1);
  const [cropZoom, setCropZoom] = useState(1);
  const [shrunkIds, setShrunkIds] = useState(() => new Set());
  const previewContainerRef = useRef(null);

  const handleShrinkStateChange = useCallback((id, isShrunk) => {
    setShrunkIds(prev => {
      const next = new Set(prev);
      if (isShrunk) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const historyRef = useRef([initialData]);
  const historyIndexRef = useRef(0);
  const lastChangeTimeRef = useRef(0);
  const dataRef = useRef(initialData);
  const colorizeRequestInfoRef = useRef(null);

  useEffect(() => {
    if (selectionMode === 'off') setSelection(null);
  }, [selectionMode]);

  useEffect(() => { if (!isActive) clearGhost(); }, [isActive]);

  const handleSelectionChange = useCallback((sel, additive) => {
    setSelection(prev => {
      if (!sel) return null;
      if (additive && prev) {
        const prevRegions = getSelectionRegions(prev);
        const newRegions = getSelectionRegions(sel);
        return { type: 'compound', regions: [...prevRegions, ...newRegions] };
      }
      return sel;
    });
  }, []);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const updateScale = () => {
      const availW = container.clientWidth - 4;
      const availH = window.innerHeight - 180;
      const cardW = data?.cardWidth || 360;
      const cardH = data?.cardHeight || 504;
      const scale = Math.min(1, availW / cardW, availH / cardH);
      setPreviewScale(scale > 0 ? scale : 1);
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(container);
    window.addEventListener('resize', updateScale);
    return () => { ro.disconnect(); window.removeEventListener('resize', updateScale); };
  }, [data?.cardWidth, data?.cardHeight]);

  const handleDataChange = useCallback((newData) => {
    setData(newData);
    dataRef.current = newData;
    onDataChange?.(newData);

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
  }, [onDataChange]);

  const handleColorizeRequest = useCallback((info) => {
    colorizeRequestInfoRef.current = info;
    onColorizeRequest?.();
  }, [onColorizeRequest]);

  const getTopElement = () => {
    const elements = dataRef.current?.elements || [];
    const selected = elements.filter(el => selectedElementIds.includes(el.id));
    if (selected.length > 0) return selected[selected.length - 1];
    // No explicit selection — use the topmost element (last in render order)
    return elements[elements.length - 1];
  };

  const handleCopy = useCallback(async () => {
    const topEl = getTopElement();
    const regions = getSelectionRegions(selection);
    if (topEl && regions.length > 0) {
      const canvas = await copySelections(topEl, regions, data.cardWidth, data.cardHeight);
      canvasToClipboard(canvas);
      setClipboard([canvasToImageElement(canvas, selection, data.cardWidth, data.cardHeight)]);
    }
  }, [selection, selectedElementIds, data]);

  const handleCut = useCallback(() => {
    const topEl = getTopElement();
    const regions = getSelectionRegions(selection);
    if (topEl && regions.length > 0) {
      cutSelections(topEl, regions, data.cardWidth, data.cardHeight).then(({ clipboard: copiedCanvas, updatedEl }) => {
        canvasToClipboard(copiedCanvas);
        setClipboard([canvasToImageElement(copiedCanvas, selection, data.cardWidth, data.cardHeight)]);
        handleDataChange({
          ...dataRef.current,
          elements: (dataRef.current.elements || []).map(el => el.id === topEl.id ? updatedEl : el),
        });
      });
    }
  }, [selection, selectedElementIds, data]);

  const handleColorize = useCallback(() => {
    const topEl = getTopElement();
    const regions = getSelectionRegions(selection);
    if (topEl && regions.length > 0) {
      handleColorizeRequest({ element: topEl, selection, cardW: data.cardWidth, cardH: data.cardHeight });
    }
  }, [selection, selectedElementIds, data]);

  const handleFillApply = useCallback(async () => {
    const topEl = getTopElement();
    const regions = getSelectionRegions(selection);
    if (topEl && regions.length > 0) {
      const updatedEl = await fillSelections(topEl, regions, data.cardWidth, data.cardHeight, fillColor);
      handleDataChange({
        ...dataRef.current,
        elements: (dataRef.current.elements || []).map(el => el.id === topEl.id ? updatedEl : el),
      });
    }
    setFillDialogOpen(false);
  }, [selection, selectedElementIds, data, fillColor]);

  useImperativeHandle(ref, () => ({
    getData: () => dataRef.current,
    setData: (newData) => {
      setData(newData);
      dataRef.current = newData;
    },
    // Update data AND record it in the action history (so Ctrl+Z works).
    updateData: handleDataChange,
    undo: () => {
      if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
        const prev = historyRef.current[historyIndexRef.current];
        setData(prev);
        dataRef.current = prev;
      }
    },
    redo: () => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current++;
        const next = historyRef.current[historyIndexRef.current];
        setData(next);
        dataRef.current = next;
      }
    },
    applyColorize: async (settings) => {
      const info = colorizeRequestInfoRef.current;
      if (!info) return;
      const { element, selection: sel, cardW, cardH } = info;
      const regions = getSelectionRegions(sel);
      if (regions.length === 0) return;
      const updatedEl = await colorizeSelections(element, regions, cardW, cardH, settings.color, settings.amount);
      handleDataChange({
        ...dataRef.current,
        elements: (dataRef.current.elements || []).map(el => el.id === element.id ? updatedEl : el),
      });
      colorizeRequestInfoRef.current = null;
    },
    clearSelection: () => setSelection(null),
  }));

  const hasSelection = selection != null;

  return (
    <div className={isActive ? 'flex gap-4' : 'hidden'}>
      <div className="w-[340px] flex-shrink-0" data-no-deselect>
        <div className="p-3 sticky top-20 space-y-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <SelectPanel
            selectionMode={selectionMode}
            onSelectMode={onSelectMode}
            magicTolerance={magicTolerance}
            onMagicToleranceChange={onMagicToleranceChange}
            onCopy={handleCopy}
            onCut={handleCut}
            onColorize={handleColorize}
            onFill={() => setFillDialogOpen(true)}
            hasSelection={hasSelection}
          />
          <FreeCanvasEditor
            data={data}
            onChange={handleDataChange}
            onNameChange={onNameChange}
            selectedIds={selectedElementIds}
            onSelectElements={setSelectedElementIds}
            shrunkIds={shrunkIds}
            mode="properties"
          />
        </div>
      </div>
      <div className="flex-1">
        {isActive && canvases && canvases.length > 0 && (
          <CanvasTabs
            canvases={canvases}
            activeIndex={activeIndex}
            onSelect={onSelectTab}
            onClose={onCloseTab}
            onAdd={onAddTab}
            accentClass={exportColorCopy ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background'}
          />
        )}
        <div className={`${exportColorCopy ? 'bg-card' : 'bg-foreground'} border border-border rounded-xl p-6 ${data?.cardWidth === 850 && data?.cardHeight >= 1100 ? '' : 'sticky top-20'}`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-xs uppercase tracking-widest font-semibold ${exportColorCopy ? 'text-muted-foreground' : 'text-background'}`}>Live Preview</span>
            <FormatMenu
              data={data}
              onChange={handleDataChange}
              exportColorCopy={exportColorCopy}
              cropZoom={cropZoom}
              onCropZoomChange={setCropZoom}
            />
          </div>
          <div ref={previewContainerRef} className="flex justify-center overflow-hidden" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
            <div style={{ zoom: previewScale * cropZoom }}>
              <CardPreview
                template="free_canvas"
                data={data}
                bgColor={exportColorCopy ? exportBgColor : undefined}
                bgImage={exportColorCopy ? (exportBgImage || undefined) : undefined}
                onChange={handleDataChange}
                selectedIds={selectedElementIds}
                onSelectElements={setSelectedElementIds}
                snapGuides={snapGuides}
                linesMode={linesMode}
                lineStyle={lineStyle}
                lineWidth={lineWidth}
                selectionMode={selectionMode}
                magicTolerance={magicTolerance}
                selection={selection}
                onSelectionChange={handleSelectionChange}
                onColorizeRequest={handleColorizeRequest}
                onExitSelectionMode={() => onSelectMode?.('off')}
                onShrinkStateChange={handleShrinkStateChange}
                isActive={isActive}
              />
            </div>
          </div>
        </div>
        <PreviewToolbar
          data={data}
          onChange={handleDataChange}
          isActive={isActive}
        />
        <FillDialog
          open={fillDialogOpen}
          onOpenChange={setFillDialogOpen}
          color={fillColor}
          onColorChange={setFillColor}
          onApply={handleFillApply}
        />
      </div>
      <div className="w-[340px] flex-shrink-0" data-no-deselect>
        <div className="p-3 sticky top-20 space-y-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <FreeCanvasEditor
            data={data}
            onChange={handleDataChange}
            onNameChange={onNameChange}
            selectedIds={selectedElementIds}
            onSelectElements={setSelectedElementIds}
            mode="elements"
          />
        </div>
      </div>
    </div>
  );
});

FreeCanvasWorkspace.displayName = 'FreeCanvasWorkspace';
export default FreeCanvasWorkspace;