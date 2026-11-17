import { useState, useEffect } from 'react';
import { subscribeColors, getColors, subscribeCollected, getCollected } from '@/lib/freeCanvasAssetsStore';

export function useSavedColors() {
  const [colors, setColors] = useState(getColors());
  useEffect(() => subscribeColors(setColors), []);
  return colors;
}

export function useCollected() {
  const [collected, setCollected] = useState(getCollected());
  useEffect(() => subscribeCollected(setCollected), []);
  return collected;
}