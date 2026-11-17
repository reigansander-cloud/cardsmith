import React from 'react';
import { PIP_POSITIONS } from '@/lib/dicePips';

function MiniShape({ shape, color, filled, strokeWidth }) {
  const sw = Math.max(2, (strokeWidth || 3) * 0.4);
  const c = color || '#000';
  const fill = filled ? c : 'none';
  const stroke = filled ? 'none' : c;
  const common = { stroke, strokeWidth: sw, fill, strokeLinejoin: 'round', strokeLinecap: 'round' };
  const svgProps = { viewBox: '0 0 100 100', preserveAspectRatio: 'xMidYMid meet', className: 'w-full h-full' };
  switch (shape) {
    case 'rectangle': return <svg {...svgProps}><rect x="6" y="6" width="88" height="88" {...common} /></svg>;
    case 'rounded': return <svg {...svgProps}><rect x="6" y="6" width="88" height="88" rx="22" {...common} /></svg>;
    case 'ellipse': return <svg {...svgProps}><ellipse cx="50" cy="50" rx="44" ry="44" {...common} /></svg>;
    case 'triangle': return <svg {...svgProps}><polygon points="50,8 92,92 8,92" {...common} /></svg>;
    case 'diamond': return <svg {...svgProps}><polygon points="50,6 94,50 50,94 6,50" {...common} /></svg>;
    case 'line': return <svg {...svgProps}><line x1="12" y1="88" x2="88" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" /></svg>;
    default: return <svg {...svgProps}><rect x="6" y="6" width="88" height="88" {...common} /></svg>;
  }
}

export default function CollectedElementPreview({ el, size = 28 }) {
  if (el.type === 'image') {
    return <img src={el.url} alt="" style={{ width: size, height: size }} className="object-contain" />;
  }
  if (el.type === 'text') {
    const text = (el.content || '').replace(/\[icon:[^\]]+\]/g, '').trim() || 'Text';
    return (
      <span className="text-[8px] leading-tight text-center px-0.5 line-clamp-3 break-words text-foreground" style={{ maxWidth: size * 2 }}>
        {text}
      </span>
    );
  }
  if (el.type === 'shape') {
    if (el.pips) {
      const positions = PIP_POSITIONS[el.pips] || [];
      return (
        <div style={{ width: size, height: size }} className="relative">
          <MiniShape shape={el.shape} color={el.color} filled={el.filled} strokeWidth={el.strokeWidth} />
          {positions.map(([px, py], i) => (
            <div key={i} className="absolute rounded-full" style={{ width: size * 0.13, height: size * 0.13, left: `${px * 100}%`, top: `${py * 100}%`, transform: 'translate(-50%, -50%)', backgroundColor: el.color || '#000' }} />
          ))}
        </div>
      );
    }
    return <div style={{ width: size, height: size }}><MiniShape shape={el.shape} color={el.color} filled={el.filled} strokeWidth={el.strokeWidth} /></div>;
  }
  if (el.type === 'drawing') {
    return <span className="text-[12px]">✎</span>;
  }
  return <span className="text-[10px] uppercase text-muted-foreground">{(el.type || '?')[0]}</span>;
}