import React from 'react';
import { getSymbolByKey } from '@/lib/gridSymbols';

export default function SymbolRenderer({ symbolKey, size = 24 }) {
  const sym = getSymbolByKey(symbolKey);
  if (!sym || symbolKey === 'empty') return null;
  const content = sym.render(size);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ color: '#1a0e00', position: 'relative', zIndex: 10 }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}