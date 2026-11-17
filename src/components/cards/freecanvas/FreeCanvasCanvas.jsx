import React, { useRef, useCallback, useEffect, useState } from 'react';
import { imagePreviewStyle } from '@/lib/imageEffects';
import { canvasToClipboard, canvasToImageElement, magicWandSelect, getSelectionRegions, copySelections, cutSelections } from '@/lib/canvasSelection';
import { buildStyledStrokes } from '@/lib/shapeLineStyle';
import { getClipboard, setClipboard } from '@/lib/freeCanvasClipboard';
import { POINT_NAMES, getAnchorPoint, buildConnectionPath, getConnectionArrows } from '@/lib/connectionPaths';
import { PIP_POSITIONS, parseRichTokens } from '@/lib/dicePips';
import { buildGridSVG } from '@/lib/gridLayerRenderer';
import { condenseCosts } from './CostBarEditor';
import ShrinkToFitText from './ShrinkToFitText';
import { subscribeGhost, getGhost } from '@/lib/freeCanvasGhostStore';

function renderTextContent(content, el) {
  if (!content) return '';
  const baseBold = el?.bold;
  const baseItalic = el?.italic;
  const baseUnderline = el?.underline;
  const tokens = parseRichTokens(content);
  return tokens.map((tok, idx) => {
    if (tok.type === 'icon') {
      return <img key={`icon-${idx}`} src={tok.url} alt="" style={{ display: 'inline-block', verticalAlign: 'middle', height: '1.35em', width: '1.35em', objectFit: 'contain', margin: '0 -0.1em' }} />;
    }
    const b = baseBold || tok.bold;
    const it = baseItalic || tok.italic;
    const u = baseUnderline || tok.underline;
    return (
      <span key={`t-${idx}`} style={{ fontWeight: b ? 'bold' : 'normal', fontStyle: it ? 'italic' : 'normal', textDecoration: u ? 'underline' : 'none' }}>
        {tok.value}
      </span>
    );
  });
}

const SNAP_THRESHOLD = 3;

// Snap a single edge (pos) to the nearest line within threshold.
const snapToLines = (pos, lines, threshold = SNAP_THRESHOLD) => {
  for (const l of lines) {
    if (Math.abs(pos - l) <= threshold) return l;
  }
  return pos;
};

// Snap a box (pos, size): try left edge, then right edge, then center to a center line.
const snapPosToLines = (pos, size, lines, center, threshold = SNAP_THRESHOLD) => {
  for (const l of lines) {
    if (Math.abs(pos - l) <= threshold) return l;
  }
  for (const l of lines) {
    if (Math.abs(pos + size - l) <= threshold) return l - size;
  }
  const centerLines = Array.isArray(center) ? center : [center];
  const c = pos + size / 2;
  for (const l of centerLines) {
    if (Math.abs(c - l) <= threshold) return l - size / 2;
  }
  return pos;
};

function ShapePreview({ el, scale }) {
  const sw = Math.max(0.5, (el.strokeWidth || 3) * scale);
  const color = el.color || '#000000';
  const radiusMap = { rectangle: '0', rounded: '22%', ellipse: '50%' };
  const r = radiusMap[el.shape];
  const pips = el.pips ? (PIP_POSITIONS[el.pips] || []) : [];
  const pipsOverlay = pips.length > 0 ? (
    <div className="absolute inset-0 pointer-events-none">
      {pips.map(([px, py], i) => (
        <div key={i} className="absolute rounded-full" style={{
          left: `${px * 100}%`, top: `${py * 100}%`,
          width: '14%', height: '14%',
          transform: 'translate(-50%, -50%)',
          background: color,
        }} />
      ))}
    </div>
  ) : null;
  if (!el.filled && (el.lineStyle === 'drawn' || el.lineStyle === 'choppy')) {
    const strokes = buildStyledStrokes(el.shape, el.lineStyle, el.id);
    const opacity = el.lineStyle === 'drawn' ? 0.55 : 1;
    return (
      <div className="w-full h-full pointer-events-none relative">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full pointer-events-none select-none" style={{ overflow: 'visible' }}>
          {strokes.map((poly, i) => (
            <path key={i} d={poly.map(([x, y], j) => `${j === 0 ? 'M' : 'L'} ${x * 100} ${y * 100}`).join(' ')} stroke={color} strokeWidth={sw} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
          ))}
        </svg>
        {pipsOverlay}
      </div>
    );
  }
  if (r !== undefined) {
    if (el.filled) {
      return <div className="w-full h-full pointer-events-none relative" style={{ background: color, borderRadius: r }}>{pipsOverlay}</div>;
    }
    return <div className="w-full h-full pointer-events-none relative" style={{ borderRadius: r, boxShadow: `0 0 0 ${sw}px ${color}` }}>{pipsOverlay}</div>;
  }
  const stroke = el.filled ? 'none' : color;
  const fill = el.filled ? color : 'none';
  const swAttr = el.filled ? 0 : sw;
  const common = { stroke, strokeWidth: swAttr, fill, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round', strokeLinecap: 'round' };
  const svgProps = { viewBox: '0 0 100 100', preserveAspectRatio: 'none', className: 'w-full h-full pointer-events-none select-none', style: { overflow: 'visible' } };
  switch (el.shape) {
    case 'triangle': return <svg {...svgProps}><polygon points="50,0 100,100 0,100" {...common} />{pips.map(([px, py], i) => <circle key={i} cx={px * 100} cy={py * 100} r="8" fill={color} />)}</svg>;
    case 'diamond': return <svg {...svgProps}><polygon points="50,0 100,50 50,100 0,50" {...common} />{pips.map(([px, py], i) => <circle key={i} cx={px * 100} cy={py * 100} r="8" fill={color} />)}</svg>;
    case 'line': return <svg {...svgProps}><line x1="0" y1="0" x2="100" y2="100" stroke={color} strokeWidth={sw} vectorEffect="non-scaling-stroke" strokeLinecap="round" /></svg>;
    default: return null;
  }
}

function GhostLayer({ ghost, cardScale }) {
  if (!ghost) return null;
  const ar = ghost.aspectRatio || (ghost.height ? ghost.width / ghost.height : 1);
  const height = ghost.type === 'image' ? ghost.width / (ar || 1) : (ghost.height || ghost.width);
  return (
    <div className="absolute pointer-events-none select-none" style={{ left: `${ghost.x}px`, top: `${ghost.y}px`, width: `${ghost.width}px`, height: `${height}px`, opacity: 0.3, zIndex: 10003, transform: `rotate(${ghost.rotation || 0}deg)` }}>
      {ghost.type === 'image' ? (
        <img src={ghost.url} alt="" className="w-full h-full object-contain" draggable={false} />
      ) : ghost.type === 'shape' ? (
        <ShapePreview el={ghost} scale={cardScale} />
      ) : ghost.type === 'text' ? (
        <div className="w-full h-full overflow-hidden" style={{ fontSize: ghost.fontSize || 14, color: ghost.color || '#000000', fontFamily: ghost.fontFamily || 'inherit', textAlign: ghost.align || 'left', fontWeight: ghost.bold ? 'bold' : 'normal', fontStyle: ghost.italic ? 'italic' : 'normal' }}>{renderTextContent(ghost.content, ghost)}</div>
      ) : (
        <div className="w-full h-full border border-dashed border-primary" />
      )}
    </div>
  );
}

function DrawingLayer({ el, scale, active, tool, onCommitStroke }) {
  const canvasRef = useRef(null);
  const current = useRef(null);

  const redraw = () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = rect.width, H = rect.height;
    const pxW = Math.max(1, Math.round(W * dpr));
    const pxH = Math.max(1, Math.round(H * dpr));
    if (cvs.width !== pxW) cvs.width = pxW;
    if (cvs.height !== pxH) cvs.height = pxH;
    const ctx = cvs.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const gridX = el.pixelSize || 16;
    const gridY = el.pixelArt ? Math.max(1, Math.round(gridX * H / W)) : gridX;
    const cellW = W / gridX, cellH = H / gridY;

    const drawStroke = (s) => {
      if (!s || !s.points || s.points.length === 0) return;
      ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
      if (el.pixelArt) {
        ctx.fillStyle = s.color || '#000000';
        const drawCell = (gx, gy) => ctx.fillRect(gx * cellW, gy * cellH, Math.ceil(cellW) + 0.5, Math.ceil(cellH) + 0.5);
        for (let i = 0; i < s.points.length; i++) {
          const gx = Math.round(s.points[i].x * gridX), gy = Math.round(s.points[i].y * gridY);
          if (i === 0) { drawCell(gx, gy); continue; }
          const px = Math.round(s.points[i - 1].x * gridX), py = Math.round(s.points[i - 1].y * gridY);
          let x0 = px, y0 = py; const x1 = gx, y1 = gy;
          const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
          const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
          let err = dx - dy;
          while (true) {
            drawCell(x0, y0);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
          }
        }
      } else {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = (s.size || 6) * scale;
        ctx.strokeStyle = s.color || '#000000';
        ctx.fillStyle = s.color || '#000000';
        ctx.beginPath();
        ctx.moveTo(s.points[0].x * W, s.points[0].y * H);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x * W, s.points[i].y * H);
        if (s.fill) ctx.fill(); else ctx.stroke();
      }
    };
    (el.strokes || []).forEach(drawStroke);
    if (current.current) drawStroke(current.current);
    ctx.globalCompositeOperation = 'source-over';

    // Very faint pixel grid overlay (guide only — not part of the artwork)
    if (el.pixelArt) {
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= gridX; i++) { ctx.moveTo(i * cellW, 0); ctx.lineTo(i * cellW, H); }
      for (let j = 0; j <= gridY; j++) { ctx.moveTo(0, j * cellH); ctx.lineTo(W, j * cellH); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  useEffect(() => { redraw(); });

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ro = new ResizeObserver(redraw);
    ro.observe(cvs);
    return () => ro.disconnect();
  }, []);

  const pointerPos = (e) => {
    const cvs = canvasRef.current;
    const rect = cvs.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    let y = (e.clientY - rect.top) / rect.height;
    if (el.pixelArt) {
      const gx = el.pixelSize || 16;
      const gy = Math.max(1, Math.round(gx * rect.height / rect.width));
      x = Math.min(gx - 1, Math.max(0, Math.floor(x * gx))) / gx;
      y = Math.min(gy - 1, Math.max(0, Math.floor(y * gy))) / gy;
    }
    return { x, y };
  };

  const onDown = (e) => {
    if (!active || tool === 'move') return;
    e.stopPropagation();
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    current.current = { color: el.drawColor || '#000000', size: el.drawSize || 6, erase: tool === 'eraser', points: [pointerPos(e)] };
    redraw();
  };
  const onMove = (e) => {
    if (!current.current) return;
    current.current.points.push(pointerPos(e));
    redraw();
  };
  const onUp = (e) => {
    if (!current.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    onCommitStroke(current.current);
    current.current = null;
  };

  const drawMode = active && tool !== 'move';
  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ pointerEvents: drawMode ? 'auto' : 'none', touchAction: 'none', cursor: drawMode ? 'crosshair' : 'default' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}

function CostBarPreview({ el, pxH }) {
  const costs = el.costs || [];
  if (costs.length === 0) return null;
  const iconH = Math.max(8, pxH);
  const justify = el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start';

  if (el.iconx === false) {
    return (
      <div className="w-full h-full flex items-center overflow-hidden pointer-events-none select-none" style={{ justifyContent: justify, gap: `${Math.max(1, iconH * 0.08)}px` }}>
        {costs.map((c, i) => (
          <div key={i} className="flex items-center" style={{ height: '100%' }}>
            <img src={c.url} alt="" style={{ height: '100%', width: 'auto', objectFit: 'contain' }} draggable={false} />
          </div>
        ))}
      </div>
    );
  }

  const condensed = condenseCosts(costs);
  return (
    <div className="w-full h-full flex items-center overflow-hidden pointer-events-none select-none" style={{ justifyContent: justify, gap: `${Math.max(1, iconH * 0.08)}px`, fontSize: `${iconH * 0.5}px` }}>
      {condensed.map((g, i) => (
        <div key={i} className="flex items-center" style={{ height: '100%' }}>
          <img src={g.url} alt="" style={{ height: '100%', width: 'auto', objectFit: 'contain' }} draggable={false} />
          <span className="font-semibold leading-none ml-0.5 mr-1.5" style={{ color: el.color || '#000000' }}>×{g.count}</span>
        </div>
      ))}
    </div>
  );
}

function GridLayerPreview({ el, pxW, pxH }) {
  const svg = buildGridSVG(el.grids || [], el.connections || [], pxW, pxH, el.color || '#3a2a0a', true);
  if (!svg) return null;
  return (
    <div
      className="w-full h-full pointer-events-none select-none"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function FreeCanvasCanvas({ data, bgColor, bgImage, onChange, selectedIds, onSelectElements, snapGuides, linesMode, lineStyle, lineWidth, selectionMode, selection, onSelectionChange, onColorizeRequest, onExitSelectionMode, onShrinkStateChange, isActive = true, magicTolerance = 72 }) {
  const cardRef = useRef(null);
  const elements = data?.elements || [];
  const selectionRegions = selection?.type === 'compound' ? (selection.regions || []) : (selection ? [selection] : []);
  const connections = data?.connections || [];
  const cardW = data?.cardWidth || 360;
  const cardH = data?.cardHeight || 504;
  const [cardScale, setCardScale] = useState(1);
  const [dragConnection, setDragConnection] = useState(null);
  const [drawingSelection, setDrawingSelection] = useState(null);
  const [magicPicking, setMagicPicking] = useState(false);
  const [ghost, setGhostState] = useState(getGhost());
  useEffect(() => subscribeGhost(setGhostState), []);

  useEffect(() => {
    const update = () => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      if (rect.width) setCardScale(rect.width / cardW);
    };
    update();
    // Retry after a tick — when switching tabs, the container goes from
    // display:none to visible and the initial getBoundingClientRect may
    // still report zero width.
    const t = setTimeout(update, 50);
    let ro;
    if (cardRef.current && window.ResizeObserver) {
      ro = new ResizeObserver(update);
      ro.observe(cardRef.current);
    }
    window.addEventListener('resize', update);
    return () => { clearTimeout(t); if (ro) ro.disconnect(); window.removeEventListener('resize', update); };
  }, [cardW, isActive]);

  // Click outside the canvas exits selection and drawing modes.
  useEffect(() => {
    if (!isActive) return;
    const handleMouseDown = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target) && !e.target.closest('[data-no-deselect]')) {
        onExitSelectionMode?.();
        onSelectionChange?.(null);
        onSelectElements?.([]);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isActive, onExitSelectionMode, onSelectionChange, onSelectElements]);

  const elementHeight = (el) => {
    if (el.type === 'image') {
      const ar = el.aspectRatio || (el.height ? el.width / el.height : 1);
      return el.width / ar;
    }
    return el.height;
  };

  const snapThreshold = snapGuides?.strength ?? 3;
  // Snap lines = card edges/center (borders) + quarter/center lines (centers) + the sides of every other element (layers).
  const snapLinesX = (excludeId) => {
    const lines = [];
    if (snapGuides?.borders) lines.push(0, cardW / 2, cardW);
    if (snapGuides?.centers) lines.push(cardW / 4, cardW / 2, 3 * cardW / 4);
    if (snapGuides?.layers) {
      for (const el of elements) {
        if (el.id === excludeId) continue;
        lines.push(el.x, el.x + el.width);
      }
    }
    return lines;
  };
  const snapLinesY = (excludeId) => {
    const lines = [];
    if (snapGuides?.borders) lines.push(0, cardH / 2, cardH);
    if (snapGuides?.centers) lines.push(cardH / 4, cardH / 2, 3 * cardH / 4);
    if (snapGuides?.layers) {
      for (const el of elements) {
        if (el.id === excludeId) continue;
        lines.push(el.y, el.y + elementHeight(el));
      }
    }
    return lines;
  };

  const updateElement = useCallback((id, fields) => {
    if (!onChange) return;
    onChange({ ...data, elements: elements.map(el => el.id === id ? { ...el, ...fields } : el) });
  }, [data, elements, onChange]);

  // Arrow keys nudge the selected element by 1%.
  useEffect(() => {
    if (!onChange || !isActive) return;
    const handler = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      const selected = selectedIds.length > 0 ? elements.filter(x => selectedIds.includes(x.id)) : [];

      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length > 0) {
        e.preventDefault();
        onChange({
          ...data,
          elements: elements.filter(x => !selectedIds.includes(x.id)),
          connections: connections.filter(c => !selectedIds.includes(c.fromId) && !selectedIds.includes(c.toId)),
        });
        onSelectElements?.([]);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selection) {
        e.preventDefault();
        const topEl = elements.find(el => selectedIds.includes(el.id));
        if (topEl) {
          const regions = getSelectionRegions(selection);
          if (regions.length > 0) {
            copySelections(topEl, regions, cardW, cardH).then(canvas => {
              canvasToClipboard(canvas);
              setClipboard([canvasToImageElement(canvas, selection, cardW, cardH)]);
            });
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selection) {
        e.preventDefault();
        const topEl = elements.find(el => selectedIds.includes(el.id));
        if (topEl) {
          const regions = getSelectionRegions(selection);
          if (regions.length > 0) {
            cutSelections(topEl, regions, cardW, cardH).then(({ clipboard: copiedCanvas, updatedEl }) => {
              canvasToClipboard(copiedCanvas);
              setClipboard([canvasToImageElement(copiedCanvas, selection, cardW, cardH)]);
              onChange({ ...data, elements: elements.map(el => el.id === topEl.id ? updatedEl : el) });
            });
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'u' && selection) {
        e.preventDefault();
        const topEl = elements.find(el => selectedIds.includes(el.id) && el.type !== 'text');
        if (topEl) {
          onColorizeRequest?.({ element: topEl, selection, cardW, cardH });
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selected.length > 0) {
        e.preventDefault();
        setClipboard(selected.map(el => ({ ...el })));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selected.length > 0) {
        e.preventDefault();
        setClipboard(selected.map(el => ({ ...el })));
        onChange({ ...data, elements: elements.filter(el => !selectedIds.includes(el.id)) });
        onSelectElements?.([]);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && getClipboard().length > 0) {
        e.preventDefault();
        const copies = getClipboard().map((el, i) => ({
          ...el,
          id: `el_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
          x: (el.x || 0) + 3,
          y: (el.y || 0) + 3,
        }));
        onChange({ ...data, elements: [...copies, ...elements] });
        onSelectElements?.(copies.map(c => c.id));
        return;
      }

      if (selected.length === 0) return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      let dx = 0, dy = 0;
      if (e.key === 'ArrowUp') dy = -5;
      else if (e.key === 'ArrowDown') dy = 5;
      else if (e.key === 'ArrowLeft') dx = -5;
      else if (e.key === 'ArrowRight') dx = 5;
      onChange({
        ...data,
        elements: elements.map(el => selectedIds.includes(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el),
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, elements, data, onChange, onSelectElements, selection, cardW, cardH, onColorizeRequest, isActive]);

  const startDrag = (e, element) => {
    if (selectionMode === 'magic') {
      handleMagicPick(e);
      return;
    }
    if (selectionMode && selectionMode !== 'off') {
      startSelection(e);
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    // Ctrl/Cmd+click: toggle this element in the selection
    if (e.ctrlKey || e.metaKey) {
      if (selectedIds.includes(element.id)) {
        onSelectElements?.(selectedIds.filter(id => id !== element.id));
      } else {
        onSelectElements?.([...selectedIds, element.id]);
      }
      return;
    }

    // Shift+click: select all layers between the first selected and this one
    if (e.shiftKey && selectedIds.length > 0) {
      const anchorIdx = elements.findIndex(x => x.id === selectedIds[0]);
      const clickedIdx = elements.findIndex(x => x.id === element.id);
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        const [lo, hi] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx];
        onSelectElements?.(elements.slice(lo, hi + 1).map(x => x.id));
        return;
      }
    }

    // If clicking an unselected element, select only it
    if (!selectedIds.includes(element.id)) {
      onSelectElements?.([element.id]);
    }

    // Determine which elements to drag: all selected if the clicked one is already selected, else just this one
    const dragIds = selectedIds.includes(element.id) && selectedIds.length > 1 ? selectedIds : [element.id];

    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPositions = new Map();
    for (const id of dragIds) {
      const el = elements.find(x => x.id === id);
      if (el) startPositions.set(id, { x: el.x, y: el.y });
    }

    const linesX = snapLinesX(element.id);
    const linesY = snapLinesY(element.id);
    const elH = elementHeight(element);

    const onMove = (moveE) => {
      const dx = ((moveE.clientX - startX) / rect.width) * cardW;
      const dy = ((moveE.clientY - startY) / rect.height) * cardH;
      const newElements = elements.map(el => {
        const start = startPositions.get(el.id);
        if (!start) return el;
        let newX = start.x + dx;
        let newY = start.y + dy;
        if ((snapGuides?.borders || snapGuides?.layers || snapGuides?.centers) && dragIds.length === 1) {
          const centersX = snapGuides?.centers ? [cardW / 4, cardW / 2, 3 * cardW / 4] : cardW / 2;
          const centersY = snapGuides?.centers ? [cardH / 4, cardH / 2, 3 * cardH / 4] : cardH / 2;
          newX = snapPosToLines(newX, el.width, linesX, centersX, snapThreshold);
          newY = snapPosToLines(newY, elH, linesY, centersY, snapThreshold);
        }
        return { ...el, x: newX, y: newY };
      });
      onChange({ ...data, elements: newElements });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startResize = (e, element, corner) => {
    e.stopPropagation();
    e.preventDefault();
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = element.width;
    const startElX = element.x;
    const startElY = element.y;
    const isImage = element.type === 'image';
    const aspectRatio = element.aspectRatio || (element.height ? element.width / element.height : 1);
    const computeH = (w) => w / aspectRatio;
    const startH = isImage ? computeH(startW) : element.height;

    const linesX = snapLinesX(element.id);
    const linesY = snapLinesY(element.id);

    const onMove = (moveE) => {
      const dx = ((moveE.clientX - startX) / rect.width) * cardW;
      const dy = ((moveE.clientY - startY) / rect.height) * cardH;
      let newW, newH, newX = startElX, newY = startElY;

      if (isImage) {
        if (corner === 'br' || corner === 'tr') {
          newW = startW + dx;
          if (snapGuides?.borders || snapGuides?.layers || snapGuides?.centers) newW = snapToLines(startElX + newW, linesX, snapThreshold) - startElX;
          newW = Math.max(5, newW);
        } else {
          newW = startW - dx;
          newX = startElX + (startW - newW);
          if (snapGuides?.borders || snapGuides?.layers || snapGuides?.centers) newX = snapToLines(newX, linesX, snapThreshold);
          newW = Math.max(5, startElX + startW - newX);
          newX = startElX + startW - newW;
        }
        newH = computeH(newW);
        if (corner === 'tr' || corner === 'tl') newY = startElY + (startH - newH);
        updateElement(element.id, { width: newW, x: newX, y: newY });
      } else {
        if (corner === 'br' || corner === 'tr') {
          newW = startW + dx;
          if (snapGuides?.borders || snapGuides?.layers || snapGuides?.centers) newW = snapToLines(startElX + newW, linesX, snapThreshold) - startElX;
          newW = Math.max(5, newW);
        } else {
          newW = startW - dx;
          newX = startElX + (startW - newW);
          if (snapGuides?.borders || snapGuides?.layers || snapGuides?.centers) newX = snapToLines(newX, linesX, snapThreshold);
          newW = Math.max(5, startElX + startW - newX);
          newX = startElX + startW - newW;
        }
        if (corner === 'br' || corner === 'bl') {
          newH = startH + dy;
          if (snapGuides?.borders || snapGuides?.layers || snapGuides?.centers) newH = snapToLines(startElY + newH, linesY, snapThreshold) - startElY;
          newH = Math.max(5, newH);
        } else {
          newH = startH - dy;
          newY = startElY + (startH - newH);
          if (snapGuides?.borders || snapGuides?.layers || snapGuides?.centers) newY = snapToLines(newY, linesY, snapThreshold);
          newH = Math.max(5, startElY + startH - newY);
          newY = startElY + startH - newH;
        }
        updateElement(element.id, { width: newW, height: newH, x: newX, y: newY });
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startMultiResize = (e, corner) => {
    e.stopPropagation();
    e.preventDefault();
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const selected = elements.filter(el => selectedIds.includes(el.id) && el.type !== 'folder');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const elData = selected.map(el => {
      const h = elementHeight(el);
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + h);
      return { id: el.id, h };
    });
    const bbX = minX, bbY = minY, bbW = Math.max(0.01, maxX - minX), bbH = Math.max(0.01, maxY - minY);
    const rel = new Map();
    for (const el of selected) {
      const h = elementHeight(el);
      rel.set(el.id, {
        relX: (el.x - bbX) / bbW,
        relY: (el.y - bbY) / bbH,
        relW: el.width / bbW,
        relH: h / bbH,
      });
    }
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (moveE) => {
      const dx = ((moveE.clientX - startX) / rect.width) * cardW;
      const dy = ((moveE.clientY - startY) / rect.height) * cardH;
      let newBbX = bbX, newBbY = bbY, newBbW = bbW, newBbH = bbH;
      if (corner === 'br' || corner === 'tr') {
        newBbW = Math.max(5, bbW + dx);
      } else {
        newBbW = Math.max(5, bbW - dx);
        newBbX = bbX + (bbW - newBbW);
      }
      if (corner === 'br' || corner === 'bl') {
        newBbH = Math.max(5, bbH + dy);
      } else {
        newBbH = Math.max(5, bbH - dy);
        newBbY = bbY + (bbH - newBbH);
      }
      const scaleW = newBbW / bbW;
      const scaleH = newBbH / bbH;
      const newElements = elements.map(el => {
        const r = rel.get(el.id);
        if (!r) return el;
        const newWidth = Math.max(1, r.relW * newBbW);
        const newX = newBbX + r.relX * newBbW;
        const newY = newBbY + r.relY * newBbH;
        if (el.type === 'image') {
          return { ...el, x: newX, y: newY, width: newWidth };
        }
        return { ...el, x: newX, y: newY, width: newWidth, height: Math.max(1, r.relH * newBbH) };
      });
      onChange({ ...data, elements: newElements });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startMultiRotate = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const selected = elements.filter(el => selectedIds.includes(el.id) && el.type !== 'folder');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of selected) {
      const h = elementHeight(el);
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + h);
    }
    const bbCx = (minX + maxX) / 2;
    const bbCy = (minY + maxY) / 2;
    const cx = rect.left + (bbCx / cardW) * rect.width;
    const cy = rect.top + (bbCy / cardH) * rect.height;
    const startData = selected.map(el => {
      const h = elementHeight(el);
      return { id: el.id, dx: (el.x + el.width / 2) - bbCx, dy: (el.y + h / 2) - bbCy, startRotation: el.rotation || 0 };
    });
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const onMove = (moveE) => {
      const angle = Math.atan2(moveE.clientY - cy, moveE.clientX - cx);
      let delta = (angle - startAngle) * 180 / Math.PI;
      if (snapGuides?.rotation) delta = Math.round(delta / 45) * 45;
      else if (moveE.shiftKey) delta = Math.round(delta / 15) * 15;
      const rad = delta * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const newElements = elements.map(el => {
        const sd = startData.find(s => s.id === el.id);
        if (!sd) return el;
        const ndx = sd.dx * cos - sd.dy * sin;
        const ndy = sd.dx * sin + sd.dy * cos;
        const h = elementHeight(el);
        return {
          ...el,
          x: (bbCx + ndx) - el.width / 2,
          y: (bbCy + ndy) - h / 2,
          rotation: Math.round(((sd.startRotation + delta) % 360 + 360) % 360),
        };
      });
      onChange({ ...data, elements: newElements });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startRotate = (e, element) => {
    e.stopPropagation();
    e.preventDefault();
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + ((element.x + element.width / 2) / cardW) * rect.width;
    const elH = elementHeight(element);
    const cy = rect.top + ((element.y + elH / 2) / cardH) * rect.height;
    const onMove = (moveE) => {
      const dx = moveE.clientX - cx;
      const dy = moveE.clientY - cy;
      let rot = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      if (snapGuides?.rotation) rot = Math.round(rot / 45) * 45;
      else if (moveE.shiftKey) rot = Math.round(rot / 15) * 15;
      rot = ((rot % 360) + 360) % 360;
      updateElement(element.id, { rotation: Math.round(rot) });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startConnection = (e, element, point) => {
    e.stopPropagation();
    e.preventDefault();
    const anchor = getAnchorPoint(element, point, elementHeight, cardW, cardH);
    setDragConnection({ fromId: element.id, fromPoint: point, fromX: anchor.x, fromY: anchor.y, toX: anchor.x, toY: anchor.y });
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();

    const onMove = (moveE) => {
      const toX = ((moveE.clientX - rect.left) / rect.width) * cardW;
      const toY = ((moveE.clientY - rect.top) / rect.height) * cardH;
      setDragConnection(dc => dc ? { ...dc, toX, toY } : dc);
    };

    const onUp = (upE) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const target = document.elementFromPoint(upE.clientX, upE.clientY);
      const dotEl = target?.closest?.('[data-conn-dot]');
      if (dotEl) {
        const toId = dotEl.dataset.elId;
        const toPoint = dotEl.dataset.point;
        if (toId && toPoint && toId !== element.id) {
          const newConn = {
            id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            fromId: element.id,
            fromPoint: point,
            toId,
            toPoint,
            style: lineStyle || 'straight',
            width: lineWidth || 2,
            color: '#000000',
          };
          onChange({ ...data, connections: [...connections, newConn] });
        }
      }
      setDragConnection(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startSelection = (e) => {
    if (!selectionMode || selectionMode === 'off') return;
    e.stopPropagation();
    e.preventDefault();
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * cardW;
    const y = ((e.clientY - rect.top) / rect.height) * cardH;
    const additive = e.ctrlKey || e.metaKey;

    if (selectionMode === 'rectangle') {
      setDrawingSelection({ type: 'rectangle', x, y, width: 0, height: 0, _startX: x, _startY: y });
    } else if (selectionMode === 'circle') {
      setDrawingSelection({ type: 'circle', cx: x, cy: y, rx: 0, ry: 0 });
    } else if (selectionMode === 'draw') {
      setDrawingSelection({ type: 'draw', points: [{ x, y }] });
    }

    const onMove = (moveE) => {
      const mx = ((moveE.clientX - rect.left) / rect.width) * cardW;
      const my = ((moveE.clientY - rect.top) / rect.height) * cardH;
      setDrawingSelection(ds => {
        if (!ds) return ds;
        if (ds.type === 'rectangle') {
          const sx = ds._startX, sy = ds._startY;
          return { ...ds, x: Math.min(sx, mx), y: Math.min(sy, my), width: Math.abs(mx - sx), height: Math.abs(my - sy) };
        } else if (ds.type === 'circle') {
          return { ...ds, rx: Math.abs(mx - ds.cx), ry: Math.abs(my - ds.cy) };
        } else if (ds.type === 'draw') {
          return { ...ds, points: [...ds.points, { x: mx, y: my }] };
        }
        return ds;
      });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setDrawingSelection(ds => {
        if (ds) {
          const { _startX, _startY, ...clean } = ds;
          if ((clean.type === 'rectangle' && clean.width > 1 && clean.height > 1) ||
              (clean.type === 'circle' && clean.rx > 1 && clean.ry > 1) ||
              (clean.type === 'draw' && clean.points.length > 2)) {
            onSelectionChange?.(clean, additive);
          }
        }
        return null;
      });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Magic wand: sample the layer under the click and flood-select similar
  // contiguous pixels. Operates on the selected layer (or the top layer).
  const handleMagicPick = async (e) => {
    const card = cardRef.current;
    if (!card) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * cardW;
    const y = ((e.clientY - rect.top) / rect.height) * cardH;
    const target = selectedIds.length > 0
      ? elements.filter(el => selectedIds.includes(el.id))[selectedIds.length - 1]
      : elements[elements.length - 1];
    if (!target || target.type === 'folder') return;
    const additive = e.ctrlKey || e.metaKey;
    setMagicPicking(true);
    try {
      const sel = await magicWandSelect(target, { x, y }, cardW, cardH, magicTolerance);
      if (sel) onSelectionChange?.(sel, additive);
    } finally {
      setMagicPicking(false);
    }
  };

  const cornerClass = {
    tl: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
    tr: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
    bl: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
    br: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  };

  return (
    <div
      ref={cardRef}
      className={`relative rounded-lg shadow-xl overflow-hidden transition-opacity ${selectionMode === 'magic' ? 'cursor-crosshair' : ''} ${magicPicking ? 'opacity-70' : ''}`}
      style={{
        height: `${cardH}px`,
        aspectRatio: `${cardW} / ${cardH}`,
        background: bgColor || 'transparent',
        border: '2px solid #3a2a0a',
        boxSizing: 'border-box',
        ...(bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
      }}
      onMouseDown={(e) => { if (selectionMode === 'magic') { handleMagicPick(e); } else if (selectionMode && selectionMode !== 'off') { startSelection(e); } else if (e.target === e.currentTarget) onSelectElements?.([]); }}
    >
      {elements.map((el, i) => {
        if (el.type === 'folder' || el.hidden) return null;
        const isSelected = selectedIds.includes(el.id);
        const isImage = el.type === 'image';
        const aspectRatio = el.aspectRatio || (el.height ? el.width / el.height : 1);
        const heightPx = isImage ? el.width / aspectRatio : el.height;
        return (
          <div
            key={el.id}
            className={`absolute ${selectionMode === 'magic' ? 'cursor-crosshair' : 'cursor-move'} ${isSelected ? 'outline outline-2 outline-primary' : ''}`}
            style={{
              left: `${el.x}px`,
              top: `${el.y}px`,
              width: `${el.width}px`,
              height: `${heightPx}px`,
              transform: `rotate(${el.rotation || 0}deg)`,
              zIndex: isSelected ? 9999 : (elements.length - i),
            }}
            onMouseDown={(e) => startDrag(e, el)}
          >
            <div className="w-full h-full" style={{ opacity: el.opacity != null ? el.opacity : 1 }}>
            {isImage ? (
              <>
                <img src={el.url} alt="" className="w-full h-full pointer-events-none select-none" draggable={false} style={imagePreviewStyle(el)} />
                {el.effects?.frame && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ boxShadow: `inset 0 0 0 ${Math.max(1, el.effects.frame.width)}px ${el.effects.frame.color || '#000000'}` }}
                  />
                )}
              </>
            ) : el.type === 'shape' ? (
              <ShapePreview el={el} scale={cardScale} />
            ) : el.type === 'drawing' ? (
              <DrawingLayer
                el={el}
                scale={cardScale}
                active={isSelected}
                tool={el.tool}
                onCommitStroke={(s) => updateElement(el.id, { strokes: [...(el.strokes || []), s] })}
              />
            ) : el.type === 'costbar' ? (
              <CostBarPreview el={el} pxH={heightPx * cardScale} />
            ) : el.type === 'grid' ? (
              <GridLayerPreview el={el} pxW={el.width} pxH={heightPx} />
            ) : (
              <ShrinkToFitText el={el} onShrunkChange={onShrinkStateChange}>
                {renderTextContent(el.content, el)}
              </ShrinkToFitText>
            )}
            </div>
            {isSelected && selectedIds.length <= 1 && ['tl', 'tr', 'bl', 'br'].map(c => (
              <div
                key={c}
                className={`absolute w-3 h-3 bg-primary border-2 border-white rounded-sm ${cornerClass[c]}`}
                onMouseDown={(e) => startResize(e, el, c)}
              />
            ))}
            {isSelected && selectedIds.length <= 1 && (
              <div
                className="absolute left-1/2 -top-7 -translate-x-1/2 w-5 h-5 bg-primary border-2 border-white rounded-full cursor-grab active:cursor-grabbing"
                onMouseDown={(e) => startRotate(e, el)}
                title="Drag to rotate (Shift = 15° steps)"
              >
                <div className="absolute left-1/2 top-full w-px h-3 bg-primary -translate-x-1/2" />
              </div>
            )}
          </div>
        );
      })}

      {isActive && <GhostLayer ghost={ghost} cardScale={cardScale} />}

      {selectedIds.length > 1 && (() => {
        const selected = elements.filter(el => selectedIds.includes(el.id) && el.type !== 'folder');
        if (selected.length === 0) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const el of selected) {
          const h = elementHeight(el);
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y);
          maxX = Math.max(maxX, el.x + el.width);
          maxY = Math.max(maxY, el.y + h);
        }
        const bbX = minX, bbY = minY, bbW = maxX - minX, bbH = maxY - minY;
        return (
          <div
            className="absolute"
            style={{ left: `${bbX}px`, top: `${bbY}px`, width: `${bbW}px`, height: `${bbH}px`, zIndex: 10001, pointerEvents: 'none' }}
          >
            <div className="absolute inset-0 border-2 border-primary pointer-events-none" />
            {['tl', 'tr', 'bl', 'br'].map(c => (
              <div
                key={c}
                className={`absolute w-3 h-3 bg-primary border-2 border-white rounded-sm ${cornerClass[c]}`}
                style={{ pointerEvents: 'auto' }}
                onMouseDown={(e) => startMultiResize(e, c)}
              />
            ))}
            <div
              className="absolute left-1/2 -top-7 -translate-x-1/2 w-5 h-5 bg-primary border-2 border-white rounded-full cursor-grab active:cursor-grabbing"
              style={{ pointerEvents: 'auto' }}
              onMouseDown={(e) => startMultiRotate(e)}
              title="Drag to rotate selection (Shift = 15° steps)"
            >
              <div className="absolute left-1/2 top-full w-px h-3 bg-primary -translate-x-1/2" />
            </div>
          </div>
        );
      })()}

      {(connections.length > 0 || dragConnection) && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10000 }}
          viewBox={`0 0 ${cardW} ${cardH}`}
          preserveAspectRatio="none"
        >
          {connections.map(conn => {
            const fromEl = elements.find(e => e.id === conn.fromId);
            const toEl = elements.find(e => e.id === conn.toId);
            if (!fromEl || !toEl) return null;
            const a = getAnchorPoint(fromEl, conn.fromPoint, elementHeight, cardW, cardH);
            const b = getAnchorPoint(toEl, conn.toPoint, elementHeight, cardW, cardH);
            const ax = a.x, ay = a.y;
            const bx = b.x, by = b.y;
            const obstacles = elements
              .filter(el => el.id !== conn.fromId && el.id !== conn.toId)
              .map(el => {
                const h = elementHeight(el);
                return {
                  x1: el.x,
                  y1: el.y,
                  x2: el.x + el.width,
                  y2: el.y + h,
                };
              });
            const path = buildConnectionPath(ax, ay, bx, by, conn.fromPoint, conn.toPoint, conn.style, 12, obstacles);
            const arrows = data?.arrows ? getConnectionArrows(ax, ay, bx, by, conn.fromPoint, conn.toPoint, conn.style, conn.id, 3, 8 + (conn.width || 2), obstacles) : [];
            return (
              <g key={conn.id}>
                <path
                  d={path}
                  stroke={conn.color || '#000000'}
                  strokeWidth={conn.width || 2}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {arrows.map((arrow, i) => {
                  const size = 6;
                  const angle = Math.atan2(arrow.dy, arrow.dx);
                  const cos = Math.cos(angle), sin = Math.sin(angle);
                  const tipX = arrow.x + cos * size, tipY = arrow.y + sin * size;
                  const baseX = arrow.x - cos * size, baseY = arrow.y - sin * size;
                  const headLen = size * 0.7;
                  const ha = 0.5;
                  const h1 = angle + Math.PI - ha;
                  const h2 = angle + Math.PI + ha;
                  return (
                    <path
                      key={`arrow-${i}`}
                      d={`M ${baseX} ${baseY} L ${tipX} ${tipY} M ${tipX} ${tipY} L ${tipX + Math.cos(h1) * headLen} ${tipY + Math.sin(h1) * headLen} M ${tipX} ${tipY} L ${tipX + Math.cos(h2) * headLen} ${tipY + Math.sin(h2) * headLen}`}
                      stroke={conn.color || '#000000'}
                      strokeWidth={conn.width || 2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}
              </g>
            );
          })}
          {dragConnection && (
            <path
              d={`M ${dragConnection.fromX} ${dragConnection.fromY} L ${dragConnection.toX} ${dragConnection.toY}`}
              stroke="#000000"
              strokeWidth={lineWidth || 2}
              fill="none"
              strokeLinecap="round"
              opacity={0.6}
            />
          )}
        </svg>
      )}

      {linesMode && (
        <div className="absolute inset-0" style={{ zIndex: 10001, pointerEvents: 'none' }}>
          {elements.map(el =>
            POINT_NAMES.map(pt => {
              const anchor = getAnchorPoint(el, pt, elementHeight, cardW, cardH);
              return (
                <div
                  key={`${el.id}-${pt}`}
                  data-conn-dot
                  data-el-id={el.id}
                  data-point={pt}
                  className="absolute w-2.5 h-2.5 bg-primary border-2 border-white rounded-full hover:scale-150 transition-transform"
                  style={{
                    left: `${anchor.x}px`,
                    top: `${anchor.y}px`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'crosshair',
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={(e) => startConnection(e, el, pt)}
                />
              );
            })
          )}
        </div>
      )}

      {(selection || drawingSelection) && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10002 }}
          viewBox={`0 0 ${cardW} ${cardH}`}
          preserveAspectRatio="none"
        >
          <defs>
            <filter id="magicBlueTint">
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0.4  0 0 0 0 1  0 0 0 1 0" />
            </filter>
          </defs>
          {[...selectionRegions, drawingSelection].filter(Boolean).map((sel, i) => {
            const dash = i === 0 ? '6 3' : '2 2';
            const opacity = i === 0 ? 0.15 : 0.1;
            if (sel.type === 'rectangle') {
              return <rect key={i} x={sel.x} y={sel.y} width={sel.width} height={sel.height} fill={`rgba(0,100,255,${opacity})`} stroke="#0066ff" strokeWidth="1" strokeDasharray={dash} />;
            } else if (sel.type === 'circle') {
              return <ellipse key={i} cx={sel.cx} cy={sel.cy} rx={sel.rx} ry={sel.ry} fill={`rgba(0,100,255,${opacity})`} stroke="#0066ff" strokeWidth="1" strokeDasharray={dash} />;
            } else if (sel.type === 'draw') {
              const points = (sel.points || []).map(p => `${p.x},${p.y}`).join(' ');
              return <polygon key={i} points={points} fill={`rgba(0,100,255,${opacity})`} stroke="#0066ff" strokeWidth="1" strokeDasharray={dash} />;
            } else if (sel.type === 'magic') {
              return <image key={i} href={sel.maskUrl} x={sel.x} y={sel.y} width={sel.width} height={sel.height} filter="url(#magicBlueTint)" opacity="0.45" />;
            }
            return null;
          })}
        </svg>
      )}
    </div>
  );
}