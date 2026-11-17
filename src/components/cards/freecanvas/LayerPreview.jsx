import React from 'react';
import { Type, Pencil, Coins, Grid as GridIcon } from 'lucide-react';
import { PIP_POSITIONS } from '@/lib/dicePips';

// Small visual preview shown in layer rows instead of a grab-handle icon.
export default function LayerPreview({ el, size = 18 }) {
  const box = { width: size, height: size, flexShrink: 0 };

  if (el.type === 'text') {
    return (
      <div style={box} className="flex items-center justify-center border border-border rounded bg-muted/30 text-foreground">
        <Type size={Math.round(size * 0.6)} />
      </div>
    );
  }
  if (el.type === 'image') {
    return (
      <div style={box} className="rounded overflow-hidden border border-border bg-muted/20">
        <img src={el.url} alt="" className="w-full h-full object-contain" />
      </div>
    );
  }
  if (el.type === 'drawing') {
    return (
      <div style={box} className="flex items-center justify-center border border-border rounded bg-muted/30 text-foreground">
        <Pencil size={Math.round(size * 0.55)} />
      </div>
    );
  }
  if (el.type === 'costbar') {
    return (
      <div style={box} className="flex items-center justify-center border border-border rounded bg-muted/30 text-foreground">
        <Coins size={Math.round(size * 0.55)} />
      </div>
    );
  }
  if (el.type === 'grid') {
    return (
      <div style={box} className="flex items-center justify-center border border-border rounded bg-muted/30 text-foreground">
        <GridIcon size={Math.round(size * 0.55)} />
      </div>
    );
  }
  if (el.type === 'shape') {
    const color = el.color || '#000000';
    const filled = el.filled;
    const pips = el.pips ? (PIP_POSITIONS[el.pips] || []) : [];
    let inner = null;
    const s = 20;
    if (el.shape === 'ellipse') {
      inner = filled
        ? <circle cx="10" cy="10" r="8" fill={color} />
        : <circle cx="10" cy="10" r="7" fill="none" stroke={color} strokeWidth="2" />;
    } else if (el.shape === 'triangle') {
      inner = filled
        ? <polygon points="10,2 19,18 1,18" fill={color} />
        : <polygon points="10,3 18,17 2,17" fill="none" stroke={color} strokeWidth="2" />;
    } else if (el.shape === 'diamond') {
      inner = filled
        ? <polygon points="10,1 19,10 10,19 1,10" fill={color} />
        : <polygon points="10,2 18,10 10,18 2,10" fill="none" stroke={color} strokeWidth="2" />;
    } else if (el.shape === 'line') {
      inner = <line x1="2" y1="2" x2="18" y2="18" stroke={color} strokeWidth="2" />;
    } else if (el.shape === 'rounded') {
      inner = filled
        ? <rect x="1" y="1" width="18" height="18" rx="4" fill={color} />
        : <rect x="2" y="2" width="16" height="16" rx="4" fill="none" stroke={color} strokeWidth="2" />;
    } else {
      inner = filled
        ? <rect x="1" y="1" width="18" height="18" fill={color} />
        : <rect x="2" y="2" width="16" height="16" fill="none" stroke={color} strokeWidth="2" />;
    }
    return (
      <div style={box} className="flex items-center justify-center">
        <svg width={size} height={size} viewBox="0 0 20 20">
          {inner}
          {pips.map(([px, py], i) => (
            <circle key={i} cx={px * 20} cy={py * 20} r="1.6" fill={color} />
          ))}
        </svg>
      </div>
    );
  }
  return <div style={box} className="border border-border rounded bg-muted/30" />;
}