import React from 'react';
import { buildLayers, canvasSizeFor } from '@/lib/folderPreview';
import PreviewText from './PreviewText';
import CostBarPreview from './CostBarPreview';

// Live preview of an entry. Battlefield renders landscape (504x360); all other
// templates render portrait (360x504). Not persisted anywhere.
export default function EntryPreview({ entry, icons, supertypes = [], folderColor = '' }) {
  const layers = buildLayers(entry, supertypes);
  layers.forEach((l) => { if (l.type === 'costbar') l.questionBorderColor = '#ffffff'; });
  const { w, h } = canvasSizeFor(entry, supertypes);
  return (
    <div style={{ position: 'relative', width: w, height: h, background: '#ffffff', border: '1px solid #d4d4d4', overflow: 'hidden', flexShrink: 0 }}>
      {layers.map((l, i) => {
        if (l.type === 'costbar') return <CostBarPreview key={i} layer={l} />;
        if (l.type === 'rect') {
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: l.x,
                top: l.y,
                width: l.w,
                height: l.h,
                border: `${l.strokeWidth || 1}px solid ${l.stroke || '#000'}`,
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            />
          );
        }
        if (l.type === 'image') {
          return (
            <div key={i} style={{ position: 'absolute', left: l.x, top: l.y, width: l.w, display: 'flex', justifyContent: 'center' }}>
              <img src={l.url} alt="" style={{ width: l.w, height: 'auto', objectFit: 'contain' }} />
            </div>
          );
        }
        return <PreviewText key={i} layer={l} />;
      })}
    </div>
  );
}