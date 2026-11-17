import React, { useRef } from 'react';

// Textarea that supports Ctrl+B (bold) and Ctrl+I (italic) markdown shortcuts
export default function RichTextarea({ value, onChange, placeholder, rows = 6, className = '' }) {
  const ref = useRef(null);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault();
      const el = ref.current;
      const { selectionStart: start, selectionEnd: end } = el;
      const marker = e.key === 'b' ? '**' : '_';
      const selected = value.slice(start, end);
      const newVal = value.slice(0, start) + marker + selected + marker + value.slice(end);
      onChange({ target: { value: newVal } });
      // Restore cursor after the markers
      requestAnimationFrame(() => {
        el.selectionStart = start + marker.length;
        el.selectionEnd = end + marker.length;
      });
    }
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={rows}
      className={`w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring ${className}`}
    />
  );
}