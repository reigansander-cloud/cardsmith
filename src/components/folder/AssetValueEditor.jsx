import React, { useState, useRef } from 'react';

// Wraps an icon/keyword cell so right-clicking it opens a tiny number input
// to assign the asset a point value. The value is saved via `onSave`. The
// wrapper uses display:contents so it doesn't affect the child's layout.
export function AssetValueEditor({ children, value, onSave }) {
  const [edit, setEdit] = useState(null);
  const inputRef = useRef(null);

  const handleContext = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEdit({ x: e.clientX, y: e.clientY, draft: String(value || 0) });
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  };

  const save = () => {
    if (!edit) return;
    const n = parseFloat(edit.draft);
    onSave(isNaN(n) ? 0 : n);
    setEdit(null);
  };

  return (
    <>
      <span onContextMenu={handleContext} style={{ display: 'contents' }}>{children}</span>
      {edit && (
        <div className="fixed inset-0 z-50" onMouseDown={(e) => { if (e.target === e.currentTarget) setEdit(null); }}>
          <input
            ref={inputRef}
            type="number"
            value={edit.draft}
            onChange={(e) => setEdit({ ...edit, draft: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); save(); }
              if (e.key === 'Escape') setEdit(null);
            }}
            onBlur={save}
            className="absolute bg-popover border border-border rounded-md px-2 py-1 text-sm shadow-md w-24 outline-none focus:ring-1 focus:ring-ring"
            style={{ left: Math.min(edit.x, window.innerWidth - 130), top: edit.y }}
            placeholder="Value"
          />
        </div>
      )}
    </>
  );
}