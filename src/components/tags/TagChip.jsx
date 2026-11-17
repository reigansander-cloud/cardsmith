import React from 'react';
import { X } from 'lucide-react';

// tag: { name, color, icon }
export default function TagChip({ tag, onRemove, onClick, className = '' }) {
  const color = tag?.color || '#6b7280';
  const tint = `${color}22`;
  const border = `${color}55`;
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border whitespace-nowrap ${onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
      style={{ backgroundColor: tint, borderColor: border }}
    >
      {tag?.icon ? (
        <img src={tag.icon} alt="" className="w-3 h-3 rounded-full object-cover" />
      ) : (
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      <span className="text-foreground">{tag?.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(tag.name); }}
          className="text-muted-foreground hover:text-destructive -mr-0.5"
          title="Remove tag"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}