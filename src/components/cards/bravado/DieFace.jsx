import React from 'react';

const PIP_POSITIONS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.5], [0.72, 0.5], [0.28, 0.72], [0.72, 0.72]]
};

export default function DieFace({ value, size = 36 }) {
  const v = Math.max(1, Math.min(6, value));
  const pips = PIP_POSITIONS[v] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="block">
      <rect x="5" y="5" width="90" height="90" rx="16" fill="#fdf6e3" stroke="#3a2a0a" strokeWidth="4" />
      {pips.map(([px, py], i) => (
        <circle key={i} cx={px * 100} cy={py * 100} r="8.5" fill="#3a2a0a" />
      ))}
    </svg>
  );
}