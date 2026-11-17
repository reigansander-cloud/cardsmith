import React from 'react';
import { buildLayers, canvasSizeFor } from '@/lib/folderPreview';
import PreviewText from '@/components/folder/PreviewText';
import CostBarPreview from '@/components/folder/CostBarPreview';
import { FolderColorContext } from './FolderColorContext';

// Renders an entry preview scaled to targetWidth. Uses the folder's color as
// the background (falling back to white when no color is set).
export default function MiniEntry({ entry, supertypes = [], targetWidth = 70, influenceOverride = null }) {
  const folderColors = React.useContext(FolderColorContext);
  if (!entry) return null;
  const bgColor = folderColors[entry.folder_id] || '#fff';
  const layers = buildLayers(entry, supertypes);
  if (entry.text_color) {
    layers.forEach((l) => {
      if (l.color === '#000000') l.color = entry.text_color;
      if (l.stroke === '#000000') l.stroke = entry.text_color;
    });
  }
  layers.forEach((l) => { if (l.type === 'costbar') l.questionBorderColor = bgColor; });
  if (influenceOverride) {
    const infLayer = layers.find((l) => l.isInfluence);
    if (infLayer) { infLayer.content = influenceOverride.text; infLayer.color = influenceOverride.color; if (influenceOverride.outline) infLayer.outline = true; }
  }
  const { w, h } = canvasSizeFor(entry, supertypes);
  const scale = targetWidth / w;
  return (
    <div style={{ width: targetWidth, height: h * scale, position: 'relative', overflow: 'hidden', flexShrink: 0, borderRadius: 3, background: bgColor }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
        <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden' }}>
          {layers.map((l, i) => {
            if (l.type === 'costbar') return <CostBarPreview key={i} layer={l} />;
            if (l.type === 'rect') return (
              <div key={i} style={{ position: 'absolute', left: l.x, top: l.y, width: l.w, height: l.h, border: `${l.strokeWidth || 1}px solid ${l.stroke || '#000'}`, boxSizing: 'border-box', pointerEvents: 'none' }} />
            );
            if (l.type === 'image') return (
              <div key={i} style={{ position: 'absolute', left: l.x, top: l.y, width: l.w, display: 'flex', justifyContent: 'center' }}>
                <img src={l.url} alt="" draggable={false} style={{ width: l.w, height: 'auto', objectFit: 'contain', pointerEvents: 'none' }} />
              </div>
            );
            return <PreviewText key={i} layer={l} />;
          })}
        </div>
      </div>
    </div>
  );
}