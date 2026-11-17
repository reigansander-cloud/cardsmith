import { useState, useEffect } from 'react';
import { subscribeUploadedIcons, getUploadedIcons } from '@/lib/uploadedIconsStore';

export function useUploadedIcons() {
  const [icons, setIcons] = useState(getUploadedIcons());
  useEffect(() => subscribeUploadedIcons(setIcons), []);
  return icons;
}