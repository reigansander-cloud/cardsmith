import React from 'react';
import { getIconByKey } from '@/lib/cardIcons';

export default function IconRenderer({ iconKey, size = 24, className = '', style = {} }) {
  const icon = getIconByKey(iconKey);
  if (!icon) return null;
  if (icon.url) {
    return (
      <img
        src={icon.url}
        alt={icon.label}
        crossOrigin="anonymous"
        className={`inline-block object-contain ${className}`}
        style={{ width: size, height: size, ...style }}
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size, ...style }}
      dangerouslySetInnerHTML={{ __html: icon.svg }}
    />
  );
}