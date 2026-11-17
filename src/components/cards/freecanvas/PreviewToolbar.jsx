import React from 'react';
import CollectedButtons from './CollectedButtons';

export default function PreviewToolbar({ data, onChange, isActive }) {
  return (
    <div className="mt-3 bg-card border border-border rounded-lg p-2" data-no-deselect>
      <div className="grid grid-cols-8 gap-1" data-no-deselect>
        <CollectedButtons data={data} onChange={onChange} isActive={isActive} />
      </div>
    </div>
  );
}