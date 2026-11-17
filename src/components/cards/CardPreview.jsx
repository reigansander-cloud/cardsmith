import React from 'react';
import PlayingCardCanvas from './playingcard/PlayingCardCanvas';
import GlimpsesCanvas from './glimpses/GlimpsesCanvas';
import FreeCanvasCanvas from './freecanvas/FreeCanvasCanvas';
import SevenWondersCanvas from './sevenwonders/SevenWondersCanvas';

export default function CardPreview({ template, data, bgColor, bgImage, onChange, selectedIds, onSelectElements, snapGuides, linesMode, lineStyle, lineWidth, selectionMode, selection, onSelectionChange, onColorizeRequest, onExitSelectionMode, onShrinkStateChange, isActive, magicTolerance }) {
  if (template === 'playing_card') {
    return <PlayingCardCanvas data={data} bgColor={bgColor} bgImage={bgImage} />;
  }
  if (template === 'glimpses') {
    return <GlimpsesCanvas data={data} />;
  }
  if (template === 'free_canvas') {
    return <FreeCanvasCanvas data={data} bgColor={bgColor} bgImage={bgImage} onChange={onChange} selectedIds={selectedIds} onSelectElements={onSelectElements} snapGuides={snapGuides} linesMode={linesMode} lineStyle={lineStyle} lineWidth={lineWidth} selectionMode={selectionMode} selection={selection} onSelectionChange={onSelectionChange} onColorizeRequest={onColorizeRequest} onExitSelectionMode={onExitSelectionMode} onShrinkStateChange={onShrinkStateChange} isActive={isActive} magicTolerance={magicTolerance} />;
  }
  if (template === 'seven_wonders') {
    return <SevenWondersCanvas data={data} />;
  }
  return <div className="text-muted-foreground">Unknown template</div>;
}