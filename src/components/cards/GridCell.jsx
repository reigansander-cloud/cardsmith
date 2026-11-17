import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import SymbolRenderer from './SymbolRenderer';
import SymbolPicker from './SymbolPicker';

export default function GridCell({
  row, col, gridIndex, cellSize, symbol, isOrigin,
  onSymbolChange, onOriginMove, onConnectionStart, onConnectionEnd,
  onClearConnections, interactive = true
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const cellRef = useRef(null);
  const menuRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!showPicker && !showMenu) return;
    const handler = (e) => {
      const inCell = cellRef.current?.contains(e.target);
      const inMenu = menuRef.current?.contains(e.target);
      const inPicker = pickerRef.current?.contains(e.target);
      if (!inCell && !inMenu && !inPicker) {
        setShowPicker(false);
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker, showMenu]);

  const handleClick = (e) => {
    if (!interactive) return;
    const rect = cellRef.current?.getBoundingClientRect();
    if (rect) {
      // Position to the right of the cell, but flip left if near right edge
      const spaceRight = window.innerWidth - rect.right;
      const left = spaceRight > 140 ? rect.right + 4 : rect.left - 136;
      setMenuPos({ top: rect.top, left });
    }
    setShowMenu(true);
  };

  const handleDragStart = (e) => {
    if (!interactive) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ gridIndex, row, col }));
    e.dataTransfer.effectAllowed = 'link';
    onConnectionStart?.({ gridIndex, row, col });
  };

  const handleDrop = (e) => {
    if (!interactive) return;
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    onConnectionEnd?.(data, { gridIndex, row, col });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
  };

  return (
    <div
      ref={cellRef}
      className="relative flex items-center justify-center cursor-pointer transition-colors"
      style={{ width: cellSize, height: cellSize, border: '1px solid #3a2a0a', background: isOrigin ? 'rgba(58,42,10,0.15)' : 'transparent' }}
      onClick={handleClick}
      draggable={interactive}
      onDragStart={handleDragStart}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      data-grid={gridIndex}
      data-row={row}
      data-col={col}
    >
      {isOrigin && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-2 h-2 rounded-full" style={{ background: '#3a2a0a' }} />
        </div>
      )}
      {symbol && symbol !== 'empty' && (
        <SymbolRenderer symbolKey={symbol} size={Math.max(cellSize * 0.65, 10)} />
      )}

      {showMenu && interactive && ReactDOM.createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] bg-card border border-border rounded-lg shadow-xl p-1.5 min-w-[132px]"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted transition-colors"
            onClick={() => { setShowMenu(false); setShowPicker(true); }}
          >Set Symbol</button>
          {!isOrigin && (
            <button
              className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted transition-colors"
              onClick={() => { onOriginMove(row, col); setShowMenu(false); }}
            >Move Origin Here</button>
          )}
          <button
            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
            onClick={() => { onClearConnections(gridIndex, row, col); setShowMenu(false); }}
          >Clear Connections</button>
        </div>,
        document.body
      )}

      {showPicker && ReactDOM.createPortal(
        <div
          ref={pickerRef}
          className="fixed z-[9999]"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <SymbolPicker
            onSelect={(key) => onSymbolChange(row, col, key)}
            onClose={() => setShowPicker(false)}
          />
        </div>,
        document.body
      )}
    </div>
  );
}